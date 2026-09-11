/* Yutu owns its art, food and moon theme; quiz/economy stay character-independent. */
(() => {
  'use strict';
  MathPetCharacters.register({
    id:'yutu',name:'玉兔',portrait:'characters/yutu/assets/stage-1-portrait.png',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'桂花糕',unit:'块',icon:'🌼',iconImage:'characters/yutu/assets/osmanthus-cake.png',title:'一块桂花糕，长大一点',cost:20,growth:20},
    growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'一起算，月光伴你长大。',location:'广寒宫 · 月桂小庭',symbol:'月',scene:'moon',style:'ornate',zoom:[1.35,1.13,1.02],
      palette:{background:'#f3f4fc',ink:'#343958',muted:'#7b81a0',primary:'#646acb',primaryDark:'#4f53ad',accent:'#67c9c5',surface:'#ffffff',border:'#dfe2f3',sceneFrom:'#edf0fc',sceneTo:'#daeef1',sceneLine:'#b4cadf',hill:'#b2c5e366',foodBackground:'#f0edfc',foodBorder:'#ccc2ee',foodInk:'#6760a2',radius:'24px'},
      decorate(slot){const stars=document.createElement('div');stars.className='moon-garden';stars.innerHTML='<span>✦</span><span>✧</span><span>✦</span><span>✧</span><i></i><i></i>';slot.append(stars);return ()=>stars.remove();}},
    stages:YutuGameData.stages,effects:YutuGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep'],
    messages:{idle:['桂花开啦，一起做题攒桂花糕吧！','月光陪着我们，每天进步一点点。'],pet:['耳朵痒痒的，嘿嘿。','摸摸头，心情亮起来啦。'],wave:['我在月桂树下等你！','今天也一起加油呀。'],jump:['轻轻一跃，追上月光！','伸伸腿，再来一道题。'],celebrate:['你又进步啦！','让桂花为你开一朵！'],skill:['看我的月光守护！','这束月光，送给努力的你。'],think:['慢慢想，我陪着你。','桂花糕怎么分才刚刚好呢？'],sleep:['在月光里眯一会儿……','歇一歇，再一起出发。']},
    create({level}){
      const element=document.createElement('yutu-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');
      return {element,play:action=>element.play(action),setLevel:(n,options)=>element.setLevel(n,options),pause:value=>element.pause(value),get action(){return element.action;},
        on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};
    }
  });
})();
