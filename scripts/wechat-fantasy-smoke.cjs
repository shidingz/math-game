'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.WECHAT_PREVIEW_URL,out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/fantasy-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const results=[];
 for(const width of [375,390,1280]){
  const context=await browser.newContext({viewport:{width,height:width===375?667:width===1280?900:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const ready=()=>page.waitForFunction(()=>window.mathPetPreview?.view.ready&&mathPetPreview.view.atlasKey===mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);
  async function tap(id){await page.waitForFunction(id=>window.mathPetPreview?.view.hits.some(h=>h.id===id),id);const p=await page.evaluate(id=>{const {view,position}=mathPetPreview,h=view.hits.find(h=>h.id===id),p=position();if(h.y<0||h.y+h.h>view.height+1)throw Error('Offscreen '+id);return {x:p.left+(h.x+h.w/2)*p.scale,y:p.top+(h.y+h.h/2)*p.scale};},id);await page.mouse.click(p.x,p.y);}
  await page.goto(url+'?test=0');await tap('choose-bichon');await tap('confirm');await ready();
  const ids=await page.evaluate(()=>mathPetPreview.game.characters.filter(c=>c.custom).map(c=>c.id));assert.ok(ids.length>=2);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.state.points),0);
  await tap('pets');await page.waitForFunction(()=>mathPetPreview.view.hits.some(h=>h.id.startsWith('choose-')));
  assert.equal(await page.evaluate(()=>mathPetPreview.view.hits.find(h=>h.id.startsWith('choose-')).id),'choose-'+ids[0]);
  await page.screenshot({path:path.join(out,`list-${width}.png`)});
  await tap('choose-'+ids[0]);await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.modal),null);assert.equal(await page.evaluate(()=>mathPetPreview.game.state.points),0);
  const before=await page.evaluate(()=>mathPetPreview.game.characters[0].procedural.spec);assert.equal(before.version,2);
  await page.evaluate(()=>{mathPetPreview.game.state.points=20;mathPetPreview.game.save()});await tap('feed');await page.waitForFunction(()=>!mathPetPreview.game.busy);
  await page.reload();await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),20);assert.equal(await page.evaluate(()=>mathPetPreview.game.state.points),0);assert.deepEqual(await page.evaluate(()=>mathPetPreview.game.character.procedural.spec),before);
  await tap('pets');await page.evaluate(()=>{mathPetPreview.game.state.points=199});await tap('choose-wukong');assert.equal(await page.evaluate(()=>mathPetPreview.game.modal),null);assert.match(await page.evaluate(()=>mathPetPreview.game.notice.text),/还差 1 积分/);
  await page.evaluate(()=>{mathPetPreview.game.state.points=200});await tap('choose-wukong');assert.match(await page.evaluate(()=>mathPetPreview.game.modal.text),/200 积分/);await tap('confirm');await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.state.points),0);
  await tap('pets');await tap('choose-'+ids[1]);await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),0);await tap('pets');await tap('choose-'+ids[0]);await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.pet.growth),20);
  assert.deepEqual(errors,[]);results.push({width,customOrder:ids,freeSelection:true,ordinaryPrice:200,independentGrowth:true,colors:before});await context.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS: new pets first, zero-point instant selection, 199/200 price boundary, reload, independent growth and stable matched colours at 3 widths');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
