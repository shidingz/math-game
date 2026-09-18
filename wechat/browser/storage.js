'use strict';
const BUILTINS = ['wukong','nezha','yutu','bichon','ragdoll','corgi','samoyed','siamese'];
function parse(value) { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch (_) { return null; } }
// A server's pets and pending uploads belong to that server. Switching a URL
// keeps its original save intact and copies only the shared, built-in progress.
function moveScope(raw, bundledIds = [], keepDrafts = false) {
  const source = parse(raw); if (!source || typeof source !== 'object') return '';
  const keep = new Set([...BUILTINS, ...bundledIds]);
  const state = { ...source };
  for (const field of ['pets','unlockedPets','customPetNames']) state[field] = Object.fromEntries(Object.entries(source[field] || {}).filter(([id]) => keep.has(id)));
  state.customPetLibrary = { version: 1, packs: [], jobs: keepDrafts ? (source.customPetLibrary?.jobs || []).filter(j => j.status === 'draft' && !j.photoIds?.length) : [] };
  if (!keep.has(state.activePet)) state.activePet = Object.keys(state.unlockedPets).find(id => state.unlockedPets[id] === true) || 'wukong';
  if (state.starterPet && !keep.has(state.starterPet)) state.starterPet = state.activePet;
  return JSON.stringify(state);
}
function createBrowserStorage(storage, baseUrl, bundledIds = []) {
  const scope = encodeURIComponent(baseUrl || 'offline');
  const mode = key => key.includes(':test:') ? 'test' : 'formal';
  const keyFor = key => 'math-pet-web:game:v1:' + mode(key) + ':' + scope;
  const lastKey = key => 'math-pet-web:last:v1:' + mode(key);
  return {
    keyFor,
    getStorageSync(key) {
      const own = storage.getItem(keyFor(key)); if (own !== null) return own;
      const last = parse(storage.getItem(lastKey(key)));
      if (last?.state) return moveScope(last.state, bundledIds, last.baseUrl === '');
      const legacy = storage.getItem(key) || storage.getItem(mode(key) === 'test' ? 'math-pet-game:test:v1' : 'math-pet-game:v2');
      return legacy ? moveScope(legacy, bundledIds) : '';
    },
    setStorageSync(key, value) {
      storage.setItem(keyFor(key), value);
      storage.setItem(lastKey(key), JSON.stringify({ baseUrl, state: value }));
    }
  };
}
module.exports = { createBrowserStorage, moveScope, BUILTINS };
