const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..');
test('template pipeline makes only four image calls, locks reference dimensions and assembles without AI',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pet-template-')),photo=path.join(out,'photo.png'),log=path.join(out,'requests.log'),job=path.join(out,'job');
  await sharp({create:{width:64,height:64,channels:4,background:'#aaaaaa'}}).png().toFile(photo);
  const env={...process.env,ARK_API_KEY:'fixture-key',PET_TEMPLATE_TEST_LOG:log,NODE_OPTIONS:'--require ./tests/assets/fake-template.cjs'};
  try{
    const r=spawnSync(process.execPath,['scripts/pet-template-pipeline.cjs','--out',job,'--photos',photo,'--id','custom-template-test','--name','测试','--submit'],{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:1000000});
    assert.equal(r.status,0,r.stderr+r.stdout);
    const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.equal(calls.length,4);assert.deepEqual(calls.map(c=>c.size),['3072x1024','1536x1536','1536x1536','1536x1536']);assert.ok(calls.every(c=>c.refs===2));
    const candidate=path.join(job,'candidate'),report=JSON.parse(fs.readFileSync(path.join(candidate,'quality.json'))),pack=JSON.parse(fs.readFileSync(path.join(candidate,'pet.json')));
    assert.ok(pack.procedural);assert.equal(pack.scene,undefined);assert.equal(pack.effects,undefined);assert.equal(report.conversion.aiCalls,0);
    for(const cells of Object.values(report.geometry))for(const cell of cells){assert.ok(cell.output.x>=cell.target.x);assert.ok(cell.output.width<=cell.target.width);assert.equal(cell.output.y+cell.output.height,448);}
    const again=spawnSync(process.execPath,['scripts/pet-template-assemble.cjs','--in',job,'--id',pack.id,'--name',pack.name],{cwd:root,env:{...env,PET_TEMPLATE_BLOCK_ALL:'1'},encoding:'utf8',timeout:120000});
    assert.equal(again.status,0,again.stderr+again.stdout);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(candidate,'quality.json'))).files,report.files);
    assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
    await assert.rejects(require('../../scripts/pet-template-assemble.cjs').stage(photo,path.join(out,'bad'),{rects:Array(9).fill({})}),/exact/);
  }finally{fs.rmSync(out,{recursive:true,force:true});}
});
