(() => {
  MathPetCharacters.register({
    id:'siamese',name:'暹罗猫',portrait:'characters/siamese/assets/stage-1-portrait.png',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'椰香芒果饭',unit:'碗',icon:'🥭',title:'一碗椰香芒果饭',cost:20,growth:20},growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'蓝眼睛亮起来，一起寻找答案。',location:'兰纳花园 · 莲灯回廊',symbol:'暹',scene:'thai',style:'ornate',zoom:[1.2,1.2,1.2],
      palette:{background:'#f6f1fb',ink:'#493369',muted:'#8b79a0',primary:'#7c4dbc',primaryDark:'#563486',accent:'#28b9b2',surface:'#fffdf8',border:'#dfd0ed',sceneFrom:'#f2e8f7',sceneTo:'#dff4ef',sceneLine:'#d6aa4c',hill:'#38bcb32b',foodBackground:'#fff8e8',foodBorder:'#e6c675',foodInk:'#8f6522',radius:'24px'},
      decorate(slot){const garden=document.createElement('div');garden.className='thai-garden';garden.innerHTML='<i></i><i></i><b>✦</b><b>✧</b><span>❀</span><span>❀</span>';slot.append(garden);return ()=>garden.remove();}},
    stages:SiameseGameData.stages,effects:SiameseGameData.levels,
    clickActions:['pet','wave','think','jump','celebrate','skill'],idleActions:['think','wave','sleep','pet'],
    messages:{idle:['蓝眼睛看得清清楚楚，今天也一起进步。','莲花轻轻开，我正在等你来玩。'],pet:['再摸一下，我就把尾巴卷起来。','呼噜……你是我最喜欢的伙伴。'],wave:['萨瓦迪！抬起小爪问个好。','我在莲灯旁等你。'],jump:['轻轻一跃，金色花瓣也飞起来啦！','看，我比刚才更灵巧了。'],celebrate:['答对啦！莲花铃铛响起来。','我们的努力点亮了一盏莲灯！'],skill:['暹光亮起来，我来守护你。','看，这是我们一起点亮的王庭星河。'],think:['先观察，再一步一步找到答案。','歪歪头，也许会看到新办法。'],sleep:['尾巴卷好，做一个莲花梦。','呼……醒来继续陪你算。']},
    create({level}){const element=document.createElement('siamese-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');return {element,play:a=>element.play(a),setLevel:(n,o)=>element.setLevel(n,o),pause:v=>element.pause(v),get action(){return element.action;},on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};}
  });
})();
