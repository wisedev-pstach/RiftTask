'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
test('macOS login uses trusted osascript with command as argv, quoted discovered executable and fixed auth arguments',async()=>{
 const {launchLogin}=require('../desktop/login.cjs');const calls=[];
 await launchLogin({platform:'darwin',discover:async()=>"/opt/homebrew/it's bin/gh",execute:async(...a)=>{calls.push(a);return {stdout:''};}});
 assert.equal(calls[0][0],'/usr/bin/osascript');assert.ok(calls[0][1].includes('--'));
 assert.match(calls[0][1].at(-1),/auth.*login.*--hostname.*github.com.*--git-protocol.*https.*--web/);
 assert.ok(calls[0][1].at(-1).includes("'\\''"));assert.equal(calls[0][2].shell,false);
});
test('Windows starts a real separate console with default terminal streams, fixed encoded literal gh command and no security bypass',async()=>{
 const {launchLogin}=require('../desktop/login.cjs');let call;
 await launchLogin({platform:'win32',env:{SystemRoot:'C:\\Windows'},discover:async()=>"C:\\Program Files\\GitHub CLI\\gh.exe",execute:async(...args)=>{call=args;return {stdout:''};}});
 assert.equal(call[0],'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.equal(call[2].shell,false);assert.equal(call[2].windowsHide,true);
 const outer=Buffer.from(call[1].at(-1),'base64').toString('utf16le');assert.match(outer,/Start-Process -FilePath/);assert.match(outer,/'-NoExit'/);assert.ok(!outer.includes('RedirectStandard'));const encoded=outer.match(/'-EncodedCommand', '([A-Za-z0-9+/=]+)'/)[1];const script=Buffer.from(encoded,'base64').toString('utf16le');assert.match(script,/& 'C:.*gh.exe' 'auth' 'login'/);assert.ok(!outer.includes('ExecutionPolicy'));
});
test('discovery returns absolute verified gh from GUI fallback and rejects invalid version output',async()=>{
 const {discoverGh}=require('../desktop/gh.cjs');const calls=[];
 const file=await discoverGh({platform:'darwin',env:{PATH:''},execute:async(file,args,options)=>{calls.push({file,args,options});return {stdout:'gh version 2.80.0 (official)'};}});
 assert.equal(file,'/opt/homebrew/bin/gh');assert.deepEqual(calls[0].args,['--version']);assert.equal(calls[0].options.shell,false);
 await assert.rejects(discoverGh({platform:'darwin',env:{PATH:''},execute:async()=>({stdout:'not gh'})}),/GitHub CLI/);
});
test('disconnect during gh discovery cancels before native terminal creation',async()=>{
 const {launchLogin}=require('../desktop/login.cjs');let active=true,calls=0;
 await assert.rejects(launchLogin({platform:'darwin',isCurrent:()=>active,discover:async()=>{active=false;return '/usr/local/bin/gh';},execute:async()=>calls++}),/terminal|disconnect/i);assert.equal(calls,0);
});
test('macOS generated terminal command executes fixed gh argv with hostile executable path in an actual shell fixture',async t=>{
 const fs=require('node:fs'),path=require('node:path'),{promisify}=require('node:util'),{execFile}=require('node:child_process');const execute=promisify(execFile);const root=fs.mkdtempSync(path.join(process.env.TMPDIR,'rift-login-exec-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const gh=path.join(root,"literal '$HOME; gh"),log=path.join(root,'args.json');fs.writeFileSync(gh,'#!'+process.execPath+'\nrequire("node:fs").writeFileSync(process.env.FIXTURE_LOG,JSON.stringify(process.argv.slice(2)));\n',{mode:0o700});
 await require('../desktop/login.cjs').launchLogin({platform:'darwin',discover:async()=>gh,execute:async(file,args,options)=>{assert.equal(file,'/usr/bin/osascript');return execute('/bin/bash',['-c',args.at(-1)],{...options,env:{...process.env,FIXTURE_LOG:log}});}});
 assert.deepEqual(JSON.parse(fs.readFileSync(log,'utf8')),['auth','login','--hostname','github.com','--git-protocol','https','--web']);
});
test('Linux has actionable no-login fallback and launcher failures do not leak subprocess errors',async()=>{
 const {launchLogin}=require('../desktop/login.cjs');await assert.rejects(launchLogin({platform:'linux'}),/gh auth login --hostname github.com --git-protocol https --web/);
 await assert.rejects(launchLogin({platform:'darwin',discover:async()=>'/usr/local/bin/gh',execute:async()=>{throw new Error('secret');}}),e=>!e.message.includes('secret')&&/terminal/i.test(e.message));
});
