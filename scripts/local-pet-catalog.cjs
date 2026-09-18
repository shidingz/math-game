// Build-time local files only; never accept these paths through the network API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { validatePack } = require('../wechat/runtime/custom-pets');
module.exports = async function catalog(file, write, allowTrial = false) {
  if (!file) return { packs: [], files: [] };
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Array.isArray(list), 'Local catalog must be an array of manifest paths');
  const packs = [], files = [];
  for (const entry of list) {
    assert.equal(typeof entry, 'string');
    const manifest = path.resolve(path.dirname(file), entry);
    const raw = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    assert.ok(!raw.trial || allowTrial, 'Trial art requires explicit --allow-trial-pets');
    const buffers = new Map();
    const load = async (value, atlas = false, transparent = false) => {
      assert.ok(typeof value === 'string' && /^[a-zA-Z0-9_-]+\.png$/.test(value), 'Use a PNG filename alongside the local manifest');
      const full = fs.realpathSync(path.join(path.dirname(manifest), value));
      assert.equal(path.dirname(full), fs.realpathSync(path.dirname(manifest)), 'Asset cannot escape pack folder');
      const bytes = fs.readFileSync(full); assert.ok(bytes.length <= 12 * 1024 * 1024);
      const meta = await sharp(bytes).metadata();
      assert.equal(meta.format, 'png'); assert.ok(meta.width <= 4096 && meta.height <= 4096);
      if (transparent && !raw.trial) {
        assert.ok(meta.hasAlpha, 'Food/effects require an alpha channel');
        const stats = await sharp(bytes).stats();
        assert.ok(stats.channels[3].min < 16 && stats.channels[3].max > 16, 'Food/effects must contain visible art and actual transparency');
      }
      if (atlas) {
        assert.equal(meta.width, raw.cellSize * 3); assert.equal(meta.height, raw.cellSize * 3);
        if (!raw.trial) {
          assert.ok(meta.hasAlpha, 'Production atlas must have transparency');
          const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            let clear = 0, visible = 0;
            for (let y = 0; y < raw.cellSize; y++) for (let x = 0; x < raw.cellSize; x++) {
              const alpha = data[((row * raw.cellSize + y) * info.width + col * raw.cellSize + x) * 4 + 3];
              if (alpha < 16) clear++; else visible++;
            }
            assert.ok(clear >= raw.cellSize ** 2 * .05 && visible >= 100, 'Atlas cell lacks transparent margin or character');
          }
        }
      }
      buffers.set(value, bytes);
      return 'https://bundled.invalid/' + value;
    };
    const candidate = { ...raw, stages: [] };
    for (const s of raw.stages || []) candidate.stages.push({ ...s, image: await load(s.image, true) });
    for (const key of ['portrait', 'scene']) if (raw[key]) candidate[key] = await load(raw[key]);
    if (raw.food) candidate.food = { ...raw.food, image: await load(raw.food.image, false, true) };
    if (raw.effects) { candidate.effects = {}; for (const key of ['particle','ground','back','evolution']) if (raw.effects[key]) candidate.effects[key] = await load(raw.effects[key], false, true); }
    const pack = validatePack(candidate, ['bundled.invalid']);
    assert.ok(!packs.some(p => p.id === pack.id), 'Duplicate local pet id');
    const hash = crypto.createHash('sha256').update(JSON.stringify(pack));
    for (const [name, data] of buffers) hash.update(name).update(data);
    pack.revision = hash.digest('hex').slice(0, 16);
    const folder = 'custom-assets/' + pack.id + '/' + pack.revision;
    const local = JSON.parse(JSON.stringify(pack).replaceAll('https://bundled.invalid/', folder + '/'));
    for (const [name, data] of buffers) { const dest = folder + '/' + name; write(dest, data); files.push(dest); }
    // Trial permission is build metadata, never part of the player's pet name.
    packs.push(local);
  }
  return { packs, files };
};
