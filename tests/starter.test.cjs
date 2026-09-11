const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../game/core.js');
const ids=Object.keys(core.RULES.petUnlockCost);
test('每种初始宠物都可免费选一次，其他伙伴包括悟空一律300分',()=>{
  for(const id of ids){const s=core.initialState();assert.equal(core.chooseStarter(s,id,ids),true);assert.equal(s.points,0);assert.deepEqual(Object.keys(s.unlockedPets),[id]);assert.equal(s.activePet,id);
    const before=structuredClone(s);assert.equal(core.chooseStarter(s,ids.find(x=>x!==id),ids),false);assert.deepEqual(s,before);assert.deepEqual(core.restore(s),s);
    for(const other of ids.filter(x=>x!==id)){s.points=299;assert.equal(core.unlockPet(s,other).status,'insufficient');s.points=300;assert.equal(core.unlockPet(s,other).cost,300);assert.equal(s.points,0);assert.equal(core.unlockPet(s,other).status,'already-unlocked');}
  }
});
test('不能绕过初始选择、免费重复选宠或选择精卫及危险ID',()=>{
  const s=core.initialState();for(const id of ['jingwei','__proto__','constructor','missing'])assert.equal(core.chooseStarter(s,id,ids),false);
  s.points=500;assert.equal(core.unlockPet(s,'wukong').status,'unavailable');assert.equal(core.chooseStarter(s,'ragdoll',ids),true);assert.equal(core.unlockPet(s,'jingwei',{id:'jingwei',unlock:{cost:300}}).status,'unavailable');assert.equal(core.selectPet(s,'jingwei',['jingwei']),false);
});
test('移除精卫后旧存档保留其他宠物和积分，精卫进度只留作归档',()=>{
  const old={version:3,activePet:'jingwei',points:520,grade:2,unlockedPets:{wukong:true,jingwei:true,ragdoll:true},pets:{wukong:{level:6,growth:40,feeds:20},jingwei:{level:12,growth:30,feeds:80},ragdoll:{level:8,growth:22,feeds:30}}};
  const s=core.restore(old);assert.equal(s.activePet,'wukong');assert.equal(s.points,520);assert.equal(s.starterChosen,true);assert.deepEqual(s.pets.ragdoll,old.pets.ragdoll);assert.equal(s.pets.jingwei,undefined);assert.equal(s.unlockedPets.jingwei,undefined);assert.deepEqual(s.retiredPets.jingwei,old.pets.jingwei);assert.deepEqual(core.restore(s),s);
});
test('新布偶猫存档刷新不会白送悟空或再次允许领养',()=>{
  const s=core.initialState();core.chooseStarter(s,'ragdoll',ids);s.points=40;core.feed(s);const restored=core.restore(s);assert.equal(core.isPetUnlocked(restored,'wukong'),false);assert.equal(restored.pets.ragdoll.growth,20);assert.equal(restored.starterChosen,true);assert.equal(core.chooseStarter(restored,'wukong',ids),false);
});
