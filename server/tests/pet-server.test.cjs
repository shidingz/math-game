'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { createPetServer } = require('../service.cjs');
const { createPipelineWorker } = require('../pipeline-worker.cjs');
const origin = 'https://example.github.io';
const defaults = { env: {}, accessCode: 'fixture-access-password', publicBaseUrl: 'https://pet.example.test', allowedOrigins: [origin], pollMs: 20 };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pet-service-'));
const image = color => sharp({ create: { width: 32, height: 32, channels: 4, background: color || '#885522' } }).png().toBuffer();
async function start(config = {}) {
  const service = createPetServer({ ...defaults, dataDir: tmp(), worker: async () => ({ status: 'pending' }), ...config });
  const address = await service.listen(0); const base = 'http://127.0.0.1:' + address.port;
  async function call(route, data, token, extra = {}) {
    const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extra.headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }), ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'headers')) });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function login(token, deviceId = 'same-device') { const r = await call('/session', { code: defaults.accessCode, deviceId }, token); assert.equal(r.status, 200); return r.data.token; }
  async function upload(token, requestId, index = 0, bytes) {
    const form = new FormData(); form.append('file', new Blob([bytes || await image()], { type: 'image/png' }), '../../source.png'); form.append('requestId', requestId); form.append('index', String(index));
    const r = await fetch(base + '/pet-photos', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ' + token }, body: form });
    return { status: r.status, data: await r.json() };
  }
  return { service, call, login, upload, base };
}
async function waitFor(fn) { for (let i = 0; i < 200; i++) { const result = await fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('Wait timeout'); }
async function candidate(directory, id) {
  const dir = path.join(directory, 'candidate'); fs.mkdirSync(dir, { recursive: true });
  const atlas = await sharp({ create: { width: 1152, height: 1152, channels: 4, background: '#00000000' } }).png().toBuffer();
  for (let n = 1; n <= 3; n++) fs.writeFileSync(path.join(dir, `stage-${n}.png`), atlas);
  fs.writeFileSync(path.join(dir, 'portrait.png'), await image());
  fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify({ schemaVersion: 1, id, name: '新伙伴', revision: 'fixture-r1', cellSize: 384, layout: 'template-v1', stages: [1, 2, 3].map(n => ({ image: `stage-${n}.png` })), portrait: 'portrait.png' }));
  fs.writeFileSync(path.join(dir, 'quality.json'), JSON.stringify({ status: 'technical-checks-passed', aiReviewCalls: 0, conversion: { aiCalls: 0 } }));
  return dir;
}

test('explicit secure configuration, read-only health, exact CORS and authentication', async () => {
  assert.throws(() => createPetServer({ ...defaults, accessCode: '', dataDir: tmp() }), /ACCESS_CODE/);
  assert.throws(() => createPetServer({ ...defaults, allowedOrigins: ['*'], dataDir: tmp() }), /origin/i);
  assert.throws(() => createPetServer({ ...defaults, publicBaseUrl: 'http://localhost', dataDir: tmp() }), /HTTPS/);
  const app = await start();
  try {
    const health = await app.call('/health'); assert.deepEqual(health.data, { ok: true, service: 'pet-generation', version: 1 }); assert.equal(health.headers.get('access-control-allow-origin'), origin);
    assert.equal((await app.call('/health', undefined, null, { headers: { Origin: 'https://evil.test' } })).status, 403);
    assert.equal((await app.call('/pet-jobs')).status, 401);
    assert.equal((await app.call('/session', { code: 'wrong' })).status, 401);
    const token = await app.login(); assert.equal(await app.login(token), token);
    const another = await app.login(); assert.notEqual(another, token); // deviceId cannot claim the first owner.
    const preflight = await fetch(app.base + '/pet-jobs', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } }); assert.equal(preflight.status, 204);
    assert.equal((await app.call('/pet-jobs', undefined, token)).status, 200);
  } finally { await app.service.close(); }
});

test('genuine image decoding, size/field limits, owner isolation and concurrent upload idempotency', async () => {
  const app = await start();
  try {
    const one = await app.login(), two = await app.login();
    const bytes = await image();
    const [first, same] = await Promise.all([app.upload(one, 'request-a', 0, bytes), app.upload(one, 'request-a', 0, bytes)]);
    assert.equal(first.data.photoId, same.data.photoId); assert.ok([200, 201].includes(first.status));
    assert.equal((await app.upload(one, 'request-a', 0, await image('#2222ff'))).status, 409);
    assert.equal((await app.upload(one, 'request-a', 3)).status, 400);
    assert.equal((await app.upload(one, 'bad-image', 0, Buffer.from('not a PNG'))).status, 415);
    assert.equal((await app.upload(one, 'huge-file', 0, Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: '#ffffff' } }).png().toBuffer();
    assert.equal((await app.upload(one, 'huge-pixels', 0, huge)).status, 415);
    const stolen = await app.call('/pet-jobs', { requestId: 'request-a', photoIds: [first.data.photoId] }, two); assert.equal(stolen.status, 403);
    assert.equal((await app.call('/pet-jobs', { requestId: 'different', photoIds: [first.data.photoId] }, one)).status, 403);
    assert.equal((await app.call('/pet-jobs', { requestId: 7, photoIds: [first.data.photoId] }, one)).status, 400);
    assert.equal((await app.call('/photos/' + first.data.photoId + '.png', undefined, one)).status, 404);
  } finally { await app.service.close(); }
});

test('POST only queues; one async worker; idempotent paid job; ready pack and unguessable image capability', async () => {
  let release, calls = 0, active = 0, maximum = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const app = await start({ maxDailyOwnerJobs: 5, worker: async ({ job, directory }) => { calls++; active++; maximum = Math.max(maximum, active); await gate; const candidateDir = await candidate(directory, job.petId); active--; return { status: 'ready', candidateDir }; } });
  try {
    const token = await app.login(), other = await app.login();
    const photo = (await app.upload(token, 'first')).data.photoId;
    const request = { requestId: 'first', photoIds: [photo] };
    const [first, duplicate] = await Promise.all([app.call('/pet-jobs', request, token), app.call('/pet-jobs', request, token)]);
    assert.ok([200, 202].includes(first.status)); assert.ok([200, 202].includes(duplicate.status));
    const secondPhoto = (await app.upload(token, 'second')).data.photoId;
    assert.equal((await app.call('/pet-jobs', { requestId: 'second', photoIds: [secondPhoto] }, token)).status, 202);
    await waitFor(() => calls === 1); assert.equal((await app.call('/health')).status, 200); // worker does not block HTTP.
    release();
    const ready = await waitFor(async () => { const jobs = (await app.call('/pet-jobs', undefined, token)).data.jobs; return jobs.length === 2 && jobs.every(j => j.status === 'ready') && jobs; });
    assert.equal(calls, 2); assert.equal(maximum, 1); assert.notEqual(ready[0].pet.id, ready[1].pet.id);
    assert.equal(ready[0].pet.name, '新伙伴'); assert.equal(ready[0].semanticReview, 'not-performed');
    assert.match(ready[0].pet.stages[0].image, /^https:\/\/pet\.example\.test\/assets\/[a-zA-Z0-9_-]{43}\/stage-1\.png$/);
    assert.equal((await app.call('/pet-jobs', undefined, other)).data.jobs.length, 0);
    const assetPath = new URL(ready[0].pet.stages[0].image).pathname;
    const asset = await fetch(app.base + assetPath, { headers: { Origin: origin } }); assert.equal(asset.status, 200); assert.equal(asset.headers.get('content-type'), 'image/png'); assert.ok((await asset.arrayBuffer()).byteLength > 0);
    assert.equal((await fetch(app.base + assetPath.replace(/\/assets\/[^/]+\//, '/assets/' + 'x'.repeat(43) + '/'))).status, 404);
    assert.equal((await fetch(app.base + assetPath.replace('stage-1.png', 'identity.png'))).status, 404);
    assert.equal((await app.call('/pet-jobs', request, token)).status, 200); assert.equal(calls, 2);
  } finally { release(); await app.service.close(); }
});

test('restart restores sessions, ownership, same job directory and provider-task marker; exclusive data lock', async () => {
  const dataDir = tmp(); let firstDir, firstId, firstStarted = false;
  let app = await start({ dataDir, worker: async ({ directory, job }) => { firstDir = directory; firstId = job.petId; fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'provider-task'), 'task-once'); firstStarted = true; return { status: 'pending' }; } });
  const token = await app.login(); const photoId = (await app.upload(token, 'resume')).data.photoId;
  await app.call('/pet-jobs', { requestId: 'resume', photoIds: [photoId] }, token);
  await waitFor(() => firstStarted);
  assert.throws(() => createPetServer({ ...defaults, dataDir }), /Another service/);
  await app.service.close();
  let resumed = 0;
  app = await start({ dataDir, worker: async ({ directory, job }) => { resumed++; assert.equal(directory, firstDir); assert.equal(job.petId, firstId); assert.equal(fs.readFileSync(path.join(directory, 'provider-task'), 'utf8'), 'task-once'); return { status: 'ready', candidateDir: await candidate(directory, job.petId) }; } });
  try {
    assert.equal(await app.login(token), token);
    await waitFor(async () => (await app.call('/pet-jobs', undefined, token)).data.jobs[0]?.status === 'ready');
    assert.equal(resumed, 1);
    assert.equal((await app.call('/pet-jobs', { requestId: 'resume', photoIds: [photoId] }, token)).status, 200);
    assert.equal((await app.call('/pet-jobs', undefined, await app.login())).data.jobs.length, 0);
    const raw = fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8'); assert.ok(!raw.includes(token)); assert.ok(!raw.includes(defaults.accessCode));
  } finally { await app.service.close(); }
});

test('durable daily limit and different-photo conflict do not create extra work', async () => {
  const dataDir = tmp(); let app = await start({ dataDir, maxDailyJobs: 1 });
  const token = await app.login(); const a = (await app.upload(token, 'quota')).data.photoId, b = (await app.upload(token, 'quota', 1)).data.photoId;
  try {
    assert.equal((await app.call('/pet-jobs', { requestId: 'quota', photoIds: [a] }, token)).status, 202);
    assert.equal((await app.call('/pet-jobs', { requestId: 'quota', photoIds: [a, b] }, token)).status, 409);
  } finally { await app.service.close(); }
  app = await start({ dataDir, maxDailyJobs: 1 });
  try {
    const c = (await app.upload(token, 'quota-next')).data.photoId;
    const result = await app.call('/pet-jobs', { requestId: 'quota-next', photoIds: [c] }, token);
    assert.equal(result.status, 429); assert.equal(result.data.error, 'daily_limit');
    assert.equal((await app.call('/pet-jobs', undefined, token)).data.jobs.length, 1);
  } finally { await app.service.close(); }
});

test('async pipeline adapter retries confirmed 429 once; unknown submission is never retried', async () => {
  const out = tmp(), script = path.join(out, 'fake.cjs');
  fs.writeFileSync(script, `const fs=require('node:fs'),p=require('node:path');const a=process.argv.slice(2),d=a[a.indexOf('--out')+1];fs.mkdirSync(p.join(d,'design'),{recursive:true});fs.writeFileSync(p.join(d,'design','status.json'),JSON.stringify({state:'failed',taskId:'confirmed-task',upstreamStatus:429}));process.exitCode=1;`);
  const worker = createPipelineWorker({ pipeline: script }); const directory = path.join(out, 'retry'); const context = { job: { petId: 'custom-fixture' }, photoPaths: ['/unused/photo.png'], directory, signal: new AbortController().signal };
  assert.equal((await worker(context)).status, 'pending'); assert.ok(fs.existsSync(path.join(directory, 'design-attempt-1/status.json')));
  const twice = await worker(context); assert.equal(twice.status, 'failed'); assert.equal(twice.errorCode, 'provider_failed');
  fs.writeFileSync(script, `const fs=require('node:fs'),p=require('node:path');const a=process.argv.slice(2),d=a[a.indexOf('--out')+1];fs.mkdirSync(p.join(d,'design'),{recursive:true});fs.writeFileSync(p.join(d,'design','status.json'),JSON.stringify({state:'needs-attention',startedAt:'2026-09-18',message:'unknown'}));process.exitCode=1;`);
  const unknown = await worker({ ...context, directory: path.join(out, 'uncertain') }); assert.equal(unknown.status, 'failed'); assert.equal(unknown.errorCode, 'submission_uncertain'); assert.ok(!fs.existsSync(path.join(out, 'uncertain/design-attempt-1')));
});

test('expired token is rejected for business calls but password renewal restores queued and half-uploaded ownership across restart', async () => {
  let clock = Date.now(); const dataDir = tmp();
  const settings = { dataDir, now: () => clock, pollMs: 300000, maxJobAgeMs: 365 * 86400000, maxPendingOwnerJobs: 3 };
  let app = await start(settings); const token = await app.login();
  const half = (await app.upload(token, 'half-upload', 0)).data.photoId;
  const queuedPhoto = (await app.upload(token, 'queued-before-expiry', 0)).data.photoId;
  await app.call('/pet-jobs', { requestId: 'queued-before-expiry', photoIds: [queuedPhoto] }, token);
  await app.service.close(); clock += 31 * 86400000;
  app = await start(settings);
  try {
    assert.equal((await app.call('/pet-jobs', undefined, token)).status, 401);
    assert.equal((await app.upload(token, 'half-upload', 1)).status, 401);
    assert.equal((await app.call('/session', { code: 'wrong' }, token)).status, 401);
    assert.equal((await app.call('/pet-jobs', undefined, token)).status, 401);
    const renewed = await app.login(token); assert.equal(renewed, token);
    const oldJobs = (await app.call('/pet-jobs', undefined, renewed)).data.jobs;
    assert.equal(oldJobs.length, 1); assert.equal(oldJobs[0].requestId, 'queued-before-expiry');
    const second = await app.upload(renewed, 'half-upload', 1); assert.equal(second.status, 201);
    const finishedUpload = await app.call('/pet-jobs', { requestId: 'half-upload', photoIds: [half, second.data.photoId] }, renewed);
    assert.equal(finishedUpload.status, 202);
    const stranger = (await app.call('/session', { code: defaults.accessCode }, 'z'.repeat(43))).data.token;
    assert.equal((await app.call('/pet-jobs', undefined, stranger)).data.jobs.length, 0);
  } finally { await app.service.close(); }
  app = await start(settings);
  try { assert.equal((await app.call('/pet-jobs', undefined, token)).data.jobs.length, 2); }
  finally { await app.service.close(); }
});
