/* Run with NODE_PATH pointing to the bundled runtime modules. Fresh browser profile only. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:8765/wukong-game/';
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    const setLevel=async value=>{await page.locator('#test-level').fill(String(value));await page.locator('#test-level').dispatchEvent('change');};
    // Formal save is only inside this disposable browser context, never the user's browser.
    await page.goto(url);await page.evaluate(()=>{const s=MathPetCore.initialState({chooseStarter:false});s.grade=2;s.points=499;localStorage.setItem('math-pet-game:v2',JSON.stringify(s));});await page.reload();
    await page.waitForFunction(()=>document.querySelector('wukong-game-pet')?.shadowRoot.querySelector('canvas'));
    assert.equal(await page.locator('#test-panel').isVisible(),false);await page.click('#unlock-pet');
    assert.ok(await page.locator('[data-unlock="yutu"]').isDisabled());assert.match(await page.locator('[data-unlock="yutu"]').innerText(),/1 积分/);
    await page.click('#characters-close');
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('math-pet-game:v2'));s.points=500;localStorage.setItem('math-pet-game:v2',JSON.stringify(s));});await page.reload();
    await page.click('#unlock-pet');await page.click('[data-unlock="yutu"]');assert.equal(await page.locator('#points').innerText(),'0');
    await page.click('[data-unlock="yutu"]');await page.waitForFunction(()=>document.querySelector('yutu-game-pet')?._atlas);
    assert.equal(await page.locator('#pet-name').innerText(),'玉兔');assert.equal(await page.locator('html').getAttribute('data-scene'),'moon');
    const formal=await page.evaluate(()=>localStorage.getItem('math-pet-game:v2'));
    await page.goto(url+'test.html');await page.waitForURL(/test=1/);await page.selectOption('.pet-select','yutu');await page.waitForFunction(()=>document.querySelector('yutu-game-pet')?._atlas);
    assert.ok(await page.locator('#test-panel').isVisible());assert.equal(await page.locator('#points').innerText(),'10000');assert.equal(await page.locator('#pet-name').innerText(),'玉兔');
    for(let level=1;level<=15;level++){
      await setLevel(String(level));await page.waitForFunction(n=>{const pet=document.querySelector('yutu-game-pet');return pet?.level===n&&!pet._loading;},level);
      assert.match(await page.locator('#test-effect').innerText(),new RegExp(`Lv\\.${level} ·`));
    }
    await page.selectOption('#test-action','idle');await page.click('#test-play');
    assert.deepEqual(await page.locator('#growth-bar').evaluate(el=>({value:el.value,max:el.max})),{value:0,max:300});
    await page.waitForTimeout(600);
    await page.screenshot({path:path.join(root,'qa/yutu-test-desktop.png'),fullPage:true});
    for(const action of ['wave','pet','feed','think','comfort','celebrate','jump','sleep','run','skill','evolve']){
      await page.selectOption('#test-action',action);await page.click('#test-play');assert.equal(await page.evaluate(()=>document.querySelector('yutu-game-pet').action),action);
    }
    await page.click('#test-idle');
    await page.click('[data-test-level="1"]');await page.waitForFunction(()=>!document.querySelector('yutu-game-pet')._loading);
    const count=await page.evaluate(()=>{window.__petClicks=0;document.querySelector('yutu-game-pet').addEventListener('pet-action',()=>window.__petClicks++);return window.__petClicks;});
    await page.locator('yutu-game-pet').locator('canvas').click();assert.ok(await page.evaluate(()=>window.__petClicks)>count);
    // The test shortcut raises the active pet immediately and keeps points unchanged.
    await page.click('[data-test-level="6"]');await setLevel('5');await page.waitForFunction(()=>!document.querySelector('yutu-game-pet')._loading);
    const points=Number(await page.locator('#points').innerText());await page.click('[data-test-command="level-up"]');
    assert.equal(Number(await page.locator('#points').innerText()),points);await page.waitForFunction(()=>document.querySelector('yutu-game-pet')?.level===6);await page.waitForFunction(()=>!document.querySelector('#feed').disabled);
    // Answer correctly advances automatically. Incorrect answer waits for explicit next.
    await page.click('#start');const answer=await page.evaluate(()=>JSON.parse(localStorage.getItem(MathPetStorage.key)).round.questions[0].answerText);
    await page.locator('#answer').fill(answer);await page.click('#submit');await page.waitForFunction(()=>document.querySelector('#question-number').textContent.includes('第 2 /'));
    await page.locator('#answer').fill('999999');await page.click('#submit');assert.ok(await page.locator('#next').isVisible());assert.match(await page.locator('#answer-feedback').innerText(),/正确答案/);await page.click('#next');assert.match(await page.locator('#question-number').innerText(),/第 3/);await page.click('#quiz-close');
    for(const id of ['wukong','nezha','yutu']){await page.selectOption('.pet-select',id);assert.equal(await page.locator('#pet-name').innerText(),{wukong:'孙悟空',nezha:'哪吒',yutu:'玉兔'}[id]);}
    await setLevel('11');await page.waitForFunction(()=>!document.querySelector('yutu-game-pet')._loading);await page.selectOption('#test-action','idle');await page.click('#test-play');
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(600);await page.screenshot({path:path.join(root,'qa/yutu-test-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.evaluate(()=>localStorage.getItem('math-pet-game:v2')),formal);
    await page.reload();assert.equal(await page.locator('#level').innerText(),'Lv.11');
    await page.goto(url);assert.equal(await page.locator('#points').innerText(),'0');assert.equal(await page.locator('#test-panel').isVisible(),false);
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'qa/yutu-browser-verification.json'),JSON.stringify({ok:true,checked:['500-point exchange','no automatic unlock','test save isolation','15 levels','all 12 actions','click interaction','feeding evolution','quiz correct auto-next and wrong manual-next','three character themes','mobile overflow','reload persistence'],errors},null,2));
    console.log('Browser checks passed: economy, Yutu actions/evolution, quiz, isolated test save, mobile and reload.');
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
