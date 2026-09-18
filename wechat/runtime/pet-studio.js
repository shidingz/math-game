'use strict';
const { validatePack, character, ID } = require('./custom-pets');
const { invoke } = require('./pet-service');
const REQUEST = /^[a-zA-Z0-9_-]{1,100}$/;
const STATES = ['draft','uploading','submitting','queued','processing','ready','failed'];
function restoreLibrary(raw, hosts) {
  if (raw === undefined) return { version: 1, packs: [], jobs: [] };
  if (raw?.version !== 1 || !Array.isArray(raw.packs) || !Array.isArray(raw.jobs)) throw Error('自定义伙伴存档损坏');
  const packs = raw.packs.map(p => validatePack(p, hosts));
  if (new Set(packs.map(p => p.id)).size !== packs.length) throw Error('重复宠物编号');
  const jobs = raw.jobs.map(j => {
    if (typeof j?.requestId !== 'string' || !REQUEST.test(j.requestId) || !STATES.includes(j.status) || !Array.isArray(j.photoIds) || !Array.isArray(j.files) || j.files.length > 3 || j.photoIds.length > 3 || j.files.some(p => typeof p !== 'string') || j.photoIds.some(p => typeof p !== 'string' || !REQUEST.test(p))) throw Error('生成记录损坏');
    return { requestId: j.requestId, status: j.status, files: j.files, photoIds: j.photoIds, createdAt: Number(j.createdAt) || 0,
      petId: ID.test(j.petId) ? j.petId : null, error: typeof j.error === 'string' ? j.error.slice(0, 80) : '' };
  });
  if (new Set(jobs.map(j => j.requestId)).size !== jobs.length) throw Error('重复任务编号');
  return { version: 1, packs, jobs };
}
class PetStudio {
  constructor({ api, game, service, config = {}, localPacks = [] }) {
    this.api = api; this.game = game; this.service = service; this.config = config;
    // Trusted build-time catalog stays outside the remotely supplied saved library.
    this.localPacks = localPacks;
    this.library = game.state.customPetLibrary || { version: 1, packs: [], jobs: [] };
    game.state.customPetLibrary = this.library;
    this.selected = []; this.working = false; this.refreshing = false; this.page = 0; this.lastRefresh = 0;
    this.register();
  }
  get jobs() { return this.library.jobs; }
  save() { if (!this.game.save()) throw Error('保存失败，请清理设备空间后重试'); }
  register() {
    const base = this.game.characters.find(c => !c.custom);
    const packs = [...this.localPacks, ...this.library.packs.filter(p => !this.localPacks.some(l => l.id === p.id))];
    for (const pack of packs) {
      const c = character(pack, base), i = this.game.characters.findIndex(c => c.id === pack.id);
      c.bundled = this.localPacks.includes(pack);
      if (i < 0) this.game.characters.push(c); else this.game.characters[i] = c;
    }
    const rank = new Map(packs.map((p, i) => [p.id, i]));
    this.game.characters.sort((a,b) => Number(!!b.custom)-Number(!!a.custom) || (a.custom ? (rank.get(b.id) ?? -1)-(rank.get(a.id) ?? -1) : 0));
    this.game.ids = this.game.characters.map(c => c.id);
    if (this.game.state.starterChosen || this.game.testMode) {
      const state = this.game.state;
      const before = { unlockedPets: { ...state.unlockedPets }, pets: { ...state.pets }, activePet: state.activePet };
      let newlySelected = false;
      for (const c of this.game.characters.filter(c => c.custom || this.game.testMode)) {
        const added = !state.unlockedPets[c.id];
        state.unlockedPets[c.id] = true;
        state.pets[c.id] ||= { level: 1, growth: 0, feeds: 0 };
        if (added && c.bundled && this.game.testMode && !newlySelected) { state.activePet = c.id; newlySelected = true; }
      }
      if (!this.game.save()) { Object.assign(state, before); this.game.tell('伙伴保存失败，请清理设备空间后重试'); }
    }
    // Missing metadata must not make a different character consume another pet's progress.
    if (!this.game.ids.includes(this.game.state.activePet)) {
      this.game.state.activePet = this.game.ids.find(id => this.game.state.unlockedPets[id]) || this.game.ids[0];
    }
  }
  addLocal() {
    if (!this.game.state.starterChosen || !this.localPacks.length) return;
    const state = this.game.state;
    const before = { unlockedPets: { ...state.unlockedPets }, pets: { ...state.pets } };
    for (const p of this.localPacks) {
      state.unlockedPets[p.id] = true;
      state.pets[p.id] ||= { level: 1, growth: 0, feeds: 0 };
    }
    try { this.save(); } catch (e) { Object.assign(state, before); return this.game.tell(e.message); }
    this.game.petPage = 0;
    this.game.open('pets');
    this.game.tell('本地伙伴已加入，重复加入不会重置成长');
  }
  async choose(source) {
    if (this.working) return;
    this.working = true;
    try {
      const r = await invoke(this.api, 'chooseImage', { count: 3, sizeType: ['compressed'], sourceType: [source] });
      const paths = r.tempFilePaths;
      if (!Array.isArray(paths) || !paths.length || paths.length > 3) throw Error('请选择1—3张同一宠物的照片');
      if (r.tempFiles?.some(f => f.size > 10 * 1024 * 1024)) throw Error('单张照片不能超过10MB');
      this.api.releaseImagePaths?.(this.selected);
      this.selected = paths;
    } catch (e) { if (!/cancel/i.test(e.errMsg || e.message || '')) this.game.tell(e.message || '未能读取照片，请检查相机或相册权限'); }
    finally { this.working = false; }
  }
  async submit() {
    if (this.working || !this.selected.length) return;
    this.working = true;
    const files = [];
    try {
      for (let i = 0; i < this.selected.length; i++) {
        const path = this.selected[i];
        const fs = this.api.getFileSystemManager?.();
        if (!fs?.saveFile) throw Error('当前环境不支持保存照片，请使用微信真机');
        const r = await invoke(fs, 'saveFile', { tempFilePath: path });
        if (typeof r.savedFilePath !== 'string' || !r.savedFilePath) throw Error('照片保存失败');
        files.push(r.savedFilePath);
        // saveFile may move the temporary file. A retry must use the saved path.
        this.selected[i] = r.savedFilePath;
      }
      const requestId = 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      const job = { requestId, status: 'draft', files, photoIds: [], createdAt: Date.now(), petId: null, error: '' };
      this.jobs.unshift(job);
      try { this.save(); } catch (e) { this.jobs.shift(); throw e; }
      this.selected = []; this.page = 0;
      if (this.service.enabled) await this.send(job);
      else this.game.tell('照片已保存，等待生成服务开放');
    } catch (e) { this.game.tell(e.message || '保存照片失败，请重试'); }
    finally { this.working = false; }
  }
  async send(job) {
    // Persist the id before network traffic; retries always use the same idempotency key.
    if (!this.service.enabled) return this.game.tell('生成服务尚未开放，照片已保存在本机');
    try {
      job.error = ''; job.status = 'uploading'; this.save();
      for (let i = job.photoIds.length; i < job.files.length; i++) {
        job.photoIds.push(await this.service.upload(job.files[i], job.requestId, i)); this.save();
      }
      if (!job.photoIds.length) throw Error('照片已不可用，请重新选择照片创建任务');
      job.status = 'submitting'; this.save();
      const r = await this.service.create(job);
      if (r.requestId !== job.requestId) throw Error('任务响应编号不匹配');
      this.apply([r]);
      this.game.tell('已提交，制作完成后会加入你的伙伴列表');
    } catch (e) { job.error = e.message || '提交失败，可重试'; this.game.save(); this.game.tell(job.error); }
  }
  async retry(job) {
    if (this.working || this.refreshing || !['draft','uploading','submitting'].includes(job.status)) return;
    this.working = true;
    try { await this.send(job); } finally { this.working = false; }
  }
  apply(rows) {
    if (!Array.isArray(rows)) throw Error('任务列表无效');
    if (new Set(rows.map(r => r?.requestId)).size !== rows.length) throw Error('重复任务响应');
    // Validate a complete batch before any mutation or ownership grant.
    const plans = rows.map(r => {
      if (typeof r?.requestId !== 'string' || !REQUEST.test(r.requestId) || !['queued','processing','ready','failed'].includes(r.status)) throw Error('任务状态无效');
      const pack = r.status === 'ready' ? validatePack(r.pet, this.config.assetHosts || []) : null;
      if (pack && this.localPacks.some(p => p.id === pack.id)) throw Error('服务端宠物编号与本地伙伴冲突');
      const old = this.jobs.find(j => j.requestId === r.requestId);
      if (pack && ((old?.petId && old.petId !== pack.id) || this.jobs.some(j => j.requestId !== r.requestId && j.petId === pack.id))) throw Error('宠物编号与任务冲突');
      return { r, pack };
    });
    const readyIds = plans.filter(p => p.pack).map(p => p.pack.id);
    if (new Set(readyIds).size !== readyIds.length) throw Error('多个任务不能覆盖同一宠物');
    let completed = 0;
    for (const { r, pack } of plans) {
      let job = this.jobs.find(j => j.requestId === r.requestId);
      if (!job) { job = { requestId: r.requestId, files: [], photoIds: [], createdAt: Date.now(), petId: null }; this.jobs.unshift(job); }
      if (job.status === 'ready' && !pack) continue; // stale list responses cannot regress completion
      if (pack && job.status !== 'ready') completed++;
      job.status = r.status; job.error = r.status === 'failed' ? '生成未完成，请联系服务方或重新创建任务' : '';
      if (pack) {
        const index = this.library.packs.findIndex(p => p.id === pack.id);
        if (index < 0) this.library.packs.push(pack); else this.library.packs[index] = pack;
        job.petId = pack.id;
        this.game.state.unlockedPets[pack.id] = true;
        this.game.state.pets[pack.id] ||= { level: 1, growth: 0, feeds: 0 };
      }
    }
    this.register(); this.save();
    if (completed) { this.game.petPage = 0; this.game.tell(completed + ' 位专属伙伴制作完成，已免费加入列表首位', 5000); }
    this.releaseSubmittedPhotos();
  }
  releaseSubmittedPhotos() {
    // After the server acknowledges the job, it owns the source images. Keep only
    // references locally, so repeated generations do not fill WeChat file storage.
    const fs = this.api.getFileSystemManager?.();
    if (!fs?.removeSavedFile) return;
    for (const job of this.jobs) if (['queued','processing','ready','failed'].includes(job.status) && job.files.length) {
      const paths = job.files.slice(); job.files = [];
      if (!this.game.save()) { job.files = paths; return; }
      for (const filePath of paths) fs.removeSavedFile({ filePath, success() {}, fail() {} });
    }
  }
  removeDraft(job) {
    if (this.working || job.status !== 'draft') return;
    const index = this.jobs.indexOf(job); if (index < 0) return;
    this.jobs.splice(index, 1);
    if (!this.game.save()) { this.jobs.splice(index, 0, job); return; }
    const fs = this.api.getFileSystemManager?.();
    for (const filePath of job.files) fs?.removeSavedFile?.({ filePath, success() {}, fail() {} });
    this.game.tell('已删除待提交记录');
  }
  async refresh() {
    if (!this.service.enabled || this.service.needsConnection || this.refreshing || this.working || !this.game.state.starterChosen) return;
    this.refreshing = true; this.lastRefresh = Date.now();
    try { const r = await this.service.list(); this.apply(r.jobs); }
    catch (e) { this.game.tell(e.message || '暂时无法刷新制作进度'); }
    finally { this.refreshing = false; }
  }
  tick() {
    if (!this.service.enabled || this.service.needsConnection) return;
    if (Date.now() - this.lastRefresh > 15000 && (this.game.screen === 'studio' || this.jobs.some(j => ['queued','processing','submitting'].includes(j.status)))) this.refresh();
  }
}
module.exports = { PetStudio, restoreLibrary };
