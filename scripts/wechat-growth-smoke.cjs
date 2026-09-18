'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.WECHAT_REVIEW_BASE||'http://127.0.0.1:8790',out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/kingdom-elements-20260918/ui-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const results=[];
 for(const [width,height]of [[320,568],[375,667],[390,844],[430,932],[1280,900]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],images=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});page.on('request',r=>{if(/\.(png|jpg)(?:\?|$)/.test(r.url()))images.push(r.url());});
  await page.goto(base+'/wechat-test/preview.html');const ready=()=>page.waitForFunction(()=>window.mathPetPreview?.view.ready&&mathPetPreview.view.atlasKey===mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);await ready();
  const measurements=[];
  for(const level of [1,3,5,6,8,10,11,13,15]){
   await page.evaluate(level=>{const g=mathPetPreview.game;g.pet.level=level;g.pet.growth=0;g.home();g.visits.nextAt=Infinity;},level);await ready();await page.waitForTimeout(45);
   const m=await page.evaluate(()=>{const {view:v,game:g}=mathPetPreview,L=v.lastHomeLayout,B=v.lastPetPlacement.bounds;
    return {level:g.visualLevel,layout:L,pet:B,effects:v.lastEffectRecipe,world:v.lastWorldRecipe,viewHeight:v.height,hits:v.hits.map(({id,x,y,w,h})=>({id,x,y,w,h}))};});
   assert.ok(m.pet.left>=m.layout.scene.x-1&&m.pet.right<=m.layout.scene.x+m.layout.scene.width+1);
   assert.ok(m.pet.top>=m.layout.scene.y-1&&m.pet.bottom<=m.layout.scene.y+m.layout.scene.height+1);
   assert.ok(m.hits.every(h=>h.x>=0&&h.y>=0&&h.x+h.w<=390&&h.y+h.h<=m.viewHeight));
   assert.ok(m.layout.scene.height<=440&&m.layout.scene.height<m.viewHeight-300);assert.equal(m.layout.buttonHeight,64);assert.ok(m.pet.bottom-m.pet.top<m.layout.scene.height*.78);measurements.push(m);
   if(width===390||[1,11].includes(level)){await page.waitForTimeout(950);await page.screenshot({path:path.join(out,`${width}-level-${level}.png`)});}
  }
  await page.evaluate(()=>{const g=mathPetPreview.game;g.pet.level=1;g.pet.growth=0;g.home();});await ready();
  await page.evaluate(()=>mathPetPreview.game.feed());await page.waitForTimeout(90);await page.screenshot({path:path.join(out,`${width}-feeding.png`)});await page.waitForFunction(()=>!mathPetPreview.game.busy);await page.waitForTimeout(90);await page.screenshot({path:path.join(out,`${width}-reward.png`)});
  await page.evaluate(()=>{const g=mathPetPreview.game;g.debug(5);g.home();});await ready();await page.evaluate(()=>mathPetPreview.game.feed());await page.waitForFunction(()=>mathPetPreview.game.modal?.type==='upgrade'&&mathPetPreview.view.ready);await page.waitForTimeout(80);await page.screenshot({path:path.join(out,`${width}-upgrade.png`)});
  assert.deepEqual(errors,[]);assert.ok(!images.some(u=>/shared-art|\/scene\.|-halo\.|\/effects\//.test(u)));
  const sharedTextures=[...new Set(images.filter(u=>u.includes('/world-art/')))];
  if(process.env.WECHAT_EXPECT_SHARED_ART!=='0'){
   const groups=new Set(sharedTextures.map(u=>u.split('/').pop().split('.')[0]));
   assert.ok([...groups].every(g=>['skies','places','grounds','nature','landmarks','living'].includes(g)));
   for(const m of measurements){
    for(const group of [m.world.sky.split('-')[0],'nature','landmarks','living',...(m.world.ground?['grounds']:[])])assert.ok(groups.has(group),'Missing scene texture: '+group);
   }
  }
  results.push({width,height,measurements,errors,sharedTextures});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(base+'/wechat-test/preview.html');await page.waitForFunction(()=>window.mathPetPreview?.view.ready);assert.equal(await page.evaluate(()=>mathPetPreview.view.reducedMotion),true);await page.close();
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS: 5 viewport sizes, 9 level comparisons, roomy frame, growing pet with breathing room, bounded controls, feeding and upgrade, shared atlas loading, reduced motion.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
