'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {cutout}=require('./pet-matte.cjs'),{atomic}=require('./seedream-client.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function stage(file,out,spec){
  const meta=await sharp(file).metadata();
  if(meta.width!==1536||meta.height!==1536||spec.rects.length!==9)throw Error('Expected exact 1536×1536 template sheet');
  const layers=[],boxes=[],metrics=[];fs.mkdirSync(path.join(out,'frames'),{recursive:true});
  for(let i=0;i<9;i++){
    const raw=await sharp(file).extract({left:i%3*512,top:Math.floor(i/3)*512,width:512,height:512}).png().toBuffer();
    const part=await cutout(raw,{key:'green'}),target=spec.rects[i];
    const scale=Math.min(target.width/part.box.width,target.height/part.box.height),width=Math.round(part.box.width*scale),height=Math.round(part.box.height*scale);
    const x=Math.round(target.x+(target.width-width)/2),y=target.y+target.height-height;
    const input=await sharp(part.png).extract({left:part.box.x,top:part.box.y,width:part.box.width,height:part.box.height}).resize(width,height).png().toBuffer();
    const frame=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input,left:x,top:y}]).png().toBuffer();
    fs.writeFileSync(path.join(out,'frames',i+'.png'),frame);layers.push({input:frame,left:i%3*512,top:Math.floor(i/3)*512});
    boxes.push({x,y,width,height});metrics.push({source:part.metrics,target,output:{x,y,width,height},method:'fixed-cell-contain-bottom'});
  }
  const atlas=path.join(out,'atlas.png');await sharp({create:{width:1536,height:1536,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:192,effort:7}).toFile(atlas);
  return {atlas,boxes,metrics};
}
async function assemble({directory,id,name,selection}){
  const ref=JSON.parse(fs.readFileSync(path.join(directory,'reference-kit/manifest.json'))),out=path.join(directory,'candidate');fs.mkdirSync(out,{recursive:true});
  if(!require('../wechat/runtime/custom-pets').ID.test(id)||!name||name.length>13)throw Error('Invalid pet ID/name');
  const sources={};for(const step of ['design','stage1','stage2','stage3']){
    if(!new RegExp('^'+step+'(?:-attempt-[12])?/image-1\\.png$').test(selection[step]))throw Error('Unexpected selected source');
    sources[step]={file:selection[step],sha256:hash(path.join(directory,selection[step]))};
  }
  const pack={schemaVersion:1,id,name,trial:true,layout:'template-v1',cellSize:512,stages:[],portrait:'portrait.png',procedural:require('../wechat/runtime/pet-presets').choose(id)};
  const geometry={};
  for(let n=1;n<=3;n++){
    const r=await stage(path.join(directory,selection['stage'+n]),path.join(directory,'processed','stage'+n),ref.files['stage'+n]);
    const image=`stage-${n}.png`;fs.copyFileSync(r.atlas,path.join(out,image));pack.stages.push({image,name:['初始伙伴','觉醒伙伴','守护伙伴'][n-1],bounds:r.boxes});geometry['stage'+n]=r.metrics;
    await sharp(path.join(directory,'processed','stage'+n,'frames/0.png')).resize(160,160).png().toFile(path.join(out,`portrait-${n}.png`));
  }
  fs.copyFileSync(path.join(out,'portrait-1.png'),path.join(out,'portrait.png'));
  pack.revision=crypto.createHash('sha256').update(JSON.stringify({sources,procedural:pack.procedural})).digest('hex').slice(0,16);
  const conversion={status:'ready',method:'fixed-siamese-template-v1',aiCalls:0,stages:3,posesPerStage:9,anchor:{x:256,y:448},procedural:['scene','15-level-effects','evolution','food-icon']};
  const report={version:1,status:'needs-visual-review',conversion,sources,geometry,files:Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(f=>[f,hash(path.join(out,f))])),notes:['Geometry and deterministic conversion only; no AI post-processing or semantic assessment.']};
  const modelRequests=fs.readdirSync(directory).filter(f=>fs.existsSync(path.join(directory,f,'status.json'))).length;
  report.modelRequests=modelRequests;
  atomic(path.join(out,'pet.json'),pack);atomic(path.join(out,'quality.json'),report);atomic(path.join(out,'catalog.json'),['pet.json']);
  atomic(path.join(directory,'pipeline-status.json'),{state:'ready-for-test',conversion,modelRequests});
  console.log('Rule-only template package: '+out);return report;
}
module.exports={stage,assemble};
if(require.main===module){const args=process.argv.slice(2),get=n=>args[args.indexOf(n)+1],directory=path.resolve(get('--in'));assemble({directory,id:get('--id'),name:get('--name'),selection:JSON.parse(fs.readFileSync(path.join(directory,'selection.json')))}).catch(e=>{console.error(e);process.exitCode=1;});}
