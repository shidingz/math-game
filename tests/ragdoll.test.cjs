const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../game/core.js'),root=path.join(__dirname,'..');
test('已有孙悟空的玩家，其他伙伴各扣 300 分且不能重复扣款',()=>{
  const s=core.initialState({chooseStarter:false});assert.equal(s.activePet,'wukong');assert.deepEqual(s.unlockedPets,{wukong:true});
  for(const id of ['ragdoll','nezha','yutu','corgi']){s.points=299;const before=structuredClone(s);assert.equal(core.unlockPet(s,id).status,'insufficient');assert.deepEqual(s,before);s.points=320;assert.equal(core.unlockPet(s,id).cost,300);assert.equal(s.points,20);assert.equal(core.unlockPet(s,id).status,'already-unlocked');assert.equal(s.points,20);}
  assert.equal(core.feed(s).status,'fed');assert.equal(s.pets.wukong.growth,20);assert.equal(s.points,0);
});
test('v2 正式存档保留悟空、兑换伙伴和余额；v3 刷新不自动加入布偶猫',()=>{
  const old={version:2,points:77,activePet:'yutu',grade:4,topic:'balanced',unlockedPets:{wukong:true,yutu:true},pets:{wukong:{level:16,growth:65,feeds:161},yutu:{level:6,growth:17,feeds:26}},totalSolved:500,totalAnswered:520,totalRounds:50,mistakes:[],round:null};
  const s=core.restore(old);assert.equal(s.activePet,'yutu');assert.equal(s.points,77);assert.equal(s.grade,4);assert.deepEqual(s.pets.wukong,old.pets.wukong);assert.deepEqual(s.pets.yutu,old.pets.yutu);assert.equal(s.unlockedPets.ragdoll,undefined);assert.equal(core.isPetUnlocked(s,'nezha'),false);assert.deepEqual(core.restore(s),s);
  const fresh=core.restore(core.initialState({chooseStarter:false}));assert.equal(core.isPetUnlocked(fresh,'wukong'),true);assert.equal(fresh.activePet,'wukong');
});
test('布偶猫三阶段素材、九个独立姿势、十五种特效和逐级体形成长',()=>{
  const ctx={};ctx.window=ctx;for(const file of ['ragdoll-data.js','ragdoll-effects.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'characters/ragdoll',file),'utf8'),ctx);
  const d=ctx.RagdollGameData;assert.deepEqual(Array.from(d.stages,x=>x.minLevel),[1,6,11]);assert.equal(d.actions.feed.durationMs,core.RULES.feedDurationMs);
  for(let i=1;i<15;i++)assert.ok(d.levels[i].scale>d.levels[i-1].scale);assert.equal(new Set(Array.from({length:15},(_,i)=>ctx.RagdollEffects.svg(i+1))).size,15);assert.equal(ctx.RagdollEffects.svg(16),ctx.RagdollEffects.svg(15));
  for(let stage=1;stage<=3;stage++)for(const suffix of ['',...d.frames.map(x=>'-'+x),'-portrait'])assert.ok(fs.existsSync(path.join(root,`characters/ragdoll/assets/stage-${stage}${suffix}.png`)));
  for(const [name,action] of Object.entries(d.actions)){for(const time of [0,400,1600,10000])assert.ok(d.frameAt(name,time)>=0&&d.frameAt(name,time)<9);assert.ok(action.frames.length>0);}
  assert.equal(d.frameAt('idle',4500),1);assert.equal(d.frameAt('idle',4500,true),0);
});
test('测试版保留孙悟空默认值，正式版需要选择初始宠物',()=>{
  const core=require('../game/core.js'),dev=require('../game/test-tools.js');
  const characters=[{id:'wukong'},{id:'ragdoll'}];
  assert.equal(dev.createState(characters).activePet,'wukong');
  assert.equal(core.initialState().starterChosen,false);assert.deepEqual(core.initialState().unlockedPets,{});
});
test('旧版布偶猫存档保持当前宠物和成长',()=>{
  const old={version:3,points:10,activePet:'ragdoll',unlockedPets:{ragdoll:true},pets:{ragdoll:{level:4,growth:12,feeds:7}},grade:2,topic:'balanced',round:null,totalSolved:3,totalAnswered:3,totalRounds:0,mistakes:[]};
  const s=core.restore(old);assert.equal(s.activePet,'ragdoll');assert.equal(s.unlockedPets.wukong,true);assert.deepEqual(s.pets.ragdoll,old.pets.ragdoll);assert.deepEqual(s.pets.wukong,{level:1,growth:0,feeds:0});
});
