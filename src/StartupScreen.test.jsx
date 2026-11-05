import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const workspace={version:1,categories:[],projects:[],tasks:[]};
function apiFor(request){return {session:vi.fn(()=>request.promise),load:vi.fn().mockResolvedValue(workspace),login:vi.fn(),save:vi.fn(),cloudStatus:vi.fn()};}
afterEach(()=>{localStorage.clear();delete document.documentElement.dataset.theme;});

describe('app startup',()=>{
 it.each(['light','dark'])('applies saved %s appearance before the session resolves',mode=>{
  localStorage.setItem('rifttask.appearance',mode);render(<App bridge={apiFor(deferred())}/>);
  expect(document.documentElement).toHaveAttribute('data-theme',mode);
  expect(screen.getByRole('heading',{name:'Opening RiftTask'})).toBeInTheDocument();
 });
 it.each([true,false])('transitions immediately after session resolves (signed in: %s), with no timer or extra authentication',async signedIn=>{
  const request=deferred(),load=deferred(),api=apiFor(request);api.load.mockImplementation(()=>load.promise);
  render(<App bridge={api}/>);
  await act(async()=>request.resolve({account:signedIn?{id:1,login:'example'}:null,ghAvailable:true}));
  expect(screen.queryByRole('heading',{name:'Opening RiftTask'})).not.toBeInTheDocument();
  expect(screen.getByRole('heading',{name:signedIn?'Projects':'Your work, on this device.'})).toBeInTheDocument();
  expect(api.session).toHaveBeenCalledOnce();expect(api.load).toHaveBeenCalledTimes(signedIn?1:0);
  for(const method of ['login','save','cloudStatus'])expect(api[method]).not.toHaveBeenCalled();
  if(signedIn){expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…');await act(async()=>load.resolve(workspace));expect(screen.getByRole('heading',{name:'No projects yet'})).toBeInTheDocument();}
 });
 it('preserves workspace-load failure recovery after the startup screen has already left',async()=>{
  const request=deferred(),api=apiFor(request);api.load.mockRejectedValueOnce(new Error('Workspace read failed')).mockResolvedValue(workspace);
  render(<App bridge={api}/>);await act(async()=>request.resolve({account:{id:1,login:'example'},ghAvailable:true}));
  expect(screen.getByRole('alert')).toHaveTextContent('Workspace read failed');expect(screen.queryByRole('heading',{name:'Opening RiftTask'})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Retry loading'}));
  expect(screen.getByRole('heading',{name:'No projects yet'})).toBeInTheDocument();expect(api.session).toHaveBeenCalledTimes(2);expect(api.load).toHaveBeenCalledTimes(2);
 });
 it('shows a branded accessible startup while session is pending without inventing progress or calling other APIs',()=>{
  const api=apiFor(deferred());const {container}=render(<App bridge={api}/>);
  expect(screen.getByRole('heading',{name:'Opening RiftTask'})).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…');
  const logo=container.querySelector('img');expect(logo).toHaveAttribute('src','./icon.svg');expect(logo).toHaveAttribute('alt','');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(api.session).toHaveBeenCalledOnce();
  for(const method of ['load','login','save','cloudStatus'])expect(api[method]).not.toHaveBeenCalled();
 });
 it('announces initial failure and retries only on request, returning to honest loading until session resolves',async()=>{
  const request=deferred(),retry=deferred();const api=apiFor(request);api.session.mockImplementationOnce(()=>request.promise).mockImplementationOnce(()=>retry.promise);
  render(<App bridge={api}/>);
  await act(async()=>request.reject(new Error('Workspace could not be reached.')));
  expect(screen.getByRole('alert')).toHaveTextContent('Workspace could not be reached.');
  expect(screen.getByRole('status')).toHaveTextContent('Workspace unavailable');
  const u=userEvent.setup();await u.tab();expect(screen.getByRole('button',{name:'Retry loading'})).toHaveFocus();await u.keyboard('{Enter}');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…');
  expect(api.session).toHaveBeenCalledTimes(2);expect(api.load).not.toHaveBeenCalled();expect(api.login).not.toHaveBeenCalled();
  await act(async()=>retry.resolve({account:null,ghAvailable:true}));
  expect(screen.getByRole('heading',{name:'Your work, on this device.'})).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'Opening RiftTask'})).not.toBeInTheDocument();expect(api.load).not.toHaveBeenCalled();
 });
});
