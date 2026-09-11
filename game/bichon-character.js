(() => {
  MathPetCharacters.register({
    id:'bichon',name:'比熊犬',portrait:'characters/bichon/assets/stage-1-portrait.png',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'云朵鸡肉丸',unit:'份',icon:'🍗',title:'一份云朵鸡肉丸',cost:20,growth:20},growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'和云朵一起，每天长大一点。',location:'晴空花园 · 云朵小窝',symbol:'云',scene:'cloud',style:'soft',zoom:[1.2,1.2,1.2],
      palette:{background:'#eff7ff',ink:'#294d7b',muted:'#6986a6',primary:'#418bdd',primaryDark:'#2863ac',accent:'#42bdd4',surface:'#ffffff',border:'#c9e0f5',sceneFrom:'#dcedff',sceneTo:'#c5e6f6',sceneLine:'#7eb7e7',hill:'#78c9e53d',foodBackground:'#f0f9ff',foodBorder:'#aad5ed',foodInk:'#337eaa',radius:'24px'}},
    stages:BichonGameData.stages,effects:BichonGameData.levels,
    clickActions:['pet','wave','think','jump','celebrate','skill'],idleActions:['think','wave','sleep','pet'],
    messages:{idle:['今天的云朵，好像我的毛毛呀。','摇摇尾巴，等你一起来玩！'],pet:['摸摸圆脑袋，烦恼飘走啦。','蹭一下，你是我最好的伙伴！'],wave:['举爪！你的云朵伙伴到啦。','汪，我在这里陪你想。'],jump:['轻轻一跳，摸到云朵啦！','小爪子充满力气！'],celebrate:['算出来啦！我们的努力闪闪发光。','汪！又学会了新本领。'],skill:['云翼展开，守护你的每一点进步。','这片晴空，是我们一起点亮的！'],think:['歪歪脑袋，慢慢想一想。','先看清数字，再一步一步算。'],sleep:['卷成一朵云，眯一小会儿。','呼……梦里也要陪着你。']},
    create({level}){const element=document.createElement('bichon-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');return {element,play:a=>element.play(a),setLevel:(n,o)=>element.setLevel(n,o),pause:v=>element.pause(v),get action(){return element.action;},on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};}
  });
})();
