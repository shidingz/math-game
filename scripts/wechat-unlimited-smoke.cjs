// Exercise the actual test bundle with isolated storage and real local artwork.
'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.resolve(process.env.WECHAT_QA_DIR || 'artifacts/wechat-unlimited');
const url = process.env.WECHAT_PREVIEW_URL || 'http://127.0.0.1:8778/preview.html';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const width of [375, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 900 : 844 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      async function ready() { await page.waitForFunction(() => window.mathPetPreview?.view.ready && mathPetPreview.view.atlasKey === mathPetPreview.game.character.stages[mathPetPreview.game.stage].png); }
      async function tap(id) {
        await page.waitForFunction(id => window.mathPetPreview?.view.hits.some(h => h.id === id), id);
        const p = await page.evaluate(id => {
          const { view, position } = mathPetPreview, h = view.hits.find(h => h.id === id), p = position();
          if (h.y < 0 || h.y + h.h > view.height) throw Error('Offscreen: ' + id);
          return { x: p.left + (h.x + h.w / 2) * p.scale, y: p.top + (h.y + h.h / 2) * p.scale };
        }, id);
        await page.mouse.click(p.x, p.y);
      }
      await page.goto(url); await ready();
      const initial = await page.evaluate(() => {
        const g = mathPetPreview.game;
        return { test: g.testMode, active: g.state.activePet, locals: g.studio.localPacks.map(p => p.id), unlocked: Object.keys(g.state.unlockedPets), label: g.pointsLabel };
      });
      assert.ok(initial.test); assert.equal(initial.label, '∞ 积分'); assert.ok(initial.locals.length);
      assert.ok(initial.locals.includes(initial.active));
      for (const id of initial.locals) assert.ok(initial.unlocked.includes(id));
      await page.evaluate(() => { mathPetPreview.game.state.points = 0; mathPetPreview.game.save(); });
      await tap('feed'); await page.waitForFunction(() => !mathPetPreview.game.busy);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.points), 0);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      await page.reload(); await ready();
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.activePet), initial.active);
      for (const level of [1, 6, 11]) {
        await page.evaluate(level => { const g = mathPetPreview.game; g.pet.level = level; g.pet.growth = 0; g.home(); }, level);
        await ready();
        for (const action of ['idle','blink','wave','pet','feed','think','sleep','jump','skill']) {
          await page.evaluate(action => mathPetPreview.game.play(action), action); await page.waitForTimeout(45);
        }
        await page.evaluate(() => mathPetPreview.game.play('idle')); await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(output, `${width}-stage-${Math.floor((level - 1) / 5) + 1}.png`) });
      }
      for (const level of [5, 10]) {
        await page.evaluate(level => { const g = mathPetPreview.game; g.debug(level); g.home(); }, level);
        await ready(); await tap('feed');
        await page.waitForFunction(() => mathPetPreview.game.modal?.type === 'upgrade' && mathPetPreview.view.ready);
        assert.equal(await page.evaluate(() => mathPetPreview.game.pet.level), level + 1);
        await page.screenshot({ path: path.join(output, `${width}-evolve-${level + 1}.png`) });
        await tap('upgrade-close');
      }
      // Same origin, different save: the default test build can explicitly run formal rules.
      await page.goto(url + '?test=0');
      await page.waitForFunction(() => window.mathPetPreview?.game.screen === 'pets');
      assert.equal(await page.evaluate(() => mathPetPreview.game.testMode), false);
      await tap('choose-bichon'); await tap('confirm'); await ready(); await tap('feed');
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 0);
      const formal = await page.evaluate(() => localStorage.getItem('math-pet-wechat:formal:v1'));
      await page.goto(url); await ready(); await tap('feed'); await page.waitForFunction(() => !mathPetPreview.game.busy);
      assert.equal(await page.evaluate(() => localStorage.getItem('math-pet-wechat:formal:v1')), formal);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.points), 0);
      assert.deepEqual(errors, []); results.push({ width, ...initial, passed: true }); await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log('PASS: 3 viewports; new pet auto-owned; unlimited feeding at zero balance; reload; 27 poses; Lv.6/11 fullscreen evolution; formal save and economy unchanged; no missing assets.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
