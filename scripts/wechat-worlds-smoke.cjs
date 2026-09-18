'use strict';
// Review page uses the shipped drawing vocabulary; the iframe runs real game code.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.WECHAT_REVIEW_BASE||'http://127.0.0.1:8788',out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/living-worlds-20260918');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base+'/review/');await page.waitForFunction(()=>document.querySelector('#pet').options.length===13);
 assert.equal(await page.locator('.element canvas').count(),56);
 await page.getByRole('button',{name:'Lv.15',exact:true}).click();await page.waitForTimeout(200);
 const frame=page.frames().find(f=>f.url().includes('/wechat-test/')),reports=[];
 for(const world of ['forest','bamboo','orchard','coast','alpine','meadow','cosmos','sunset']){
  await page.locator('#world').selectOption(world);await page.waitForTimeout(60);
  const report=await frame.evaluate(()=>{const app=mathPetPreview;app.hide();const start=performance.now();for(let i=0;i<120;i++){app.game.time+=16;app.view.render();}const ms=(performance.now()-start)/120;app.show();return {world:app.view.lastWorldRecipe.world,ms:+ms.toFixed(3),slots:app.view.lastWorldRecipe.slots.length};});
  assert.equal(report.world,world);assert.ok(report.slots<=17);reports.push(report);
 }
 await page.locator('#world').selectOption('forest');await page.waitForTimeout(100);
 await page.screenshot({path:path.join(out,'review-all.png'),fullPage:true});
 await page.locator('#world-gallery').screenshot({path:path.join(out,'worlds-gallery.png')});
 await page.locator('#element-gallery').screenshot({path:path.join(out,'elements-gallery.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'worlds-qa.json'),JSON.stringify({passed:true,elements:56,worlds:reports,errors,note:'Desktop Chrome synchronous draw submission, not phone FPS or GPU completion.'},null,2));
 console.log('PASS: 56 element canvases, 8 world compositions and live theme switching; no page/resource errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
