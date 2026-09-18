const {test}=require('node:test'),assert=require('node:assert/strict'),FX=require('../wechat/runtime/pet-particles');
const profile={seed:21,hue:225,baseHue:225,neutral:false,characterId:'samoyed',custom:false};
function record(options={},p=profile){const ops=[],c=new Proxy({},{get:(o,k)=>o[k]||((...args)=>ops.push([k,...args])),set:(o,k,v)=>{o[k]=v;return true;}});const r=FX.draw(c,p,{x:195,foot:480,width:302,height:220,level:11,time:900,front:false,getImage:()=>{throw Error('Theme effects must not request particle textures');},...options});return{ops,r};}
test('内置八伙伴保留线上主题差异，自定义伙伴按首阶段配色稳定分类',()=>{
 const families=new Set();for(const id of ['wukong','ragdoll','corgi','samoyed','siamese','bichon','nezha','yutu'])families.add(FX.selection({...profile,characterId:id}).id);assert.equal(families.size,8);
 for(let baseHue=0;baseHue<360;baseHue+=30){const a={...profile,characterId:'custom-photo',custom:true,baseHue,baseNeutral:false};const first=FX.selection(a);assert.equal(FX.selection({...a,hue:310}).id,first.id);assert.ok(FX.FAMILIES.some(f=>f.id===first.id));assert.notEqual(first.id,'guard');}
});
test('全等级取消彩带与粒子，主题图形仅2至5个，15级以后视觉封顶',()=>{
 let last=0;for(let level=1;level<=15;level++){const {r,ops}=record({level});assert.equal(r.ribbonCount,0);assert.equal(r.particleCount,0);assert.equal(r.sprites,0);assert.equal(r.burstCount,0);assert.ok(r.motifCount>=last&&r.motifCount<=5);last=r.motifCount;assert.ok(!ops.some(o=>o[0]==='drawImage'||o[0]==='setLineDash'));assert.ok(ops.every(o=>o.slice(1).every(n=>typeof n!=='number'||Number.isFinite(n))));}
 assert.deepEqual(FX.recipe(999),FX.recipe(15));
});
test('所有主题只在宠物背后绘制完整几何，不覆盖前景脸部',()=>{
 for(const characterId of Object.keys(FX.BUILTINS)){const p={...profile,characterId},back=record({},p),front=record({front:true},p);assert.ok(back.ops.some(o=>o[0]==='stroke'));assert.equal(front.ops.length,0);assert.equal(back.r.familyId,front.r.familyId);}
});
test('普通升级与进化整体增强但无粒子爆发，结束后恢复',()=>{
 assert.ok(record({burstAge:500}).r.surge>0);assert.ok(record({burstAge:2400,evolved:true}).r.surge>0);assert.equal(record({burstAge:4000,evolved:true}).r.surge,0);assert.equal(record({burstAge:500,evolved:true}).r.burstCount,0);
});
test('减少动态模式固定主题图形，普通模式缓慢浮动',()=>{
 assert.deepEqual(record({reducedMotion:true,time:0}).ops,record({reducedMotion:true,time:9000}).ops);assert.notDeepEqual(record({time:0}).ops,record({time:9000}).ops);
});

test('同色新伙伴也能取得多种主题与组合，刷新和进化不改变图形身份',()=>{
 const ids=new Set(),looks=new Set(),used=new Set();
 for(const neutral of [false,true])for(const baseHue of [25,115,210,295]){
  const band=new Set();
  for(let i=0;i<100;i++){
   const p={characterId:'photo-library-'+i,custom:true,seed:i,baseHue,hue:baseHue,baseNeutral:neutral,neutral};
   const a=FX.selection(p),b=FX.selection({...p,hue:(baseHue+160)%360,neutral:!neutral});
   assert.equal(a.id,b.id);assert.deepEqual(a.motifs,b.motifs);assert.equal(a.layout,b.layout);assert.equal(a.motion,b.motion);
   assert.deepEqual(FX.selection(JSON.parse(JSON.stringify(p))),a);
   assert.notEqual(a.id,'guard');band.add(a.id);ids.add(a.id);looks.add([a.id,a.motifs,a.layout,a.motion].join(':'));
   a.motifs.forEach(id=>used.add(id));
  }
  assert.ok(band.size>=5,'Each color band should offer alternatives');
 }
 assert.equal(ids.size,19);assert.ok(looks.size>100);assert.ok(used.has('butterfly')&&used.has('planet')&&used.has('shell')&&used.has('lantern'));
});
test('32个完整图形全部可画，所有主题全等级绘制保持有效数值并平衡Canvas状态',()=>{
 const library=require('../wechat/runtime/effect-motifs'),known=new Set(library.MOTIFS.map(m=>m.id));
 assert.equal(known.size,32);assert.equal(FX.FAMILIES.length,20);
 for(const family of FX.FAMILIES)for(const id of family.motifs)assert.ok(known.has(id));
 for(const m of library.MOTIFS){
  let saves=0,strokes=0;const c=new Proxy({},{get:(o,k)=>o[k]||((...args)=>{if(k==='save')saves++;if(k==='restore')saves--;if(k==='stroke')strokes++;assert.ok(saves>=0);assert.ok(args.every(n=>typeof n!=='number'||Number.isFinite(n)));}),set:(o,k,v)=>{o[k]=v;return true;}});
  library.drawMotif(c,m.id,100,100,20,['#4b98eb','#9879df','#d9f5ff'],0);
  assert.equal(saves,0,m.id);assert.ok(strokes>0,m.id);
 }
 const seen=new Set();
 for(let i=0;i<250;i++){
  const p={characterId:'sample-'+i,custom:true,baseHue:i%4*90,hue:210,baseNeutral:i%5===0};
  const f=FX.selection(p);if(seen.has(f.id))continue;seen.add(f.id);
  for(const level of [1,5,6,10,11,15]){
   const {ops,r}=record({level,burstAge:600},p);assert.equal(r.motifs.length,r.motifCount);
   assert.ok(ops.every(o=>o.slice(1).every(n=>typeof n!=='number'||Number.isFinite(n))));
   assert.equal(ops.filter(o=>o[0]==='save').length,ops.filter(o=>o[0]==='restore').length);
   assert.equal(record({level,front:true},p).ops.length,0);
   assert.deepEqual(record({level,reducedMotion:true,time:0},p).ops,record({level,reducedMotion:true,time:9000},p).ops);
  }
 }
 assert.equal(seen.size,19);
});
test('白灰幼态进化为彩色后使用当前配色，但不重新选择主题',()=>{
 const p={characterId:'color-evolution',custom:true,baseHue:210,baseNeutral:true,hue:210,neutral:true};
 const gray=FX.selection(p),orange=FX.selection({...p,hue:25,neutral:false});
 assert.equal(gray.id,orange.id);assert.deepEqual(gray.motifs,orange.motifs);assert.notDeepEqual(gray.colors,orange.colors);assert.match(orange.colors[0],/hsl\(25,/);
 const colorful={...p,baseHue:120,baseNeutral:false,hue:120,neutral:false};
 const green=FX.selection(colorful),white=FX.selection({...colorful,hue:210,neutral:true});
 assert.equal(green.id,white.id);assert.deepEqual(white.colors,gray.colors);
});
