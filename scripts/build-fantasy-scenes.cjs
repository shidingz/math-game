'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {VERSION,THEMES}=require('../wechat/runtime/fantasy-scenes');
module.exports=async function(write){
 const source=path.join(__dirname,'../assets/fantasy-scenes'),files=[];
 const halo=await sharp(path.join(source,'halo.png')).metadata();
 if(!halo.hasAlpha)throw Error('Shared VFX must have a true alpha channel');
 const stats=await sharp(path.join(source,'halo.png')).stats();
 if(stats.channels[3].min!==0||stats.channels[3].max<128)throw Error('Invalid shared VFX transparency');
 for(const theme of THEMES){
  const base=`shared-art/${VERSION}/${theme.id}`;
  const scene=await sharp(path.join(source,theme.id+'.png')).resize(768,768).jpeg({quality:80,mozjpeg:true}).toBuffer();
  const effect=await sharp(path.join(source,'halo.png')).resize(512,512).tint(theme.tint).png({palette:true,colours:128,effort:8}).toBuffer();
  write(base+'.jpg',scene);write(base+'-halo.png',effect);files.push(base+'.jpg',base+'-halo.png');
 }
 return files;
};
