'use strict';
// Pre-tint shared Alpha masks once during build. No per-frame offscreen Canvas.
const fs=require('fs'),path=require('path'),sharp=require('sharp');
// Historical particle preview only; current game uses website-style vector motifs.
const ROOT='particle-art/flow-v2',HUES=[0,45,90,135,180,225,270,315],CELL=64;
const {GROUPS}=require('../wechat/runtime/particle-effects');
function rgb(h){const x=1-Math.abs((h/60)%2-1),v=h<60?[1,x,0]:h<120?[x,1,0]:h<180?[0,1,x]:h<240?[0,x,1]:h<300?[x,0,1]:[1,0,x];return v.map(n=>Math.round(255*(.12+.88*n)));}
module.exports=async function(write){
 const parts=[];
 for(const [row,[group]]of GROUPS.entries())for(let index=0;index<8;index++){
  const input=await sharp(path.join(__dirname,'../assets/particle-effects',group+'.png')).extract({left:index%4*256,top:Math.floor(index/4)*256,width:256,height:256}).resize(CELL,CELL).toBuffer();
  parts.push({input,left:index*CELL,top:row*CELL});
 }
 const {data,info}=await sharp({create:{width:CELL*8,height:CELL*4,channels:4,background:'#00000000'}}).composite(parts).raw().toBuffer({resolveWithObject:true}),files=[];
 for(const hue of HUES){const color=rgb(hue),pixels=Buffer.from(data);
  for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3]/255,white=.10+.35*a**.8;for(let c=0;c<3;c++)pixels[i+c]=Math.round(color[c]+(255-color[c])*white);pixels[i+3]=Math.round(255*a**.72);}
  const output=await sharp(pixels,{raw:info}).png({palette:true,colours:64,dither:0,effort:10}).toBuffer(),dest=ROOT+'/hue-'+hue+'.png';write(dest,output);files.push(dest);
 }return files;
};
