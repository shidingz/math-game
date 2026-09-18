'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),sharp=require('sharp');
test('generic GPT job locks rules before four image requests; cached conversion works with network blocked and rejects changed inputs',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-pipeline-')),photo=path.join(out,'photo.png'),job=path.join(out,'job'),log=path.join(out,'log');
 await sharp({create:{width:64,height:64,channels:4,background:'#e07920'}}).png().toFile(photo);
 const args=['scripts/pet-gpt-pipeline.cjs','--out',job,'--photos',photo,'--id','custom-fixture-v2','--name','离线伙伴','--submit'];
 const env={...process.env,API302_API_KEY:'fixture-key',FANTASY_TEST_LOG:log,NODE_OPTIONS:'--require ./tests/assets/fake-302.cjs'};
 const run=e=>spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env:e,encoding:'utf8',timeout:120000});
 try{
  const first=run(env);assert.equal(first.status,0,first.stderr+first.stdout);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(calls.map(c=>c.id),['design','stage1','stage2','stage3']);assert.deepEqual(calls.map(c=>c.refs),[2,1,1,1]);
  // Unknown single/multiple user images must not produce case-specific prompt prose.
  const multiArgs=args.slice(0,-1);multiArgs[multiArgs.indexOf('--out')+1]=path.join(out,'multi');multiArgs[multiArgs.indexOf('--photos')+1]=photo+','+photo;
  const multi=spawnSync(process.execPath,multiArgs,{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:120000});assert.equal(multi.status,0,multi.stderr+multi.stdout);
  assert.equal(fs.readFileSync(path.join(out,'multi/design/prompt.txt'),'utf8'),fs.readFileSync(path.join(job,'design/prompt.txt'),'utf8'));
  const multipleMeta=JSON.parse(fs.readFileSync(path.join(out,'multi/design/request-meta.json')));assert.equal(multipleMeta.references.length,2);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
  const pack=JSON.parse(fs.readFileSync(path.join(job,'candidate/pet.json'))),quality=JSON.parse(fs.readFileSync(path.join(job,'candidate/quality.json')));assert.equal(pack.procedural.version,2);assert.ok(pack.procedural.match.hue<50);assert.equal(quality.conversion.aiCalls,0);
  const repeat=run({...env,FANTASY_BLOCK_NETWORK:'1'});assert.equal(repeat.status,0,repeat.stderr+repeat.stdout);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(job,'candidate/quality.json'))).files,quality.files);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
  const recipe=JSON.parse(fs.readFileSync(path.join(job,'recipe.json')));recipe.rules['scripts/pet-fantasy-assemble.cjs']='tampered';fs.writeFileSync(path.join(job,'recipe.json'),JSON.stringify(recipe));
  const changed=run(env);assert.notEqual(changed.status,0);assert.match(changed.stderr,/rules changed/);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('locked same-aspect design is normalized and causes only three action requests',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-locked-')),photo=path.join(out,'photo.png'),design=path.join(out,'design.png'),job=path.join(out,'job'),log=path.join(out,'log');
 try{
  await sharp({create:{width:64,height:64,channels:4,background:'#e07920'}}).png().toFile(photo);
  await sharp({create:{width:2172,height:724,channels:4,background:'#fff'}}).png().toFile(design);
  const args=['scripts/pet-gpt-pipeline.cjs','--out',job,'--photos',photo,'--id','custom-locked','--name','固定伙伴','--design-image',design,'--submit'];
  const env={...process.env,API302_API_KEY:'fixture-key',FANTASY_TEST_LOG:log,NODE_OPTIONS:'--require ./tests/assets/fake-302.cjs'};
  const r=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr+r.stdout);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(calls.map(c=>c.id),['stage1','stage2','stage3']);
  const q=JSON.parse(fs.readFileSync(path.join(job,'candidate/quality.json')));assert.equal(q.conversion.designNormalization.source.width,2172);assert.equal(q.conversion.designNormalization.target.width,3072);
  const partialArgs=args.slice();partialArgs[partialArgs.indexOf('--out')+1]=path.join(out,'partial');partialArgs.push('--action-images',path.join(job,'stage1/image-1.png')+',,');
  const partial=spawnSync(process.execPath,partialArgs,{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:120000});assert.equal(partial.status,0,partial.stderr+partial.stdout);
  assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse).map(c=>c.id),['stage1','stage2','stage3','stage2','stage3']);
  await sharp({create:{width:2172,height:724,channels:4,background:'#333'}}).png().toFile(design);
  const changed=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:120000});assert.notEqual(changed.status,0);assert.match(changed.stderr,/rules changed/);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,5);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('pending action serializes subsequent generation and resumes without duplicate POST',async()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-serial-')),photo=path.join(out,'photo.png'),job=path.join(out,'job'),log=path.join(out,'log');
 try{
  await sharp({create:{width:64,height:64,channels:4,background:'#e07920'}}).png().toFile(photo);
  const args=['scripts/pet-gpt-pipeline.cjs','--out',job,'--photos',photo,'--id','custom-serial','--name','顺序伙伴','--submit'];
  const env={...process.env,API302_API_KEY:'fixture-key',FANTASY_TEST_LOG:log,NODE_OPTIONS:'--require ./tests/assets/fake-302.cjs'};
  for(let i=0;i<2;i++){const r=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env:{...env,FANTASY_PENDING:'stage1'},encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr+r.stdout);}
  assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse).map(c=>c.id),['design','stage1']);
  const r=spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),env,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr+r.stdout);
  assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse).map(c=>c.id),['design','stage1','stage2','stage3']);
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});
