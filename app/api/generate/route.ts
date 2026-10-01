import {NextResponse} from 'next/server';

type FileItem={path:string;content:string};

function extractJson(text:string){
 const cleaned=text.replace(/^\s*\`\`\`json\s*/,'').replace(/\s*\`\`\`\s*$/,'').trim();
 const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
 if(start<0||end<0) throw new Error('Gemini returned invalid JSON.');
 return JSON.parse(cleaned.slice(start,end+1));
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  const prompt=String(body?.prompt||'').trim();
  const files:Array<FileItem>=Array.isArray(body?.files)?body.files:[];

  if(!prompt)return NextResponse.json({error:'Prompt is required.'},{status:400});
  const key=process.env.GEMINI_API_KEY;
  if(!key)return NextResponse.json({error:'GEMINI_API_KEY is not configured in Vercel.'},{status:500});

  const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
  const context=files.slice(0,25).map(f=>'--- '+f.path+' ---\n'+String(f.content).slice(0,10000)).join('\n');

  const instruction=`You are VibeForge, a realtime AI coding agent.
Return ONLY valid JSON with:
{"message":"string","title":"string","files":[{"path":"string","content":"string"}],"previewHtml":"string"}

The files array MUST contain the complete current project after applying the user's request, not patches.
Preserve existing files and functionality unless the request changes them.
Use safe relative paths only.
For browser UI projects, prefer index.html, src/App.jsx and src/styles.css.
previewHtml MUST be complete standalone HTML that can be inserted directly into an iframe srcDoc. It must visually represent the CURRENT generated files and include all required CSS/JS inline.
Make the UI polished, responsive and functional.
No markdown fences.
Existing project:
${context||'(new project)'}`;

  const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':streamGenerateContent?alt=sse&key='+encodeURIComponent(key),{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({contents:[{role:'user',parts:[{text:instruction+'\n\nUser request: '+prompt}]}],generationConfig:{temperature:.2,responseMimeType:'application/json'}})
  });

  if(!upstream.ok){
   const body=await upstream.text();
   return NextResponse.json({error:'Gemini request failed ('+upstream.status+'): '+body.slice(0,500)},{status:502});
  }

  const reader=upstream.body?.getReader();
  if(!reader)throw new Error('Gemini stream unavailable.');
  const decoder=new TextDecoder();
  let buffer='',raw='';

  const stream=new ReadableStream({
   async start(controller){
    const send=(event:string,data:unknown)=>controller.enqueue(new TextEncoder().encode('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n'));
    try{
     send('status',{message:'Gemini connected'});
     while(true){
      const {value,done}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');buffer=lines.pop()||'';
      for(const line of lines){
       const trimmed=line.trim();
       if(!trimmed.startsWith('data:'))continue;
       const payload=trimmed.slice(5).trim();
       if(!payload||payload==='[DONE]')continue;
       try{
        const chunk=JSON.parse(payload);
        const text=chunk?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'';
        if(text){raw+=text;send('token',{text});}
       }catch{}
      }
     }
     const result=extractJson(raw);
     const safeFiles=Array.isArray(result.files)?result.files.filter((f:FileItem)=>f&&typeof f.path==='string'&&typeof f.content==='string'&&!f.path.includes('..')).map((f:FileItem)=>({path:f.path.replace(/^\/+/,''),content:f.content})):[];
     if(!safeFiles.length)throw new Error('Gemini returned no project files.');
     send('complete',{message:result.message||'Project updated.',title:result.title||'my-first-app',files:safeFiles,previewHtml:typeof result.previewHtml==='string'?result.previewHtml:''});
     controller.close();
    }catch(error){
     send('error',{error:error instanceof Error?error.message:'Generation failed'});
     controller.close();
    }
   }
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Generation failed'},{status:500});}
}