(() => {
  MathPetCharacters.register({
    id:'corgi',name:'柯基犬',portrait:'characters/corgi/assets/stage-1-portrait.png?v=police2',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'鸡肉能量餐',unit:'份',icon:'🍗',title:'一份鸡肉能量餐',cost:20,growth:20},growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'开动脑筋，和汪队一起出发。',location:'蓝盾巡逻站 · 伙伴营地',symbol:'汪',scene:'cloud',style:'soft',zoom:[1.2,1.2,1.2],
      palette:{background:'#eef4fb',ink:'#233d62',muted:'#7185a1',primary:'#367ed1',primaryDark:'#245591',accent:'#42b7d9',surface:'#ffffff',border:'#c7d9ef',sceneFrom:'#dfebf9',sceneTo:'#c9e3f4',sceneLine:'#80add9',hill:'#559cd233',foodBackground:'#edf5ff',foodBorder:'#a9c9ec',foodInk:'#326797',radius:'24px'}},
    stages:CorgiGameData.stages,effects:CorgiGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep','pet'],
    messages:{idle:['小警员报到！今天一起进步吧。','汪队准备好了，等你出发！'],pet:['蹭蹭你的手，今天也要陪着你。','执勤再帅，也喜欢被摸摸头！'],wave:['举爪敬礼，伙伴你好！','汪！随时为你加油。'],jump:['短腿也能精神满满！','跳一下，准备出发！'],celebrate:['任务完成！又学会一题。','你的进步，值得一枚小勋章！'],skill:['蓝盾展开，守护你的每一点进步。','汪队长就位，一起迎接新挑战！'],think:['发现数字线索，仔细想一想。','不用着急，我们一起算。'],sleep:['巡逻结束，眯一小会儿。','呼……梦里也在陪你冒险。']},
    create({level}){const element=document.createElement('corgi-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');
      return {element,play:a=>element.play(a),setLevel:(n,o)=>element.setLevel(n,o),pause:v=>element.pause(v),get action(){return element.action;},on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};}
  });
})();
