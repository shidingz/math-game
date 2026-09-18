const {test}=require('node:test'),assert=require('node:assert/strict');
const Presets=require('../wechat/runtime/pet-presets');
const {validatePack,character}=require('../wechat/runtime/custom-pets');
test('new pets choose varied presets once; serializing and reopening retains their complete appearance',()=>{
  const specs=Array.from({length:40},(_,i)=>Presets.choose('custom-pet-'+i));
  assert.ok(new Set(specs.map(s=>s.scene)).size===3);assert.ok(new Set(specs.map(s=>s.motif)).size===3);
  for(let i=0;i<specs.length;i++){
    assert.deepEqual(Presets.choose('custom-pet-'+i),specs[i]);
    assert.deepEqual(Presets.compile(JSON.parse(JSON.stringify(specs[i]))),Presets.compile(specs[i]));
  }
  assert.throws(()=>Presets.validate({...specs[0],scene:'https://remote-script'}));
  assert.throws(()=>Presets.validate({...specs[0],seed:Infinity}));
  assert.throws(()=>Presets.validate({...specs[0],palette:'__proto__'}));
});
test('data-only procedural pack keeps common economy and template anchors, with no food texture required',()=>{
  const raw={schemaVersion:1,id:'custom-preset',name:'伙伴',revision:'v1',cellSize:512,layout:'template-v1',stages:[1,2,3].map(n=>({image:`https://pets.test/s${n}.png`})),procedural:{...Presets.choose('custom-preset'),code:'ignored'}};
  const safe=validatePack(raw,['pets.test']),c=character(safe,{ui:{palette:{}}});
  assert.equal(safe.procedural.code,undefined);assert.equal(c.food.cost,20);assert.equal(c.food.growth,20);assert.equal(c.food.embedded,true);
  assert.equal(c.frames[0].pivotY,448);assert.equal(c.food.image,undefined);assert.equal(c.scene,undefined);assert.deepEqual(c.textures,{});
  assert.ok(c.aligned);assert.deepEqual(c.procedural.spec,Presets.choose('custom-preset'));
});
test('all preset recipes draw at every level without images or random per-frame choices',()=>{
  const operations=[];const c=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:(...args)=>operations.push([k,...args]),set:(o,k,v)=>true});
  for(let n=0;n<30;n++){
    const art=Presets.compile(Presets.choose('custom-draw-'+n));
    Presets.scene(c,art,0,0,350,300);Presets.food(c,art,0,0,30);
    for(let level=1;level<=15;level++)Presets.effects(c,art,175,280,240,level,1234,level===6||level===11);
  }
  assert.ok(operations.length>1000);assert.ok(!operations.some(([name])=>name==='drawImage'));
  assert.ok(operations.every(op=>op.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
});
