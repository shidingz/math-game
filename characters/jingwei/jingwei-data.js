/* Standalone character data. No game state, rewards, storage or network calls. */
(() => {
  'use strict';
  const frames = ['idle','blink','wave-a','wave-b','pet-a','pet-b','feed-a','feed-b','think','comfort','celebrate','jump','sleep','run-a','run-b','skill'];
  const stages = [
    {id:1,name:'衔石幼鸟',minLevel:1,maxLevel:5,scale:.70,color:'#63c9c9',tag:'软萌 · 好奇'},
    {id:2,name:'筑岛伙伴',minLevel:6,maxLevel:10,scale:.85,color:'#3796c5',tag:'灵动 · 坚韧'},
    {id:3,name:'海风精卫',minLevel:11,maxLevel:15,scale:1,color:'#287fb6',tag:'英气 · 守护'}
  ];
  const effects = [
  [
    "潮光初遇",
    "tide-spark",
    "几滴水珠在身旁轻轻闪烁。"
  ],
  [
    "拾石微芒",
    "pebble-glint",
    "一颗发光的小石子在脚边浮起。"
  ],
  [
    "涟漪足迹",
    "ripple-trail",
    "脚边泛起两圈清亮涟漪。"
  ],
  [
    "青羽轻风",
    "feather-breeze",
    "青色羽影随微风缓缓飘动。"
  ],
  [
    "小岛萌芽",
    "island-sprout",
    "小石岛上长出嫩芽，水珠环绕。"
  ],
  [
    "筑岛觉醒",
    "island-awake",
    "进化为筑岛伙伴，海风托起三颗石子。"
  ],
  [
    "珊瑚流光",
    "coral-trail",
    "珊瑚色流光与青蓝水珠交织。"
  ],
  [
    "叠石成礁",
    "stacked-reef",
    "三颗小石叠成岛礁，浪花在脚下展开。"
  ],
  [
    "羽风回旋",
    "wing-spiral",
    "两道羽风围绕身侧回旋。"
  ],
  [
    "碧海石阵",
    "sea-array",
    "五颗石子在海蓝风环中排列。"
  ],
  [
    "海风守护",
    "sea-guardian",
    "进化为海风精卫，身后展开海风双翼。"
  ],
  [
    "逐浪星芒",
    "surf-stars",
    "浪尖闪出银白星芒，飞石沿风前进。"
  ],
  [
    "群岛之约",
    "island-chain",
    "三座小岛在脚边连成弧线。"
  ],
  [
    "长风共鸣",
    "wind-resonance",
    "三道青蓝风环与珊瑚流光交错。"
  ],
  [
    "沧海新生",
    "ocean-renewal",
    "羽风、群岛、飞石与浪花一同展开。"
  ]
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
    feed:{label:'吃蓝莓饭团',frames:[6,6,7,7,6,7],durationMs:1600,loop:false},
    think:{label:'思考',frames:[8],durationMs:2800,loop:false},
    comfort:{label:'鼓励',frames:[9],durationMs:2200,loop:false},
    celebrate:{label:'庆祝',frames:[10,11,10],durationMs:1800,loop:false},
    jump:{label:'轻跃展翼',frames:[11],durationMs:1100,loop:false},
    sleep:{label:'小憩',frames:[12],durationMs:null,loop:true},
    run:{label:'跑动',frames:[13,14],durationMs:null,loop:true,frameMs:200},
    skill:{label:'衔石筑岛',frames:[15],durationMs:3000,loop:false},
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
  window.JingweiGameData=deepFreeze({version:'1.0.0',characterId:'jingwei',name:'精卫',frames,stages,levels,actions,
    food:{id:'berry-riceball',name:'蓝莓饭团',icon:'assets/berry-riceball.png',bittenIcon:'assets/berry-riceball-bitten.png'},
    cell:{width:512,height:640,pivotX:256,pivotY:588},
    interactionPool:['wave','pet','jump','celebrate','skill'],idlePool:['think','wave','pet','skill'],
    idleDelayMs:[10000,18000],clampLevel,frameAt,choose});
})();
