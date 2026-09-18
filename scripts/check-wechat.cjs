/* Validate a built/installed game without a browser or WeChat account. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sourceRoot = path.resolve(__dirname, '..');
const root = path.resolve(process.argv[2] || path.join(sourceRoot, 'dist-wechat'));
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const config = json('project.config.json');
const gameConfig = json('game.json');
const build = json('wechat-build.json');
const characters = require(path.join(root, 'data/characters.js'));
assert.equal(config.compileType, 'game');
assert.equal(characters.length, 8);
const localPacks = require(path.join(root, 'data/local-pets.js'));
assert.equal(gameConfig.subpackages.length, 8 + localPacks.length);
assert.equal(new Set(gameConfig.subpackages.map(p => p.name)).size,gameConfig.subpackages.length);
for (const pack of localPacks) {
  const subpackage=gameConfig.subpackages.find(p=>p.name===pack.id);
  assert.equal(subpackage?.root,'custom-assets/'+pack.id);
  assert.ok(fs.existsSync(path.join(root,subpackage.root,'game.js')));
  for (const stage of pack.stages) {
    assert.ok(stage.image.startsWith('custom-assets/' + pack.id + '/' + pack.revision + '/'));
    const png = fs.readFileSync(path.join(root, stage.image));
    assert.equal(png.readUInt32BE(16), pack.cellSize * 3);
    assert.equal(png.readUInt32BE(20), pack.cellSize * 3);
  }
}
for (const [file, expected] of Object.entries(build.sharedHashes)) {
  for (const full of [path.join(root, 'shared', file), path.join(sourceRoot, 'game', file)]) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'), expected, 'Shared logic drift: ' + full);
  }
}
for (const character of characters) {
  const subpackage = gameConfig.subpackages.find(p => p.name === character.id);
  assert.ok(subpackage);
  assert.ok(fs.existsSync(path.join(root, subpackage.root, 'game.js')));
  assert.ok(fs.existsSync(path.join(root, character.portrait)));
  assert.equal(character.actions.feed.durationMs, 500);
  for (const stage of character.stages) {
    assert.ok(stage.png.startsWith(subpackage.root + '/'));
    const png = fs.readFileSync(path.join(root, stage.png));
    assert.equal(png.readUInt32BE(16), character.atlas.width);
    assert.equal(png.readUInt32BE(20), character.atlas.height);
    assert.equal(stage.bounds.length, character.frames.length);
    for (const frame of character.frames) {
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= character.atlas.width && frame.y + frame.height <= character.atlas.height);
    }
  }
}

// Load the actual entry with only the Mini Game API surface. No window/document,
// Image, localStorage or DOM adapter is supplied. Exercise first paint and touch.
const callbacks = {}, saves = new Map(), queue = new Map();
let frameSerial = 0, paints = 0;
const context2d = new Proxy({ measureText: text => ({ width: String(text).length * 15 }) }, {
  get(target, key) { if (key in target) return target[key]; return () => { paints++; }; },
  set(target, key, value) { target[key] = value; return true; }
});
const canvas = { width: 0, height: 0, getContext: () => context2d };
const wx = {
  createCanvas: () => canvas,
  createImage() { return { set src(file) { assert.ok(fs.existsSync(path.join(root, file)), file); if (this.onload) this.onload(); } }; },
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, safeArea: { top: 47, bottom: 810 } }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 87 }),
  getStorageSync: key => saves.get(key), setStorageSync: (key, value) => saves.set(key, value),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
  getLaunchOptionsSync: () => ({ query: { test: '1' } }),
  loadSubpackage({ name, success }) { assert.ok(gameConfig.subpackages.find(p => p.name === name)); success(); }
};
for (const name of ['TouchStart', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize', 'MemoryWarning']) wx['on' + name] = fn => callbacks[name] = fn;
const raf = fn => { queue.set(++frameSerial, fn); return frameSerial; };
const caf = id => queue.delete(id);
const sandbox = vm.createContext({ wx, GameGlobal: { requestAnimationFrame: raf, cancelAnimationFrame: caf }, console });
const modules = new Map();
function load(relative) {
  relative = path.normalize(relative);
  if (!relative.endsWith('.js')) relative += '.js';
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'External require: ' + relative);
  if (modules.has(relative)) return modules.get(relative).exports;
  const file = path.join(root, relative), text = fs.readFileSync(file, 'utf8');
  const mod = { exports: {} }; modules.set(relative, mod);
  const execute = vm.runInContext('(function(require,module,exports){\n' + text + '\n})', sandbox, { filename: file });
  execute(request => { assert.ok(request.startsWith('.'), request); return load(path.join(path.dirname(relative), request)); }, mod, mod.exports);
  return mod.exports;
}
function frame(time) {
  const next = queue.entries().next().value;
  assert.ok(next, 'Animation must be scheduled'); queue.delete(next[0]); next[1](time);
}
load('game.js');
frame(16);
assert.ok(paints > 30);
assert.equal(canvas.width, 780, 'DPR capped at 2');
assert.equal(queue.size, 1);
callbacks.Hide(); assert.equal(queue.size, 0);
callbacks.Show(); callbacks.Show(); assert.equal(queue.size, 1, 'No duplicate loops on show');
frame(32);
assert.ok(saves.has('math-pet-wechat:formal:v1'));
assert.equal(saves.has('math-pet-wechat:test:v1'), false);
assert.equal(JSON.parse(saves.get('math-pet-wechat:formal:v1')).points, 0);
callbacks.MemoryWarning(); callbacks.WindowResize(); frame(48);
callbacks.Hide();
console.log(`PASS: entry runs without browser globals; 8 original + ${localPacks.length} custom packages; shared hashes match; formal/test isolation; DPR, resize and background lifecycle. ${root}`);
