'use strict';
// Design preview only. Canvas trajectories and sprite tinting need no model calls.
const GROUPS=[
 ['celestial','星光',['四角星芒','六角星闪','十字闪光','微星光点','细碎星尘','菱形星晶','针状星爆','星尘轮廓']],
 ['flutter','飞舞',['光蝶','燕尾蝶','侧飞蝶','羽毛','花瓣','柳叶','光花','微光蜻蜓']],
 ['trails','光迹',['流星','彗星','星尘曲线','弧形光丝','速度光线','极光轻纱','流萤','星光飞溅']],
 ['essence','自然魔法',['冰晶','雪花','火星','露珠','蒲公英','微光羽翼','花粉','电弧']]
];
const CATALOG=GROUPS.flatMap(([group,label,names])=>names.map((name,index)=>({id:group+'-'+index,group,index,name,label})));
const PRESETS=[
 {id:'ribbons',name:'流动星河',note:'三股光丝沿曲线路径流动，细碎星尘随行',hue:235,flow:'ribbons',items:[['celestial',0,'orbit'],['celestial',3,'rise']]},
 {id:'starcloud',name:'璀璨星尘',note:'密集小光点错落闪烁，沿两侧上升和扩散',hue:35,flow:'starcloud',items:[['celestial',0,'rise'],['celestial',2,'rise'],['celestial',4,'rise']]},
 {id:'wisps',name:'追光流星',note:'明亮光头带长拖尾，三颗流星前后穿行',hue:280,flow:'wisps',items:[['celestial',3,'orbit'],['essence',6,'rise']]},
 {id:'electric',name:'灵动电弧',note:'短电弧跳动分叉，带发光核心与零散火花',hue:160,flow:'electric',items:[['celestial',2,'rise'],['essence',7,'orbit']]},
 {id:'stardust',name:'星屑环游',note:'星芒错落闪烁，星尘绕身流动',hue:205,items:[['celestial',0,'orbit'],['celestial',4,'rise'],['celestial',2,'orbit'],['celestial',5,'orbit']]},
 {id:'butterflies',name:'灵蝶伴飞',note:'薄翼轻扇，蝶群沿不规则曲线飞舞',hue:265,items:[['flutter',0,'flutter'],['flutter',1,'flutter'],['flutter',2,'flutter'],['celestial',3,'rise']]},
 {id:'meteors',name:'流星穿梭',note:'快慢交替的短流星与拖尾星尘',hue:210,items:[['trails',0,'meteor'],['trails',1,'meteor'],['celestial',0,'orbit'],['celestial',4,'rise']]},
 {id:'aurora',name:'极光萦绕',note:'细光丝缓慢游移，萤火点亮周围',hue:170,items:[['trails',3,'orbit'],['trails',5,'orbit'],['trails',6,'rise'],['celestial',3,'orbit']]},
 {id:'frost',name:'霜晶回旋',note:'细雪晶旋转，冰尘向上漂浮',hue:195,items:[['essence',0,'orbit'],['essence',1,'orbit'],['celestial',1,'rise'],['celestial',4,'rise']]},
 {id:'garden',name:'花羽微风',note:'花瓣、羽毛与光花交错轻舞',hue:330,items:[['flutter',3,'flutter'],['flutter',4,'flutter'],['flutter',6,'orbit'],['essence',4,'rise']]},
 {id:'fireflies',name:'流萤余烬',note:'小火星与流萤向上跃动，短促闪亮',hue:18,items:[['essence',2,'rise'],['trails',6,'rise'],['trails',7,'meteor'],['celestial',2,'orbit']]},
 {id:'mixed',name:'星蝶流光',note:'少量蝴蝶、流星与星芒形成前后层次',hue:235,items:[['flutter',0,'flutter'],['trails',0,'meteor'],['celestial',0,'orbit'],['essence',6,'rise']]}
];
function hash(s){let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function rng(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function particles({preset,seed=1,level=11,time=0,width=480,height=420,reducedMotion=false,density=1}){
 const r=rng(seed),t=reducedMotion?2.8:time/1000,progress=clamp((level-1)/14,0,1);
 const count=Math.round((preset.flow==='starcloud'?40+progress*55:preset.flow?8+progress*12:12+progress*25)*density),out=[];
 for(let i=0;i<count;i++){
  const [group,index,motion]=preset.items[i%preset.items.length],phase=r(),speed=.07+r()*.12,side=r()<.5?-1:1,rx=width*(.32+r()*.14),ry=height*(.30+r()*.12);
  const life=(phase+t*speed)%1,angle=phase*Math.PI*2+t*(.22+r()*.16)*side;
  let x,y,rotation=0,flip=1;
  if(motion==='meteor'){
   x=side*width*(.45-life*.12);y=height*(-.42+life*.87);rotation=side<0?-.65:.45;
  }else if(motion==='rise'){
   x=side*width*(.29+.12*Math.sin(phase*8+t*.6));y=height*(.44-life*.88);rotation=t*.35+phase*8;
  }else{
   x=Math.cos(angle)*rx;y=Math.sin(angle)*ry;
   if(motion==='flutter'){x+=Math.sin(t*1.3+phase*12)*width*.03;y+=Math.sin(t*1.8+phase*8)*height*.035;flip=.45+.55*Math.abs(Math.sin(t*5.5+phase*9));rotation=Math.sin(t*.7+phase*8)*.30;}
   else rotation=phase*5+t*.12*side;
  }
  // Preserve a face/body window: particles occupy the perimeter, not the face.
  const q=Math.sqrt((x/(width*.265))**2+(y/(height*.30))**2);
  if(q<1){x/=Math.max(q,.05);y/=Math.max(q,.05);}
  const flicker=.74+.26*Math.sin(t*(1.6+phase*2)+phase*20)**2;
  const alpha=motion==='rise'||motion==='meteor'?Math.max(.15,Math.sin(life*Math.PI)**.45)*flicker:flicker;
  const weight=preset.flow==='starcloud'?.60:group==='flutter'?1.5:group==='trails'?1.8:1;
  const size=(15+progress*20)*( .65+phase*.7)*weight;
  out.push({group,index,motion,x,y,rotation,flip,alpha,size,front:i%3===0,hueOffset:(i%3-1)*20});
 }
 return out;
}
function paint(ctx,points,{x,y,tinted,front}){
 for(const p of points){if(p.front!==front)continue;const image=tinted(p.group,p.index,p.hueOffset);if(!image)continue;
  ctx.save();ctx.translate(x+p.x,y+p.y);ctx.rotate(p.rotation);ctx.scale(p.flip,1);ctx.globalAlpha=p.alpha;
  // Soft dark edge gives daylight readability; luminous core comes from sprite.
  ctx.shadowColor='rgba(24,42,79,.75)';ctx.shadowBlur=3.5;
  ctx.drawImage(image,-p.size/2,-p.size/2,p.size,p.size);ctx.restore();
 }
}
function flow(ctx,{preset,x,y,width,height,level,time,hue,seed=1,front=false,reducedMotion=false,tinted}){
 if(!preset.flow||preset.flow==='starcloud')return;
 const t=reducedMotion?3:time/1000,growth=clamp((level-1)/14,0,1),kind=preset.flow;
 const number=kind==='electric'?2:level>=11?3:level>=6?2:1;
 const point=(u,j,offset=0)=>({x:x+Math.cos(u)*width*(.36+j*.018)+Math.sin(u*2.2+j)*width*.025,
  y:y+Math.sin(u)*height*(.34+j*.019)+Math.sin(u*2+t*.3+j)*height*.05+offset});
 const isFront=p=>p.y>y+height*.23; // Front trails stay beneath the face and chest.
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(let j=0;j<number;j++){
  const head=t*(kind==='wisps'?.85:.52)+j*2.1+(seed%51)/17,span=kind==='wisps'?1.35:kind==='electric'?1.0:2.3;
  const n=48,rand=rng(hash(seed+':'+j+':'+Math.floor(t*9)));
  const points=[];
  for(let k=0;k<=n;k++){
   const q=k/n,p=point(head-span*(1-q),j);
   if(kind==='electric'&&k>0&&k<n){p.x+=(rand()-.5)*width*.047;p.y+=(rand()-.5)*height*.047;}
   points.push(p);
  }
  for(let k=1;k<=n;k++){
   const a=points[k-1],b=points[k],q=k/n;
   if(isFront(b)!==front)continue;
   const hh=(hue+j*17)%360,alpha=(.22+.70*q)*(kind==='electric'?.75+.25*Math.sin(t*11+j)**2:1);
   for(const [size,light,opacity]of [[18+growth*9,52,.24],[6+growth*3,60,.82],[2+growth*1.4,94,1]]){
    ctx.strokeStyle='hsla('+hh+',95%,'+light+'%,'+(alpha*opacity)+')';ctx.lineWidth=size*(.22+.78*q);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }
   if(kind==='ribbons'){
    // Braided strands move at different phases, forming a stream, not a ring.
    for(const side of [-2,-1,1,2]){
     const oa=Math.sin((k-1)/n*5+t*.8+side)*side*8,ob=Math.sin(k/n*5+t*.8+side)*side*8;
     ctx.strokeStyle='hsla('+((hh+side*18+360)%360)+',95%,74%,'+(alpha*.85)+')';ctx.lineWidth=(1.2+growth*.8)*(.35+.65*q);
     ctx.beginPath();ctx.moveTo(a.x+oa,a.y+side*5);ctx.lineTo(b.x+ob,b.y+side*5);ctx.stroke();
    }
   }
   if(kind==='electric'&&k%12===0){
    const branch={x:b.x+(rand()-.5)*width*.1,y:b.y-height*.06};ctx.strokeStyle='hsla('+hh+',95%,82%,.9)';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(branch.x,branch.y);ctx.lineTo(branch.x-5,branch.y-8);ctx.stroke();
   }
  }
  const headP=points[n];
  if(kind!=='ribbons'&&isFront(headP)===front){
   const im=tinted('celestial',3,j*17),size=kind==='wisps'?42+growth*20:30;
   if(im){ctx.globalAlpha=1;ctx.drawImage(im,headP.x-size/2,headP.y-size/2,size,size);}
  }
  if(kind==='ribbons')for(let k=0;k<28;k++){
   const u=head-span+(k/28*span+t*.5)%span,p=point(u,j,Math.sin(k*1.7+t)*6);
   if(isFront(p)!==front)continue;
   const im=tinted('celestial',k%6===0?0:3,j*17),size=k%6===0?22:7+(k%3)*3;
   if(im){ctx.globalAlpha=.95;ctx.drawImage(im,p.x-size/2,p.y-size/2,size,size);}
  }
 }
 ctx.restore();
}
module.exports={GROUPS,CATALOG,PRESETS,particles,paint,flow};
