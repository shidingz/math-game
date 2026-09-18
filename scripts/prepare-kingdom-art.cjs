'use strict';
// Offline, deterministic packing of the fixed 7-sheet art library. Not a pet-photo cutter.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const CATALOG=require('../assets/kingdom-elements/catalog.json').elements;
const GROUPS=[...new Set(CATALOG.map(e=>e.group))].map(g=>[g]);
function splits(raw,axis,count,region){
 const {data,info}=raw,length=axis==='x'?region.width:region.height,cross=axis==='x'?region.height:region.width,cuts=[0];
 for(let n=1;n<count;n++){
  const nominal=length*n/count,radius=length/count*.15;let best={score:Infinity,cut:Math.round(nominal)};
  for(let p=Math.floor(nominal-radius);p<=Math.ceil(nominal+radius);p++){
   let occupied=0;for(let q=0;q<cross;q++){const x=region.left+(axis==='x'?p:q),y=region.top+(axis==='y'?p:q);if(data[(y*info.width+x)*4+3]>110)occupied++;}
   const score=occupied/cross+Math.abs(p-nominal)/(length/count)*.006;
   if(score<best.score)best={score,cut:p};
  }
  cuts.push(best.cut);
 }
 cuts.push(length);return cuts;
}
async function matte(input,group){
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const real=await sharp(input).metadata();if(real.hasAlpha)return {data,info,mode:'preserve-alpha'};
 const white=group==='nature'||group==='landmarks',low=white?179:126,high=white?255:224;
 let neutral=0,total=0;
 for(let y=0;y<12;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,a=[data[i],data[i+1],data[i+2]],lo=Math.min(...a),hi=Math.max(...a);total++;if(hi-lo<10&&lo>=low&&hi<=high)neutral++;}
 if(neutral/total<.60)throw Error('Atlas has neither alpha nor the expected neutral checkerboard: '+group);
 let nearby;
 if(white){
  // White checker squares cannot be keyed globally: crystal facets and flower
  // petals can be white too. Find alternating neutral texture first.
  const w=info.width,h=info.height,stride=w+1,n=(w+1)*(h+1),s=new Float64Array(n),ss=new Float64Array(n),count=new Uint32Array(n);
  for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
   const p=((y-1)*w+x-1)*4,v=(data[p]+data[p+1]+data[p+2])/3,hi=Math.max(data[p],data[p+1],data[p+2]),lo=Math.min(data[p],data[p+1],data[p+2]),a=hi-lo<=8&&v>=low,j=y*stride+x;
   s[j]=(a?v:0)+s[j-1]+s[j-stride]-s[j-stride-1];ss[j]=(a?v*v:0)+ss[j-1]+ss[j-stride]-ss[j-stride-1];count[j]=a+count[j-1]+count[j-stride]-count[j-stride-1];
  }
  const sum=(a,x,y,r)=>{const l=Math.max(0,x-r),t=Math.max(0,y-r),rr=Math.min(w,x+r+1),bb=Math.min(h,y+r+1);return[a[bb*stride+rr]-a[t*stride+rr]-a[bb*stride+l]+a[t*stride+l],(rr-l)*(bb-t)];};
  const seed=new Uint32Array(n);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const [c,area]=sum(count,x,y,7),[v]=sum(s,x,y,7),[square]=sum(ss,x,y,7),mean=c?v/c:0,variance=c?square/c-mean*mean:0;
   const yes=c/area>.82&&variance>160&&mean<244&&mean>184,j=(y+1)*stride+x+1;seed[j]=yes+seed[j-1]+seed[j-stride]-seed[j-stride-1];
  }
  nearby=(x,y)=>sum(seed,x,y,5)[0]>0;
 }
 for(let i=0;i<data.length;i+=4){
  const lo=Math.min(data[i],data[i+1],data[i+2]),hi=Math.max(data[i],data[i+1],data[i+2]),spread=hi-lo,mid=(lo+hi)/2;
  if(mid<low||mid>high||(nearby&&!nearby((i/4)%info.width,Math.floor(i/4/info.width))))continue;
  // This known checker has a neutral grey band. Preserve bright white VFX cores
  // and chromatic stone/leaf highlights; soften the contaminated boundary.
  const a=spread<=8?0:spread<24?Math.round((spread-8)/16*255):255;
  data[i+3]=Math.min(data[i+3],a);
 }
 return {data,info,mode:white?'local-neutral-checker-v2':'neutral-checker-band-v1'};
}
(async()=>{
 const job=path.resolve(process.argv[2]||'artifacts/kingdom-elements-20260918'),sources=JSON.parse(fs.readFileSync(path.join(job,'sources.json'))),dest=path.resolve('assets/kingdom-elements');fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(path.join(job,'originals'),{recursive:true});
 const report={version:1,generator:'built-in imagegen',elements:56,sheets:[],limits:['Checkerboard recovery is a rule-based matte of this prebuilt library, not guaranteed arbitrary-image matting.']};
 for(const [group]of GROUPS){
  const source=sources[group];fs.copyFileSync(source,path.join(job,'originals',group+'.png'));
  const m=await sharp(source).metadata(),raw=group==='skies'?null:await matte(source,group),parts=[];
  const rows=raw?splits(raw,'y',2,{left:0,top:0,width:m.width,height:m.height}):[0,Math.round(m.height/2),m.height],rectangles=[];
  const columns=rows.slice(0,2).map((top,row)=>raw?splits(raw,'x',4,{left:0,top,width:m.width,height:rows[row+1]-top}):[0,1,2,3,4].map(x=>Math.round(x*m.width/4)));
  for(let i=0;i<8;i++){
   const row=Math.floor(i/4),col=i%4,left=columns[row][col],top=rows[row],right=columns[row][col+1],bottom=rows[row+1];rectangles.push({left,top,width:right-left,height:bottom-top});
   let im=raw?sharp(raw.data,{raw:raw.info}):sharp(source);
   im=im.extract({left,top,width:right-left,height:bottom-top});
   const buf=await im.resize(256,256,{fit:'fill'}).png().toBuffer();parts.push({input:buf,left:i%4*256,top:Math.floor(i/4)*256});
  }
  const output=await sharp({create:{width:1024,height:512,channels:4,background:'#00000000'}}).composite(parts).png().toBuffer();fs.writeFileSync(path.join(dest,group+'.png'),output);
  const stats=await sharp(output).stats();report.sheets.push({group,sourceSize:[m.width,m.height],outputSize:[1024,512],sourceAlpha:m.hasAlpha,matte:raw?.mode||'opaque',rows,columns,rectangles,alphaMin:stats.channels[3].min,alphaMax:stats.channels[3].max,sha256:crypto.createHash('sha256').update(output).digest('hex')});
 }
 fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify({version:'kingdom-kit-v1',columns:4,rows:2,cell:256,elements:CATALOG},null,2)+'\n');
 fs.writeFileSync(path.join(job,'packing-report.json'),JSON.stringify(report,null,2)+'\n');console.log('Packed 56 elements in 7 atlases.');
})().catch(e=>{console.error(e);process.exitCode=1;});
