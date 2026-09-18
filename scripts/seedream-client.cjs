'use strict';
// Server/local-worker only. Never bundle this file or its environment into WeChat.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}
function settings(file = path.resolve(__dirname, '../.env.local')) {
  const env = {};
  if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return { ...env, ...process.env };
}
function dataImage(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length > 20 * 1024 * 1024) throw Error('Reference exceeds 20 MB: ' + path.basename(file));
  const mime = bytes[0] === 137 && bytes[1] === 80 ? 'png' : bytes[0] === 255 && bytes[1] === 216 ? 'jpeg' : null;
  if (!mime) throw Error('Reference must be a PNG or JPEG');
  return `data:image/${mime};base64,${bytes.toString('base64')}`;
}
async function generate({ directory, prompt, references, size = '2048x2048', model = 'doubao-seedream-5-0-pro-260628', maxImages = 1, submit = false }) {
  const env = settings();
  const pro = model.startsWith('doubao-seedream-5-0-pro-');
  if (pro && maxImages !== 1) throw Error('Seedream 5.0 Pro supports one output per request');
  const body = { model, prompt, image: references.map(dataImage), size, response_format: 'url', output_format: 'png',
    ...(!pro ? { sequential_image_generation: maxImages === 1 ? 'disabled' : 'auto' } : {}), stream: false, watermark: false };
  if (!pro && maxImages > 1) body.sequential_image_generation_options = { max_images: maxImages };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const statusFile = path.join(directory, 'status.json'), responseFile = path.join(directory, 'response.json');
  const old = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile)) : null;
  if (old && old.fingerprint !== fingerprint) throw Error('Inputs changed: use a new attempt folder');
  let result;
  if (fs.existsSync(responseFile)) result = JSON.parse(fs.readFileSync(responseFile));
  else {
    if (old) throw Error('Previous request has no recorded response; inspect its live process/provider record before creating a new attempt');
    if (!submit) return { pending: true, fingerprint, model, referenceCount: references.length, maxImages };
    if (!env.ARK_API_KEY) throw Error('Configure ARK_API_KEY in .env.local on the worker');
    fs.mkdirSync(directory,{recursive:true});
    try { fs.writeFileSync(path.join(directory,'request.lock'),JSON.stringify({fingerprint,pid:process.pid}),{flag:'wx',mode:0o600}); }
    catch(e) { if(e.code==='EEXIST') throw Error('Previous request owns this attempt; inspect before resubmitting'); throw e; }
    atomic(statusFile, { fingerprint, state: 'inflight', pid: process.pid, startedAt: new Date().toISOString(), model });
    fs.writeFileSync(path.join(directory, 'prompt.txt'), prompt);
    atomic(path.join(directory, 'request-meta.json'), { model, size, maxImages, fingerprint, references: references.map((p, i) => ({ index: i + 1, sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') })) });
    for (let i = 0; i < references.length; i++) fs.copyFileSync(references[i], path.join(directory, `reference-${i + 1}` + path.extname(references[i])));
    // No automatic POST retry: a network timeout may already be billed.
    console.log('Seedream request started: ' + path.basename(directory));
    try {
      const r = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.ARK_API_KEY },
        body: JSON.stringify(body), signal: AbortSignal.timeout(900000)
      });
      result = await r.json(); atomic(responseFile, result);
      if (!r.ok || result.error) throw Error(`Seedream HTTP ${r.status}: ${result.error?.code || 'request failed'}`);
      atomic(statusFile, { fingerprint, state: 'received', receivedAt: new Date().toISOString(), count: result.data?.length, usage: result.usage });
    } catch (e) {
      atomic(statusFile, { fingerprint, state: 'attention', message: String(e.message).replaceAll(env.ARK_API_KEY, '[redacted]') });
      throw Error(String(e.message).replaceAll(env.ARK_API_KEY, '[redacted]'));
    }
  }
  if (result.error || !Array.isArray(result.data) || result.data.length !== maxImages || result.data.some(x => x.error)) throw Error('Generation returned incomplete or failed assets; inspect response metadata');
  const outputs = [];
  for (let i = 0; i < result.data.length; i++) {
    const file = path.join(directory, `image-${i + 1}.png`);
    if (!fs.existsSync(file)) {
      const item = result.data[i]; let bytes;
      if (item.b64_json) bytes = Buffer.from(item.b64_json, 'base64');
      else {
        const url = new URL(item.url);
        if (url.protocol !== 'https:' || url.username || url.password) throw Error('Unexpected image URL');
        const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
        if (!r.ok) throw Error('Image download failed; resume download without resubmitting generation');
        bytes = Buffer.from(await r.arrayBuffer());
      }
      if (bytes.length > 80 * 1024 * 1024) throw Error('Image exceeds download limit');
      fs.writeFileSync(file + '.tmp', bytes); fs.renameSync(file + '.tmp', file);
    }
    outputs.push(file);
  }
  atomic(statusFile, { fingerprint, state: 'downloaded', count: outputs.length, usage: result.usage });
  console.log('Seedream output saved: ' + path.basename(directory));
  return { outputs, fingerprint, usage: result.usage };
}
module.exports = { generate, atomic, settings, dataImage };
