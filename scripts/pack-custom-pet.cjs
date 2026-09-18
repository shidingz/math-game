/* Convert a fixed image folder into the same data-only pet package every time. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { validatePack, ID } = require('../wechat/runtime/custom-pets');
const args = process.argv.slice(2), get = n => args[args.indexOf(n) + 1];
async function main() {
  for (const n of ['--in','--out','--id','--name','--base-url']) if (!args.includes(n)) throw Error('Required: --in folder --out folder --id custom-unique-id --name name --base-url https://cdn.example/pets');
  const src = path.resolve(get('--in')), dest = path.resolve(get('--out')), id = get('--id'), name = get('--name');
  const base = get('--base-url').replace(/\/$/, ''), url = new URL(base);
  if (!ID.test(id) || url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) throw Error('Invalid id or CDN URL');
  if (dest === src || fs.existsSync(dest)) throw Error('Use a new output directory to avoid replacing existing pets');
  const buffers = {}, bounds = {}, hash = crypto.createHash('sha256');
  const qualityPath = path.join(src, 'quality.json');
  const quality = fs.existsSync(qualityPath) ? JSON.parse(fs.readFileSync(qualityPath)) : null;
  if (quality && quality.status !== 'accepted') throw Error('Generated candidate has not passed visual review; use the local trial build instead');
  for (const file of ['stage-1.png','stage-2.png','stage-3.png','food.png','scene.png','fx-particle.png','fx-ground.png','fx-back.png','fx-evolution.png']) {
    const input = path.join(src, file);
    if (!fs.existsSync(input)) { if (file.startsWith('stage-')) throw Error('Missing ' + file); continue; }
    const bytes = fs.readFileSync(input); if (bytes.length > 12 * 1024 * 1024) throw Error('Image exceeds 12MB: ' + file);
    if (quality && quality.files?.[file] !== crypto.createHash('sha256').update(bytes).digest('hex')) throw Error('Asset changed after quality review: ' + file);
    const info = await sharp(bytes).metadata();
    if (info.format !== 'png' || info.width > 4096 || info.height > 4096) throw Error('Use PNG up to 4096px: ' + file);
    if (file.startsWith('stage-')) {
      if (info.width !== 1536 || info.height !== 1536 || !info.hasAlpha) throw Error('Stage must be transparent 1536x1536 PNG: ' + file);
      const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
      bounds[file] = [];
      for (let cell = 0; cell < 9; cell++) {
        let visible = 0, clear = 0, minX = 512, minY = 512, maxX = -1, maxY = -1;
        for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
          const a = rgba[((Math.floor(cell / 3) * 512 + y) * 1536 + cell % 3 * 512 + x) * 4 + 3];
          if (a > 16) { visible++; minX = Math.min(minX,x); minY = Math.min(minY,y); maxX = Math.max(maxX,x); maxY = Math.max(maxY,y); } else clear++;
        }
        if (visible < 100 || clear < 512 * 512 * .05) throw Error('Empty or opaque frame ' + cell + ': ' + file);
        bounds[file].push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
      }
    } else if (file !== 'scene.png') {
      if (!info.hasAlpha) throw Error('Food/effects need transparency: ' + file);
      const stats = await sharp(bytes).stats();
      if(stats.channels[3].min>=16 || stats.channels[3].max<=16) throw Error('Food/effects must have actual transparent background and visible art: ' + file);
    }
    buffers[file] = bytes; hash.update(file); hash.update(bytes);
  }
  const revision = hash.digest('hex').slice(0, 16), prefix = `${base}/${id}/${revision}`;
  const pack = { schemaVersion: 1, id, name, revision, cellSize: 512, portrait: prefix + '/portrait.png',
    stages: [1,2,3].map((n, i) => ({ name: ['初始伙伴','觉醒伙伴','守护伙伴'][i], image: `${prefix}/stage-${n}.png`, bounds: bounds[`stage-${n}.png`] })) };
  const sourceManifest = path.join(src, 'pet.json');
  if (fs.existsSync(sourceManifest)) {
    const source=JSON.parse(fs.readFileSync(sourceManifest));
    if (['aligned-v1','template-v1'].includes(source.layout)) pack.layout=source.layout;
    if (source.procedural) pack.procedural=require('../wechat/runtime/pet-presets').validate(source.procedural);
  }
  if (buffers['food.png']) pack.food = { name: args.includes('--food-name') ? get('--food-name') : '成长点心', image: prefix + '/food.png' };
  if (buffers['scene.png']) pack.scene = prefix + '/scene.png';
  pack.effects = {};
  for (const k of ['particle','ground','back','evolution']) if (buffers[`fx-${k}.png`]) pack.effects[k] = `${prefix}/fx-${k}.png`;
  validatePack(pack, [url.hostname]);
  buffers['portrait.png'] = await sharp(buffers['stage-1.png']).extract({ left: 0, top: 0, width: 512, height: 512 }).resize(160,160).png().toBuffer();
  const folder = path.join(dest, id, revision); fs.mkdirSync(folder, { recursive: true });
  for (const [name, bytes] of Object.entries(buffers)) fs.writeFileSync(path.join(folder, name), bytes);
  fs.writeFileSync(path.join(dest, 'pet.json'), JSON.stringify(pack, null, 2) + '\n');
  console.log(`Pet package ready: ${path.join(dest, 'pet.json')}\nUpload ${id}/${revision}/ to the CDN; attach pet.json to the ready job response. Visual QA still required.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
