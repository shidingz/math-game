const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../game/core.js'),growth=require('../game/growth.js'),dev=require('../game/test-tools.js'),root=path.join(__dirname,'..');
function registry(){const ctx={MathPetGrowth:growth,HTMLElement:class{},document:{currentScript:{src:'http://local/wukong.js'}},URL,customElements:{get(){return true},define(){}}};ctx.window=ctx;
  for(const file of ['wukong.js','characters/ragdoll/ragdoll-data.js','characters/samoyed/samoyed-data.js','characters/samoyed/samoyed-effects.js','characters/siamese/siamese-data.js','characters/siamese/siamese-effects.js','game/characters.js','game/ragdoll-character.js','game/samoyed-character.js','game/siamese-character.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);return ctx;}
test('暹罗猫兑换扣300分，喂养独立，刷新后保留进度且默认仍是孙悟空',()=>{
  const ctx=registry(),cfg=ctx.MathPetCharacters.get('siamese'),s=core.initialState({chooseStarter:false});assert.equal(cfg.unlock.cost,300);assert.equal(s.activePet,'wukong');
  s.points=299;const before=structuredClone(s);assert.equal(core.unlockPet(s,'siamese',cfg).status,'insufficient');assert.deepEqual(s,before);
  s.points=320;assert.equal(core.unlockPet(s,'siamese',cfg).status,'unlocked');assert.equal(s.points,20);assert.equal(core.unlockPet(s,'siamese',cfg).status,'already-unlocked');
  assert.ok(core.selectPet(s,'siamese',ctx.MathPetCharacters.list().map(c=>c.id)));assert.equal(core.feed(s,'siamese',cfg).status,'fed');assert.equal(s.pets.siamese.growth,20);assert.equal(s.pets.wukong.growth,0);assert.deepEqual(core.restore(s),s);
});
test('暹罗猫1至15级各有不同累积特效与递增体形，16级沿用最终外观',()=>{
  const ctx=registry(),d=ctx.SiameseGameData,cfg=ctx.MathPetCharacters.get('siamese');assert.deepEqual(Array.from(d.stages,s=>s.minLevel),[1,6,11]);
  assert.equal(new Set(Array.from({length:15},(_,i)=>ctx.SiameseEffects.svg(i+1).replace(/data-effect="[^"]+"/,''))).size,15);
  let lastSize=0;
  for(let level=1;level<=15;level++){
    const svg=ctx.SiameseEffects.svg(level);assert.equal((svg.match(/data-unlocked-at=/g)||[]).length,level,`Lv.${level} has ${level} effect layers`);
    for(let i=1;i<=level;i++)assert.ok(svg.includes(`data-unlocked-at="${i}"`));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    const size=d.levels[level-1].scale*cfg.ui.zoom[Math.floor((level-1)/5)];assert.ok(size>lastSize,`Lv.${level} total on-screen scale increases`);lastSize=size;
  }
  assert.equal(ctx.SiameseEffects.svg(16),ctx.SiameseEffects.svg(15));assert.equal(d.clampLevel(900),15);
  for(let stage=1;stage<=3;stage++)for(const suffix of ['',...d.frames.map(x=>'-'+x),'-portrait'])assert.ok(fs.existsSync(path.join(root,`characters/siamese/assets/stage-${stage}${suffix}.png`)));
  for(const a of [...cfg.clickActions,...cfg.idleActions])assert.ok(d.actions[a]);
});
test('八个伙伴的喂食时长全部为500ms，不按等级延长',()=>{
  const ctx=registry();assert.equal(core.RULES.feedDurationMs,500);assert.equal(ctx.WukongGameData.actions.feed.duration,500);
  for(const id of ['nezha','yutu','ragdoll','corgi','samoyed','siamese']){vm.runInNewContext(fs.readFileSync(path.join(root,`characters/${id}/${id}-data.js`),'utf8'),ctx);const data=ctx[id[0].toUpperCase()+id.slice(1)+'GameData'];assert.equal(data.actions.feed.durationMs,500,id);}
});
test('旧测试存档自动补入暹罗猫，正式存档不会自动解锁',()=>{
  const ctx=registry(),chars=ctx.MathPetCharacters,s=dev.createState(chars.list().filter(c=>c.id!=='siamese'));s.points=1234;s.pets.samoyed.level=11;
  const saved=new Map([['math-pet-game:test:v1',JSON.stringify(s)],['math-pet-game:v2',JSON.stringify(s)]]);
  const boot=search=>{const box={window:{location:{search}},URLSearchParams,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},MathPetCore:core,MathPetCharacters:chars,MathPetTestTools:dev};vm.runInNewContext(fs.readFileSync(path.join(root,'game/storage.js'),'utf8'),box);return box.window.MathPetStorage;};
  const store=boot('?test=1'),next=store.load();assert.equal(next.points,1234);assert.equal(next.pets.samoyed.level,11);assert.ok(core.isPetUnlocked(next,'siamese'));
  dev.apply(next,'lock-others',null,chars.list());store.save(next);assert.equal(core.isPetUnlocked(store.load(),'siamese'),false);
  const normal=boot('').load();assert.equal(core.isPetUnlocked(normal,'siamese'),false);assert.equal(Object.hasOwn(normal.pets,'siamese'),false);
});
