import {NextResponse} from 'next/server';
type FileItem={path:string;content:string};
function extractJson(text:string){
  const cleaned=text.replace(/^```json\s*/,'').replace(/\s*```$/,'').trim();
  const start=cleaned.indexOf('{'), end=cleaned.lastIndexOf('}');
  return JSON.parse(start>=0&&end>=0?cleaned.slice(start,end+1):cleaned);
}
export async function POST(req:Request){
  try{
    const {prompt,files=[]}:{prompt:string;files:FileItem[]} = await req.json();
    if(!prompt?.trim()) return NextResponse.json({error:'Prompt is required'},{status:400});
    const key=process.env.OPENROUTER_API_KEY;
    if(!key) return NextResponse.json({error:'OPENROUTER_API_KEY is not configured.'},{status:500});
    const model=process.env.OPENROUTER_MODEL||'openai/gpt-oss-120b:free';
    const existing=Array.isArray(files)?files.slice(0,30):[];
    const context=existing.map(f=>'--- '+f.path+' ---\n'+String(f.content).slice(0,12000)).join('\n');
    const system=`You are VibeForge, an AI coding agent. You modify a small web project from natural-language requests.
Return ONLY valid JSON with keys message, title, files, previewHtml.
files must be an array of complete current project files: [{path,content}].
Always return the COMPLETE current project files after the change, not patches.
Use safe relative paths. For UI projects prefer index.html, src/App.jsx and src/styles.css.
previewHtml must be complete standalone HTML that runs directly in an iframe and must contain all CSS and JS needed for the visible result.
Preserve useful existing functionality unless the user asks to replace it. Make the result polished and functional. Never use markdown fences.
Current project:
${context||'(empty starter project)'}`;
    const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json','HTTP-Referer':process.env.NEXT_PUBLIC_APP_URL||'https://vibeforge.vercel.app','X-Title':'VibeForge'},
      body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.25})
    });
    if(!response.ok){const body=await response.text();return NextResponse.json({error:'OpenRouter request failed ('+response.status+'): '+body.slice(0,300)},{status:502});}
    const data=await response.json(); const text=data?.choices?.[0]?.message?.content;
    if(!text) return NextResponse.json({error:'OpenRouter returned no content.'},{status:502});
    const result=extractJson(typeof text==='string'?text:JSON.stringify(text));
    if(!Array.isArray(result.files)) throw new Error('The AI did not return a valid file set.');
    const safeFiles=result.files.filter((f:FileItem)=>f&&typeof f.path==='string'&&typeof f.content==='string'&&!f.path.includes('..')).map((f:FileItem)=>({path:f.path.replace(/^\/+/,''),content:f.content}));
    return NextResponse.json({message:result.message||'Project updated.',title:result.title||'my-first-app',files:safeFiles,previewHtml:typeof result.previewHtml==='string'?result.previewHtml:''});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Generation failed'},{status:500});}
}