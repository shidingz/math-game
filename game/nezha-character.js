/* Nezha's presentation adapter; the shared game owns rewards and idle timing. */
(() => {
  'use strict';
  MathPetCharacters.register({
    id:'nezha',name:'哪吒',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'莲花酥',unit:'块',icon:'🪷',iconImage:'characters/nezha/assets/lotus-pastry.png',title:'一块莲花酥，长大一点',cost:20,growth:20},
    growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'一起算，一起变强。',location:'陈塘关 · 莲风小院',symbol:'哪',scene:'lotus',style:'ornate',zoom:[1.45,1.2,1.04],
      palette:{background:'#faf4f7',ink:'#403442',muted:'#947789',primary:'#c84e6b',primaryDark:'#a53855',accent:'#e87e94',surface:'#ffffff',border:'#eedee5',sceneFrom:'#f9edf3',sceneTo:'#e5f4f1',sceneLine:'#c4e3dc',hill:'#a7d7cc70',foodBackground:'#fff0f4',foodBorder:'#e4adbd',foodInk:'#a83e5c',radius:'24px'}},
    stages:NezhaGameData.stages,effects:NezhaGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep'],
    messages:{idle:['一起做题，攒莲花酥吧！','准备好了，我们一起出发！'],pet:['嘿，有点痒！','有你陪着，真开心。'],wave:['伙伴，我在这儿！','今天也一起加油！'],jump:['看我的轻功！','活动一下，再来一道。'],celebrate:['好搭档，击个掌！','我们又进步了一点！'],skill:['看我的乾坤圈！','一起学本领，一起变强。'],think:['这道题，咱们一起想。','莲花酥怎么分才公平呢？'],sleep:['歇一小会儿……','养足精神，再一起出发。']},
    create({level}){
      const element=document.createElement('nezha-game-pet');element.setAttribute('level',level);
      // Only PetInteraction schedules automatic actions inside the game.
      element.setAttribute('auto-idle','false');
      return {
        element,play:action=>element.play(action),setLevel:(n,options)=>element.setLevel(n,options),pause:value=>element.pause(value),
        get action(){return element.action;},
        on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},
        destroy(){element.remove();}
      };
    }
  });
})();
