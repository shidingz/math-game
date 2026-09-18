'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),sharp=require('sharp');
test('guided production uses fixed windows, two action references and deterministic final padding',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'guided-production-')),photo=path.join(tmp,'photo.png'),job=path.join(tmp,'job'),log=path.join(tmp,'calls.log');
 try{
  await sharp({create:{width:64,height:64,channels:4,background:'#e07920'}}).png().toFile(photo);
  const args=['scripts/pet-guided-pipeline.cjs','--out',job,'--photos',photo,'--id','custom-guided-test','--name','引导伙伴','--submit'];
  const env={...process.env,API302_API_KEY:'fixture-key',FANTASY_TEST_LOG:log,FANTASY_GUIDED:'1',NODE_OPTIONS:'--require ./tests/assets/fake-302.cjs'};
  const run=e=>spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env:e,encoding:'utf8',timeout:120000});
  const first=run(env);assert.equal(first.status,0,first.stderr+first.stdout);assert.match(first.stdout,/ready-for-test/);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(calls.map(c=>c.refs),[3,2,2,2]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(job,'pipeline-status.json'))).layout,'guided-windows-v7');
  const pack=JSON.parse(fs.readFileSync(path.join(job,'candidate/pet.json')));assert.equal(pack.stages.length,3);
  for(const s of pack.stages)for(const b of s.bounds){assert.ok(b.x>=48&&b.y>=48);assert.ok(b.x+b.width<=464&&b.y+b.height<=448);}
  const repeat=run({...env,FANTASY_BLOCK_NETWORK:'1'});assert.equal(repeat.status,0,repeat.stderr+repeat.stdout);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
  const imported=path.join(tmp,'imported'),importLog=path.join(tmp,'import-calls.log'),importArgs=[...args];importArgs[importArgs.indexOf('--out')+1]=imported;importArgs.push('--design-image',path.join(job,'design/image-1.png'),'--action-images',path.join(job,'stage1/image-1.png')+',,');
  const reused=spawnSync(process.execPath,importArgs,{cwd:path.resolve(__dirname,'../..'),env:{...env,FANTASY_TEST_LOG:importLog},encoding:'utf8',timeout:120000});assert.equal(reused.status,0,reused.stderr+reused.stdout);
  assert.deepEqual(fs.readFileSync(importLog,'utf8').trim().split('\n').map(s=>JSON.parse(s).id),['stage2','stage3']);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
