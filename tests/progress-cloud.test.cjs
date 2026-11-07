'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSampleWorkspace}=require('../desktop/core.cjs');const {projectCloudWorkspace,prepareCloudRestore}=require('../desktop/cloud-snapshot.cjs');
const scope={accountId:42,repositoryId:81};
const image={id:'image',name:'private.png',mime:'image/png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII='};
function fixture(){const w=createSampleWorkspace();w.projects[0].icon='rocket';w.tasks[0].progress=[{id:'entry',createdAt:w.updatedAt,body:'',links:[],images:[image]}];return w;}
test('cloud carries icon and progress but no image payload or filenames; restores exact matching local images',()=>{
 const local=fixture(),before=structuredClone(local),envelope=projectCloudWorkspace(local,scope),wire=JSON.stringify(envelope);
 assert.equal(wire.includes('data:image'),false);assert.equal(wire.includes('private.png'),false);assert.equal(envelope.workspace.projects[0].icon,'rocket');assert.equal(envelope.workspace.tasks[0].progress[0].imageCount,1);
 envelope.workspace.tasks[0].progress[0].body='Remote **note**';envelope.workspace.tasks[0].progress[0].links=['https://example.com/build'];const remoteWire=JSON.stringify(envelope);const restored=prepareCloudRestore(remoteWire,local,scope);assert.equal(restored.tasks[0].progress[0].body,'Remote **note**');assert.deepEqual(restored.tasks[0].progress[0].links,['https://example.com/build']);assert.deepEqual(prepareCloudRestore(wire,local,scope).tasks[0].progress[0].images,[image]);assert.deepEqual(local,before);
 for(const change of [w=>w.tasks[0].id='other',w=>w.tasks[0].progress[0].id='other',w=>w.tasks[0].projectId='new-project']){const other=structuredClone(local);other.projects.push({...other.projects[0],id:'new-project'});change(other);assert.equal(prepareCloudRestore(wire,other,scope).tasks[0].progress[0].images,undefined);}
 for(const bad of [e=>e.workspace.tasks[0].progress[0].images=[image],e=>e.workspace.tasks[0].progress[0].images=[],e=>e.workspace.tasks[0].progress[0].extra='x']){const e=structuredClone(envelope);bad(e);assert.throws(()=>prepareCloudRestore(JSON.stringify(e),local,scope),/Invalid cloud snapshot/);}
});
