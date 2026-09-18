'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process'),sharp=require('sharp');
test('alpha worker makes four transparent requests, chooses a usable candidate and reassembles offline',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-worker-')),root=path.resolve(__dirname,'../..'),photo=path.join(tmp,'photo.png'),preload=path.join(tmp,'preload.cjs'),log=path.join(tmp,'calls.jsonl'),job=path.join(tmp,'job');
 try{
  await sharp({create:{width:256,height:256,channels:4,background:'#eea640'}}).png().toFile(photo);
  fs.writeFileSync(preload,`const sharp=require('sharp'),fs=require('fs');
global.fetch=async(url,opt)=>{if(process.env.ALPHA_BLOCK_NETWORK)throw Error('Network disabled');
if(!(opt.method==='POST'&&url==='https://api.302ai.cn/v1/images/edits?async=true')&&!(opt.method==='GET'&&url.startsWith('https://api.302ai.cn/async_result?task_id=')))throw Error('Unapproved model endpoint');
if(opt.method==='POST'){const f=opt.body,kind=f.get('size')==='3072x1024'?'design':'sheet';if(f.get('background')!=='transparent')throw Error('Expected alpha');fs.appendFileSync(process.env.ALPHA_TEST_LOG,JSON.stringify({kind,refs:f.getAll('image[]').length})+'\\n');return Response.json({task_id:kind});}
const kind=url.includes('design')?'design':'sheet',w=kind==='design'?3072:1536,h=kind==='design'?1024:1536,cell=kind==='design'?1024:512,rows=kind==='design'?1:3;
let svg='';for(let r=0;r<rows;r++)for(let c=0;c<3;c++)svg+='<rect x="'+(c*cell+cell*.35)+'" y="'+(r*cell+cell*.28)+'" width="'+cell*.3+'" height="'+cell*.44+'" rx="40" fill="#b97d39"/>';
const b=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'+svg+'</svg>')).png().toBuffer();
const bad=await sharp({create:{width:w,height:h,channels:4,background:'#ffffff'}}).png().toBuffer();
return Response.json({status_code:200,err:'',data:{data:[bad,b].map(x=>({b64_json:x.toString('base64')}))}});};`);
  const args=['scripts/pet-alpha-pipeline.cjs','--out',job,'--photos',photo,'--submit'];
  const env={...process.env,API302_API_KEY:'fixture-only',ALPHA_TEST_LOG:log,NODE_OPTIONS:'--require '+preload};
  const r=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr+r.stdout);
  const calls=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(calls.map(c=>c.refs),[3,2,2,2]);
  const pack=JSON.parse(fs.readFileSync(path.join(job,'candidate/pet.json')));assert.equal(pack.layout,'template-v1');assert.equal(pack.stages.length,3);assert.equal(pack.name,'新伙伴');assert.match(pack.id,/^custom-[0-9a-f]{24}$/);
  const recipe=JSON.parse(fs.readFileSync(path.join(job,'recipe.json')));assert.equal(recipe.style.character,'samoyed');assert.equal(recipe.style.sha256.length,3);
  for(const step of ['design','stage1','stage2','stage3']){const s=JSON.parse(fs.readFileSync(path.join(job,step,'conversion-selection.json')));assert.equal(s.file,'response-image-2.png');assert.equal(s.rejected.length,1);}
  const first=fs.readFileSync(path.join(job,'candidate/stage-1.png'));
  const repeat=spawnSync(process.execPath,args,{cwd:root,env:{...env,ALPHA_BLOCK_NETWORK:'1'},encoding:'utf8',timeout:120000});assert.equal(repeat.status,0,repeat.stderr+repeat.stdout);
  assert.deepEqual(fs.readFileSync(path.join(job,'candidate/stage-1.png')),first);assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
