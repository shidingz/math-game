'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createPipelineWorker } = require('./pipeline-worker.cjs');
const { validatePack } = require('../wechat/runtime/custom-pets');
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const PHOTO_BYTES = 10 * 1024 * 1024;
const random = n => crypto.randomBytes(n).toString('base64url');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
class ServiceError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ServiceError(status, code, message); };
function atomic(file, value) {
  const tmp = file + '.' + random(8) + '.tmp';
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
function integer(value, fallback, min, max) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw Error('Invalid server numeric setting');
  return number;
}
function configFromEnv(env = process.env) {
  return {
    accessCode: env.PET_SERVICE_ACCESS_CODE,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    allowedOrigins: (env.PET_SERVICE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    dataDir: env.PET_SERVICE_DATA_DIR || path.resolve(__dirname, '../artifacts/pet-service'),
    pollMs: integer(env.PET_SERVICE_POLL_MS, 45000, 10, 300000),
    maxDailyJobs: integer(env.PET_SERVICE_MAX_DAILY_JOBS, 10, 1, 1000),
    maxDailyOwnerJobs: integer(env.PET_SERVICE_MAX_DAILY_OWNER_JOBS, 3, 1, 100),
    maxPendingJobs: integer(env.PET_SERVICE_MAX_PENDING_JOBS, 10, 1, 100),
    maxPendingOwnerJobs: integer(env.PET_SERVICE_MAX_PENDING_OWNER_JOBS, 2, 1, 20),
    sessionDays: integer(env.PET_SERVICE_SESSION_DAYS, 30, 1, 365),
    maxJobAgeMs: integer(env.PET_SERVICE_MAX_JOB_AGE_MS, 86400000, 1000, 604800000),
    maxPhotosPerOwner: integer(env.PET_SERVICE_MAX_PHOTOS_PER_OWNER, 60, 3, 1000),
    maxPhotos: integer(env.PET_SERVICE_MAX_PHOTOS, 300, 3, 10000),
  };
}
async function body(req, limit) {
  if (Number(req.headers['content-length'] || 0) > limit) { req.resume(); fail(413, 'body_too_large', '上传内容超过大小限制'); }
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > limit) fail(413, 'body_too_large', '上传内容超过大小限制'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function json(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'json_required', '需要 JSON 请求');
  try { const result = JSON.parse((await body(req, 16384)).toString('utf8')); if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error(); return result; }
  catch (e) { if (e instanceof ServiceError) throw e; fail(400, 'invalid_json', 'JSON 格式无效'); }
}
function multipart(buffer, contentType) {
  const match = /^multipart\/form-data\s*;\s*boundary=(?:"([^"\r\n]+)"|([^;\s\r\n]+))\s*$/i.exec(contentType || '');
  const boundary = match && (match[1] || match[2]);
  if (!boundary || boundary.length > 120) fail(400, 'invalid_multipart', '上传表单格式无效');
  const delimiter = Buffer.from('--' + boundary), separator = Buffer.from('\r\n--' + boundary);
  if (!buffer.subarray(0, delimiter.length).equals(delimiter)) fail(400, 'invalid_multipart', '上传表单格式无效');
  let offset = delimiter.length; const result = Object.create(null);
  for (let count = 0; count < 4; count++) {
    if (buffer.subarray(offset, offset + 2).toString() === '--') {
      if (!/^\r?\n?$/.test(buffer.subarray(offset + 2).toString())) fail(400, 'invalid_multipart', '上传表单结尾无效');
      return result;
    }
    if (buffer.subarray(offset, offset + 2).toString() !== '\r\n') fail(400, 'invalid_multipart', '上传表单格式无效');
    const end = buffer.indexOf('\r\n\r\n', offset + 2);
    if (end < 0 || end - offset > 8192) fail(400, 'invalid_multipart', '上传表单头无效');
    const headers = buffer.subarray(offset + 2, end).toString('utf8');
    const disposition = /^content-disposition:\s*form-data;[^\r\n]*\bname="([^"\r\n]+)"[^\r\n]*$/im.exec(headers);
    const name = disposition?.[1];
    if (!['file', 'requestId', 'index'].includes(name) || Object.hasOwn(result, name)) fail(400, 'invalid_multipart', '上传字段无效或重复');
    const next = buffer.indexOf(separator, end + 4);
    if (next < 0) fail(400, 'invalid_multipart', '上传内容不完整');
    result[name] = buffer.subarray(end + 4, next);
    offset = next + 2 + delimiter.length;
  }
  fail(400, 'invalid_multipart', '上传字段过多');
}
function createPetServer(options = {}) {
  const config = { ...configFromEnv(options.env || process.env), ...options };
  if (typeof config.accessCode !== 'string' || config.accessCode.length < 8 || config.accessCode.length > 1024) throw Error('PET_SERVICE_ACCESS_CODE must be explicitly configured with at least 8 characters');
  let publicUrl;
  try { publicUrl = new URL(config.publicBaseUrl); } catch { throw Error('PUBLIC_BASE_URL must be an HTTPS URL'); }
  if (publicUrl.protocol !== 'https:' || publicUrl.port || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/') throw Error('PUBLIC_BASE_URL must be an HTTPS origin without credentials, port, or path');
  const base = publicUrl.href.replace(/\/$/, '');
  if (!Array.isArray(config.allowedOrigins) || !config.allowedOrigins.length) throw Error('PET_SERVICE_ALLOWED_ORIGINS must explicitly allow at least one origin');
  const origins = new Set(config.allowedOrigins.map(origin => {
    let url; try { url = new URL(origin); } catch { throw Error('Invalid allowed origin'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || origin.includes('*')) throw Error('Origins must be exact HTTP(S) origins, without paths or wildcards');
    return origin;
  }));
  const sharp = options.sharp || require('sharp');
  const dataDir = path.resolve(config.dataDir);
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dataDir, 0o700);
  const lockFile = path.join(dataDir, 'server.lock');
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, 'utf8'));
    let alive = true; try { process.kill(pid, 0); } catch (e) { alive = e.code !== 'ESRCH'; }
    if (alive || !Number.isInteger(pid) || pid <= 0) throw Error('Another service may own this data directory; inspect server.lock');
    fs.unlinkSync(lockFile);
  }
  fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx', mode: 0o600 });
  const stateFile = path.join(dataDir, 'state.json');
  let state;
  try {
    state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { version: 1, sessions: {}, owners: {}, photos: {}, jobs: {} };
    if (state.version !== 1 || !['sessions', 'owners', 'photos', 'jobs'].every(k => state[k] && typeof state[k] === 'object' && !Array.isArray(state[k]))) throw Error('Unsupported or corrupt state file; refusing to reset data');
  } catch (e) { fs.unlinkSync(lockFile); throw e; }
  const persist = () => atomic(stateFile, state);
  if (!fs.existsSync(stateFile)) persist();
  const worker = options.worker || createPipelineWorker();
  const abortController = new AbortController();
  const limits = new Map();
  const now = options.now || Date.now;
  let closed = false, active = null, timer = null, wakeRequested = false, activeUploads = 0;
  function rate(key, maximum, windowMs = 60000) {
    const time = now(); let bucket = limits.get(key);
    if (!bucket || bucket.expires <= time) { bucket = { count: 0, expires: time + windowMs }; limits.set(key, bucket); }
    if (++bucket.count > maximum) fail(429, 'rate_limited', '请求较多，请稍后重试');
    if (limits.size > 10000) for (const [k, b] of limits) if (b.expires <= time) limits.delete(k);
  }
  function tokenOf(req) { return /^Bearer ([a-zA-Z0-9_-]{32,128})$/.exec(req.headers.authorization || '')?.[1]; }
  function session(req, optional = false, allowExpired = false) {
    const token = tokenOf(req), found = token && state.sessions[hash(token)];
    if (!found || (!allowExpired && found.expiresAt <= now()) || !state.owners[found.owner]) {
      if (optional) return null;
      fail(401, 'unauthorized', '请重新输入生成访问口令');
    }
    return { ...found, token };
  }
  function findJob(owner, requestId) { return Object.values(state.jobs).find(j => j.owner === owner && j.requestId === requestId); }
  function packFor(job) {
    const raw = job.pack;
    if (!raw) throw Error('Missing pack');
    const asset = name => base + '/assets/' + job.assetToken + '/' + encodeURIComponent(name);
    return { ...raw, stages: raw.stages.map(s => ({ ...s, image: asset(s.image) })), portrait: raw.portrait ? asset(raw.portrait) : undefined };
  }
  function row(job) {
    const result = { requestId: job.requestId, status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt };
    if (job.status === 'ready') { result.pet = packFor(job); result.technicalValidation = 'passed'; result.semanticReview = 'not-performed'; }
    if (job.status === 'failed') { result.error = job.errorCode; result.message = job.message; }
    return result;
  }
  function schedule(delay = 0) {
    if (closed) return;
    if (active) { wakeRequested = true; return; }
    clearTimeout(timer);
    timer = setTimeout(() => { active = tick().catch(() => {}).finally(() => { active = null; if (!closed && (wakeRequested || Object.values(state.jobs).some(j => ['queued', 'processing'].includes(j.status)))) { wakeRequested = false; schedule(config.pollMs); } }); }, delay);
    timer.unref();
  }
  async function installCandidate(job, candidateDir) {
    const quality = JSON.parse(await fs.promises.readFile(path.join(candidateDir, 'quality.json'), 'utf8'));
    if (quality.status !== 'technical-checks-passed' || quality.aiReviewCalls !== 0 || quality.conversion?.aiCalls !== 0) throw Error('Candidate lacks deterministic technical validation');
    const raw = JSON.parse(await fs.promises.readFile(path.join(candidateDir, 'pet.json'), 'utf8'));
    if (raw.id !== job.petId || raw.name !== '新伙伴') throw Error('Candidate identity mismatch');
    const names = [...raw.stages.map(s => s.image), raw.portrait].filter(Boolean);
    if (names.some(name => typeof name !== 'string' || !/^[a-zA-Z0-9_-]+\.png$/.test(name)) || new Set(names).size !== names.length) throw Error('Invalid candidate asset names');
    const clean = { schemaVersion: raw.schemaVersion, id: raw.id, name: '新伙伴', revision: raw.revision, cellSize: raw.cellSize, layout: raw.layout, stages: raw.stages, portrait: raw.portrait, procedural: raw.procedural, color: raw.color };
    const testJob = { ...job, pack: clean, assetToken: job.assetToken || random(32) };
    validatePack(packFor(testJob), [publicUrl.hostname]);
    const destination = path.join(dataDir, 'assets', job.id);
    fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    for (const name of names) {
      const file = path.join(candidateDir, name), stat = await fs.promises.lstat(file);
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw Error('Invalid candidate file');
      const meta = await sharp(file, { limitInputPixels: 20000000 }).metadata();
      if (meta.format !== 'png' || !meta.hasAlpha || (raw.stages.some(s => s.image === name) && (meta.width !== raw.cellSize * 3 || meta.height !== raw.cellSize * 3))) throw Error('Invalid candidate atlas');
      await fs.promises.copyFile(file, path.join(destination, name));
      await fs.promises.chmod(path.join(destination, name), 0o600);
    }
    return { pack: clean, assetToken: testJob.assetToken, assetFiles: names };
  }
  async function tick() {
    const jobs = Object.values(state.jobs).filter(j => ['processing', 'queued'].includes(j.status)).sort((a, b) => (a.status === 'processing' ? 0 : 1) - (b.status === 'processing' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt));
    const job = jobs[0]; if (!job || closed) return;
    if (now() - Date.parse(job.createdAt) > config.maxJobAgeMs) { Object.assign(job, { status: 'failed', errorCode: 'generation_timeout', message: '生成等待时间过长，已暂停，请管理员检查原任务。', updatedAt: new Date(now()).toISOString() }); persist(); return; }
    job.status = 'processing'; job.updatedAt = new Date(now()).toISOString(); persist();
    try {
      const result = await worker({ job: { ...job }, photoPaths: job.photoIds.map(id => path.join(dataDir, 'photos', id + '.png')), directory: path.join(dataDir, 'jobs', job.id), signal: abortController.signal });
      if (closed) return;
      if (result.status === 'ready') Object.assign(job, await installCandidate(job, result.candidateDir), { status: 'ready', completedAt: new Date(now()).toISOString() });
      else if (result.status === 'failed') Object.assign(job, { status: 'failed', errorCode: /^[a-z_]{1,64}$/.test(result.errorCode || '') ? result.errorCode : 'generation_failed', message: '生成未完成，请管理员检查本机任务日志。' });
      else if (result.status !== 'pending') throw Error('Invalid worker response');
      job.updatedAt = new Date(now()).toISOString(); persist();
    } catch (error) {
      if (closed) return;
      Object.assign(job, { status: 'failed', errorCode: 'worker_failed', message: '生成流程已暂停，请管理员检查本机任务日志。', updatedAt: new Date(now()).toISOString() });
      fs.mkdirSync(path.join(dataDir, 'jobs', job.id), { recursive: true, mode: 0o700 });
      // Detailed exceptions stay on the administrator's machine.
      fs.writeFileSync(path.join(dataDir, 'jobs', job.id, 'server-error.log'), String(error.message).replace(/(?:sk-|ark-)[a-zA-Z0-9_-]+/g, '[redacted]'), { mode: 0o600 });
      persist();
    }
  }
  function send(res, status, value) { const bytes = Buffer.from(JSON.stringify(value)); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes); }
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    try {
      if (origin && !origins.has(origin)) fail(403, 'origin_not_allowed', '当前网页未配置访问权限');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' }); res.end(); return;
      }
      const url = new URL(req.url, 'http://localhost'), pathname = url.pathname;
      const ip = req.socket.remoteAddress || 'unknown'; rate('ip:' + ip, 240);
      if (req.method === 'GET' && pathname === '/health') { send(res, 200, { ok: true, service: 'pet-generation', version: 1 }); return; }
      if (req.method === 'POST' && pathname === '/session') {
        rate('login:' + ip, 12);
        const input = await json(req);
        if (typeof input.code !== 'string' || input.code.length > 1024 || !crypto.timingSafeEqual(Buffer.from(hash(input.code)), Buffer.from(hash(config.accessCode)))) fail(401, 'invalid_access_code', '生成访问口令不正确');
        // Expired tokens prove prior ownership only after the access password has
        // been verified above. They remain invalid for every business endpoint.
        const existing = session(req, true, true), token = existing?.token || random(32), owner = existing?.owner || random(18);
        if (!state.owners[owner]) state.owners[owner] = { createdAt: new Date(now()).toISOString() };
        state.sessions[hash(token)] = { owner, expiresAt: now() + config.sessionDays * 86400000 }; persist();
        send(res, 200, { token }); return;
      }
      if (req.method === 'GET' && pathname.startsWith('/assets/')) {
        const match = /^\/assets\/([a-zA-Z0-9_-]{43})\/([a-zA-Z0-9_-]+\.png)$/.exec(pathname);
        const job = match && Object.values(state.jobs).find(j => j.status === 'ready' && j.assetToken === match[1] && j.assetFiles.includes(match[2]));
        if (!job) fail(404, 'not_found', '素材不存在');
        const file = path.join(dataDir, 'assets', job.id, match[2]), stat = await fs.promises.stat(file);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': stat.size, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
        const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res); return;
      }
      const auth = session(req); rate('owner:' + auth.owner, 120);
      if (req.method === 'POST' && pathname === '/pet-photos') {
        rate('upload:' + auth.owner, 20);
        if (activeUploads >= 2) fail(429, 'upload_busy', '正在处理其他图片，请稍后重试');
        activeUploads++;
        try {
        const parts = multipart(await body(req, PHOTO_BYTES + 32768), req.headers['content-type']);
        const requestId = parts.requestId?.toString(), index = parts.index?.toString();
        if (!ID.test(requestId || '') || !/^[012]$/.test(index || '') || !parts.file?.length) fail(400, 'invalid_photo', '照片请求信息无效');
        if (parts.file.length > PHOTO_BYTES) fail(413, 'photo_too_large', '每张图片不能超过 10 MiB');
        const digest = hash(parts.file);
        const existing = Object.values(state.photos).find(p => p.owner === auth.owner && p.requestId === requestId && p.index === Number(index));
        if (existing) { if (existing.digest !== digest) fail(409, 'photo_conflict', '同一个上传位置已保存不同图片'); send(res, 200, { photoId: existing.id }); return; }
        if (findJob(auth.owner, requestId)) fail(409, 'job_exists', '任务已提交，不能更改原图片');
        if (Object.keys(state.photos).length >= config.maxPhotos || Object.values(state.photos).filter(p => p.owner === auth.owner).length >= config.maxPhotosPerOwner) fail(429, 'photo_quota', '照片存储配额已满，请联系管理员');
        let normalized;
        try {
          const image = sharp(parts.file, { limitInputPixels: 24000000, animated: false, failOn: 'error' });
          const meta = await image.metadata();
          if (!['jpeg', 'png', 'webp'].includes(meta.format) || !meta.width || !meta.height || (meta.pages || 1) > 1) throw Error('Invalid image');
          normalized = await image.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().png().toBuffer();
        } catch { fail(415, 'invalid_image', '请选择有效的 PNG、JPEG 或 WebP 静态图片（最多 2400 万像素）'); }
        // Recheck after asynchronous decoding to handle simultaneous retry uploads.
        const raced = Object.values(state.photos).find(p => p.owner === auth.owner && p.requestId === requestId && p.index === Number(index));
        if (raced) { if (raced.digest !== digest) fail(409, 'photo_conflict', '同一个上传位置已保存不同图片'); send(res, 200, { photoId: raced.id }); return; }
        if (findJob(auth.owner, requestId)) fail(409, 'job_exists', '任务已提交，不能更改原图片');
        if (Object.keys(state.photos).length >= config.maxPhotos || Object.values(state.photos).filter(p => p.owner === auth.owner).length >= config.maxPhotosPerOwner) fail(429, 'photo_quota', '照片存储配额已满，请联系管理员');
        const id = 'photo_' + random(18), dir = path.join(dataDir, 'photos'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        const file = path.join(dir, id + '.png'); fs.writeFileSync(file + '.tmp', normalized, { flag: 'wx', mode: 0o600 }); fs.renameSync(file + '.tmp', file);
        state.photos[id] = { id, owner: auth.owner, requestId, index: Number(index), digest, createdAt: new Date(now()).toISOString() }; persist();
        send(res, 201, { photoId: id }); return;
        } finally { activeUploads--; }
      }
      if (req.method === 'POST' && pathname === '/pet-jobs') {
        rate('queue:' + auth.owner, 10);
        const input = await json(req);
        if (typeof input.requestId !== 'string' || !ID.test(input.requestId) || !Array.isArray(input.photoIds) || input.photoIds.length < 1 || input.photoIds.length > 3 || input.photoIds.some(id => typeof id !== 'string' || !ID.test(id)) || new Set(input.photoIds).size !== input.photoIds.length) fail(400, 'invalid_job', '需要一至三张不同图片和有效请求编号');
        const existing = findJob(auth.owner, input.requestId);
        if (existing) { if (JSON.stringify(existing.photoIds) !== JSON.stringify(input.photoIds)) fail(409, 'job_conflict', '请求编号已用于其他图片'); send(res, 200, row(existing)); return; }
        if (input.photoIds.some((id, index) => { const p = state.photos[id]; return !p || p.owner !== auth.owner || p.requestId !== input.requestId || p.index !== index; })) fail(403, 'photo_not_owned', '图片不属于此会话或任务');
        const all = Object.values(state.jobs), today = new Date(now()).toISOString().slice(0, 10);
        if (all.filter(j => j.createdAt.startsWith(today)).length >= config.maxDailyJobs || all.filter(j => j.owner === auth.owner && j.createdAt.startsWith(today)).length >= config.maxDailyOwnerJobs) fail(429, 'daily_limit', '今日生成次数已用完');
        const pending = all.filter(j => ['queued', 'processing'].includes(j.status));
        if (pending.length >= config.maxPendingJobs || pending.filter(j => j.owner === auth.owner).length >= config.maxPendingOwnerJobs) fail(429, 'queue_full', '生成队列已满，请等待已有任务完成');
        const stamp = new Date(now()).toISOString(), id = 'job_' + random(18);
        const job = { id, owner: auth.owner, requestId: input.requestId, photoIds: input.photoIds, petId: 'custom-' + crypto.randomBytes(12).toString('hex'), status: 'queued', createdAt: stamp, updatedAt: stamp };
        state.jobs[id] = job; persist(); send(res, 202, row(job)); schedule(); return;
      }
      if (req.method === 'GET' && pathname === '/pet-jobs') {
        const jobs = Object.values(state.jobs).filter(j => j.owner === auth.owner).sort((a, b) => (a.completedAt || a.createdAt).localeCompare(b.completedAt || b.createdAt));
        send(res, 200, { jobs: jobs.map(row) }); return;
      }
      fail(404, 'not_found', '接口不存在');
    } catch (error) {
      if (!res.headersSent) { if (error.status === 429) res.setHeader('Retry-After', '60'); send(res, error.status || 500, { error: error.code || 'internal_error', message: error instanceof ServiceError ? error.message : '服务暂时不可用，请稍后重试' }); }
      else res.destroy();
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000; server.maxConnections = 64;
  server.on('clientError', (_err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  return {
    server,
    listen(port = 8799, host = '127.0.0.1') { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); schedule(); resolve(server.address()); }); }); },
    async close() {
      if (closed) return; closed = true; clearTimeout(timer); abortController.abort();
      if (server.listening) { const stopped = new Promise(resolve => server.close(resolve)); server.closeIdleConnections(); await stopped; }
      if (active) await active;
      fs.unlinkSync(lockFile);
    },
  };
}
module.exports = { createPetServer, configFromEnv, multipart };
