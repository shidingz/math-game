'use strict';
// A: atmospheric light field. D: four colour-matched elemental awakenings.
// All gradients, paths and motion are deterministic Canvas operations.
const {hsl,hex}=require('./pet-colors');
const VERSION='growth-elements-v4';
const ELEMENTS=['spark','star','diamond','bubble','plus','leaf','comet','ring','crystal','crescent'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
function hash(s){let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function color(s,fallback='#54858f'){return /^#[0-9a-f]{6}$/i.test(s)?s:fallback;}
function channels(s){return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));}
function rgba(s,a){return 'rgba('+channels(s).join(',')+','+a+')';}
const DOMAINS={
 solar:{name:'日焰',energy:'#ffab4f',secondary:'#fa6879',light:'#fff4ca',top:'#241c36',mid:'#574154',bottom:'#151c32'},
 ice:{name:'冰晶',energy:'#58dfff',secondary:'#879aff',light:'#e9ffff',top:'#132841',mid:'#365b75',bottom:'#101d39'},
 leaf:{name:'风叶',energy:'#86f1b1',secondary:'#46d8dd',light:'#f2ffd1',top:'#123a39',mid:'#396a65',bottom:'#102f38'},
 thunder:{name:'星雷',energy:'#bd8cff',secondary:'#ff8bc1',light:'#fcf0ff',top:'#201d45',mid:'#514176',bottom:'#181d3b'}
};
function domainFor(h,neutral){return neutral?'ice':h<80||h>=345?'solar':h<170?'leaf':h<245?'ice':'thunder';}
function profile(character,stage=0){
 const art=character.procedural,raw=character.effectColors?.[stage];
 const primary=color(raw?.colors?.primary||art?.colors?.primary||character.stages?.[stage]?.color||character.ui?.palette?.primary);
 const sample=hsl(...channels(primary)),match=raw?.match||art?.spec?.match;
 const neutral=match?.neutral??sample.s<.15,hue=neutral?210:(match?.hue??sample.h),seed=hash(character.id),family=seed%4;
 const domain=domainFor(hue,neutral),d=DOMAINS[domain];
 const choices=[['spark','star','diamond'],['star','crescent','spark'],['crystal','plus','comet'],['spark','leaf','bubble']][family];
 return {version:VERSION,seed,family,motifs:choices,hue,lightPet:match?match.lightness>.70:false,domain,domainName:d.name,
  ink:d.energy,soft:d.secondary,accent:d.energy,contrast:d.secondary,glow:d.light,sky:d.top,ground:d.bottom,mid:d.mid};
}
function recipe(level){
 const lv=clamp(Math.floor(Number(level)||1),1,15),p=(lv-1)/14,stage=lv<6?0:lv<11?1:2;
 return {level:lv,stage,progress:p,radius:.73+p*.27,size:5+p*7,opacity:.68+p*.30,
  count:4+Math.floor((lv-1)/2),rings:lv>=10?2:1,arcs:stage,orbit:lv>=6,comets:lv>=11?2:0,crown:lv===15,
  crystals:lv>=11?4:lv>=6?2:0,wings:lv>=11,gate:lv>=6,blades:stage===2?4:stage===1?2:0};
}
function glow(c,x,y,rx,ry,ink,alpha){
 c.save();c.translate(x,y);c.scale(1,ry/rx);
 const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,rgba(ink,.8));g.addColorStop(.32,rgba(ink,.37));g.addColorStop(1,rgba(ink,0));
 c.globalAlpha=alpha;c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
}
function luminous(c,ink,light,width,alpha=1){
 c.save();c.strokeStyle=ink;c.globalAlpha=alpha*.10;c.lineWidth=width*5;c.stroke();
 c.globalAlpha=alpha*.3;c.lineWidth=width*2.2;c.stroke();
 c.globalAlpha=alpha*.85;c.lineWidth=width;c.stroke();
 c.strokeStyle=light;c.globalAlpha=alpha;c.lineWidth=Math.max(.7,width*.3);c.stroke();c.restore();
}
function element(c,type,x,y,r,ink,turn=0){
 c.save();c.translate(x,y);c.rotate(turn);c.strokeStyle=ink;c.fillStyle=ink;c.lineWidth=Math.max(1,r*.17);c.beginPath();
 if(type==='ring'||type==='bubble'){c.arc(0,0,r,0,Math.PI*2);c.stroke();if(type==='bubble'){c.beginPath();c.arc(-r*.25,-r*.25,r*.16,0,7);c.fill();}}
 else if(type==='crystal'){
  c.moveTo(0,-r*1.6);c.lineTo(r*.72,0);c.lineTo(0,r*1.5);c.lineTo(-r*.72,0);c.closePath();c.fill();
  c.strokeStyle='#ffffff';c.lineWidth=.8;c.moveTo(0,-r*1.3);c.lineTo(0,r*1.2);c.moveTo(-r*.55,0);c.lineTo(0,r*.25);c.lineTo(r*.55,0);c.stroke();
 }
 else if(type==='crescent'){c.arc(0,0,r,.35,Math.PI*1.75);c.quadraticCurveTo(-r*.28,0,r*Math.cos(.35),r*Math.sin(.35));c.fill();}
 else if(type==='plus'){c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();}
 else if(type==='leaf'){c.moveTo(-r,r*.6);c.quadraticCurveTo(-r*.4,-r*1.1,r,-r*.6);c.quadraticCurveTo(r*.6,r*.8,-r,r*.6);c.fill();}
 else if(type==='comet'){c.moveTo(-r*1.8,r*.8);c.quadraticCurveTo(-r*.6,0,r*.5,-r*.4);c.stroke();c.beginPath();c.arc(r*.5,-r*.4,r*.35,0,7);c.fill();}
 else {const points=type==='star'?5:4,inner=type==='diamond'?.60:type==='spark'?.23:.44;
  for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,s=i%2?r*inner:r;const xx=Math.cos(a)*s,yy=Math.sin(a)*s;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();}
 c.restore();
}
function backdrop(c,p,x,y,w,h,level,time=0,reducedMotion=false){
 const r=recipe(level),t=reducedMotion?0:time/1000;
 c.save();const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,p.sky);g.addColorStop(.56,p.mid);g.addColorStop(1,p.ground);c.fillStyle=g;c.fillRect(x,y,w,h);
 // Soft pools and mist give depth, leaving the pet's silhouette readable.
 glow(c,x+w*.25,y+h*.21,w*.68,h*.75,p.soft,.30);
 glow(c,x+w*.72,y+h*.48,w*.61,h*.66,p.ink,.19+r.progress*.13);
 glow(c,x+w*.5,y+h*.86,w*.59,h*.27,p.glow,.17);
 for(let j=0;j<3;j++){
  const drift=Math.sin(t*.13+j*1.8)*h*.012,yy=y+h*(.42+j*.19)+drift;
  c.beginPath();c.moveTo(x-w*.1,yy);c.bezierCurveTo(x+w*.22,yy-h*.19,x+w*.58,yy+h*.16,x+w*1.1,yy-h*.1);
  c.lineTo(x+w*1.1,yy+h*.13);c.bezierCurveTo(x+w*.6,yy+h*.3,x+w*.2,yy-h*.06,x-w*.1,yy+h*.16);c.closePath();
  const mist=c.createLinearGradient(0,yy-h*.2,0,yy+h*.3);mist.addColorStop(0,rgba(p.glow,0));mist.addColorStop(.55,rgba(p.glow,.08));mist.addColorStop(1,rgba(p.glow,0));c.fillStyle=mist;c.fill();
 }
 for(let i=0;i<9;i++){
  const seed=(p.seed%97)+i*23.7,xx=x+w*(.07+(i*.137)% .88)+Math.sin(t*.10+seed)*4,yy=y+h*(.08+(i*.219)%.75);
  glow(c,xx,yy,2.5+(i%3)*2,2.5+(i%3)*2,i%2?p.glow:p.soft,.19);
 }
 c.restore();return {world:'lightfield',domain:p.domain,level:r.level};
}
function blade(c,p,x,foot,reach,height,side,j,r,t){
 const rx=x+side*reach*.25,ry=foot-height*.12;
 const tx=x+side*reach*(.98-j*.09),ty=foot-height*(.88-j*.17)+Math.sin(t*.5+j)*2;
 c.beginPath();c.moveTo(rx,ry);
 if(p.domain==='ice'){
  c.lineTo(x+side*reach*(.75-j*.08),foot-height*(.31+j*.065));c.lineTo(tx,ty);
  c.lineTo(x+side*reach*(.36+j*.02),foot-height*(.58-j*.10));c.closePath();
 }else{
  c.bezierCurveTo(x+side*reach*(1.08-j*.11),foot-height*.19,tx+side*reach*.09,ty+height*.20,tx,ty);
  c.bezierCurveTo(tx-side*reach*.33,ty+height*.16,x+side*reach*.30,foot-height*.45,rx,ry);c.closePath();
 }
 const g=c.createLinearGradient(rx,ry,tx,ty);g.addColorStop(0,rgba(p.ink,.015));g.addColorStop(.5,rgba(j%2?p.soft:p.ink,.34));g.addColorStop(1,rgba(p.glow,.90));
 c.fillStyle=g;c.fill();luminous(c,j%2?p.soft:p.ink,p.glow,1.7,r.opacity*.83);
 c.beginPath();c.moveTo(rx,ry);c.quadraticCurveTo(x+side*reach*.58,foot-height*.41,tx,ty);
 luminous(c,p.ink,p.glow,.9,.65);
}
function bolt(c,p,x,cy,reach,height,side,t,r){
 const pts=[];
 for(let i=0;i<7;i++){
  const yy=cy-height*.44+i*height*.135,xx=x+side*reach*(.78+(i%2?.14:0)+Math.sin(t*.8+i)*.025);
  pts.push([xx,yy]);
 }
 c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));luminous(c,p.soft,p.glow,2.8,r.opacity);
 for(const k of [2,4]){const [a,b]=pts[k];c.beginPath();c.moveTo(a,b);c.lineTo(a+side*reach*.13,b-height*.035);c.lineTo(a+side*reach*.18,b-height*.13);luminous(c,p.ink,p.glow,1.3,.75);}
}
function draw(c,p,{x,foot,width,height,level,time=0,full=false,reducedMotion=false,burstAge=-1}){
 const r=recipe(level),t=reducedMotion?0:time/1000;
 const reach=Math.min(width*.465,height*.82)*r.radius,ry=height*.52*r.radius,cy=foot-height*.51;
 c.save();c.lineCap='round';c.lineJoin='round';
 glow(c,x,cy,reach*1.25,ry*1.22,p.ink,.32+r.progress*.25);
 glow(c,x,foot,reach*1.12,22+r.progress*10,p.ink,.50);
 // Ground energy is visible from the first level, without hiding the pet's face.
 for(let i=0;i<r.rings;i++){
  c.beginPath();c.ellipse(x,foot+1,reach*(.90+i*.10),12+r.progress*6+i*6,0,0,TAU);
  luminous(c,i?p.soft:p.ink,p.glow,1.8+r.progress*1.4,.75);
 }
 // At awakening the aura encloses the whole body; slow moving highlights keep
 // the structure readable rather than blinking it on and off.
 if(r.gate){
  for(let i=0;i<r.arcs;i++){
   const turn=i?.14:-.10,a=t*(i?-.10:.075)+i*Math.PI;
   c.save();c.translate(x,cy);c.rotate(turn);c.scale(1,ry/reach);
   c.beginPath();c.arc(0,0,reach*(.95+i*.09),a+.12,a+TAU-.35);
   luminous(c,i?p.soft:p.ink,p.glow,2.6+i*.4,r.opacity);
   c.beginPath();c.arc(0,0,reach*(.95+i*.09),a+.5,a+1.05);luminous(c,p.ink,p.glow,4.2,.93);
   c.restore();
  }
 }
 if(p.domain==='thunder'&&r.gate){for(const side of [-1,1])bolt(c,p,x,cy,reach,height,side,t,r);}
 else for(const side of [-1,1])for(let j=0;j<r.blades;j++)blade(c,p,x,foot,reach,height,side,j,r,t);
 // Domain silhouettes: fire feathers, faceted ice, leaf wings, or star lightning.
 if(p.domain==='solar'&&r.wings){
  for(let i=0;i<10;i++){
   const a=TAU*i/10+t*.025,rx=reach*(1.0+Math.sin(i*3)*.03),xx=x+Math.cos(a)*rx,yy=cy+Math.sin(a)*ry;
   c.beginPath();c.moveTo(xx,yy);c.lineTo(x+Math.cos(a)*(rx+8),cy+Math.sin(a)*(ry+8));luminous(c,p.ink,p.glow,2,.8);
  }
 }
 for(let i=0;i<r.count;i++){
  const side=i%2?1:-1,row=Math.floor(i/2),phase=p.seed%13+i*2.3;
  const xx=x+side*reach*(.89+Math.sin(t*.4+phase)*.07),yy=foot-height*(.16+row*.135)+Math.sin(t*.6+phase)*4;
  const size=r.size*(i%3===0?1.15:.65),type=p.domain==='ice'?'crystal':p.domain==='leaf'?'leaf':p.domain==='thunder'?'spark':i%2?'spark':'comet';
  glow(c,xx,yy,size*2.2,size*2.2,p.ink,.35);
  c.globalAlpha=.72+Math.sin(t*.6+phase)*.12;element(c,type,xx,yy,size,i%2?p.glow:p.ink,Math.sin(t*.3+phase)*.22);c.globalAlpha=1;
 }
 if(r.orbit){
  const a=t*.35+p.seed%6,xx=x+Math.cos(a)*reach,yy=cy+Math.sin(a)*ry;
  glow(c,xx,yy,13,13,p.glow,.7);element(c,'spark',xx,yy,4.5,p.glow);
 }
 if(r.crown){
  const yy=foot-height*1.01;glow(c,x,yy,30,24,p.ink,.7);element(c,p.domain==='ice'?'crystal':'spark',x,yy,13,p.glow);
  for(const side of [-1,1]){element(c,'diamond',x+side*25,yy+10,5,p.ink);c.beginPath();c.moveTo(x+side*10,yy+3);c.lineTo(x+side*21,yy+9);luminous(c,p.ink,p.glow,1.4,.85);}
 }
 if(burstAge>=0&&burstAge<1000&&!reducedMotion){
  const q=burstAge/1000,ease=1-(1-q)**3;
  for(let k=0;k<2;k++){c.beginPath();c.ellipse(x,foot-height*.06,reach*(.65+ease*.45+k*.07),18+ease*22,0,0,TAU);luminous(c,p.ink,p.glow,2.4,(1-q)*.8);}
  for(let i=0;i<10;i++){const a=TAU*i/10,xx=x+Math.cos(a)*reach*(.65+ease*.5),yy=cy+Math.sin(a)*ry*(.60+ease*.46);c.globalAlpha=(1-q)*.95;element(c,'spark',xx,yy,(6+ease*7)*(1-q),p.glow,a);}
 }
 c.restore();return r;
}
module.exports={VERSION,ELEMENTS,DOMAINS,domainFor,profile,recipe,element,backdrop,draw};
