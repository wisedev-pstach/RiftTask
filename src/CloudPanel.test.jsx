import React from 'react';
import {render,screen,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import CloudPanel from './CloudPanel.jsx';
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
 expect(screen.getByText(/plaintext/)).toBeInTheDocument();expect(screen.getByText(/history retains/)).toBeInTheDocument();expect(screen.getByText(/Local directory paths are never uploaded/)).toBeInTheDocument();
 await u.type(screen.getByLabelText('Dedicated private repository'),'solo/task-data');await u.click(screen.getByRole('button',{name:'Verify repository'}));
 expect(await screen.findByText(/solo\/task-data.*77/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Enable manual cloud'})).toBeDisabled();
 await u.click(screen.getByLabelText(/I understand/));await u.click(screen.getByRole('button',{name:'Enable manual cloud'}));
 expect(bridge.cloudEnable).toHaveBeenCalledWith({repositoryId:77,consent:true});expect(bridge.cloudSync).not.toHaveBeenCalled();
 await u.click(screen.getByRole('button',{name:'Sync now'}));expect(await screen.findByText(/Conflict —/)).toBeInTheDocument();
 bridge.cloudSync.mockRejectedValueOnce(new Error('Cloud unavailable'));await u.click(screen.getByRole('button',{name:'Sync now'}));expect(await screen.findByRole('alert')).toHaveTextContent('Cloud unavailable');
 await u.click(screen.getByRole('button',{name:'Disable cloud'}));await waitFor(()=>expect(screen.getByText(/Cloud off/)).toBeInTheDocument());
});
