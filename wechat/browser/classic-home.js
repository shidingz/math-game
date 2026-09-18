'use strict';
const Core = require('../shared/core');
const Questions = require('../shared/questions');
// The original website's DOM cards around the existing game/controller/service.
// Only the pet scene is a canvas at home; dialogs reuse the tested Canvas flows.
function installClassicHome(app, api, env = window) {
  const { game:g, view:v, canvas }=app, doc=env.document, $=id=>doc.getElementById(id);
  const slot=$('scene-slot'), dialog=$('game-dialog'), panel=$('dialog-canvas-slot'), originalRender=v.render.bind(v);
  let mode='',paletteKey='',listKey='',lastFocus=null,lastResize='',lastDom='';
  const text=(id,value)=>{const node=$(id);if(node.textContent!==String(value))node.textContent=String(value);};
  const home=()=>g.state.starterChosen&&g.screen==='home'&&!g.modal;
  api.getCanvasLayout=info=>{const width=info.windowWidth,height=info.windowHeight;
    if(mode==='scene')return {scale:width/390,left:0,top:0,height:height/(width/390)};
    const scale=mode==='upgrade'?Math.min(width/390,(height-24)/660):width/390;
    return {scale,left:(width-390*scale)/2,top:mode==='upgrade'?12:0,height:mode==='upgrade'?Math.min(920,(height-24)/scale):height/scale};
  };
  api.transparentCanvas=()=>mode==='scene';
  function navigate(screen){if(!g.busy&&!g.modal)g.open(screen);}
  $('pets-open').onclick=()=>navigate('pets');$('settings-open').onclick=()=>navigate('settings');
  $('mistakes-open').onclick=()=>navigate('mistakes');$('guide-open').onclick=()=>navigate('guide');$('debug-open').onclick=()=>navigate('debug');
  $('start').onclick=()=>{if(!g.busy&&!g.modal)g.startQuiz();};$('feed').onclick=()=>{if(!g.modal)g.feed(v.ready);};
  $('pet-name').onclick=()=>{if(g.character.custom&&!g.busy&&!g.modal)g.requestRename?.();};
  $('pet-select').onchange=event=>{if(!g.busy&&!g.modal)g.choose(event.target.value);};
  canvas.addEventListener('keydown',event=>{if(home()&&(event.key==='Enter'||event.key===' ')){event.preventDefault();g.interact();}});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(g.modal?.type==='upgrade')g.modal=null;else if(g.modal)g.modal=null;else if(g.state.starterChosen)g.home();});
  api.beforeRender=()=>{
    const next=home()?'scene':g.modal?.type==='upgrade'?'upgrade':'panel';
    if(next!==mode){
      if(mode==='scene')lastFocus=doc.activeElement;
      mode=next;
      if(mode==='scene'){slot.insertBefore(canvas,$('feed-notice'));dialog.close();doc.body.style.overflow='';lastFocus?.focus?.({preventScroll:true});}
      else {panel.append(canvas);dialog.dataset.upgrade=String(mode==='upgrade');if(!dialog.open)dialog.showModal();doc.body.style.overflow='hidden';dialog.scrollTop=0;canvas.focus({preventScroll:true});}
      lastResize='';
    }
    if(mode==='panel'){
      const height=Math.max(660,Math.min(800,(env.innerHeight-30)/(panel.clientWidth/390)))*(panel.clientWidth/390);
      dialog.style.setProperty('--panel-height',height+'px');
    }
    const box=canvas.getBoundingClientRect(),geometry=mode+':'+box.width+':'+box.height;
    if(geometry!==lastResize){lastResize=geometry;app.resize();}
    updateDom();
  };
  function updateDom(){
    const c=g.character,p=c.ui.palette,stage=c.stages[g.stage];
    const palette=c.id+':'+g.stage;
    if(palette!==paletteKey){paletteKey=palette;for(const [name,value]of Object.entries(p))doc.documentElement.style.setProperty('--pet-'+name,value);
      // Imported pets retain algorithmic colors without introducing scene art.
      if(c.custom&&c.procedural?.colors){const colors=c.procedural.colors;doc.documentElement.style.setProperty('--pet-sceneFrom',colors.sky);doc.documentElement.style.setProperty('--pet-sceneTo',colors.ground);}
      doc.documentElement.dataset.scene=c.custom?'starlight':c.ui.scene||'forest';doc.documentElement.dataset.uiStyle=c.ui.style||'soft';
      text('brand-symbol',c.custom?'萌':c.ui.symbol||'萌');text('home-title',c.ui.title||'一起算，一起长大。');text('scene-label',c.custom?'伙伴的小天地':c.ui.location||'伙伴的小天地');
      doc.querySelector('meta[name="theme-color"]').content=p.background;
    }
    const options=g.characters.map(c=>c.id+':'+g.petName(c)+':'+!!g.state.unlockedPets[c.id]).join('|');
    if(listKey!==options){listKey=options;$('pet-select').replaceChildren(...g.characters.map(c=>{const option=doc.createElement('option');option.value=c.id;option.textContent=g.petName(c)+(g.state.unlockedPets[c.id]?'':' · 200积分');option.disabled=!g.state.unlockedPets[c.id];return option;}));}
    $('pet-select').value=g.state.activePet;
    const notice=g.notice?.text||(g.busy?'正在享用…':g.companionVisit?g.petName(g.characters.find(c=>c.id===g.companionVisit.id))+'来打招呼啦':'');
    const key=JSON.stringify([g.state.activePet,g.pet.level,g.pet.growth,g.state.points,g.busy?.previous,!!g.busy,g.state.grade,g.state.topic,g.petName(c),g.state.round?.index,g.state.round?.complete,g.state.totalSolved,g.state.mistakes.length,notice,v.ready,g.storage.warning]);
    if(lastDom===key)return;lastDom=key;
    text('points',g.testMode?'∞':g.state.points);text('pet-name',g.petName(c));$('pet-name').disabled=!c.custom||!!g.busy;$('rename-hint').hidden=!c.custom;
    text('stage-name',c.custom?'':stage.name+(stage.tag?' · '+stage.tag:''));text('level','Lv.'+(g.busy?.previous??g.pet.level));
    const grade=Questions.GRADES[g.state.grade];text('grade-button',grade?.name||'选择年级');text('grade-caption',(grade?.name?grade.name+' · ':'')+'每天进步一点点');text('mode-label',grade?grade.name+'综合练习':'按年级出题');
    text('growth-value',g.pet.growth+' / '+Core.required(g.pet.level));$('growth-bar').max=Core.required(g.pet.level);$('growth-bar').value=g.pet.growth;
    const evolution=g.evolutionProgress;v.lastEvolutionProgress=evolution;text('evolution-milestones',evolution.milestones.map(m=>(m.complete?'✓ ':'')+'Lv.'+m.level+' · '+(m.level===6?30:100)+'题').join('　'));
    text('evolution-hint',evolution.message);text('evolution-note',evolution.note);
    text('feed-label',g.busy?'享用中…':'喂养伙伴');text('feed-cost',g.testMode?'成长 +20':'20 积分');$('feed').disabled=!!g.busy||!v.ready;
    text('start',g.state.round&&!g.state.round.complete?'继续做题 →':'开始做题 →');$('start').disabled=!!g.busy;
    $('pet-select').disabled=!!g.busy;$('settings-open').disabled=!!g.busy;$('pets-open').disabled=!!g.busy;
    text('speech',c.messages?.idle?.[0]||'今天也想和你一起进步。');text('feed-notice',notice);$('feed-notice').hidden=!notice;
    text('total-solved','已完成 '+g.state.totalSolved+' 道题');text('save-status',g.storage.warning||(g.testMode?'测试进度独立保存 · 不影响正式版':'进度自动保存在这台设备'));text('mistakes-open','错题回顾 '+g.state.mistakes.length);$('debug-open').hidden=!g.testMode;
  }
  v.render=()=>{
    if(mode!=='scene')return originalRender();
    v.lastCompanion=null;v.duetLayout=null;v.lastDuet=null;g.reducedMotion=v.reducedMotion;v.syncGuest();v.syncAtlas();v.hits=[];
    const r={x:0,y:0,width:390,height:v.height};
    const grow=.90+.10*Math.pow(Math.min(1,(g.visualLevel-1)/14),.85);
    const area={x:195,top:8,width:370,height:v.height-30,growthScale:grow,camera:'stage'};
    v.lastHomeLayout={scene:r,pet:area};v.prepareCompanion(r,area);v.companion(r);v.pet(area.x,area.top,area.width,area.height,false,{growthScale:grow,camera:'stage'});
    if(v.ready)v.hit('pet',0,0,390,v.height,()=>g.interact());
  };
  api.beforeRender();
  return {isHome:home};
}
module.exports={installClassicHome};
