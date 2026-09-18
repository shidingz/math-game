const {test}=require('node:test'),assert=require('node:assert/strict');
const FX=require('../wechat/runtime/growth-effects'),Geometry=require('../wechat/runtime/pet-geometry');
test('each level strengthens bounded effects, with new elements at milestones and no post-15 explosion',()=>{
 let before;
 for(let n=1;n<=15;n++){const r=FX.recipe(n);if(before){assert.ok(r.radius>before.radius);assert.ok(r.opacity>before.opacity);assert.ok(r.size>before.size);assert.ok(r.count>=before.count);}assert.ok(r.count<=11&&r.rings<=2&&r.arcs<=2&&r.comets<=2);before=r;}
 assert.equal(FX.recipe(5).arcs,0);assert.equal(FX.recipe(6).arcs,1);assert.equal(FX.recipe(11).arcs,2);assert.equal(FX.recipe(15).crown,true);
 assert.equal(FX.recipe(5).crystals,0);assert.equal(FX.recipe(6).crystals,2);assert.equal(FX.recipe(11).crystals,4);assert.equal(FX.recipe(10).wings,false);assert.equal(FX.recipe(11).wings,true);
 assert.deepEqual(FX.recipe(9999),FX.recipe(15));assert.equal(FX.recipe(-2).level,1);
});
test('宠物逐级长大，跨阶段更换宽窄体型也不突然缩小，15级之后尺寸封顶',()=>{
 const boxes=[{x:120,y:50,width:230,height:400},{x:30,y:120,width:440,height:330},{x:70,y:40,width:340,height:410}];
 const data={aligned:true,frames:[{pivotX:256,pivotY:450}],stages:boxes.map(b=>({bounds:[b]}))};
 let before=0,first;
 for(let n=1;n<=15;n++){
  const b=Geometry.fit(data,Math.floor((n-1)/5),0,Geometry.home(800).pet,n,'idle',0,0,true).bounds;
  const h=b.bottom-b.top;assert.ok(h>before);before=h;if(n===1)first=h;
 }
 assert.ok(before>first*1.8);assert.equal(Geometry.growthScale(999),Geometry.growthScale(15));
});
test('colour comes from pet pixels; ID only chooses a repeatable element combination',()=>{
 const pet={id:'custom-a',effectColors:[{colors:{primary:'#9e6740'},match:{hue:30,lightness:.8,neutral:false}}]};
 const a=FX.profile(pet),b=FX.profile({...pet,id:'custom-b'});assert.equal(a.hue,30);assert.equal(a.ink,b.ink);assert.equal(a.lightPet,true);assert.deepEqual(a,FX.profile(JSON.parse(JSON.stringify(pet))));
 const kinds=new Set();for(let i=0;i<30;i++)FX.profile({...pet,id:'custom-'+i}).motifs.forEach(x=>kinds.add(x));assert.ok(kinds.size>=6);
 assert.equal(FX.profile({id:'gray',stages:[{color:'#999999'}]}).hue,210);
});
test('四种觉醒元素按色相而非角色名称选择，中性毛色采用冰晶',()=>{
 for(const [hue,neutral,domain]of [[30,false,'solar'],[120,false,'leaf'],[200,false,'ice'],[285,false,'thunder'],[30,true,'ice']]){
  const p=FX.profile({id:'custom-any',effectColors:[{colors:{primary:'#ab8240'},match:{hue,neutral,lightness:.6}}]});assert.equal(p.domain,domain);assert.ok(p.domainName);
 }
});
test('all levels and all vector primitives draw without image, network, random or invalid numbers',()=>{
 const ops=[],c=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||((...a)=>ops.push([k,...a])),set:()=>true}),p=FX.profile({id:'custom-rules'});
 for(const shape of FX.ELEMENTS)FX.element(c,shape,195,150,8,p.ink,.2);
 for(const hue of [30,120,200,285])for(let n=1;n<=15;n++){
  const domain=FX.profile({id:'all-domains',effectColors:[{colors:{primary:'#ab8240'},match:{hue,neutral:false,lightness:.6}}]});
  FX.backdrop(c,domain,12,151,366,360,n);FX.draw(c,domain,{x:195,foot:500,width:350,height:350,level:n,time:3000,burstAge:200,full:n===6});
 }
 assert.ok(!ops.some(a=>a[0]==='drawImage'));assert.ok(ops.every(a=>a.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
 const record=t=>{ops.length=0;FX.draw(c,p,{x:195,foot:500,width:350,height:350,level:15,time:t,burstAge:20,reducedMotion:true});return JSON.stringify(ops);};assert.equal(record(0),record(9000));
});
test('larger pet area keeps all poses, rotations and jumping within visible boundaries at small phone heights',()=>{
 const boxes=[{x:100,y:70,width:312,height:378},{x:48,y:150,width:416,height:298},{x:70,y:340,width:372,height:108}];
 const data={aligned:true,frames:boxes.map(()=>({pivotX:256,pivotY:448})),stages:[{bounds:boxes}]};
 for(const h of [660,740,820,920]){
  const layout=Geometry.home(h),area=layout.pet;assert.ok(layout.scene.height<=440&&layout.scene.height<=h-400);assert.ok(layout.buttonHeight>=60);assert.ok(layout.footerY+layout.footerHeight<=h);assert.ok(layout.scene.y+layout.scene.height<layout.noticeY);assert.ok(layout.noticeY<layout.growthY);assert.ok(layout.growthY+layout.growthHeight<layout.buttonsY);
  const adult=Geometry.fit(data,0,0,area,15,'idle',0,0,true).bounds;assert.ok(adult.bottom-adult.top<layout.scene.height*.75);assert.ok(adult.top>layout.scene.y+layout.scene.height*.15);
  for(const level of [1,6,15])for(const action of ['idle','jump','skill','sleep'])for(let i=0;i<boxes.length;i++)for(let k=0;k<=20;k++){
   const p=Geometry.fit(data,0,i,area,level,action,k/20,3000),b=p.bounds;
   assert.ok(b.left>=layout.scene.x&&b.right<=layout.scene.x+layout.scene.width,JSON.stringify(p));assert.ok(b.top>=layout.scene.y&&b.bottom<=layout.scene.y+layout.scene.height,JSON.stringify(p));
  }
  assert.ok(Geometry.fit(data,0,2,area,1,'sleep',0).scale<=Geometry.fit(data,0,0,area,1,'idle',0).scale);
 }
});
