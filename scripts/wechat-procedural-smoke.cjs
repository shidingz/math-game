'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/procedural-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],images=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\.(png|jpg)(?:\?|$)/.test(r.url()))images.push(r.url());});
  await page.goto(process.env.WECHAT_PREVIEW_URL||'http://127.0.0.1:8779/wechat-test/preview.html');
  const ready=()=>page.waitForFunction(()=>window.mathPetPreview?.view.ready&&mathPetPreview.view.atlasKey===mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);await ready();
  const spec=await page.evaluate(()=>mathPetPreview.game.character.procedural.spec);assert.ok(spec);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.character.food.embedded),true);
  for(let level=1;level<=15;level++){
    await page.evaluate(level=>{const g=mathPetPreview.game;g.debug(level);g.home();},level);await ready();await page.waitForTimeout(30);
    if([1,5,6,10,11,15].includes(level))await page.screenshot({path:path.join(out,'level-'+level+'.png')});
  }
  await page.evaluate(()=>{const g=mathPetPreview.game;g.debug(1);g.pet.growth=0;g.home();});await ready();
  await page.evaluate(()=>mathPetPreview.game.feed());await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,'feeding.png')});await page.waitForFunction(()=>!mathPetPreview.game.busy);
  await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>mathPetPreview.game.character.procedural.spec),spec);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),20);
  const customImages=images.filter(u=>u.includes('/custom-assets/'));
  assert.ok(customImages.every(u=>/\/(stage-[123]|portrait)\.png(?:\?|$)/.test(u)),'No per-pet background, effect or food generation');
  const sharedImages=[...new Set(images.filter(u=>u.includes('/shared-art/')))];
  assert.deepEqual(sharedImages,[],'All backdrop and effects are drawn in code');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'procedural-results.json'),JSON.stringify({spec,levels:15,customImages:[...new Set(customImages)],sharedImages,errors},null,2));
  console.log('PASS: all 15 levels, embedded food, stable colours, procedural vector effects with no scene/VFX texture downloads.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
