'use strict';
// Offline, deterministic packing of the fixed 7-sheet art library. Not a pet-photo cutter.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const {GROUPS,CATALOG}=require('../wechat/runtime/kingdom-scenes');
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
 const meta=await sharp(input).metadata(),stats=await sharp(input).stats();
 if(meta.hasAlpha&&stats.channels[3].min===0)return {data,info,mode:'preserve-alpha'};
 // This offline art job explicitly requests a magenta fallback. Never apply this
 // key to user photos or infer arbitrary semantic masks.
 let count=0,total=0;
 for(let y=0;y<8;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4;total++;if(data[i]>220&&data[i+1]<35&&data[i+2]>220)count++;
 }
 if(count/total<.6)throw Error('Expected true Alpha or specified magenta backing: '+group);
 const original=Buffer.from(data),distances=new Float32Array(info.width*info.height);
 for(let n=0;n<distances.length;n++)distances[n]=Math.hypot(255-data[n*4],data[n*4+1],255-data[n*4+2]);
 let cleared=0,feathered=0;
 for(let n=0;n<distances.length;n++){
  const i=n*4,d=distances[n],r=original[i],g=original[i+1],b=original[i+2];
  if(d>=170||Math.min(r,b)-g<85)continue;
  if(d<24){data[i]=data[i+1]=data[i+2]=data[i+3]=0;cleared++;continue;}
  // Recover antialiasing from the nearest unpolluted foreground sample:
  // C = alpha F + (1-alpha) magenta. A generic saturation ramp would leave
  // green fringes by subtracting too much magenta from the edge colour.
  const x=n%info.width,y=Math.floor(n/info.width);let nearBacking=false;
  for(let dy=-3;dy<=3&&!nearBacking;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<info.width&&yy>=0&&yy<info.height&&distances[yy*info.width+xx]<24){nearBacking=true;break;}}
  if(!nearBacking)continue;
  let best=Infinity,sample=-1;
  for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){
   const xx=x+dx,yy=y+dy,dd=dx*dx+dy*dy;
   if(xx<0||xx>=info.width||yy<0||yy>=info.height||dd>=best)continue;
   const nn=yy*info.width+xx;if(distances[nn]>=190){sample=nn*4;best=dd;}
  }
  if(sample<0){data[i]=data[i+1]=data[i+2]=data[i+3]=0;cleared++;continue;}
  const f=[original[sample]-255,original[sample+1],original[sample+2]-255];
  const a=Math.max(0,Math.min(1,((r-255)*f[0]+g*f[1]+(b-255)*f[2])/(f[0]**2+f[1]**2+f[2]**2)));
  if(a<.06){data[i]=data[i+1]=data[i+2]=data[i+3]=0;cleared++;continue;}
  for(let c=0;c<3;c++)data[i+c]=original[sample+c];
  data[i+3]=Math.round(a*255);feathered++;
 }
 // Remove disconnected specks that are much smaller than any designed mote.
 const seen=new Uint8Array(distances.length),queue=new Int32Array(distances.length);
 for(let n=0;n<seen.length;n++){
  if(seen[n]||data[n*4+3]<20)continue;
  let head=0,tail=1;queue[0]=n;seen[n]=1;
  while(head<tail){const at=queue[head++],x=at%info.width,y=Math.floor(at/info.width);
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,yy=y+dy,nn=yy*info.width+xx;
    if(xx<0||xx>=info.width||yy<0||yy>=info.height||seen[nn]||data[nn*4+3]<20)continue;
    seen[nn]=1;queue[tail++]=nn;
   }
  }
  if(tail<40)for(let j=0;j<tail;j++)data[queue[j]*4+3]=0;
 }

 return {data,info,mode:'specified-magenta-local-edge-v2',cleared,feathered};
}
(async()=>{
 const job=path.resolve(process.argv[2]||'artifacts/toy-worlds-20260918'),sources=JSON.parse(fs.readFileSync(path.join(job,'sources.json'))),dest=path.resolve('assets/toy-worlds');fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(path.join(job,'originals'),{recursive:true});
 const report={version:1,generator:'built-in imagegen',elements:56,sheets:[],limits:['Magenta extraction is restricted to this prebuilt library with its specified key colour; it is not a user-photo processing algorithm.']};
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
  const stats=await sharp(output).stats();report.sheets.push({group,sourceSize:[m.width,m.height],outputSize:[1024,512],sourceAlpha:m.hasAlpha,matte:raw?.mode||'opaque',cleared:raw?.cleared,feathered:raw?.feathered,rows,columns,rectangles,alphaMin:stats.channels[3].min,alphaMax:stats.channels[3].max,sha256:crypto.createHash('sha256').update(output).digest('hex')});
 }
 fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify({version:'toy-worlds-v1',columns:4,rows:2,cell:256,elements:CATALOG},null,2)+'\n');
 fs.writeFileSync(path.join(job,'packing-report.json'),JSON.stringify(report,null,2)+'\n');console.log('Packed 56 elements in 7 atlases.');
})().catch(e=>{console.error(e);process.exitCode=1;});
