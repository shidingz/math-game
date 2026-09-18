'use strict';
// Deterministic reference board; no model describes or selects these images.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {bounds}=require('./pet-matte.cjs');
const root=path.resolve(__dirname,'..');
function sources(character){
 if(!['siamese','samoyed'].includes(character))throw Error('Unknown built-in style reference');
 return [1,2,3].map(n=>path.join(root,`characters/${character}/assets/stage-${n}-idle.png`));
}
function fingerprint(character){return sources(character).map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));}
async function build(character,out){
 const layers=[];
 for(const [i,file] of sources(character).entries()){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=bounds(data,info.width,info.height),scale=Math.min(760/b.width,760/b.height),w=Math.round(b.width*scale),h=Math.round(b.height*scale);
  layers.push({input:await sharp(file).extract({left:b.x,top:b.y,width:b.width,height:b.height}).resize(w,h).png().toBuffer(),left:i*1024+Math.round((1024-w)/2),top:896-h});
 }
 await sharp({create:{width:3072,height:1024,channels:4,background:'#00000000'}}).composite(layers).png().toFile(out);
}
module.exports={build,fingerprint};
