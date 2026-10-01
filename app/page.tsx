'use client';

import {useEffect,useMemo,useState} from 'react';
import {Sparkles,Code2,Eye,Send,Plus,Github,Rocket,Terminal,LayoutTemplate,Settings,ChevronDown,FileCode2,MessageSquare} from 'lucide-react';

type FileItem={path:string;content:string};
type Chat={role:'user'|'assistant';content:string};

const initialFiles:FileItem[]=[
 {path:'index.html',content:'<!doctype html><html><head><meta charset="UTF-8"><title>VibeForge App</title></head><body><div id="root"></div><script type="module" src="/src/App.jsx"></script></body></html>'},
 {path:'src/App.jsx',content:'export default function App(){return <main><h1>Build at the speed of thought.</h1><p>Ask VibeForge to create your app.</p></main>}'},
 {path:'src/styles.css',content:'body{margin:0;background:#090909;color:#fff;font-family:Inter,system-ui,sans-serif}main{min-height:100vh;display:grid;place-content:center;text-align:center;padding:24px}'}
];

const starterPreview='<style>body{margin:0;background:#090909;color:#fff;font-family:Inter,system-ui,sans-serif}.wrap{min-height:100vh;display:grid;place-content:center;text-align:center;padding:24px}.badge{color:#d4af37;letter-spacing:2px;font-size:12px}.wrap h1{font-size:52px;margin:18px 0}.wrap p{color:#999}.btn{margin-top:18px;padding:12px 18px;border:0;border-radius:10px;background:#d4af37;font-weight:700}</style><main class="wrap"><div class="badge">VIBEFORGE</div><h1>Build at the speed of thought.</h1><p>Describe an app and let AI build the project.</p><button class="btn">Start building</button></main>';

export default function Home(){
 const[files,setFiles]=useState<FileItem[]>(initialFiles);
 const[active,setActive]=useState('src/App.jsx');
 const[prompt,setPrompt]=useState('');
 const[chats,setChats]=useState<Chat[]>([{role:'assistant',content:'Hi — I’m VibeForge. Tell me what you want to build or change.'}]);
 const[preview,setPreview]=useState(starterPreview);
 const[tab,setTab]=useState<'code'|'preview'>('code');
 const[running,setRunning]=useState(false);
 const[error,setError]=useState('');
 const[title,setTitle]=useState('my-first-app');

 useEffect(()=>{try{const saved=localStorage.getItem('vibeforge-workspace');if(saved){const d=JSON.parse(saved);if(d.files)setFiles(d.files);if(d.chats)setChats(d.chats);if(d.preview)setPreview(d.preview);if(d.title)setTitle(d.title)}}catch{}},[]);
 useEffect(()=>{localStorage.setItem('vibeforge-workspace',JSON.stringify({files,chats,preview,title}))},[files,chats,preview,title]);

 const current=useMemo(()=>files.find(f=>f.path===active)||files[0],[files,active]);
 function updateCode(content:string){setFiles(prev=>prev.map(f=>f.path===active?{...f,content}:f))}
 async function generate(){
   if(!prompt.trim()||running)return;
   const userPrompt=prompt.trim(); setPrompt(''); setError(''); setRunning(true);
   setChats(c=>[...c,{role:'user',content:userPrompt}]);
   try{
    const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:userPrompt,files})});
    const d=await r.json(); if(!r.ok)throw Error(d.error||'Generation failed');
    setFiles(d.files||files); setPreview(d.previewHtml||preview); setTitle(String(d.title||title).toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,30)||title);
    if(d.files?.length)setActive(d.files.find((f:FileItem)=>f.path.includes('App'))?.path||d.files[0].path);
    setChats(c=>[...c,{role:'assistant',content:d.message||'Project updated. The generated files are now in your workspace and the preview has been refreshed.'}]);
    setTab('preview');
   }catch(e){const msg=e instanceof Error?e.message:'Generation failed';setError(msg);setChats(c=>[...c,{role:'assistant',content:'I could not generate the project: '+msg}])}
   finally{setRunning(false)}
 }
 return <div className="shell">
  <header><div className="brand"><div className="logo">V</div><b>VibeForge</b><span className="beta">GEMINI</span></div><div className="project"><span className="dot"/> {title}<ChevronDown size={14}/></div><div className="actions"><button><Github size={15}/> GitHub</button><button><Settings size={15}/></button><button className="deploy"><Rocket size={15}/> Deploy</button></div></header>
  <div className="body">
   <aside><button className="new" onClick={()=>{setFiles(initialFiles);setActive('src/App.jsx');setPreview(starterPreview);setChats([{role:'assistant',content:'New workspace created. What should we build?'}]);}}><Plus size={15}/> New project</button>
    <div className="nav"><div className="active"><Code2 size={15}/> Workspace</div><div><LayoutTemplate size={15}/> Templates</div><div><Terminal size={15}/> Logs</div></div>
    <div className="files"><small>PROJECT FILES</small>{files.map(f=><button className={'file '+(f.path===active?'fileActive':'')} key={f.path} onClick={()=>{setActive(f.path);setTab('code')}}><FileCode2 size={13}/>{f.path}</button>)}</div>
    <div className="usage">AI ENGINE<div className="engine">Gemini</div><small>GEMINI_API_KEY from environment</small></div>
   </aside>
   <section className="chat"><div className="chatHead"><MessageSquare size={15}/> AI coding chat</div><div className="messages">{chats.map((m,i)=><div className={'msg '+m.role} key={i}><span className="msgRole">{m.role==='user'?'YOU':'VIBE AI'}</span><div>{m.content}</div></div>)}{running&&<div className="msg assistant"><span className="msgRole">VIBE AI · LIVE</span><div className="typing"><i/><i/><i/> Generating with Gemini…</div>{streamText&&<div className="streamText">{streamText.slice(-1800)}</div>}</div>}</div><div className="composer"><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey))generate()}} placeholder="Ask AI to build or modify your app…"/><button onClick={generate} disabled={running||!prompt.trim()}><Send size={15}/></button><small>⌘/Ctrl + Enter to build</small></div></section>
   <main className="workspace"><div className="toolbar"><div className="tabs"><button className={tab==='code'?'selected':''} onClick={()=>setTab('code')}><Code2 size={14}/> Code</button><button className={tab==='preview'?'selected':''} onClick={()=>setTab('preview')}><Eye size={14}/> Preview</button></div><span className="ready">● Workspace saved</span></div><div className="panel">{tab==='code'?<div className="editor"><div className="editorTop"><span>{current?.path}</span><span>{files.length} files</span></div><div className="editorBody"><pre>{(current?.content||'').split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</pre><textarea value={current?.content||''} onChange={e=>updateCode(e.target.value)} spellCheck={false}/></div></div>:<iframe title="VibeForge live preview" srcDoc={preview}/>}</div><footer><span>{error?<b className="err">{error}</b>:<>✓ Changes saved locally</>}</span><span>Next.js · Gemini · Vercel</span></footer></main>
  </div>
 </div>
}