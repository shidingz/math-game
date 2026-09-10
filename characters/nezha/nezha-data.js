/* Standalone character data. No game state, rewards, storage or network calls. */
(() => {
  'use strict';
  const frames = ['idle','blink','wave-a','wave-b','pet-a','pet-b','feed-a','feed-b','think','comfort','celebrate','jump','sleep','run-a','run-b','skill'];
  const stages = [
    {id:1,name:'莲花童子',minLevel:1,maxLevel:5,scale:.72,color:'#eb6685',tag:'机灵 · 好奇'},
    {id:2,name:'风火行者',minLevel:6,maxLevel:10,scale:.85,color:'#f2654f',tag:'轻快 · 勇敢'},
    {id:3,name:'莲光英雄',minLevel:11,maxLevel:15,scale:1,color:'#d94353',tag:'英气 · 守护'}
  ];
  const effects = [
    ['莲芽星点','spark','少量粉金星点，初次唤醒莲花灵气。'],
    ['莲瓣轻舞','petal','粉色莲瓣缓缓绕身飘动。'],
    ['乾坤初光','ring','脚边出现一圈轻盈的金色圆环。'],
    ['赤绫微风','ribbon','两道短红绫流光回应互动。'],
    ['莲心绽放','lotus','脚下绽开小莲花，幼年成长完成。'],
    ['风火初燃','wheel','进入少年形态，脚下点亮双轮火花。'],
    ['混天流绫','silk','更长的赤绫光带交错环绕。'],
    ['乾坤双环','double-ring','两道金红光环交错旋转。'],
    ['火尖星芒','spear-glint','火尖枪方向划过赤金星芒。'],
    ['双轮巡焰','wheel-orbit','双轮周围增加巡游火星。'],
    ['莲台觉醒','lotus-platform','进入英雄形态，脚下展开青玉莲台。'],
    ['赤焰流星','meteor','赤金流星从身旁掠过。'],
    ['莲光护盾','shield','莲瓣组成半透明守护结界。'],
    ['乾坤共鸣','resonance','三层乾坤光环产生共鸣。'],
    ['莲焰星阵','final-array','莲台、双轮、金环与星点共同展开。']
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
    feed:{label:'吃莲花酥',frames:[6,6,7,7,6,7],durationMs:1600,loop:false},
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
  window.NezhaGameData=deepFreeze({version:'1.0.0',characterId:'nezha',name:'哪吒',frames,stages,levels,actions,
    food:{id:'lotus-pastry',name:'莲花酥',icon:'assets/lotus-pastry.png',bittenIcon:'assets/lotus-pastry-bitten.png'},
    cell:{width:512,height:640,pivotX:256,pivotY:588},
    interactionPool:['wave','pet','jump','celebrate','skill'],idlePool:['think','wave','pet','skill'],
    idleDelayMs:[10000,18000],clampLevel,frameAt,choose});
})();
