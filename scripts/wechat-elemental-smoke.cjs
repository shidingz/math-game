'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.WECHAT_REVIEW_BASE||'http://127.0.0.1:8789',out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/elemental-awakening-20260918/elemental-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const errors=[],reports=[],page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base+'/wechat-test/preview.html?test=0');await page.waitForFunction(()=>window.mathPetPreview);
 await page.evaluate(()=>{const g=mathPetPreview.game;g.choose('wukong');g.confirm();g.choose(g.characters.find(c=>c.custom).id);});
 const ready=()=>page.waitForFunction(()=>mathPetPreview.view.ready&&mathPetPreview.view.atlasKey===mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);
 await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.testMode),false);
 const read=async()=>page.evaluate(()=>{const {game:g,view:v}=mathPetPreview;v.render();return{points:g.state.points,level:g.pet.level,growth:g.pet.growth,...v.lastEvolutionProgress};});
 let before=await read();assert.equal(before.questions,30);reports.push(before);await page.screenshot({path:path.join(out,'formal-first.png')});
 await page.evaluate(()=>{const g=mathPetPreview.game;g.configure(0,'add5');g.startQuiz();g.input=g.question.answerText;g.submit();g.home();});
 let after=await read();assert.equal(after.points,10);assert.equal(after.questions,29);assert.equal(after.growth,0);
 await page.evaluate(()=>{const g=mathPetPreview.game;g.startQuiz(true);g.input=g.question.answerText;g.submit();g.home();g.feed();});
 await page.waitForFunction(()=>!mathPetPreview.game.busy);after=await read();assert.equal(after.points,0);assert.equal(after.questions,28);assert.equal(after.feeds,14);assert.equal(after.growth,20);reports.push(after);
 await page.evaluate(()=>{const g=mathPetPreview.game;g.pet.level=5;g.pet.growth=60;g.state.points=20;g.home();});before=await read();assert.equal(before.questions,0);assert.equal(before.feeds,1);assert.match(before.message,/积分已够/);await page.screenshot({path:path.join(out,'formal-ready.png')});
 await page.evaluate(()=>mathPetPreview.game.feed());await page.waitForFunction(()=>mathPetPreview.game.modal?.type==='upgrade');await page.evaluate(()=>mathPetPreview.game.confirm());await ready();after=await read();assert.equal(after.level,6);assert.equal(after.nextLevel,11);assert.equal(after.questions,50);reports.push(after);await page.screenshot({path:path.join(out,'formal-evolved.png')});
 await page.evaluate(()=>{const g=mathPetPreview.game;g.pet.level=10;g.pet.growth=100;g.state.points=20;g.home();g.feed();});await page.waitForFunction(()=>mathPetPreview.game.modal?.type==='upgrade');await page.evaluate(()=>mathPetPreview.game.confirm());await ready();after=await read();assert.equal(after.level,11);assert.equal(after.completed,true);reports.push(after);
 await page.close();
 const review=await browser.newPage({viewport:{width:1240,height:1000}});review.on('pageerror',e=>errors.push(e.message));review.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await review.goto(base+'/review/');await review.waitForFunction(()=>document.querySelectorAll('#pet option').length===13);assert.equal(await review.locator('#domains canvas').count(),4);
 await review.locator('[data-level="11"]').click();
 const domains=[];
 for(const domain of ['solar','ice','leaf','thunder']){await review.selectOption('#domain',domain);await review.waitForFunction(domain=>document.querySelector('#demo').contentWindow.mathPetPreview.view.lastWorldRecipe?.domain===domain,domain);await review.waitForTimeout(150);const r=await review.evaluate(()=>{const a=document.querySelector('#demo').contentWindow.mathPetPreview;return{profile:a.view.effectProfile(),recipe:a.view.lastEffectRecipe};});assert.equal(r.profile.domain,domain);assert.equal(r.recipe.level,11);domains.push(r);await review.locator('#demo').screenshot({path:path.join(out,domain+'.png')});}
 await review.selectOption('#domain','');await review.screenshot({path:path.join(out,'review.png'),fullPage:true});
 for(const level of [1,6,11,15]){await review.locator('[data-level="'+level+'"]').click();await review.waitForFunction(level=>{const a=document.querySelector('#demo').contentWindow.mathPetPreview;return a.game.visualLevel===level&&a.view.ready&&a.view.atlasKey===a.game.character.stages[a.game.stage].png;},level);await review.waitForTimeout(150);await review.locator('#demo').screenshot({path:path.resolve(out,'../ui-qa/390-level-'+level+'.png')});}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({formalEvolution:reports,domains,errors},null,2));console.log('PASS: real formal-mode +10 quiz rewards, feeding, wallet deduction, Lv.6/Lv.11 transitions, 4 elemental styles, review controls and latest screenshots.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
