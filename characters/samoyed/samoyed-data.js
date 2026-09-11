/* Visual levels stop at 15; saved levels continue in the shared game core. */
(() => {
  const frames=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
  const stages=[
    {id:1,name:'雪团幼犬',minLevel:1,maxLevel:5,scale:.78,color:'#77c9fb',tag:'呆萌 · 好奇'},
    {id:2,name:'踏雪伙伴',minLevel:6,maxLevel:10,scale:.94,color:'#4d9ff1',tag:'聪明 · 贴心'},
    {id:3,name:'霜辉守护者',minLevel:11,maxLevel:15,scale:1.08,color:'#7073f3',tag:'自信 · 守护'}
  ];
  const names=['雪绒初光','六角飞雪','冰晶萌芽','雪爪涟漪','星雪轨道','踏雪觉醒','霜羽回旋','智慧星图','流星冰雨','极光帷幕','霜辉觉醒','晶塔守护','星轨共鸣','天穹雪翼','极光星雪领域'];
  const descriptions=['柔蓝光晕与细雪陪伴小雪团。','新增六枚旋转雪花。','两侧长出四枚蓝色冰晶。','脚下展开双层雪爪涟漪。','星光沿圆形轨道环绕。','进化时六角雪阵与霜冠亮起。','六束霜羽在身体两侧舒展。','智慧星图与几何星点连接成网。','四道流星与六颗冰晶雨加入。','两侧展开蓝紫极光帷幕。','第二次进化唤醒十二瓣霜辉法阵。','六座晶塔形成守护屏障。','双重星轨与流动光点共鸣。','三层雪翼和星芒向两侧展开。','完整极光领域、王冠星阵与星雪瀑布闪耀。'];
  const levels=names.map((name,i)=>({level:i+1,stage:Math.floor(i/5)+1,name,effect:'samoyed-snow-'+(i+1),description:descriptions[i],scale:stages[Math.floor(i/5)].scale*(1+i%5*.035),stageGrowth:1+i%5*.035}));
  const a=(label,frames,durationMs,loop=false)=>({label,frames,durationMs,loop});
  const actions={idle:a('呼吸眨眼',[0,1],null,true),wave:a('举爪招呼',[2,0,2],1400),pet:a('软乎乎蹭手',[3],1500),feed:a('吃酸奶雪团',[4],500),think:a('扶眼镜思考',[5],2100),comfort:a('温柔陪伴',[3,2],1700),celebrate:a('开心庆祝',[2,7,2],1500),jump:a('雪团蹦跳',[7],1000),sleep:a('蜷身小憩',[6],null,true),run:{...a('轻快小跑',[0,7],null,true),frameMs:220},skill:a('智慧霜辉',[8],2400),evolve:a('冰雪进化',[8,2],3000)};
  const clampLevel=v=>Math.max(1,Math.min(15,Math.round(Number(v)||1)));
  function frameAt(name,elapsed,reduced=false){const action=actions[name];if(!action)throw new RangeError('未知动作');if(reduced)return action.frames[0];if(name==='idle')return elapsed%4600>4400?1:0;if(name==='run')return action.frames[Math.floor(Math.max(0,elapsed)/action.frameMs)%action.frames.length];if(action.durationMs===null)return action.frames[0];return action.frames[Math.min(action.frames.length-1,Math.floor(Math.max(0,elapsed)/action.durationMs*action.frames.length))];}
  const choose=(pool,last,random=Math.random)=>{const next=pool.filter(x=>x!==last),p=next.length?next:pool;return p[Math.min(p.length-1,Math.floor(Math.max(0,random())*p.length))];};
  window.SamoyedGameData={characterId:'samoyed',name:'萨摩耶',frames,stages,levels,actions,clampLevel,frameAt,choose,interactionPool:['pet','wave','think','jump','celebrate','skill'],idlePool:['think','wave','pet'],idleDelayMs:[10000,18000]};
})();
