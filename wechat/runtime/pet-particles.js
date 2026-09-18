'use strict';
// Website-inspired vector effects. Whole motifs behind the pet; no ribbons or particle emitter.
const VERSION='website-themes-v2';
const {drawMotif}=require('./effect-motifs');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const BUILTINS={
 wukong:{id:'nature',name:'花果星辉',colors:['#35af83','#efbd50','#c4edda']},
 ragdoll:{id:'crystal',name:'晶翼星辉',colors:['#7585db','#65c9e8','#ddeeff']},
 corgi:{id:'guard',name:'星徽守护',colors:['#438dde','#e9bd54','#d5ecff']},
 samoyed:{id:'frost',name:'冰雪灵光',colors:['#4b98eb','#9879df','#d9f5ff']},
 siamese:{id:'lotus',name:'莲纹宝光',colors:['#c79b39','#38a89e','#fff0bf']},
 bichon:{id:'cloud',name:'祥云星光',colors:['#57acd9','#9a86e5','#e4f8ff']},
 nezha:{id:'flame',name:'莲焰灵光',colors:['#e26877','#e8b84b','#ffe5d1']},
 yutu:{id:'moon',name:'月桂清辉',colors:['#579cce','#a18bdf','#dff4ff']}
};
// The old eight identities stay intact; new photos choose only generic themes.
const FAMILIES=[
 {id:'nature',name:'花果星辉',outline:'nature',paletteGroup:'green',motifs:['leaf','clover','fern','bud']},
 {id:'crystal',name:'晶翼星辉',outline:'crystal',paletteGroup:'cool',motifs:['crystal','gem','prism','star']},
 {id:'guard',name:'星徽守护',outline:'guard',paletteGroup:'builtin',motifs:['shield','star']},
 {id:'frost',name:'冰雪灵光',outline:'frost',paletteGroup:'cool',motifs:['snow','icicle','crystal','star']},
 {id:'lotus',name:'莲纹宝光',outline:'lotus',paletteGroup:'green',motifs:['lotus','bud','leaf','gem']},
 {id:'cloud',name:'祥云星光',outline:'cloud',paletteGroup:'neutral',motifs:['cloud','bell','wing','star']},
 {id:'flame',name:'莲焰灵光',outline:'flame',paletteGroup:'warm',motifs:['flame','sun','spark','gem']},
 {id:'moon',name:'月桂清辉',outline:'moon',paletteGroup:'violet',motifs:['crescent','comet','star','cloud']},
 {id:'bloom',name:'花语微光',outline:'bloom',paletteGroup:'green',motifs:['blossom','bud','heart','leaf']},
 {id:'butterfly',name:'蝶舞花境',outline:'wings',paletteGroup:'green',motifs:['butterfly','blossom','leaf','star']},
 {id:'feather',name:'轻羽祝福',outline:'wings',paletteGroup:'neutral',motifs:['feather','wing','cloud','star']},
 {id:'grove',name:'四叶森语',outline:'grove',paletteGroup:'green',motifs:['clover','fern','leaf','spiral']},
 {id:'tide',name:'潮汐水光',outline:'tide',paletteGroup:'cool',motifs:['wave','raindrop','shell','pearl']},
 {id:'pearl',name:'珍珠海境',outline:'shell',paletteGroup:'neutral',motifs:['shell','pearl','wave','star']},
 {id:'comet',name:'彗星心愿',outline:'orbit',paletteGroup:'violet',motifs:['comet','star','crescent','spark']},
 {id:'orbit',name:'星际漫游',outline:'orbit',paletteGroup:'violet',motifs:['planet','star','comet','crescent']},
 {id:'aurora',name:'极光梦境',outline:'cloud',paletteGroup:'cool',motifs:['aurora','snow','cloud','prism']},
 {id:'dawn',name:'晨曦暖光',outline:'dawn',paletteGroup:'warm',motifs:['sun','spark','heart','flame']},
 {id:'prism',name:'棱镜幻光',outline:'prism',paletteGroup:'violet',motifs:['prism','gem','crystal','star']},
 {id:'lantern',name:'灯火心愿',outline:'cloud',paletteGroup:'warm',motifs:['lantern','bell','cloud','star']}
];
const FAMILY_BY_ID=Object.fromEntries(FAMILIES.map(f=>[f.id,f]));
const POOLS={
 warm:['crystal','flame','dawn','lantern','butterfly','feather','prism'],
 green:['nature','lotus','grove','bloom','butterfly','feather'],
 cool:['crystal','frost','tide','pearl','aurora','feather'],
 violet:['moon','comet','orbit','aurora','prism','bloom'],
 neutral:['cloud','frost','feather','pearl','comet','aurora','prism','lantern']
};
const LEGACY_MOTIF={nature:'leaf',crystal:'crystal',guard:'shield',frost:'snow',lotus:'lotus',cloud:'cloud',flame:'flame',moon:'crescent'};
// Local hashing: no Math.random, naming model or semantic image analysis.
function hash(value){let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
function hueValue(value){const n=Number(value);return Number.isFinite(n)?((n%360)+360)%360:210;}
function selection(profile={}){
 const builtin=BUILTINS[profile.characterId];
 if(builtin&&!profile.custom){
  const family=FAMILY_BY_ID[builtin.id],m=LEGACY_MOTIF[builtin.id];
  return {...family,...builtin,motifs:[m,m,'star','star',m],layout:0,motion:'float',phase:0,builtin:true};
 }
 const h=hueValue(profile.baseHue??profile.hue),neutral=profile.baseNeutral??profile.neutral;
 const group=neutral?'neutral':h>=165&&h<255?'cool':h>=255&&h<335?'violet':h>=70&&h<165?'green':'warm';
 const key=String(profile.characterId||profile.seed||'new-partner'),pool=POOLS[group];
 const family=FAMILY_BY_ID[pool[hash(key+':effect-family')%pool.length]];
 const variants=hash(key+':effect-details'),a=family.motifs;
 // Keep one signature motif, then combine companions from its own compatible set.
 const second=1+(variants%(a.length-1)),third=1+((variants>>>5)%(a.length-1));
 const motifs=[a[0],a[second],a[third],a[(third+1)%a.length],a[0]];
 const currentNeutral=profile.neutral??neutral;
 const hue=hueValue(profile.hue??h),colors=currentNeutral?['#729dcc','#ab99de','#e2f3ff']:
  [`hsl(${hue},62%,49%)`,`hsl(${(hue+38)%360},64%,62%)`,`hsl(${hue},74%,90%)`];
 return {...family,colors,motifs,layout:(variants>>>10)%4,motion:['float','drift','sway'][(variants>>>14)%3],phase:(variants>>>17)%628/100,builtin:false};
}
function recipe(level,full=false){
 level=clamp(Math.floor(Number(level)||1),1,15);
 const stage=Math.floor((level-1)/5),progress=(level-1)/14;
 return {level,stage,strength:progress,ribbonCount:0,flow:false,particleCount:0,sprites:0,burstCount:0,motifCount:2+stage+(level%5===0?1:0),full};
}
function polygon(c,points,stroke,fill,width=1.6){
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
 if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=stroke;c.lineWidth=width;c.stroke();
}
const star=(c,x,y,r,colors)=>drawMotif(c,'star',x,y,r,colors);
const crescent=(c,x,y,r,colors)=>drawMotif(c,'crescent',x,y,r,colors);
function shield(c,x,y,r,colors,filled=true){
 if(filled)return drawMotif(c,'shield',x,y,r,colors);
 c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.45,y-r*.6,x+r*.8,y-r*.60);c.lineTo(x+r*.71,y+r*.15);c.quadraticCurveTo(x+r*.48,y+r*.72,x,y+r);c.quadraticCurveTo(x-r*.48,y+r*.72,x-r*.71,y+r*.15);c.lineTo(x-r*.8,y-r*.60);c.quadraticCurveTo(x-r*.45,y-r*.6,x,y-r);c.closePath();c.strokeStyle=colors[0];c.lineWidth=2.2;c.stroke();
}
function outline(c,id,x,y,rx,ry,colors,stage,t){
 c.save();c.translate(x,y);c.strokeStyle=colors[0];c.lineWidth=1.7;c.lineJoin='round';
 if(id==='wings'){
  for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(rx*.45,ry*.7);c.bezierCurveTo(rx*1.18,ry*.25,rx*1.08,-ry*.62,rx*.80,-ry*.87);c.bezierCurveTo(rx*.64,-ry*.60,rx*.37,-ry*.36,rx*.35,-ry*.17);c.stroke();c.restore();}
 }else if(id==='grove'){
  for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(rx*.32,ry*.8);c.bezierCurveTo(rx*1.1,ry*.55,rx*1.04,-ry*.52,rx*.45,-ry*.88);c.stroke();c.restore();}
 }else if(id==='prism'){
  polygon(c,[[0,-ry],[-rx,-ry*.2],[-rx*.75,ry*.68],[0,ry*.96],[rx*.75,ry*.68],[rx,-ry*.2]],colors[0],null,1.8);
  if(stage===2){c.beginPath();c.moveTo(-rx*.72,-ry*.18);c.lineTo(0,-ry*.77);c.lineTo(rx*.72,-ry*.18);c.strokeStyle=colors[1];c.stroke();}
 }else if(id==='orbit'){
  c.beginPath();c.ellipse(0,0,rx,ry,-.16,Math.PI*.94,Math.PI*2.48);c.stroke();
  if(stage===2){c.beginPath();c.ellipse(0,0,rx*.9,ry,.16,-Math.PI*.4,Math.PI*.8);c.strokeStyle=colors[1];c.stroke();}
 }else if(id==='tide'||id==='shell'){
  c.beginPath();c.moveTo(-rx,ry*.68);c.bezierCurveTo(-rx*1.12,-ry*.6,-rx*.30,-ry,0,-ry);c.bezierCurveTo(rx*.30,-ry,rx*1.12,-ry*.6,rx,ry*.68);c.stroke();
  if(stage===2){for(const side of [-1,1]){c.beginPath();c.moveTo(side*rx*.85,ry*.4);c.quadraticCurveTo(side*rx*.68,-ry*.3,side*rx*.35,-ry*.66);c.strokeStyle=colors[1];c.stroke();}}
 }else if(id==='bloom'||id==='dawn'){
  // A single broad flower/sun contour, not a dense repeated petal fan.
  c.beginPath();for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,scale=1+.08*Math.cos(a*(id==='bloom'?5:8));const px=Math.cos(a)*rx*scale,py=Math.sin(a)*ry*scale;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();
 }else if(id==='moon'){c.globalAlpha*=.70;crescent(c,-rx*.06,0,Math.min(rx,ry)*.98,colors);}
 else if(id==='frost'){const pts=[];for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;pts.push([Math.cos(a)*rx,Math.sin(a)*ry]);}polygon(c,pts,colors[0],null,1.8);}
 else if(id==='guard'){c.save();c.scale(rx/ry*1.08,1);shield(c,0,0,ry,colors,false);c.restore();}
 else if(id==='lotus'||id==='flame'){
  // Only contour petals, with no solid fan covering the character or background.
  for(const a of [-.72,0,.72]){c.save();c.rotate(a);c.beginPath();c.moveTo(0,ry*.85);c.bezierCurveTo(-rx*.7,ry*.3,-rx*.66,-ry*.68,0,-ry);c.bezierCurveTo(rx*.66,-ry*.68,rx*.7,ry*.3,0,ry*.85);c.stroke();c.restore();}
 }else if(id==='crystal'||id==='cloud'){
  c.beginPath();c.moveTo(-rx,ry*.72);c.lineTo(-rx,-ry*.18);if(id==='crystal'){c.quadraticCurveTo(-rx*.82,-ry*.72,0,-ry);c.quadraticCurveTo(rx*.82,-ry*.72,rx,-ry*.18);}else{c.bezierCurveTo(-rx,-ry*1.16,rx,-ry*1.16,rx,-ry*.18);}c.lineTo(rx,ry*.72);c.stroke();
 }else{
  c.beginPath();c.ellipse(0,0,rx,ry,0,Math.PI*1.04,Math.PI*1.96);c.stroke();
  if(stage===2){const p=[];for(let i=0;i<5;i++){const a=i*4*Math.PI/5-Math.PI/2;p.push([Math.cos(a)*rx*.95,Math.sin(a)*ry*.95]);}polygon(c,p,colors[1],null,1.6);}
 }
 if(stage===2&&['frost','crystal','cloud'].includes(id)){
  // Two broad side emblems, not repeated feather rows or particle showers.
  for(const side of [-1,1]){c.save();c.scale(side,1);c.beginPath();c.moveTo(rx*.65,ry*.60);c.quadraticCurveTo(rx*1.3,ry*.03,rx*1.13,-ry*.64);c.quadraticCurveTo(rx*.74,-ry*.24,rx*.64,ry*.1);c.strokeStyle=colors[1];c.lineWidth=2;c.stroke();c.restore();}
 }
 c.restore();
}
function draw(c,profile,{x,foot,width,height,level,time=0,full=false,front=false,reducedMotion=false,burstAge=-1,evolved=false}){
 const r=recipe(level,full),f=selection(profile),t=reducedMotion?0:time/1000;
 const duration=evolved?3000:1900,surge=!reducedMotion&&burstAge>=0&&burstAge<duration?Math.sin(Math.PI*burstAge/duration):0;
 const meta={...r,familyId:f.id,name:f.name,mainShape:r.stage?f.outline+'-outline':'side-motifs',motifs:f.motifs.slice(0,r.motifCount),layout:f.layout,motion:f.motion,colors:f.colors,surge,front,version:VERSION};
 if(front)return meta;
 const h=Math.max(95,height),rx=Math.min(width*.38,h*.63),ry=h*.48,y=foot-h*.53;
 const breathe=reducedMotion?0:Math.sin(t*.85)*2;
 c.save();c.globalAlpha=.84+r.strength*.12;c.lineCap='round';
 if(r.stage)outline(c,f.outline,x,y+breathe,rx*(1+surge*.04),ry*(1+surge*.04),f.colors,r.stage,t);
 const slots=[
  [[-1,-.24],[1,-.45],[-.74,.62],[.75,.57],[0,-1.06]],
  [[-1,-.48],[1,-.12],[-.78,.54],[.72,.64],[.22,-1.03]],
  [[-.9,-.68],[.98,-.56],[-.92,.39],[.83,.60],[-.20,-1.03]],
  [[-.98,-.06],[.92,-.64],[-.76,.62],[.98,.34],[0,-1.06]]
 ][f.layout];
 const size=clamp(h*(.065+r.strength*.018),10,20)*(1+surge*.24);
 for(let i=0;i<r.motifCount;i++){
  const [sx,sy]=slots[i],phase=t*.9+i*1.7+f.phase;
  const dx=reducedMotion||f.motion==='float'?0:Math.sin(phase*.6)*(f.motion==='drift'?3:1.5);
  const px=x+sx*rx*1.05+dx,py=y+sy*ry+(reducedMotion?0:Math.sin(phase)*3);
  const kind=f.motifs[i],small=(i===2||i===3)?.74:1;
  drawMotif(c,kind,px,py,size*small*(kind==='lotus'?.8:1),f.colors,reducedMotion?0:t+i);
  if(f.builtin&&f.id==='guard'&&kind==='shield')star(c,px,py,size*.4,[f.colors[1],f.colors[0],f.colors[1]]);
 }
 if(surge>.01){c.globalAlpha=surge*.60;c.strokeStyle=f.colors[1];c.lineWidth=2.2;c.beginPath();c.ellipse(x,y,rx*(1.03+surge*.08),ry*(1.04+surge*.08),0,0,Math.PI*2);c.stroke();}
 c.restore();return meta;
}
module.exports={VERSION,BUILTINS,FAMILIES,selection,recipe,draw};
