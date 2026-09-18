'use strict';
class PhotoStore {
  constructor(environment = globalThis) { this.env = environment; this.urls = new Map(); this.db = null; }
  async open() {
    if (!this.env.indexedDB) throw Error('浏览器无法保存照片，请关闭无痕模式或更换浏览器');
    if (!this.db) this.db = new Promise((resolve, reject) => {
      const request = this.env.indexedDB.open('math-pet-photos-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('photos');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(Error('无法打开照片存储，请检查浏览器存储权限'));
      request.onblocked = () => reject(Error('照片存储正在更新，请关闭其他游戏页面后重试'));
    }).catch(error => { this.db = null; throw error; });
    return this.db;
  }
  async operation(mode, run) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', mode), request = run(tx.objectStore('photos')); let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(Error('照片保存失败，请检查设备剩余空间'));
    });
  }
  async blob(path) {
    if (path.startsWith('idb-photo:')) {
      const blob = await this.operation('readonly', store => store.get(path.slice(10)));
      if (!blob) throw Error('本机照片已丢失，请重新选择照片');
      return blob;
    }
    if (!path.startsWith('blob:')) throw Error('照片路径无效');
    const response = await this.env.fetch(path); if (!response.ok) throw Error('无法读取照片'); return response.blob();
  }
  async save(path) {
    if (path.startsWith('idb-photo:')) { await this.blob(path); return path; }
    const blob = await this.blob(path);
    if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024) throw Error('请选择不超过10MB的图片');
    const id = this.env.crypto.randomUUID(); await this.operation('readwrite', store => store.put(blob, id));
    this.env.URL.revokeObjectURL(path);
    return 'idb-photo:' + id;
  }
  async resolve(path) {
    if (!path.startsWith('idb-photo:')) return path;
    if (!this.urls.has(path)) this.urls.set(path, this.env.URL.createObjectURL(await this.blob(path)));
    return this.urls.get(path);
  }
  async remove(path) {
    if (path.startsWith('idb-photo:')) await this.operation('readwrite', store => store.delete(path.slice(10)));
    const url = this.urls.get(path); if (url) this.env.URL.revokeObjectURL(url); this.urls.delete(path);
  }
  releaseTemporary(paths) { for (const path of paths) if (path.startsWith('blob:')) this.env.URL.revokeObjectURL(path); }
}
module.exports = { PhotoStore };
