'use strict';
// Data-only extension: no remote scripts and no model-supplied economy/actions.
const POSES = ['idle', 'blink', 'wave', 'pet', 'feed', 'think', 'sleep', 'jump', 'skill'];
const Presets = require('./pet-presets');
const ID = /^custom-[a-z0-9][a-z0-9-]{0,32}$/;
const clean = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max && !/[\u0000-\u001f]/.test(s);
function asset(value, hosts) {
  if (typeof value !== 'string' || value.length > 2048) throw Error('素材地址无效');
  const m = /^https:\/\/([a-z0-9.-]+)(\/[^\s\\]*)$/i.exec(value);
  if (!m || !hosts.includes(m[1].toLowerCase())) throw Error('素材域名未配置');
  return value;
}
function validatePack(raw, hosts = []) {
  if (!raw || raw.schemaVersion !== 1 || !ID.test(raw.id) || !clean(raw.name, 16) || !clean(raw.revision, 64)) throw Error('宠物素材包信息不完整');
  if (![384, 512].includes(raw.cellSize) || !Array.isArray(raw.stages) || raw.stages.length !== 3) throw Error('需要三个标准九宫格图集');
  const result = { schemaVersion: 1, id: raw.id, name: raw.name.trim(), revision: raw.revision, cellSize: raw.cellSize,
    stages: raw.stages.map((s, i) => {
      const stage = { image: asset(s?.image, hosts), name: clean(s?.name, 16) ? s.name : ['初始伙伴','觉醒伙伴','守护伙伴'][i] };
      if (s.bounds !== undefined) {
        if (!Array.isArray(s.bounds) || s.bounds.length !== 9) throw Error('动作边界无效');
        stage.bounds = s.bounds.map(b => {
          if (!b || !['x','y','width','height'].every(k => Number.isInteger(b[k])) || b.x < 0 || b.y < 0 || b.width < 1 || b.height < 1 || b.x + b.width > raw.cellSize || b.y + b.height > raw.cellSize) throw Error('动作边界越界');
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        });
      }
      return stage;
    }) };
  if (raw.portrait) result.portrait = asset(raw.portrait, hosts);
  if (raw.food) result.food = { name: clean(raw.food.name, 12) ? raw.food.name : '成长点心', image: asset(raw.food.image, hosts) };
  if (raw.scene) result.scene = asset(raw.scene, hosts);
  if (raw.effects) {
    result.effects = {};
    for (const name of ['particle', 'ground', 'back', 'evolution']) if (raw.effects[name]) result.effects[name] = asset(raw.effects[name], hosts);
  }
  if (/^#[0-9a-f]{6}$/i.test(raw.color)) result.color = raw.color;
  if (['aligned-v1','template-v1'].includes(raw.layout)) result.layout = raw.layout;
  if (raw.procedural !== undefined) result.procedural = Presets.validate(raw.procedural);
  return result;
}
function character(pack, base) {
  const art = pack.procedural ? Presets.compile(pack.procedural) : null;
  const size = pack.cellSize, color = pack.color || art?.colors.primary || '#468f9b';
  const actions = {};
  POSES.forEach((name, i) => { actions[name] = { frames: [i], durationMs: name === 'feed' ? 500 : 2400 }; });
  actions.celebrate = { frames: [7, 2, 7, 0], durationMs: 2400 };
  actions.evolve = { frames: [8, 7, 0], durationMs: 3000 };
  actions.run = { frames: [7, 0], durationMs: 1800 };
  return { id: pack.id, name: pack.name, custom: true, aligned: ['aligned-v1','template-v1'].includes(pack.layout), procedural: art, revision: pack.revision, portrait: pack.portrait || pack.stages[0].image,
    portraitAtlas: !pack.portrait, atlas: { width: size * 3, height: size * 3 },
    frames: POSES.map((name, i) => ({ name, x: i % 3 * size, y: Math.floor(i / 3) * size, width: size, height: size, pivotX: size / 2, pivotY: size * (pack.layout==='template-v1'?448:470) / 512 })),
    stages: pack.stages.map(s => ({ name: s.name, png: s.image, color,
      bounds: s.bounds || POSES.map(() => ({ x: 0, y: 0, width: size, height: size })) })),
    actions, idleActions: ['think','wave','sleep'], clickActions: ['pet','wave','jump','skill'],
    messages: { pet: ['有你陪着，真开心。'], skill: ['和你一起变得更强！'] },
    food: { name: pack.food?.name || '成长点心', image: pack.food?.image, embedded: pack.layout==='template-v1', cost: 20, growth: 20 },
    scene: pack.scene, textures: pack.effects || {}, unlock: { cost: 0 },
    ui: { ...base.ui, palette: { ...base.ui.palette, primary: color } },
    levels: Array.from({ length: 15 }, (_, i) => ({ name: i < 5 ? '快乐成长' : i < 10 ? '冒险觉醒' : '守护相伴' })) };
}
module.exports = { validatePack, character, ID, POSES };
