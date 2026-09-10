/* Jingwei owns her art, food and seaside theme; shared game rules stay independent. */
(() => {
  'use strict';
  MathPetCharacters.register({
    id:'jingwei',name:'精卫',portrait:'characters/jingwei/assets/stage-1-portrait.png',
    unlock:{cost:500,description:'使用 500 积分兑换'},
    food:{name:'蓝莓饭团',unit:'个',icon:'🫐',iconImage:'characters/jingwei/assets/berry-riceball.png',title:'一口饭团，一起筑起小岛',cost:20,growth:20},
    growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'一起算，把小小努力筑成岛。',location:'东海 · 海风小岛',symbol:'羽',scene:'sea',style:'ornate',zoom:[1.35,1.13,1.02],
      palette:{background:'#f0f8fb',ink:'#294b61',muted:'#708e9f',primary:'#238caf',primaryDark:'#1b708f',accent:'#e88e96',surface:'#ffffff',border:'#d5e9ef',sceneFrom:'#edfaff',sceneTo:'#ccecef',sceneLine:'#9cd5e1',hill:'#8bcad855',foodBackground:'#fff5f5',foodBorder:'#edc4ca',foodInk:'#a95b6b',radius:'24px'},
      decorate(slot){const sea=document.createElement('div');sea.className='sea-garden';sea.innerHTML='<i class="sea-wave"></i><i class="sea-wave"></i><span class="sea-islet"></span><span class="sea-islet"></span><b>✧</b><b>✦</b><b>✧</b>';slot.append(sea);return ()=>sea.remove();}},
    stages:JingweiGameData.stages,effects:JingweiGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep','skill'],
    messages:{
      idle:['一块石头，一点进步。我们一起筑起小岛吧！','海风来啦，今天也一起做题攒饭团。'],
      pet:['羽毛被摸得蓬蓬的啦。','有你陪着，海风都变温柔了。'],
      wave:['我在海边等你，一起出发吧！','今天的小进步，也值得开心。'],
      jump:['轻轻一跃，让海风托住我！','伸展羽翼，精神满满！'],
      celebrate:['又进步啦，我们的小岛更近了一点！','送你一朵浪花，为努力的你喝彩！'],
      skill:['看，小石子也能筑成一座岛！','海风听令，把石头送到小岛上！'],
      think:['一块一块来，一步一步算。','慢慢想，我会一直陪着你。'],
      sleep:['听着海浪，眯一小会儿……','歇歇羽翼，等会儿再出发。']
    },
    create({level}){
      const element=document.createElement('jingwei-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');
      return {element,play:action=>element.play(action),setLevel:(n,options)=>element.setLevel(n,options),pause:value=>element.pause(value),get action(){return element.action;},
        on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};
    }
  });
})();
