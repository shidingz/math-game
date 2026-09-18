// Diagnostic packaging only: retains source white background/cropping defects.
// No generated repairs, background removal or invented missing body parts.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ID } = require('../wechat/runtime/custom-pets');
const args = process.argv.slice(2), opt = k => args[args.indexOf(k) + 1];
(async () => {
  for (const flag of ['--out','--id','--name','--stage1','--stage2','--stage3']) if (!args.includes(flag)) throw Error('Missing ' + flag);
  const out = path.resolve(opt('--out')), id = opt('--id');
  if (!ID.test(id) || fs.existsSync(out)) throw Error('Use a new output directory and custom-… ID');
  fs.mkdirSync(out, { recursive: true });
  const stages = [];
  for (let n = 1; n <= 3; n++) {
    const source = opt('--stage' + n), meta = await sharp(source).metadata();
    if (meta.width !== meta.height) throw Error('Expected a square 3×3 source sheet');
    const tiles = [];
    for (let i = 0; i < 9; i++) {
      const x = i % 3, y = Math.floor(i / 3), left = Math.round(x * meta.width / 3), top = Math.round(y * meta.height / 3);
      const input = await sharp(source).extract({ left, top, width: Math.round((x + 1) * meta.width / 3) - left, height: Math.round((y + 1) * meta.height / 3) - top }).resize(384, 384).png().toBuffer();
      tiles.push({ input, left: x * 384, top: y * 384 });
    }
    const image = `stage-${n}.png`;
    await sharp({ create: { width: 1152, height: 1152, channels: 4, background: '#ffffff' } }).composite(tiles).png({ palette: true, colours: 192 }).toFile(path.join(out, image));
    stages.push({ image, name: ['初始伙伴','觉醒伙伴','守护伙伴'][n - 1] });
  }
  await sharp(path.join(out, 'stage-1.png')).extract({ left: 0, top: 0, width: 384, height: 384 }).resize(160,160).png().toFile(path.join(out,'portrait.png'));
  const pack = { schemaVersion: 1, trial: true, id, name: opt('--name'), revision: 'trial', cellSize: 384, stages, portrait: 'portrait.png' };
  for (const kind of ['scene','food']) if (args.includes('--' + kind)) {
    await sharp(opt('--' + kind)).resize(kind === 'scene' ? 768 : 160).png({ palette: true, colours: 192 }).toFile(path.join(out,kind + '.png'));
    pack[kind] = kind === 'food' ? { name: '星星饼干', image: 'food.png' } : 'scene.png';
  }
  fs.writeFileSync(path.join(out,'pet.json'), JSON.stringify(pack,null,2));
  fs.writeFileSync(path.join(out,'catalog.json'), '["pet.json"]\n');
  console.log('Trial only: opaque cards and imperfect poses retained. Catalog: ' + path.join(out,'catalog.json'));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
