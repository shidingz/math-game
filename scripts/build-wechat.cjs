/* Deterministic export of current game logic/art to a self-contained WeChat game. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const dest = path.resolve(option('--out') || path.join(root, 'dist-wechat'));
const debug = args.includes('--test');
const testDefault = args.includes('--test-default');
assert.ok(!testDefault || debug, '--test-default requires --test');
const sourceConfig = option('--config');
const customFile = option('--custom-pets');
const customPets = customFile ? JSON.parse(fs.readFileSync(customFile, 'utf8')) : { baseUrl: '', assetHosts: [] };
assert.ok(Object.keys(customPets).every(k => ['baseUrl', 'assetHosts'].includes(k)), 'Client config accepts only public URL and assetHosts; never include API keys');
assert.ok(typeof customPets.baseUrl === 'string' && Array.isArray(customPets.assetHosts));
assert.ok(customPets.baseUrl === '' || /^https:\/\/[a-z0-9.-]+(?:\/[^\s?#]*)?$/i.test(customPets.baseUrl), 'Service URL must be HTTPS');
assert.ok(customPets.assetHosts.every(h => typeof h === 'string' && /^[a-z0-9.-]+$/.test(h)), 'Invalid asset host');
const sharp = require('sharp');
const inv = JSON.parse(fs.readFileSync(path.join(root, 'asset-inventory.json')));

function write(file, value) {
  const out = path.join(dest, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, value);
}
function json(file, value) { write(file, JSON.stringify(value, null, 2) + '\n'); }
function copy(from, to) { write(to, fs.readFileSync(path.join(root, from))); }

async function build() {
  assert.notEqual(dest, root, 'Output must not replace the web source');
  if (fs.existsSync(path.join(dest, 'game.js')) && !fs.existsSync(path.join(dest, 'wechat-build.json'))) {
    throw Error('Refusing to replace an existing project. Build to a staging directory, then review and install.');
  }
  const box = { URL, document: { currentScript: { src: 'https://local/wukong.js' } }, HTMLElement: class {}, customElements: { get() {}, define() {} } };
  box.window = box;
  const run = file => vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), box);
  run('game/growth.js');
  run('wukong.js');
  for (const c of inv.characters) if (c.id !== 'wukong') run(`characters/${c.id}/${c.id}-data.js`);
  run('game/characters.js');
  for (const c of inv.characters) if (c.id !== 'wukong') run(`game/${c.id}-character.js`);

  for (const file of ['core.js', 'growth.js', 'questions.js']) copy('game/' + file, 'shared/' + file);
  for (const file of fs.readdirSync(path.join(root, 'wechat/runtime'))) copy('wechat/runtime/' + file, 'runtime/' + file);
  copy('wechat/game.js', 'game.js');
  copy('wechat/README.md', 'README.md');
  write('config.js', `module.exports = ${JSON.stringify({ debug, testDefault, assetVersion: 'wechat-v23-classic-home', customPets })};\n`);
  // Retire the old baked landscapes from new exports, including rebuilds.
  fs.rmSync(path.join(dest,'shared-art'),{recursive:true,force:true});
  fs.rmSync(path.join(dest,'world-art'),{recursive:true,force:true});
  const sharedArtFiles=await require('./build-kingdom-art.cjs')(write);
  fs.rmSync(path.join(dest,'particle-art'),{recursive:true,force:true});
  // Theme motifs are Canvas geometry; retired particle textures do not ship.
  const local = await require('./local-pet-catalog.cjs')(option('--local-pets'), write, args.includes('--allow-trial-pets'));
  write('data/local-pets.js', 'module.exports = ' + JSON.stringify(local.packs) + ';\n');
  const characters = [];
  const packages = [];
  for (const pack of local.packs) {
    const folder = 'custom-assets/' + pack.id;
    write(folder + '/game.js', '// Asset-only custom pet subpackage.\n');
    const bytes = [folder + '/game.js', ...local.files.filter(f => f.startsWith(folder + '/'))]
      .reduce((sum, f) => sum + fs.statSync(path.join(dest, f)).size, 0);
    assert.ok(bytes < 4 * 1024 * 1024, pack.id + ': custom pet subpackage exceeds 4 MiB');
    packages.push({name:pack.id,root:folder,bytes});
  }
  for (const entry of box.MathPetCharacters.list()) {
    const source = inv.characters.find(c => c.id === entry.id);
    const c = JSON.parse(JSON.stringify({ ...source, food: entry.food, ui: entry.ui, unlock: entry.unlock,
      clickActions: entry.clickActions, idleActions: entry.idleActions, messages: entry.messages,
      portrait: `portraits/${entry.id}.png` }));
    // 384px source cells retain detail on high DPI phones; only pixel coordinates change.
    const factor = .75;
    for (const frame of c.frames) for (const key of ['x', 'y', 'width', 'height', 'pivotX', 'pivotY']) frame[key] *= factor;
    for (const key of Object.keys(c.cell)) c.cell[key] *= factor;
    c.atlas.width *= factor; c.atlas.height *= factor;
    c.effectColors=[];
    let total = 0;
    const folder = 'pets/' + c.id;
    write(folder + '/game.js', '// Asset-only character subpackage.\n');
    total += fs.statSync(path.join(dest, folder, 'game.js')).size;
    for (let i = 0; i < 3; i++) {
      const original = path.join(root, source.stages[i].png);
      const { data: rgba, info } = await sharp(original).resize(c.atlas.width, c.atlas.height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const idle=c.frames[0];
      const pixels=await sharp(rgba,{raw:info}).extract({left:idle.x,top:idle.y,width:idle.width,height:idle.height}).resize(96,96).raw().toBuffer();
      c.effectColors.push(require('../wechat/runtime/pet-colors').matchPixels(pixels));
      const bounds = [];
      for (const frame of c.frames) {
        let minX = frame.width, minY = frame.height, maxX = -1, maxY = -1;
        for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
          if (rgba[((y + frame.y) * info.width + x + frame.x) * 4 + 3] > 16) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
        assert.ok(maxX >= minX && maxY >= minY, 'Empty frame in ' + original);
        bounds.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
      }
      const bytes = await sharp(rgba, { raw: info }).png({ palette: true, colours: 192, effort: 5, dither: .6 }).toBuffer();
      const output = `${folder}/stage-${i + 1}.png`;
      write(output, bytes);
      c.stages[i].png = output;
      delete c.stages[i].portrait;
      c.stages[i].bounds = bounds;
      total += bytes.length;
    }
    const portrait = await sharp(path.join(root, source.stages[0].portrait)).resize(160, 160, { fit: 'contain', background: '#00000000' }).png({ palette: true, colours: 128 }).toBuffer();
    write(c.portrait, portrait);
    assert.ok(total < 4 * 1024 * 1024, `${c.id}: package exceeds conservative 4 MiB budget`);
    packages.push({ name: c.id, root: folder, bytes: total });
    characters.push(c);
    console.log(`${c.id}: ${(total / 1024 / 1024).toFixed(2)} MiB, 3 stages, ${c.frames.length} poses per stage`);
  }
  write('data/characters.js', 'module.exports = ' + JSON.stringify(characters) + ';\n');
  json('game.json', { deviceOrientation: 'portrait', showStatusBar: false, subpackages: packages.map(({ name, root }) => ({ name, root })) });
  const config = sourceConfig ? JSON.parse(fs.readFileSync(sourceConfig, 'utf8')) : { appid: 'touristappid', setting: { es6: true, minified: true } };
  config.description = '算算萌宠 · 口算练习与宠物养成';
  config.projectname = testDefault ? '算算萌宠·无限积分测试' : '算算萌宠';
  config.compileType = 'game';
  config.setting = { ...config.setting, es6: true, enhance: true, urlCheck: true };
  config.packOptions = { ...config.packOptions, ignore: [
    ...(config.packOptions?.ignore || []).filter(x => !['preview.html', 'preview.js', 'wechat-build.json', 'README.md'].includes(x.value)),
    ...['preview.html', 'preview.js', 'wechat-build.json', 'README.md'].map(value => ({ type: 'file', value })),
    // The original quickstart files may remain for recovery, but are not shipped.
    ...['js', 'images', 'audio'].map(value => ({ type: 'folder', value }))
  ] };
  json('project.config.json', config);
  const hashes = {};
  for (const f of ['core.js', 'growth.js', 'questions.js']) hashes[f] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'game', f))).digest('hex');
  const mainFiles = ['game.js', 'game.json', 'config.js', 'data/characters.js', ...fs.readdirSync(path.join(dest, 'runtime')).map(f => 'runtime/' + f), ...Object.keys(hashes).map(f => 'shared/' + f), ...characters.map(c => c.portrait)];
  mainFiles.push('data/local-pets.js',...sharedArtFiles);
  const mainBytes = mainFiles.reduce((sum, f) => sum + fs.statSync(path.join(dest, f)).size, 0);
  const totalBytes = mainBytes + packages.reduce((sum, p) => sum + p.bytes, 0);
  assert.ok(mainBytes < 4 * 1024 * 1024, 'Main package too large');
  assert.ok(totalBytes < 20 * 1024 * 1024, 'Total exceeds conservative 20 MiB budget');
  json('wechat-build.json', { version: 1, debug, testDefault, sharedHashes: hashes, mainBytes, totalBytes, packages });
  // Browser harness is excluded from upload and never supplies production globals.
  const modules = mainFiles.filter(f => f.endsWith('.js')).filter(f => f !== 'game.js');
  const bundle = 'const factories = {\n' + modules.map(f => JSON.stringify(f) + ': function(require,module,exports){\n' + fs.readFileSync(path.join(dest, f), 'utf8') + '\n}').join(',\n') + '\n};\n' +
    `const cache={}; function load(id){if(cache[id])return cache[id].exports;const module={exports:{}};cache[id]=module;factories[id](function(p){const a=id.split('/');a.pop();for(const q of p.split('/')){if(q==='..')a.pop();else if(q!=='.')a.push(q);}let n=a.join('/');if(!n.endsWith('.js'))n+='.js';return load(n);},module,module.exports);return module.exports;}\nwindow.mathPetPreview=load('runtime/main.js')(window.wx,window);\n`;
  write('preview.js', bundle);
  copy('wechat/preview.html', 'preview.html');
  console.log(`Main ${(mainBytes / 1024).toFixed(0)} KiB; total ${(totalBytes / 1024 / 1024).toFixed(2)} MiB. Output: ${dest}`);
}
build().catch(error => { console.error(error); process.exitCode = 1; });
