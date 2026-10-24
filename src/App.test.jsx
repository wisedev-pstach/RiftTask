import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
const account = { id: 1, login: 'developer', name: 'Developer' };
export function bridge(workspace = {version:1,categories:[],projects:[],tasks:[],updatedAt:new Date().toISOString()}) {
 return {session:vi.fn().mockResolvedValue({account,offline:false,ghAvailable:true}),login:vi.fn().mockResolvedValue({account,offline:false,ghAvailable:true}),load:vi.fn().mockResolvedValue(workspace),save:vi.fn(async w=>structuredClone(w)),logout:vi.fn().mockResolvedValue(),chooseDirectory:vi.fn().mockResolvedValue('/work/game'),openRepository:vi.fn().mockResolvedValue(),openTerminal:vi.fn().mockResolvedValue(),exportBackup:vi.fn().mockResolvedValue(true),importBackup:vi.fn().mockResolvedValue(null)};
}
const populated = () => ({version:1,categories:[{id:'cat',name:'Games',color:'#c99a59'}],projects:[{id:'project',categoryId:'cat',name:'lose.DOT',description:'',repositoryUrl:'https://github.com/test/game',localPath:'/work/game',archived:false}],tasks:[],updatedAt:new Date().toISOString()});
describe('workspace',()=>{
 it('keeps persisted status when a status update fails',async()=>{
 const w=populated();w.tasks.push({id:'task',projectId:'project',title:'Ship build',notes:'',status:'doing',priority:'normal',dueDate:'',today:false,createdAt:new Date().toISOString(),completedAt:null});
 const api=bridge(w);api.save.mockRejectedValueOnce(new Error('Write denied'));
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'All tasks'});
 await u.selectOptions(screen.getByLabelText('Status for Ship build'),'done');
 expect(await screen.findByRole('alert')).toHaveTextContent('Write denied');expect(screen.getByLabelText('Status for Ship build')).toHaveValue('doing');
 });
 it('explains missing GitHub CLI and offers check sign-in after verification fails',async()=>{
 const api=bridge();api.session.mockResolvedValue({account:null,offline:false,ghAvailable:false});api.login.mockRejectedValueOnce(new Error('Finish sign-in in your terminal'));
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Your work, on this device.'});
 expect(screen.getByText('GitHub CLI is required. Install gh, then check sign-in.')).toBeInTheDocument();
 await u.click(screen.getByRole('button',{name:'Check sign-in'}));expect(await screen.findByRole('alert')).toHaveTextContent('Finish sign-in in your terminal');
 await u.click(screen.getByRole('button',{name:'Check sign-in'}));expect(await screen.findByRole('heading',{name:'All tasks'})).toBeInTheDocument();
 });
 it('keeps keyboard focus inside an editor and returns it to its trigger on Escape',async()=>{
 const u=userEvent.setup();render(<App bridge={bridge(populated())}/>);await screen.findByRole('heading',{name:'All tasks'});
 const trigger=screen.getByRole('button',{name:'New task'});await u.click(trigger);
 expect(screen.getByLabelText('Task title')).toHaveFocus();
 await u.tab({shift:true});expect(screen.getByRole('button',{name:'Save task'})).toHaveFocus();
 await u.keyboard('{Escape}');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(trigger).toHaveFocus();
 });
 it('discloses offline identity and clears workspace when disconnecting locally',async()=>{
 const api=bridge();api.session.mockResolvedValue({account,offline:true,ghAvailable:true});
 const u=userEvent.setup();render(<App bridge={api}/>);
 expect(await screen.findByText('Offline — using your last verified account. Data stays on this device.')).toBeInTheDocument();
 await u.click(screen.getByRole('button',{name:'Disconnect account'}));
 expect(await screen.findByRole('heading',{name:'Your work, on this device.'})).toBeInTheDocument();expect(api.logout).toHaveBeenCalledOnce();
 });
 it('recovers from load failure without replacing data with an empty workspace',async()=>{
 const api=bridge();api.load.mockRejectedValueOnce(new Error('Workspace unreadable'));
 const u=userEvent.setup();render(<App bridge={api}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Workspace unreadable');
 expect(screen.getByRole('button',{name:'New category'})).toBeDisabled();
 await u.click(screen.getByRole('button',{name:'Retry loading'}));
 expect(await screen.findByText('No tasks yet')).toBeInTheDocument();expect(api.save).not.toHaveBeenCalled();
 });
 it('provides an explicitly session-only browser preview without pretending GitHub authentication',async()=>{
 render(<App/>);
 expect(await screen.findByText('Browser preview — session only. Changes disappear on reload; GitHub sign-in and native actions are unavailable.')).toBeInTheDocument();
 expect(await screen.findByRole('heading',{name:'All tasks'})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Sign in with GitHub'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Export backup'})).toBeDisabled();
 });
 it('uses native project actions and backup dialogs with explicit restore consent',async()=>{
 const api=bridge(populated());const restored=populated();restored.projects[0].name='Restored game';api.importBackup.mockResolvedValue(restored);
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'lose.DOT'}));
 await u.click(screen.getByRole('button',{name:'Open repository'}));expect(api.openRepository).toHaveBeenCalledWith('https://github.com/test/game');
 await u.click(screen.getByRole('button',{name:'Open terminal'}));expect(api.openTerminal).toHaveBeenCalledWith('project');
 await u.click(screen.getByRole('button',{name:'Edit project'}));await u.click(screen.getByRole('button',{name:'Choose directory'}));
 await waitFor(()=>expect(screen.getByLabelText('Local directory')).toHaveValue('/work/game'));await u.click(screen.getByRole('button',{name:'Cancel'}));
 await u.click(screen.getByRole('button',{name:'Export backup'}));await screen.findByText('Backup exported.');expect(api.exportBackup).toHaveBeenCalledOnce();
 await u.click(screen.getByRole('button',{name:'Import backup'}));expect(api.importBackup).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Choose backup to restore'}));
 expect(await screen.findByRole('button',{name:'Restored game'})).toBeInTheDocument();
 });
 it('archives a project without deleting its tasks and can restore it',async()=>{
 const api=bridge(populated());const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'lose.DOT'}));await u.click(screen.getByRole('button',{name:'Edit project'}));
 await u.click(screen.getByRole('button',{name:'Archive project'}));
 await screen.findByRole('heading',{name:'All tasks'});expect(api.save.mock.lastCall[0].projects[0].archived).toBe(true);
 await u.click(screen.getByRole('button',{name:'Archived projects'}));
 await u.click(screen.getByRole('button',{name:'Restore lose.DOT'}));
 expect(await screen.findByRole('button',{name:'lose.DOT'})).toBeInTheDocument();
 });
 it('groups tasks into a board and preserves task editing across layouts',async()=>{
 const w=populated();w.tasks.push({id:'task',projectId:'project',title:'Ship build',notes:'',status:'doing',priority:'normal',dueDate:'',today:false,createdAt:new Date().toISOString(),completedAt:null});
 const u=userEvent.setup();render(<App bridge={bridge(w)}/>);await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'Board'}));
 expect(within(screen.getByRole('region',{name:'In progress'})).getByRole('button',{name:'Edit task Ship build'})).toBeInTheDocument();
 await u.click(screen.getByRole('button',{name:'List'}));expect(screen.queryByRole('region',{name:'In progress'})).not.toBeInTheDocument();
 });
 it('keeps failed edits recoverable and prevents concurrent saves',async()=>{
 const api=bridge(populated());const u=userEvent.setup();let rejectSave;
 api.save.mockImplementationOnce(()=>new Promise((resolve,reject)=>{rejectSave=reject;}));
 render(<App bridge={api}/>);await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'New task'}));await u.type(screen.getByLabelText('Task title'),'Keep my work');
 await u.click(screen.getByRole('button',{name:'Save task'}));
 expect(screen.getByRole('button',{name:'Saving…'})).toBeDisabled();expect(screen.getByLabelText('Task title')).toBeDisabled();
 rejectSave(new Error('Disk is full'));
 expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Disk is full');
 expect(screen.getByLabelText('Task title')).toHaveValue('Keep my work');
 expect(api.save).toHaveBeenCalledTimes(1);
 await u.click(screen.getByRole('button',{name:'Save task'}));
 expect(await screen.findByRole('button',{name:'Edit task Keep my work'})).toBeInTheDocument();
 });
 it('creates a complete task, edits it, changes status, searches, and deletes it',async()=>{
 const api=bridge(populated());const u=userEvent.setup();render(<App bridge={api}/>);
 await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'New task'}));
 await u.type(screen.getByLabelText('Task title'),'Fix movement');
 await u.type(screen.getByLabelText('Notes'),'Check diagonal speed');
 await u.selectOptions(screen.getByLabelText('Priority'),'high');
 await u.type(screen.getByLabelText('Due date'),'2026-11-01');
 await u.click(screen.getByLabelText('Pin to Today'));
 await u.click(screen.getByRole('button',{name:'Save task'}));
 await screen.findByRole('button',{name:'Edit task Fix movement'});
 expect(api.save.mock.lastCall[0].tasks[0]).toMatchObject({title:'Fix movement',notes:'Check diagonal speed',priority:'high',dueDate:'2026-11-01',today:true,projectId:'project',status:'backlog'});
 await u.click(screen.getByRole('button',{name:'Today'}));
 expect(screen.getByRole('button',{name:'Edit task Fix movement'})).toBeInTheDocument();
 await u.selectOptions(screen.getByLabelText('Status for Fix movement'),'done');
 await waitFor(()=>expect(api.save.mock.lastCall[0].tasks[0].completedAt).toBeTruthy());
 await u.click(screen.getByRole('button',{name:'Edit task Fix movement'}));
 await u.clear(screen.getByLabelText('Task title'));await u.type(screen.getByLabelText('Task title'),'Fix controller');
 await u.click(screen.getByRole('button',{name:'Save task'}));
 await screen.findByRole('button',{name:'Edit task Fix controller'});
 await u.type(screen.getByRole('searchbox',{name:'Search tasks'}),'missing');
 expect(screen.getByText('No matching tasks')).toBeInTheDocument();
 await u.clear(screen.getByRole('searchbox',{name:'Search tasks'}));
 await u.click(screen.getByRole('button',{name:'Edit task Fix controller'}));
 await u.click(screen.getByRole('button',{name:'Delete task'}));
 await u.click(screen.getByRole('button',{name:'Confirm deletion'}));
 await waitFor(()=>expect(api.save.mock.lastCall[0].tasks).toHaveLength(0));
 });
 it('creates and edits a category and project using persisted bridge saves',async()=>{
 const api=bridge();const u=userEvent.setup();render(<App bridge={api}/>);
 await screen.findByRole('heading',{name:'All tasks'});
 await u.click(screen.getByRole('button',{name:'New category'}));
 await u.type(screen.getByLabelText('Category name'),'Games');
 await u.click(screen.getByRole('button',{name:'Save category'}));
 await screen.findByRole('button',{name:'Edit category Games'});
 await u.click(screen.getByRole('button',{name:'New project'}));
 await u.type(screen.getByLabelText('Project name'),'lose.DOT');
 await u.click(screen.getByRole('button',{name:'Save project'}));
 await screen.findByRole('heading',{name:'lose.DOT'});
 await u.click(screen.getByRole('button',{name:'Edit project'}));
 await u.clear(screen.getByLabelText('Project name'));await u.type(screen.getByLabelText('Project name'),'lose.DOT v2');
 await u.click(screen.getByRole('button',{name:'Save project'}));
 await screen.findByRole('heading',{name:'lose.DOT v2'});
 await u.click(screen.getByRole('button',{name:'Edit category Games'}));
 await u.clear(screen.getByLabelText('Category name'));await u.type(screen.getByLabelText('Category name'),'Development');
 await u.click(screen.getByRole('button',{name:'Save category'}));
 expect(await screen.findByRole('button',{name:'Edit category Development'})).toBeInTheDocument();
 expect(api.save.mock.lastCall[0].projects[0].categoryId).toBe(api.save.mock.lastCall[0].categories[0].id);
 });
 it('requires sign-in before loading and opens the empty local workspace after verification',async()=>{
 const api=bridge();api.session.mockResolvedValue({account:null,offline:false,ghAvailable:true});
 render(<App bridge={api}/>);
 expect(await screen.findByRole('heading',{name:'Your work, on this device.'})).toBeInTheDocument();
 expect(api.load).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Sign in with GitHub'}));
 expect(await screen.findByRole('heading',{name:'All tasks'})).toBeInTheDocument();
 expect(screen.getByText('No tasks yet')).toBeInTheDocument();
 });
});
