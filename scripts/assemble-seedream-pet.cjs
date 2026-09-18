'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const crypto = require('node:crypto');
const { atlas, cutout, split } = require('./pet-matte.cjs');
const { atomic } = require('./seedream-client.cjs');
const { ID } = require('../wechat/runtime/custom-pets');
async function assemble({ directory, id, name, selection, reviews = {}, photos = [] }) {
  if (!ID.test(id) || typeof name !== 'string' || name.length > 13 || !name.trim()) throw Error('Use custom-… ID and a name up to 13 characters');
  const out = path.join(directory, 'candidate'); fs.mkdirSync(out, { recursive: true });
  const recipeFile = path.join(directory, 'recipe.json');
  const key = fs.existsSync(recipeFile) ? JSON.parse(fs.readFileSync(recipeFile)).matte || 'green' : 'green';
  const source = key => {
    const value = selection[key] || (key === 'design' ? 'design/image-1.png' : ''); if (typeof value !== 'string' || !/^(design|stage[123]|food|scene|effects)(-attempt-[1-9][0-9]?)?\/image-1\.png$/.test(value)) throw Error('Invalid selected source: ' + key);
    return path.join(directory, value);
  };
  const pack = { schemaVersion: 1, id, name: name.trim(), revision: '', cellSize: 512, layout: 'aligned-v1', stages: [], portrait: 'portrait.png', food: { name: '成长点心', image: 'food.png' }, scene: 'scene.png', effects: {} };
  const report = { version: 1, status: 'needs-visual-review', sources: {}, geometry: {}, notes: ['Local pixel checks do not prove likeness, anatomy, correct actions or accessory consistency.'] };
  for (let n = 1; n <= 3; n++) {
    const stageKey = 'stage' + n, r = await atlas(source(stageKey), path.join(directory, 'processed', stageKey), {key});
    await sharp(r.file).png({ palette: true, colours: 192, effort: 7 }).toFile(path.join(out, `stage-${n}.png`));
    pack.stages.push({ image: `stage-${n}.png`, name: ['初始伙伴','觉醒伙伴','守护伙伴'][n - 1], bounds: r.boxes });
    report.geometry[stageKey] = r.metrics;
  }
  await sharp(path.join(directory,'processed/stage1/frames/0.png')).resize(160,160).png().toFile(path.join(out,'portrait.png'));
  const food = await cutout(source('food'), {key});
  await sharp(food.png).trim().resize(192,192,{fit:'contain',background:'#00000000'}).png().toFile(path.join(out,'food.png'));
  report.geometry.food = food.metrics;
  await sharp(source('scene')).resize(768,768,{fit:'cover'}).png({palette:true,colours:192}).toFile(path.join(out,'scene.png'));
  const effects = await split(source('effects'),2,2,{key});
  for (let i = 0; i < effects.length; i++) {
    const key = ['particle','ground','back','evolution'][i], file = `fx-${key}.png`;
    await sharp(effects[i].png).trim().resize(384,384,{fit:'contain',background:'#00000000'}).png({palette:true,colours:128}).toFile(path.join(out,file));
    pack.effects[key] = file;
  }
  for (const key of ['design','stage1','stage2','stage3','food','scene','effects']) report.sources[key] = { file: selection[key] || 'design/image-1.png', sha256: crypto.createHash('sha256').update(fs.readFileSync(source(key))).digest('hex') };
  pack.revision = crypto.createHash('sha256').update(JSON.stringify(report.sources)).digest('hex').slice(0,16);
  // Only the full in-process, source-bound review workflow can approve delivery.
  const reviewed = ['design','stage1','stage2','stage3','food','scene','effects'].every(k => {
    const r = reviews[k];
    if (!r || r.approved !== true || r.issues?.length !== 0 || !r.model || !photos.length) return false;
    const references = k === 'design' ? [photos[0], source(k)] : k.startsWith('stage') ? [path.join(directory,'references',`stage-${k.slice(-1)}-design.png`),source(k)] : [source('design'),source(k)];
    // Recompute the exact model request fingerprint. Stale reviews cannot approve new artwork.
    return require('./pet-visual-review.cjs').request({type:k.startsWith('stage')?'actions':k,references,model:r.model}).hash === r.hash;
  });
  pack.trial = !reviewed;
  report.status = reviewed ? 'accepted' : 'needs-visual-review';
  report.conversion = { status: 'ready', method: 'deterministic-chroma-grid-v1', aiCalls: 0, stages: 3, posesPerStage: 9,
    note: 'Ready for the shared game renderer; this is a technical format check, not a semantic art assessment.' };
  report.reviews = reviews;
  report.files = Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex')]));
  atomic(path.join(out,'pet.json'),pack); atomic(path.join(out,'quality.json'),report); atomic(path.join(out,'catalog.json'),['pet.json']);
  console.log((reviewed ? 'All image checks passed: ' : 'Candidate assembled; visual review is still required: ') + out);
  return { out, pack, report };
}
module.exports = { assemble };
if (require.main === module) {
  const args=process.argv.slice(2), get=n=>args[args.indexOf(n)+1];
  if (!['--in','--id','--name'].every(n=>args.includes(n))) throw Error('Required --in run-directory --id custom-… --name name');
  const directory=path.resolve(get('--in'));
  assemble({directory,id:get('--id'),name:get('--name'),selection:JSON.parse(fs.readFileSync(path.join(directory,'selection.json')))}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
