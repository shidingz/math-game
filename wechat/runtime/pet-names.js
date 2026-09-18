'use strict';
// User-owned display names, separate from immutable generated asset metadata.
const ID = /^custom-[a-z0-9-]{1,64}$/;
function normalize(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(value)) return null;
  const name = value.trim().replace(/\s+/gu, ' ');
  return name && Array.from(name).length <= 12 ? name : null;
}
function restore(raw) {
  const result = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      const name = normalize(value);
      if (ID.test(id) && name) result[id] = name;
    }
  }
  return result;
}
function display(pet, names) { return pet.custom ? normalize(names?.[pet.id]) || '新伙伴' : pet.name; }
function request(api, game) {
  const pet = game.character;
  if (!pet.custom || game.busy || game.modal || game.naming || game.screen !== 'home') return;
  if (!api.showModal || (api.canIUse && !api.canIUse('showModal.object.editable'))) return game.tell('请更新微信后再修改名字');
  game.naming = true;
  const done = () => { game.naming = false; };
  try {
    api.showModal({ title: '给伙伴起个名字', content: game.petName(pet), editable: true,
      placeholderText: '输入 1—12 个字', confirmText: '保存', cancelText: '取消',
      success: result => { done(); if (result.confirm) game.renamePet(pet.id, result.content); },
      fail: () => { done(); game.tell('暂时无法打开输入框，请重试'); }, complete: done });
  } catch (_) { done(); game.tell('暂时无法打开输入框，请重试'); }
}
module.exports = { normalize, restore, display, request };
