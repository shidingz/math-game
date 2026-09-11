/* Bichon visual contract; economy and unlimited saved levels live in game/core.js. */
(() => {
  const frames=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
  const stages=[
    {id:1,name:'棉绒幼犬',minLevel:1,maxLevel:5,scale:.78,color:'#68beec',tag:'呆萌 · 好奇'},
    {id:2,name:'云朵伙伴',minLevel:6,maxLevel:10,scale:.94,color:'#438bdc',tag:'聪慧 · 灵巧'},
    {id:3,name:'晴空守护者',minLevel:11,maxLevel:15,scale:1.08,color:'#78b4ef',tag:'优雅 · 守护'}
  ];
  const names=["云绒初光","八星伴行","云絮轻舞","涟光小窝","清风双环","云朵觉醒","浮云巡游","晴空星桥","流星轻雨","天蓝光幕","晴空觉醒","六云守护","银羽云翼","交织星轨","晴空星云领域"];
  const descriptions=["脚下出现小云朵和两颗伴星。","八颗蓝星在身边缓缓环绕。","三朵蓬松浮云轻轻升降。","双重云环与星点托起小窝。","两侧清风光带向上舒展。","云拱门和银星点亮第二形态。","六朵浮云沿轨道巡游。","九颗星点连成晴空星桥。","八束流星从两侧轻轻落下。","蓝紫色光幕在身后飘动。","十二枚星芒与第三重云环展开。","六朵守护云排列在身侧。","三层半透明云翼向两侧展开。","双重倾斜星轨交织环绕。","完整五重云台、云翼、星门与星雨同时闪耀。"];
  const levels=names.map((name,i)=>({level:i+1,stage:Math.floor(i/5)+1,name,effect:'bichon-sky-'+(i+1),description:descriptions[i],scale:stages[Math.floor(i/5)].scale*(1+i%5*.035),stageGrowth:1+i%5*.035}));
  const a=(label,frames,durationMs,loop=false)=>({label,frames,durationMs,loop});
  const actions={idle:a('安静观察',[0,1],null,true),wave:a('抬爪问候',[2,0,2],1400),pet:a('开心蹭手',[3],1500),feed:a('吃云朵鸡肉丸',[4],500),think:a('歪头思考',[5],2100),comfort:a('贴心陪伴',[3,2],1700),celebrate:a('轻盈庆祝',[2,7,2],1500),jump:a('灵巧跃起',[7],1000),sleep:a('卷尾小憩',[6],null,true),run:{...a('优雅小跑',[0,7],null,true),frameMs:210},skill:a('晴空守护',[8],2400),evolve:a('云翼进化',[8,2],3000)};
  const clampLevel=v=>Math.max(1,Math.min(15,Math.round(Number(v)||1)));
  function frameAt(name,elapsed,reduced=false){const action=actions[name];if(!action)throw new RangeError('未知动作');if(reduced)return action.frames[0];if(name==='idle')return elapsed%4600>4400?1:0;if(name==='run')return action.frames[Math.floor(Math.max(0,elapsed)/action.frameMs)%action.frames.length];if(action.durationMs===null)return action.frames[0];return action.frames[Math.min(action.frames.length-1,Math.floor(Math.max(0,elapsed)/action.durationMs*action.frames.length))];}
  const choose=(pool,last,random=Math.random)=>{const next=pool.filter(x=>x!==last),p=next.length?next:pool;return p[Math.min(p.length-1,Math.floor(Math.max(0,random())*p.length))];};
  window.BichonGameData={characterId:'bichon',name:'比熊犬',frames,stages,levels,actions,clampLevel,frameAt,choose,interactionPool:['pet','wave','think','jump','celebrate','skill'],idlePool:['think','wave','pet'],idleDelayMs:[10000,18000]};
})();
