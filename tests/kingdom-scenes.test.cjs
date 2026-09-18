const{test}=require('node:test'),assert=require('node:assert/strict'),K=require('../wechat/runtime/kingdom-scenes');
const pet=(hue,id='pet')=>({id,effectColors:[{colors:{primary:'#876543'},match:{hue,neutral:false,lightness:.6}}]});
test('旧Q版特效整体退役，不再请求光座、圆环或玩具粒子',()=>{
 let calls=0;const c=new Proxy({},{get:()=>()=>{calls++;}});const p=K.profile(pet(35));
 for(const level of [1,6,11,15]){const r=K.draw(c,p,{level,getImage:()=>{calls++;}});assert.equal(r.retiredEffects,true);}
 assert.equal(calls,0);assert.equal(K.GROUPS.length,6);
});
test('室内室外先等概率分组，暖色和中性色均不会偏向室内，变体交替',()=>{
 for(const hue of [25,120,210,280]){let outdoor=0;
  for(let n=0;n<1000;n++){const a=K.profile(pet(hue,'sample-'+n)),b=K.profile(pet(hue,'sample-'+n),0,1);if(a.environment==='outdoor')outdoor++;assert.notEqual(a.environment,b.environment);}
  assert.ok(outdoor>=480&&outdoor<=520);
 }
});
test('48个元素均有真实图集位置，并可通过规则组合被选中',()=>{
 assert.equal(K.CATALOG.length,48);assert.equal(new Set(K.CATALOG.map(e=>e.id)).size,48);const used=new Set();
 for(let hue=0;hue<360;hue+=5)for(let seed=0;seed<80;seed++){
  const p=K.profile(pet(hue,'pet-'+seed));used.add(p.skyGroup+'-'+p.skyIndex);if(p.themeIndex<8)used.add('grounds-'+p.groundIndex);p.scenery.forEach(s=>used.add(s.id));p.living.forEach(s=>used.add('living-'+s.index));
 }
 assert.deepEqual([...used].sort(),K.CATALOG.map(e=>e.id).sort());
});
test('配色约束随机结果，重复加载稳定，变体丰富且不由名字选色',()=>{
 const designs=new Set();for(let n=0;n<100;n++){
  const a=K.profile(pet(30,'warm-'+n));assert.ok(K.distance(a.world.hue,30)<=85);designs.add(JSON.stringify([a.world.id,a.scenery]));
  assert.deepEqual(a,K.profile({...pet(30,'warm-'+n),name:'完全不同名称'}));
 }
 assert.ok(designs.size>=20);
 const p=pet(210);assert.deepEqual(K.profile(p),K.profile(JSON.parse(JSON.stringify(p))));assert.notDeepEqual(K.profile(p,0,1),K.profile(p,0,2));
});
test('全主题、等级与减少动态绘制：有界数量，图集坐标有效，不依赖加载成功',()=>{
 function ctx(){const ops=[];const c=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||((...a)=>ops.push([k,...a])),set:()=>true});return {c,ops};}
 const image={width:896,height:448};
 for(const theme of K.THEMES){const p=K.profile(pet(theme.hue),0,0,theme.id),{c,ops}=ctx();
  for(let n=1;n<=15;n++){const r=K.recipe(n);assert.ok(r.count<=9);K.backdrop(c,p,12,165,366,321,n,800,false,()=>image);K.draw(c,p,{x:195,foot:475,width:350,height:280,level:n,time:800,burstAge:100,getImage:()=>image});}
  assert.ok(ops.every(op=>op.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
  for(const op of ops.filter(op=>op[0]==='drawImage'))assert.ok(op[2]>=0&&op[3]>=0&&op[2]+op[4]<=896&&op[3]+op[5]<=448);
  const record=t=>{const {c,ops}=ctx();K.backdrop(c,p,0,0,366,321,15,t,true,()=>image);K.draw(c,p,{x:195,foot:315,width:350,height:280,level:15,time:t,reducedMotion:true,burstAge:2,getImage:()=>image});return JSON.stringify(ops);};assert.equal(record(0),record(9000));
  K.backdrop(c,p,0,0,366,321,15);K.draw(c,p,{x:195,foot:315,width:350,height:280,level:15});
 }
 assert.deepEqual(K.recipe(999),K.recipe(15));assert.equal(K.recipe(15).retiredEffects,true);
});
