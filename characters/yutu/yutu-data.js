/* Standalone character data. No game state, rewards, storage or network calls. */
(() => {
  'use strict';
  const frames = ['idle','blink','wave-a','wave-b','pet-a','pet-b','feed-a','feed-b','think','comfort','celebrate','jump','sleep','run-a','run-b','skill'];
  const stages = [
    {id:1,name:'月宫幼兔',minLevel:1,maxLevel:5,scale:.70,color:'#5cbfb9',tag:'乖巧 · 好奇'},
    {id:2,name:'桂香灵兔',minLevel:6,maxLevel:10,scale:.85,color:'#538bc7',tag:'灵动 · 聪慧'},
    {id:3,name:'月光玉兔',minLevel:11,maxLevel:15,scale:1,color:'#7272ce',tag:'沉静 · 守护'}
  ];
  const effects = [
    ['月尘初醒','moon-dust','月白星点在身旁轻轻闪烁。'],
    ['桂香微光','osmanthus','青玉桂叶与小桂花绕身飘落。'],
    ['新月足迹','moon-ring','脚边亮起一圈细细的月光。'],
    ['玉叶旋风','jade-leaves','两道青玉叶影轻轻盘旋。'],
    ['月芽绽放','crescent-bloom','小月牙与桂花在脚边绽开。'],
    ['灵兔觉醒','spirit-awake','进化为桂香灵兔，双重月环展开。'],
    ['桂枝流萤','fireflies','桂花与青色流萤沿身旁巡游。'],
    ['玉杵星芒','pestle-glint','玉杵边闪出蓝白星芒。'],
    ['月华绸带','moon-silk','蓝紫月华如绸带环绕。'],
    ['桂庭月阵','garden-array','桂花环和月纹在脚下交相辉映。'],
    ['望月守护','guardian','进化为月光玉兔，身后展开守护月弧。'],
    ['银辉流星','silver-meteor','银蓝流星划过月弧。'],
    ['月桂结界','laurel-shield','青玉月桂组成轻盈的守护结界。'],
    ['三月共鸣','moon-resonance','三道蓝紫月环交错共鸣。'],
    ['广寒星河','moon-galaxy','月弧、桂花、星河与玉叶一同展开。']
  ];
  const levels = effects.map(([name,effect,description],i) => ({
    level:i+1,stage:Math.floor(i/5)+1,name,effect,description,
    scale:+(stages[Math.floor(i/5)].scale*(1+(i%5)*.025)).toFixed(3),
    stageGrowth:+(1+(i%5)*.025).toFixed(3)
  }));
  const actions = {
    idle:{label:'待机',frames:[0],durationMs:null,loop:true},
    wave:{label:'挥手',frames:[2,3,2,3],durationMs:1800,loop:false},
    pet:{label:'摸摸头',frames:[4,5,4,5],durationMs:1800,loop:false},
    feed:{label:'吃桂花糕',frames:[6,6,7,7,6,7],durationMs:1600,loop:false},
    think:{label:'思考',frames:[8],durationMs:2800,loop:false},
    comfort:{label:'鼓励',frames:[9],durationMs:2200,loop:false},
    celebrate:{label:'庆祝',frames:[10,11,10],durationMs:1800,loop:false},
    jump:{label:'跳跃',frames:[11],durationMs:1100,loop:false},
    sleep:{label:'小憩',frames:[12],durationMs:null,loop:true},
    run:{label:'跑动',frames:[13,14],durationMs:null,loop:true,frameMs:200},
    skill:{label:'本领展示',frames:[15],durationMs:3000,loop:false},
    evolve:{label:'进化',frames:[15,10],durationMs:3000,loop:false}
  };
  function clampLevel(value) { const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(15,Math.round(n))):1; }
  function frameAt(action,elapsed,reduced=false) {
    const a=actions[action];if(!a)throw new RangeError('未知动作：'+action);
    if(reduced)return a.frames[0];
    if(action==='idle')return elapsed%4700>=4500?1:0;
    if(action==='run')return a.frames[Math.floor(elapsed/a.frameMs)%a.frames.length];
    if(a.durationMs===null)return a.frames[0];
    return a.frames[Math.min(a.frames.length-1,Math.floor(Math.max(0,elapsed)/a.durationMs*a.frames.length))];
  }
  function choose(pool,last,random=Math.random) {
    const available=pool.filter(x=>x!==last);
    return available[Math.min(available.length-1,Math.floor(Math.max(0,random())*available.length))];
  }
  const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
  window.YutuGameData=deepFreeze({version:'1.0.0',characterId:'yutu',name:'玉兔',frames,stages,levels,actions,
    food:{id:'osmanthus-cake',name:'桂花糕',icon:'assets/osmanthus-cake.png',bittenIcon:'assets/osmanthus-cake-bitten.png'},
    cell:{width:512,height:640,pivotX:256,pivotY:588},
    interactionPool:['wave','pet','jump','celebrate','skill'],idlePool:['think','wave','pet','skill'],
    idleDelayMs:[10000,18000],clampLevel,frameAt,choose});
})();
