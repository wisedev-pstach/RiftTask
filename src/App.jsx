import React, { useEffect, useRef, useState } from 'react';
import CloudPanel from './CloudPanel.jsx';
import TerminalDock from './TerminalDock.jsx';
const id = () => crypto.randomUUID();
const statuses = {backlog:'Backlog',doing:'In progress',done:'Done'};
const blank = () => ({version:1,categories:[],projects:[],tasks:[],updatedAt:new Date().toISOString()});
function previewBridge(){
 let workspace=blank();
 return {preview:true,session:async()=>({account:{id:0,login:'Browser preview',name:'Browser preview'},offline:false,ghAvailable:false}),load:async()=>structuredClone(workspace),save:async next=>{workspace=structuredClone(next);return structuredClone(workspace);}};
}
function Field({label,children,...props}) {
 return <label className="field"><span>{label}</span>{children || <input {...props}/>}</label>;
}
function TaskFields({item,projects,projectId,milestones}) {
 const [selectedProject,setSelectedProject]=useState(item?.projectId||projectId||projects[0]?.id);
 return <>
  <Field label="Task title" name="title" required autoFocus maxLength={240} defaultValue={item?.title}/>
  <Field label="Project"><select name="projectId" value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
  <Field label="Milestone"><select key={selectedProject} name="milestoneId" defaultValue={selectedProject===item?.projectId?item?.milestoneId||'':''}><option value="">No milestone</option>{milestones.filter(m=>m.projectId===selectedProject).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
  <Field label="Notes"><textarea name="notes" rows={5} defaultValue={item?.notes||''}/></Field>
  <div className="field-row"><Field label="Status"><select name="status" defaultValue={item?.status||'backlog'}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
  <Field label="Priority"><select name="priority" defaultValue={item?.priority||'normal'}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></Field></div>
  <Field label="Due date" type="date" name="dueDate" defaultValue={item?.dueDate||''}/>
  <label className="check"><input type="checkbox" name="today" defaultChecked={item?.today}/>Pin to Today</label>
 </>;
}
function TaskRow({task:t,project,milestone,saving,onStatus,onEdit}) {
 return <article className={`task-row ${t.status==='done'?'completed':''}`}>
  <select aria-label={`Status for ${t.title}`} value={t.status} disabled={saving} onChange={e=>onStatus(t,e.target.value)}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
  <button className="task-title" aria-label={`Edit task ${t.title}`} disabled={saving} onClick={()=>onEdit('task',t)}>{t.title}<small>{project?.name}</small></button>
  <span className={`priority ${t.priority}`}>{t.priority}</span>{milestone&&<span className="task-tag" style={{borderColor:milestone.color}}>{milestone.name}</span>}{t.today&&<span className="task-tag">Today</span>}{t.dueDate&&<time dateTime={t.dueDate}>{t.dueDate}</time>}
 </article>;
}
export default function App({bridge: providedBridge = window.rift}) {
 const [bridge]=useState(()=>providedBridge||previewBridge());
 const [session,setSession]=useState(null), [workspace,setWorkspace]=useState(null), [error,setError]=useState('');
 const [view,setView]=useState('all'), [editor,setEditor]=useState(null), [saving,setSaving]=useState(false);
 const [search,setSearch]=useState(''), [layout,setLayout]=useState('list'), [confirmDelete,setConfirmDelete]=useState(false);
 const [feature,setFeature]=useState('tasks'),[cloudOpen,setCloudOpen]=useState(false);
 function navigate(next){setView(next);setSearch('');setFeature('tasks');}
 const lock=useRef(false), trigger=useRef(null), context=useRef(0);
 const [notice,setNotice]=useState(''), [restorePrompt,setRestorePrompt]=useState(false), [connecting,setConnecting]=useState(false);
 useEffect(()=>{context.current++;setNotice(current=>current.startsWith('Git ')?'':current);},[view,workspace]);
 useEffect(()=>{
  if(!editor&&!restorePrompt)return;
  const dialog=document.querySelector('[role="dialog"]');
  const focusable=()=>[...dialog.querySelectorAll('input,select,textarea,button,[tabindex="0"]')].filter(el=>!el.matches(':disabled'));
  if(!dialog.contains(document.activeElement))focusable()[0]?.focus();
  function keys(e){
   if(e.key==='Escape'&&!lock.current){e.preventDefault();setEditor(null);setRestorePrompt(false);}
   if(e.key==='Tab'){
    const items=focusable(),first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  }
  document.addEventListener('keydown',keys);
  return ()=>{document.removeEventListener('keydown',keys);trigger.current?.focus();};
 },[editor,restorePrompt]);
 async function nativeAction(method,arg){
  if(lock.current)return;
  lock.current=true;setSaving(true);setError('');setNotice('');
  const requestContext=context.current;
  try {
   const result=await bridge[method](...(arg===undefined?[]:[arg]));
   if(method==='gitStatus'&&requestContext===context.current)setNotice(result?`Git branch: ${result.branch} — ${result.changed} changed entries.`:'Git status unavailable: this project directory is not a Git repository.');
   if(method==='logout'){setCloudOpen(false);setWorkspace(null);setSession({account:null,offline:false,ghAvailable:session.ghAvailable});navigate('all');setEditor(null);}
   if(method==='exportBackup'&&result)setNotice('Backup exported.');
   if(method==='importBackup'&&result){setWorkspace(result);navigate('all');setNotice('Backup restored.');}
   if(method==='chooseDirectory'&&result){const input=document.querySelector('[name="localPath"]');if(input)input.value=result;}
  }catch(e){if(method!=='gitStatus'||requestContext===context.current)setError(e.message||'Native action failed.');}
  finally {lock.current=false;setSaving(false);setRestorePrompt(false);}
 }
 async function connect(login=false) {
  if(lock.current)return;lock.current=true;setConnecting(true);setError('');
  try {const s=await bridge[login?'login':'session']();setSession(s);if(s.account)setWorkspace(await bridge.load());}
  catch(e){setError(e.message||'Could not open workspace.');}
  finally{lock.current=false;setConnecting(false);}
 }
 useEffect(()=>{connect();},[]);
 async function persist(next) {
  if(lock.current)return false;
  lock.current=true;setSaving(true);setError('');
  try {setWorkspace(await bridge.save({...next,updatedAt:new Date().toISOString()}));return true;}
  catch(e){setError(e.message||'Could not save workspace. Please try again.');return false;}
  finally {lock.current=false;setSaving(false);}
 }
 function edit(type,item){if(lock.current||!workspace)return;trigger.current=document.activeElement;setError('');setConfirmDelete(false);setEditor({type,item});}
 async function submit(e) {
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget));
  const item={...editor.item,...data,id:editor.item?.id||id()};
  const key={category:'categories',project:'projects',task:'tasks',milestone:'milestones'}[editor.type];
  if(key==='milestones')item.projectId=editor.item?.projectId||project.id;
  if(key==='projects')item.archived=editor.item?.archived||false;
  if(key==='tasks'){
   if(data.milestoneId===''&&editor.item?.milestoneId===undefined)delete item.milestoneId;
   item.today=data.today==='on';item.createdAt=editor.item?.createdAt||new Date().toISOString();
   item.completedAt=item.status==='done'?(editor.item?.completedAt||new Date().toISOString()):null;
  }
  const next={...workspace,[key]:editor.item?(workspace[key]||[]).map(x=>x.id===item.id?item:x):[...(workspace[key]||[]),item]};
  if(await persist(next)){setEditor(null);if(key==='projects')navigate(`project:${item.id}`);if(key==='tasks'&&view!=='today'&&(view!==`project:${item.projectId}`||feature!=='tasks'))navigate(`project:${item.projectId}`);}
 }
 async function changeStatus(task,status){await persist({...workspace,tasks:workspace.tasks.map(t=>t.id===task.id?{...t,status,completedAt:status==='done'?new Date().toISOString():null}:t)});}
 async function archiveProject(p,archived){if(await persist({...workspace,projects:workspace.projects.map(x=>x.id===p.id?{...x,archived}:x)})){setEditor(null);if(archived)navigate('all');}}
 async function deleteTask(){if(await persist({...workspace,tasks:workspace.tasks.filter(t=>t.id!==editor.item.id)}))setEditor(null);}
 if(!session)return <main className="welcome"><p role="status">Loading workspace…</p>{error&&<><p role="alert">{error}</p><button disabled={connecting} onClick={()=>connect()}>Retry loading</button></>}</main>;
 if(!session.account)return <main className="welcome"><div className="brand">RiftTask</div><h1>Your work, on this device.</h1><p>Sign in with GitHub to open your local workspace. Optional manual cloud sync is available after sign-in and explicit setup.</p><p>{session.ghAvailable?'First run gh auth login --hostname github.com --git-protocol https --web in your terminal, then check sign-in here. These buttons verify the CLI account; they do not launch a login flow. No tokens are exposed to this interface.':'GitHub CLI is required. Install gh and run gh auth login --hostname github.com --git-protocol https --web in your terminal, then check sign-in.'}</p><button className="primary" disabled={connecting} onClick={()=>connect(true)}>Sign in with GitHub</button><button disabled={connecting} onClick={()=>connect(true)}>Check sign-in</button>{connecting&&<p role="status">Waiting for account verification…</p>}{error&&<p role="alert">{error}</p>}</main>;
 const project=workspace?.projects.find(p=>`project:${p.id}`===view&&!p.archived);
 const activeProjects=workspace?.projects.filter(p=>!p.archived)||[];
 const category=workspace?.categories.find(c=>view===`category:${c.id}`);
 const overview=view==='all'||!!category;
 const visibleProjects=activeProjects.filter(p=>!category||p.categoryId===category.id);
 const tasks=(workspace?.tasks||[]).filter(t=>activeProjects.some(p=>p.id===t.projectId)&&(view==='today'?t.today:t.projectId===project?.id)).filter(t=>`${t.title} ${t.notes}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="app">
  <aside><div className="brand">RiftTask <small>LOCAL WORKSPACE</small></div>
   <nav aria-label="Workspace"><button className={view==='all'?'active':''} onClick={()=>navigate('all')}>Projects</button><button className={view==='today'?'active':''} onClick={()=>navigate('today')}>Today</button></nav>
   <div className="section-label">PROJECTS</div><div className="tree-actions"><button disabled={!workspace||saving} onClick={()=>edit('category')}>New category</button><button disabled={!workspace?.categories.length||saving} onClick={()=>edit('project')}>New project</button></div>
   {workspace?.categories.map(c=><section key={c.id}><div className="category"><span className="dot" style={{background:c.color}}/><button className={category?.id===c.id?'active':''} onClick={()=>navigate(`category:${c.id}`)}>{c.name}</button><button aria-label={`Edit category ${c.name}`} onClick={()=>edit('category',c)}>Edit</button></div>{activeProjects.filter(p=>p.categoryId===c.id).map(p=><button key={p.id} className={`project-link ${project?.id===p.id?'active':''}`} onClick={()=>navigate(`project:${p.id}`)}>{p.name}</button>)}</section>)}
   <details className="archives"><summary role="button">Archived projects</summary>{workspace?.projects.filter(p=>p.archived).map(p=><div className="archived-project" key={p.id}>{p.name}<button disabled={saving} onClick={()=>archiveProject(p,false)}>Restore {p.name}</button></div>)}</details><footer>{session.account.login}<small>Stored on this device</small><div className="backup-actions"><button disabled={saving||!workspace||bridge.preview} onClick={()=>nativeAction('exportBackup')}>Export backup</button><button disabled={saving||!workspace||bridge.preview} onClick={()=>{trigger.current=document.activeElement;setRestorePrompt(true);}}>Import backup</button></div>{!bridge.preview&&<button disabled={saving} className="disconnect" onClick={()=>nativeAction('logout')}>Disconnect account</button>}</footer>
  </aside>
  <main>
   {session.offline&&<p className="offline-banner" role="status">Offline — using your last verified account. Data stays on this device.</p>}
   {bridge.preview&&<p className="preview-banner" role="status">Browser preview — session only. Changes disappear on reload; GitHub sign-in and native actions are unavailable.</p>}
   <header><div><div className="eyebrow">OPERATE / WORKSPACE</div><h1>{project?.name||category?.name||(view==='today'?'Today':'Projects')}</h1><p>{project?.description||(project?'Tasks and project context.':view==='today'?'A deliberate focus for your day.':'Choose a project to focus on its tasks.')}</p></div><div className="header-actions"><button className="primary" disabled={!activeProjects.length||saving} onClick={()=>edit('task')}>New task</button></div></header>
   {project&&<div role="tablist" aria-label="Project features" className="feature-tabs">{[['tasks','Tasks'],['milestones','Milestones'],['details','Project details']].map(([key,label])=><button key={key} role="tab" id={`tab-${key}`} aria-controls={`panel-${key}`} aria-selected={feature===key} tabIndex={feature===key?0:-1} onClick={()=>setFeature(key)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=['tasks','milestones','details'];const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[(tabs.indexOf(key)+(e.key==='ArrowRight'?1:2))%3];setFeature(next);document.getElementById(`tab-${next}`)?.focus();}}}>{label}</button>)}</div>}
   <button disabled={saving||!workspace||bridge.preview||!bridge.cloudStatus} onClick={()=>setCloudOpen(v=>!v)} aria-expanded={cloudOpen}>Cloud persistence</button>
   {cloudOpen&&<CloudPanel disabled={saving} key={session.account.id} bridge={bridge} account={session.account} onBusy={busy=>{lock.current=busy;setSaving(busy);}} onWorkspace={next=>{setWorkspace(next);navigate('all');}}/>}
   {notice&&<p role="status" className="notice">{notice}</p>}
   {error&&!editor&&<p role="alert">{error}</p>}
   {!workspace?(error?<button onClick={()=>connect()}>Retry loading</button>:<p role="status">Loading workspace…</p>):overview?<section aria-label="Project overview" className="project-grid">{visibleProjects.map(p=><button className="project-tile" key={p.id} onClick={()=>navigate(`project:${p.id}`)}><strong>{p.name}</strong>{' '}<span>In progress {workspace.tasks.filter(t=>t.projectId===p.id&&t.status==='doing').length}</span>{' '}<span>To do {workspace.tasks.filter(t=>t.projectId===p.id&&t.status==='backlog').length}</span></button>)}{!visibleProjects.length&&<div className="empty"><h2>No projects yet</h2><p>Create a category and project to give your work a home.</p></div>}</section>:project&&feature==='milestones'?<section role="tabpanel" id="panel-milestones" aria-labelledby="tab-milestones"><div className="toolbar"><h2>Milestones</h2><button disabled={saving} onClick={()=>edit('milestone')}>New milestone</button></div>{!(workspace.milestones||[]).some(m=>m.projectId===project.id)&&<p>No milestones yet. Create a label, then assign it when editing a task.</p>}{(workspace.milestones||[]).filter(m=>m.projectId===project.id).map(m=>{const assigned=workspace.tasks.filter(t=>t.projectId===project.id&&t.milestoneId===m.id);return <section key={m.id} className="milestone-card" style={{borderLeftColor:m.color}}><h3>{m.name}</h3><p>{assigned.filter(t=>t.status==='done').length} / {assigned.length} done</p><button disabled={saving} aria-label={`Edit milestone ${m.name}`} onClick={()=>edit('milestone',m)}>Edit milestone</button>{assigned.map(t=><TaskRow key={t.id} task={t} project={project} saving={saving} onStatus={changeStatus} onEdit={edit}/>)}</section>;})}</section>:project&&feature==='details'?<section role="tabpanel" id="panel-details" aria-labelledby="tab-details" className="project-details"><h2>Project details</h2><p>{project.description||'No description yet.'}</p><dl><dt>Repository</dt><dd>{project.repositoryUrl||'Not configured'}</dd><dt>Local directory</dt><dd>{project.localPath||'Not configured'}</dd></dl><div className="detail-actions"><button disabled={saving} onClick={()=>edit('project',project)}>Edit project</button><button disabled={saving||bridge.preview||!project.repositoryUrl} onClick={()=>nativeAction('openRepository',project.repositoryUrl)}>Open repository</button><button disabled={saving||bridge.preview||!project.localPath} onClick={()=>nativeAction('gitStatus',project.id)}>Check Git status</button></div></section>:<section role={project?'tabpanel':undefined} id={project?'panel-tasks':undefined} aria-labelledby={project?'tab-tasks':undefined}>
   <div className="toolbar"><input type="search" aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)}/><span>{tasks.length} {tasks.length===1?'task':'tasks'}</span><div className="view-switch" aria-label="Task layout"><button aria-pressed={layout==='list'} onClick={()=>setLayout('list')}>List</button><button aria-pressed={layout==='board'} onClick={()=>setLayout('board')}>Board</button></div></div>
   {!workspace?(error?<button onClick={()=>connect()}>Retry loading</button>:<p role="status">Loading tasks…</p>):!tasks.length?<div className="empty"><span className="empty-mark" aria-hidden="true">—</span><h2>{search?'No matching tasks':view==='today'?'Nothing pinned to Today':'No tasks yet'}</h2><p>{search?'Try a different title or a word from your notes.':!activeProjects.length?'Create a category and project to give your work a home.':'Add a task, or pin an existing task to Today.'}</p></div>:<div className={layout==='board'?'board':'task-list'}>{layout==='board'?Object.entries(statuses).map(([status,label])=><section key={status} role="region" aria-label={label} className="board-column"><h2>{label}<span>{tasks.filter(t=>t.status===status).length}</span></h2>{tasks.filter(t=>t.status===status).map(t=><TaskRow key={t.id} task={t} project={workspace.projects.find(p=>p.id===t.projectId)} milestone={(workspace.milestones||[]).find(m=>m.id===t.milestoneId)} saving={saving} onStatus={changeStatus} onEdit={edit}/>)}{!tasks.some(t=>t.status===status)&&<p className="column-empty">No tasks</p>}</section>):tasks.map(t=><TaskRow key={t.id} task={t} project={workspace.projects.find(p=>p.id===t.projectId)} milestone={(workspace.milestones||[]).find(m=>m.id===t.milestoneId)} saving={saving} onStatus={changeStatus} onEdit={edit}/>)}</div>}
   </section>}
   {workspace&&<TerminalDock key={session.account.id} bridge={bridge} project={project} projects={workspace.projects} disabled={saving}/>}
  </main>
  {restorePrompt&&<div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="restore-title" className="editor"><h2 id="restore-title">Restore a backup</h2><p>This replaces this account’s current workspace. A safety backup is created by the desktop app before replacement.</p>{error&&<p role="alert">{error}</p>}<div className="form-actions"><button disabled={saving} onClick={()=>setRestorePrompt(false)}>Cancel</button><button className="primary" disabled={saving} onClick={()=>nativeAction('importBackup')}>Choose backup to restore</button></div></section></div>}
  {editor&&<div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="editor-title" className="editor"><h2 id="editor-title">{editor.item?'Edit':'New'} {editor.type}</h2>{error&&<p role="alert">{error}</p>}<form onSubmit={submit}><fieldset disabled={saving}>
   {editor.type==='category'?<><Field autoFocus label="Category name" name="name" required maxLength={80} defaultValue={editor.item?.name}/><Field label="Color" name="color" type="color" defaultValue={editor.item?.color||'#c99a59'}/></>:editor.type==='project'?<>
    <Field autoFocus label="Project name" name="name" required maxLength={120} defaultValue={editor.item?.name}/><Field label="Category"><select name="categoryId" defaultValue={editor.item?.categoryId||workspace.categories[0]?.id}>{workspace.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field label="Description"><textarea name="description" defaultValue={editor.item?.description||''}/></Field><Field label="Repository URL" name="repositoryUrl" type="url" defaultValue={editor.item?.repositoryUrl||''}/><Field label="Local directory" name="localPath" defaultValue={editor.item?.localPath||''}/><button type="button" disabled={bridge.preview} onClick={()=>nativeAction('chooseDirectory')}>Choose directory</button>
   </>:editor.type==='milestone'?<><Field autoFocus label="Milestone name" name="name" required maxLength={200} defaultValue={editor.item?.name}/><Field label="Color" name="color" type="color" defaultValue={editor.item?.color||'#79bbaa'}/></>:<TaskFields item={editor.item} projects={activeProjects} projectId={project?.id} milestones={workspace.milestones||[]}/>}
   {editor.type==='project'&&editor.item&&<div className="danger-zone"><p>Archiving hides this project and its tasks. Restore it anytime.</p><button type="button" onClick={()=>archiveProject(editor.item,true)}>Archive project</button></div>}
   {editor.type==='task'&&editor.item&&<div className="danger-zone">{confirmDelete?<><p>Delete this task permanently? This cannot be undone.</p><button type="button" className="danger" onClick={deleteTask}>Confirm deletion</button><button type="button" onClick={()=>setConfirmDelete(false)}>Keep task</button></>:<button type="button" className="danger" onClick={()=>setConfirmDelete(true)}>Delete task</button>}</div>}
   <div className="form-actions"><button type="button" onClick={()=>setEditor(null)}>Cancel</button><button className="primary" type="submit">{saving?'Saving…':`Save ${editor.type}`}</button></div>
  </fieldset></form></section></div>}
 </div>;
}
