'use strict';
const { PhotoStore } = require('./photo-store');
const { createBrowserStorage } = require('./storage');
function done(options, promise) { promise.then(result => { options.success?.(result); options.complete?.(result); }, error => { options.fail?.(error); options.complete?.(error); }); }
function createAdapter({ canvas, connection, bundledIds = [], environment = window }) {
  const env = environment, doc = env.document, photos = new PhotoStore(env);
  const storage = createBrowserStorage(env.localStorage, connection.baseUrl, bundledIds);
  async function fetchResponse(options, body) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), options.timeout || 30000);
    try {
      const response = await env.fetch(options.url, { method: options.method || 'POST', headers: options.header || {},
        credentials: 'omit', signal: abort.signal, ...(body === undefined ? {} : { body }) });
      const text = await response.text(); let data = text; try { data = JSON.parse(text); } catch (_) {}
      return { statusCode: response.status, data };
    } catch (error) { throw Error(error.name === 'AbortError' ? '请求超时，请稍后重试' : '无法连接制作服务，请检查网络和服务地址'); }
    finally { clearTimeout(timer); }
  }
  const api = {
    ...storage, browserMode: true, petSession: connection,
    createCanvas: () => canvas,
    createImage() { const img = new env.Image(); img.crossOrigin = 'anonymous'; return img; },
    resolveImagePath: path => photos.resolve(path),
    releaseImagePaths(paths) { photos.releaseTemporary(paths); for (const path of paths) if (path.startsWith('idb-photo:')) photos.remove(path).catch(() => {}); },
    getWindowInfo() { const box = canvas.getBoundingClientRect(); return { windowWidth: box.width, windowHeight: box.height, pixelRatio: env.devicePixelRatio || 1, safeArea: { top: 0, bottom: box.height } }; },
    getMenuButtonBoundingClientRect: () => ({ bottom: 0 }),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    getLaunchOptionsSync: () => ({ query: Object.fromEntries(new URLSearchParams(env.location.search)) }),
    request(options) { done(options, fetchResponse(options, options.data === undefined ? undefined : JSON.stringify(options.data))); },
    uploadFile(options) {
      done(options, (async () => {
        const blob = await photos.blob(options.filePath), body = new env.FormData();
        for (const [key, value] of Object.entries(options.formData || {})) body.append(key, String(value));
        body.append(options.name || 'file', blob, blob.type === 'image/png' ? 'photo.png' : 'photo.jpg');
        return fetchResponse({ ...options, method: 'POST' }, body);
      })());
    },
    chooseImage(options) {
      const input = doc.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = (options.count || 1) > 1;
      if (options.sourceType?.includes('camera')) input.setAttribute('capture', 'environment');
      input.className = 'photo-picker'; input.setAttribute('aria-label', options.sourceType?.includes('camera') ? '拍摄伙伴照片' : '选择伙伴照片'); doc.body.append(input);
      let settled = false;
      const finish = (value, error) => { if (settled) return; settled = true; input.remove(); if (error) options.fail?.(error); else options.success?.(value); options.complete?.(error || value); };
      input.addEventListener('cancel', () => finish(null, Error('chooseImage:cancel')));
      input.onchange = () => {
        const files = [...input.files];
        if (!files.length) return finish(null, Error('chooseImage:cancel'));
        if (files.length > Math.min(3, options.count || 3)) return finish(null, Error('一次请选择1—3张同一伙伴的图片'));
        if (files.some(f => !f.type.startsWith('image/') || f.size > 10 * 1024 * 1024)) return finish(null, Error('请选择不超过10MB的图片'));
        const paths = files.map(file => env.URL.createObjectURL(file));
        finish({ tempFilePaths: paths, tempFiles: files.map((file, i) => ({ path: paths[i], size: file.size })) });
      };
      input.click();
    },
    getFileSystemManager() { return {
      saveFile(options) { done(options, photos.save(options.tempFilePath).then(savedFilePath => ({ savedFilePath }))); },
      removeSavedFile(options) { done(options, photos.remove(options.filePath).then(() => ({}))); }
    }; },
    canIUse: () => true,
    showModal(options) {
      const dialog = doc.createElement('dialog'); dialog.className = 'web-dialog';
      const form = doc.createElement('form'), title = doc.createElement('h2'), input = doc.createElement(options.editable ? 'input' : 'p');
      title.textContent = options.title || '';
      if (options.editable) { input.value = options.content || ''; input.placeholder = options.placeholderText || ''; input.maxLength = 32; input.setAttribute('aria-label', '伙伴名字'); }
      else input.textContent = options.content || '';
      const row = doc.createElement('div'); row.className = 'dialog-actions';
      const cancel = doc.createElement('button'), confirm = doc.createElement('button'); cancel.type = 'button'; confirm.type = 'submit'; cancel.textContent = options.cancelText || '取消'; confirm.textContent = options.confirmText || '确定'; row.append(cancel, confirm); form.append(title, input, row); dialog.append(form); doc.body.append(dialog);
      let settled = false;
      function close(confirmed) { if (settled) return; settled = true; const result = { confirm: confirmed, cancel: !confirmed, content: options.editable ? input.value : '' }; dialog.close(); dialog.remove(); options.success?.(result); options.complete?.(result); }
      form.onsubmit = event => { event.preventDefault(); close(true); }; cancel.onclick = () => close(false);
      dialog.oncancel = event => { event.preventDefault(); close(false); }; dialog.showModal(); if (options.editable) input.focus();
    },
    onTouchStart(fn) { canvas.addEventListener('pointerdown', event => { if (!event.isPrimary) return; canvas.setPointerCapture(event.pointerId); fn({ touches: [touch(event)] }); }); },
    onTouchEnd(fn) { canvas.addEventListener('pointerup', event => { if (event.isPrimary) fn({ changedTouches: [touch(event)] }); }); },
    onTouchCancel(fn) { canvas.addEventListener('pointercancel', fn); },
    onWindowResize(fn) { env.addEventListener('resize', fn); env.visualViewport?.addEventListener('resize', fn); if (env.ResizeObserver) new env.ResizeObserver(fn).observe(canvas); },
    onHide(fn) { doc.addEventListener('visibilitychange', () => { if (doc.hidden) fn(); }); env.addEventListener('pagehide', fn); },
    onShow(fn) { doc.addEventListener('visibilitychange', () => { if (!doc.hidden) fn(); }); env.addEventListener('pageshow', fn); }
  };
  function touch(event) { const rect = canvas.getBoundingClientRect(); return { clientX: event.clientX - rect.left, clientY: event.clientY - rect.top }; }
  return { api, photos };
}
module.exports = { createAdapter };
