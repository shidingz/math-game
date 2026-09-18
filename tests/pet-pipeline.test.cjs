const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generate } = require('../scripts/seedream-client.cjs');
const { parse } = require('../scripts/pet-visual-review.cjs');
const { request } = require('../scripts/pet-visual-review.cjs');
test('generic design/action prompts stay concise without prescribing a source animal',()=>{
  const p=require('../scripts/pet-design-prompts.cjs');
  for(const prompt of [p.design(3,true),p.actions(3),p.food,p.scene,p.effects])assert.ok((prompt.match(/\p{Script=Han}/gu)||[]).length<=300);
  assert.ok(!p.design(1,false).includes('暹罗猫'));assert.ok(!p.actions(3).includes('图2'));assert.ok(!p.design(1,true).includes('孙悟空'));
  assert.match(p.design(1,false), /自行判断主体类型/);
  assert.match(p.design(1,false), /不默认照片是幼年/);
  assert.match(p.design(1,false), /决定照片对应哪个阶段/);
});
test('template prompts separate photo identity from a fixed-size style/action reference',()=>{
  const p=require('../scripts/pet-template-prompts.cjs');
  for(const text of [p.design(3),p.actions(1),p.actions(2),p.actions(3)])assert.ok((text.match(/\p{Script=Han}/gu)||[]).length<=300);
  assert.match(p.design(3),/自行判断/);assert.match(p.design(3),/3072×1024/);assert.match(p.actions(2),/1536×1536/);assert.match(p.actions(2),/图2是暹罗猫同阶段动作/);
});
test('a generation response is persisted before downloads and resume never sends another billable POST', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-seedream-test-'));
  const reference = path.join(folder, 'reference.png'); fs.writeFileSync(reference, Buffer.from([137,80,78,71]));
  const fetchBefore = global.fetch, keyBefore = process.env.ARK_API_KEY; process.env.ARK_API_KEY = 'test-key-only';
  let posts = 0, gets = 0;
  global.fetch = async (url, options) => {
    if (options?.method === 'POST') { posts++; return { ok: true, json: async () => ({ data: [{ url: 'https://image.example.com/result.png' }] }) }; }
    gets++; if (gets === 1) throw Error('download interrupted');
    return { ok: true, arrayBuffer: async () => Buffer.from([137,80,78,71]) };
  };
  const options = { directory: path.join(folder, 'attempt'), prompt: 'generic prompt', references: [reference], submit: true };
  try {
    await assert.rejects(generate(options), /download interrupted/);
    const r = await generate(options); assert.equal(r.outputs.length, 1); assert.equal(posts, 1); assert.equal(gets, 2);
    await generate(options); assert.equal(posts, 1); assert.equal(gets, 2);
    assert.equal(fs.readFileSync(path.join(options.directory,'request-meta.json'),'utf8').includes('test-key-only'), false);
    await assert.rejects(generate({ ...options, prompt: 'changed' }), /Inputs changed/);
  } finally { global.fetch = fetchBefore; if (keyBefore === undefined) delete process.env.ARK_API_KEY; else process.env.ARK_API_KEY = keyBefore; fs.rmSync(folder,{recursive:true,force:true}); }
});
test('ambiguous POST failure requires inspection instead of silently generating twice', async () => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pet-uncertain-')), reference=path.join(folder,'ref.png'); fs.writeFileSync(reference,Buffer.from([137,80]));
  const before=global.fetch, keyBefore=process.env.ARK_API_KEY; process.env.ARK_API_KEY='test-key-only'; let calls=0;
  global.fetch=async()=>{calls++;throw Error('connection closed');};
  const options={directory:path.join(folder,'attempt'),prompt:'same',references:[reference],submit:true};
  try { await assert.rejects(generate(options),/connection closed/);await assert.rejects(generate(options),/Previous request/);assert.equal(calls,1); }
  finally { global.fetch=before;if(keyBefore===undefined)delete process.env.ARK_API_KEY;else process.env.ARK_API_KEY=keyBefore;fs.rmSync(folder,{recursive:true,force:true}); }
});
test('Pro omits unsupported sequence parameters and never silently changes the requested model',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pet-pro-'));
  const before=global.fetch,keyBefore=process.env.ARK_API_KEY;process.env.ARK_API_KEY='test-key-only';
  const bodies=[];
  global.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({data:[{b64_json:Buffer.from([137,80]).toString('base64')}]})};};
  try {
    const model='doubao-seedream-5-0-pro-260628';
    await generate({directory:path.join(folder,'pro'),prompt:'test',references:[],submit:true});
    assert.equal(bodies[0].model,model);
    assert.equal('sequential_image_generation' in bodies[0],false);
    assert.equal('sequential_image_generation_options' in bodies[0],false);
    await assert.rejects(generate({directory:path.join(folder,'multi'),prompt:'test',references:[],model,maxImages:4,submit:true}),/one output/);
    assert.equal(bodies.length,1);
    await generate({directory:path.join(folder,'lite'),prompt:'test',references:[],model:'doubao-seedream-5-0-260128',submit:true});
    assert.equal(bodies[1].sequential_image_generation,'disabled');
  }finally{global.fetch=before;if(keyBefore===undefined)delete process.env.ARK_API_KEY;else process.env.ARK_API_KEY=keyBefore;fs.rmSync(folder,{recursive:true,force:true});}
});
test('visual review cannot pass with issues or malformed output',()=>{
  assert.equal(parse('{"approved":true,"issues":["missing feet"],"summary":"clipped"}').approved,false);
  assert.equal(parse('{"approved":true,"issues":[],"summary":"all present"}').approved,true);
  assert.throws(()=>parse('{"approved":"yes","issues":[],"summary":""}'));
  assert.throws(()=>parse('plain text'));
});
test('review fingerprint changes when the source, target or evaluation model changes',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pet-review-bound-'));
  const reference=path.join(folder,'reference.png'), target=path.join(folder,'target.png');
  fs.writeFileSync(reference,Buffer.from([137,80,1]));fs.writeFileSync(target,Buffer.from([137,80,2]));
  try {
    const options={type:'actions',references:[reference,target],model:'review-model'};
    const first=request(options);
    assert.equal(first.body.input[0].content.filter(c=>c.type==='input_image').length,2);
    fs.writeFileSync(target,Buffer.from([137,80,3]));assert.notEqual(request(options).hash,first.hash);
    fs.writeFileSync(target,Buffer.from([137,80,2]));fs.writeFileSync(reference,Buffer.from([137,80,4]));assert.notEqual(request(options).hash,first.hash);
    assert.notEqual(request({...options,model:'other-model'}).hash,request(options).hash);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
