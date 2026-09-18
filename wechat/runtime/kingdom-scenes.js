'use strict';
// Prebuilt illustration assets; selection, composition and animation are all local rules.
const {hsl}=require('./pet-colors');
const VERSION='toy-worlds-v3',ROOT='world-art/'+VERSION;
const OUTDOOR_IDS=new Set(['playground','bus','beach','garden','camp','orchard','river','moon']);
const GROUPS=[
 ['skies','日常小世界',['阳光游乐场','温暖木屋','蓝天巴士站','星空魔法屋','冰淇淋海滩','云端小屋','薄荷花园','蜜桃车库']],
 ['grounds','活动地面',['花朵草坪','蜂蜜木台','蓝色游戏垫','星星软垫','贝壳沙岛','云朵地台','嫩叶地毯','桃粉广场']],
 ['nature','趣味小道具',['苹果树','彩色气球','太阳花','彩色积木','云朵靠垫','软糖棒棒糖','浆果灌木','玩具风车']],
 ['landmarks','玩具建筑与车',['圆顶木屋','星空小屋','黄色大巴','冰淇淋车','旋转木马','彩色滑梯','火箭住宅','游戏小厨房']],
 ['places','奇妙生活场景',['晚霞露营地','苹果野餐园','河畔小镇','月光露台','暖木图书室','海底观察室','玻璃花房','蜜桃烘焙屋']],
 ['living','会动的小景物',['彩色风筝','陶瓷风铃','折纸飞机','迷你热气球','双叶小枝','暖光提灯','旋转风车叶','摇摆帆船']]
];
const CATALOG=GROUPS.flatMap(([group,label,names])=>names.map((name,index)=>({id:group+'-'+index,group,label,index,name})));
const THEMES=[
 {id:'playground',name:'阳光游乐场',hue:90,sky:'#a4e6fd',ground:'#93da88',nature:[0,1,2,7],landmarks:[4,5,2],living:[0,2,3,6]},
 {id:'cabin',name:'温暖木屋',hue:35,sky:'#ffe1b0',ground:'#ecb56b',nature:[3,4,7],landmarks:[7,0],living:[1,2,5,6]},
 {id:'bus',name:'蓝天巴士站',hue:205,sky:'#aae5ff',ground:'#9bccf0',nature:[0,1,3,7],landmarks:[2,3],living:[0,2,3,6]},
 {id:'starhouse',name:'星空魔法屋',hue:280,sky:'#c5b4f9',ground:'#a69bdf',nature:[1,3,4,5],landmarks:[1,6],living:[1,2,3,5]},
 {id:'beach',name:'冰淇淋海滩',hue:175,sky:'#9bf0eb',ground:'#ffe0a0',nature:[1,2,5,7],landmarks:[3,0],living:[0,3,4,7]},
 {id:'cloud',name:'云端小屋',hue:220,sky:'#c1e8ff',ground:'#b6d8f9',nature:[1,3,4,7],landmarks:[1,6],living:[1,2,3,6]},
 {id:'garden',name:'薄荷花园',hue:130,sky:'#b5edcc',ground:'#9bd891',nature:[0,2,6,7],landmarks:[0,4,5],living:[0,1,4,6]},
 {id:'garage',name:'蜜桃车库',hue:355,sky:'#ffd3cb',ground:'#ffc4b6',nature:[1,3,5,7],landmarks:[2,3,7],living:[1,2,5,6]},
 {id:'camp',name:'晚霞露营地',hue:285,sky:'#b993f0',ground:'#b5da89',nature:[0,1,6],landmarks:[0],living:[0,3,4,5],groundIndex:0},
 {id:'orchard',name:'苹果野餐园',hue:55,sky:'#b8e6ed',ground:'#b9db80',nature:[0,2,6],landmarks:[0,3],living:[0,1,4,6],groundIndex:0},
 {id:'river',name:'河畔小镇',hue:190,sky:'#a8eaff',ground:'#bfe5de',nature:[1,2,6],landmarks:[0,2],living:[0,3,4,7],groundIndex:2},
 {id:'moon',name:'月光露台',hue:305,sky:'#b7a5ee',ground:'#d8b9de',nature:[1,4,5],landmarks:[1,6],living:[1,3,4,5],groundIndex:3},
 {id:'library',name:'暖木图书室',hue:35,sky:'#ffe1b0',ground:'#e8bd7e',nature:[3,4,7],landmarks:[0,7],living:[1,2,5,6],groundIndex:1},
 {id:'aquarium',name:'海底观察室',hue:195,sky:'#7cdded',ground:'#9bdcde',nature:[3,4,5],landmarks:[6],living:[1,2,6,7],groundIndex:2},
 {id:'greenhouse',name:'玻璃花房',hue:100,sky:'#dceac1',ground:'#c6ddad',nature:[0,2,6],landmarks:[0],living:[1,4,5,6],groundIndex:6},
 {id:'bakery',name:'蜜桃烘焙屋',hue:355,sky:'#ffcebb',ground:'#f8d6af',nature:[3,4,5],landmarks:[7],living:[1,2,5,6],groundIndex:7}
];
// Tall props always stay at the sides. These are alternatives, not layered together.
const LAYOUTS=[
 {id:'left-nook',slots:[{x:.13,y:.64,w:.29},{x:.90,y:.61,w:.19},{x:.07,y:.89,w:.15}]},
 {id:'right-nook',slots:[{x:.86,y:.64,w:.28},{x:.09,y:.60,w:.20},{x:.92,y:.90,w:.16}]},
 {id:'garden-corners',slots:[{x:.12,y:.58,w:.23},{x:.90,y:.62,w:.23},{x:.06,y:.84,w:.14}]},
 {id:'distant-toys',slots:[{x:.12,y:.52,w:.19},{x:.89,y:.54,w:.18},{x:.94,y:.84,w:.14}]},
 {id:'window-side',slots:[{x:.88,y:.66,w:.24},{x:.08,y:.76,w:.17}]},
 {id:'open-courtyard',slots:[{x:.12,y:.66,w:.22},{x:.91,y:.79,w:.15}]}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function hash(s){let n=2166136261;for(const ch of String(s))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function distance(a,b){return Math.abs(((a-b+540)%360)-180);}
function weighted(items,hue,rng,spread=48){
 const ranked=items.map((v,i)=>({v,i,d:distance(v.hue,hue)})).sort((a,b)=>a.d-b.d);
 const candidates=ranked.filter(a=>a.d<=ranked[0].d+spread);
 let weights=candidates.map(a=>1/(14+a.d)),total=weights.reduce((a,b)=>a+b,0),target=rng()*total;
 for(let i=0;i<candidates.length;i++){target-=weights[i];if(target<=0)return candidates[i].i;}return candidates[0].i;
}
function profile(character,stage=0,variant=0,themeOverride=''){
 const raw=character.effectColors?.[stage],art=character.procedural;
 let primary=raw?.colors?.primary||art?.colors?.primary||character.stages?.[stage]?.color||character.ui?.palette?.primary||'#7eb9ce';
 if(!/^#[a-f0-9]{6}$/i.test(primary))primary='#7eb9ce';
 const rgb=[1,3,5].map(i=>parseInt(primary.slice(i,i+2),16)),sample=hsl(...rgb),match=raw?.match||art?.spec?.match;
 const neutral=match?.neutral??sample.s<.15,hue=neutral?210:(match?.hue??sample.h),seed=hash(character.id+':'+variant),rng=random(seed);
 // Location is independent of coat hue: warm pets must not all land indoors.
 const outdoor=((hash(character.id+':environment')+Math.floor(variant))&1)===0;
 const pool=THEMES.filter(t=>OUTDOOR_IDS.has(t.id)===outdoor);
 const chosen=pool[weighted(pool,hue,rng,35)];
 const themeIndex=themeOverride?THEMES.findIndex(t=>t.id===themeOverride):THEMES.indexOf(chosen),world=THEMES[Math.max(0,themeIndex)];
 const pick=a=>a[Math.floor(rng()*a.length)],landmark=pick(world.landmarks),tree=pick(world.nature),small=pick(world.nature.filter(i=>i!==tree));
 const layout=pick(LAYOUTS),ids=['landmarks-'+landmark,'nature-'+tree,'nature-'+(small??tree)];
 const scenery=layout.slots.map((slot,i)=>({id:ids[i],...slot,flip:slot.x>.5}));
 const motionA=pick(world.living),motionB=pick(world.living.filter(i=>i!==motionA));
 const living=[{index:motionA,x:.14,y:[6,7].includes(motionA)?.72:.16,w:.15,phase:rng()*6.28},{index:motionB,x:.88,y:[6,7].includes(motionB)?.72:.22,w:.13,phase:rng()*6.28}];
 const index=THEMES.indexOf(world);
 return {version:VERSION,environment:OUTDOOR_IDS.has(world.id)?'outdoor':'indoor',seed,variant,hue,neutral,lightPet:(match?.lightness??sample.l)>.7,world,themeIndex:index,skyGroup:index<8?'skies':'places',skyIndex:index%8,groundIndex:world.groundIndex??index,sky:world.sky,
  ink:primary,domain:'toy-worlds',domainName:world.name,layout:layout.id,scenery,living,landmark,tree,small};
}
function recipe(level){return {level:clamp(Math.floor(Number(level)||1),1,15),count:0,retiredEffects:true};}
function path(group){return ROOT+'/'+group+(['skies','places'].includes(group)?'.jpg':'.png');}
function drawTile(c,getImage,group,index,x,y,w,h,alpha=1,rotation=0,flip=false){
 const img=getImage(path(group));if(!img)return false;
 const sw=img.width/4,sh=img.height/2;
 c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rotation);if(flip)c.scale(-1,1);
 // Sample inside each tile so interpolation never bleeds an adjacent scene.
 const inset=['skies','places'].includes(group)?1:0;
 c.drawImage(img,(index%4)*sw+inset,Math.floor(index/4)*sh+inset,sw-inset*2,sh-inset*2,-w/2,-h/2,w,h);c.restore();return true;
}
function sceneryFrame(p,time=0,reducedMotion=false){
 const t=reducedMotion?0:Math.max(0,time)/1000;
 const living=p.living.map(o=>{const phase=t+o.phase;let dx=0,dy=0,rotation=0;
  if(o.index===6)rotation=t*.8+o.phase; // Rotor has no pole; only blades turn.
  else if(o.index===1)rotation=Math.sin(phase*.9)*.10;
  else if(o.index===5){rotation=Math.sin(phase*.65)*.07;dy=Math.sin(phase*.9)*.006;}
  else if(o.index===7){dy=Math.sin(phase*1.1)*.008;rotation=Math.sin(phase*.8)*.05;}
  else{dx=Math.sin(phase*.4)*.018;dy=Math.sin(phase*.8)*.014;rotation=Math.sin(phase*.7)*.075;}
  return {...o,x:o.x+dx,y:o.y+dy,rotation,alpha:1};
 });
 // A quiet, occasional sky pass, never through the pet's face or body.
 const cycle=27+(p.seed%9),age=(t+(p.seed%13))%cycle;
 if(!reducedMotion&&age<5){const u=age/5,backwards=(p.seed&4)!==0;living.push({index:p.environment==='outdoor'?2:4,x:backwards?1.1-1.2*u:-.1+1.2*u,y:.09+Math.sin(u*Math.PI)*.045,w:.10,rotation:backwards?Math.PI:0,alpha:Math.min(1,u*8,(1-u)*8),transient:true});}
 return {time:t,living};
}
function backdrop(c,p,x,y,w,h,level,time=0,reducedMotion=false,getImage=()=>null){
 const r=recipe(level),frame=sceneryFrame(p,time,reducedMotion),t=frame.time;
 c.save();const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,p.world.sky);g.addColorStop(1,p.world.ground);c.fillStyle=g;c.fillRect(x,y,w,h);
 drawTile(c,getImage,p.skyGroup,p.skyIndex,x+w/2,y+h*.5,w,h);
 // Existing backgrounds already contain walkable floors. A small optional play
 // mat is enough; the new spaces need no extra raised platform at all.
 if(p.themeIndex<8)drawTile(c,getImage,'grounds',p.groundIndex,x+w/2,y+h*.84,w*.88,h*.48);
 for(const s of p.scenery){
  const group=s.id.split('-')[0],index=Number(s.id.split('-')[1]),size=w*s.w;
  const sway=group==='nature'&&[0,1,2,6].includes(index)?Math.sin(t*.6+index)*.018:0;
  drawTile(c,getImage,group,index,x+w*s.x,y+h*s.y,size,size,1,sway,s.flip);
 }
 for(const o of frame.living){const size=w*o.w;
  if(!o.transient&&[1,5,6].includes(o.index)){c.strokeStyle='#b58e68';c.lineWidth=1.1;c.beginPath();const px=x+w*o.x,py=y+h*o.y;c.moveTo(px,o.index===6?py+size*.1:y);c.lineTo(px,o.index===6?py+size*.58:py-size*.35);c.stroke();}
  drawTile(c,getImage,'living',o.index,x+w*o.x,y+h*o.y,size,size,o.alpha,o.rotation);}
 c.fillStyle='rgba(22,43,30,.15)';c.beginPath();c.ellipse(x+w*.5,y+h*.865,w*.24,h*.023,0,0,Math.PI*2);c.fill();
 c.restore();return {world:p.world.id,name:p.world.name,level:r.level,layout:p.layout,slots:p.scenery.map(s=>s.id),sky:p.skyGroup+'-'+p.skyIndex,ground:p.themeIndex<8?'grounds-'+p.groundIndex:null,living:frame.living};
}
// Q-style effects remain retired. pet-particles owns the separate particle layer.
function draw(c,p,{level}){return {...recipe(level),world:p.world.id};}
module.exports={VERSION,ROOT,OUTDOOR_IDS,GROUPS,CATALOG,THEMES,LAYOUTS,hash,random,distance,profile,recipe,path,drawTile,sceneryFrame,backdrop,draw};
