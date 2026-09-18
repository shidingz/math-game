'use strict';
// Fixed, pre-generation windows. Never infer new cut lines from a generated image.
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const {normalize}=require('./pet-normalize.cjs'),{cutout}=require('./pet-matte.cjs');
const LAYOUT={version:7,format:'guided-windows-v7',gutter:'#D1D5DB',line:'#4B5563',gutterTolerance:42,maxGutterMismatch:.01,edgeBleed:3,lineTolerance:8,innerBackgroundBand:16,
 // Model-space clearance only proves that the subject is not cut off. Final
 // transparent margins are added later by the same fixed atlas converter.
 design:{cols:3,rows:1,cell:1024,inset:128,window:768,clearance:1},
 sheet:{cols:3,rows:3,cell:512,inset:48,window:416,clearance:1}};
function spec(kind){if(!LAYOUT[kind]||!['design','sheet'].includes(kind))throw Error('Unknown guide kind');return LAYOUT[kind];}
function backgroundBlend(pixel,a,b){
 const delta=a.map((v,c)=>b[c]-v),length=delta.reduce((n,v)=>n+v*v,0);
 const t=Math.max(0,Math.min(1,delta.reduce((n,v,c)=>n+(pixel[c]-a[c])*v,0)/(length||1)));
 return a.every((v,c)=>Math.abs(pixel[c]-(v+t*delta[c]))<=LAYOUT.gutterTolerance);
}
function windows(kind){const s=spec(kind);return Array.from({length:s.cols*s.rows},(_,i)=>({left:i%s.cols*s.cell+s.inset,top:Math.floor(i/s.cols)*s.cell+s.inset,width:s.window,height:s.window}));}
async function template(kind,key='green'){
 const s=spec(kind),w=s.cell*s.cols,h=s.cell*s.rows,bg=kind==='design'?'#FFFFFF':require('./pet-chroma.cjs').color(key).hex;
 const boxes=windows(kind).map(r=>`<rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="${bg}"/>`).join('');
 const vertical=Array.from({length:s.cols+1},(_,i)=>`<path d="M${i*s.cell} 0V${h}"/>`).join('');
 const horizontal=Array.from({length:s.rows+1},(_,i)=>`<path d="M0 ${i*s.cell}H${w}"/>`).join('');
 return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${LAYOUT.gutter}"/>${boxes}<g stroke="${LAYOUT.line}" stroke-width="4">${vertical}${horizontal}</g></svg>`)).png().toBuffer();
}
function substantialBounds(mask,w,h){
 const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let x0=w,y0=h,x1=-1,y1=-1,count=0;
 for(let start=0;start<mask.length;start++)if(mask[start]&&!seen[start]){
  let head=0,tail=0;queue[tail++]=start;seen[start]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const n=yy*w+xx;
   if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}
  }}
  if(tail<12)continue;
  count+=tail;for(let i=0;i<tail;i++){const x=queue[i]%w,y=Math.floor(queue[i]/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 }
 return {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,count};
}
async function clean(input,kind,key='green'){
 const s=spec(kind),n=await normalize(input,kind),{data,info}=await sharp(n.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const expected=await sharp(await template(kind,key)).ensureAlpha().raw().toBuffer();let mismatched=0,total=0;
 const fill=kind==='design'?[255,255,255]:[0,1,2].map(c=>c===require('./pet-chroma.cjs').color(key).channel?255:0);
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const xx=x%s.cell,yy=y%s.cell;if(xx>=s.inset&&xx<s.inset+s.window&&yy>=s.inset&&yy<s.inset+s.window)continue;
  const i=(y*info.width+x)*4;total++;
  // Grid lines are discarded and far outside the drawing window. Permit their
  // known gray colours within a fixed 8px band; do not move any crop boundary.
  const lineBand=Math.min(xx,s.cell-xx,yy,s.cell-yy)<=LAYOUT.lineTolerance;
  if(lineBand&&data[i+3]>=250&&backgroundBlend(data.subarray(i,i+3),[209,213,219],[75,85,99]))continue;
  // The same fixed 3px normalization rim can blend the window fill outwards.
  // Only the known background colour is allowed here, never subject pixels.
  // Cut coordinates and the foreground separation gate remain unchanged.
  const b=LAYOUT.edgeBleed,nearWindow=xx>=s.inset-b&&xx<s.inset+s.window+b&&yy>=s.inset-b&&yy<s.inset+s.window+b;
  if(nearWindow&&data[i+3]>=250&&backgroundBlend(data.subarray(i,i+3),[209,213,219],fill))continue;
  if(data[i+3]<250||[0,1,2].some(c=>Math.abs(data[i+c]-expected[i+c])>LAYOUT.gutterTolerance))mismatched++;
 }
 const gutterMismatchFraction=mismatched/total;
 if(gutterMismatchFraction>LAYOUT.maxGutterMismatch)throw Error('Guide gutters changed or contain artwork: '+gutterMismatchFraction.toFixed(5));
 const layers=[],cells=[],metrics=[];
 for(const [i,r]of windows(kind).entries()){
  // Clean only recognized auxiliary background, never blindly trim a pixel rim.
  // Full foreground pixels survive even when the real blank gap is just 1px.
  const bg=kind==='design'?'#FFFFFF':require('./pet-chroma.cjs').color(key).hex;
  const windowRaw=await sharp(n.bytes).extract(r).ensureAlpha().raw().toBuffer();
  // Remove only gray auxiliary background connected to a window edge. Never
  // cross the pure chroma gap into similarly coloured parts of the character.
  // The bounded band is fixed for every pet, not a detected crop rectangle.
  const seen=new Uint8Array(s.window*s.window),queue=new Int32Array(seen.length);let head=0,tail=0;
  const visit=(x,y)=>{
   if(x<0||y<0||x>=s.window||y>=s.window)return;
   const p=y*s.window+x;if(seen[p])return;seen[p]=1;
   const v=windowRaw.subarray(p*4,p*4+3);
   if(!backgroundBlend(v,[209,213,219],fill)||fill.every((c,j)=>Math.abs(v[j]-c)<=42))return;
   if(Math.min(x,y,s.window-1-x,s.window-1-y)>=LAYOUT.innerBackgroundBand)throw Error('Ambiguous gray content reaches inner cleanup boundary in window '+(i+1));
   queue[tail++]=p;
  };
  for(let x=0;x<s.window;x++){visit(x,0);visit(x,s.window-1);}for(let y=0;y<s.window;y++){visit(0,y);visit(s.window-1,y);}
  while(head<tail){const p=queue[head++],x=p%s.window,y=Math.floor(p/s.window);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);windowRaw.set([...fill,255],p*4);}
  const bytes=await sharp(windowRaw,{raw:{width:s.window,height:s.window,channels:4}}).png().toBuffer();let box;
  if(kind==='design'){
   const raw=await sharp(bytes).ensureAlpha().raw().toBuffer(),mask=new Uint8Array(s.window*s.window);
   for(let p=0;p<mask.length;p++)mask[p]=raw[p*4+3]>16&&Math.min(raw[p*4],raw[p*4+1],raw[p*4+2])<235?1:0;
   box=substantialBounds(mask,s.window,s.window);
  }else box=(await cutout(bytes,{key,validate:false})).box;
  if(box.count<s.window*s.window*.005)throw Error('Empty guide window '+(i+1));
  const margins={left:box.x,top:box.y,right:s.window-box.x-box.width,bottom:s.window-box.y-box.height};
  // There is no manufactured rim. Require a genuine background gap.
  const edgeReview=Object.values(margins).some(v=>v<s.clearance);
  // The inner drawing frame guides generation; the fixed outer cell is the
  // actual cut boundary. Preserve foreground that slightly crosses the guide,
  // flag its completeness for review, and remove only known auxiliary colours.
  const cellRaw=await sharp(n.bytes).extract({left:i%s.cols*s.cell,top:Math.floor(i/s.cols)*s.cell,width:s.cell,height:s.cell}).ensureAlpha().raw().toBuffer();
  for(let y=0;y<s.cell;y++)for(let x=0;x<s.cell;x++){
   if(x>=s.inset&&x<s.inset+s.window&&y>=s.inset&&y<s.inset+s.window)continue;
   const p=(y*s.cell+x)*4,v=cellRaw.subarray(p,p+3);
   const gridEdge=Math.min(x,y,s.cell-1-x,s.cell-1-y)<=LAYOUT.lineTolerance;
   if(backgroundBlend(v,[209,213,219],fill)||(gridEdge&&backgroundBlend(v,[209,213,219],[75,85,99])))cellRaw.set([...fill,255],p);
  }
  const cell=await sharp(cellRaw,{raw:{width:s.cell,height:s.cell,channels:4}}).composite([{input:bytes,left:s.inset,top:s.inset}]).png().toBuffer();
  cells.push(cell);layers.push({input:cell,left:i%s.cols*s.cell,top:Math.floor(i/s.cols)*s.cell});metrics.push({window:i+1,box,margins,edgeReview,auxiliaryBackgroundPixels:tail});
 }
 const bg=kind==='design'?'#FFFFFF':require('./pet-chroma.cjs').color(key).hex;
 const bytes=await sharp({create:{width:info.width,height:info.height,channels:4,background:bg}}).composite(layers).png().toBuffer();
 return {bytes,cells,report:{layout:LAYOUT.format,normalization:n.record,gutterMismatchFraction,metrics,modelAddsFinalPadding:false,finalPadding:'fixed-atlas-converter',aiPostProcessing:0,adaptiveCutLines:false}};
}
async function save(input,out,kind,key='green'){
 const r=await clean(input,kind,key);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'clean.png'),r.bytes);
 r.cells.forEach((b,i)=>fs.writeFileSync(path.join(out,`cell-${i+1}.png`),b));fs.writeFileSync(path.join(out,'layout-check.json'),JSON.stringify(r.report,null,2)+'\n');return r.report;
}
module.exports={LAYOUT,windows,template,clean,save};
