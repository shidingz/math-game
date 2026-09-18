'use strict';
// Shared, shipped art. No fetch to a model, generated source, or random theme.
const {hsl}=require('./pet-colors');
const VERSION='v1';
const THEMES=[
 {id:'gold',name:'浮空日冕',hue:38,tint:'#ffcf82'},
 {id:'jade',name:'翡翠幻林',hue:145,tint:'#8dffd6'},
 {id:'ice',name:'极光星海',hue:215,tint:'#99dbff'},
 {id:'violet',name:'紫晶星环',hue:282,tint:'#d9a0ff'}
];
function rgb(color){return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));}
function select(colors,match){
 const p=hsl(...rgb(colors.primary)),neutral=typeof match?.neutral==='boolean'?match.neutral:p.s<.18;
 const hue=Number.isFinite(match?.hue)?match.hue:p.h;
 const distance=h=>Math.min(Math.abs(h-hue),360-Math.abs(h-hue));
 const theme=neutral?THEMES[2]:THEMES.reduce((a,b)=>distance(b.hue)<distance(a.hue)?b:a);
 const lightPet=Number.isFinite(match?.lightness)?match.lightness>.70:hsl(...rgb(colors.sky)).l<.86;
 return {...theme,version:VERSION,method:'nearest-hue-v1',neutral,lightPet,scene:`shared-art/${VERSION}/${theme.id}.jpg`,halo:`shared-art/${VERSION}/${theme.id}-halo.png`};
}
function scene(c,image,theme,x,y,w,h,time){
 c.save();
 const zoom=1.025+Math.sin(time/16000)*.015,scale=Math.max(w/image.width,h/image.height)*zoom,sw=w/scale,sh=h/scale;
 c.drawImage(image,(image.width-sw)/2,(image.height-sh)*.62,sw,sh,x,y,w,h);
 // Keep light fur readable without changing its palette or generated pixels.
 const shade=c.createRadialGradient?.(x+w/2,y+h*.60,0,x+w/2,y+h*.60,w*.65);
 if(shade?.addColorStop){shade.addColorStop(0,theme.lightPet?'rgba(10,18,35,.28)':'rgba(255,255,255,.10)');shade.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=shade;c.fillRect(x,y,w,h);}
 c.restore();
}
function effects(c,image,theme,x,foot,height,level,time,full){
 c.save();const stage=level<6?0:level<11?1:2,t=time/1000;
 if(image){
  c.save();c.translate(x,foot-height*.50);c.rotate(Math.sin(t*.19)*.06);const size=height*(.82+stage*.10+(full?.12:0));
  c.globalAlpha=(full?.78:.24+stage*.14)+Math.sin(t*1.3)*.04;
  c.drawImage(image,-size/2,-size/2,size,size);c.restore();
  c.save();c.translate(x,foot-2);c.globalAlpha=full?.55:.22+stage*.08;const w=height*(.72+stage*.08);
  c.drawImage(image,-w/2,-height*.065,w,height*.13);c.restore();
 }
 // Curved rising comets add motion to the prebaked portal, never cover the face.
 c.strokeStyle=theme.tint;c.lineWidth=full?2:1.2;
 for(let i=0;i<4+stage*3;i++){
  const phase=(t*.10+i*.113)%1,sign=i%2?1:-1;
  const xx=x+sign*height*(.28+.15*Math.sin(phase*Math.PI)),yy=foot-height*(.06+phase*.85);
  c.globalAlpha=Math.sin(phase*Math.PI)*(full?.85:.55);
  c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx-sign*4,yy+7,xx-sign*6,yy+14);c.stroke();
 }
 c.restore();
}
module.exports={VERSION,THEMES,select,scene,effects};
