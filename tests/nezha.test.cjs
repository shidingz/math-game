const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../game/core.js');
function registry(){
  const context={URL,HTMLElement:class{},customElements:{get:()=>false,define(){}},MathPetGrowth:require('../game/growth.js'),
    document:{currentScript:{src:'http://local/wukong.js'},createElement(tag){return {tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},setInteractionLabel(){},play(){},setLevel(){},pause(){},addEventListener(){},removeEventListener(){},remove(){}};}}};
  context.window=context;
  for(const file of ['wukong.js','characters/nezha/nezha-data.js','game/characters.js','game/nezha-character.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  return context.MathPetCharacters;
}
test('游戏注册悟空与哪吒，哪吒使用独立主题和实际食物图片',()=>{
  const r=registry(),n=r.get('nezha');assert.equal(r.list().length,2);assert.equal(n.ui.scene,'lotus');assert.notEqual(n.ui.palette.primary,r.get('wukong').ui.palette.primary);
  assert.equal(n.food.name,'莲花酥');assert.ok(fs.existsSync(path.join(__dirname,'..',n.food.iconImage)));
  assert.equal(n.stages.length,3);assert.equal(n.effects.length,15);
  for(let i=1;i<=3;i++)assert.ok(fs.existsSync(path.join(__dirname,`../characters/nezha/assets/stage-${i}.png`)));
});
test('哪吒适配器关闭内置随机待机，使用游戏统一调度',()=>{
  const pet=registry().get('nezha').create({level:6});assert.equal(pet.element.tag,'nezha-game-pet');assert.equal(pet.element.attrs.level,6);assert.equal(pet.element.attrs['auto-idle'],'false');
});
test('首次选择哪吒不影响悟空成长、共享积分及当前答题进度',()=>{
  const s=core.initialState({chooseStarter:false});s.points=370;s.pets.wukong={level:5,growth:86,feeds:14};s.grade=0;s.topic='count10';core.startRound(s);
  const round=s.round;assert.equal(core.selectPet(s,'nezha',['wukong','nezha']),false);assert.equal(core.unlockPet(s,'nezha',registry().get('nezha')).status,'unlocked');assert.ok(core.selectPet(s,'nezha',['wukong','nezha']));
  assert.deepEqual(s.pets.nezha,{level:1,growth:0,feeds:0});assert.deepEqual(s.pets.wukong,{level:5,growth:86,feeds:14});assert.equal(s.points,70);assert.equal(s.round,round);assert.equal(s.grade,0);
});
test('喂养哪吒只改变哪吒，切换与存档恢复保留双方成长',()=>{
  const s=core.initialState({chooseStarter:false});s.points=400;assert.equal(core.unlockPet(s,'nezha',registry().get('nezha')).status,'unlocked');core.selectPet(s,'nezha',['ragdoll','nezha']);
  const result=core.feed(s,s.activePet,registry().get('nezha'));assert.equal(result.status,'fed');assert.equal(s.points,80);assert.equal(s.pets.nezha.growth,20);assert.equal(s.pets.wukong.growth,0);
  core.selectPet(s,'wukong',['wukong','nezha']);core.feed(s);core.selectPet(s,'nezha',['wukong','nezha']);
  const saved=core.restore(JSON.parse(JSON.stringify(s)));assert.equal(saved.activePet,'nezha');assert.equal(saved.points,60);assert.deepEqual(saved.pets,s.pets);
});
test('旧悟空存档可添加哪吒且不重置原有进度',()=>{
  const s=core.restore({version:1,activePet:'wukong',points:80,pets:{wukong:{level:8,growth:30,feeds:40}}});
  const before=structuredClone(s.pets.wukong);assert.equal(core.selectPet(s,'nezha',['wukong','nezha']),false);s.points=380;assert.equal(core.unlockPet(s,'nezha',registry().get('nezha')).status,'unlocked');assert.ok(core.selectPet(s,'nezha',['wukong','nezha']));assert.deepEqual(s.pets.wukong,before);assert.equal(s.points,80);
});
test('300 积分兑换哪吒，积分不足或刷新都不能绕过兑换',()=>{
  const locked=core.initialState({chooseStarter:false});assert.equal(core.isPetUnlocked(locked,'nezha'),false);assert.equal(core.selectPet(locked,'nezha',['wukong','nezha']),false);assert.deepEqual(locked.pets,{wukong:{level:1,growth:0,feeds:0}});
  locked.points=299;assert.equal(core.unlockPet(locked,'nezha',registry().get('nezha')).status,'insufficient');assert.equal(locked.points,299);
  locked.points=300;assert.equal(core.unlockPet(locked,'nezha',registry().get('nezha')).status,'unlocked');assert.equal(locked.points,0);assert.equal(core.selectPet(locked,'nezha',['wukong','nezha']),true);
  const restored=core.restore(JSON.parse(JSON.stringify(locked)));assert.equal(restored.activePet,'nezha');assert.equal(restored.unlockedPets.nezha,true);
  const old=core.restore({...locked,unlockedPets:undefined,activePet:'nezha'});assert.equal(old.activePet,'wukong');
});
test('未知或危险角色 ID 不修改存档，哪吒使用既定慢速成长曲线',()=>{
  const s=core.initialState({chooseStarter:false}),before=structuredClone(s);for(const id of ['missing','__proto__','constructor'])assert.equal(core.selectPet(s,id,['wukong','nezha']),false);assert.deepEqual(s,before);
  const cfg=registry().get('nezha');assert.equal(core.totalAt(6,cfg),300);assert.equal(core.totalAt(11,cfg),800);assert.equal(core.totalAt(15,cfg),1500);assert.equal(core.required(15,cfg),300);
});
