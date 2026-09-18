'use strict';
// Versioned built-in recipes. Saved choices are data, never generated code.
const PALETTES={jade:{primary:'#367f84',secondary:'#8563a5',accent:'#d6ad56',sky:'#eae4f3',ground:'#dcf1ec'},rose:{primary:'#aa6081',secondary:'#788ac0',accent:'#d7ad67',sky:'#f5e7f0',ground:'#e4edf7'},blue:{primary:'#527ba6',secondary:'#7664a4',accent:'#d8b966',sky:'#e5ebf8',ground:'#def1ef'}};
const SCENES=['lotus','meadow','moon'],MOTIFS=['lotus','stars','crystal'],FOODS=['rice','fruit','biscuit'];
function hash(text){let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return n>>>0;}
function random(seed){let n=seed||1;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
function validate(raw){
  if(![1,2].includes(raw?.version)||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>4294967295||!SCENES.includes(raw.scene)||!MOTIFS.includes(raw.motif)||!FOODS.includes(raw.food))throw Error('程序美术预设无效');
  if(raw.version===2){
    const keys=['primary','secondary','accent','sky','ground'];
    if(!raw.colors||keys.some(k=>!/^#[0-9a-f]{6}$/i.test(raw.colors[k])))throw Error('程序美术配色无效');
    const result={version:2,seed:raw.seed,scene:raw.scene,motif:raw.motif,food:raw.food,colors:Object.fromEntries(keys.map(k=>[k,raw.colors[k]]))};
    if(raw.match&&Number.isFinite(raw.match.hue)&&raw.match.hue>=0&&raw.match.hue<=360&&Number.isFinite(raw.match.lightness)&&raw.match.lightness>=0&&raw.match.lightness<=1&&typeof raw.match.neutral==='boolean')result.match={hue:raw.match.hue,lightness:raw.match.lightness,neutral:raw.match.neutral};
    return result;
  }
  if(!Object.hasOwn(PALETTES,raw.palette))throw Error('程序美术预设无效');
  return {version:1,seed:raw.seed,scene:raw.scene,motif:raw.motif,palette:raw.palette,food:raw.food};
}
function choose(id){const seed=hash(id),r=random(seed),pick=a=>a[Math.floor(r()*a.length)];return {version:1,seed,scene:pick(SCENES),motif:pick(MOTIFS),palette:pick(Object.keys(PALETTES)),food:pick(FOODS)};}
function compile(raw){const spec=validate(raw),r=random(spec.seed);return {spec,colors:spec.version===2?spec.colors:PALETTES[spec.palette],dots:Array.from({length:18},()=>({phase:r()*Math.PI*2,speed:.08+r()*.1,size:2+r()*3}))};}
function ellipse(c,x,y,rx,ry,color,fill=false,rotation=0){c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);if(fill){c.fillStyle=color;c.fill();}else{c.strokeStyle=color;c.stroke();}}
function motif(c,type,x,y,r,color,turn=0){
  c.save();c.translate(x,y);c.rotate(turn);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.3;
  if(type==='lotus')for(let i=-2;i<=2;i++){c.save();c.rotate(i*.34);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-r*.6,-r*.7,0,-r*1.6);c.quadraticCurveTo(r*.6,-r*.7,0,0);c.stroke();c.restore();}
  else{const points=type==='crystal'?4:5;c.beginPath();for(let i=0;i<points*2;i++){const a=i*Math.PI/points-Math.PI/2,s=i%2?r*.4:r;if(i)c.lineTo(Math.cos(a)*s,Math.sin(a)*s);else c.moveTo(Math.cos(a)*s,Math.sin(a)*s);}c.closePath();c.fill();}
  c.restore();
}
function scene(c,art,x,y,w,h){
  const p=art.colors;c.save();const gradient=c.createLinearGradient?.(0,y,0,y+h);if(gradient?.addColorStop){gradient.addColorStop(0,p.sky);gradient.addColorStop(1,p.ground);c.fillStyle=gradient;}else c.fillStyle=p.sky;c.fillRect(x,y,w,h);
  c.globalAlpha=.13;ellipse(c,x+w*.45,y+h*1.03,w*.8,h*.18,p.primary,true);ellipse(c,x+w*.85,y+h*1.07,w*.65,h*.2,p.secondary,true);
  c.globalAlpha=.25;c.lineWidth=1;const type=art.spec.scene;
  if(type==='lotus'){ellipse(c,x+w/2,y+h*.37,w*.23,h*.3,p.accent);ellipse(c,x+w/2,y+h*.37,w*.19,h*.25,p.secondary);}
  if(type==='moon'){c.globalAlpha=.28;ellipse(c,x+w*.77,y+h*.18,w*.10,w*.10,p.accent,true);c.globalAlpha=1;ellipse(c,x+w*.80,y+h*.155,w*.085,w*.085,p.sky,true);}
  for(let i=0;i<6;i++){const d=art.dots[i],xx=x+w*(i%2?.88:.12),yy=y+h*(.16+i*.10);c.globalAlpha=.20;motif(c,type==='meadow'?'lotus':art.spec.motif,xx,yy,5+d.size,p.secondary,d.phase);}
  c.restore();
}
function effects(c,art,x,foot,height,level,time,full){
  const p=art.colors,lv=Math.max(1,Math.min(15,level)),t=time/1000;c.save();c.lineWidth=full?2:1.2;
  c.globalAlpha=full?.6:.27;
  for(let i=0;i<1+Math.floor((lv-1)/4);i++)ellipse(c,x,foot+2-i*3,height*(.28+i*.035),height*(.045+i*.008),i%2?p.secondary:p.accent);
  if(lv>=6){c.globalAlpha=full?.55:.22;c.strokeStyle=p.accent;c.beginPath();c.moveTo(x-height*.35,foot-height*.12);c.lineTo(x-height*.35,foot-height*.70);c.quadraticCurveTo(x-height*.35,foot-height*.92,x,foot-height*1.03);c.quadraticCurveTo(x+height*.35,foot-height*.92,x+height*.35,foot-height*.70);c.lineTo(x+height*.35,foot-height*.12);c.stroke();}
  for(let i=0;i<lv+2;i++){const d=art.dots[i],a=d.phase+t*d.speed;c.globalAlpha=(full?.7:.35)+Math.sin(t+d.phase)*.1;motif(c,art.spec.motif,x+Math.cos(a)*height*.44,foot-height*.48+Math.sin(a)*height*.41,d.size+(full?2:0),i%2?p.accent:p.secondary,a*.1);}
  if(lv>=11){c.globalAlpha=full?.45:.16;for(const sign of [-1,1])for(let i=0;i<lv-10;i++){c.strokeStyle=i%2?p.secondary:p.accent;c.beginPath();c.moveTo(x+sign*height*.2,foot-height*.22);c.quadraticCurveTo(x+sign*height*(.46+i*.012),foot-height*.5,x+sign*height*(.30+i*.023),foot-height*(.76+i*.026));c.stroke();}}
  if(full){c.globalAlpha=.7;motif(c,art.spec.motif,x,foot-height*.92,height*.09,p.accent,Math.sin(t*.4)*.06);}
  c.restore();
}
function food(c,art,x,y,size){const p=art.colors;c.save();c.translate(x,y);c.scale(size/40,size/40);c.lineWidth=1.4;
  if(art.spec.food==='biscuit'){ellipse(c,20,21,15,13,'#d9ad67',true);c.fillStyle=p.secondary;for(const [x,y]of[[14,17],[23,15],[26,24],[15,25]]){c.beginPath();c.arc(x,y,1.5,0,7);c.fill();}}
  else{c.fillStyle=p.primary;c.beginPath();c.moveTo(3,18);c.quadraticCurveTo(7,36,20,36);c.quadraticCurveTo(33,36,37,18);c.closePath();c.fill();ellipse(c,20,18,17,7,p.accent,true);ellipse(c,20,17,15,5,'#fff6df',true);for(let i=0;i<5;i++)ellipse(c,9+i*5,16-i%2*4,3,art.spec.food==='fruit'?4:2,art.spec.food==='fruit'?'#eead62':'#fffdfa',true);motif(c,'lotus',20,31,4,p.accent);}
  c.restore();}
module.exports={choose,validate,compile,scene,effects,food,PALETTES,SCENES,MOTIFS,FOODS,matchPixels:require('./pet-colors').matchPixels};
