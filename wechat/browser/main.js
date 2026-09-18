'use strict';
const { Connection } = require('./connection');
const { createAdapter } = require('./adapter');
const config = require('../config');
const localPacks = require('../data/local-pets');
const start = require('../runtime/main');
function launch(environment = window) {
  const document = environment.document;
  const connection = new Connection(config.customPets || {}, environment);
  config.customPets = { baseUrl: connection.baseUrl, assetHosts: connection.hosts() };
  const { api } = createAdapter({ canvas: document.getElementById('game-canvas'), connection, bundledIds: localPacks.map(p => p.id), environment });
  const app = start(api, environment);
  environment.mathPetWeb = app;
  const connect = document.getElementById('service-connect'), status = document.getElementById('service-status');
  function update() {
    const ready = !!connection.get(); connect.textContent = ready ? '服务设置' : '连接服务';
    status.textContent = ready ? '制作服务已连接' : '可拍照制作伙伴';
    status.dataset.connected = String(ready);
  }
  connection.onChange = update; update();
  connect.onclick = async () => { try { const result = await connection.open(); if (!result.changed) await app.game.studio.refresh(); } catch (e) { if (!/取消/.test(e.message)) app.game.tell(e.message); } };
  document.getElementById('open-studio').onclick = () => {
    if (app.game.busy || app.game.modal) return;
    if (!app.game.state.starterChosen) { app.game.tell('先选择一个初始伙伴，就可以制作专属伙伴'); app.game.open('pets'); return; }
    app.game.open('studio');
  };
  document.getElementById('build-mode').textContent = app.game.testMode ? '无限积分测试版' : '算算萌宠';
  return app;
}
try { launch(); } catch (error) {
  const box = document.getElementById('startup-error'); box.hidden = false; box.textContent = '游戏未能启动：' + error.message + '。请刷新页面重试。';
  console.error(error);
}
module.exports = { launch };
