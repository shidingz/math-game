/* Isolated browser adapter checks. Never connect to an existing user profile. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.WECHAT_PREVIEW_URL || 'http://127.0.0.1:8771/preview.html';
const output = path.resolve(process.env.WECHAT_QA_DIR || 'artifacts/wechat');
fs.mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  let checks = 0;
  const errors = [];
  try {
    for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 1280, height: 900 }]) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => window.mathPetPreview?.view.portraits.size === 8);
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      async function tap(id) {
        await settle();
        const point = await page.evaluate(id => {
          const { view, position } = mathPetPreview, hit = view.hits.find(h => h.id === id);
          if (!hit) throw Error('Missing touch target: ' + id + ' screen=' + mathPetPreview.game.screen);
          const p = position();
          if (hit.y < 0 || hit.y + hit.h > view.height + 1) throw Error('Offscreen target: ' + id);
          return { x: p.left + (hit.x + hit.w / 2) * p.scale, y: p.top + (hit.y + hit.h / 2) * p.scale };
        }, id);
        await page.mouse.click(point.x, point.y); checks++;
      }
      await page.screenshot({ path: path.join(output, `pets-${size.width}.png`) });
      await tap('choose-ragdoll'); await tap('confirm');
      await page.waitForFunction(() => mathPetPreview.view.ready);
      await tap('settings'); await tap('grade-0'); await tap('topic-add5');
      assert.equal(await page.evaluate(() => mathPetPreview.game.screen), 'home'); await tap('quiz');
      await page.screenshot({ path: path.join(output, `quiz-${size.width}.png`) });
      for (let i = 0; i < 2; i++) {
        const answer = await page.evaluate(() => mathPetPreview.game.question.answerText);
        for (const char of answer) await tap('key-' + char);
        await tap('submit');
        await page.waitForFunction(index => mathPetPreview.game.state.round.index === index, i + 1);
      }
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.points), 20);
      await tap('key-9'); await tap('key-9'); await tap('submit');
      await page.waitForFunction(() => mathPetPreview.game.question.status === 'wrong');
      await page.screenshot({ path: path.join(output, `wrong-${size.width}.png`) });
      await tap('next'); await tap('back');
      await page.waitForFunction(() => mathPetPreview.view.ready);
      await tap('feed');
      await page.waitForFunction(() => !mathPetPreview.game.busy);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.points), 0);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      await page.screenshot({ path: path.join(output, `fed-${size.width}.png`) });
      await page.reload();
      await page.waitForFunction(() => mathPetPreview?.view.ready);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      await tap('mistakes'); assert.equal(await page.evaluate(() => mathPetPreview.game.state.mistakes.length), 1);
      await tap('back'); await tap('guide');
      await page.screenshot({ path: path.join(output, `guide-${size.width}.png`) });
      await tap('back');

      // Synthetic game state is limited to this isolated browser context.
      await page.evaluate(() => { const g = mathPetPreview.game; g.state.points = 240; });
      await tap('pets'); await tap('choose-wukong'); await tap('confirm');
      await page.waitForFunction(() => mathPetPreview.view.ready);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.points), 40);
      await page.evaluate(() => { const g = mathPetPreview.game; g.pet.level = 5; g.pet.growth = 60; });
      await tap('feed');
      await page.waitForFunction(() => mathPetPreview.game.modal?.type === 'upgrade' && mathPetPreview.view.ready);
      await page.screenshot({ path: path.join(output, `upgrade-${size.width}.png`) });
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.level), 6);
      await tap('upgrade-close');
      await page.evaluate(() => { mathPetPreview.hide(); });
      const before = await page.evaluate(() => mathPetPreview.game.time);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => mathPetPreview.game.time), before);
      await page.evaluate(() => mathPetPreview.show());

      if (size.width === 390) {
        for (const id of await page.evaluate(() => mathPetPreview.game.ids)) for (const level of [1, 6, 11]) {
          await page.evaluate(({ id, level }) => {
            const g = mathPetPreview.game;
            g.state.unlockedPets[id] = true; g.state.pets[id] = { level, growth: 0, feeds: 0 };
            g.state.activePet = id; g.home();
          }, { id, level });
          await settle();
          await page.waitForFunction(() => mathPetPreview.view.ready);
          await page.screenshot({ path: path.join(output, `${id}-${level}.png`) });
          for (const action of ['wave', 'pet', 'feed', 'think', 'comfort', 'celebrate', 'jump', 'sleep', 'run', 'skill', 'evolve']) {
            await page.evaluate(action => { const g = mathPetPreview.game; g.play(action); g.action.start -= 210; }, action);
            await settle(); checks++;
          }
        }
      }
      await context.close();
    }
    // A failed subpackage must leave a usable retry affordance.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(url + '?failAssets=1');
    await page.waitForFunction(() => window.mathPetPreview?.view.portraits.size === 8);
    await page.evaluate(() => { const g = mathPetPreview.game; g.choose('yutu'); g.confirm(); });
    await page.waitForFunction(() => mathPetPreview.view.error);
    await page.evaluate(() => { history.replaceState({}, '', location.pathname); mathPetPreview.view.syncAtlas(true); });
    await page.waitForFunction(() => mathPetPreview.view.ready);
    await context.close();
    assert.deepEqual(errors, []);
    console.log(`PASS: ${checks} touch/action checks; 3 screen sizes; 8 characters × 3 stages; persistence, feeding, upgrades, pause, retry. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
