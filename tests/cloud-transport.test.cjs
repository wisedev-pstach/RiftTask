const {test}=require('node:test');const assert=require('node:assert/strict');
const {createCloudTransport,boundedExecute}=require('../desktop/cloud-transport.cjs');
test('a repository with unrelated project files is not a dedicated cloud destination',async()=>{const t=createCloudTransport({run:async()=>JSON.stringify([{name:'package.json',type:'file',path:'package.json'}])});await assert.rejects(t.read(repository),/dedicated/i);});
const repository={id:77,default_branch:'main'};
test('transport uses fixed host and file, bounded stdin JSON with expected SHA, never body in argv',async()=>{const calls=[];const transport=createCloudTransport({run:async(file,args,options)=>{calls.push({file,args,options});return '{}';}});const text='private notes';await transport.write(repository,text,'a'.repeat(40));const c=calls[0];assert.deepEqual(c.args,['api','--hostname','github.com','--method','PUT','repositories/77/contents/rifttask-workspace.json','--input','-']);const body=JSON.parse(c.options.input);assert.equal(Buffer.from(body.content,'base64').toString(),text);assert.equal(body.sha,'a'.repeat(40));assert.equal(body.branch,'main');assert.equal(c.options.shell,false);assert.equal(c.options.timeout,20000);assert.ok(c.options.maxBuffer<=2*1024*1024);assert.ok(!JSON.stringify(c.args).includes(text));});
test('real child-process stdin works, stdout/stderr and time are bounded, errors sanitized',async()=>{
 const options={input:'stdin-private',timeout:1000,maxBuffer:1024};
 const r=await boundedExecute(process.execPath,['-e',"process.stdin.pipe(process.stdout)"],options);assert.equal(r.stdout,'stdin-private');
 await assert.rejects(boundedExecute(process.execPath,['-e',"process.stderr.write('SECRET');process.exit(1)"],options),e=>!e.message.includes('SECRET'));
 await assert.rejects(boundedExecute(process.execPath,['-e',"process.stdout.write('x'.repeat(5000))"],options),/Cloud/i);
 await assert.rejects(boundedExecute(process.execPath,['-e',"setTimeout(()=>{},5000)"],{...options,timeout:30}),/Cloud/i);
});
test('root listing absence permits create, but 404 is never treated as absent; read validates fixed file and bound',async()=>{
 let calls=[];let response=[];const t=createCloudTransport({run:async(_f,args)=>{calls.push(args);if(response instanceof Error)throw response;return JSON.stringify(response);}});
 assert.equal(await t.read(repository),null);assert.ok(calls[0].includes('repositories/77/contents?ref=main'));
 response=new Error('SECRET 404');await assert.rejects(t.read(repository),e=>!e.message.includes('SECRET'));
 for(const name of ['https://evil.test/a','solo/../secret','solo/x?token=secret','-x/repo'])await assert.rejects(t.repository(name),/repository/i);
 await assert.rejects(t.write({id:'77/../../user',default_branch:'main'},'x'),/repository/i);
});
