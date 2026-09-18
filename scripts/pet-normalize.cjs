'use strict';
const sharp=require('sharp');
const {CONTRACT}=require('./pet-gpt-prompts.cjs');
async function normalize(file,kind){
 if(!['design','sheet'].includes(kind))throw Error('Unknown artwork kind');
 const meta=await sharp(file).metadata(),target=CONTRACT[kind],rule=CONTRACT.normalization,min=kind==='design'?rule.minDesignWidth:rule.minSheetWidth;
 if(meta.format!=='png'||meta.width<min||Math.max(meta.width,meta.height)>rule.maxEdge)throw Error('Image format/resolution outside contract');
 if(meta.width*target.height!==meta.height*target.width)throw Error('Wrong aspect ratio; uniform normalization cannot fix layout');
 const bytes=await sharp(file).resize(target.width,target.height,{fit:'fill'}).png().toBuffer();
 return {bytes,record:{source:{width:meta.width,height:meta.height},target:{width:target.width,height:target.height},method:rule.method,scale:target.width/meta.width}};
}
module.exports={normalize};
