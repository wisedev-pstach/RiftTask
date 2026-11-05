import React from 'react';
import {render,screen,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import CloudPanel from './CloudPanel.jsx';
it('creation has separate confirmation, cancellation, busy lock and does not enable cloud',async()=>{
 let finish;const repo={id:77,full_name:'solo/task-data',owner:{id:17}};
 const bridge={cloudStatus:vi.fn().mockResolvedValue({state:'off'}),cloudCreate:vi.fn(()=>new Promise(r=>finish=r)),cloudEnable:vi.fn(),cloudSync:vi.fn(),cloudVerify:vi.fn().mockResolvedValue(repo)};
 const u=userEvent.setup();render(<CloudPanel bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);
 await screen.findByText(/Cloud off/);await u.click(screen.getByRole('button',{name:'Create private repository'}));await u.type(screen.getByLabelText('New repository name'),'task-data');
 expect(screen.getByRole('button',{name:'Continue to confirmation'})).toBeDisabled();await u.click(screen.getByLabelText(/Create only this private repository/));await u.click(screen.getByRole('button',{name:'Continue to confirmation'}));
 expect(bridge.cloudCreate).toHaveBeenCalledExactlyOnceWith({name:'task-data',consent:true});expect(screen.getByRole('button',{name:'Continue to confirmation'})).toBeDisabled();await act(async()=>finish({state:'off',cancelled:true}));expect(bridge.cloudEnable).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Continue to confirmation'}));await act(async()=>finish({state:'off',created:repo}));expect(await screen.findByText(/Created: solo\/task-data/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Verify repository'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Enable manual cloud'})).not.toBeInTheDocument();expect(bridge.cloudSync).not.toHaveBeenCalled();
});
it('creation stays locked until initial configuration is loaded',async()=>{
 let finish;const bridge={cloudStatus:vi.fn(()=>new Promise(r=>finish=r)),cloudCreate:vi.fn()};render(<CloudPanel bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);expect(screen.getByRole('button',{name:'Create private repository'})).toBeDisabled();await act(async()=>finish({state:'off'}));expect(screen.getByRole('button',{name:'Create private repository'})).toBeEnabled();expect(bridge.cloudCreate).not.toHaveBeenCalled();
});
it('a late initial status cannot replace a newly enabled configuration',async()=>{
 let resolveStatus;const repo={id:77,full_name:'solo/task-data',owner:{id:17}};
 const bridge={cloudStatus:vi.fn(()=>new Promise(resolve=>{resolveStatus=resolve;})),cloudVerify:vi.fn().mockResolvedValue(repo),cloudEnable:vi.fn().mockResolvedValue({state:'ready',repository:repo})};
 const u=userEvent.setup();render(<CloudPanel bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);
 await u.type(screen.getByLabelText('Dedicated private repository'),'solo/task-data');await u.click(screen.getByRole('button',{name:'Verify repository'}));await u.click(await screen.findByLabelText(/I understand/));await u.click(screen.getByRole('button',{name:'Enable manual cloud'}));
 expect(await screen.findByRole('button',{name:'Sync now'})).toBeInTheDocument();await act(async()=>resolveStatus({state:'off'}));expect(screen.getByRole('button',{name:'Sync now'})).toBeInTheDocument();
});
it('invalid local cloud configuration has a visible local-only reset recovery action',async()=>{
 const bridge={cloudStatus:vi.fn().mockRejectedValue(new Error('Invalid configuration')),cloudDisable:vi.fn().mockResolvedValue({state:'off'})};
 const u=userEvent.setup();render(<CloudPanel bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);
 await screen.findByRole('alert');await u.click(screen.getByRole('button',{name:'Reset local cloud settings'}));expect(bridge.cloudDisable).toHaveBeenCalledOnce();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('blocks cloud actions while the parent is saving local data',async()=>{const bridge={cloudStatus:vi.fn().mockResolvedValue({state:'ready'}),cloudSync:vi.fn()};render(<CloudPanel disabled bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);await screen.findByText(/Manual cloud enabled/);expect(screen.getByRole('button',{name:'Sync now'})).toBeDisabled();});
it('requires verified repository and plaintext/history consent before enabling; sync remains manual and errors/conflicts visible',async()=>{
 const repo={id:77,full_name:'solo/task-data',owner:{id:17}};
 const bridge={cloudStatus:vi.fn().mockResolvedValue({state:'off'}),cloudVerify:vi.fn().mockResolvedValue(repo),cloudEnable:vi.fn().mockResolvedValue({state:'ready',repository:repo}),cloudSync:vi.fn().mockResolvedValue({state:'conflict',repository:repo}),cloudDisable:vi.fn().mockResolvedValue({state:'off'})};
 const u=userEvent.setup();render(<CloudPanel bridge={bridge} account={{id:17,login:'solo'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);
 await screen.findByText(/Cloud off/);expect(bridge.cloudSync).not.toHaveBeenCalled();
 expect(screen.getByText(/milestone labels and task assignments/)).toBeInTheDocument();
 expect(screen.getByText(/plaintext/)).toBeInTheDocument();expect(screen.getByText(/history retains/)).toBeInTheDocument();expect(screen.getByText(/Local directory paths are never uploaded/)).toBeInTheDocument();
 await u.type(screen.getByLabelText('Dedicated private repository'),'solo/task-data');await u.click(screen.getByRole('button',{name:'Verify repository'}));
 expect(await screen.findByText(/solo\/task-data.*77/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Enable manual cloud'})).toBeDisabled();
 await u.click(screen.getByLabelText(/I understand/));await u.click(screen.getByRole('button',{name:'Enable manual cloud'}));
 expect(bridge.cloudEnable).toHaveBeenCalledWith({repositoryId:77,consent:true});expect(bridge.cloudSync).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Sync now'}));expect(await screen.findByText(/Conflict —/)).toBeInTheDocument();
 bridge.cloudSync.mockRejectedValueOnce(new Error('Cloud unavailable'));await u.click(screen.getByRole('button',{name:'Sync now'}));expect(await screen.findByRole('alert')).toHaveTextContent('Cloud unavailable');
 await u.click(screen.getByRole('button',{name:'Disable cloud'}));await waitFor(()=>expect(screen.getByText(/Cloud off/)).toBeInTheDocument());
});

it('shows configuration loading without claiming cloud is off or starting a sync',async()=>{
 let finish;const bridge={cloudStatus:vi.fn(()=>new Promise(r=>finish=r)),cloudSync:vi.fn()};render(<CloudPanel bridge={bridge} account={{id:1,login:'example'}} onWorkspace={()=>{}} onBusy={()=>{}}/>);expect(screen.getByRole('status')).toHaveTextContent('Loading cloud settings');expect(screen.queryByText(/Cloud off/)).not.toBeInTheDocument();expect(bridge.cloudSync).not.toHaveBeenCalled();await act(async()=>finish({state:'off'}));expect(await screen.findByText(/Cloud off/)).toBeInTheDocument();
});
it('requires exact selected remote revision confirmation before replacing local workspace',async()=>{
 const workspace={version:1,projects:[],categories:[],tasks:[]},onWorkspace=vi.fn();const bridge={cloudStatus:vi.fn().mockResolvedValue({state:'ready'}),cloudSync:vi.fn().mockResolvedValueOnce({state:'download-required',pullSha:'remote-exact-sha'}).mockResolvedValueOnce({state:'verified',workspace})};const u=userEvent.setup();render(<CloudPanel bridge={bridge} account={{id:1,login:'example'}} onWorkspace={onWorkspace} onBusy={()=>{}}/>);await u.click(await screen.findByRole('button',{name:'Sync now'}));expect(bridge.cloudSync).toHaveBeenCalledExactlyOnceWith({});expect(onWorkspace).not.toHaveBeenCalled();expect(screen.getByText(/rolling local safety backup/)).toBeInTheDocument();await u.click(screen.getByRole('button',{name:'Back up locally and download'}));expect(bridge.cloudSync).toHaveBeenLastCalledWith({pullSha:'remote-exact-sha'});expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(workspace);
});

it('ignores a late cloud download after the account panel unmounts',async()=>{
 let finish;const update=vi.fn(),bridge={cloudStatus:vi.fn().mockResolvedValue({state:'ready'}),cloudSync:vi.fn(()=>new Promise(r=>finish=r))};const u=userEvent.setup(),panel=render(<CloudPanel bridge={bridge} account={{id:1,login:'first'}} onWorkspace={update} onBusy={()=>{}}/>);await u.click(await screen.findByRole('button',{name:'Sync now'}));panel.unmount();render(<CloudPanel bridge={{cloudStatus:async()=>({state:'off'})}} account={{id:2,login:'second'}} onWorkspace={update} onBusy={()=>{}}/>);await act(async()=>finish({state:'verified',workspace:{tasks:['old account']}}));expect(update).not.toHaveBeenCalled();expect(screen.getByText(/Cloud off/)).toBeInTheDocument();
});
