/* Real WeChat DevTools check. Requires the installed `wechatide` CLI and an open
 * independent test export. This does not upload/publish or inspect user saves.
 * Captures the real game Canvas because DevTools 2.02's standard screenshot
 * currently waits for the unrelated parent-context automator and times out. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const project = path.resolve(process.argv[2] || 'dist-wechat');
const out = path.resolve(process.argv[3] || 'artifacts/wechat-native');
const interact = process.argv.includes('--interact');
const exclusive = process.argv.includes('--exclusive-test');
assert.ok(!interact || exclusive, '--interact also requires --exclusive-test: do not run while the user is operating the simulator');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(out, { recursive: true });
function tool(name, args = {}) {
  const argv = ['-c', 'Codex', name, '--project', project];
  for (const [key, value] of Object.entries(args)) argv.push('--' + key, typeof value === 'string' ? value : JSON.stringify(value));
  // This CLI exits before very large piped stdout is fully flushed. Use a real
  // file descriptor for PNG data URLs, then parse the completed local result.
  const output = path.join(out, '.native-tool-result.json');
  const fd = fs.openSync(output, 'w');
  let call;
  try { call = spawnSync('wechatide', argv, { encoding: 'utf8', timeout: 40000, maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', fd, 'pipe'] }); }
  finally { fs.closeSync(fd); }
  call.stdout = fs.readFileSync(output, 'utf8');
  fs.rmSync(output);
  if (call.error) throw call.error;
  let answer; try { answer = JSON.parse(call.stdout); } catch (error) { fs.writeFileSync(path.join(out, 'invalid-tool-result.txt'), call.stdout); throw Error('Invalid DevTools result: ' + error.message + ' (' + call.stdout.length + ' characters, exit ' + call.status + ')'); }
  if (call.status || !answer.ok || answer.result?.success === false) throw Error(answer.message || answer.result?.error || 'DevTools call failed: ' + name);
  return answer.result;
}
function evaluate(body) {
  return tool('automation_evaluate', { 'fn-source': 'function(){var g=GameGlobal.__gameContextWindow||GameGlobal;var p=g.__mathPetNativeProbe;' + body + '}' }).result;
}
function capture(name) {
  const url = evaluate('return g.canvas.toDataURL("image/png");');
  assert.ok(typeof url === 'string' && url.startsWith('data:image/png;base64,'));
  const target = path.join(out, name + '.png');
  fs.writeFileSync(target, Buffer.from(url.split(',')[1], 'base64'));
  return target;
}
async function waitFor(body, max = 12000) {
  const start = Date.now();
  while (Date.now() - start < max) {
    if (evaluate('return !!(' + body + ');')) return;
    await sleep(200);
  }
  const detail = evaluate('return {screen:p?.game.screen,modal:p?.game.modal?.type,hits:p?.view.hits.map(h=>h.id)}');
  throw Error('Native condition timed out: ' + body + ' ' + JSON.stringify(detail));
}
async function tap(id) {
  console.log('Native tap: ' + id);
  assert.ok(!evaluate('return p.userIntervened===true;'), 'User is interacting; stop automated UI checks');
  await waitFor('p.view.hits.some(h=>h.id===' + JSON.stringify(id) + ')');
  const point = evaluate('var h=p.view.hits.find(h=>h.id===' + JSON.stringify(id) + ');if(!h)throw Error("Missing hit");var i=g.wx.getWindowInfo(),m=g.wx.getMenuButtonBoundingClientRect(),top=Math.max(i.safeArea?.top||0,m?.bottom||0)+8,bottom=Math.max(12,i.windowHeight-(i.safeArea?.bottom||i.windowHeight)),s=Math.min(i.windowWidth/390,(i.windowHeight-top-bottom)/660,1.8),left=(i.windowWidth-390*s)/2;return {x:left+(h.x+h.w/2)*s,y:top+(h.y+h.h/2)*s};');
  evaluate('p.expectedTouch=' + JSON.stringify(point) + ';p.expectedTouch.until=Date.now()+6000;return true;');
  tool('automation_game_action', { action: 'tap', x: point.x, y: point.y, 'coordinate-space': 'canvas' });
  assert.ok(!evaluate('p.expectedTouch=null;return p.userIntervened===true;'), 'User is interacting; stop automated UI checks');
  await sleep(120);
}
(async () => {
  const config = require(path.join(project, 'config.js'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'project.config.json'))).compileType, 'game');
  if (interact) assert.ok(config.debug && config.testDefault, 'Interaction checks require independent test-default export');
  // Observe the existing instance on its next render; never start a second game.
  evaluate('var V=g.require("runtime/view.js"),original=V.prototype.render;V.prototype.render=function(){g.__mathPetNativeProbe={view:this,game:this.game};V.prototype.render=original;return original.apply(this,arguments)};return true;');
  await waitFor('p&&p.view.ready');
  const initial = evaluate('return {assetVersion:g.require("config.js").assetVersion,testMode:p.game.testMode,screen:p.game.screen,petCount:p.game.characters.length,canvas:[g.canvas.width,g.canvas.height],level:p.game.pet.level};');
  assert.equal(initial.assetVersion, config.assetVersion);
  const screenshots = [capture('native-home')];
  const packages = evaluate('return (async function(){var A=g.require("runtime/platform.js").Assets,a=new A(g.wx),list=p.game.characters,result=[];for(var c of list){if(!c.custom)await a.package(c.id);for(var s of c.stages){var im=await a.load(s.png);if(im.width!==c.atlas.width||im.height!==c.atlas.height)throw Error("Atlas size mismatch "+c.id);result.push({id:c.id,path:s.png,width:im.width,height:im.height})}}return result})()');
  assert.equal(packages.length, initial.petCount * 3);
  const flow = [];
  if (interact) {
    assert.ok(initial.testMode, 'Refusing to touch formal user state');
    // Mutations are confined to the test instance and not persisted. Restore the
    // in-memory state before returning to the user, including failure paths.
    evaluate('p.savedState=JSON.stringify(p.game.state);p.originalSave=p.game.save;p.userIntervened=false;p.userTouch=function(e){var t=e.touches?.[0],q=p.expectedTouch;if(!t||!q||Date.now()>q.until||Math.abs(t.clientX-q.x)>1||Math.abs(t.clientY-q.y)>1||t.identifier===0)p.userIntervened=true;};g.wx.onTouchStart(p.userTouch);p.game.save=function(){return true};p.game.home();return true;');
    try {
      await tap('pets'); await waitFor('p.game.screen==="pets"'); screenshots.push(capture('native-pets')); flow.push('native touch: pet list');
      await tap('back'); await waitFor('p.game.screen==="home"');
      await tap('guide'); await waitFor('p.game.screen==="debug"');
      await tap('debug-level-5'); await tap('back'); await waitFor('p.game.screen==="home"&&p.view.ready');
      await tap('feed'); await waitFor('p.game.modal?.type==="upgrade"&&p.game.pet.level===6'); await sleep(1100);
      screenshots.push(capture('native-evolution6')); flow.push('native touch: feeding and Lv.6 evolution');
      evaluate('p.game.confirm();return true;');
      await tap('guide'); await waitFor('p.game.screen==="debug"');
      await tap('debug-level-10'); await tap('back'); await waitFor('p.game.screen==="home"&&p.view.ready');
      await tap('feed'); await waitFor('p.game.modal?.type==="upgrade"&&p.game.pet.level===11'); await sleep(1100);
      screenshots.push(capture('native-evolution11')); flow.push('native touch: feeding and Lv.11 evolution');
    } finally {
      const untouched = evaluate('var untouched=!p.userIntervened;if(untouched){p.game.state=JSON.parse(p.savedState);p.game.busy=null;p.game.modal=null;p.game.screen="home";p.game.play("idle");}p.game.save=p.originalSave;g.wx.offTouchStart?.(p.userTouch);delete p.savedState;delete p.originalSave;delete p.userTouch;return untouched;');
      assert.ok(untouched, 'User input detected: automation stopped; save restored, current user state kept');
    }
  }
  const report = { status: interact ? 'passed' : 'read-only-passed', interaction: interact ? 'passed' : 'not-run', platform: 'WeChat DevTools simulator (not physical device)', initial, atlasChecks: packages.length, packages, flow, screenshots, state: interact ? 'test progress restored only without user input; no storage reset or upload' : 'read-only run; no UI actions, storage reset or upload' };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, ...initial, atlasChecks: packages.length, flow, out }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
