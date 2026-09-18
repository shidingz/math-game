'use strict';
const SETTINGS = 'math-pet-web:connection:v1', SESSIONS = 'math-pet-web:sessions:v1', EXPIRED = 'math-pet-web:expired-sessions:v1';
function normalizeBase(value, allowLocal = false) {
  if (!String(value || '').trim()) return '';
  let url; try { url = new URL(String(value).trim()); } catch (_) { throw Error('请输入有效的制作服务地址'); }
  const local = allowLocal && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash) throw Error('制作服务需要HTTPS地址');
  return url.href.replace(/\/+$/, '');
}
function read(storage, key, fallback) { try { return JSON.parse(storage.getItem(key)) || fallback; } catch (_) { return fallback; } }
class Connection {
  constructor(config, environment = window) {
    this.env = environment; this.storage = environment.localStorage; this.allowLocal = ['localhost','127.0.0.1'].includes(environment.location.hostname);
    this.defaults = config; this.settings = read(this.storage, SETTINGS, {});
    this.baseUrl = normalizeBase(this.settings.baseUrl ?? config.baseUrl ?? '', this.allowLocal);
    this.sessions = read(this.storage, SESSIONS, {}); this.expired = read(this.storage, EXPIRED, {}); this.pending = null; this.onChange = () => {};
    environment.addEventListener?.('storage', event => { if ([SESSIONS, EXPIRED].includes(event.key)) { this.syncSessions(); this.onChange(); } });
  }
  syncSessions() { this.sessions = read(this.storage, SESSIONS, {}); this.expired = read(this.storage, EXPIRED, {}); }
  get(base = this.baseUrl) { this.syncSessions(); return !this.expired[base] && typeof this.sessions[base] === 'string' ? this.sessions[base] : ''; }
  clear(base = this.baseUrl) {
    // Keep the credential only for same-server renewal after the user enters
    // the passphrase. Business requests must never reuse an expired session.
    this.syncSessions(); this.expired[base] = true; this.storage.setItem(EXPIRED, JSON.stringify(this.expired)); this.onChange();
  }
  hosts() {
    const hosts = this.baseUrl ? [new URL(this.baseUrl).hostname] : [];
    if (this.baseUrl === normalizeBase(this.defaults.baseUrl || '', this.allowLocal)) hosts.push(...(this.defaults.assetHosts || []));
    return [...new Set(hosts)];
  }
  async authenticate(base, code) {
    base = normalizeBase(base, this.allowLocal);
    if (!base || !code.trim()) throw Error('请填写服务地址和访问口令');
    // Serialize same-origin tabs where Web Locks are available. Re-read durable
    // credentials inside the lock so a second tab renews the existing owner.
    if (this.env.navigator?.locks) return this.env.navigator.locks.request('math-pet-session:' + base, () => this.authenticateUnlocked(base, code));
    return this.authenticateUnlocked(base, code);
  }
  async authenticateUnlocked(base, code) {
    this.syncSessions();
    const existing = typeof this.sessions[base] === 'string' ? this.sessions[base] : '', controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    let response, data;
    try {
      response = await this.env.fetch(base + '/session', { method: 'POST', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(existing ? { Authorization: 'Bearer ' + existing } : {}) }, body: JSON.stringify({ code: code.trim() }) });
      data = await response.json();
    } catch (error) { throw Error(error.name === 'AbortError' ? '连接超时，请确认本机服务已启动' : '无法连接服务，请检查地址、网络及跨域设置'); }
    finally { clearTimeout(timer); }
    if (response.status === 401 || response.status === 403) throw Error('访问口令不正确，请重试');
    if (!response.ok || typeof data?.token !== 'string' || !data.token || data.token.length > 4096) throw Error('服务登录响应无效');
    this.syncSessions(); this.sessions[base] = data.token; this.storage.setItem(SESSIONS, JSON.stringify(this.sessions));
    delete this.expired[base]; this.storage.setItem(EXPIRED, JSON.stringify(this.expired));
    this.storage.setItem(SETTINGS, JSON.stringify({ baseUrl: base }));
    return { baseUrl: base, token: data.token, changed: base !== this.baseUrl };
  }
  ensure(base) {
    const token = this.get(base); if (token) return Promise.resolve(token);
    return this.open().then(result => { if (result.baseUrl !== base) throw Error('服务已切换，请在重新打开后继续提交'); return result.token; });
  }
  open() {
    if (this.pending) return this.pending;
    this.pending = new Promise((resolve, reject) => {
      const dialog = document.createElement('dialog'); dialog.className = 'web-dialog';
      const form = document.createElement('form'), title = document.createElement('h2'); title.textContent = '连接制作服务';
      const intro = document.createElement('p'); intro.textContent = '连接后可以上传照片，制作完成的伙伴会自动加入游戏。';
      const addressLabel = document.createElement('label'); addressLabel.textContent = '服务地址';
      const address = document.createElement('input'); address.type = 'url'; address.value = this.baseUrl; address.placeholder = 'https://…'; address.required = true; address.autocomplete = 'off'; address.setAttribute('aria-label', '服务地址');
      const codeLabel = document.createElement('label'); codeLabel.textContent = '访问口令';
      const code = document.createElement('input'); code.type = 'password'; code.required = true; code.autocomplete = 'off'; code.setAttribute('aria-label', '访问口令');
      const note = document.createElement('p'); note.className = 'muted'; note.textContent = '口令仅用于本次连接，不保存在浏览器中。';
      const status = document.createElement('p'); status.className = 'dialog-error'; status.setAttribute('role', 'status');
      const row = document.createElement('div'); row.className = 'dialog-actions';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
      const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '连接';
      row.append(cancel, submit); form.append(title, intro, addressLabel, address, codeLabel, code, note, status, row); dialog.append(form); document.body.append(dialog);
      let settled = false;
      const close = (result, error) => { if (settled) return; settled = true; code.value = ''; dialog.close(); dialog.remove(); this.pending = null; error ? reject(error) : resolve(result); };
      cancel.onclick = () => close(null, Error('已取消连接'));
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(null, Error('已取消连接')); });
      form.onsubmit = async event => {
        event.preventDefault(); if (submit.disabled) return; submit.disabled = true; status.textContent = '正在连接…';
        try {
          const result = await this.authenticate(address.value, code.value); code.value = '';
          close(result); this.onChange();
          if (result.changed) { this.env.location.reload(); return; }
        } catch (error) { status.textContent = error.message; submit.disabled = false; }
      };
      dialog.showModal(); (address.value ? code : address).focus();
    });
    return this.pending;
  }
}
module.exports = { Connection, normalizeBase, SETTINGS, SESSIONS, EXPIRED };
