'use strict';
// Generic, deterministic extraction. Coordinates may adapt to clear gaps;
// missing anatomy is never invented. Real alpha is preserved without chroma removal.
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const {bounds}=require('./pet-matte.cjs');
const RULES=Object.freeze({version:1,format:'alpha-grid-v1',alphaFloor:12,boundsAlpha:16,minClearFraction:.08,
  minCell:240,maxEdge:8192,maxPixels:24000000,lineSearchFraction:.22,lineCoverage:.68,lineMaxWidthFraction:.04,
  gapSearchFraction:.24,minGap:3,maxSpeckFraction:.000003,
  design:{width:3072,height:1024,cols:3,rows:1,promptMargin:96},
  sheet:{width:1536,height:1536,cols:3,rows:3,promptMargin:48},
  target:{cell:512,width:416,height:400,foot:448}});
function spec(kind){if(!['design','sheet'].includes(kind))throw Error('Unknown alpha grid kind');return RULES[kind];}
async function template(kind){
 const s=spec(kind),paths=[];
 for(let i=0;i<=s.cols;i++){const x=Math.max(2,Math.min(s.width-2,i*s.width/s.cols));paths.push(`<path d="M${x} 2V${s.height-2}"/>`);}
 for(let i=0;i<=s.rows;i++){const y=Math.max(2,Math.min(s.height-2,i*s.height/s.rows));paths.push(`<path d="M2 ${y}H${s.width-2}"/>`);}
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}"><g fill="none" stroke="#171717" stroke-width="3">${paths.join('')}</g></svg>`)).png().toBuffer();
}
function lineInk(d,i){return d[i+3]>32&&Math.max(d[i],d[i+1],d[i+2])<155&&Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])<40;}
function clearPixel(d,i){d[i]=d[i+1]=d[i+2]=d[i+3]=0;}
function removeRules(d,w,h,cols,rows){
 const lines=[];
 for(const [axis,count] of [['x',cols],['y',rows]]){
  const length=axis==='x'?w:h,cross=axis==='x'?h:w,cell=length/count;
  for(let n=0;n<=count;n++){
   const nominal=n*cell,radius=cell*((n===0||n===count)? .06:RULES.lineSearchFraction),runs=[];let run=null;
   for(let p=Math.max(0,Math.floor(nominal-radius));p<=Math.min(length-1,Math.ceil(nominal+radius));p++){
    let ink=0;for(let q=0;q<cross;q++)if(lineInk(d,(axis==='x'?q*w+p:p*w+q)*4))ink++;
    if(ink/cross>=RULES.lineCoverage){if(!run)run={start:p,end:p,coverage:ink/cross};else{run.end=p;run.coverage=Math.max(run.coverage,ink/cross);}}
    else if(run){runs.push(run);run=null;}
   }
   if(run)runs.push(run);
   const candidates=runs.filter(r=>r.end-r.start+1<=Math.max(8,cell*RULES.lineMaxWidthFraction));
   candidates.sort((a,b)=>(b.coverage-Math.abs((b.start+b.end)/2-nominal)/cell*.08)-(a.coverage-Math.abs((a.start+a.end)/2-nominal)/cell*.08));
   if(!candidates.length)continue;
   const r=candidates[0];let removed=0,contacts=0;
   // Only erase neutral rule ink, never an entire strip of arbitrary colours.
   for(let q=0;q<cross;q++){
    for(const p of [r.start-2,r.end+2])if(p>=0&&p<length){const i=(axis==='x'?q*w+p:p*w+q)*4;if(d[i+3]>64)contacts++;}
    for(let p=Math.max(0,r.start-2);p<=Math.min(length-1,r.end+2);p++){
     const i=(axis==='x'?q*w+p:p*w+q)*4;
     const max=Math.max(d[i],d[i+1],d[i+2]),min=Math.min(d[i],d[i+1],d[i+2]);
     if(d[i+3]>0&&max-min<40&&(max<200||d[i+3]<128)){clearPixel(d,i);removed++;}
    }
   }
   lines.push({axis,division:n,...r,removed,contactPixels:contacts,review:contacts>cross*.035});
  }
 }
 return lines;
}
function removeSpecks(d,w,h){
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h),limit=Math.max(3,Math.floor(w*h*RULES.maxSpeckFraction));let removed=0;
 for(let p=0;p<seen.length;p++)if(!seen[p]&&d[p*4+3]>RULES.boundsAlpha){
  let head=0,tail=0;queue[tail++]=p;seen[p]=1;
  while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const v=yy*w+xx;
    if(!seen[v]&&d[v*4+3]>RULES.boundsAlpha){seen[v]=1;queue[tail++]=v;}
   }
  }
  if(tail<=limit)for(let i=0;i<tail;i++){clearPixel(d,queue[i]*4);removed++;}
 }
 return removed;
}
function divisions(d,w,h,axis,count,region){
 const length=axis==='x'?region.width:region.height,cross=axis==='x'?region.height:region.width,result=[0],gaps=[];
 for(let n=1;n<count;n++){
  const nominal=length*n/count,radius=length/count*RULES.gapSearchFraction;
  const first=Math.max(result.at(-1)+1,Math.floor(nominal-radius)),last=Math.min(length-2,Math.ceil(nominal+radius));
  let start=null;const runs=[];
  for(let p=first;p<=last;p++){
   let occupied=false;
   for(let q=0;q<cross;q++){
    const x=region.left+(axis==='x'?p:q),y=region.top+(axis==='y'?p:q);
    if(d[(y*w+x)*4+3]>RULES.boundsAlpha){occupied=true;break;}
   }
   if(!occupied){if(start===null)start=p;}else if(start!==null){runs.push([start,p-1]);start=null;}
  }
  if(start!==null)runs.push([start,last]);
  const usable=runs.filter(([a,b])=>b-a+1>=RULES.minGap);
  usable.sort((a,b)=>Math.abs((a[0]+a[1])/2-nominal)-Math.abs((b[0]+b[1])/2-nominal));
  if(!usable.length)throw Error(`No transparent gap for ${axis}${n}; neighbouring bodies may overlap`);
  const chosen=usable[0],cut=Math.round((chosen[0]+chosen[1])/2);result.push(cut);gaps.push({nominal,interval:chosen,cut});
 }
 result.push(length);return {cuts:result,gaps};
}
async function extract(input,kind){
 const s=spec(kind),meta=await sharp(input).metadata();
 if(meta.format!=='png'||meta.width<s.cols*RULES.minCell||meta.height<s.rows*RULES.minCell||Math.max(meta.width,meta.height)>RULES.maxEdge||meta.width*meta.height>RULES.maxPixels)throw Error('PNG dimensions outside alpha-grid limits');
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;
 let clear=0,nearZero=0;
 for(let i=0;i<data.length;i+=4)if(data[i+3]<=RULES.alphaFloor){clear++;if(data[i+3]>0)nearZero++;clearPixel(data,i);}
 if(!meta.hasAlpha||clear/(w*h)<RULES.minClearFraction)throw Error('Missing usable alpha: opaque or painted checkerboard is not a transparent PNG');
 const lines=removeRules(data,w,h,s.cols,s.rows),specks=removeSpecks(data,w,h);
 const yy=divisions(data,w,h,'y',s.rows,{left:0,top:0,width:w,height:h}),cells=[],metrics=[],rowSplits=[];
 const raw=await sharp(data,{raw:info}).png().toBuffer();
 for(let row=0;row<s.rows;row++){
  const top=yy.cuts[row],height=yy.cuts[row+1]-top;
  const xx=divisions(data,w,h,'x',s.cols,{left:0,top,width:w,height});rowSplits.push(xx);
  for(let col=0;col<s.cols;col++){
   const rect={left:xx.cuts[col],top,width:xx.cuts[col+1]-xx.cuts[col],height};
   const {data:rgba,info:ci}=await sharp(raw).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const box=bounds(rgba,ci.width,ci.height,RULES.boundsAlpha);
   if(box.count<Math.max(64,ci.width*ci.height*.004)||box.width<8||box.height<8)throw Error('Empty or tiny subject in cell '+(cells.length+1));
   const margins={left:box.x,top:box.y,right:ci.width-box.x-box.width,bottom:ci.height-box.y-box.height};
   const edgeReview=Object.values(margins).some(v=>v<2);
   cells.push({png:await sharp(rgba,{raw:ci}).png().toBuffer(),box});metrics.push({cell:cells.length,rect,box,margins,edgeReview});
  }
 }
 return {cells,report:{format:RULES.format,source:{width:w,height:h,hasAlpha:meta.hasAlpha},clearFraction:clear/(w*h),nearZeroAlphaCleared:nearZero,specksRemoved:specks,lines,rowDivisions:yy,columnDivisionsByRow:rowSplits,metrics,aiPostProcessing:0,reviewRequired:lines.some(l=>l.review)||metrics.some(m=>m.edgeReview)}};
}
async function save(input,out,kind){
 const r=await extract(input,kind),isSheet=kind==='sheet',s=spec(kind),cell=isSheet?512:1024;
 const maxW=Math.max(...r.cells.map(p=>p.box.width)),maxH=Math.max(...r.cells.map(p=>p.box.height));
 const scale=Math.min((isSheet?416:832)/maxW,(isSheet?400:800)/maxH),layers=[],boxes=[];
 fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 for(let i=0;i<r.cells.length;i++){
  const p=r.cells[i],width=Math.max(1,Math.round(p.box.width*scale)),height=Math.max(1,Math.round(p.box.height*scale));
  const x=Math.round((cell-width)/2),y=(isSheet?448:896)-height;
  const image=await sharp(p.png).extract({left:p.box.x,top:p.box.y,width:p.box.width,height:p.box.height}).resize(width,height).png().toBuffer();
  const frame=await sharp({create:{width:cell,height:cell,channels:4,background:'#00000000'}}).composite([{input:image,left:x,top:y}]).png().toBuffer();
  fs.writeFileSync(path.join(out,'frames',i+'.png'),frame);fs.writeFileSync(path.join(out,`cell-${i+1}.png`),frame);
  layers.push({input:frame,left:i%s.cols*cell,top:Math.floor(i/s.cols)*cell});boxes.push({x,y,width,height});
 }
 const file=path.join(out,'atlas.png');
 await sharp({create:{width:cell*s.cols,height:cell*s.rows,channels:4,background:'#00000000'}}).composite(layers).png({palette:true,colours:256,effort:7}).toFile(file);
 const report={...r.report,commonScale:scale,boxes,target:{width:s.cols*cell,height:s.rows*cell}};
 fs.writeFileSync(path.join(out,'layout-check.json'),JSON.stringify(report,null,2)+'\n');return {file,report};
}
module.exports={RULES,template,extract,save};
