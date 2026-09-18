'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { Connection, normalizeBase, SESSIONS } = require('../wechat/browser/connection');
const { createBrowserStorage, moveScope } = require('../wechat/browser/storage');
const { PetService } = require('../wechat/runtime/pet-service');
function storage() { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)) }; }
function connection() {
  const localStorage = storage(), calls = [];
  const env = { localStorage, location: { hostname: 'game.example.com' }, fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ token: 'session-' + calls.length }) }; } };
  return { connection: new Connection({ baseUrl: 'https://one.example.com', assetHosts: ['cdn.example.com'] }, env), calls, env, localStorage };
}
test('browser service requires HTTPS; local HTTP is limited to explicit localhost debugging', () => {
  assert.equal(normalizeBase(' https://one.example.com/api/ '), 'https://one.example.com/api');
  for (const url of ['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://example.com/?key=x','https://example.com/#x','http://127.0.0.1:8080']) assert.throws(() => normalizeBase(url));
  assert.equal(normalizeBase('http://127.0.0.1:8080/', true), 'http://127.0.0.1:8080');
  assert.throws(() => normalizeBase('http://other.local:8080', true));
});
test('session persists across restarts, same-server renew keeps owner, switching URL never sends old bearer or stores passphrase', async () => {
  const { connection: c, calls, env, localStorage } = connection();
  await c.authenticate(c.baseUrl, 'private-test-passphrase');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  await c.authenticate(c.baseUrl, 'private-test-passphrase');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer session-1');
  await c.authenticate('https://two.example.com', 'other-passphrase');
  assert.equal(calls[2].options.headers.Authorization, undefined);
  assert.equal(new Connection({}, env).get(), 'session-3');
  assert.equal(c.get('https://one.example.com'), 'session-2');
  assert.equal([...localStorage.values.values()].some(v => v.includes('passphrase')), false);
  c.clear('https://two.example.com');
  assert.equal(JSON.parse(localStorage.getItem(SESSIONS))['https://two.example.com'], 'session-3');
  assert.equal(new Connection({}, env).get(), '');
  assert.equal(c.get('https://one.example.com'), 'session-2');
  await c.authenticate('https://two.example.com', 'renewal-passphrase');
  assert.equal(calls[3].options.headers.Authorization, 'Bearer session-3');
  assert.equal(new Connection({}, env).get(), 'session-4');
});
test('browser PetService uses persistent session rather than wx login and clears an expired token for reconnect', async () => {
  const { connection: c } = connection(); await c.authenticate(c.baseUrl, 'pass'); let status = 200, seen;
  const service = new PetService({ browserMode: true, petSession: c, login() { throw Error('wx login must not run'); }, request(o) { seen = o; o.success({ statusCode: status, data: { jobs: [] } }); } }, { baseUrl: c.baseUrl, assetHosts: c.hosts() });
  assert.equal(service.needsConnection, false); await service.list(); assert.equal(seen.header.Authorization, 'Bearer session-1');
  status = 401; await assert.rejects(service.list(), /重新连接/); assert.equal(service.needsConnection, true); assert.equal(c.get(), '');
});
test('a previously opened tab reads newly persisted credentials before renewing a session', async () => {
  const { connection: first, env, calls } = connection();
  const second = new Connection({ baseUrl: first.baseUrl }, env);
  await first.authenticate(first.baseUrl, 'passphrase');
  assert.equal(second.get(), 'session-1');
  await second.authenticate(second.baseUrl, 'passphrase');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer session-1');
  first.clear(); assert.equal(second.get(), '');
});
test('service scope retains old custom library, isolates new server and test mode, migrates builtin progress and offline drafts', () => {
  const local = storage(), key = 'math-pet-wechat:formal:v1';
  const state = { version: 4, points: 713, totalSolved: 55, starterChosen: true, activePet: 'custom-future', unlockedPets: { wukong: true, 'custom-future': true }, pets: { wukong: { level: 7, growth: 32 }, 'custom-future': { level: 9 } }, customPetNames: { 'custom-future': '奶糖' }, customPetLibrary: { version: 1, packs: [{ id: 'custom-future' }], jobs: [{ requestId: 'r1', status: 'ready', petId: 'custom-future' }] } };
  const a = createBrowserStorage(local, 'https://one.example.com'); a.setStorageSync(key, JSON.stringify(state));
  const b = createBrowserStorage(local, 'https://two.example.com'); const migrated = JSON.parse(b.getStorageSync(key));
  assert.equal(migrated.points, 713); assert.equal(migrated.totalSolved, 55); assert.deepEqual(migrated.pets.wukong, state.pets.wukong);
  assert.equal(migrated.activePet, 'wukong'); assert.deepEqual(migrated.customPetLibrary.packs, []);
  assert.deepEqual(JSON.parse(a.getStorageSync(key)), state); assert.equal(b.getStorageSync('math-pet-wechat:test:v1'), '');
  const draft = { ...state, customPetLibrary: { version: 1, packs: [], jobs: [{ requestId: 'draft', status: 'draft', photoIds: [], files: ['idb-photo:abc'] }] } };
  assert.equal(JSON.parse(moveScope(draft, [], true)).customPetLibrary.jobs.length, 1);
  assert.equal(JSON.parse(moveScope(draft, [], false)).customPetLibrary.jobs.length, 0);
  assert.equal(state.pets['custom-future'].level, 9);
});
test('migration retires exactly five historical IDs, keeping future custom pets, names, jobs and economy intact', () => {
  const file = path.resolve(__dirname, '../wechat/runtime/platform.js'), module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + fs.readFileSync(file, 'utf8') + '\n})')(
    id => id.startsWith('../shared/') ? require('../game/' + id.slice(10)) : require('../wechat/runtime/' + id.slice(2)), module, module.exports);
  const { removeRetiredCustomPets, RETIRED_CUSTOM_IDS } = module.exports;
  const ids = [...RETIRED_CUSTOM_IDS, 'custom-future', 'wukong'];
  const state = { points: 137, totalSolved: 31, activePet: ids[0], starterPet: 'wukong', pets: Object.fromEntries(ids.map(id => [id,{level: 6}])), unlockedPets: Object.fromEntries(ids.map(id => [id,true])), customPetNames: { 'custom-future': '保留' }, customPetLibrary: { version: 1, packs: ids.map(id=>({ id })), jobs: ids.map(id=>({petId:id})) } };
  const clean = removeRetiredCustomPets(state);
  assert.equal(RETIRED_CUSTOM_IDS.length, 5); assert.equal(clean.points, 137); assert.equal(clean.totalSolved, 31); assert.equal(clean.activePet, 'wukong');
  assert.deepEqual(Object.keys(clean.pets), ['custom-future','wukong']); assert.equal(clean.customPetNames['custom-future'], '保留'); assert.equal(clean.customPetLibrary.jobs.length, 2);
  assert.equal(Object.keys(state.pets).length, 7); assert.equal(state.customPetLibrary.packs.length, 7);
});
test('web builder publishes only public config, keeps test opt-in and excludes preview and project metadata', () => {
  const os = require('node:os'), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-web-build-'));
  const source = path.join(directory,'staging'), out = path.join(directory,'public');
  try {
    for (const folder of ['runtime','shared','data']) fs.mkdirSync(path.join(source,folder),{recursive:true});
    fs.writeFileSync(path.join(source,'runtime/main.js'),'module.exports=function(){};');
    fs.writeFileSync(path.join(source,'config.js'), "module.exports={assetVersion:'unit-v1',debug:true,testDefault:true,apiKey:'DO-NOT-PUBLISH-TEST-SECRET'};");
    fs.writeFileSync(path.join(source,'preview.js'),'DO-NOT-PUBLISH-PREVIEW');
    const { build } = require('../scripts/build-web-game.cjs');
    const manifest = build(['--from',source,'--out',out]);
    assert.equal(manifest.debug,false); assert.equal(manifest.testDefault,false); assert.equal(fs.existsSync(path.join(out,'preview.js')),false);
    const bundle = fs.readFileSync(path.join(out,'web-runtime.js'),'utf8'); assert.equal(bundle.includes('DO-NOT-PUBLISH-TEST-SECRET'),false);
    assert.match(fs.readFileSync(path.join(out,'index.html'),'utf8'), /src="web-runtime\.js\?v=[a-f0-9]+"/);
    const config = path.join(directory,'public-url.json'); fs.writeFileSync(config,JSON.stringify({baseUrl:'https://example.com',token:'private'}));
    assert.throws(()=>build(['--from',source,'--out',out,'--public-config',config]),/不得包含凭据/);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
