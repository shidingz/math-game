'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {submit,poll}=require('../scripts/api302-image.cjs');
function setup(){const out=fs.mkdtempSync(path.join(os.tmpdir(),'pet-302-')),photo=path.join(out,'photo.png');fs.writeFileSync(photo,Buffer.from([137,80,78,71,13,10,26,10]));return {out,photo,job:path.join(out,'job')};}
test('transparent PNG requests explicitly bind the background to the saved request fingerprint',async()=>{
 const t=setup(),oldKey=process.env.API302_API_KEY;process.env.API302_API_KEY='fixture-key';
 try{await submit({directory:t.job,prompt:'alpha',references:[t.photo],background:'transparent',prepare:true});const m=JSON.parse(fs.readFileSync(path.join(t.job,'request-meta.json')));assert.equal(m.fields.background,'transparent');assert.equal(m.fields.output_format,'png');await assert.rejects(submit({directory:t.job,prompt:'alpha',references:[t.photo],background:'fake',prepare:true}),/Unsupported image background/);}
 finally{if(oldKey===undefined)delete process.env.API302_API_KEY;else process.env.API302_API_KEY=oldKey;fs.rmSync(t.out,{recursive:true,force:true});}
});
test('unexpected multiple gateway variants are preserved and the last is selected without another POST',async()=>{
 const t=setup(),oldFetch=global.fetch,oldKey=process.env.API302_API_KEY;process.env.API302_API_KEY='fixture-key';let calls=0;
 const one=fs.readFileSync(t.photo),two=Buffer.concat([one,Buffer.from([1])]);
 global.fetch=async(_url,opt)=>{calls++;return Response.json(opt.method==='POST'?{task_id:'multi'}:{status_code:200,err:'',data:{data:[one,two].map(b=>({b64_json:b.toString('base64')}))}});};
 try{await submit({directory:t.job,prompt:'fixture',references:[t.photo]});const done=await poll(t.job);assert.deepEqual(fs.readFileSync(done.file),two);assert.deepEqual(fs.readFileSync(path.join(t.job,'response-image-1.png')),one);assert.equal(JSON.parse(fs.readFileSync(path.join(t.job,'selection.json'))).selectedIndex,2);await poll(t.job);assert.equal(calls,2);}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.API302_API_KEY;else process.env.API302_API_KEY=oldKey;fs.rmSync(t.out,{recursive:true,force:true});}
});
test('302 image task resumes without duplicate paid POSTs, preserves reference order, and downloads cached results',async()=>{
  const t=setup(),oldFetch=global.fetch,oldKey=process.env.API302_API_KEY,calls=[];process.env.API302_API_KEY='fixture-key';let polls=0;
  global.fetch=async(url,opt)=>{calls.push({url,opt});assert.equal(opt.headers.Authorization,'Bearer fixture-key');
    if(opt.method==='POST'){assert.equal(opt.body.get('model'),'gpt-image-2.5-sunburst');assert.equal(opt.body.get('n'),'1');assert.equal(opt.body.getAll('image[]').length,2);return Response.json({task_id:'test-task'});}
    assert.match(url,/\/async_result\?task_id=test-task$/);polls++;
    return Response.json(polls===1?{status_code:200,err:'result pending',data:''}:{status_code:200,err:'',data:JSON.stringify({data:[{b64_json:fs.readFileSync(t.photo).toString('base64')}],size:'1536x1536',quality:'high',usage:{total_tokens:4}})});
  };
  try{const args={directory:t.job,prompt:'fixture',references:[t.photo,t.photo]};await submit(args);await submit(args);assert.equal(calls.length,1);assert.equal((await poll(t.job)).state,'pending');const done=await poll(t.job);assert.equal(done.state,'downloaded');assert.deepEqual(fs.readFileSync(done.file),fs.readFileSync(t.photo));await poll(t.job);assert.equal(calls.length,3);await assert.rejects(submit({...args,prompt:'changed'}),/Inputs changed/);assert.equal(calls.length,3);
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.API302_API_KEY;else process.env.API302_API_KEY=oldKey;fs.rmSync(t.out,{recursive:true,force:true});}
});
test('302 uncertain submission is not retried and its error does not expose the credential',async()=>{
  const t=setup(),oldFetch=global.fetch,oldKey=process.env.API302_API_KEY;process.env.API302_API_KEY='fixture-secret';let calls=0;
  global.fetch=async()=>{calls++;throw Error('Connection interrupted fixture-secret');};
  try{const args={directory:t.job,prompt:'fixture',references:[t.photo]};await assert.rejects(submit(args),/\[redacted\]/);assert.ok(!fs.readFileSync(path.join(t.job,'status.json'),'utf8').includes('fixture-secret'));await assert.rejects(submit(args),/Previous POST/);assert.equal(calls,1);
  }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.API302_API_KEY;else process.env.API302_API_KEY=oldKey;fs.rmSync(t.out,{recursive:true,force:true});}
});
test('302 terminal error exposes upstream status safely and is not polled or submitted twice',async()=>{
 const t=setup(),oldFetch=global.fetch,oldKey=process.env.API302_API_KEY;process.env.API302_API_KEY='fixture-secret';let calls=0;
 global.fetch=async(url,opt)=>{calls++;return Response.json(opt.method==='POST'?{task_id:'failed-task'}:{status_code:429,err:'',data:JSON.stringify({error:{err_code:-10003,message:'rate limit fixture-secret'}})});};
 try{
  const args={directory:t.job,prompt:'fixture',references:[t.photo]};await submit(args);await assert.rejects(poll(t.job),/429.*\[redacted\]/);await assert.rejects(poll(t.job),/429/);await submit(args);assert.equal(calls,2);
  const s=JSON.parse(fs.readFileSync(path.join(t.job,'status.json')));assert.equal(s.upstreamStatus,429);assert.ok(!s.message.includes('fixture-secret'));
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.API302_API_KEY;else process.env.API302_API_KEY=oldKey;fs.rmSync(t.out,{recursive:true,force:true});}
});
