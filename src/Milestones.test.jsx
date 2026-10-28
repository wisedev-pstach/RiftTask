import React from 'react';
import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import App from './App.jsx';
function fixture(){return {version:1,categories:[{id:'c',name:'Games',color:'#abcdef'}],projects:[{id:'p',categoryId:'c',name:'Demo',description:'',repositoryUrl:'',localPath:'',archived:false},{id:'other',categoryId:'c',name:'Other',description:'',repositoryUrl:'',localPath:'',archived:false}],tasks:[],updatedAt:new Date().toISOString()};}
function api(w){return {session:async()=>({account:{id:1,login:'example'},offline:false,ghAvailable:true}),load:async()=>w,save:vi.fn(async next=>structuredClone(next))};}
it('switching a task project clears its previous milestone and lists only the new project labels',async()=>{
 const w=fixture();w.milestones=[{id:'m1',projectId:'p',name:'First project label',color:'#abcdef'},{id:'m2',projectId:'other',name:'Other label',color:'#abcdef'}];w.tasks=[{id:'t',projectId:'p',milestoneId:'m1',title:'Move task',notes:'',status:'backlog',priority:'normal',today:false,dueDate:'',createdAt:w.updatedAt,completedAt:null}];
 const b=api(w),u=userEvent.setup();render(<App bridge={b}/>);await u.click(await screen.findByRole('button',{name:'Demo',exact:true}));await u.click(screen.getByRole('button',{name:'Edit task Move task'}));
 expect(screen.getByLabelText('Milestone')).toHaveValue('m1');await u.selectOptions(screen.getByLabelText('Project'),'other');expect(screen.getByLabelText('Milestone')).toHaveValue('');expect(screen.queryByRole('option',{name:'First project label'})).not.toBeInTheDocument();expect(screen.getByRole('option',{name:'Other label'})).toBeInTheDocument();
 await u.click(screen.getByRole('button',{name:'Save task'}));expect(b.save.mock.calls.at(-1)[0].tasks[0]).toMatchObject({projectId:'other',milestoneId:''});
});
it('creates project milestone labels, assigns tasks and shows live completion in Milestones',async()=>{
 const u=userEvent.setup(),b=api(fixture());render(<App bridge={b}/>);
 await u.click(await screen.findByRole('button',{name:'Demo',exact:true}));
 await u.click(screen.getByRole('tab',{name:'Milestones'}));
 await u.click(screen.getByRole('button',{name:'New milestone'}));
 await u.type(screen.getByLabelText('Milestone name'),'First playable');
 await u.click(screen.getByRole('button',{name:'Save milestone'}));
 expect(b.save.mock.calls.at(-1)[0].milestones[0]).toMatchObject({projectId:'p',name:'First playable'});
 expect(screen.getByRole('tabpanel',{name:'Milestones'})).toHaveTextContent('0 / 0 done');
 await u.click(screen.getByRole('button',{name:'New task'}));
 await u.type(screen.getByLabelText('Task title'),'Ship tutorial');
 await u.selectOptions(screen.getByLabelText('Milestone'),b.save.mock.calls.at(-1)[0].milestones[0].id);
 await u.click(screen.getByRole('button',{name:'Save task'}));
 expect(screen.getByText('First playable',{selector:'.task-tag'})).toBeInTheDocument();
 await u.selectOptions(screen.getByLabelText('Status for Ship tutorial'),'done');
 await u.click(screen.getByRole('tab',{name:'Milestones'}));
 const panel=screen.getByRole('tabpanel',{name:'Milestones'});
 expect(panel).toHaveTextContent('1 / 1 done');expect(within(panel).getByRole('button',{name:'Edit task Ship tutorial'})).toBeInTheDocument();
 await u.click(within(panel).getByRole('button',{name:'Edit milestone First playable'}));
 await u.clear(screen.getByLabelText('Milestone name'));await u.type(screen.getByLabelText('Milestone name'),'Demo ready');await u.click(screen.getByRole('button',{name:'Save milestone'}));
 expect(screen.getByRole('heading',{name:'Demo ready'})).toBeInTheDocument();
});
