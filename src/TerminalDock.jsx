import React,{useEffect,useRef,useState} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

function Surface({bridge,projectId,session,onState,onError,onUnavailable}){
 const host=useRef(null);
 useEffect(()=>{
  let alive=true,busy=false,revision=-1,pending=0,previous='';
  const terminal=new Terminal({scrollback:1000,fontSize:13,theme:{background:'#0c1016',foreground:'#d5dce8'},allowProposedApi:false});
  const fit=new FitAddon();terminal.loadAddon(fit);terminal.open(host.current);
  const fail=e=>{if(alive)onError(e.message||'Native terminal unavailable.');};
  const size=()=>{if(!alive)return;try{fit.fit();const cols=Math.max(2,Math.min(300,terminal.cols)),rows=Math.max(2,Math.min(100,terminal.rows));bridge.ptyResize(projectId,session.id,cols,rows).catch(fail);}catch{}};
  const input=terminal.onData(data=>{
   if(!alive)return;
   if(pending>=16){fail(new Error('Input queue full. Paste smaller text.'));return;}
   // Refuse large pastes rather than allocating an unbounded IPC queue.
   if(new TextEncoder().encode(data).length>4096){fail(new Error('Paste limit is 4096 bytes.'));return;}
   pending++;bridge.ptyInput(projectId,session.id,data).catch(fail).finally(()=>pending--);
  });
  const paint=state=>{if(!alive)return;if(state.revision!==revision){if(revision>=0&&state.output.startsWith(previous))terminal.write(state.output.slice(previous.length));else{terminal.reset();terminal.write(state.output);}previous=state.output;revision=state.revision;}onState(state);};
  paint(session);
  const poll=async()=>{if(busy||!alive)return;busy=true;try{paint(await bridge.ptyRead(projectId,session.id));}catch(e){if(alive){fail(e);alive=false;onUnavailable();}}finally{busy=false;}};
  const timer=setInterval(poll,500);const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(size):null;observer?.observe(host.current);size();terminal.focus();
  return ()=>{alive=false;clearInterval(timer);observer?.disconnect();input.dispose();terminal.dispose();};
 },[bridge,projectId,session.id]);
 return <div ref={host} className="terminal-surface" aria-label="Interactive native shell"/>;
}
export default function TerminalDock({bridge,project,projects,disabled}){
 const [sessions,setSessions]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(null);active.current=project?`${project.id}:${project.localPath}`:null;
 const mounted=useRef(true),currentProjects=useRef(projects);currentProjects.current=projects;
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 const native=!!bridge.ptyStart&&!bridge.preview;
 const session=project&&sessions[project.id]?.path===project.localPath?sessions[project.id]:null;
 useEffect(()=>{setError('');setBusy(false);},[project?.id,project?.localPath]);
 useEffect(()=>{setSessions(old=>Object.fromEntries(Object.entries(old).filter(([id,s])=>projects.some(p=>p.id===id&&p.localPath===s.path&&!p.archived))));},[projects]);
 async function start(){const key=active.current,p=project;setBusy(true);setError('');try{const state=await bridge.ptyStart(p.id);if(mounted.current&&currentProjects.current.some(item=>item.id===p.id&&item.localPath===p.localPath&&!item.archived))setSessions(old=>({...old,[p.id]:{...state,path:p.localPath}}));}catch(e){if(active.current===key)setError(e.message||'Native terminal unavailable.');}finally{if(active.current===key)setBusy(false);}}
 async function close(){const key=active.current,p=project;setBusy(true);try{await bridge.ptyClose(p.id,session.id);if(active.current===key)setSessions(old=>{const next={...old};delete next[p.id];return next;});}catch(e){if(active.current===key){setError(e.message);setSessions(old=>{const next={...old};delete next[p.id];return next;});}}finally{if(active.current===key)setBusy(false);}}
 return <section hidden={!project} aria-label="Project terminal" className="terminal-dock">
  <div className="terminal-heading"><strong>TERMINAL <small>{project?.name} · local shell</small></strong>{session?<button disabled={busy||disabled} onClick={close}>Close shell</button>:<button disabled={!native||!project?.localPath||busy||disabled} onClick={start}>{busy?'Starting…':'Start native shell'}</button>}</div>
  {!native?<p>Native terminal unavailable in browser preview. No shell is running here.</p>:!session?<p>Explicit start only. The shell has full access to your files and network as your OS user. App credentials are not inherited; credentials on disk remain accessible. No project scripts are started automatically. Choose a saved local directory first.</p>:<><p className="terminal-status">{session.unavailable?'Shell connection unavailable · close to retry':session.running?'Running · retained when switching projects and tabs':'Shell exited · close to start again'} · up to 4 sessions · bounded recent output</p>{!session.unavailable&&<Surface key={`${project.id}:${session.id}`} bridge={bridge} projectId={project.id} session={session} onState={state=>setSessions(old=>old[project.id]?.id===state.id?{...old,[project.id]:{...state,path:project.localPath}}:old)} onError={setError} onUnavailable={()=>setSessions(old=>old[project.id]?.id===session.id?{...old,[project.id]:{...old[project.id],unavailable:true}}:old)}/>}</>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
