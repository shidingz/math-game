(() => {
  MathPetCharacters.register({
    id:'samoyed',name:'萨摩耶',portrait:'characters/samoyed/assets/stage-1-portrait.png',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'酸奶雪团',unit:'碗',icon:'🥣',title:'一碗酸奶雪团',cost:20,growth:20},growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'一起想一想，每天进步一点。',location:'极光雪原 · 星雪书屋',symbol:'雪',scene:'snow',style:'soft',zoom:[1.2,1.2,1.2],
      palette:{background:'#eef4fc',ink:'#293d65',muted:'#7283a2',primary:'#507cda',primaryDark:'#355bad',accent:'#79c8ef',surface:'#ffffff',border:'#cfddf2',sceneFrom:'#deeafb',sceneTo:'#ccddf4',sceneLine:'#98b6df',hill:'#a2bce84d',foodBackground:'#edf3ff',foodBorder:'#c1d3f1',foodInk:'#4564a1',radius:'24px'}},
    stages:SamoyedGameData.stages,effects:SamoyedGameData.levels,
    clickActions:['pet','wave','think','jump','celebrate','skill'],idleActions:['think','wave','sleep','pet'],
    messages:{idle:['扶好眼镜，今天也要一起进步！','我看起来呆呆的，脑袋里可有好多点子。'],pet:['软乎乎的脑袋，给你摸摸。','蹭一下，你是我最好的伙伴！'],wave:['举爪！你的小学霸来了。','汪，我在这里陪你想。'],jump:['像小雪球一样蹦起来！','精神满满，再试一次吧。'],celebrate:['算出来啦！我们的努力闪闪发光。','汪！又学会了新本领。'],skill:['看！我们一起点亮的星雪领域。','扶好眼镜，让智慧发光！'],think:['扶一扶眼镜，换个办法想想。','先看清数字，再一步一步算。'],sleep:['呼……梦里也有软软的雪。','眯一小会儿，醒来再陪你。']},
    create({level}){const element=document.createElement('samoyed-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');return {element,play:a=>element.play(a),setLevel:(n,o)=>element.setLevel(n,o),pause:v=>element.pause(v),get action(){return element.action;},on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};}
  });
})();
