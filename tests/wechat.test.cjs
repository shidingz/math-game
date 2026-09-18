const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../game/core');
function runtime(name) {
  const file = path.resolve(__dirname, '../wechat/runtime', name + '.js');
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file })(
    id => id.startsWith('../shared/') ? require('../game/' + id.slice('../shared/'.length)) : id.startsWith('./') ? require('../wechat/runtime/' + id.slice(2)) : require(id), module, module.exports);
  return module.exports;
}
const Controller = runtime('controller');
const { createStorage, allowTest, Assets, FORMAL_KEY, TEST_KEY } = runtime('platform');
const chars = JSON.parse(fs.readFileSync(path.join(__dirname, '../asset-inventory.json'))).characters.map(c => ({ ...c,
  food: { cost: 20, growth: 20 }, unlock: { cost: 200 }, clickActions: ['skill', 'wave'], idleActions: ['think'], messages: {} }));
function setup(testMode = false) {
  const values = new Map();
  const api = { getStorageSync: key => values.get(key), setStorageSync: (key, value) => values.set(key, value) };
  const storage = createStorage(api, testMode, chars);
  const game = new Controller({ storage, characters: chars, testMode, random: () => .4 });
  return { api, values, storage, game };
}
function tick(game, ms) { while (ms > 0) { const step = Math.min(ms, 100); game.tick(step); ms -= step; } }

test('选择范围只保存并返回主页；相同范围续题，改变范围等待点击再建题', () => {
  const { game, storage } = setup(true);
  game.open('settings'); game.configure(0, 'add5');
  assert.equal(game.screen, 'home'); assert.equal(game.state.round, null);
  assert.equal(storage.load().grade, 0);
  game.startQuiz(); game.input = game.question.answerText; game.submit(); tick(game, 400);
  const round = game.state.round;
  game.home(); game.open('settings'); game.configure(0, 'add5');
  assert.equal(game.screen, 'home'); assert.equal(game.state.round, round);
  game.startQuiz(); assert.equal(game.state.round.index, 1);
  game.home(); game.open('settings'); game.configure(6, 'fraction');
  assert.equal(game.screen, 'home'); assert.equal(game.state.round, null);
  const next = new Controller({ storage, characters: chars });
  assert.equal(next.screen, 'home'); assert.equal(next.state.round, null);
  next.startQuiz(); assert.equal(next.state.round.grade, 6); assert.equal(next.screen, 'quiz');
});

test('自定义伙伴名字独立保存，刷新素材不覆盖，内置伙伴不可改名，失败回滚', () => {
  const { game, storage, api } = setup(true);
  const a = { ...chars[0], id: 'custom-name-a', name: '素材原名', custom: true };
  const b = { ...a, id: 'custom-name-b' };
  game.characters = [...chars, a, b];
  for (const p of [a,b]) { game.state.unlockedPets[p.id] = true; game.state.pets[p.id] = { level: 1, growth: 0, feeds: 0 }; }
  assert.equal(game.petName(a), '新伙伴');
  assert.equal(game.renamePet(a.id, '  奶糖  '), true);
  assert.equal(game.renamePet(b.id, '小月亮'), true);
  assert.equal(game.renamePet(chars[0].id, '改不了'), false);
  assert.equal(game.renamePet(a.id, '一二三四五六七八九十一二三'), false);
  assert.equal(game.renamePet(a.id, ' \n '), false);
  const next = new Controller({ storage, characters: [...chars, { ...a, name: '新版本名称' }, b], testMode: true });
  assert.equal(next.petName(a), '奶糖'); assert.equal(next.petName(b), '小月亮');
  assert.equal(next.petName(chars[0]), chars[0].name);
  api.setStorageSync = () => { throw Error('full'); };
  assert.equal(next.renamePet(a.id, '不能保存'), false);
  assert.equal(next.petName(a), '奶糖'); assert.match(next.notice.text, /未保存/);
});

test('改名原生输入框取消、不支持和重复点击安全处理，固定目标不串宠物', () => {
  const Names = require('../wechat/runtime/pet-names');
  assert.deepEqual(Names.restore({ 'custom-a': '可用名', wukong: '覆盖', 'custom-b': '名\u202e字', 'custom-c': null }), { 'custom-a': '可用名' });
  const { game } = setup(true);
  const pet = { ...chars[0], id: 'custom-dialog', custom: true };
  game.characters = [...chars, pet]; game.state.activePet = pet.id; game.state.unlockedPets[pet.id] = true;
  let options, calls = 0;
  const api = { showModal(o) { options = o; calls++; } };
  Names.request(api, game); Names.request(api, game); assert.equal(calls, 1);
  options.success({ confirm: false }); assert.equal(game.petName(pet), '新伙伴'); assert.equal(game.naming, false);
  Names.request(api, game); game.state.activePet = chars[0].id; options.success({ confirm: true, content: '花花' });
  assert.equal(game.petName(pet), '花花'); assert.equal(game.petName(), chars[0].name);
  game.state.activePet = pet.id; Names.request({ canIUse: () => false, showModal() { throw Error('must not call'); } }, game);
  assert.equal(game.naming, false); assert.match(game.notice.text, /更新微信/);
});

test('微信首次领养需要确认且只能一次，兑换后恢复仍不重复扣费', () => {
  const { game, storage } = setup();
  game.choose('ragdoll'); assert.equal(game.state.starterChosen, false);
  game.confirm(); assert.equal(game.state.activePet, 'ragdoll'); assert.equal(game.state.points, 0);
  game.open('pets'); game.choose('wukong'); assert.equal(game.modal, null);
  game.state.points = 220; game.choose('wukong'); game.confirm();
  assert.equal(game.state.points, 20); assert.equal(game.state.activePet, 'wukong');
  const next = new Controller({ storage, characters: chars });
  next.open('pets'); next.choose('wukong'); assert.equal(next.state.points, 20);
  assert.equal(Object.keys(next.state.unlockedPets).length, 2);
});

test('微信喂食立刻持久化，500ms后升级，重复点击与弹窗操作不重复结算', () => {
  const { game, storage } = setup();
  game.choose('wukong'); game.confirm(); game.state.points = 10000;
  game.pet.level = 5; game.pet.growth = 60;
  const before = game.state.points;
  game.feed(); game.feed(); game.startQuiz(); game.open('pets');
  assert.equal(game.state.points, before - 20); assert.equal(game.screen, 'home');
  assert.equal(storage.load().pets.wukong.level, 6);
  assert.equal(game.visualLevel, 5); tick(game, 499); assert.equal(game.modal, null);
  tick(game, 1); assert.equal(game.visualLevel, 6); assert.equal(game.modal.type, 'upgrade');
  game.feed(); assert.equal(game.state.points, before - 20);
  game.confirm(); assert.equal(game.modal, null); assert.equal(game.busy, null);
});

test('微信正确400ms继续且不会重复奖励，错误必须手动确认，重进可续题', () => {
  const { game, storage } = setup(true);
  game.configure(0, 'add5'); game.startQuiz(); game.input = game.question.answerText;
  const before = game.state.points;
  game.submit(); game.submit(); tick(game, 399);
  assert.equal(game.state.points, before + 10); assert.equal(game.state.round.index, 0);
  tick(game, 1); assert.equal(game.state.round.index, 1);
  game.input = '999'; game.submit(); tick(game, 800);
  assert.equal(game.state.round.index, 1); assert.equal(game.question.status, 'wrong');
  game.home(); game.startQuiz(); assert.equal(game.question.status, 'wrong');
  const next = new Controller({ storage, characters: chars }); next.startQuiz();
  assert.equal(next.question.status, 'wrong'); next.advance(); assert.equal(next.state.round.index, 2);
  assert.equal(next.state.grade, 0);
});

test('微信分数键盘接受等价答案，最后一题只结算一轮', () => {
  const { game } = setup(true);
  game.configure(6, 'fraction'); game.startQuiz();
  const answer = game.question.answer;
  for (const char of `${answer.n * 2}/${answer.d * 2}`) game.key(char);
  game.submit(); assert.equal(game.question.status, 'correct'); tick(game, 400);
  for (let i = 1; i < 10; i++) { game.input = game.question.answerText; game.submit(); tick(game, 400); }
  assert.equal(game.state.round.complete, true); assert.equal(game.state.totalRounds, 1);
  game.advance(); assert.equal(game.state.totalRounds, 1);
});

test('微信正式与测试存档隔离，正式构建和release环境均拒绝test参数', () => {
  const { api, values } = setup();
  const formal = createStorage(api, false, chars), test = createStorage(api, true, chars);
  const state = formal.load(); Core.chooseStarter(state, 'yutu', chars.map(c => c.id)); state.points = 80; formal.save(state);
  test.save(test.load());
  assert.equal(formal.load().points, 80); assert.equal(test.load().points, 10000);
  assert.ok(values.has(FORMAL_KEY)); assert.ok(values.has(TEST_KEY));
  const platform = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), getLaunchOptionsSync: () => ({ query: { test: 1 } }) };
  assert.equal(allowTest(platform, { debug: false }), false); assert.equal(allowTest(platform, { debug: true }), true);
  platform.getAccountInfoSync = () => ({ miniProgram: { envVersion: 'release' } });
  assert.equal(allowTest(platform, { debug: true }), false);
  assert.equal(allowTest(platform, { debug: true, testDefault: true }), false);
  platform.getAccountInfoSync = () => ({ miniProgram: { envVersion: 'develop' } });
  platform.getLaunchOptionsSync = () => ({ query: {} });
  assert.equal(allowTest(platform, { debug: true, testDefault: true }), true);
  assert.equal(allowTest(platform, { debug: false, testDefault: true }), false);
  platform.getLaunchOptionsSync = () => ({ query: { test: '0' } });
  assert.equal(allowTest(platform, { debug: true, testDefault: true }), false);
});

test('无限积分只在测试版生效，余额为零仍可喂养和兑换，重复点击不多长大', () => {
  const { game, storage, values } = setup(true);
  game.state.points = 0;
  for (let i = 0; i < 120; i++) {
    const before = game.pet.feeds;
    game.feed(); game.feed(); assert.equal(game.pet.feeds, before + 1);
    assert.equal(game.state.points, 0); tick(game, 500); if (game.modal) game.confirm();
  }
  assert.equal(game.pet.feeds, 120); assert.equal(game.pointsLabel, '∞ 积分');
  assert.equal(storage.load().points, 0); assert.ok(!values.has(FORMAL_KEY));
  delete game.state.unlockedPets.ragdoll;
  game.open('pets'); game.choose('ragdoll'); game.confirm();
  assert.equal(game.state.activePet, 'ragdoll'); assert.equal(game.state.points, 0);
  const next = new Controller({ storage, characters: chars, testMode: true });
  assert.equal(next.state.pets.wukong.feeds, 120); next.feed(); assert.ok(next.busy);
  const formal = setup().game; formal.choose('wukong'); formal.confirm(); formal.feed();
  assert.equal(formal.busy, null); assert.equal(formal.pet.feeds, 0); assert.equal(formal.pointsLabel, '0 积分');
});

test('微信坏存档不会被新存档覆盖，写入失败会提示且可重试', () => {
  const { api, values } = setup(); values.set(FORMAL_KEY, '{broken');
  const bad = createStorage(api, false, chars); bad.load(); assert.equal(bad.save(Core.initialState()), false);
  assert.equal(values.get(FORMAL_KEY), '{broken'); assert.ok(bad.warning);
  const good = createStorage({ getStorageSync: () => '', setStorageSync() { throw Error('full'); } }, false, chars);
  assert.equal(good.save(good.load()), false); assert.match(good.warning, /尚未保存/);
});

test('微信15级后继续成长且外观不越界，旧精卫数据保留', () => {
  const { game } = setup(true); game.pet.level = 15; game.pet.growth = 280;
  game.feed(); tick(game, 500); assert.equal(game.pet.level, 16); assert.equal(game.visualLevel, 15);
  assert.equal(game.modal.evolved, false);
  const old = Core.initialState({ chooseStarter: false });
  old.pets.jingwei = { level: 11, growth: 23, feeds: 50 }; old.unlockedPets.jingwei = true;
  const values = new Map([[FORMAL_KEY, JSON.stringify(old)]]);
  const storage = createStorage({ getStorageSync: k => values.get(k) }, false, chars);
  const restored = storage.load(); assert.equal(restored.retiredPets.jingwei.level, 11); assert.equal(restored.pets.jingwei, undefined);
});

test('微信分包失败可重试，相同分包合并请求，旧图缓存可释放', async () => {
  let calls = 0;
  const assets = new Assets({ loadSubpackage({ success, fail }) { calls++; calls === 1 ? fail(Error('offline')) : success(); } });
  await assert.rejects(assets.package('wukong')); await Promise.all([assets.package('wukong'), assets.package('wukong')]);
  assert.equal(calls, 2);
  assets.images.set('pets/wukong/stage-1.png', {}); assets.images.set('pets/yutu/stage-2.png', {}); assets.images.set('portraits/wukong.png', {});
  assets.releaseAtlases('pets/yutu/stage-2.png'); assert.equal(assets.images.size, 2);
});
test('多只本地宠物的头像与动作图先加载各自分包，失败后可重试',async()=>{
  const loaded=new Set(),calls=[];let fail=true;
  const assets=new Assets({
    loadSubpackage({name,success,fail:reject}){calls.push(name);if(fail){fail=false;reject(Error('offline'));}else{loaded.add(name);success();}},
    createImage(){return {set src(p){const id=p.split('/')[1];assert.ok(loaded.has(id),'Image attempted before subpackage loaded');this.onload();}};}
  });
  const a='custom-assets/custom-a/rev/portrait.png',b='custom-assets/custom-a/rev/stage-1.png',c='custom-assets/custom-b/rev/stage-1.png';
  await assert.rejects(assets.load(a),/offline/);
  await Promise.all([assets.load(a),assets.load(b),assets.load(c)]);
  assert.deepEqual(calls,['custom-a','custom-a','custom-b']);
  assets.releaseAtlases(c);assert.ok(assets.images.has(a));assert.ok(!assets.images.has(b));assert.ok(assets.images.has(c));
});
