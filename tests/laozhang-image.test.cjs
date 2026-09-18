const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {edit}=require('../scripts/laozhang-image.cjs');
test('gateway edit uses only provided references; download resume does not regenerate',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-gateway-')),photo=path.join(dir,'source.png');
  fs.writeFileSync(photo,Buffer.from([137,80,78,71]));
  const original=global.fetch,prior=process.env.LAOZHANG_API_KEY;process.env.LAOZHANG_API_KEY='offline-test';let posts=0,downloads=0;
  global.fetch=async(url,options)=>{
    if(options?.method==='POST'){
      posts++;assert.equal(String(url),'https://api2.laozhang.ai/v1/images/edits');assert.equal(options.body.get('model'),'gpt-image-2.5-web');assert.equal(options.body.getAll('image').length,1);assert.equal(options.body.has('quality'),false);
      return {ok:true,json:async()=>({data:[{url:'https://image.example.test/generated.png'}]})};
    }
    if(++downloads===1)throw Error('download interrupted');
    return {ok:true,arrayBuffer:async()=>Buffer.alloc(24,10)};
  };
  const options={directory:path.join(dir,'attempt'),references:[photo],prompt:'Generic photo evolution',submit:true};
  try {
    const dry=await edit({...options,submit:false});assert.equal(dry.pending,true);assert.equal(posts,0);
    await assert.rejects(edit(options),/download interrupted/);
    const result=await edit(options);assert.ok(fs.existsSync(result.file));assert.equal(posts,1);
    await edit(options);assert.equal(posts,1);assert.equal(downloads,2);
    await assert.rejects(edit({...options,prompt:'different'}),/Inputs changed/);
  }finally{global.fetch=original;if(prior===undefined)delete process.env.LAOZHANG_API_KEY;else process.env.LAOZHANG_API_KEY=prior;fs.rmSync(dir,{recursive:true,force:true});}
});
test('ambiguous gateway response is not automatically resubmitted',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-gateway-uncertain-')),photo=path.join(dir,'source.png');fs.writeFileSync(photo,Buffer.from([137,80]));
  const original=global.fetch,prior=process.env.LAOZHANG_API_KEY;process.env.LAOZHANG_API_KEY='offline-test';let calls=0;
  global.fetch=async()=>{calls++;throw Error('network closed');};
  const options={directory:path.join(dir,'attempt'),references:[photo],prompt:'test',submit:true};
  try{await assert.rejects(edit(options),/network closed/);await assert.rejects(edit(options),/Previous request/);assert.equal(calls,1);}
  finally{global.fetch=original;if(prior===undefined)delete process.env.LAOZHANG_API_KEY;else process.env.LAOZHANG_API_KEY=prior;fs.rmSync(dir,{recursive:true,force:true});}
});
