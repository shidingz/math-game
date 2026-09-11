const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../game/core.js'),dev=require('../game/test-tools.js');
const root=path.join(__dirname,'..');
function registry(){
  const ctx={URL,HTMLElement:class{},customElements:{get:()=>false,define(){}},MathPetGrowth:require('../game/growth.js'),document:{currentScript:{src:'http://local/wukong.js'}}};ctx.window=ctx;
  for(const file of ['wukong.js','characters/nezha/nezha-data.js','characters/yutu/yutu-data.js','characters/ragdoll/ragdoll-data.js','game/characters.js','game/ragdoll-character.js','game/nezha-character.js','game/yutu-character.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  return ctx.MathPetCharacters;
}
test('三位伙伴独立配置，玉兔使用月宫场景、桂花糕和 15 级成长',()=>{
  const r=registry(),y=r.get('yutu');assert.equal(r.list().length,4);assert.equal(y.ui.scene,'moon');assert.equal(y.food.name,'桂花糕');assert.equal(y.unlock.cost,300);assert.equal(y.effects.length,15);
  assert.equal(new Set(y.effects.map(e=>e.effect)).size,15);assert.ok(fs.existsSync(path.join(root,y.food.iconImage)));
  assert.deepEqual(Array.from(y.stages,s=>s.minLevel),[1,6,11]);assert.equal(core.totalAt(6,y),300);assert.equal(core.totalAt(11,y),800);assert.equal(core.totalAt(15,y),1500);
});
test('答题数不自动解锁玉兔；兑换仅扣 300 分一次，喂养只改变玉兔',()=>{
  const y=registry().get('yutu'),s=core.initialState({chooseStarter:false});s.totalAnswered=1000;s.totalSolved=1000;s.points=299;
  assert.equal(core.isPetUnlocked(s,'yutu'),false);const before=structuredClone(s);assert.equal(core.unlockPet(s,'yutu',y).status,'insufficient');assert.deepEqual(s,before);
  s.points=320;assert.equal(core.unlockPet(s,'yutu',y).status,'unlocked');assert.equal(s.points,20);assert.equal(core.unlockPet(s,'yutu',y).status,'already-unlocked');assert.equal(s.points,20);
  assert.ok(core.selectPet(s,'yutu',['wukong','nezha','yutu']));assert.equal(core.feed(s,'yutu',y).status,'fed');assert.equal(s.points,0);assert.equal(s.pets.yutu.growth,20);assert.equal(s.pets.wukong.growth,0);
  const restored=core.restore(s);assert.equal(restored.activePet,'yutu');assert.equal(restored.unlockedPets.yutu,true);assert.equal(restored.pets.yutu.growth,20);
});
test('测试指令调整等级积分、模拟兑换锁定，并保护角色成长与答题统计',()=>{
  const chars=registry().list(),s=dev.createState(chars);assert.equal(s.points,10000);assert.equal(s.activePet,'wukong');core.selectPet(s,'yutu',chars.map(c=>c.id));assert.equal(s.pets.yutu.level,1);
  for(let level=1;level<=15;level++){dev.apply(s,'level',level,chars);assert.equal(s.pets.yutu.level,level);dev.apply(s,'level-up',null,chars);assert.equal(s.pets.yutu.level,level+1);assert.equal(s.pets.yutu.growth,0);}
  assert.throws(()=>dev.apply(s,'level',0,chars),RangeError);dev.apply(s,'zero-points',null,chars);dev.apply(s,'add-points',null,chars);assert.equal(s.points,1000);
  dev.apply(s,'lock-others',null,chars);assert.equal(s.activePet,'wukong');assert.equal(core.isPetUnlocked(s,'yutu'),false);assert.equal(s.pets.yutu.level,16);
  dev.apply(s,'unlock-all',null,chars);assert.ok(core.isPetUnlocked(s,'yutu'));assert.equal(s.points,1000);assert.equal(s.totalSolved,0);
});
test('测试和正式存档完全隔离，测试首次启动不读取正式或旧存档',()=>{
  const chars=registry(),saved=new Map(),reads=[];const formal=core.initialState({chooseStarter:false});formal.points=47;saved.set('math-pet-game:v2',JSON.stringify(formal));
  const boot=search=>{const ctx={URLSearchParams,MathPetCore:core,MathPetCharacters:chars,MathPetTestTools:dev,localStorage:{getItem(k){reads.push(k);return saved.get(k)||null;},setItem(k,v){saved.set(k,v);}},location:{search}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync(path.join(root,'game/storage.js'),'utf8'),ctx);return ctx.MathPetStorage;};
  const testStore=boot('?test=1'),s=testStore.load();assert.equal(s.points,10000);assert.deepEqual(reads,['math-pet-game:test:v1']);s.points=99999;testStore.save(s);
  assert.equal(boot('').load().points,47);assert.equal(boot('?test=1').load().points,99999);assert.equal(boot('?test=0').isTest,false);
});
test('危险 ID 或与配置不匹配的兑换请求不修改任何状态',()=>{
  const s=core.initialState({chooseStarter:false}),before=structuredClone(s);for(const id of ['constructor','prototype','__proto__','yutu'])assert.equal(core.unlockPet(s,id,{id:'nezha',unlock:{cost:0}}).status,'unavailable');assert.deepEqual(s,before);
});
