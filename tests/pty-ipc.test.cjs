'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {registerIpc}=require('../desktop/ipc.cjs');
test('all PTY IPC is exact-frame and exact-arity gated and removed on dispose',async()=>{
 const handlers=new Map(),calls=[];const frame={url:'file:///app/index.html'},contents={mainFrame:frame};
 const arities={ptyStart:1,ptyRead:2,ptyInput:3,ptyResize:4,ptyClose:2};
 const service=Object.fromEntries(Object.keys(arities).map(n=>[n,async(...args)=>calls.push([n,...args])]));
 const dispose=registerIpc({ipcMain:{handle:(n,f)=>handlers.set(n,f),removeHandler:n=>handlers.delete(n)},webContents:contents,indexURL:frame.url,service});
 for(const [name,arity]of Object.entries(arities)){const handler=handlers.get('rift:'+name);assert.equal(typeof handler,'function');const args=Array(arity).fill('p');await assert.rejects(handler({sender:{},senderFrame:frame},...args),/Untrusted/);await assert.rejects(handler({sender:contents,senderFrame:frame},...args,'bad'),/arguments/);await handler({sender:contents,senderFrame:frame},...args);assert.deepEqual(calls.at(-1),[name,...args]);}
 dispose();assert.equal(handlers.size,0);
});
