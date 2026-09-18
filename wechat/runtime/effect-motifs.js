'use strict';
// Whole vector emblems, not a particle emitter. Coordinates use the requested
// radius; time is in seconds, matching the website-inspired effects renderer.
const MOTIFS=Object.freeze([
 ['star','四角星芒'],['crystal','菱形冰晶'],['snow','六角雪花'],['leaf','舒展叶片'],
 ['crescent','清辉月牙'],['cloud','轻盈祥云'],['shield','守护盾纹'],['lotus','五瓣莲纹'],['flame','柔焰灵光'],
 ['butterfly','灵蝶'],['feather','轻羽'],['blossom','五瓣花'],['bud','初生花苞'],['clover','四叶草'],['fern','羽状蕨叶'],
 ['raindrop','清澈水滴'],['wave','小小海浪'],['shell','贝壳'],['pearl','珍珠'],['comet','流星'],['planet','环星'],['sun','暖阳'],
 ['aurora','极光帘'],['prism','三棱光晶'],['icicle','冰凌'],['gem','切面宝石'],['heart','爱心'],['wing','舒展羽翼'],
 ['spiral','旋涡纹'],['bell','清音铃'],['lantern','暖光灯'],['spark','耀光']
].map(([id,name])=>Object.freeze({id,name})));
const DEFAULT_COLORS=['#7585db','#65c9e8','#ddeeff'];
function polygon(c,points,stroke,fill,width=1.6){
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
 if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=stroke;c.lineWidth=width;c.stroke();
}
function finish(c,colors,width=1.6,fill=true){
 if(fill){c.fillStyle=colors[2];c.fill();}c.strokeStyle=colors[0];c.lineWidth=width;c.stroke();
}
function detail(c,colors,width=1.15){c.strokeStyle=colors[1];c.lineWidth=width;c.stroke();}
// The original nine paths retain their geometry, colors and stroke widths.
function star(c,x,y,r,colors){
 const p=[];for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,R=i%2?r*.28:r;p.push([x+Math.cos(a)*R,y+Math.sin(a)*R]);}
 polygon(c,p,colors[0],colors[2],1.35);
}
function crystal(c,x,y,r,colors){
 polygon(c,[[x,y-r],[x+r*.56,y],[x,y+r],[x-r*.56,y]],colors[0],colors[2],1.6);
 c.strokeStyle=colors[1];c.lineWidth=1.2;c.beginPath();c.moveTo(x,y-r);c.lineTo(x,y+r);c.moveTo(x-r*.56,y);c.lineTo(x+r*.56,y);c.stroke();
}
function snow(c,x,y,r,colors){
 c.save();c.translate(x,y);c.strokeStyle=colors[0];c.lineWidth=1.9;c.lineCap='round';
 for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.moveTo(0,0);c.lineTo(0,-r);c.moveTo(-r*.25,-r*.67);c.lineTo(0,-r*.43);c.lineTo(r*.25,-r*.67);c.stroke();c.restore();}c.restore();
}
function leaf(c,x,y,r,colors,rotation=0){
 c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();c.moveTo(0,r);c.bezierCurveTo(-r,-r*.1,-r*.52,-r*.8,0,-r);c.bezierCurveTo(r*.8,-r*.55,r*.8,r*.1,0,r);c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.6;c.stroke();c.beginPath();c.moveTo(0,r*.6);c.lineTo(0,-r*.7);c.stroke();c.restore();
}
function crescent(c,x,y,r,colors){
 c.beginPath();c.moveTo(x+r*.45,y-r*.90);c.bezierCurveTo(x-r*1.2,y-r*1.08,x-r*1.2,y+r*1.08,x+r*.45,y+r*.90);c.bezierCurveTo(x-r*.38,y+r*.44,x-r*.38,y-r*.44,x+r*.45,y-r*.90);c.closePath();c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.8;c.stroke();
}
function cloud(c,x,y,r,colors){
 c.beginPath();c.moveTo(x-r,y+r*.27);c.bezierCurveTo(x-r*1.4,y-r*.42,x-r*.46,y-r*.77,x-r*.2,y-r*.36);c.bezierCurveTo(x+r*.02,y-r*1.08,x+r*.90,y-r*.66,x+r*.67,y-r*.10);c.bezierCurveTo(x+r*1.4,y-r*.22,x+r*1.25,y+r*.46,x+r*.53,y+r*.45);c.lineTo(x-r*.68,y+r*.45);c.closePath();c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.7;c.stroke();
}
function shield(c,x,y,r,colors){
 c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.45,y-r*.6,x+r*.8,y-r*.60);c.lineTo(x+r*.71,y+r*.15);c.quadraticCurveTo(x+r*.48,y+r*.72,x,y+r);c.quadraticCurveTo(x-r*.48,y+r*.72,x-r*.71,y+r*.15);c.lineTo(x-r*.8,y-r*.60);c.quadraticCurveTo(x-r*.45,y-r*.6,x,y-r);c.closePath();c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.6;c.stroke();
}
function lotus(c,x,y,r,colors){
 c.save();c.translate(x,y);
 for(const a of [-.88,-.44,0,.44,.88]){c.save();c.rotate(a);c.beginPath();c.moveTo(0,r*.48);c.bezierCurveTo(-r*.51,0,-r*.26,-r*.63,0,-r);c.bezierCurveTo(r*.26,-r*.63,r*.51,0,0,r*.48);c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.5;c.stroke();c.restore();}c.restore();
}
function flame(c,x,y,r,colors){
 c.beginPath();c.moveTo(x,y-r);c.bezierCurveTo(x+r*.2,y-r*.15,x+r*.97,y-r*.07,x+r*.5,y+r*.65);c.quadraticCurveTo(x,y+r*1.05,x-r*.52,y+r*.5);c.bezierCurveTo(x-r*.95,y-r*.20,x-r*.05,y-r*.20,x,y-r);c.fillStyle=colors[2];c.fill();c.strokeStyle=colors[0];c.lineWidth=1.7;c.stroke();
}
function butterfly(c,r,colors,t){
 const spread=.95+Math.sin(t*1.1)*.05;
 for(const side of [-1,1]){c.save();c.scale(side*spread,1);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(r*.28,-r*.92,r*1.03,-r*.98,r*.96,-r*.28);c.quadraticCurveTo(r*.90,r*.06,r*.40,r*.13);c.bezierCurveTo(r*.98,r*.10,r*.85,r*.93,r*.38,r*.70);c.quadraticCurveTo(r*.06,r*.52,0,0);c.closePath();finish(c,colors);c.restore();}
 c.beginPath();c.moveTo(0,-r*.33);c.lineTo(0,r*.52);c.moveTo(0,-r*.30);c.quadraticCurveTo(-r*.08,-r*.64,-r*.22,-r*.61);c.moveTo(0,-r*.30);c.quadraticCurveTo(r*.08,-r*.64,r*.22,-r*.61);detail(c,colors,1.5);
}
function feather(c,r,colors){
 c.beginPath();c.moveTo(-r*.56,r*.80);c.bezierCurveTo(-r*.90,-r*.10,-r*.10,-r*.96,r*.70,-r*.94);c.bezierCurveTo(r*.83,-r*.05,r*.37,r*.63,-r*.56,r*.80);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.72,r*.98);c.quadraticCurveTo(-r*.12,r*.14,r*.55,-r*.70);c.moveTo(-r*.16,r*.22);c.lineTo(-r*.42,-r*.17);c.moveTo(r*.07,-r*.06);c.lineTo(r*.48,-r*.07);detail(c,colors);
}
function blossom(c,r,colors){
 for(let i=0;i<5;i++){c.save();c.rotate(i*Math.PI*2/5);c.beginPath();c.moveTo(0,r*.04);c.bezierCurveTo(-r*.64,-r*.28,-r*.49,-r*.99,0,-r*.92);c.bezierCurveTo(r*.49,-r*.99,r*.64,-r*.28,0,r*.04);c.closePath();finish(c,colors,1.3);c.restore();}
 c.beginPath();c.arc(0,0,r*.19,0,Math.PI*2);c.fillStyle=colors[1];c.fill();
}
function bud(c,r,colors){
 c.beginPath();c.moveTo(0,r*.10);c.bezierCurveTo(-r*.65,-r*.03,-r*.58,-r*.69,-r*.21,-r*.97);c.quadraticCurveTo(0,-r*.82,r*.21,-r*.97);c.bezierCurveTo(r*.58,-r*.69,r*.65,-r*.03,0,r*.10);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(0,-r*.74);c.quadraticCurveTo(r*.13,-r*.30,0,r*.10);c.lineTo(0,r*.98);detail(c,colors,1.4);
 c.beginPath();c.moveTo(0,r*.62);c.quadraticCurveTo(-r*.57,r*.58,-r*.55,r*.17);c.quadraticCurveTo(-r*.10,r*.15,0,r*.62);c.moveTo(0,r*.82);c.quadraticCurveTo(r*.59,r*.78,r*.53,r*.35);c.quadraticCurveTo(r*.10,r*.42,0,r*.82);finish(c,colors,1.3);
}
function clover(c,r,colors){
 for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-r*.70,-r*.17,-r*.58,-r*.86,-r*.20,-r*.74);c.quadraticCurveTo(0,-r*.68,0,-r*.49);c.quadraticCurveTo(0,-r*.68,r*.20,-r*.74);c.bezierCurveTo(r*.58,-r*.86,r*.70,-r*.17,0,0);finish(c,colors,1.3);c.restore();}
 c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(r*.03,r*.75,r*.34,r*.98);detail(c,colors,1.4);
}
function fern(c,r,colors){
 c.beginPath();c.moveTo(0,r*.98);c.quadraticCurveTo(-r*.09,-r*.15,r*.10,-r*.98);detail(c,colors,1.5);
 for(const [y,w]of [[-.48,.35],[-.01,.53],[.44,.63]])for(const side of [-1,1]){
  c.beginPath();c.moveTo(0,r*(y+.25));c.quadraticCurveTo(side*r*w,r*(y+.15),side*r*w,r*(y-.18));c.quadraticCurveTo(side*r*.14,r*(y-.12),0,r*(y+.25));c.closePath();finish(c,colors,1.25);
 }
}
function raindrop(c,r,colors){
 c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(r*.29,-r*.52,r*.76,-r*.03,r*.65,r*.42);c.bezierCurveTo(r*.45,r*1.09,-r*.50,r*1.06,-r*.65,r*.42);c.bezierCurveTo(-r*.76,-r*.03,-r*.29,-r*.52,0,-r);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.32,r*.09);c.quadraticCurveTo(-r*.47,r*.39,-r*.20,r*.58);detail(c,colors,1.5);
}
function wave(c,r,colors){
 c.beginPath();c.moveTo(-r,r*.60);c.bezierCurveTo(-r*.52,r*.63,-r*.61,-r*.78,r*.10,-r*.73);c.bezierCurveTo(r*.66,-r*.70,r*.64,-r*.10,r*.28,-r*.04);c.quadraticCurveTo(r*.40,-r*.29,r*.12,-r*.34);c.bezierCurveTo(-r*.10,-r*.34,-r*.12,r*.27,r*.33,r*.45);c.quadraticCurveTo(r*.65,r*.60,r,r*.49);c.lineTo(r,r*.75);c.lineTo(-r,r*.75);c.closePath();finish(c,colors);
}
function shell(c,r,colors){
 c.beginPath();c.moveTo(-r*.26,r*.84);c.bezierCurveTo(-r*.72,r*.52,-r*1.03,-r*.18,-r*.76,-r*.52);c.quadraticCurveTo(-r*.57,-r*.92,-r*.28,-r*.74);c.quadraticCurveTo(0,-r*1.08,r*.28,-r*.74);c.quadraticCurveTo(r*.57,-r*.92,r*.76,-r*.52);c.bezierCurveTo(r*1.03,-r*.18,r*.72,r*.52,r*.26,r*.84);c.closePath();finish(c,colors);
 c.beginPath();for(const x of [-.50,0,.50]){c.moveTo(0,r*.66);c.lineTo(r*x,-r*.62);}detail(c,colors);
}
function pearl(c,r,colors){
 c.beginPath();c.arc(0,0,r*.77,0,Math.PI*2);finish(c,colors,1.6);
 c.beginPath();c.ellipse(-r*.22,-r*.24,r*.17,r*.11,-.55,0,Math.PI*2);c.fillStyle=colors[1];c.globalAlpha*=.48;c.fill();
}
function comet(c,r,colors){
 c.beginPath();c.moveTo(-r*.64,r*.48);c.quadraticCurveTo(-r*.62,-r*.36,r*.96,-r*.86);c.quadraticCurveTo(r*.35,-r*.15,r*.05,r*.50);c.closePath();finish(c,colors);
 star(c,-r*.44,r*.44,r*.39,colors);
}
function planet(c,r,colors){
 c.beginPath();c.arc(0,0,r*.61,0,Math.PI*2);finish(c,colors);
 c.beginPath();c.ellipse(0,0,r*1.04,r*.25,-.35,0,Math.PI*2);detail(c,colors,1.55);
}
function sun(c,r,colors){
 c.beginPath();c.arc(0,0,r*.54,0,Math.PI*2);finish(c,colors);
 c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;c.moveTo(Math.cos(a)*r*.75,Math.sin(a)*r*.75);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}detail(c,colors,1.65);
}
function aurora(c,r,colors){
 // One curtain silhouette with two folds, not travelling ribbons or specks.
 c.beginPath();c.moveTo(-r*.95,r*.63);c.bezierCurveTo(-r*.98,-r*.22,-r*.57,-r*.93,-r*.22,-r*.70);c.bezierCurveTo(r*.22,-r*.42,r*.45,-r*.93,r*.95,-r*.76);c.lineTo(r*.87,r*.56);c.bezierCurveTo(r*.47,r*.37,r*.24,r*.97,-r*.16,r*.67);c.quadraticCurveTo(-r*.50,r*.44,-r*.95,r*.63);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.34,-r*.67);c.quadraticCurveTo(-r*.55,r*.04,-r*.38,r*.56);c.moveTo(r*.45,-r*.72);c.quadraticCurveTo(r*.24,r*.01,r*.39,r*.66);detail(c,colors);
}
function prism(c,r,colors){
 polygon(c,[[0,-r],[-r*.84,r*.57],[r*.47,r*.88],[r*.88,r*.29]],colors[0],colors[2]);
 c.beginPath();c.moveTo(0,-r);c.lineTo(r*.47,r*.88);c.lineTo(-r*.84,r*.57);c.moveTo(r*.47,r*.88);c.lineTo(r*.88,r*.29);detail(c,colors);
}
function icicle(c,r,colors){
 polygon(c,[[-r*.36,-r*.92],[r*.18,-r],[r*.47,-r*.44],[r*.12,r],[-r*.43,-r*.17]],colors[0],colors[2]);
 c.beginPath();c.moveTo(r*.05,-r*.81);c.lineTo(r*.13,r*.62);c.moveTo(-r*.43,-r*.17);c.lineTo(r*.10,-r*.42);c.lineTo(r*.47,-r*.44);detail(c,colors);
}
function gem(c,r,colors){
 polygon(c,[[-r*.51,-r*.66],[r*.50,-r*.66],[r*.88,-r*.13],[0,r*.95],[-r*.88,-r*.13]],colors[0],colors[2]);
 c.beginPath();c.moveTo(-r*.88,-r*.13);c.lineTo(r*.88,-r*.13);c.moveTo(-r*.51,-r*.66);c.lineTo(-r*.27,-r*.13);c.lineTo(0,r*.95);c.lineTo(r*.27,-r*.13);c.lineTo(r*.50,-r*.66);detail(c,colors);
}
function heart(c,r,colors){
 c.beginPath();c.moveTo(0,r*.87);c.bezierCurveTo(-r*1.03,r*.15,-r*1.03,-r*.65,-r*.45,-r*.75);c.quadraticCurveTo(-r*.12,-r*.82,0,-r*.46);c.quadraticCurveTo(r*.12,-r*.82,r*.45,-r*.75);c.bezierCurveTo(r*1.03,-r*.65,r*1.03,r*.15,0,r*.87);c.closePath();finish(c,colors);
}
function wing(c,r,colors){
 c.beginPath();c.moveTo(-r*.74,r*.79);c.bezierCurveTo(-r*.85,-r*.27,r*.21,-r*.54,r*.91,-r*.96);c.quadraticCurveTo(r*.89,-r*.36,r*.37,-r*.07);c.quadraticCurveTo(r*.68,-r*.03,r*.83,-r*.18);c.quadraticCurveTo(r*.61,r*.43,r*.02,r*.42);c.quadraticCurveTo(r*.24,r*.56,r*.40,r*.53);c.quadraticCurveTo(-r*.14,r*.91,-r*.74,r*.79);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.64,r*.65);c.quadraticCurveTo(-r*.13,r*.08,r*.57,-r*.47);detail(c,colors);
}
function spiral(c,r,colors){
 c.beginPath();c.moveTo(r*.92,r*.05);c.bezierCurveTo(r*.85,-r*.82,-r*.52,-r*1.08,-r*.78,-r*.29);c.bezierCurveTo(-r*1.07,r*.55,-r*.22,r*1.06,r*.38,r*.62);c.bezierCurveTo(r*.83,r*.24,r*.32,-r*.48,-r*.08,-r*.22);c.quadraticCurveTo(-r*.39,-r*.05,-r*.10,r*.25);finish(c,colors,1.8,false);
}
function bell(c,r,colors){
 c.beginPath();c.moveTo(-r*.70,r*.52);c.quadraticCurveTo(-r*.49,r*.26,-r*.49,-r*.30);c.bezierCurveTo(-r*.49,-r*.94,r*.49,-r*.94,r*.49,-r*.30);c.quadraticCurveTo(r*.49,r*.26,r*.70,r*.52);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.20,r*.55);c.quadraticCurveTo(0,r*1.02,r*.20,r*.55);c.moveTo(0,-r*.77);c.lineTo(0,-r*.99);detail(c,colors,1.5);
}
function lantern(c,r,colors){
 c.beginPath();c.moveTo(-r*.28,-r*.68);c.bezierCurveTo(-r*.42,-r*1.10,r*.42,-r*1.10,r*.28,-r*.68);detail(c,colors,1.5);
 c.beginPath();c.moveTo(-r*.51,-r*.60);c.quadraticCurveTo(0,-r*.81,r*.51,-r*.60);c.lineTo(r*.61,r*.61);c.quadraticCurveTo(0,r*.87,-r*.61,r*.61);c.closePath();finish(c,colors);
 c.beginPath();c.moveTo(-r*.28,-r*.58);c.lineTo(-r*.34,r*.64);c.moveTo(r*.28,-r*.58);c.lineTo(r*.34,r*.64);c.moveTo(-r*.55,-r*.36);c.lineTo(r*.55,-r*.36);detail(c,colors);
}
function spark(c,r,colors){
 const p=[];for(let i=0;i<12;i++){const a=-Math.PI/2+i*Math.PI/6,R=i%2?r*.22:i%6===0?r:r*.74;p.push([Math.cos(a)*R,Math.sin(a)*R]);}polygon(c,p,colors[0],colors[2],1.3);
}
const ORIGINAL={star,crystal,snow,leaf,crescent,cloud,shield,lotus,flame};
const ADDED={butterfly,feather,blossom,bud,clover,fern,raindrop,wave,shell,pearl,comet,planet,sun,aurora,prism,icicle,gem,heart,wing,spiral,bell,lantern,spark};
function drawMotif(c,id,x,y,r,colors,time=0){
 if(!c||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r)||r<=0)return false;
 const color=Array.isArray(colors)&&colors.length>=3?colors:DEFAULT_COLORS,t=Number.isFinite(time)?time:0;
 const old=ORIGINAL[id],added=ADDED[id];if(!old&&!added)return false;
 c.save();
 try{
  c.lineCap='round';c.lineJoin='round';
  if(old)old(c,x,y,r,color,id==='leaf'?Math.sin(t)*.22:undefined);
  else{c.translate(x,y);added(c,r,color,t);}
 }finally{c.restore();}
 return true;
}
module.exports={MOTIFS,drawMotif};
