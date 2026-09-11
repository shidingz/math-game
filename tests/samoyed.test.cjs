const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../game/core.js'),growth=require('../game/growth.js'),dev=require('../game/test-tools.js'),root=path.join(__dirname,'..');
function registry(){const ctx={MathPetGrowth:growth,HTMLElement:class{},document:{currentScript:{src:'http://local/wukong.js'}},URL,customElements:{get(){return true},define(){}}};ctx.window=ctx;
  for(const file of ['wukong.js','characters/ragdoll/ragdoll-data.js','characters/samoyed/samoyed-data.js','characters/samoyed/samoyed-effects.js','game/characters.js','game/ragdoll-character.js','game/samoyed-character.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);return ctx;}
test('萨摩耶兑换扣300分，喂养独立，刷新后保留进度且默认仍是孙悟空',()=>{
  const ctx=registry(),cfg=ctx.MathPetCharacters.get('samoyed'),s=core.initialState({chooseStarter:false});assert.equal(cfg.unlock.cost,300);assert.equal(s.activePet,'wukong');
  s.points=299;const before=structuredClone(s);assert.equal(core.unlockPet(s,'samoyed',cfg).status,'insufficient');assert.deepEqual(s,before);
  s.points=320;assert.equal(core.unlockPet(s,'samoyed',cfg).status,'unlocked');assert.equal(s.points,20);assert.equal(core.unlockPet(s,'samoyed',cfg).status,'already-unlocked');assert.equal(s.points,20);
  assert.ok(core.selectPet(s,'samoyed',ctx.MathPetCharacters.list().map(c=>c.id)));assert.equal(core.feed(s,'samoyed',cfg).status,'fed');assert.equal(s.pets.samoyed.growth,20);assert.equal(s.pets.wukong.growth,0);assert.deepEqual(core.restore(s),s);
});
test('萨摩耶1至15级各有不同几何特效与递增体形，16级沿用最终外观',()=>{
  const ctx=registry(),d=ctx.SamoyedGameData;assert.deepEqual(Array.from(d.stages,s=>s.minLevel),[1,6,11]);
  assert.equal(new Set(Array.from({length:15},(_,i)=>ctx.SamoyedEffects.svg(i+1).replace(/data-effect="[^"]+"/,''))).size,15);
  for(let i=1;i<15;i++)assert.ok(d.levels[i].scale>d.levels[i-1].scale);
  assert.equal(ctx.SamoyedEffects.svg(16),ctx.SamoyedEffects.svg(15));assert.equal(d.clampLevel(900),15);
  for(let stage=1;stage<=3;stage++)for(const suffix of ['',...d.frames.map(x=>'-'+x),'-portrait'])assert.ok(fs.existsSync(path.join(root,`characters/samoyed/assets/stage-${stage}${suffix}.png`)));
  const cfg=ctx.MathPetCharacters.get('samoyed');for(const a of [...cfg.clickActions,...cfg.idleActions])assert.ok(d.actions[a]);
  for(const a of Object.keys(d.actions))for(const t of [0,250,500,4600])assert.ok(d.frameAt(a,t)>=0&&d.frameAt(a,t)<9);
});
test('七个伙伴的喂食时长全部为500ms，不按等级延长',()=>{
  const ctx=registry();assert.equal(core.RULES.feedDurationMs,500);assert.equal(ctx.WukongGameData.actions.feed.duration,500);
  for(const id of ['nezha','yutu','ragdoll','corgi','samoyed']){vm.runInNewContext(fs.readFileSync(path.join(root,`characters/${id}/${id}-data.js`),'utf8'),ctx);const data=ctx[id[0].toUpperCase()+id.slice(1)+'GameData'];assert.equal(data.actions.feed.durationMs,500,id);}
});
test('旧测试存档新增萨摩耶，测试默认伙伴为悟空，正式存档不会自动解锁',()=>{
  const ctx=registry(),chars=ctx.MathPetCharacters,s=dev.createState(chars.list().filter(c=>c.id!=='samoyed'));s.points=1234;s.pets.ragdoll.level=11;
  const saved=new Map([['math-pet-game:test:v1',JSON.stringify(s)],['math-pet-game:v2',JSON.stringify(s)]]);
  const boot=search=>{const box={window:{location:{search}},URLSearchParams,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},MathPetCore:core,MathPetCharacters:chars,MathPetTestTools:dev};vm.runInNewContext(fs.readFileSync(path.join(root,'game/storage.js'),'utf8'),box);return box.window.MathPetStorage;};
  const store=boot('?test=1'),next=store.load();assert.equal(next.points,1234);assert.equal(next.pets.ragdoll.level,11);assert.ok(core.isPetUnlocked(next,'samoyed'));
  dev.apply(next,'lock-others',null,chars.list());store.save(next);assert.equal(core.isPetUnlocked(store.load(),'samoyed'),false);
  const normal=boot('').load();assert.equal(core.isPetUnlocked(normal,'samoyed'),false);assert.equal(Object.hasOwn(normal.pets,'samoyed'),false);
});
test('each Samoyed level adds visible geometry and preserves all previously unlocked layers',()=>{
  const ctx=registry(),cfg=ctx.MathPetCharacters.get('samoyed');let previous=0,lastSize=0;
  for(let level=1;level<=15;level++){
    const svg=ctx.SamoyedEffects.svg(level),count=(svg.match(/<(path|circle|ellipse)\b/g)||[]).length;
    assert.ok(count>previous,`Lv.${level} must add actual visible elements`);previous=count;
    for(let i=1;i<=level;i++)assert.ok(svg.includes(`data-unlocked-at="${i}"`));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    const size=ctx.SamoyedGameData.levels[level-1].scale*cfg.ui.zoom[Math.floor((level-1)/5)];assert.ok(size>lastSize,`Lv.${level} total on-screen scale increases, including evolution`);lastSize=size;
  }
  assert.ok(previous>150,'Final level has a rich multi-layer composition');
});
