'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const STEPS = ['design', 'stage1', 'stage2', 'stage3'];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

// Each invocation resumes the exact same durable provider task. It never invents a
// new request after an uncertain POST. Only confirmed terminal failures retry once.
function createPipelineWorker(options = {}) {
  const pipeline = options.pipeline || path.resolve(__dirname, '../scripts/pet-alpha-pipeline.cjs');
  const timeoutMs = options.timeoutMs || 10 * 60 * 1000;
  return async function advance({ job, photoPaths, directory, signal }) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const args = [pipeline, '--out', directory, '--photos', photoPaths.join(','), '--id', job.petId, '--style', 'samoyed', '--submit'];
    const result = await new Promise((resolve, reject) => {
      const env = { ...process.env, NODE_PATH: [path.join(__dirname, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter) };
      const child = spawn(options.node || process.execPath, args, { cwd: path.resolve(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', timedOut = false, killTimer;
      const collect = data => { output = (output + data.toString()).slice(-65536); };
      child.stdout.on('data', collect); child.stderr.on('data', collect);
      const stop = () => { child.kill('SIGTERM'); if (!killTimer) { killTimer = setTimeout(() => child.kill('SIGKILL'), 5000); killTimer.unref(); } };
      const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs); timer.unref();
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) stop();
      child.once('error', reject);
      child.once('close', (code, exitSignal) => {
        clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', stop);
        // Logs remain private, and arbitrary provider messages are never API responses.
        fs.writeFileSync(path.join(directory, 'server-last-run.log'), output.replace(/(?:sk-|ark-)[a-zA-Z0-9_-]+/g, '[redacted]'), { mode: 0o600 });
        resolve({ code, exitSignal, timedOut, output });
      });
    });
    if (signal?.aborted) return { status: 'pending' };
    const progress = read(path.join(directory, 'pipeline-status.json'));
    if (result.code === 0 && progress?.state === 'ready-for-test') return { status: 'ready', candidateDir: path.join(directory, 'candidate') };
    if (/Frozen inputs or rules changed|Inputs changed; use a new attempt|Selected candidate changed/.test(result.output)) return { status: 'failed', errorCode: 'rules_changed', message: '原任务规则或素材已改变，已暂停，避免重复提交。' };
    const states = STEPS.map(step => ({ step, value: read(path.join(directory, step, 'status.json')) })).filter(s => s.value);
    if (states.some(s => s.value.state === 'needs-attention' || (s.value.startedAt && !s.value.taskId && !['prepared', 'downloaded'].includes(s.value.state)))) {
      return { status: 'failed', errorCode: 'submission_uncertain', message: '生成请求状态需要管理员核实，已暂停，未自动重复收费请求。' };
    }
    const failure = states.find(s => s.value.state === 'failed');
    if (failure) {
      const archived = path.join(directory, failure.step + '-attempt-1');
      if (RETRYABLE.has(Number(failure.value.upstreamStatus)) && !fs.existsSync(archived)) {
        fs.renameSync(path.join(directory, failure.step), archived);
        return { status: 'pending' };
      }
      return { status: 'failed', errorCode: 'provider_failed', message: '生图服务返回失败，任务已保留供管理员检查。' };
    }
    if (progress?.state === 'layout-rejected') return { status: 'failed', errorCode: 'image_format_rejected', message: '返回图片未通过固定格式检查，未交付不完整素材。' };
    if (result.code === 0 && progress?.state === 'pending') return { status: 'pending' };
    // A known task may safely be polled/downloaded again; this does not resubmit it.
    if (states.some(s => s.value.taskId && s.value.state === 'pending')) return { status: 'pending' };
    return { status: 'failed', errorCode: result.timedOut ? 'worker_timeout' : 'pipeline_failed', message: '生成流程已暂停，请管理员检查本机任务日志。' };
  };
}
module.exports = { createPipelineWorker };
