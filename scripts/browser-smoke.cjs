/* Optional: install Playwright separately; uses only disposable browser storage. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),port=process.env.SMOKE_PORT||'8767',base=process.env.BASE_URL||`http://127.0.0.1:${port}/`,out=path.join(root,'artifacts/browser');
const ids=['wukong','ragdoll','corgi','samoyed','siamese','bichon','nezha','yutu'];
(async()=>{
 let server,browser;const report={base,errors:[],requests:[],viewports:[]};fs.mkdirSync(out,{recursive:true});
 try{
  if(!process.env.BASE_URL){server=spawn(process.execPath,[path.join(__dirname,'serve.cjs')],{env:{...process.env,PORT:port},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve()});server.once('error',reject);server.once('exit',code=>{if(code)reject(Error('Server failed: '+code))});});}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  for(const [name,width,height] of [['mobile',390,844],['desktop',1440,900]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:name==='mobile'?3:1});
   page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url(),status:r.status()});});
   await page.goto(base,{waitUntil:'networkidle'});
   await page.locator('#starter-dialog').waitFor({state:'visible'});assert.equal(await page.locator('.starter-option').count(),8);
   await page.locator('[data-starter="ragdoll"]').click();await page.locator('#starter-adopt').click();
   await page.locator('#settings-dialog').waitFor({state:'visible'});await page.locator('input[name="grade"][value="2"]').check();await page.locator('#settings-save').click();
   const formalSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('math-pet-game:v2')));assert.equal(formalSave.starterPet,'ragdoll');assert.equal(formalSave.points,0);assert.deepEqual(Object.keys(formalSave.unlockedPets),['ragdoll']);
   await page.goto(base+'?test=1',{waitUntil:'networkidle'});assert.equal(await page.locator('#points').innerText(),'10000');
   for(const id of ids){
    await page.locator('.pet-select').selectOption(id);
    for(const level of [1,6,11]){
     await page.evaluate(()=>document.querySelector('#test-panel').open=true);
     await page.locator('#test-level').fill(String(level));await page.locator('#test-level').dispatchEvent('change');
     await page.waitForFunction(id=>{const p=document.querySelector(id+'-game-pet');return !!p?._atlas&&!p._loading;},id);
     await page.locator('#test-action').selectOption('skill');await page.locator('#test-play').click();
     await page.evaluate(()=>document.querySelector('#test-panel').open=false);
     await page.screenshot({path:path.join(out,`${name}-${id}-${level}.png`)});
    }
   }
   await page.locator('.pet-select').selectOption('wukong');await page.waitForFunction(()=>!!document.querySelector('wukong-game-pet')?._atlas);
   await page.locator('#feed').click();await page.locator('#feed-notice').waitFor({state:'visible'});
   const feedCheck=await page.evaluate(()=>{const r=document.querySelector('#feed-notice').getBoundingClientRect(),g=document.querySelector('.growth').getBoundingClientRect();return{aboveGrowth:r.bottom<=g.top,pointer:getComputedStyle(document.querySelector('#feed-notice')).pointerEvents,buttons:['feed','start'].map(id=>{const el=document.getElementById(id),b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));})};});
   assert.equal(feedCheck.aboveGrowth,true);assert.equal(feedCheck.pointer,'none');assert.deepEqual(feedCheck.buttons,[true,true]);
   await page.locator('#feed').click();await page.locator('#feed-notice').waitFor({state:'visible'});
   await page.locator('#start').click();await page.locator('#quiz-dialog').waitFor({state:'visible'});
   const answer=await page.evaluate(()=>JSON.parse(localStorage.getItem('math-pet-game:test:v1')).round.questions[0].answerText);
   await page.locator('#answer').fill(answer);await page.locator('#submit').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('math-pet-game:test:v1')).round.index===1);
   await page.locator('#answer').fill('9999999');await page.locator('#submit').click();await page.locator('#next').waitFor({state:'visible'});assert.match(await page.locator('#answer-feedback').innerText(),/正确答案/);await page.locator('#next').click();await page.locator('#quiz-close').click();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('math-pet-game:v2')).points),0);
   await page.evaluate(()=>document.querySelector('#test-panel').open=true);await page.locator('#test-pet-upgrade').click();await page.locator('.pet-upgrade.is-ready').waitFor();await page.waitForFunction(()=>document.querySelector('.pet-upgrade-stage').getAnimations().every(a=>a.playState==='finished'));await page.screenshot({path:path.join(out,`${name}-upgrade.png`)});await page.locator('.pet-upgrade-done').click();await page.locator('.pet-upgrade').waitFor({state:'detached'});
   // Use only this disposable profile's own test save to exercise a grown pet
   // in the formal layout. Never reads or edits a user's actual browser profile.
   await page.evaluate(()=>localStorage.setItem('math-pet-game:v2',localStorage.getItem('math-pet-game:test:v1')));await page.goto(base,{waitUntil:'networkidle'});
   assert.equal(await page.locator('#test-panel').isVisible(),false);await page.locator('#feed').click();await page.locator('#feed-notice').waitFor({state:'visible'});await page.screenshot({path:path.join(out,`${name}-formal.png`)});
   const fits=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth<=innerWidth,vertical:document.documentElement.scrollHeight<=innerHeight+2}));assert.ok(fits.horizontal);assert.ok(fits.vertical);
   report.viewports.push({name,width,height,characters:ids,stages:[1,6,11],feedCheck,formalFits:fits,quiz:true,upgrade:true,isolatedSaves:true});await page.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS: all 8 pets × 3 stages × 2 viewports; first adoption, separate saves, feeding, quiz, upgrade, formal layout; no missing network assets.');
 }finally{await browser?.close();server?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
