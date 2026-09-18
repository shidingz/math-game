'use strict';
const { createStorage, Assets, allowTest } = require('./platform');
const Controller = require('./controller');
const View = require('./view');
const characters = require('../data/characters');
const localPacks = require('../data/local-pets');
const config = require('../config');
const { PetService } = require('./pet-service');
const { PetStudio } = require('./pet-studio');

function start(api = wx, environment = GameGlobal) {
  const canvas = api.createCanvas();
  environment.canvas = canvas;
  const ctx = canvas.getContext('2d');
  const testMode = allowTest(api, config);
  const storage = createStorage(api, testMode, characters, config.customPets);
  const game = new Controller({ storage, characters: characters.slice(), testMode });
  game.requestRename = () => require('./pet-names').request(api, game);
  const studio = new PetStudio({ api, game, service: new PetService(api, config.customPets), config: config.customPets, localPacks });
  game.studio = studio;
  const assets = new Assets(api);
  const view = new View(ctx, game, assets);
  const motionQuery=environment.matchMedia?.('(prefers-reduced-motion: reduce)');
  view.reducedMotion=!!motionQuery?.matches;
  motionQuery?.addEventListener?.('change',event=>{view.reducedMotion=event.matches;});
  let scale = 1, left = 0, top = 0, dpr = 1, running = false, frameId, last = 0;
  const raf = environment.requestAnimationFrame ? environment.requestAnimationFrame.bind(environment) : requestAnimationFrame;
  const caf = environment.cancelAnimationFrame ? environment.cancelAnimationFrame.bind(environment) : cancelAnimationFrame;
  function resize() {
    const info = api.getWindowInfo ? api.getWindowInfo() : api.getSystemInfoSync();
    const width = info.windowWidth || info.screenWidth;
    const height = info.windowHeight || info.screenHeight;
    let menu;
    try { menu = api.getMenuButtonBoundingClientRect?.(); } catch (_) {}
    top = Math.max(info.safeArea?.top || 0, menu?.bottom || 0) + 8;
    const bottom = Math.max(12, height - (info.safeArea?.bottom || height));
    scale = Math.min(width / 390, (height - top - bottom) / 660, 1.8);
    left = (width - 390 * scale) / 2;
    view.height = Math.max(660, (height - top - bottom) / scale);
    // Keep oversized desktop windows comfortable without stretching the character.
    view.height = Math.min(view.height, 920);
    dpr = Math.max(1, Math.min(2, info.pixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  function frame(now) {
    if (!running) return;
    const stamp = Number.isFinite(now) ? now : Date.now();
    game.tick(last ? stamp - last : 0);
    studio.tick();
    last = stamp;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = game.modal?.type === 'upgrade' ? '#101c2c' : view.palette.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * left, dpr * top);
    view.render();
    frameId = raf(frame);
  }
  function show() { if (running) return; resize(); running = true; last = 0; frameId = raf(frame); studio.refresh(); }
  function hide() { running = false; caf(frameId); last = 0; game.save(); }
  let down = null;
  api.onTouchStart(event => { const t = event.touches[0]; if (t) down = { x: t.clientX, y: t.clientY }; });
  api.onTouchEnd(event => {
    const t = event.changedTouches[0], start = down;
    down = null;
    if (!t || !start || Math.hypot(t.clientX - start.x, t.clientY - start.y) > 18) return;
    view.touch((t.clientX - left) / scale, (t.clientY - top) / scale);
  });
  if (api.onTouchCancel) api.onTouchCancel(() => { down = null; });
  api.onHide(hide);
  api.onShow(show);
  if (api.onWindowResize) api.onWindowResize(resize);
  if (api.onMemoryWarning) api.onMemoryWarning(() => assets.releaseAtlases(view.atlasKey));
  show();
  return { game, view, canvas, hide, show, resize, position: () => ({ left, top, scale }) };
}
module.exports = start;
