'use strict';
const path=require('node:path'),sharp=require('sharp');
const {ROOT,GROUPS}=require('../wechat/runtime/kingdom-scenes');
module.exports=async function(write){
 const dir=path.join(__dirname,'../assets/toy-worlds'),files=[];
 for(const [group]of GROUPS){
  const source=path.join(dir,group+'.png'),image=sharp(source),meta=await image.metadata(),scene=['skies','places'].includes(group);
  if(meta.width%4||meta.height%2||meta.width/4!==meta.height/2)throw Error('Invalid square-cell atlas: '+group);
  if(scene&&meta.width/4<400)throw Error('Background must retain native detail (at least 400px per cell): '+group);
  if(!scene&&(meta.width!==1024||meta.height!==512))throw Error('Invalid normalized prop atlas: '+group);
  const dest=ROOT+'/'+group+(scene?'.jpg':'.png');let bytes;
  if(scene)bytes=await image.removeAlpha().jpeg({quality:78,mozjpeg:true,chromaSubsampling:'4:2:0'}).toBuffer();
  else{const stats=await image.stats();if(!meta.hasAlpha||stats.channels[3].min!==0)throw Error('Missing alpha: '+group);const cell=group==='living'?160:224;bytes=await image.resize(cell*4,cell*2).png({palette:true,colours:96,effort:10,dither:0}).toBuffer();}
  write(dest,bytes);files.push(dest);
 }
 return files;
};
