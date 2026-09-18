'use strict';
const fs=require('node:fs'),sharp=require('sharp');
global.fetch=async(url,options)=>{
 if(process.env.FANTASY_BLOCK_NETWORK==='1')throw Error('Network must not be used on resume');
 if(options.method==='POST'){
  const size=options.body.get('size'),prompt=options.body.get('prompt'),stage=prompt.match(/第([123])阶段伙伴/),guidedStage=prompt.match(/图2是第([123])阶段唯一身份定稿/);
  const id=size==='3072x1024'?'design':'stage'+(stage||guidedStage)[1];
  fs.appendFileSync(process.env.FANTASY_TEST_LOG,JSON.stringify({id,size,refs:options.body.getAll('image[]').length})+'\n');return Response.json({task_id:id});
 }
 const id=new URL(url).searchParams.get('task_id');if(id===process.env.FANTASY_PENDING)return Response.json({err:'result pending'});
 const design=id==='design',width=design?3072:1536,height=design?1024:1536,layers=[],guided=process.env.FANTASY_GUIDED==='1';
 if(guided){
  const guide=require('../../scripts/pet-layout-guide.cjs'),kind=design?'design':'sheet',key='green',base=await guide.template(kind,key),s=guide.LAYOUT[kind];
  for(let i=0;i<(design?3:9);i++){
   const r=guide.windows(kind)[i],w=design?Math.min(260+i*90,r.width-16):130,h=design?Math.min(340+i*100,r.height-16):(i===6?110:280);
   layers.push({input:await sharp({create:{width:w,height:h,channels:4,background:'#d5702f'}}).png().toBuffer(),left:r.left+Math.floor((r.width-w)/2),top:r.top+Math.floor((r.height-h)/2)});
  }
  const bytes=await sharp(base).composite(layers).png().toBuffer();return Response.json({status_code:200,err:'',data:{data:[{b64_json:bytes.toString('base64')}],size:width+'x'+height}});
 }
 for(let i=0;i<(design?3:9);i++){
  const cell=design?1024:512,w=design?260:130,h=design?600:i===6?110:280;
  layers.push({input:await sharp({create:{width:w,height:h,channels:4,background:'#d5702f'}}).png().toBuffer(),left:i%(design?3:3)*cell+Math.floor((cell-w)/2),top:Math.floor(i/3)*cell+(design?850:448)-h});
 }
 const bytes=await sharp({create:{width,height,channels:4,background:design?'#ffffff':'#00ff00'}}).composite(layers).png().toBuffer();
 return Response.json({status_code:200,err:'',data:{data:[{b64_json:bytes.toString('base64')}],size:width+'x'+height}});
};
