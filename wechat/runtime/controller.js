'use strict';
const Core = require('../shared/core');
const Questions = require('../shared/questions');
const PetNames = require('./pet-names');
const Evolution = require('./evolution-progress');
const Visits = require('./companion-visits');

class Controller {
  constructor({ storage, characters, testMode = false, random = Math.random }) {
    this.storage = storage;
    this.characters = characters;
    this.ids = characters.map(c => c.id);
    this.random = random;
    this.testMode = testMode;
    this.state = storage.load();
    if (testMode && !this.state.starterChosen) Core.chooseStarter(this.state, this.ids[0], this.ids);
    this.screen = this.state.starterChosen ? 'home' : 'pets';
    this.time = 0;
    this.input = '';
    this.notice = null;
    this.modal = null;
    this.busy = null;
    this.action = { name: 'idle', start: 0 };
    this.nextIdle = 12000;
    this.autoNext = null;
    this.settingsGrade = this.state.grade ?? 2;
    this.reviewPage = 0;
    this.petPage = 0;
    this.reducedMotion = false;
    this.visits = Visits.create(this.time, this.random);
  }
  get character() { return this.characters.find(c => c.id === this.state.activePet) || this.characters[0]; }
  get pet() { return this.state.pets[this.state.activePet] || { level: 1, growth: 0 }; }
  get visualLevel() { return Core.visualLevel(this.busy?.previous ?? this.pet.level); }
  get stage() { return Math.floor((this.visualLevel - 1) / 5); }
  get question() { return this.state.round?.questions[this.state.round.index]; }
  get pointsLabel() { return this.testMode ? '∞ 积分' : this.state.points + ' 积分'; }
  get evolutionProgress() { return Evolution.describe(Core, this.pet, this.state.points, this.character, this.testMode); }
  get companionVisit() { return Visits.pose(this.visits, this, this.time); }
  cancelVisit() { this.visits = Visits.cancel(this.visits, this.time, this.random); }
  petName(pet = this.character) { return PetNames.display(pet, this.state.customPetNames); }
  renamePet(id, value) {
    const pet = this.characters.find(p => p.id === id);
    if (!pet?.custom || !this.state.unlockedPets[id]) return false;
    const name = PetNames.normalize(value);
    if (!name) { this.tell('名字请用 1—12 个字，不含换行或隐藏字符'); return false; }
    const before = this.state.customPetNames;
    this.state.customPetNames = { ...before, [id]: name };
    if (this.save() === false) {
      this.state.customPetNames = before;
      this.tell('名字未保存，请清理设备空间后重试'); return false;
    }
    this.tell('伙伴的新名字已保存'); return true;
  }
  transaction(run, minimum) {
    // Test credits are virtual. Keep a JSON-safe balance and the shared economy unchanged.
    const before = this.state.points;
    if (this.testMode) this.state.points = Math.max(before, minimum);
    try { return run(); } finally { if (this.testMode) this.state.points = before; }
  }
  save() { return this.storage.save(this.state); }
  tell(text, duration = 2200) { this.notice = { text, until: this.time + duration }; }
  play(name) { this.action = { name, start: this.time }; this.nextIdle = this.time + 10000 + this.random() * 8000; }
  tick(delta) {
    this.time += Math.max(0, Math.min(delta, 100));
    if (this.notice && this.time >= this.notice.until) this.notice = null;
    if (this.busy && this.time >= this.busy.until) {
      const result = this.busy;
      this.busy = null;
      this.play(result.leveled ? 'evolve' : 'idle');
      this.tell('喂养成功 · 成长 +' + result.growth);
      if (result.leveled) this.modal = { type: 'upgrade', ...result, start: this.time };
    }
    if (this.autoNext !== null && this.time >= this.autoNext) {
      this.autoNext = null;
      if (this.screen === 'quiz') this.advance();
    }
    this.visits = Visits.update(this.visits, this, this.time, this.random);
    if (this.screen !== 'home' || this.modal || this.busy) return;
    const def = this.character.actions[this.action.name] || this.character.actions.idle;
    if (this.action.name !== 'idle' && this.time - this.action.start > (def.durationMs || 2800)) this.play('idle');
    if (this.time >= this.nextIdle) this.play(Core.pick(this.character.idleActions, this.action.name, this.random));
  }
  home() {
    if (this.busy || !this.state.starterChosen) return;
    this.modal = null;
    this.screen = 'home';
    this.autoNext = null;
    this.play('idle');
    this.save();
  }
  open(screen) {
    if (this.busy || this.modal) return;
    this.cancelVisit();
    this.screen = screen;
    this.autoNext = null;
    this.notice = null;
    if (screen === 'settings') this.settingsGrade = this.state.grade ?? 2;
    if (screen === 'mistakes') this.reviewPage = 0;
    if (screen === 'pets') this.petPage = 0;
  }
  choose(id) {
    if (this.busy || this.modal || !this.ids.includes(id)) return;
    this.cancelVisit();
    const c = this.characters.find(c => c.id === id);
    const cost = c.unlock?.cost ?? Core.RULES.petUnlockCost[id];
    if (!this.state.starterChosen) {
      this.modal = { type: 'choose', id, title: '领养' + c.name, text: '首次免费领养一位伙伴，其他内置伙伴可用 200 积分兑换。生成的专属伙伴免费加入。' };
    } else if (Core.isPetUnlocked(this.state, id)) {
      Core.selectPet(this.state, id, this.ids);
      this.notice = null;
      this.home();
    } else if (c.custom) {
      Core.unlockPet(this.state, id, c); Core.selectPet(this.state, id, this.ids); this.home();
    } else if (!this.testMode && this.state.points < cost) {
      this.tell('还差 ' + (cost - this.state.points) + ' 积分，做题就能获得。');
    } else {
      this.modal = { type: 'unlock', id, title: '兑换' + c.name, text: '使用 ' + cost + ' 积分邀请这位伙伴，兑换后将切换到新伙伴。' };
    }
  }
  confirm() {
    const modal = this.modal;
    if (!modal) return;
    if (modal.type === 'upgrade') { this.modal = null; this.play('idle'); return; }
    const c = this.characters.find(c => c.id === modal.id);
    if (!c) return;
    if (modal.type === 'choose') { Core.chooseStarter(this.state, c.id, this.ids); this.studio?.register(); }
    if (modal.type === 'unlock') {
      const result = this.transaction(() => Core.unlockPet(this.state, c.id, c), c.unlock?.cost ?? Core.RULES.petUnlockCost[c.id]);
      if (result.status !== 'unlocked') { this.modal = null; return; }
      Core.selectPet(this.state, c.id, this.ids);
    }
    this.modal = null;
    this.home();
  }
  feed(ready = true) {
    if (this.screen !== 'home' || this.busy || this.modal) return;
    this.cancelVisit();
    if (!ready) return this.tell('伙伴还在准备中，请稍等。');
    const result = this.transaction(() => Core.feed(this.state, this.state.activePet, this.character), 20);
    if (result.status === 'insufficient') return this.tell('积分不足，答对两道题就能换一份食物。');
    if (result.status !== 'fed') return;
    this.busy = { ...result, until: this.time + 500 };
    this.notice = null;
    this.play('feed');
    this.save();
  }
  interact() {
    if (this.screen !== 'home' || this.busy || this.modal) return;
    const name = Core.pick(this.character.clickActions, this.action.name, this.random);
    this.play(name);
    this.tell(Core.pick(this.character.messages[name] || ['有你陪着，真开心。'], '', this.random));
  }
  configure(grade, topic) {
    if (!Questions.allowed(grade, topic)) return;
    const changed = grade !== this.state.grade || topic !== this.state.topic;
    this.state.grade = grade;
    this.state.topic = topic;
    if (changed) this.state.round = null;
    this.home();
    this.tell('练习范围已保存，准备好再开始做题');
  }
  startQuiz(newRound = false) {
    if (this.busy || this.modal || !this.state.starterChosen) return;
    this.cancelVisit();
    if (this.state.grade === null) { this.open('settings'); return; }
    if (newRound || !this.state.round || this.state.round.complete) Core.startRound(this.state, this.random);
    this.screen = 'quiz';
    this.input = this.question.response || '';
    this.notice = null;
    this.autoNext = this.question.status === 'correct' ? this.time + 400 : null;
    this.save();
  }
  key(value) {
    if (this.screen !== 'quiz' || this.modal || this.question?.status !== 'pending' || this.state.round?.complete) return;
    if (value === 'back') this.input = this.input.slice(0, -1);
    else if (value === 'clear') this.input = '';
    else if (/^[0-9./]$/.test(value) && this.input.length < 18) this.input += value;
  }
  submit() {
    if (this.screen !== 'quiz' || this.modal) return;
    const result = Core.submit(this.state, this.input);
    if (result.status === 'invalid') return this.tell('请输入数字、小数或分数，例如 0.5、1/2。');
    if (result.status === 'locked') return;
    if (result.status === 'correct') this.autoNext = this.time + 400;
    this.save();
  }
  advance() {
    if (this.screen !== 'quiz') return;
    Core.advance(this.state);
    this.autoNext = null;
    this.input = this.question?.response || '';
    this.save();
  }
  debug(command) {
    if (!this.testMode || this.busy || this.modal) return;
    if (command === 'points') this.state.points += 1000;
    else if (Number.isInteger(command) && command >= 1 && command <= 30) {
      this.cancelVisit();
      this.pet.level = command;
      this.pet.growth = Core.required(command) - 20;
      this.play('idle');
    }
    this.save();
  }
}
module.exports = Controller;
