'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {CONTRACT,design,actions}=require('../../scripts/pet-gpt-prompts.cjs'),{stage}=require('../../scripts/pet-fantasy-assemble.cjs'),Presets=require('../../wechat/runtime/pet-presets');
test('fixed contract handles tall, wide, winged and sleeping silhouettes without changing cut lines or per-pose scale',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-contract-'));
 try{
  for(const [key,bg,fg] of [['green','#00ff00','#d87932'],['blue','#0000ff','#2dcc48']]){
   const sizes=[[90,360],[90,360],[370,200],[180,320],[230,200],[160,260],[310,80],[360,140],[400,330]],layers=[];
   for(let i=0;i<9;i++){const [width,height]=sizes[i];layers.push({input:await sharp({create:{width,height,channels:4,background:fg}}).png().toBuffer(),left:i%3*512+Math.floor((512-width)/2),top:Math.floor(i/3)*512+448-height});}
   const file=path.join(dir,key+'.png');await sharp({create:{width:1536,height:1536,channels:4,background:bg}}).composite(layers).png().toFile(file);
   const a=await stage(file,path.join(dir,key),key),b=await stage(file,path.join(dir,key+'-repeat'),key);assert.deepEqual(fs.readFileSync(a.atlas),fs.readFileSync(b.atlas));
   assert.ok(a.boxes[6].height<a.boxes[0].height/3);for(let i=0;i<9;i++){assert.equal(a.boxes[i].y+a.boxes[i].height,448);assert.ok(Math.abs(a.boxes[i].width/sizes[i][0]-a.scale)<.015);}
  }
  const wrong=path.join(dir,'wrong.png');await sharp({create:{width:1024,height:768,channels:4,background:'#fff'}}).png().toFile(wrong);await assert.rejects(stage(wrong,path.join(dir,'bad'),'green'),/aspect ratio/);
  const blank=path.join(dir,'blank.png');await sharp({create:{width:1536,height:1536,channels:4,background:'#00ff00'}}).png().toFile(blank);await assert.rejects(stage(blank,path.join(dir,'empty'),'green'),/Empty/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('uniform normalization accepts any matching aspect above minimum resolution and rejects other ratios or tiny inputs',async()=>{
 const {normalize}=require('../../scripts/pet-normalize.cjs');
 for(const [kind,width,height,expected] of [['design',2172,724,3072],['design',3072,1024,3072],['sheet',1024,1024,1536],['sheet',2048,2048,1536]]){
  const png=await sharp({create:{width,height,channels:4,background:'#fff'}}).png().toBuffer(),r=await normalize(png,kind),m=await sharp(r.bytes).metadata();assert.equal(m.width,expected);assert.equal(r.record.scale,expected/width);
 }
 const tiny=await sharp({create:{width:512,height:512,channels:4,background:'#fff'}}).png().toBuffer();await assert.rejects(normalize(tiny,'sheet'),/resolution/);
});
test('colour matching uses opaque subject hues, ignores transparent pixels, handles neutral subjects and validates safe data',()=>{
 for(const rgb of [[225,103,31],[34,99,220],[45,184,70],[244,244,244],[10,10,10]]){
  const pixels=Uint8Array.from([...Array(100).fill([...rgb,255]).flat(),...Array(100).fill([0,255,0,0]).flat()]),s=Presets.matchPixels(pixels);
  assert.equal(s.version,2);assert.deepEqual(Presets.matchPixels(pixels),s);assert.deepEqual(Presets.compile(JSON.parse(JSON.stringify(s))),Presets.compile(s));
  assert.throws(()=>Presets.validate({...s,colors:{...s.colors,primary:'url(evil)'}}));
 }
 const make=rgb=>Presets.matchPixels(Uint8Array.from(Array(100).fill([...rgb,255]).flat()));assert.ok(make([225,103,31]).match.hue<50);assert.ok(make([34,99,220]).match.hue>200);assert.notDeepEqual(make([225,103,31]).colors,make([34,99,220]).colors);assert.equal(make([240,240,240]).match.neutral,true);
 assert.equal(CONTRACT.sheet.cell,512);assert.match(design(2),/任意年龄/);assert.match(actions(3,'blue'),/#0000FF/);assert.match(actions(3),/不要求碗/);
});
