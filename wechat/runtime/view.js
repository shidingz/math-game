'use strict';
const Core = require('../shared/core');
const Questions = require('../shared/questions');
const GrowthFX = require('./kingdom-scenes');
const Particles = require('./pet-particles');
const PetGeometry = require('./pet-geometry');
const Visits = require('./companion-visits');

class View {
  constructor(ctx, controller, assets) {
    this.ctx = ctx;
    this.game = controller;
    this.assets = assets;
    this.width = 390;
    this.height = 740;
    this.hits = [];
    this.portraits = new Map();
    this.media = new Map();
    this.atlas = null;
    this.atlasKey = '';
    this.loading = false;
    this.error = false;
    this.token = 0;
    this.effectCache = new Map();
    this.rewardState = new Map();
    this.guestAtlas = null;
    this.guestToken = 0;
    this.reducedMotion = false;
    for (const c of controller.characters) {
      if (c.custom) continue; // User-created portraits are loaded only on the visible page.
      assets.load(c.portrait).then(img => this.portraits.set(c.id, img)).catch(() => {});
    }
  }
  get palette() { return this.game.character.ui.palette; }
  get ready() { return !!this.atlas && !this.loading && !this.error; }
  syncAtlas(force = false) {
    const c = this.game.character, stage = c.stages[this.game.stage];
    const key = stage.png;
    if (key === this.atlasKey && !force) return;
    this.atlasKey = key;
    const token = ++this.token;
    this.atlas = null;
    this.loading = true;
    this.error = false;
    this.assets.releaseAtlases(key);
    (c.custom ? Promise.resolve() : this.assets.package(c.id)).then(() => this.assets.load(key)).then(img => {
      if (c.custom && (img.width !== c.atlas.width || img.height !== c.atlas.height)) throw Error('自定义图集尺寸不正确');
      if (token !== this.token) return;
      this.atlas = img;
      this.loading = false;
      this.assets.releaseAtlases(key);
    }).catch(() => {
      if (token !== this.token) return;
      this.loading = false;
      this.error = true;
    });
  }
  image(path) {
    if (!path) return null;
    if (!this.media.has(path)) {
      this.media.set(path, null);
      this.assets.load(path).then(img => { if (this.media.has(path)) this.media.set(path, img); }).catch(() => {});
      while (this.media.size > 20) this.media.delete(this.media.keys().next().value);
    }
    return this.media.get(path);
  }
  syncGuest() {
    const g=this.game,visit=g.companionVisit;
    const data=visit&&g.characters.find(c=>c.id===visit.id);
    const path=data?.stages[visit.stage]?.png;
    if(!path){
      if(this.guestAtlas){this.assets.images?.delete(this.guestAtlas.path);this.guestAtlas=null;this.guestToken++;}
      return;
    }
    const key=visit.id+':'+visit.stage+':'+path;
    if(this.guestAtlas?.key===key)return;
    if(this.guestAtlas)this.assets.images?.delete(this.guestAtlas.path);
    const token=++this.guestToken;
    this.guestAtlas={key,path,image:null};
    (data.custom?Promise.resolve():this.assets.package(data.id)).then(()=>token===this.guestToken?this.assets.load(path):null).then(image=>{
      const current=g.companionVisit;
      if(!image)return;
      if(token!==this.guestToken||!current||current.id!==visit.id||current.stage!==visit.stage){if(path!==this.atlasKey&&path!==this.guestAtlas?.path)this.assets.images?.delete(path);return;}
      this.guestAtlas.image=image;
    }).catch(()=>{});
  }
  petMotion(visit = null) {
    const g=this.game,data=g.character,actionName=visit?.hostAction||g.action.name;
    const action=data.actions[actionName]||data.actions.idle,duration=action.durationMs||2800;
    const elapsed=visit?.hostAction?(visit.actionPhase||0)*duration:Math.max(0,g.time-g.action.start);
    let frameIndex=action.frames[Math.min(action.frames.length-1,Math.floor(elapsed/duration*action.frames.length))];
    if(actionName==='idle')frameIndex=elapsed%4600>4400?1:0;
    if(actionName==='run')frameIndex=action.frames[Math.floor(elapsed/180)%action.frames.length];
    return {actionName,frameIndex,phase:Math.min(1,elapsed/duration)};
  }
  prepareCompanion(scene, area) {
    const g=this.game,visit=g.companionVisit;
    this.duetLayout=null;this.lastDuet=null;
    const data=visit&&g.characters.find(c=>c.id===visit.id),path=data?.stages[visit.stage]?.png;
    if(!visit||!data||!this.ready||this.guestAtlas?.path!==path||!this.guestAtlas.image){this.duetSession=null;return;}
    const key=visit.id+':'+visit.startedAt;
    if(this.duetSession?.key!==key)this.duetSession={key,readyAt:g.time};
    const blend=Math.min(Visits.smooth((g.time-this.duetSession.readyAt)/650),Visits.smooth(visit.enter));
    const motion=this.petMotion(visit),guestAction=data.actions[visit.action]||data.actions.idle;
    const phase=Math.max(0,Math.min(.999,visit.actionPhase||0));
    const index=guestAction.frames[Math.min(guestAction.frames.length-1,Math.floor(phase*guestAction.frames.length))];
    const normal=PetGeometry.fit(g.character,g.stage,motion.frameIndex,area,g.visualLevel,motion.actionName,motion.phase,g.time,this.reducedMotion);
    const idle=PetGeometry.fit(g.character,g.stage,0,area,g.visualLevel,'idle',0,g.time,true).bounds;
    const requested=visit.interaction==='hop'?'jump':visit.interaction==='curious'?'think':'wave';
    const ratio=(pet,stage)=>Math.max(...['idle',requested].flatMap(name=>(pet.actions[name]||pet.actions.idle).frames).map(i=>{const b=pet.stages[stage].bounds[i];return b.width/b.height;}));
    const pair=Visits.pairLayout({scene,normal,hostBounds:g.character.stages[g.stage].bounds[motion.frameIndex],guestBounds:data.stages[visit.stage].bounds[index],blend,side:visit.side,hop:visit.interaction==='hop'?Math.sin(phase*Math.PI):0,referenceHeight:idle.bottom-idle.top,hostRatio:ratio(g.character,g.stage),guestRatio:ratio(data,visit.stage)});
    this.duetLayout={...pair,visit,motion,guestData:data,guestIndex:index,path};
    this.lastDuet={blend,commonHeight:pair.commonHeight,host:pair.host.bounds,guest:pair.guest.bounds};
  }
  companion(scene) {
    const duet=this.duetLayout;if(!duet)return;
    const {visit,guestData:data,guestIndex:index,path}=duet,frame=data.frames[index],p=duet.guest;
    const c=this.ctx;c.save();c.globalAlpha=duet.opacity;c.translate(p.x,p.foot);c.rotate(p.rotation);
    c.drawImage(this.guestAtlas.image,frame.x,frame.y,frame.width,frame.height,-p.pivotX*p.scale,-p.pivotY*p.scale,frame.width*p.scale,frame.height*p.scale);c.restore();
    this.lastCompanion={id:visit.id,level:visit.level,stage:visit.stage,action:visit.action,bounds:p.bounds,path,blend:duet.blend};
  }
  portrait(pet, x, y, size) {
    const img = this.portraits.get(pet.id) || this.image(pet.portrait);
    if (!img) return;
    if (pet.portraitAtlas) this.ctx.drawImage(img, 0, 0, pet.frames[0].width, pet.frames[0].height, x, y, size, size);
    else this.ctx.drawImage(img, x, y, size, size);
  }
  text(value, x, y, size = 16, color = this.palette.ink, align = 'left', weight = 400) {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = `${weight} ${size}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillText(String(value), x, y);
  }
  wrap(value, x, y, maxWidth, size = 15, color = this.palette.muted, lineHeight = 24, align = 'left') {
    let line = '', row = 0;
    this.text('', x, y, size, color, align);
    for (const char of String(value)) {
      if (this.ctx.measureText(line + char).width > maxWidth || char === '\n') {
        this.text(line, x, y + row++ * lineHeight, size, color, align);
        line = char === '\n' ? '' : char;
      } else line += char;
    }
    if (line) this.text(line, x, y + row++ * lineHeight, size, color, align);
    return row * lineHeight;
  }
  petName(pet, x, y, size, width, color = this.palette.ink) {
    const name = this.game.petName(pet);
    this.text('', x, y, size, color, 'center', 700);
    const fitted = Math.min(size, size * width / Math.max(1, this.ctx.measureText(name).width));
    this.text(name, x, y, fitted, color, 'center', 700);
    return this.ctx.measureText(name).width;
  }
  box(x, y, w, h, fill, radius = 18, stroke) {
    const c = this.ctx, r = Math.min(radius, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  hit(id, x, y, w, h, action) { this.hits.push({ id, x, y, w, h, action }); }
  button(id, label, x, y, w, h, action, primary = false, disabled = false) {
    const p = this.palette;
    this.box(x, y, w, h, disabled ? '#e2e7eb' : primary ? p.primary : '#ffffff', 16, primary ? null : p.border);
    this.text(label, x + w / 2, y + h / 2, 15, disabled ? '#8c99a2' : primary ? '#ffffff' : p.ink, 'center', 600);
    if (!disabled) this.hit(id, x, y, w, h, action);
  }
  star(x, y, r, color, rotate = 0, points = 5) {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = i * Math.PI / points - Math.PI / 2 + rotate;
      const radius = i % 2 ? r * .44 : r;
      const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); c.fillStyle = color; c.fill();
  }
  effectProfile() {
    const g=this.game,key=g.character.id+':'+g.character.revision+':'+g.stage;
    if(!this.effectCache.has(key)){const base=GrowthFX.profile(g.character,0);this.effectCache.set(key,{...GrowthFX.profile(g.character,g.stage),characterId:g.character.id,custom:!!g.character.custom,baseHue:base.hue,baseNeutral:base.neutral});if(this.effectCache.size>48)this.effectCache.delete(this.effectCache.keys().next().value);}
    return this.effectCache.get(key);
  }
  effects(x, foot, height, full = false, width = 350, front = false) {
    const g=this.game,id=g.character.id;
    let reward=this.rewardState.get(id);
    if(!reward){reward={feeds:g.pet.feeds||0,level:g.pet.level,start:-1};this.rewardState.set(id,reward);}
    if(!g.busy&&((g.pet.feeds||0)!==reward.feeds||g.pet.level!==reward.level)){
      reward.start=(g.pet.feeds>reward.feeds||g.pet.level>reward.level)?g.time:-1;
      reward.feeds=g.pet.feeds||0;reward.level=g.pet.level;
    }
    const upgrade=full&&g.modal?.type==='upgrade'?g.modal:null;
    const result=Particles.draw(this.ctx,this.effectProfile(),{x,foot,width,height,level:g.visualLevel,time:g.time,full,front,reducedMotion:this.reducedMotion,burstAge:upgrade?g.time-upgrade.start:reward.start<0?-1:g.time-reward.start,evolved:!!upgrade?.evolved,getImage:path=>this.image(path)});
    if(!front)this.lastEffectRecipe=result;
    else this.lastEffectRecipe={...result,sprites:result.sprites+(this.lastEffectRecipe?.sprites||0),burstCount:result.burstCount+(this.lastEffectRecipe?.burstCount||0)};
  }
  pet(x, top, width, height, full = false, presentation = {}) {
    const g = this.game, c = this.ctx, data = g.character;
    if (!this.ready) {
      const portrait = this.portraits.get(data.id);
      if (portrait) { c.save(); c.globalAlpha = .45; c.drawImage(portrait, x - 65, top + height / 2 - 80, 130, 130); c.restore(); }
      this.text(this.error ? '素材加载失败，点击重试' : '伙伴正在赶来…', x, top + height / 2 + 70, 14, full ? '#c2cddf' : this.palette.muted, 'center');
      if (this.error) this.hit('retry', x - width / 2, top, width, height, () => this.syncAtlas(true));
      return;
    }
    const duet=!full?this.duetLayout:null;
    const {actionName,frameIndex,phase}=duet?.motion||this.petMotion();
    const frame = data.frames[frameIndex];
    const placement=duet?.host||PetGeometry.fit(data,g.stage,frameIndex,{x,top,width,height,...presentation},g.visualLevel,actionName,phase,g.time,this.reducedMotion);
    this.lastPetPlacement=placement;
    const foot=placement.foot,baseHeight=height*.9*(presentation.growthScale??PetGeometry.growthScale(g.visualLevel));
    const blend=duet?.blend||0;
    const effectX=duet?(placement.bounds.left+placement.bounds.right)/2:x;
    const effectFoot=(top+height-8)*(1-blend)+(placement.bounds.bottom+6)*blend;
    const effectHeight=baseHeight*(1-blend)+(duet?.commonHeight||baseHeight)*1.08*blend;
    const effectWidth=width*(1-blend)+(duet?.slotWidth||width)*blend;
    this.effects(effectX,effectFoot,effectHeight,full,effectWidth);
    c.save();c.translate(placement.x,foot);c.rotate(placement.rotation);
    c.drawImage(this.atlas,frame.x,frame.y,frame.width,frame.height,
      -placement.pivotX*placement.scale,-placement.pivotY*placement.scale,
      frame.width*placement.scale,frame.height*placement.scale);
    c.restore();
    this.effects(effectX,effectFoot,effectHeight,full,effectWidth,true);
    if (g.action.name === 'feed') {
      if (data.aligned && !data.food.embedded) {
        const food = this.image(data.food.image), size = Math.min(48, width * .13);
        if (food) c.drawImage(food, x + size * .15, foot - size * .65, size, size);
      }
      this.star(x + width * .19, foot - baseHeight * .45, 11, '#ffbd66', phase * 2);
    }
    if (g.action.name === 'think') this.text('?', x + width * .23, placement.bounds.top + 18, 25, this.palette.primary, 'center', 700);
    if (g.action.name === 'sleep') this.text('z z', x + width * .20, placement.bounds.top + 15, 20, this.palette.muted);
  }
  pageHeader(title, subtitle) {
    const g = this.game;
    if (g.state.starterChosen) this.button('back', '‹ 返回', 20, 16, 78, 38, () => g.home());
    this.text(title, 20, 88, 26, this.palette.ink, 'left', 700);
    if (subtitle) this.text(subtitle, 20, 117, 13, this.palette.muted);
  }
  home() {
    const g=this.game,s=g.state,p=this.palette,h=this.height,L=PetGeometry.home(h,g.character),off=L.offset;
    this.lastHomeLayout=L;
    this.text('算算萌宠',18,23+off,20,p.ink,'left',750);
    this.box(280,7+off,92,34,'#fff6dc',16);
    this.text(g.pointsLabel,326,24+off,14,'#9d6c24','center',700);
    const grade=Questions.GRADES[s.grade];
    this.button('settings',grade?grade.name+' · 练习范围':'选择年级与范围',16,49+off,224,52,()=>g.open('settings'));
    this.button('pets','换伙伴',250,49+off,124,52,()=>g.open('pets'));
    const nameWidth=this.petName(g.character,195,125+off,24,276);
    if(g.character.custom){
      const c=this.ctx,px=195+nameWidth/2+12;
      c.save();c.strokeStyle=p.muted;c.lineWidth=1.6;c.beginPath();c.moveTo(px-3,129+off);c.lineTo(px-2,125+off);c.lineTo(px+5,118+off);c.lineTo(px+8,121+off);c.lineTo(px+1,128+off);c.closePath();c.stroke();c.restore();
      if(!g.busy)this.hit('rename',45,107+off,300,40,()=>g.requestRename?.());
    }
    this.text('Lv.'+(g.busy?.previous??g.pet.level),195,150+off,13,p.primary,'center',600);
    const r=L.scene;
    this.prepareCompanion(r,L.pet);
    this.box(r.x,r.y,r.width,r.height,this.effectProfile().sky,26);
    this.ctx.save();this.ctx.clip();
    this.lastWorldRecipe=GrowthFX.backdrop(this.ctx,this.effectProfile(),r.x,r.y,r.width,r.height,g.visualLevel,g.time,this.reducedMotion,path=>this.image(path));
    this.companion(r);
    this.pet(L.pet.x,L.pet.top,L.pet.width,L.pet.height);
    this.ctx.restore();
    if(this.ready)this.hit('pet',r.x,r.y,r.width,r.height,()=>g.interact());
    const visitor=this.duetLayout?.visit,visitorData=visitor&&g.characters.find(c=>c.id===visitor.id);
    const notice=g.notice?.text||(g.busy?'正在享用'+g.character.food.name+'…':visitorData?g.petName(visitorData)+'来打招呼啦':'轻轻点一下，和伙伴打个招呼');
    this.text(notice,195,L.noticeY,notice.length>23?11:12,g.notice?p.primary:p.muted,'center');
    this.box(16,L.growthY,358,L.growthHeight,'#ffffff',16);
    this.text('成长进度',29,L.growthY+18,13,p.muted);
    this.text(g.pet.growth+' / '+Core.required(g.pet.level),360,L.growthY+18,13,p.ink,'right',600);
    this.box(29,L.growthY+34,332,8,p.border,3);
    const ratio=Math.min(1,g.pet.growth/Core.required(g.pet.level));
    if(ratio)this.box(29,L.growthY+34,332*ratio,8,p.primary,3);
    const evolution=g.evolutionProgress;
    this.lastEvolutionProgress=evolution;
    evolution.milestones.forEach((m,i)=>{
      const x=92+i*176;
      this.text((m.complete?'✓ ':'')+'Lv.'+m.level+' · '+(m.level===6?30:100)+'题',x,L.growthY+51,12,m.complete?p.primary:p.muted,'center',600);
    });
    this.text(g.busy?'正在喂养，完成后更新进化进度':evolution.message,195,L.growthY+69,12,p.primary,'center',600);
    this.text(evolution.note,195,L.growthY+86,11,p.muted,'center');
    const y=L.buttonsY;
    this.box(16,y,174,L.buttonHeight,p.foodBackground,17,p.foodBorder);
    this.text(g.busy?'享用中…':'喂养伙伴',103,y+23,19,p.foodInk,'center',700);
    this.text(g.testMode?'不限积分 · 成长 +20':'20 积分 · 成长 +20',103,y+46,12,p.foodInk,'center');
    if(!g.busy)this.hit('feed',16,y,174,L.buttonHeight,()=>g.feed(this.ready));
    this.box(200,y,174,L.buttonHeight,p.primary,17);
    this.text(s.round&&!s.round.complete?'继续做题':'开始做题',287,y+23,19,'#ffffff','center',700);
    this.text('每题答对 +10 积分',287,y+46,12,'#ffffff','center');
    if(!g.busy)this.hit('quiz',200,y,174,L.buttonHeight,()=>g.startQuiz());
    this.box(16,L.footerY,174,L.footerHeight,'#ffffff',14,p.border);
    this.text('错题回顾 '+s.mistakes.length,103,L.footerY+18,13,p.muted,'center');
    this.hit('mistakes',16,L.footerY,174,L.footerHeight,()=>g.open('mistakes'));
    this.box(200,L.footerY,174,L.footerHeight,'#ffffff',14,p.border);
    this.text(g.testMode?'测试工具':'成长指南',287,L.footerY+18,13,p.muted,'center');
    this.hit('guide',200,L.footerY,174,L.footerHeight,()=>g.open(g.testMode?'debug':'guide'));
  }
  pets() {
    const g = this.game, h = this.height, starter = !g.state.starterChosen;
    this.pageHeader(starter ? '选一位初始伙伴' : '我的萌宠伙伴', starter ? '首次免费任选一位，陪你一起开始。' : '每只伙伴独立成长，可多次制作专属宠物');
    if (!starter && g.studio) this.button('studio', '＋ 拍照 / 上传，制作新伙伴', 20, 140, 350, 42, () => g.open('studio'), true);
    const pets = starter ? g.characters.filter(p => !p.custom) : g.characters;
    const pages = Math.max(1, Math.ceil(pets.length / 8));
    g.petPage = Math.min(g.petPage, pages - 1);
    const top = starter ? 143 : 194, cellHeight = Math.min(120, (h - top - 70) / 4), gap = 7;
    pets.slice(g.petPage * 8, g.petPage * 8 + 8).forEach((pet, i) => {
      const x = 20 + i % 2 * 180, y = top + Math.floor(i / 2) * (cellHeight + gap);
      const owned = Core.isPetUnlocked(g.state, pet.id), selected = owned && g.state.activePet === pet.id;
      this.box(x, y, 170, cellHeight, selected ? this.palette.sceneFrom : '#ffffff', 16, selected ? this.palette.primary : this.palette.border);
      const size = Math.min(70, cellHeight - 38);
      this.portrait(pet, x + (170 - size) / 2, y + 2, size);
      this.petName(pet, x + 85, y + cellHeight - 27, 14, 148);
      this.text(starter ? '免费领养' : selected ? '正在陪伴' : owned ? 'Lv.' + g.state.pets[pet.id].level + ' · 点击切换' : pet.custom ? '免费选择' : '200 积分兑换', x + 85, y + cellHeight - 10, 11, this.palette.primary, 'center');
      this.hit('choose-' + pet.id, x, y, 170, cellHeight, () => g.choose(pet.id));
    });
    if (pages > 1) {
      this.button('pets-prev', '上一页', 20, h - 42, 92, 34, () => g.petPage--, false, g.petPage === 0);
      this.text((g.petPage + 1) + ' / ' + pages, 195, h - 25, 14, this.palette.muted, 'center');
      this.button('pets-next', '下一页', 278, h - 42, 92, 34, () => g.petPage++, false, g.petPage === pages - 1);
    }
  }
  studio() {
    const g = this.game, studio = g.studio;
    this.pageHeader('制作专属伙伴', '同一宠物选1—3张照片，每次制作新增一只伙伴');
    if (studio.localPacks.length) this.button('local-pets-add', '加入本地伙伴', 244, 16, 126, 36, () => studio.addLocal());
    const busy = studio.working;
    this.button('photo-camera', '拍一张', 20, 143, 170, 42, () => studio.choose('camera'), false, busy);
    this.button('photo-album', '从相册选择', 200, 143, 170, 42, () => studio.choose('album'), false, busy);
    studio.selected.forEach((path, i) => { const image = this.image(path); if (image) this.ctx.drawImage(image, 35 + i * 110, 200, 96, 86); });
    if (!studio.selected.length) this.text('拍下你想一起冒险的伙伴', 195, 240, 15, this.palette.muted, 'center');
    this.button('photo-submit', busy ? '正在处理…' : studio.service.enabled ? '上传照片并开始制作' : '保存照片，等待服务开放', 20, 301, 350, 44, () => studio.submit(), true, busy || !studio.selected.length);
    this.text(studio.service.enabled ? '制作可能需要一段时间，完成后自动加入伙伴列表' : '生成服务尚未开放；照片仅保存在本机', 195, 365, 12, this.palette.muted, 'center');
    if (studio.service.enabled) this.button('jobs-refresh', studio.refreshing ? '刷新中' : '刷新进度', 270, 385, 100, 32, () => studio.refresh(), false, studio.refreshing);
    this.text('我的制作记录', 22, 402, 18, this.palette.ink, 'left', 600);
    const pages = Math.max(1, Math.ceil(studio.jobs.length / 3)); studio.page = Math.min(studio.page, pages - 1);
    const names = { draft: '等待提交', uploading: '上传待完成', submitting: '提交待确认', queued: '等待制作', processing: '正在制作', ready: '制作完成', failed: '制作失败' };
    studio.jobs.slice(studio.page * 3, studio.page * 3 + 3).forEach((job, i) => {
      const y = 428 + i * 59, pet = g.characters.find(c => c.id === job.petId);
      this.box(20, y, 350, 53, '#ffffff', 12, this.palette.border);
      if(pet)this.petName(pet,147,y+16,13,226);
      else this.text('新伙伴 · '+job.requestId.slice(-6),31,y+16,13,this.palette.ink);
      this.text(job.error ? '暂未完成，请稍后重试' : names[job.status], 31, y + 36, 11, this.palette.muted);
      if (job.status === 'ready' && pet) this.button('job-open-' + job.requestId, '去陪伴', 282, y + 8, 78, 36, () => { g.home(); g.choose(pet.id); });
      else if (job.status === 'draft' && !studio.service.enabled) this.button('job-delete-' + job.requestId, '删除记录', 282, y + 8, 78, 36, () => studio.removeDraft(job), false, busy);
      else if (['draft','uploading','submitting'].includes(job.status)) this.button('job-retry-' + job.requestId, '继续提交', 282, y + 8, 78, 36, () => studio.retry(job), false, busy || studio.refreshing || !studio.service.enabled);
    });
    if (!studio.jobs.length) this.text('还没有制作记录', 195, 462, 14, this.palette.muted, 'center');
    if (pages > 1) {
      this.button('jobs-prev', '上一页', 20, 613, 92, 32, () => studio.page--, false, studio.page === 0);
      this.text((studio.page + 1) + ' / ' + pages, 195, 629, 13, this.palette.muted, 'center');
      this.button('jobs-next', '下一页', 278, 613, 92, 32, () => studio.page++, false, studio.page === pages - 1);
    }
  }
  settings() {
    const g = this.game;
    this.pageHeader('今天练点什么？', '选择范围后回到主页，准备好再开始。');
    Object.entries(Questions.GRADES).forEach(([id, grade], i) => {
      const n = Number(id);
      this.button('grade-' + id, grade.name, 20 + i % 4 * 89, 148 + Math.floor(i / 4) * 54, 83, 44,
        () => { g.settingsGrade = n; }, n === g.settingsGrade);
    });
    const grade = Questions.GRADES[g.settingsGrade];
    this.text('练习范围', 22, 280, 18, this.palette.ink, 'left', 600);
    const topics = { balanced: '均衡练习 · 各类题目搭配', ...grade.topics };
    Object.entries(topics).forEach(([id, title], i) => {
      this.button('topic-' + id, title, 20, 308 + i * 60, 350, 49, () => g.configure(g.settingsGrade, id), id === g.state.topic && g.settingsGrade === g.state.grade);
    });
    this.text('切换范围保留宠物与积分，下一次做题使用新范围。', 195, this.height - 25, 12, this.palette.muted, 'center');
  }
  quiz() {
    const g = this.game, s = g.state, r = s.round, q = g.question, h = this.height, p = this.palette;
    this.button('back', '‹ 休息一下', 20, 16, 108, 38, () => g.home());
    this.text(g.pointsLabel, 367, 35, 16, p.primary, 'right', 700);
    if (r.complete) {
      this.star(195, 160, 42, '#f3b84c');
      this.text('这一轮完成啦！', 195, 240, 28, p.ink, 'center', 700);
      const correct = r.questions.filter(q => q.status === 'correct').length;
      this.text('答对 ' + correct + ' / 10 题', 195, 291, 20, p.primary, 'center', 600);
      this.text('本轮获得 ' + correct * 10 + ' 积分', 195, 330, 16, p.muted, 'center');
      this.wrap(correct === 10 ? '全对！快把这份进步分享给你的萌宠吧。' : '错题已收好，下次练习会陪你再想一想。', 195, 383, 305, 16, p.muted, 26, 'center');
      this.button('round-home', '回家喂养伙伴', 30, h - 153, 330, 53, () => g.home(), true);
      this.button('new-round', '再练 10 题', 30, h - 86, 330, 49, () => g.startQuiz(true));
      return;
    }
    this.text(Questions.GRADES[r.grade].name + '  ·  ' + (q.review ? '错题再练' : '口算练习'), 20, 91, 17, p.ink, 'left', 600);
    this.text((r.index + 1) + ' / 10', 365, 91, 15, p.muted, 'right');
    for (let i = 0; i < 10; i++) this.box(20 + i * 35.5, 114, 30, 5,
      r.questions[i].status === 'correct' ? p.primary : r.questions[i].status === 'wrong' ? '#e7a17f' : p.border, 3);
    if (q.visual?.kind === 'count') {
      this.text('数一数，有几颗星星？', 195, 161, 22, p.ink, 'center', 600);
      for (let i = 0; i < q.visual.count; i++) this.star(99 + i % 5 * 48, 211 + Math.floor(i / 5) * 37, 13, '#e9b048');
    } else this.wrap(q.expression + ' = ?', 195, 199, 340, q.expression.length > 20 ? 24 : 31, p.ink, 41, 'center');
    this.box(30, 275, 330, 59, '#ffffff', 16, q.status === 'wrong' ? '#dfa084' : p.primary);
    this.text(g.input || (q.format === 'fraction' ? '输入分数，如 1/2' : '输入你的答案'), 195, 305, g.input.length > 12 ? 21 : 27, g.input ? p.ink : '#a1adb6', 'center', 500);
    if (q.status !== 'pending') {
      const correct = q.status === 'correct';
      this.box(25, 357, 340, 151, correct ? '#e9f5ee' : '#fff1e8', 20);
      this.text(correct ? '答对啦！ +10 积分' : '再想一想，答案是 ' + q.answerText, 195, 389, 20, correct ? '#398768' : '#b5754b', 'center', 650);
      if (correct) this.text('马上进入下一题…', 195, 437, 15, p.muted, 'center');
      else this.wrap(q.explanation, 45, 428, 300, 15, '#8f6b57', 24);
      if (!correct) this.button('next', r.index === 9 ? '查看本轮结果' : '记住了，下一题', 25, h - 84, 340, 55, () => g.advance(), true);
      return;
    }
    const keyTop = h - 292, keyHeight = 45, keyGap = 8;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '/'];
    keys.forEach((key, i) => this.button('key-' + key, key, 25 + i % 3 * 115, keyTop + Math.floor(i / 3) * (keyHeight + keyGap), 110, keyHeight, () => g.key(key)));
    this.button('clear', '清空', 25, h - 70, 76, 48, () => g.key('clear'));
    this.button('backspace', '退格', 109, h - 70, 76, 48, () => g.key('back'));
    this.button('submit', '确认答案', 193, h - 70, 172, 48, () => g.submit(), true);
  }
  mistakes() {
    const g = this.game, list = [...g.state.mistakes].reverse(), pages = Math.max(1, Math.ceil(list.length / 3));
    this.pageHeader('错题小笔记', '保留最近 30 道错题，同范围练习会自动复习。');
    if (!list.length) {
      this.star(195, 240, 36, '#e7bd6a');
      this.text('这里还没有错题', 195, 318, 22, this.palette.ink, 'center', 600);
      this.text('认真练习，每一步都算进步。', 195, 355, 15, this.palette.muted, 'center');
    }
    const size = Math.min(145, (this.height - 224) / 3);
    list.slice(g.reviewPage * 3, g.reviewPage * 3 + 3).forEach((m, i) => {
      const y = 145 + i * (size + 10);
      this.box(20, y, 350, size, '#ffffff', 18);
      this.text(Questions.GRADES[m.grade].name, 35, y + 21, 12, this.palette.muted);
      this.wrap(m.question.expression + ' = ' + m.question.answerText, 35, y + 52, 316, 18, this.palette.ink, 25);
      this.wrap('你的答案：' + m.question.response, 35, y + size - 28, 315, 13, '#a47458', 20);
    });
    if (list.length) {
      this.button('review-prev', '上一页', 20, this.height - 62, 105, 42, () => g.reviewPage--, false, g.reviewPage === 0);
      this.text((g.reviewPage + 1) + ' / ' + pages, 195, this.height - 41, 14, this.palette.muted, 'center');
      this.button('review-next', '下一页', 265, this.height - 62, 105, 42, () => g.reviewPage++, false, g.reviewPage >= pages - 1);
    }
  }
  guide() {
    this.pageHeader('陪伴与成长', '每天一点进步，和伙伴慢慢长大。');
    const rows = [
      ['答题赚积分', '每轮 10 题，答对一题 +10 积分。答错会显示答案，确认后继续。'],
      ['自由喂养', '20 积分换一份食物，增加 20 成长值。喂养和做题可以分别进行。'],
      ['遇见新伙伴', '初始伙伴免费任选一位，其余内置伙伴每位200积分。生成的专属伙伴免费加入并显示在前，每只独立成长。'],
      ['三阶段进化', '从零累计答对30题的积分用于喂养可到Lv.6，100题可到Lv.11。Lv.11已达终极形态，此后不再进化，仍可继续成长。'],
      ['进度保存在本机', '微信与网页版存档独立。清理小游戏数据或更换设备不会自动恢复进度。']
    ];
    let y = 154;
    for (const [title, text] of rows) {
      this.text(title, 26, y, 17, this.palette.primary, 'left', 650);
      const used = this.wrap(text, 26, y + 29, 335, 14, this.palette.muted, 22);
      y += used + 53;
    }
  }
  debug() {
    const g = this.game;
    this.pageHeader('测试工具', '测试存档独立，正式发布包不开放此入口。');
    this.button('debug-points', '无限积分已开启 · 自由喂养', 20, 153, 350, 50, () => g.tell('测试版积分不限量，喂养不扣分'), true);
    [1, 5, 6, 10, 11, 14, 15, 16].forEach((lv, i) => {
      this.button('debug-level-' + lv, 'Lv.' + lv, 20 + i % 4 * 89, 231 + Math.floor(i / 4) * 61, 83, 49, () => g.debug(lv));
    });
    this.wrap('设置等级后，喂养一次即可升到下一级。可以检查 6 / 11 级进化和 15 级之后的成长。', 25, 391, 335, 16, this.palette.muted, 28);
    this.text('当前积分：无限', 25, 494, 16, this.palette.primary);
    this.text('当前等级：Lv.' + g.pet.level, 25, 527, 16, this.palette.primary);
  }
  modal() {
    const g = this.game, m = g.modal, h = this.height;
    this.hits = [];
    this.ctx.fillStyle = m.type === 'upgrade' ? '#101c2c' : 'rgba(24,35,48,.45)';
    this.ctx.fillRect(0, 0, 390, h);
    if (m.type === 'upgrade') {
      this.text(m.evolved ? '新的模样，新的成长' : '又长大了一点', 195, 77, 25, '#ffffff', 'center', 700);
      this.text('Lv.' + m.previous + '  →  Lv.' + m.level, 195, 123, 26, '#f1d58c', 'center', 650);
      this.pet(195, 165, 360, h - 357, true);
      this.petName(g.character,195,h-155,22,320,'#ffffff');
      this.text(g.character.levels[g.visualLevel - 1].name, 195, h - 121, 15, '#b9cfe0', 'center');
      this.button('upgrade-close', '继续陪伴', 70, h - 82, 250, 51, () => g.confirm(), true);
      return;
    }
    const y = h / 2 - 143;
    this.box(27, y, 336, 286, '#ffffff', 26);
    this.text(m.title, 195, y + 44, 23, this.palette.ink, 'center', 700);
    this.wrap(m.text, 53, y + 91, 284, 16, this.palette.muted, 28);
    this.button('cancel', '再看看', 48, y + 213, 139, 48, () => { g.modal = null; });
    this.button('confirm', m.type === 'choose' ? '免费领养' : '确认兑换', 201, y + 213, 139, 48, () => g.confirm(), true);
  }
  render() {
    const c = this.ctx, g = this.game;
    this.lastCompanion=null;
    this.duetLayout=null;this.lastDuet=null;
    g.reducedMotion=this.reducedMotion;
    this.syncGuest();
    this.hits = [];
    c.fillStyle = this.palette.background;
    c.fillRect(0, 0, 390, this.height);
    if (g.state.starterChosen && (g.screen === 'home' || g.modal?.type === 'upgrade')) this.syncAtlas();
    const screens = ['home', 'pets', 'settings', 'quiz', 'mistakes', 'guide', 'debug', 'studio'];
    // The full-screen upgrade is opaque: avoid drawing a hidden second scene
    // and duplicate particle pass underneath it on mobile.
    if (screens.includes(g.screen) && g.modal?.type !== 'upgrade') this[g.screen]();
    if (g.modal) this.modal();
    if (g.notice && g.screen !== 'home' && !g.modal) {
      this.box(20, this.height - 122, 350, 51, '#2e4554', 16);
      this.wrap(g.notice.text, 195, this.height - 105, 325, 13, '#ffffff', 19, 'center');
    }
    if (g.storage.warning) {
      this.box(8, 0, 374, 47, '#fff1d5', 10);
      this.wrap(g.storage.warning, 18, 12, 354, 12, '#9a641d', 18);
    }
    if (g.testMode && g.screen !== 'home') this.text('测试版', 354, 66, 11, '#b56234', 'right');
  }
  touch(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hit = this.hits[i];
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) { hit.action(); return hit.id; }
    }
    return null;
  }
}
module.exports = View;
