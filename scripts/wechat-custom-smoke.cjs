/* Synthetic assets and sessions in an isolated browser; never a real generation service. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(process.env.WECHAT_EXPORT || 'dist-wechat');
const url = process.env.WECHAT_PREVIEW_URL || 'http://127.0.0.1:8773/preview.html';
const output = path.resolve(process.env.WECHAT_QA_DIR || 'artifacts/wechat-custom'); fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const width of [375,390,1280]) {
   const context=await browser.newContext({viewport:{width,height:width===1280?900:844}}), page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/preview.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'preview.js'),'utf8').replace('"assetHosts":[]','"assetHosts":["pets.example.com"]')}));
   await page.route('https://pets.example.com/**',route=>{
    const n=/stage-([123])/.exec(route.request().url())?.[1]||'1';
    return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,`pets/bichon/stage-${n}.png`))});
   });
   await page.goto(url); await page.waitForFunction(()=>window.mathPetPreview?.view.portraits.size===8);
   async function tap(id){await page.waitForFunction(id=>mathPetPreview.view.hits.some(h=>h.id===id),id);const p=await page.evaluate(id=>{const {view,position}=mathPetPreview,h=view.hits.find(h=>h.id===id),p=position();if(h.y<0||h.y+h.h>view.height)throw Error('Offscreen '+id);return {x:p.left+(h.x+h.w/2)*p.scale,y:p.top+(h.y+h.h/2)*p.scale};},id);await page.mouse.click(p.x,p.y);}
   await tap('choose-bichon');await tap('confirm');await tap('pets');await tap('studio');
   for(let i=0;i<2;i++){
    const chooser=page.waitForEvent('filechooser'); await tap('photo-album'); await (await chooser).setFiles(path.join(root,'portraits/bichon.png'));
    await page.waitForFunction(()=>mathPetPreview.game.studio.selected.length===1);await tap('photo-submit');
    await page.waitForFunction(n=>mathPetPreview.game.studio.jobs.length===n&& !mathPetPreview.game.studio.working,i+1);
   }
   await page.screenshot({path:path.join(output,`studio-${width}.png`)});
   await page.reload();await page.waitForFunction(()=>window.mathPetPreview?.game.studio.jobs.length===2);
   assert.equal(await page.evaluate(()=>mathPetPreview.game.characters.length),8);
   await page.evaluate(()=>{
    const g=mathPetPreview.game;g.state.points=400;
    const base=g.characters.find(c=>c.id==='bichon');
    const rows=Array.from({length:10},(_,i)=>({requestId:'req-fixture-'+i,status:'ready',pet:{schemaVersion:1,id:'custom-fixture-'+i,name:'专属伙伴'+(i+1),revision:'v1',cellSize:384,stages:[1,2,3].map(n=>({image:`https://pets.example.com/stage-${n}.png`,bounds:base.stages[n-1].bounds}))}}));
    g.studio.apply(rows);g.studio.apply(rows);g.open('pets');
   });
   await tap('pets-next');await tap('choose-custom-fixture-0');await page.waitForFunction(()=>mathPetPreview.view.ready);
   await tap('feed');await page.waitForFunction(()=>!mathPetPreview.game.busy);
   assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),20);
   await page.reload();await page.waitForFunction(()=>window.mathPetPreview?.view.ready);
   assert.equal(await page.evaluate(()=>mathPetPreview.game.state.activePet),'custom-fixture-0');
   assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),20);
   assert.equal(await page.evaluate(()=>mathPetPreview.game.characters.length),18);
   for(const level of [5,10]){
    await page.evaluate(l=>{const g=mathPetPreview.game;g.pet.level=l;g.pet.growth=l===5?60:100;g.state.points=400;g.home();},level);
    await page.waitForFunction(()=>mathPetPreview.view.ready);await tap('feed');
    await page.waitForFunction(()=>mathPetPreview.game.modal?.type==='upgrade'&&mathPetPreview.view.ready);
    assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.level),level+1);await tap('upgrade-close');
   }
   await page.screenshot({path:path.join(output,`custom-pet-${width}.png`)});
   await tap('pets');await tap('pets-next');
   await page.waitForFunction(()=>mathPetPreview.view.media.get('https://pets.example.com/stage-1.png')?.width>0);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(output,`custom-list-${width}.png`)});
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: 3 viewport sizes; real file picker drafts; reload; 10 custom pets; duplicate completion; paginated selection; independent feeding; both evolutions; no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
