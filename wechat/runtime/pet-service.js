'use strict';
function invoke(api, method, options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof api[method] !== 'function') return reject(Error('当前环境不支持此功能，请使用微信真机'));
    api[method]({ ...options, success: resolve, fail: reject });
  });
}
class PetService {
  constructor(api, config = {}) { this.api = api; this.config = config; this.token = api.petSession?.get(config.baseUrl) || ''; this.auth = null; }
  get enabled() { return (/^https:\/\/[a-z0-9.-]+(?:\/[^\s?#]*)?$/i.test(this.config.baseUrl || '') || (this.api.browserMode && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[^\s?#]*)?$/.test(this.config.baseUrl || ''))) && this.config.assetHosts?.length > 0; }
  get needsConnection() { return !!this.api.petSession && !this.api.petSession.get(this.config.baseUrl); }
  expired() { this.token = ''; this.api.petSession?.clear(this.config.baseUrl); return Error(this.api.browserMode ? '连接已失效，请重新连接制作服务' : '登录已失效，请重新提交'); }
  async request(path, method = 'GET', data, authenticated = true) {
    if (!this.enabled) throw Error('宠物生成服务尚未开放');
    if (authenticated) await this.login();
    const r = await invoke(this.api, 'request', { url: this.config.baseUrl.replace(/\/$/, '') + path, method, data,
      timeout: 30000, header: { 'content-type': 'application/json', ...(authenticated ? { Authorization: 'Bearer ' + this.token } : {}) } });
    if (r.statusCode === 401) throw this.expired();
    if (r.statusCode < 200 || r.statusCode >= 300 || !r.data || typeof r.data !== 'object') throw Error('服务暂时不可用，请稍后重试');
    return r.data;
  }
  async login() {
    if (this.api.petSession) {
      this.token = this.api.petSession.get(this.config.baseUrl) || await this.api.petSession.ensure(this.config.baseUrl);
      if (!this.token) throw Error('请先连接制作服务');
      return;
    }
    if (this.token) return;
    if (!this.auth) this.auth = (async () => {
      const { code } = await invoke(this.api, 'login', { timeout: 15000 });
      if (!code) throw Error('微信登录失败');
      const r = await this.request('/session', 'POST', { code }, false);
      if (typeof r.token !== 'string' || r.token.length > 4096) throw Error('登录响应无效');
      this.token = r.token;
    })().finally(() => { this.auth = null; });
    return this.auth;
  }
  async upload(filePath, requestId, index) {
    await this.login();
    const r = await invoke(this.api, 'uploadFile', { url: this.config.baseUrl.replace(/\/$/, '') + '/pet-photos', filePath, name: 'file',
      timeout: 60000, header: { Authorization: 'Bearer ' + this.token }, formData: { requestId, index: String(index) } });
    if (r.statusCode === 401) throw this.expired();
    if (r.statusCode < 200 || r.statusCode >= 300) throw Error('照片上传失败');
    let data; try { data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; } catch (_) { throw Error('上传响应无效'); }
    if (typeof data?.photoId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.photoId)) throw Error('照片编号无效');
    return data.photoId;
  }
  create(job) { return this.request('/pet-jobs', 'POST', { requestId: job.requestId, photoIds: job.photoIds }); }
  list() { return this.request('/pet-jobs'); }
}
module.exports = { PetService, invoke };
