'use strict';

// Only this adapter knows about WeChat. The controller and economy remain testable.
const Core = require('../shared/core');
const { restoreLibrary } = require('./pet-studio');
const PetNames = require('./pet-names');
const FORMAL_KEY = 'math-pet-wechat:formal:v1';
const TEST_KEY = 'math-pet-wechat:test:v1';
const RETIRED_CUSTOM_IDS = Object.freeze(['custom-shiba-template-01','custom-shiba-sunburst-01','custom-ember-guided-01','custom-tide-alpha-01','custom-dc290065be7b5f0e1b548394']);
function removeRetiredCustomPets(value) {
  if (!value || typeof value !== 'object') return value;
  const retired = new Set(RETIRED_CUSTOM_IDS), clean = { ...value };
  for (const name of ['pets','unlockedPets','customPetNames']) if (value[name] && typeof value[name] === 'object') clean[name] = Object.fromEntries(Object.entries(value[name]).filter(([id]) => !retired.has(id)));
  if (value.customPetLibrary && typeof value.customPetLibrary === 'object') clean.customPetLibrary = { ...value.customPetLibrary,
    packs: Array.isArray(value.customPetLibrary.packs) ? value.customPetLibrary.packs.filter(p => !retired.has(p?.id)) : value.customPetLibrary.packs,
    jobs: Array.isArray(value.customPetLibrary.jobs) ? value.customPetLibrary.jobs.filter(j => !retired.has(j?.petId)) : value.customPetLibrary.jobs };
  if (retired.has(clean.activePet)) clean.activePet = Object.keys(clean.unlockedPets || {}).find(id => clean.unlockedPets[id] === true && !id.startsWith('custom-')) || 'wukong';
  if (retired.has(clean.starterPet)) clean.starterPet = clean.activePet;
  return clean;
}

function createStorage(api, testMode, characters, customConfig = {}) {
  const key = testMode ? TEST_KEY : FORMAL_KEY;
  let warning = '', readFailed = false;
  function fresh() {
    const state = Core.initialState();
    if (testMode) {
      Core.chooseStarter(state, characters[0].id, characters.map(c => c.id));
      state.points = 10000;
      for (const c of characters) {
        state.unlockedPets[c.id] = true;
        state.pets[c.id] = { level: 1, growth: 0, feeds: 0 };
      }
    }
    return state;
  }
  return {
    key,
    get warning() { return warning; },
    load() {
      try {
        const raw = api.getStorageSync(key);
        if (raw === '' || raw === undefined || raw === null) return fresh();
        const value = removeRetiredCustomPets(typeof raw === 'string' ? JSON.parse(raw) : raw);
        if (![1, 2, 3, 4].includes(value?.version)) throw Error('Unknown save version');
        const state = Core.restore(value);
        state.customPetLibrary = restoreLibrary(value.customPetLibrary, customConfig.assetHosts || []);
        state.customPetNames = PetNames.restore(value.customPetNames);
        return state;
      } catch (_) {
        // Do not overwrite a save we could not read.
        readFailed = true;
        warning = '存档读取失败，本次进度暂不覆盖旧存档，请重新打开。';
        return fresh();
      }
    },
    save(state) {
      if (readFailed) return false;
      try {
        api.setStorageSync(key, JSON.stringify(state));
        warning = '';
        return true;
      } catch (_) {
        warning = '进度尚未保存，请清理设备空间后重试。';
        return false;
      }
    }
  };
}

class Assets {
  constructor(api) {
    this.api = api;
    this.packages = new Map();
    this.images = new Map();
    this.generation = 0;
  }
  package(name) {
    if (!this.packages.has(name)) {
      const pending = new Promise((resolve, reject) => {
        if (!this.api.loadSubpackage) return resolve();
        this.api.loadSubpackage({ name, success: resolve, fail: reject });
      }).catch(error => { this.packages.delete(name); throw error; });
      this.packages.set(name, pending);
    }
    return this.packages.get(name);
  }
  load(path) {
    if (!this.images.has(path)) {
      const pending = new Promise((resolve, reject) => {
        const img = this.api.createImage();
        img.onload = () => resolve(img);
        img.onerror = () => reject(Error('素材加载失败：' + path));
        const localPackage = /^custom-assets\/(custom-[a-z0-9-]+)\//.exec(path);
        if (localPackage) {
          this.package(localPackage[1]).then(() => { img.src = path; }, reject);
        } else if (path.startsWith('https://') && this.api.downloadFile) {
          this.api.downloadFile({ url: path, timeout: 30000, success: r => {
            if (r.statusCode !== 200 || !r.tempFilePath) return reject(Error('素材下载失败'));
            img.src = r.tempFilePath;
          }, fail: reject });
        } else if (this.api.resolveImagePath && path.startsWith('idb-photo:')) this.api.resolveImagePath(path).then(url => { img.src = url; }, reject);
        else img.src = path;
      }).catch(error => { this.images.delete(path); throw error; });
      this.images.set(path, pending);
      // Keep memory bounded when users create many pets; descriptors stay in storage.
      while (this.images.size > 24) this.images.delete(this.images.keys().next().value);
    }
    return this.images.get(path);
  }
  releaseAtlases(keepPath) {
    for (const path of this.images.keys()) {
      if ((path.startsWith('pets/') || /^custom-assets\/[^/]+\/[^/]+\/stage-[123]\.png$/.test(path)) && path !== keepPath) this.images.delete(path);
    }
  }
}

function allowTest(api, config) {
  if (!config.debug) return false;
  try {
    if (api.getAccountInfoSync().miniProgram.envVersion === 'release') return false;
    const query = String(api.getLaunchOptionsSync()?.query?.test);
    return query === '1' || (config.testDefault === true && query !== '0');
  } catch (_) { return false; }
}

module.exports = { createStorage, Assets, allowTest, FORMAL_KEY, TEST_KEY, removeRetiredCustomPets, RETIRED_CUSTOM_IDS };
