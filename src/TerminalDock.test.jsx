import React from 'react';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import App from './App.jsx';
const bridge=w=>({session:async()=>({account:{id:1,login:'example'},offline:false}),load:async()=>w,save:async w=>w});
const terminals=vi.hoisted(()=>[]);
vi.mock('@xterm/xterm',()=>({Terminal:class{cols=80;rows=24;writes=[];resets=0;constructor(){terminals.push(this);}open(){}loadAddon(){}onData(f){this.input=f;return {dispose(){}};}write(data){this.writes.push(data);}reset(){this.resets++;}dispose(){}focus(){}}}));
vi.mock('@xterm/addon-fit',()=>({FitAddon:class{fit(){}}}));
const workspace=()=>({version:1,categories:[{id:'c',name:'Examples',color:'#ffffff'}],projects:['a','b'].map(id=>({id,categoryId:'c',name:`Example ${id}`,description:'',repositoryUrl:'',localPath:'/example',archived:false})),tasks:[],updatedAt:new Date().toISOString()});
it('streams incremental output without resetting an active shell and routes keyboard input to its token',async()=>{
 const api=bridge(workspace());api.ptyStart=vi.fn(async()=>({id:'live',output:'prompt',revision:1,running:true}));api.ptyRead=vi.fn(async()=>({id:'live',output:'promptnext',revision:2,running:true}));api.ptyResize=vi.fn(async()=>{});api.ptyInput=vi.fn(async()=>{});
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));await u.click(screen.getByRole('button',{name:'Start native shell'}));const terminal=terminals.at(-1);
 await waitFor(()=>expect(terminal.writes).toEqual(['prompt','next']),{timeout:1500});expect(terminal.resets).toBe(1);terminal.input('hi\r');expect(api.ptyInput).toHaveBeenCalledWith('a','live','hi\r');expect(api.ptyResize).toHaveBeenCalledWith('a','live',80,24);
});
it('stops claiming a running shell after a read failure and allows explicit recovery',async()=>{
 const api=bridge(workspace());api.ptyStart=vi.fn(async()=>({id:'lost',output:'prompt',revision:1,running:true}));api.ptyRead=vi.fn(async()=>{throw new Error('Terminal session is no longer available.');});api.ptyResize=vi.fn(async()=>{});api.ptyInput=vi.fn(async()=>{});api.ptyClose=vi.fn(async()=>{throw new Error('Terminal session is no longer available.');});
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));await u.click(screen.getByRole('button',{name:'Start native shell'}));const terminal=terminals.at(-1);
 await screen.findByText(/Shell connection unavailable · close to retry/);expect(screen.queryByText(/Running · retained/)).not.toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('Terminal session is no longer available.');
 const reads=api.ptyRead.mock.calls.length;await new Promise(r=>setTimeout(r,600));expect(api.ptyRead).toHaveBeenCalledTimes(reads);terminal.input('must not send\r');expect(api.ptyInput).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Close shell'}));expect(await screen.findByRole('button',{name:'Start native shell'})).toBeEnabled();expect(api.ptyStart).toHaveBeenCalledTimes(1);
});
it('browser preview never offers execution and renders a bottom dock, not a fake shell',async()=>{
 const u=userEvent.setup();const api=bridge(workspace());api.preview=true;render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));
 expect(screen.getByText('Native terminal unavailable in browser preview. No shell is running here.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Start native shell'})).toBeDisabled();
 const css=(await import('node:fs')).readFileSync('src/styles.css','utf8');expect(css).toContain('.terminal-dock');expect(css).toContain('position:sticky');
});
it('retains a start that resolves while viewing another project without showing stale errors there',async()=>{
 let finish;const api=bridge(workspace());api.ptyStart=vi.fn(()=>new Promise(r=>finish=r));api.ptyRead=vi.fn(async(p,id)=>({id,output:'',revision:0,running:true}));api.ptyResize=vi.fn(async()=>{});
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));await u.click(screen.getByRole('button',{name:'Start native shell'}));await u.click(screen.getByRole('button',{name:'Example b',exact:true}));
 finish({id:'late-a',output:'',revision:0,running:true});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));expect(await screen.findByRole('button',{name:'Close shell'})).toBeInTheDocument();expect(api.ptyStart).toHaveBeenCalledTimes(1);
});
it('starts only explicitly with shell warning and retains project sessions across feature/project navigation',async()=>{
 const api=bridge(workspace());api.ptyStart=vi.fn(async p=>({id:`session-${p}`,output:'',revision:0,running:true}));api.ptyRead=vi.fn(async(p,id)=>({id,output:'',revision:0,running:true}));api.ptyResize=vi.fn(async()=>{});api.ptyClose=vi.fn(async()=>{});api.ptyInput=vi.fn(async()=>{});
 const u=userEvent.setup();render(<App bridge={api}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Example a',exact:true}));
 expect(screen.getByRole('region',{name:'Project terminal'})).toBeInTheDocument();expect(screen.getByText(/full access to your files/i)).toBeInTheDocument();expect(api.ptyStart).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Start native shell'}));await screen.findByRole('button',{name:'Close shell'});expect(api.ptyStart).toHaveBeenCalledWith('a');
 await u.click(screen.getByRole('tab',{name:'Milestones'}));expect(screen.getByRole('button',{name:'Close shell'})).toBeInTheDocument();
 await u.click(screen.getByRole('button',{name:'Example b',exact:true}));expect(screen.getByRole('button',{name:'Start native shell'})).toBeInTheDocument();expect(api.ptyClose).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Example a',exact:true}));await screen.findByRole('button',{name:'Close shell'});expect(api.ptyStart).toHaveBeenCalledTimes(1);
 await u.click(screen.getByRole('button',{name:'Close shell'}));await waitFor(()=>expect(api.ptyClose).toHaveBeenCalledWith('a','session-a'));expect(screen.getByRole('button',{name:'Start native shell'})).toBeInTheDocument();
});
