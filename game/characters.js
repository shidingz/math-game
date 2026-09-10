/* Register each character here. Economy, quiz and persistence never depend on its art. */
(() => {
  'use strict';
  const entries=new Map();
  window.MathPetCharacters={
    register(config){if(!config.id||entries.has(config.id)||typeof config.create!=='function')throw Error('角色配置不完整或 ID 重复');entries.set(config.id,Object.freeze(config));},
    get(id){return entries.get(id);},list(){return [...entries.values()];}
  };
  MathPetCharacters.register({
    id:'wukong',name:'孙悟空',food:{name:'桃子',unit:'颗',icon:'🍑',title:'一颗甜桃，长大一点',cost:20,growth:20},
    growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'一起算，一起长大。',location:'花果山 · 翠林小居',symbol:'悟',scene:'forest',style:'soft',zoom:[1.6,1.25,1.08],
      palette:{background:'#f3f8f5',ink:'#293e3b',muted:'#7c9690',primary:'#398c75',primaryDark:'#28715e',accent:'#70b79a',surface:'#ffffff',border:'#dce9e0',sceneFrom:'#eff9f0',sceneTo:'#e3f2ec',sceneLine:'#c5e0cd',hill:'#c4dfce80',foodBackground:'#fff5f0',foodBorder:'#e9baa7',foodInk:'#b66e50',radius:'24px'}},
    stages:WukongGameData.stages,effects:WukongGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep'],
    messages:{idle:['一起做题，攒桃子吧！','今天也想和你一起进步。'],pet:['嘿嘿，有点痒！','有你陪着，真开心。'],wave:['嗨，伙伴！','我在这儿呢！'],jump:['看我跳得高不高！','活动一下，更有精神。'],celebrate:['我们真是好搭档！','击个掌，继续加油！'],skill:['看，我的新本领！','一起成长，一起变强。'],think:['下一道题，咱们一起想。','嗯……桃子要怎么分呢？'],sleep:['眯一小会儿……','休息一下，再一起出发。']},
    create({level}){
      const element=document.createElement('wukong-game-pet');element.setAttribute('level',level);element.setInteractionLabel('孙悟空，点击或按回车，随机互动');
      return {
        element,play:action=>element.play(action),setLevel:(n,options)=>element.setLevel(n,options),pause:value=>element.pause(value),
        get action(){return element.action;},
        on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},
        destroy(){element.remove();}
      };
    }
  });
})();
