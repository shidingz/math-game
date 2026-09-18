'use strict';

// Decorative, memory-only visits. This module never writes to the game save or economy.
const LIMITS = Object.freeze({ firstMin: 8000, firstMax: 12000, restMin: 24000, restMax: 40000, duration: 8200, enter: 1400, leave: 1700, maxGuests: 1 });
const INTERACTIONS = Object.freeze(['greeting', 'hop', 'curious']);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const randomUnit = random => clamp(Number(random()) || 0, 0, .999999999);
const delay = (random, first = false) => {
  const min = first ? LIMITS.firstMin : LIMITS.restMin;
  return min + randomUnit(random) * ((first ? LIMITS.firstMax : LIMITS.restMax) - min);
};
const clock = now => Number.isFinite(now) ? Math.max(0, now) : 0;

function create(now = 0, random = Math.random) {
  return { hostId: null, nextAt: clock(now) + delay(random, true), active: null, lastGuestId: null, sequence: 0, blocked: false };
}

function eligible(context, id) {
  const state = context?.state;
  if (!state || !id || id === 'jingwei' || id === state.activePet || state.unlockedPets?.[id] !== true || state.retiredPets?.[id]) return null;
  const character = context.characters?.find(c => c.id === id && !c.retired);
  const pet = state.pets?.[id];
  if (!character || !pet || !Number.isSafeInteger(pet.level) || pet.level < 1) return null;
  const visualLevel = Math.min(15, pet.level), stage = Math.floor((visualLevel - 1) / 5);
  if (!character.stages?.[stage]?.png || !character.frames?.length || !character.actions?.idle?.frames?.length) return null;
  return { id, level: pet.level, visualLevel, stage };
}

function available(context) {
  const state = context?.state;
  return !!(state?.starterChosen && state.unlockedPets?.[state.activePet] === true && context.screen === 'home' && !context.busy && !context.modal && !context.naming && !context.reducedMotion);
}

function select(context, lastGuestId, random = Math.random) {
  let candidates = (context.characters || []).map(c => eligible(context, c.id)).filter(Boolean);
  if (candidates.length > 1) candidates = candidates.filter(c => c.id !== lastGuestId);
  return candidates.length ? candidates[Math.floor(randomUnit(random) * candidates.length)] : null;
}

function cancel(previous, now, random = Math.random) {
  return { ...previous, active: null, nextAt: clock(now) + delay(random) };
}

function update(previous, context, now, random = Math.random) {
  const time = clock(now), hostId = context?.state?.activePet || null;
  let current = previous || create(time, random);
  if (current.hostId !== hostId) {
    current = { ...current, hostId, active: null, nextAt: current.hostId === null ? current.nextAt : time + delay(random, true) };
  }
  if (!available(context)) {
    return current.blocked && !current.active ? current : { ...cancel(current, time, random), blocked: true };
  }
  if (current.blocked) return { ...current, blocked: false, nextAt: Math.max(current.nextAt, time + delay(random, true)) };
  if (current.active) {
    if (!eligible(context, current.active.id) || time >= current.active.start + LIMITS.duration) return cancel(current, time, random);
    return current;
  }
  if (time < current.nextAt) return current;
  const guest = select(context, current.lastGuestId, random);
  if (!guest) return cancel(current, time, random);
  return { ...current, sequence: current.sequence + 1, lastGuestId: guest.id,
    active: { id: guest.id, start: time, side: randomUnit(random) < .5 ? 'left' : 'right', interaction: INTERACTIONS[Math.floor(randomUnit(random) * INTERACTIONS.length)] } };
}

function actionFor(character, desired) {
  return character.actions?.[desired]?.frames?.length ? desired : 'idle';
}

function pose(current, context, now) {
  if (!current?.active || current.hostId !== context?.state?.activePet || !available(context)) return null;
  // Re-read the current save on every frame, including while an atlas is loading.
  const guest = eligible(context, current.active.id);
  if (!guest) return null;
  const age = clock(now) - current.active.start;
  if (age < 0 || age >= LIMITS.duration) return null;
  const leavingAt = LIMITS.duration - LIMITS.leave;
  const phase = age < LIMITS.enter ? 'enter' : age >= leavingAt ? 'leave' : 'interact';
  const travel = phase === 'enter' ? age / LIMITS.enter : phase === 'leave' ? (LIMITS.duration - age) / LIMITS.leave : 1;
  const enter = clamp(travel, 0, 1), eased = enter * enter * (3 - 2 * enter);
  const elapsed = Math.max(0, age - LIMITS.enter);
  const interaction = current.active.interaction;
  const requested = interaction === 'hop' ? 'jump' : interaction === 'curious' ? 'think' : 'wave';
  const character = context.characters.find(c => c.id === guest.id);
  const host = context.characters.find(c => c.id === context.state.activePet);
  const action = actionFor(character, phase === 'interact' ? requested : 'idle');
  const hostAction = phase === 'interact' && host ? actionFor(host, requested) : null;
  const duration = character.actions[action].durationMs || 2400;
  const actionElapsed = phase === 'interact' ? elapsed % duration : age;
  return { ...guest, startedAt: current.active.start, side: current.active.side, interaction, phase, enter,
    anchorX: current.active.side === 'left' ? -.14 + .31 * eased : 1.14 - .31 * eased,
    scale: .40, opacity: clamp(enter * 4, 0, 1),
    action, hostAction, actionElapsed, actionPhase: clamp(actionElapsed / duration, 0, 1),
    hostActionElapsed: elapsed, progress: age / LIMITS.duration,
    jump: phase === 'interact' && interaction === 'hop' ? Math.max(0, Math.sin(elapsed / 900 * Math.PI * 2)) * .025 : 0 };
}

const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function visibleBounds(box, placement) {
  const cos = Math.cos(placement.rotation), sin = Math.sin(placement.rotation);
  const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([xx, yy]) => {
    const x = (xx - placement.pivotX) * placement.scale, y = (yy - placement.pivotY) * placement.scale;
    return { x: placement.x + x * cos - y * sin, y: placement.foot + x * sin + y * cos };
  });
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}
function place(box, x, bottom, height) {
  const placement = { x, foot: bottom, scale: height / box.height, rotation: 0, pivotX: box.x + box.width / 2, pivotY: box.y + box.height };
  return { ...placement, bounds: visibleBounds(box, placement) };
}
// During a visit only, normalize the visible bodies into equal-height side slots.
// Actual level/stage selection stays in pose(); no save or normal camera is changed.
function pairLayout({ scene, normal, hostBounds, guestBounds, blend, side, hop = 0, referenceHeight, hostRatio, guestRatio }) {
  const amount = clamp(blend, 0, 1), slotWidth = scene.width * .40;
  const normalHeight = normal.bounds.bottom - normal.bounds.top;
  const commonHeight = Math.min(scene.height * .51, (referenceHeight || normalHeight) * .92,
    slotWidth / (hostRatio || hostBounds.width / hostBounds.height), slotWidth / (guestRatio || guestBounds.width / guestBounds.height));
  const guestLeft = side === 'left', guestX = scene.x + scene.width * (guestLeft ? .26 : .74);
  const hostX = scene.x + scene.width * (guestLeft ? .74 : .26);
  const bottom = scene.y + scene.height * .85 - clamp(hop, 0, 1) * commonHeight * .065;
  const target = place(hostBounds, hostX, bottom, commonHeight), host = {};
  for (const key of ['x', 'foot', 'scale', 'rotation', 'pivotX', 'pivotY']) host[key] = mix(normal[key], target[key], amount);
  host.bounds = visibleBounds(hostBounds, host);
  const guestHeight = mix(normalHeight, commonHeight, amount);
  const outside = scene.x + scene.width * (guestLeft ? -.32 : 1.32);
  const guest = place(guestBounds, mix(outside, guestX, amount), bottom, guestHeight);
  return { host: amount === 0 ? normal : host, guest, blend: amount, commonHeight, slotWidth, opacity: clamp(amount * 2, 0, 1) };
}

module.exports = { LIMITS, INTERACTIONS, create, eligible, available, select, cancel, update, pose, smooth, pairLayout };
