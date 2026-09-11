/* Siamese visual contract; economy and unlimited saved levels live in game/core.js. */
(() => {
  const frames=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
  const stages=[
    {id:1,name:'暹罗幼猫',minLevel:1,maxLevel:5,scale:.78,color:'#32b9b4',tag:'呆萌 · 好奇'},
    {id:2,name:'兰纳灵猫',minLevel:6,maxLevel:10,scale:.94,color:'#8b55c7',tag:'聪慧 · 灵巧'},
    {id:3,name:'暹光守护者',minLevel:11,maxLevel:15,scale:1.08,color:'#d49a29',tag:'优雅 · 守护'}
  ];
  const names=['莲铃初响','暹星微光','金叶轻舞','泰丝流辉','三重莲印','兰纳觉醒','孔雀宝晶','水灯星河','宝石回廊','金殿窗影','暹光觉醒','九宝莲台','兰纳金翼','泰丝天幕','暹罗王庭'];
  const descriptions=['莲铃旁亮起柔和金光。','六枚青蓝星点环绕身旁。','金色叶片从脚边轻轻升起。','紫蓝泰丝光带沿两侧流动。','脚下展开三层莲花印记。','进化时点亮兰纳拱门与金色顶饰。','青玉、红宝石与蓝宝石依次闪耀。','小水灯与星河围绕身体漂流。','宝石节点连接成精致回廊。','泰式宫殿窗影与金色光柱显现。','十二瓣暹光莲阵完全觉醒。','九枚宝石组成守护莲台。','三层兰纳火焰金翼向两侧展开。','青绿与皇家紫泰丝极光覆盖天空。','莲台、金翼、宝石、王庭拱门与星河共同闪耀。'];
  const levels=names.map((name,i)=>({level:i+1,stage:Math.floor(i/5)+1,name,effect:'siamese-thai-'+(i+1),description:descriptions[i],scale:stages[Math.floor(i/5)].scale*(1+i%5*.035),stageGrowth:1+i%5*.035}));
  const a=(label,frames,durationMs,loop=false)=>({label,frames,durationMs,loop});
  const actions={idle:a('安静观察',[0,1],null,true),wave:a('抬爪问候',[2,0,2],1400),pet:a('开心蹭手',[3],1500),feed:a('吃椰香芒果饭',[4],500),think:a('歪头思考',[5],2100),comfort:a('贴心陪伴',[3,2],1700),celebrate:a('轻盈庆祝',[2,7,2],1500),jump:a('灵巧跃起',[7],1000),sleep:a('卷尾小憩',[6],null,true),run:{...a('优雅小跑',[0,7],null,true),frameMs:210},skill:a('暹光守护',[8],2400),evolve:a('兰纳进化',[8,2],3000)};
  const clampLevel=v=>Math.max(1,Math.min(15,Math.round(Number(v)||1)));
  function frameAt(name,elapsed,reduced=false){const action=actions[name];if(!action)throw new RangeError('未知动作');if(reduced)return action.frames[0];if(name==='idle')return elapsed%4600>4400?1:0;if(name==='run')return action.frames[Math.floor(Math.max(0,elapsed)/action.frameMs)%action.frames.length];if(action.durationMs===null)return action.frames[0];return action.frames[Math.min(action.frames.length-1,Math.floor(Math.max(0,elapsed)/action.durationMs*action.frames.length))];}
  const choose=(pool,last,random=Math.random)=>{const next=pool.filter(x=>x!==last),p=next.length?next:pool;return p[Math.min(p.length-1,Math.floor(Math.max(0,random())*p.length))];};
  window.SiameseGameData={characterId:'siamese',name:'暹罗猫',frames,stages,levels,actions,clampLevel,frameAt,choose,interactionPool:['pet','wave','think','jump','celebrate','skill'],idlePool:['think','wave','pet'],idleDelayMs:[10000,18000]};
})();
