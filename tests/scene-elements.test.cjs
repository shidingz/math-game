const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../wechat/runtime/scene-elements'),FX=require('../wechat/runtime/growth-effects');
function context(){
 const ops=[],target={createLinearGradient:(...args)=>{ops.push(['gradient',...args]);return {addColorStop:(...v)=>ops.push(['stop',...v])};}};
 const c=new Proxy(target,{get:(o,k)=>o[k]||((...args)=>ops.push([k,...args])),set:(o,k,v)=>{ops.push(['set',k,v]);return true;}});
 return {c,ops};
}
test('56个真实可绘制元素全部参与场景组合，没有占位名称或未使用元素',()=>{
 assert.equal(E.CATALOG.length,56);assert.equal(new Set(E.CATALOG.map(e=>e.id)).size,56);
 assert.deepEqual(Object.keys(E.PAINTERS).sort(),E.CATALOG.map(e=>e.id).sort());
 const reachable=new Set();
 for(const theme of E.THEMES)for(let seed=0;seed<128;seed+=16){
  const w=E.world({hue:35,seed},theme.id),r=E.recipe(w,15);r.slots.forEach(s=>reachable.add(s.id));r.float.forEach(id=>reachable.add(id));
 }
 assert.deepEqual([...reachable].sort(),E.CATALOG.map(e=>e.id).sort());
});
test('56种图形不是同一占位图，不使用图片；颜色、坐标和透明度均有效',()=>{
 const w=E.world({hue:35,seed:0}),shapes=new Set();
 for(const {id}of E.CATALOG){const {c,ops}=context();E.paint(c,id,0,0,20,w.palette);shapes.add(JSON.stringify(ops));assert.ok(!ops.some(o=>o[0]==='drawImage'));assert.ok(ops.flat().every(v=>typeof v!=='number'||Number.isFinite(v)));}
 assert.equal(shapes.size,56);
});
test('八种世界每级有界叠加，稳定组合；减少动态不改变随时间的画面',()=>{
 for(const theme of E.THEMES){
  const w=E.world({hue:210,seed:38},theme.id);let previous=[];
  for(let level=1;level<=15;level++){
   const r=E.recipe(w,level);assert.ok(r.slots.length<=17&&r.floating<=6);for(const s of previous)assert.ok(r.slots.some(v=>JSON.stringify(v)===JSON.stringify(s)));previous=r.slots;
   const {c,ops}=context();E.backdrop(c,w,12,170,366,300,level,3000);E.floaters(c,w,{x:195,foot:455,width:350,height:280,level,time:3000});
   assert.ok(ops.flat().every(v=>typeof v!=='number'||Number.isFinite(v)));assert.ok(!ops.some(v=>v[0]==='drawImage'));
  }
  const record=time=>{const {c,ops}=context();E.backdrop(c,w,0,0,366,300,15,time,true);E.floaters(c,w,{x:195,foot:300,width:350,height:260,level:15,time,reducedMotion:true});return JSON.stringify(ops);};assert.equal(record(0),record(9999));
 }
 const p=FX.profile({id:'custom-keep',stages:[{color:'#a47743'}]});assert.deepEqual(E.world(p),E.world(FX.profile({id:'custom-keep',stages:[{color:'#a47743'}]})));
});
