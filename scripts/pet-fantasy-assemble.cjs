'use strict';
// The same fixed converter handles every species. No case-specific overrides.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {CONTRACT}=require('./pet-gpt-prompts.cjs'),{cutout}=require('./pet-matte.cjs'),{atomic}=require('./seedream-client.cjs');
const Presets=require('../wechat/runtime/pet-presets');
const {normalize}=require('./pet-normalize.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function stage(file,out,key){
 const normalized=await normalize(file,'sheet');
 const parts=[];for(let i=0;i<9;i++){
  const raw=await sharp(normalized.bytes).extract({left:i%3*512,top:Math.floor(i/3)*512,width:512,height:512}).png().toBuffer();
  try{parts.push(await cutout(raw,{key}));}catch(e){throw Error(`Cell ${i+1}: ${e.message}`);}
 }
 const scale=Math.min(CONTRACT.target.width/Math.max(...parts.map(p=>p.box.width)),CONTRACT.target.height/Math.max(...parts.map(p=>p.box.height)));
 const layers=[],boxes=[];fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 for(let i=0;i<9;i++){
  const p=parts[i],w=Math.round(p.box.width*scale),h=Math.round(p.box.height*scale),x=Math.round((512-w)/2),y=448-h;
  const input=await sharp(p.png).extract({left:p.box.x,top:p.box.y,width:p.box.width,height:p.box.height}).resize(w,h).png().toBuffer();
  const frame=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input,left:x,top:y}]).png().toBuffer();
  fs.writeFileSync(path.join(out,'frames',i+'.png'),frame);layers.push({input:frame,left:i%3*512,top:Math.floor(i/3)*512});boxes.push({x,y,width:w,height:h});
 }
 const atlas=path.join(out,'atlas.png');await sharp({create:{width:1536,height:1536,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:256,effort:7}).toFile(atlas);
 return {atlas,boxes,scale,normalization:normalized.record,metrics:parts.map(p=>p.metrics)};
}
async function assemble({directory,id,name,designFile,actionFiles}){
 const spec=JSON.parse(fs.readFileSync(path.join(directory,'contract.json')));
 if(JSON.stringify(spec.contract)!==JSON.stringify(CONTRACT)||!['green','blue','red'].includes(spec.key))throw Error('Contract changed; do not adapt rules to generated images');
 if(!require('../wechat/runtime/custom-pets').ID.test(id)||!name?.trim()||name.length>13)throw Error('Invalid pet ID/name');
 designFile=designFile||path.join(directory,'design/image-1.png');
 actionFiles=actionFiles||[1,2,3].map(n=>path.join(directory,`stage${n}/image-1.png`));
 if(actionFiles.length!==3)throw Error('Three action files required');
 const design=await normalize(designFile,'design');
 const out=path.join(directory,'candidate');fs.mkdirSync(out,{recursive:true});
 const pack={schemaVersion:1,id,name,trial:true,layout:'template-v1',cellSize:512,stages:[],portrait:'portrait.png'},geometry={},samples=[],sources={};
 for(let n=1;n<=3;n++){
  const file=actionFiles[n-1],processed=path.join(directory,'processed','stage'+n),r=await stage(file,processed,spec.key);
  fs.copyFileSync(r.atlas,path.join(out,`stage-${n}.png`));pack.stages.push({image:`stage-${n}.png`,name:['初始伙伴','觉醒伙伴','守护伙伴'][n-1],bounds:r.boxes});geometry['stage'+n]={normalization:r.normalization,scale:r.scale,metrics:r.metrics};sources['stage'+n]=hash(file);
  const idle=path.join(processed,'frames/0.png');await sharp(idle).resize(160,160).png().toFile(path.join(out,`portrait-${n}.png`));
  samples.push((await sharp(idle).resize(96,96).ensureAlpha().raw().toBuffer()).values());
 }
 pack.procedural=Presets.matchPixels(Uint8Array.from(samples.flatMap(s=>Array.from(s))));
 sources.design=hash(designFile);
 pack.revision=crypto.createHash('sha256').update(JSON.stringify({sources,spec,procedural:pack.procedural})).digest('hex').slice(0,16);
 fs.copyFileSync(path.join(out,'portrait-1.png'),path.join(out,'portrait.png'));
 atomic(path.join(out,'pet.json'),pack);atomic(path.join(out,'catalog.json'),['pet.json']);
 const report={status:'needs-visual-review',conversion:{format:CONTRACT.format,aiCalls:0,stages:3,poses:27,key:spec.key,uniformScalePerStage:true,designNormalization:design.record},sources,geometry,procedural:pack.procedural,files:Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(f=>[f,hash(path.join(out,f))]))};
 atomic(path.join(out,'quality.json'),report);return report;
}
module.exports={stage,assemble};
if(require.main===module){const args=process.argv.slice(2),get=n=>args[args.indexOf(n)+1];assemble({directory:path.resolve(get('--in')),id:get('--id'),name:get('--name')}).then(()=>console.log('Fixed fantasy-grid-v2 package ready')).catch(e=>{console.error(e);process.exitCode=1;});}
