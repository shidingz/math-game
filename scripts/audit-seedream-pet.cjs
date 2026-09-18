'use strict';
// Audit an existing selected kit without creating any new images.
const fs = require('node:fs');
const path = require('node:path');
const { review } = require('./pet-visual-review.cjs');
const { atomic } = require('./seedream-client.cjs');
async function audit({ directory, photos = [], model, submit = false }) {
  const selection = JSON.parse(fs.readFileSync(path.join(directory,'selection.json')));
  const source = key => {
    const relative = selection[key] || (key==='design'?'design/image-1.png':'');
    if(!/^(design|stage[123]|food|scene|effects)(-attempt-[1-9][0-9]?)?\/image-1\.png$/.test(relative)) throw Error('Invalid source: '+key);
    return path.join(directory,relative);
  };
  const tasks = (photos.length ? ['design'] : []).concat(['stage1','stage2','stage3','food','scene','effects']);
  const reviews = {}, failures = {};
  async function next() {
    while(tasks.length) {
      const key=tasks.shift(), file=source(key);
      const references=key==='design'?[photos[0],file]:key.startsWith('stage')?[path.join(directory,'references',`stage-${key.slice(-1)}-design.png`),file]:[source('design'),file];
      try {
        const r=await review({type:key.startsWith('stage')?'actions':key,references,file:path.join(path.dirname(file),'review.json'),model,submit});
        reviews[key]=r; console.log(JSON.stringify({step:key,approved:r.approved,pending:r.pending,issues:r.issues}));
      } catch(e) { failures[key]=e.message; console.error(key+': '+e.message); }
    }
  }
  await Promise.all([next(),next()]);
  atomic(path.join(directory,'audit.json'),{reviews,failures,originalPhotoReviewed:!!photos.length});
  return {reviews,failures};
}
module.exports={audit};
if(require.main===module) {
  const args=process.argv.slice(2),get=(n,f)=>args.includes(n)?args[args.indexOf(n)+1]:f;
  if(!args.includes('--in')) throw Error('Required --in existing-run [--photos source.png] [--submit]');
  audit({directory:path.resolve(get('--in')),photos:get('--photos','').split(',').filter(Boolean).map(p=>path.resolve(p)),model:get('--model','doubao-seed-2-0-lite-260428'),submit:args.includes('--submit')}).then(r=>{if(Object.keys(r.failures).length)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
