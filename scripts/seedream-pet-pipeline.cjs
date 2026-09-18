'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const crypto = require('node:crypto');
const chroma = require('./pet-chroma.cjs');
const { generate, atomic } = require('./seedream-client.cjs');
const prompts = require('./pet-design-prompts.cjs');
const args = process.argv.slice(2), get = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
async function main() {
  if (!args.includes('--out') || !args.includes('--photos')) throw Error('Required: --out artifacts/run-name --photos photo1.png,photo2.png [--submit] [--step design|stage1|stage2|stage3|food|scene|effects]');
  const out = path.resolve(get('--out')), photos = get('--photos').split(',').map(p => path.resolve(p));
  if (photos.length < 1 || photos.length > 3) throw Error('Use 1–3 photos of the same subject');
  const recipePath = path.join(out, 'recipe.json'), oldRecipe = fs.existsSync(recipePath) ? JSON.parse(fs.readFileSync(recipePath)) : null;
  if (oldRecipe && oldRecipe.version < 4) throw Error('Use a new job folder for the optional-reference workflow');
  const style = get('--reference', oldRecipe?.reference || 'none');
  if (!['none','siamese'].includes(style)) throw Error('Use --reference none or siamese');
  if (oldRecipe && style !== oldRecipe.reference) throw Error('Reference changed: use a new job folder');
  const designInput = get('--design-image');
  const designHash = designInput ? crypto.createHash('sha256').update(fs.readFileSync(path.resolve(designInput))).digest('hex') : null;
  if (oldRecipe && designHash !== oldRecipe.designHash) throw Error('Selected design changed: use a new job folder');
  const photoHashes = photos.map(p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
  if (oldRecipe?.photoHashes && JSON.stringify(oldRecipe.photoHashes) !== JSON.stringify(photoHashes)) throw Error('Photos changed: use a new job folder');
  const key = get('--matte', oldRecipe ? oldRecipe.matte || 'green' : await chroma.choose(photos));
  chroma.color(key);
  if (oldRecipe && key !== (oldRecipe.matte || 'green')) throw Error('Matte changed: use a new job folder');
  const model = get('--model', oldRecipe?.model || 'doubao-seedream-5-0-pro-260628');
  if(oldRecipe?.model && oldRecipe.model !== model) throw Error('Model changed: use a new job folder');
  atomic(recipePath, { version: 4, reference: style, designHash, model, matte: key, photos: photos.map(p=>path.basename(p)), photoHashes, note: 'Source photos stay on the worker; no client credentials.' });
  if (designInput) {
    const target = path.join(out,'design/image-1.png');
    fs.mkdirSync(path.dirname(target),{recursive:true});
    if (fs.existsSync(target) && crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== designHash) throw Error('Stored design differs from the locked design');
    if (!fs.existsSync(target)) fs.copyFileSync(path.resolve(designInput),target);
    atomic(path.join(out,'design/import.json'),{sha256:designHash,source:path.basename(designInput)});
  }
  if (get('--step') === 'all') {
    if (!args.includes('--id') || !args.includes('--name')) throw Error('Full pipeline also requires --id and --name');
    const { spawnSync } = require('node:child_process'), { atlas, cutout, split } = require('./pet-matte.cjs');
    const selection = {}, budget = Number(get('--max-requests', '12'));
    if (!Number.isInteger(budget) || budget < 1 || budget > 30) throw Error('Request limit must be 1–30');
    const base = args.filter((v,i) => !['--step','--attempt','--feedback-file'].includes(v) && !['--step','--attempt','--feedback-file'].includes(args[i-1]));
    const reviews = {};
    for (const step of ['design','stage1','stage2','stage3','food','scene','effects']) {
      let accepted = false;
      let feedback;
      for (let attempt = 1; attempt <= 2; attempt++) {
        atomic(path.join(out,'pipeline-status.json'),{state:'processing',step,attempt,updatedAt:new Date().toISOString()});
        const folder = attempt === 1 ? step : step + '-attempt-' + attempt;
        const count = fs.existsSync(out) ? fs.readdirSync(out).filter(f=>fs.existsSync(path.join(out,f,'status.json'))).length : 0;
        if (!(step === 'design' && designInput) && count >= budget && !fs.existsSync(path.join(out,folder,'status.json'))) throw Error('Per-job API request limit reached; inspect failed assets');
        const run = step === 'design' && designInput ? {status:0} : spawnSync(process.execPath,[__filename,...base,'--step',step,'--attempt',String(attempt),...(feedback ? ['--feedback-file',feedback] : [])],{stdio:'inherit',env:process.env});
        if (run.status !== 0) throw Error('Step requires attention; no automatic resubmit: ' + folder);
        if (!args.includes('--submit')) return;
        const file = path.join(out,folder,'image-1.png');
        try {
          if (step.startsWith('stage')) await atlas(file,path.join(out,'processed',step),{key});
          if (step === 'food') await cutout(file,{key});
          if (step === 'effects') await split(file,2,2,{key});
          if (args.includes('--review')) {
            const design = path.join(out, selection.design || 'design/image-1.png');
            const refs = step === 'design' ? [photos[0], file] : step.startsWith('stage') ? [path.join(out,'references',`stage-${step.slice(-1)}-design.png`),file] : [design,file];
            const reviewFile = path.join(out,folder,'review.json');
            // Availability/network errors stop the run; they are not bad images.
            const result = await require('./pet-visual-review.cjs').review({type:step.startsWith('stage')?'actions':step,references:refs,file:reviewFile,model:get('--review-model','doubao-seed-2-0-lite-260428'),submit:true});
            reviews[step] = result;
            if (!result.approved && step === 'design' && designInput) throw Error('Vision review rejected the locked design; select a new design before generating actions');
            if (!result.approved) { feedback = reviewFile; console.log('Rejected by visual review: ' + folder); continue; }
          }
          selection[step] = folder + '/image-1.png'; accepted = true; break;
        } catch (e) {
          if (/Vision review|fetch|timeout|schema|JSON/i.test(e.message)) throw e;
          feedback = path.join(out,folder,'geometry-failure.json');
          atomic(feedback,{message:e.message,issues:['请缩小每格主体并扩大纯色留白，保持完整身体，不画格线，不与邻格重叠；背景须为指定纯色，不能带阴影。']}); console.log('Rejected by local image checks: ' + folder);
        }
      }
      if (!accepted) throw Error('Two attempts failed image checks for ' + step + '; review before spending more');
      atomic(path.join(out,'selection.json'),selection);
    }
    const result = await require('./assemble-seedream-pet.cjs').assemble({directory:out,id:get('--id'),name:get('--name'),selection,reviews,photos});
    atomic(path.join(out,'pipeline-status.json'),{state:result.report.status==='accepted'?'ready':'ready-for-test',conversion:result.report.conversion,updatedAt:new Date().toISOString()});
    return;
  }
  const ref = path.join(out, 'references'); fs.mkdirSync(ref,{recursive:true});
  const step = get('--step', 'design'), submit = args.includes('--submit');
  const selected = fs.existsSync(path.join(out,'selection.json')) ? JSON.parse(fs.readFileSync(path.join(out,'selection.json'))) : {};
  const designFile = path.join(out, selected.design || 'design/image-1.png');
  let prompt, images, size = '2048x2048';
  if (step === 'design') {
    if (designInput) { console.log('Using locked design: ' + designFile); return; }
    prompt = prompts.design(photos.length,style === 'siamese'); images = [...photos]; size = '3072x1280';
    if (style === 'siamese') {
      const example = path.join(ref,'siamese-growth.png');
      await require('./pet-evolution-study.cjs').reference(example); images.push(example);
    }
  }
  else if (/^stage[123]$/.test(step)) {
    const n = Number(step.slice(-1)), info = await sharp(designFile).metadata();
    const left = Math.round((n - 1) * info.width / 3), width = Math.round(n * info.width / 3) - left;
    const target = path.join(ref, `stage-${n}-design.png`);
    await sharp(designFile).extract({ left, top: 0, width, height: info.height }).png().toFile(target);
    prompt = prompts.actions(n); images = [target];
  } else if (['food','scene','effects'].includes(step)) { prompt = prompts[step]; images = [designFile]; }
  else throw Error('Unknown step');
  prompt = chroma.prompt(prompt,key);
  if (args.includes('--feedback-file')) {
    const feedback = JSON.parse(fs.readFileSync(get('--feedback-file')));
    if (!Array.isArray(feedback.issues) || feedback.issues.some(s=>typeof s !== 'string')) throw Error('Invalid visual feedback');
    prompt += '\n上次图像未通过以下画面检查，请重新生成并修正这些具体问题，其他要求保持：\n' + feedback.issues.slice(0,1).map(s=>s.slice(0,65)).join('\n');
  }
  const attempt = get('--attempt', '1');
  if (!/^[1-9][0-9]?$/.test(attempt)) throw Error('Invalid attempt number');
  const directory = path.join(out, attempt === '1' ? step : step + '-attempt-' + attempt);
  const result = await generate({ directory, prompt, references: images, size, model, submit });
  console.log(JSON.stringify(result));
}
main().catch(e => {
  if(get('--step')==='all' && get('--out')) atomic(path.resolve(get('--out'),'pipeline-status.json'),{state:'needs-attention',message:e.message,updatedAt:new Date().toISOString()});
  console.error(e.message); process.exitCode = 1;
});
