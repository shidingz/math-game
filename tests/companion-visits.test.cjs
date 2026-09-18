const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Visits = require('../wechat/runtime/companion-visits');
const Core = require('../game/core');
const zero = () => 0;
function character(id, custom = false) {
  return { id, custom, stages: [0, 1, 2].map(i => ({ png: `${id}/stage-${i}.png` })),
    frames: [{ x: 0, y: 0, width: 100, height: 100 }],
    actions: Object.fromEntries(['idle', 'wave', 'jump', 'think', 'feed', 'evolve'].map(name => [name, { frames: [0], durationMs: 2400 }])),
    idleActions: ['think'], clickActions: ['wave'], messages: {} };
}
function context() {
  return { state: { starterChosen: true, activePet: 'wukong', points: 120,
    unlockedPets: { wukong: true, yutu: true, 'custom-one': true },
    pets: { wukong: { level: 11, growth: 0, feeds: 50 }, yutu: { level: 1, growth: 0, feeds: 0 }, 'custom-one': { level: 6, growth: 10, feeds: 20 } } },
  characters: [character('wukong'), character('yutu'), character('custom-one', true)], screen: 'home', modal: null, busy: null, reducedMotion: false };
}
function visiting(c = context(), random = zero) {
  let state = Visits.create(0, random);
  state = Visits.update(state, c, 0, random);
  return Visits.update(state, c, state.nextAt, random);
}
function frozen(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) frozen(child); }
  return value;
}

test('来访只选择已拥有且素材可用的其他伙伴，包括自定义伙伴，永不选择退休角色', () => {
  const c = context();
  c.characters.push(character('locked'), character('jingwei'), character('retired'), character('missing'), character('invalid'));
  c.state.unlockedPets.jingwei = c.state.unlockedPets.retired = c.state.unlockedPets.missing = c.state.unlockedPets.invalid = true;
  c.state.pets.jingwei = c.state.pets.retired = { level: 11 };
  c.state.pets.invalid = { level: 0 };
  c.state.retiredPets = { retired: { level: 11 } };
  for (const id of ['wukong', 'locked', 'jingwei', 'retired', 'missing', 'invalid']) assert.equal(Visits.eligible(c, id), null);
  assert.equal(Visits.select(c, null, zero).id, 'yutu');
  assert.equal(Visits.select(c, 'yutu', zero).id, 'custom-one');
  for (const invalid of [1, 'true', [], {}]) {
    c.state.unlockedPets.yutu = invalid;
    assert.equal(Visits.eligible(c, 'yutu'), null);
  }
  delete c.state.unlockedPets.yutu; delete c.state.unlockedPets['custom-one'];
  assert.equal(Visits.select(c, null, zero), null);
});

test('每次渲染都读取访客真实等级和阶段，不使用主宠或后续进化的形态', () => {
  const c = context(), state = visiting(c);
  for (let level = 1; level <= 30; level++) {
    c.state.pets.yutu.level = level;
    const pose = Visits.pose(state, c, state.active.start + 2000);
    assert.equal(pose.level, level);
    assert.equal(pose.visualLevel, Math.min(level, 15));
    assert.equal(pose.stage, level < 6 ? 0 : level < 11 ? 1 : 2);
  }
  c.state.pets.yutu.level = 5;
  assert.equal(Visits.pose(state, c, state.active.start + 2000).stage, 0);
  delete c.state.unlockedPets.yutu;
  assert.equal(Visits.pose(state, c, state.active.start + 2000), null);
  assert.equal(Visits.update(state, c, state.active.start + 2000, zero).active, null);
});

test('切换主宠、离开首页、喂养、升级弹窗、改名及减少动态立即取消并保持节流', () => {
  const changes = [c => { c.state.activePet = 'custom-one'; }, c => { c.screen = 'quiz'; },
    c => { c.busy = { until: 9000 }; }, c => { c.modal = { type: 'upgrade' }; },
    c => { c.naming = true; }, c => { c.reducedMotion = true; }];
  for (const change of changes) {
    const c = context(), state = visiting(c), now = state.active.start + 1000;
    change(c); assert.equal(Visits.pose(state, c, now), null);
    const next = Visits.update(state, c, now, zero);
    assert.equal(next.active, null); assert.ok(next.nextAt >= now + Visits.LIMITS.firstMin);
  }
  const c = context(), state = visiting(c);
  c.screen = 'quiz';
  const blocked = Visits.update(state, c, state.active.start + 1000, zero);
  c.screen = 'home';
  const resume = Visits.update(blocked, c, blocked.nextAt + 60000, zero);
  assert.equal(resume.active, null);
  assert.ok(resume.nextAt >= blocked.nextAt + 60000 + Visits.LIMITS.firstMin);
});

test('首次安静等待8–12秒，来访后休息24–40秒，一次仅1位并避免连续重复', () => {
  const c = context(); let state = Visits.create(0, zero), starts = [], ends = [], previousId = null;
  assert.ok(state.nextAt >= 8000 && state.nextAt <= 12000);
  for (let time = 0; time <= 600000; time += 100) {
    const old = state; state = Visits.update(state, c, time, zero);
    if (state.active && !old.active) {
      starts.push(time); assert.notEqual(state.active.id, previousId); previousId = state.active.id;
      assert.equal(Array.isArray(state.active), false);
      if (ends.length) assert.ok(time - ends.at(-1) >= 24000);
    }
    if (!state.active && old.active) ends.push(time);
  }
  assert.equal(starts[0], 8000); assert.ok(starts.length > 10 && starts.length <= 19);
  assert.equal(Visits.LIMITS.maxGuests, 1);
  const single = context(); delete single.state.unlockedPets['custom-one'];
  assert.equal(Visits.select(single, 'yutu', zero).id, 'yutu');
  assert.equal(Visits.create(0, () => 1).nextAt < 12000, true);
});

test('三种规则互动只生成侧边渲染姿势，主宠视觉响应不修改动作或经济存档', () => {
  for (const [index, interaction] of Visits.INTERACTIONS.entries()) {
    const c = frozen(context()), before = JSON.stringify(c), base = visiting(c);
    const state = { ...base, active: { ...base.active, interaction, side: index % 2 ? 'right' : 'left' } };
    const start = state.active.start;
    assert.equal(Visits.pose(state, c, start + 100).phase, 'enter');
    const p = Visits.pose(state, c, start + 3000);
    assert.equal(p.phase, 'interact');
    assert.equal(p.action, ['wave', 'jump', 'think'][index]);
    assert.equal(p.hostAction, p.action);
    assert.ok(p.anchorX < .2 || p.anchorX > .8);
    assert.ok(p.scale <= .4 && p.opacity === 1);
    assert.ok(p.actionElapsed >= 0 && p.actionPhase >= 0 && p.actionPhase <= 1);
    assert.equal(Visits.pose(state, c, start + 7500).phase, 'leave');
    assert.equal(Visits.pose(state, c, start + Visits.LIMITS.duration), null);
    Visits.update(state, c, start + Visits.LIMITS.duration, zero);
    assert.equal(JSON.stringify(c), before);
  }
});

test('动态减少及单伙伴存档不自动来访，不足动作使用当前形态待机回退', () => {
  const c = context(); c.reducedMotion = true;
  let s = Visits.create(0, zero);
  for (let t = 0; t < 600000; t += 100) { s = Visits.update(s, c, t, zero); assert.equal(s.active, null); }
  c.reducedMotion = false;
  const active = visiting(c);
  delete c.characters[1].actions.wave;
  assert.equal(Visits.pose(active, c, active.active.start + 2000).action, 'idle');
  delete c.state.unlockedPets.yutu; delete c.state.unlockedPets['custom-one'];
  assert.equal(visiting(c).active, null);
});

test('控制器来访状态仅驻留内存；喂养、选宠物、做题和升级立即中断', () => {
  const file = path.resolve(__dirname, '../wechat/runtime/controller.js'), module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file })(
    id => id.startsWith('../shared/') ? require('../game/' + id.slice(10)) : require('../wechat/runtime/' + id.slice(2)), module, module.exports);
  const Controller = module.exports;
  function setup() {
    const state = Core.initialState(); Core.chooseStarter(state, 'wukong', ['wukong', 'yutu']);
    state.unlockedPets.yutu = true; state.pets.yutu = { level: 1, growth: 0, feeds: 0 }; state.points = 100; state.grade = 1; state.topic = 'balanced';
    const storage = { load: () => state, save: value => { assert.equal(value.visits, undefined); return true; } };
    const game = new Controller({ storage, characters: [character('wukong'), character('yutu')], random: zero });
    for (let i = 0; i < 100; i++) game.tick(100);
    assert.ok(game.companionVisit); return game;
  }
  const feed = setup(), points = feed.state.points; feed.feed();
  assert.equal(feed.companionVisit, null); assert.equal(feed.state.points, points - 20); assert.equal(feed.pet.feeds, 1);
  const switchPet = setup(); switchPet.choose('yutu'); assert.equal(switchPet.companionVisit, null);
  const quiz = setup(); quiz.startQuiz(); assert.equal(quiz.companionVisit, null); assert.equal(quiz.screen, 'quiz');
  const modal = setup(); modal.modal = { type: 'upgrade' }; assert.equal(modal.companionVisit, null);
  const before = JSON.stringify(setup().state), still = setup();
  for (let i = 0; i < 600; i++) still.tick(100);
  assert.equal(JSON.stringify(still.state), before);
});

test('来访双人镜头按透明边界等高，宽窄角色均完整位于左右两侧且不相撞', () => {
  const Geometry = require('../wechat/runtime/pet-geometry');
  const boxes = [{ x: 25, y: 80, width: 460, height: 280 }, { x: 175, y: 25, width: 160, height: 430 }, { x: 60, y: 150, width: 390, height: 250 }];
  for (const screenHeight of [660, 844, 920]) for (const hostBounds of boxes) for (const guestBounds of boxes) for (const level of [1, 6, 11, 15]) for (const side of ['left', 'right']) {
    const layout = Geometry.home(screenHeight), data = { aligned: true, frames: [{ pivotX: 256, pivotY: 448 }], stages: [{ bounds: [hostBounds] }] };
    const normal = Geometry.fit(data, 0, 0, layout.pet, level, 'idle', 0, 0, true);
    const args = { scene: layout.scene, normal, hostBounds, guestBounds, side };
    const absent = Visits.pairLayout({ ...args, blend: 0 });
    assert.equal(absent.host, normal, 'zero blend must retain the original camera exactly');
    const pair = Visits.pairLayout({ ...args, blend: 1 });
    const h = pair.host.bounds, g = pair.guest.bounds;
    assert.ok(Math.abs((h.bottom - h.top) - (g.bottom - g.top)) < 1e-8);
    assert.ok(h.bottom - h.top <= normal.bounds.bottom - normal.bounds.top);
    const left = side === 'left' ? g : h, right = side === 'left' ? h : g;
    assert.ok(left.right < right.left);
    for (const b of [h, g]) {
      assert.ok(b.left >= layout.scene.x && b.right <= layout.scene.x + layout.scene.width);
      assert.ok(b.top >= layout.scene.y && b.bottom <= layout.scene.y + layout.scene.height);
    }
    const middle = Visits.pairLayout({ ...args, blend: .5 });
    assert.ok(middle.host.scale <= normal.scale && middle.host.scale >= pair.host.scale);
    const end = Visits.pairLayout({ ...args, blend: .001 });
    assert.ok(Math.abs(end.host.scale - normal.scale) < Math.abs(pair.host.scale - normal.scale) * .002 + 1e-9);
  }
});
