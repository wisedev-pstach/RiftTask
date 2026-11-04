import React from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi,afterEach} from 'vitest';
import App from './App.jsx';
const workspace={version:1,categories:[{id:'c',name:'Work',color:'#c8ff63'}],projects:[{id:'p',categoryId:'c',name:'RiftTask',localPath:'/example',archived:false}],tasks:[]};
const api=()=>({session:async()=>({account:{id:1,login:'example'}}),load:async()=>workspace,cloudStatus:vi.fn().mockResolvedValue({state:'off'}),cloudSync:vi.fn()});
afterEach(()=>localStorage.clear());
it('blocks cloud actions without releasing the initial-load lock until the workspace is ready',async()=>{
 const bridge=api(),u=userEvent.setup();let finishLoad;
 bridge.load=vi.fn(()=>new Promise(resolve=>finishLoad=resolve));
 bridge.cloudVerify=vi.fn().mockResolvedValue({id:2,full_name:'example/dummy',owner:{id:1}});
 bridge.logout=vi.fn().mockResolvedValue({});
 render(<App bridge={bridge}/>);await screen.findByRole('heading',{name:'Projects'});
 await u.click(screen.getByRole('button',{name:'Settings',exact:true}));
 await u.click(screen.getByRole('tab',{name:'Cloud'}));
 await screen.findByText('Cloud off — local-only storage.');
 const repository=screen.getByRole('textbox',{name:'Dedicated private repository'});
 await u.type(repository,'example/dummy');
 await u.click(screen.getByRole('button',{name:'Verify repository'}));
 expect(bridge.cloudVerify).not.toHaveBeenCalled();
 expect(repository).toBeDisabled();
 expect(screen.getByRole('button',{name:'Verify repository'})).toBeDisabled();
 await u.click(screen.getByRole('tab',{name:'Account & backups'}));
 expect(screen.getByRole('button',{name:'Import backup'})).toBeDisabled();
 await u.click(screen.getByRole('button',{name:'Disconnect account'}));
 expect(bridge.logout).not.toHaveBeenCalled();
 await act(async()=>finishLoad(workspace));
 await u.click(screen.getByRole('tab',{name:'Cloud'}));
 expect(repository).toBeEnabled();
 await u.type(repository,'example/dummy');
 await u.click(screen.getByRole('button',{name:'Verify repository'}));
 await screen.findByText('Verified: example/dummy — repository ID 2, owner ID 1');
 expect(bridge.cloudVerify).toHaveBeenCalledOnce();
 await u.click(screen.getByRole('tab',{name:'Account & backups'}));
 await u.click(screen.getByRole('button',{name:'Disconnect account'}));
 await screen.findByRole('button',{name:'Sign in with GitHub'});
 expect(bridge.logout).toHaveBeenCalledOnce();
});
it('keeps backup recovery available after initial workspace loading fails',async()=>{
 const bridge=api(),u=userEvent.setup();let failLoad;
 bridge.load=vi.fn(()=>new Promise((resolve,reject)=>failLoad=reject));
 bridge.importBackup=vi.fn().mockResolvedValue(workspace);
 render(<App bridge={bridge}/>);await screen.findByRole('heading',{name:'Projects'});
 await u.click(screen.getByRole('button',{name:'Settings',exact:true}));
 await u.click(screen.getByRole('tab',{name:'Cloud'}));
 await screen.findByText('Cloud off — local-only storage.');
 await act(async()=>failLoad(new Error('Dummy workspace load failed')));
 expect(screen.getByRole('textbox',{name:'Dedicated private repository'})).toBeDisabled();
 await u.click(screen.getByRole('tab',{name:'Account & backups'}));
 expect(screen.getByRole('button',{name:'Export backup'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Import backup'})).toBeEnabled();
 await u.click(screen.getByRole('button',{name:'Import backup'}));
 await u.click(screen.getByRole('button',{name:'Choose backup to restore'}));
 await screen.findByText('Backup restored.');
 expect(bridge.importBackup).toHaveBeenCalledOnce();
 await u.click(screen.getByRole('button',{name:'Settings',exact:true}));
 await u.click(screen.getByRole('tab',{name:'Cloud'}));
 expect(screen.getByRole('textbox',{name:'Dedicated private repository'})).toBeEnabled();
 expect(bridge.cloudStatus).toHaveBeenCalledOnce();
});
it('uses roving Settings tabs with arrow wrapping, Home/End and labelled panels',async()=>{
 const bridge=api(),u=userEvent.setup();render(<App bridge={bridge}/>);
 await screen.findByRole('heading',{name:'Projects'});
 await u.click(screen.getByRole('button',{name:'Settings',exact:true}));
 const tabs=['Appearance','Cloud','Account & backups'].map(name=>screen.getByRole('tab',{name}));
 function selected(index){
  tabs.forEach((tab,i)=>{expect(tab).toHaveAttribute('tabindex',i===index?'0':'-1');expect(tab).toHaveAttribute('aria-selected',String(i===index));});
  const panel=screen.getByRole('tabpanel',{name:tabs[index].textContent});
  expect(panel).toHaveAttribute('id',tabs[index].getAttribute('aria-controls'));
  expect(panel).toHaveAttribute('aria-labelledby',tabs[index].id);
  expect(tabs[index].id).not.toBe('');
 }
 selected(0);tabs[0].focus();
 for(const [key,index] of [['{ArrowRight}',1],['{ArrowRight}',2],['{ArrowRight}',0],['{ArrowLeft}',2],['{Home}',0],['{End}',2]]){
  await u.keyboard(key);selected(index);expect(tabs[index]).toHaveFocus();
 }
 await u.keyboard('{Home}{ArrowRight}');
 expect(await screen.findAllByRole('heading',{name:'Manual cloud'})).toHaveLength(1);
 expect(bridge.cloudStatus).toHaveBeenCalledOnce();expect(bridge.cloudSync).not.toHaveBeenCalled();
 await u.click(tabs[0]);selected(0);
});
it('resolves signed-in and signed-out branding beside the packaged file document',async()=>{
 const base='file:///example/RiftTask/resources/app.asar/dist/index.html';
 const first=render(<App bridge={api()}/>);await screen.findByRole('heading',{name:'Projects'});
 expect(new URL(first.container.querySelector('.brand img').getAttribute('src'),base).href).toBe(new URL('./icon.svg',base).href);
 first.unmount();const signedOut=render(<App bridge={{session:async()=>({account:null,ghAvailable:true})}}/>);await screen.findByRole('button',{name:'Sign in with GitHub'});
 expect(new URL(signedOut.container.querySelector('.brand img').getAttribute('src'),base).href).toBe(new URL('./icon.svg',base).href);
});
it('keeps one dedicated Settings screen and returns to the selected project without cloud side effects',async()=>{
 const bridge=api(),u=userEvent.setup();render(<App bridge={bridge}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'RiftTask',exact:true}));
 expect(screen.queryByRole('button',{name:'Cloud persistence'})).not.toBeInTheDocument();expect(bridge.cloudStatus).not.toHaveBeenCalled();
 for(let i=0;i<3;i++){await u.click(screen.getByRole('button',{name:'Settings',exact:true}));await u.click(screen.getByRole('tab',{name:'Cloud'}));expect(await screen.findAllByRole('heading',{name:'Manual cloud'})).toHaveLength(1);await u.click(screen.getByRole('button',{name:'Back to workspace'}));expect(screen.getByRole('heading',{name:'RiftTask'})).toBeInTheDocument();}
 expect(bridge.cloudStatus).toHaveBeenCalledOnce();expect(bridge.cloudSync).not.toHaveBeenCalled();
});
it.each(['light','dark'])('persists %s appearance across reload independently of workspace',async mode=>{
 const u=userEvent.setup(),first=render(<App bridge={api()}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'Settings',exact:true}));await u.click(screen.getByRole('button',{name:mode==='light'?'Light':'Dark',exact:true}));expect(document.documentElement.dataset.theme).toBe(mode);first.unmount();render(<App bridge={api()}/>);await screen.findByRole('heading',{name:'Projects'});expect(document.documentElement.dataset.theme).toBe(mode);expect(localStorage.getItem('rifttask.appearance')).toBe(mode);
});

it('retains pending cloud work while hidden and unlocks the workspace after completion',async()=>{
 const bridge=api();let finish;bridge.cloudStatus.mockResolvedValue({state:'ready'});bridge.cloudSync.mockImplementation(()=>new Promise(r=>finish=r));const u=userEvent.setup();render(<App bridge={bridge}/>);await screen.findByRole('heading',{name:'Projects'});await u.click(screen.getByRole('button',{name:'RiftTask',exact:true}));await u.click(screen.getByRole('button',{name:'Settings',exact:true}));await u.click(screen.getByRole('tab',{name:'Cloud'}));await u.click(await screen.findByRole('button',{name:'Sync now'}));await u.click(screen.getByRole('button',{name:'Back to workspace'}));expect(screen.getByRole('button',{name:'New task'})).toBeDisabled();await u.click(screen.getByRole('button',{name:'Settings',exact:true}));expect(screen.getAllByRole('heading',{name:'Manual cloud'})).toHaveLength(1);expect(screen.getByRole('button',{name:'Working…'})).toBeDisabled();finish({state:'verified'});await screen.findByRole('button',{name:'Sync now'});await u.click(screen.getByRole('button',{name:'Back to workspace'}));expect(screen.getByRole('button',{name:'New task'})).toBeEnabled();expect(screen.getByRole('heading',{name:'RiftTask'})).toBeInTheDocument();expect(bridge.cloudSync).toHaveBeenCalledOnce();expect(bridge.cloudStatus).toHaveBeenCalledOnce();
});
