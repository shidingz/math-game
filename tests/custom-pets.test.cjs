const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../game/core');
const { validatePack, character } = require('../wechat/runtime/custom-pets');
const { PetStudio, restoreLibrary } = require('../wechat/runtime/pet-studio');
const { PetService } = require('../wechat/runtime/pet-service');
const hosts = ['pets.example.com'];
test('测试模式自动加入多只本地伙伴，重开和新增不重置旧伙伴进度', () => {
  const { game } = setup(); game.testMode = true;
  const first = pack('custom-test-a'), second = pack('custom-test-b');
  new PetStudio({ api: {}, game, service: {}, localPacks: [first] });
  assert.equal(game.state.activePet, first.id);
  game.state.pets[first.id].growth = 25;
  new PetStudio({ api: {}, game, service: {}, localPacks: [first, second] });
  assert.equal(game.state.activePet, second.id);
  assert.equal(game.state.pets[first.id].growth, 25);
  assert.equal(game.state.pets[second.id].growth, 0);
  game.state.activePet = first.id;
  new PetStudio({ api: {}, game, service: {}, localPacks: [first, second] });
  assert.equal(game.state.activePet, first.id); assert.equal(game.state.pets[first.id].growth, 25);
});
test('bundled pets coexist, repeated import and reload preserve independent progress and starter', () => {
  const { game, saved } = setup();
  game.open = () => {};
  const localPacks = ['custom-local-one','custom-local-two'].map(id => pack(id));
  const studio = new PetStudio({ api: {}, game, service: { enabled: false }, localPacks });
  assert.equal(game.characters.length, 3);
  assert.equal(game.state.unlockedPets['custom-local-one'], true);
  assert.deepEqual(game.ids, ['custom-local-two','custom-local-one','wukong']);
  studio.addLocal();
  const starter = game.state.starterPet;
  Core.selectPet(game.state, 'custom-local-one', game.ids);
  Core.feed(game.state, 'custom-local-one', game.characters[1]);
  studio.addLocal();
  assert.equal(game.state.points, 980);
  assert.equal(game.state.starterPet, starter);
  assert.equal(game.state.pets['custom-local-one'].growth, 20);
  assert.equal(game.state.pets['custom-local-two'].growth, 0);
  assert.deepEqual(saved().customPetLibrary.packs, []);
  game.state = Core.restore(saved()); game.characters = game.characters.filter(c => !c.custom);
  new PetStudio({ api: {}, game, service: { enabled: false }, localPacks });
  assert.equal(game.state.activePet, 'custom-local-one');
  assert.equal(game.state.pets['custom-local-one'].growth, 20);
  studio.config.assetHosts = hosts;
  assert.throws(() => studio.apply([{ requestId: 'overwrite', status: 'ready', pet: localPacks[0] }]), /本地伙伴冲突/);
});
test('bundled grant rolls back when storage fails, and local paths remain forbidden remotely', () => {
  const { game } = setup();
  const localPacks = [pack('custom-local')];
  game.save = () => false;
  const studio = new PetStudio({ api: {}, game, service: { enabled: false }, localPacks });
  studio.addLocal();
  assert.equal(game.state.unlockedPets['custom-local'], undefined);
  assert.equal(game.state.pets['custom-local'], undefined);
  assert.throws(() => validatePack({ ...pack(), portrait: 'custom-assets/a/portrait.png' }, hosts));
});
test('ready pets are free at zero balance and newest first; repeated responses do not reorder or reset old pets', () => {
  const { game, studio } = setup(); game.state.points = 0;
  studio.apply([{requestId:'older',status:'ready',pet:pack('custom-older')}]);
  studio.apply([{requestId:'newer',status:'ready',pet:pack('custom-newer')}]);
  assert.deepEqual(game.ids,['custom-newer','custom-older','wukong']);
  assert.equal(game.characters[0].unlock.cost,0); assert.equal(game.state.points,0);
  assert.equal(Core.selectPet(game.state,'custom-newer',game.ids),true);
  game.state.pets['custom-newer'].growth=25;
  studio.apply([{requestId:'older',status:'ready',pet:pack('custom-older')}]);
  assert.deepEqual(game.ids,['custom-newer','custom-older','wukong']);
  assert.equal(game.state.pets['custom-newer'].growth,25); assert.equal(game.state.points,0); assert.equal(game.petPage,0);
});
const pack = (id = 'custom-one') => ({ schemaVersion: 1, id, name: '我的伙伴', revision: 'v1', cellSize: 512,
  stages: [1,2,3].map(i => ({ image: `https://pets.example.com/${id}/stage-${i}.png` })), food: { name: '点心', image: 'https://pets.example.com/food.png' } });
function setup(enabled = false) {
  let saved;
  const base = { id: 'wukong', ui: { palette: {} } };
  const state = Core.initialState(); Core.chooseStarter(state, 'wukong', ['wukong']); state.points = 1000;
  const game = { characters: [base], state, save() { saved = JSON.parse(JSON.stringify(this.state)); return true; }, tell(t) { this.notice = t; } };
  const service = { enabled };
  const studio = new PetStudio({ api: {}, game, service, config: { assetHosts: hosts } });
  return { game, service, studio, saved: () => saved };
}
test('data-only manifest validates identity, three stages, hosts and neutralizes model economy/code', () => {
  const raw = { ...pack(), food: { ...pack().food, cost: 0, growth: 10000 }, actions: { feed: 'evil' }, create: 'evil' };
  const safe = validatePack(raw, hosts), c = character(safe, { ui: { palette: {} } });
  assert.equal(c.actions.feed.durationMs, 500); assert.equal(c.food.cost, 20); assert.equal(c.food.growth, 20);
  assert.equal(c.frames.length, 9); assert.equal(c.frames[8].x, 1024); assert.equal(c.create, undefined);
  for (const id of ['wukong', '__proto__', 'custom-../../foo']) assert.throws(() => validatePack(pack(id), hosts));
  assert.throws(() => validatePack({ ...pack(), stages: pack().stages.slice(0,2) }, hosts));
  assert.throws(() => validatePack(pack(), ['other.example.com']));
  assert.throws(() => validatePack({ ...pack(), scene: 'https://pets.example.com.evil/a.png' }, hosts));
});
test('multiple completions grant distinct pets; refresh is idempotent and preserves growth/economy', () => {
  const { game, studio, saved } = setup();
  const rows = ['one','two'].map(s => ({ requestId: 'req-' + s, status: 'ready', pet: pack('custom-' + s) }));
  studio.apply(rows); assert.equal(game.characters.length, 3);
  assert.equal(Core.selectPet(game.state, 'custom-one', game.ids), true);
  Core.feed(game.state, 'custom-one', game.characters[1]);
  studio.apply(rows); assert.equal(game.state.points, 980); assert.equal(game.state.pets['custom-one'].growth, 20); assert.equal(game.state.pets['custom-two'].growth, 0);
  const restored = Core.restore(saved()); restored.customPetLibrary = restoreLibrary(saved().customPetLibrary, hosts);
  game.state = restored; game.characters = game.characters.filter(c => !c.custom);
  new PetStudio({ api: {}, game, service: { enabled: false }, config: { assetHosts: hosts } });
  assert.equal(game.state.activePet, 'custom-one'); assert.equal(game.characters.length, 3);
  assert.equal(game.state.pets['custom-one'].growth, 20);
  studio.apply([{ requestId: 'req-one', status: 'processing' }]); assert.equal(studio.jobs.find(j => j.requestId === 'req-one').status, 'ready');
});
test('invalid or duplicate task results cannot partially install or replace another pet', () => {
  const { studio, game } = setup();
  assert.throws(() => studio.apply([{ requestId:'a',status:'ready',pet:pack() },{requestId:'b',status:'ready',pet:pack('wukong')} ]));
  assert.equal(game.characters.length,1);
  studio.apply([{ requestId:'a',status:'ready',pet:pack() }]);
  assert.throws(() => studio.apply([{ requestId:'b',status:'ready',pet:pack() }]));
  assert.throws(() => studio.apply([{ requestId:'a',status:'ready',pet:pack('custom-two') }]));
});
test('missing service saves multiple drafts without making up a generated pet', async () => {
  const { studio, game, saved } = setup();
  studio.api.getFileSystemManager = () => ({ saveFile({ success, tempFilePath }) { success({ savedFilePath: 'saved-' + tempFilePath }); } });
  studio.selected=['photo1']; await studio.submit(); studio.selected=['photo2']; await studio.submit();
  assert.equal(studio.jobs.length, 2); assert.notEqual(studio.jobs[0].requestId, studio.jobs[1].requestId);
  assert.equal(saved().customPetLibrary.jobs[1].files[0], 'saved-photo1'); assert.equal(game.characters.length,1);
  assert.equal(studio.jobs[0].status,'draft');
});
test('interrupted upload and uncertain create reuse request id and uploaded photo IDs', async () => {
  const { studio, service } = setup(true); const calls=[];
  let failed=false;
  service.upload=async (_, id, index)=>{calls.push(['upload',id,index]); if(index===1&&!failed){failed=true;throw Error('offline');}return 'photo'+index;};
  let uncertain=true;
  service.create=async j=>{calls.push(['create',j.requestId]);if(uncertain){uncertain=false;throw Error('timeout');}return {requestId:j.requestId,status:'queued'};};
  const job={requestId:'req-fixed',status:'draft',files:['a','b'],photoIds:[],createdAt:0};studio.jobs.push(job);
  await studio.retry(job); assert.equal(job.photoIds.length,1);
  await studio.retry(job); assert.equal(job.status,'submitting');
  await studio.retry(job); assert.equal(job.status,'queued');
  assert.equal(calls.filter(x=>x[0]==='upload'&&x[2]===0).length,1);
  assert.deepEqual(calls.filter(x=>x[0]==='create').map(x=>x[1]),['req-fixed','req-fixed']);
});
test('photo cancellation preserves selected input and never creates a task', async () => {
  const { studio }=setup(); studio.selected=['old'];
  studio.api.chooseImage=({fail})=>fail({errMsg:'chooseImage:fail cancel'}); await studio.choose('camera');
  assert.deepEqual(studio.selected,['old']);assert.equal(studio.jobs.length,0);assert.equal(studio.working,false);
});
test('service exchanges wx code on backend and sends authenticated idempotent request', async () => {
  const calls=[];const api={login:({success})=>success({code:'wx-code'}),request:o=>{calls.push(o);o.success({statusCode:200,data:o.url.endsWith('/session')?{token:'session-token'}:{requestId:'req-x',status:'queued'}});}};
  const s=new PetService(api,{baseUrl:'https://api.example.com',assetHosts:hosts});
  await s.create({requestId:'req-x',photoIds:['photo1']});
  assert.deepEqual(calls[0].data,{code:'wx-code'});assert.equal(calls[1].header.Authorization,'Bearer session-token');
  assert.equal(calls[1].data.requestId,'req-x');
});
test('submitted photos are released after saving acknowledgment; drafts can be removed', () => {
  const { studio, game }=setup();const removed=[];
  studio.api.getFileSystemManager=()=>({removeSavedFile({filePath}){removed.push(filePath);}});
  const draft={requestId:'req-draft',status:'draft',files:['local1'],photoIds:[]};studio.jobs.push(draft);
  studio.removeDraft(draft);assert.deepEqual(removed,['local1']);assert.equal(studio.jobs.length,0);
  const job={requestId:'req-ack',status:'submitting',files:['local2'],photoIds:['p1']};studio.jobs.push(job);
  studio.apply([{requestId:'req-ack',status:'queued'}]);assert.deepEqual(removed,['local1','local2']);assert.deepEqual(job.files,[]);
  job.files=['local3'];game.save=()=>false;studio.releaseSubmittedPhotos();assert.deepEqual(job.files,['local3']);assert.equal(removed.length,2);
});
test('per-frame bounds reject invalid coordinates and flow into shared rendering', () => {
  const p=pack(); p.stages[0].bounds=Array.from({length:9},()=>({x:5,y:9,width:200,height:400}));
  const c=character(validatePack(p,hosts),{ui:{palette:{}}});assert.equal(c.stages[0].bounds[0].height,400);
  p.stages[0].bounds[0].width=900;assert.throws(()=>validatePack(p,hosts));
});
test('missing task IDs are rejected rather than coerced to strings',()=>{
 const {studio}=setup();assert.throws(()=>studio.apply([{status:'ready',pet:pack()}]));
 assert.throws(()=>restoreLibrary({version:1,packs:[],jobs:[{status:'draft',files:[],photoIds:[]}]},hosts));
});
