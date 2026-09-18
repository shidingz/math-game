// Isolated browser storage. Uses the actual bundled files; no fake asset URLs/backend.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(process.env.WECHAT_QA_DIR || 'artifacts/wechat-local');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [375, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 900 : 844 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
      await page.goto(process.env.WECHAT_PREVIEW_URL || 'http://127.0.0.1:8774/preview.html');
      async function tap(id) {
        await page.waitForFunction(id => window.mathPetPreview?.view.hits.some(h => h.id === id), id);
        const pos = await page.evaluate(id => { const { view, position } = mathPetPreview, h = view.hits.find(h => h.id === id), p = position(); if (h.y < 0 || h.y + h.h > view.height) throw Error('Offscreen ' + id); return { x: p.left + (h.x + h.w / 2) * p.scale, y: p.top + (h.y + h.h / 2) * p.scale }; }, id);
        await page.mouse.click(pos.x, pos.y);
      }
      await page.waitForFunction(() => window.mathPetPreview?.game.ready !== false && window.mathPetPreview?.view.hits.length);
      if (await page.evaluate(() => mathPetPreview.game.screen === 'pets')) {
        await tap('choose-bichon'); await tap('confirm');
      }
      await tap('pets'); await tap('studio');
      await tap('local-pets-add');
      const ids = await page.evaluate(() => mathPetPreview.game.studio.localPacks.map(p => p.id));
      assert.ok(ids.length,'Expected local pet packs');
      assert.equal(new Set(ids).size,ids.length);
      const completed = {};
      for (const id of ids) {
      await page.evaluate(id => { const g=mathPetPreview.game;g.open('pets');g.petPage=Math.floor(g.characters.findIndex(c=>c.id===id)/8); },id);
      await tap('choose-' + id); await page.waitForFunction(() => mathPetPreview.view.ready && mathPetPreview.view.atlasKey === mathPetPreview.game.character.stages[mathPetPreview.game.stage].png);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 0);
      assert.deepEqual(await page.evaluate(ids => Object.fromEntries(ids.map(id=>[id,mathPetPreview.game.state.pets[id]])),Object.keys(completed)),completed);
      await page.evaluate(() => { mathPetPreview.game.state.points = 100; mathPetPreview.game.save(); });
      await tap('feed'); await page.waitForFunction(() => !mathPetPreview.game.busy);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      await page.reload(); await page.waitForFunction(() => window.mathPetPreview?.view.ready);
      assert.equal(await page.evaluate(() => mathPetPreview.game.state.activePet), id);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      await tap('pets'); await tap('studio'); await tap('local-pets-add'); await tap('choose-' + id);
      assert.equal(await page.evaluate(() => mathPetPreview.game.pet.growth), 20);
      for (const level of [1, 6, 11]) {
        await page.evaluate(l => { const g = mathPetPreview.game; g.pet.level = l; g.home(); }, level);
        await page.waitForFunction(l => mathPetPreview.view.ready && mathPetPreview.view.atlasKey === mathPetPreview.game.character.stages[Math.floor((l - 1) / 5)].png, level);
        for (const action of ['idle','blink','wave','pet','feed','think','sleep','jump','skill']) {
          await page.evaluate(a => mathPetPreview.game.play(a), action); await page.waitForTimeout(40);
        }
        await page.evaluate(() => mathPetPreview.game.play('idle')); await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(output, `${id}-${width}-stage-${Math.floor((level - 1) / 5) + 1}.png`) });
      }
      for (const level of [5, 10]) {
        await page.evaluate(l => { const g = mathPetPreview.game; g.pet.level = l; g.pet.growth = l === 5 ? 60 : 100; g.state.points = 100; g.home(); }, level);
        await page.waitForFunction(() => mathPetPreview.view.ready && mathPetPreview.view.atlasKey === mathPetPreview.game.character.stages[mathPetPreview.game.stage].png); await tap('feed');
        await page.waitForFunction(() => mathPetPreview.game.modal?.type === 'upgrade' && mathPetPreview.view.ready);
        assert.equal(await page.evaluate(() => mathPetPreview.game.pet.level), level + 1);
        await tap('upgrade-close');
      }
      completed[id]=await page.evaluate(()=>({...mathPetPreview.game.pet}));
      }
      assert.deepEqual(await page.evaluate(ids => Object.fromEntries(ids.map(id=>[id,mathPetPreview.game.state.pets[id]])),ids),completed);
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: every bundled pet, unique IDs, independent saves, bundled import, repeat/reload, independent growth, 3 stages × 9 poses, feeding and both evolutions on 3 viewports; no failed assets or browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
