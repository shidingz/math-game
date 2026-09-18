const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../..');
async function fixture(run) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pet-offline-pipeline-'));
  const photo=path.join(folder,'photo.png');
  await sharp({create:{width:80,height:80,channels:4,background:'#dddddd'}}).png().toFile(photo);
  const log=path.join(folder,'requests.txt');
  const args=['scripts/seedream-pet-pipeline.cjs','--out',path.join(folder,'job'),'--photos',photo,'--step','all','--id','custom-fixture','--name','测试伙伴','--review','--submit'];
  const env={...process.env,ARK_API_KEY:'offline-fixture-key',PET_FIXTURE_LOG:log,NODE_OPTIONS:'--require ./tests/assets/fake-ark.cjs'};
  const execute=(extra=[],overrides={})=>spawnSync(process.execPath,[...args.filter(a=>!(overrides.PET_FIXTURE_NO_REVIEW&&a==='--review')),...extra],{cwd:root,env:{...env,...overrides},encoding:'utf8',timeout:90000,maxBuffer:1024*1024});
  try{await run({folder,log,execute});}finally{fs.rmSync(folder,{recursive:true,force:true});}
}
test('default Pro no-reference pipeline assembles repeatable playable files without any post-generation AI',async()=>fixture(async({folder,log,execute})=>{
  const r=execute([],{PET_FIXTURE_NO_REVIEW:'1'});assert.equal(r.status,0,r.stderr+r.stdout);
  const job=path.join(folder,'job'), candidate=path.join(job,'candidate');
  const report=()=>JSON.parse(fs.readFileSync(path.join(candidate,'quality.json')));
  const first=report();assert.equal(first.conversion.status,'ready');assert.equal(first.conversion.aiCalls,0);
  assert.equal(first.status,'needs-visual-review');assert.deepEqual(first.reviews,{});
  const meta=JSON.parse(fs.readFileSync(path.join(job,'design/request-meta.json')));
  assert.equal(meta.model,'doubao-seedream-5-0-pro-260628');assert.equal(meta.references.length,1);
  const assembled=spawnSync(process.execPath,['scripts/assemble-seedream-pet.cjs','--in',job,'--id','custom-fixture','--name','测试伙伴'],{
    cwd:root,env:{...process.env,NODE_OPTIONS:'--require ./tests/assets/fake-ark.cjs',PET_FIXTURE_LOG:log,PET_FIXTURE_NO_NETWORK:'1'},encoding:'utf8',timeout:60000});
  assert.equal(assembled.status,0,assembled.stderr+assembled.stdout);assert.deepEqual(report().files,first.files);
  assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,7);
}));
test('offline complete job resumes without another generation; changed art cannot be published',async()=>fixture(async({folder,log,execute})=>{
  let r=execute();assert.equal(r.status,0,r.stderr+r.stdout);
  const count=()=>fs.readFileSync(log,'utf8').trim().split('\n').length;
  assert.equal(count(),7);
  const candidate=path.join(folder,'job/candidate');
  assert.equal(JSON.parse(fs.readFileSync(path.join(candidate,'quality.json'))).status,'accepted');
  r=execute();assert.equal(r.status,0,r.stderr+r.stdout);assert.equal(count(),7);
  fs.appendFileSync(path.join(candidate,'stage-1.png'),Buffer.from('modified'));
  const packed=spawnSync(process.execPath,['scripts/pack-custom-pet.cjs','--in',candidate,'--out',path.join(folder,'published'),'--id','custom-fixture','--name','测试','--base-url','https://example.test/pets'],{cwd:root,env:process.env,encoding:'utf8'});
  assert.notEqual(packed.status,0);assert.match(packed.stderr,/changed after quality review/);
}));
test('offline bad geometry retries only that asset, while request budget stops further calls',async()=>fixture(async({log,execute})=>{
  const r=execute([],{PET_FIXTURE_REJECT_FIRST:'stage1'});assert.equal(r.status,0,r.stderr+r.stdout);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n');assert.equal(calls.length,8);assert.equal(calls.filter(x=>x==='stage1').length,2);assert.equal(calls.filter(x=>x==='stage2').length,1);
}));
test('offline per-job request cap prevents creating a seventh image request',async()=>fixture(async({log,execute})=>{
  const r=execute(['--max-requests','6']);assert.notEqual(r.status,0);assert.match(r.stderr,/request limit/);
  assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,6);
}));
test('locked three-stage design skips generation and binds future assets to that design',async()=>fixture(async({folder,log,execute})=>{
  const design=path.join(folder,'chosen-design.png');
  await sharp({create:{width:480,height:160,channels:4,background:'#ffffff'}}).png().toFile(design);
  const args=['--design-image',design,'--reference','siamese'];
  const r=execute(args);assert.equal(r.status,0,r.stderr+r.stdout);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n');assert.equal(calls.length,6);assert.ok(!calls.includes('design'));
  const job=path.join(folder,'job');
  const meta=JSON.parse(fs.readFileSync(path.join(job,'stage1/request-meta.json')));
  assert.equal(meta.references.length,1,'Actions receive only the locked stage; no inherited character reference');
  assert.equal(fs.existsSync(path.join(job,'references/pose-reference.png')),false);
  assert.equal(fs.existsSync(path.join(job,'references/evolution-reference.png')),false);
  assert.deepEqual(fs.readFileSync(path.join(job,'design/image-1.png')),fs.readFileSync(design));
  fs.appendFileSync(design,'changed');
  const changed=execute(args);assert.notEqual(changed.status,0);assert.match(changed.stderr,/Selected design changed/);
  assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,6);
}));
