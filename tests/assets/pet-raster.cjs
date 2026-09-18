// Optional sharp tests; ordinary npm test remains dependency-free.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {cutout,atlas}=require('../../scripts/pet-matte.cjs');
const {choose}=require('../../scripts/pet-chroma.cjs');
async function sheet({clipped=false}={}) {
  const layers=[];
  for(let n=0;n<9;n++) {
    const width=n===6?100:50,height=n===6?30:100;
    const input=await sharp({create:{width,height,channels:4,background:'#dfddcf'}}).png().toBuffer();
    layers.push({input,left:n%3*160+(clipped&&n===0?0:Math.round((160-width)/2)),top:Math.floor(n/3)*160+140-height});
  }
  return sharp({create:{width:480,height:480,channels:4,background:'#00FF00'}}).composite(layers).png().toBuffer();
}
test('solid green subject survives a blue matte and selection avoids green',async()=>{
  const subject=await sharp({create:{width:60,height:60,channels:4,background:'#00FF00'}}).png().toBuffer();
  assert.notEqual(await choose([subject]),'green');
  const input=await sharp({create:{width:100,height:100,channels:4,background:'#0000FF'}}).composite([{input:subject,left:20,top:20}]).png().toBuffer();
  const r=await cutout(input,{key:'blue'});
  assert.equal(r.data[(50*100+50)*4+3],255);
  assert.equal(r.data[(50*100+50)*4+1],255);
  assert.equal(r.data[3],0);
});
test('chroma extraction preserves opaque interior colours that do not reach the key threshold',async()=>{
  const subject=await sharp({create:{width:60,height:60,channels:4,background:'#994bbb'}}).png().toBuffer();
  const input=await sharp({create:{width:100,height:100,channels:4,background:'#0000ff'}}).composite([{input:subject,left:20,top:20}]).png().toBuffer();
  const r=await cutout(input,{key:'blue'}),i=(50*100+50)*4;assert.deepEqual(Array.from(r.data.slice(i,i+4)),[153,75,187,255]);
});
test('edge-connected cyan-blue background is removed without deleting a desaturated interior detail',async()=>{
  const subject=await sharp({create:{width:60,height:60,channels:4,background:'#eeeeee'}}).composite([{input:await sharp({create:{width:10,height:10,channels:4,background:'#7d96b4'}}).png().toBuffer(),left:25,top:25}]).png().toBuffer();
  const input=await sharp({create:{width:100,height:100,channels:4,background:'#078fdd'}}).composite([{input:subject,left:20,top:20}]).png().toBuffer();
  const r=await cutout(input,{key:'blue'});
  assert.equal(r.metrics.clearBorderFraction,1);
  assert.equal(r.data[3],0);
  assert.ok(r.data[(50*100+50)*4+3]>200);
  assert.deepEqual([r.box.x,r.box.y,r.box.width,r.box.height],[20,20,60,60]);
});
test('assembled sleeping pose uses the same scale and foot anchor as standing',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pet-raster-'));
  try {
    const r=await atlas(await sheet(),out);
    assert.equal(r.boxes.length,9);
    assert.equal(r.boxes[6].height/r.boxes[0].height,.3);
    for(const b of r.boxes) {assert.equal(b.y+b.height,470);assert.ok(b.x>=30);}
    const info=await sharp(r.file).metadata();assert.equal(info.width,1536);assert.equal(info.height,1536);assert.equal(info.hasAlpha,true);
  }finally{fs.rmSync(out,{recursive:true,force:true});}
});
test('opaque backgrounds and edge-clipped bodies are rejected instead of silently packed',async()=>{
  const opaque=await sharp({create:{width:100,height:100,channels:4,background:'#ffffff'}}).png().toBuffer();
  await assert.rejects(cutout(opaque),/gate failed/);
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pet-reject-'));
  try{await assert.rejects(atlas(await sheet({clipped:true}),out),/grid:|boundary/);}finally{fs.rmSync(out,{recursive:true,force:true});}
});
