'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.WECHAT_PREVIEW_URL||'http://127.0.0.1:8788/wechat-test/preview.html';
const out=path.resolve(process.env.WECHAT_QA_DIR||'artifacts/living-worlds-20260918/interaction-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
 try{for(const [width,height]of [[320,568],[390,844],[1280,900]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const ready=async()=>{try{await page.waitForFunction(()=>window.mathPetPreview?.view.ready&&mathPetPreview.view.atlasKey===mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);}catch(error){
   console.error('Atlas readiness diagnostic',await page.evaluate(()=>{const{game:g,view:v}=mathPetPreview;return{id:g.character.id,level:g.pet.level,stage:g.stage,screen:g.screen,expected:g.character.stages[g.stage].png,atlas:v.atlasKey,loading:v.loading,error:v.error,hidden:document.hidden};}));throw error;
  }};
  await ready();
  const tap=async id=>{
   await page.waitForFunction(id=>mathPetPreview.view.hits.some(h=>h.id===id),id);
   const point=await page.evaluate(id=>{const h=mathPetPreview.view.hits.find(h=>h.id===id),p=mathPetPreview.position();return{x:p.left+(h.x+h.w/2)*p.scale,y:p.top+(h.y+h.h/2)*p.scale};},id);
   await page.mouse.click(point.x,point.y);await page.waitForTimeout(40);
  };
  const id=await page.evaluate(()=>mathPetPreview.game.character.id);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'新伙伴');
  await tap('rename');await page.getByRole('textbox',{name:'伙伴名字'}).fill('奶糖');
  await page.screenshot({path:path.join(out,`${width}-rename-dialog.png`)});
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.waitForFunction(()=>!mathPetPreview.game.naming);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'奶糖');
  await tap('rename');await page.getByRole('textbox').fill('取消的名字');await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.waitForFunction(()=>!mathPetPreview.game.naming);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'奶糖');
  await tap('rename');await page.getByRole('textbox').fill('   ');await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.waitForFunction(()=>!mathPetPreview.game.naming);
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'奶糖');
  await page.evaluate(()=>mathPetPreview.game.studio.register());
  await page.reload();await ready();assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'奶糖');
  await tap('pets');await page.screenshot({path:path.join(out,`${width}-pet-list.png`)});
  await tap('choose-'+id);await ready();
  const other=await page.evaluate(()=>mathPetPreview.game.characters.find(c=>c.custom&&c.id!==mathPetPreview.game.character.id).id);
  await page.evaluate(id=>mathPetPreview.game.choose(id),other);await ready();
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'新伙伴');
  await tap('rename');await page.getByRole('textbox').fill('星星');await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.waitForFunction(()=>!mathPetPreview.game.naming);
  await page.evaluate(()=>mathPetPreview.game.choose('samoyed'));await ready();
  assert.ok(!(await page.evaluate(()=>mathPetPreview.view.hits.some(h=>h.id==='rename'))));
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'萨摩耶');
  await page.evaluate(id=>mathPetPreview.game.choose(id),id);await ready();
  await tap('settings');await tap('grade-0');await tap('topic-add5');
  assert.equal(await page.evaluate(()=>mathPetPreview.game.screen),'home');
  assert.equal(await page.evaluate(()=>mathPetPreview.game.state.round),null);
  await page.screenshot({path:path.join(out,`${width}-range-saved-home.png`)});
  await tap('quiz');await page.evaluate(()=>{const g=mathPetPreview.game;g.input=g.question.answerText;g.submit();});
  await page.waitForFunction(()=>mathPetPreview.game.state.round.index===1);
  await tap('back');await tap('settings');await tap('topic-add5');await tap('quiz');
  assert.equal(await page.evaluate(()=>mathPetPreview.game.state.round.index),1);
  await tap('back');await tap('settings');await tap('grade-6');await tap('topic-fraction');
  assert.equal(await page.evaluate(()=>mathPetPreview.game.screen),'home');assert.equal(await page.evaluate(()=>mathPetPreview.game.state.round),null);
  await page.reload();await ready();await tap('quiz');assert.equal(await page.evaluate(()=>mathPetPreview.game.state.round.grade),6);await tap('back');
  // Use actual exported art bounds across every pet and every level.
  const growth=[];
  for(const pid of await page.evaluate(()=>mathPetPreview.game.ids)){
   let before=0,first=0,last=0;
   for(let level=1;level<=15;level++){
    await page.evaluate(({pid,level})=>{const g=mathPetPreview.game;g.state.activePet=pid;g.pet.level=level;g.pet.growth=0;g.home();g.nextIdle=Infinity;}, {pid,level});await ready();
    const m=await page.evaluate(()=>{const {game:g,view:v}=mathPetPreview;g.play('idle');v.render();const b=v.lastPetPlacement.bounds;return{level:g.pet.level,height:b.bottom-b.top};});
    assert.ok(m.height>before,`${pid} Lv.${level} shrank: ${before} -> ${m.height}`);before=m.height;
    if(level===1)first=m.height;if(level===15)last=m.height;
   }
   assert.ok(last>first*1.8);growth.push({id:pid,first,last});
  }
  await page.evaluate(id=>{const g=mathPetPreview.game;g.state.activePet=id;g.pet.level=1;g.home();},id);await ready();
  assert.equal(await page.evaluate(()=>mathPetPreview.game.petName()),'奶糖');
  assert.deepEqual(errors,[]);reports.push({width,height,growth,errors,renameAndQuiz:true});await page.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(reports,null,2));
 console.log('PASS: name edit/cancel/validation/reload/re-register, independent names, immutable built-ins, range -> home -> quiz, 13 pets x 15 levels x 3 screens grow monotonically.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
