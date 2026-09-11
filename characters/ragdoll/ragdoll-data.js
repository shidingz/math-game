/* Ragdoll's art and animation contract, independent of the quiz and economy. */
(() => {
  const frames=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
  const stages=[
    {id:1,name:'奶凶毛团',minLevel:1,maxLevel:5,scale:.78,color:'#9591de',tag:'奶凶 · 傲娇'},
    {id:2,name:'傲雪伙伴',minLevel:6,maxLevel:10,scale:.96,color:'#819ee7',tag:'优雅 · 友好'},
    {id:3,name:'霜瞳守护者',minLevel:11,maxLevel:15,scale:1.14,color:'#a39ae8',tag:'温和 · 守护'}
  ];
  const names=['初雪微晶','八星伴月','浮晶轻舞','霜光双环','银蓝风纹','傲雪觉醒','六晶巡游','雪夜星桥','银色星雨','冰蓝光幕','霜瞳觉醒','六晶守护','三重霜翼','交织星轨','霜华星河领域'];
  const descriptions=['脚下亮起一颗冰晶和两枚伴星。','八颗星芒缓缓环绕。','三颗浮晶轻轻升降。','双重霜光环与星点展开。','两侧银蓝光带向上舒展。','进化为傲雪伙伴，晶拱门与银星亮起。','六颗冰晶沿轨道巡游。','九颗星点连接成雪夜星桥。','八束银色流星缓缓落下。','蓝紫光幕在身后飘动。','进化为霜瞳守护者，十二枚星芒与第三道光环亮起。','六颗守护冰晶在两侧列阵。','三层半透明霜翼向两侧展开。','双重倾斜星轨交织环绕。','五重光环、晶冠、霜翼与星雨组成完整霜华领域。'];
  const levels=names.map((name,i)=>({level:i+1,stage:Math.floor(i/5)+1,name,effect:'ragdoll-frost-'+(i+1),description:descriptions[i],scale:stages[Math.floor(i/5)].scale*(1+i%5*.035),stageGrowth:1+i%5*.035}));
  const a=(label,frames,durationMs,loop=false)=>({label,frames,durationMs,loop});
  const actions={idle:a('待机眨眼',[0,1],null,true),wave:a('抬爪招呼',[2,0,2],1400),pet:a('蹭蹭手心',[3],1500),feed:a('吃鲜鱼猫粮',[4],500),think:a('歪头思考',[5],2100),comfort:a('温柔陪伴',[3,2],1700),celebrate:a('开心庆祝',[2,7,2],1500),jump:a('轻盈跳跃',[7],1000),sleep:a('蜷身小憩',[6],null,true),run:{...a('轻快跑动',[0,7],null,true),frameMs:220},skill:a('星辉守护',[8],2400),evolve:a('星光进化',[8,2],3000)};
  const clampLevel=value=>Math.max(1,Math.min(15,Math.round(Number(value)||1)));
  function frameAt(action,elapsed,reduced=false){const a=actions[action];if(!a)throw new RangeError('未知动作');if(reduced)return a.frames[0];if(action==='idle')return elapsed%4600>4400?1:0;if(action==='run')return a.frames[Math.floor(elapsed/a.frameMs)%a.frames.length];if(a.durationMs===null)return a.frames[0];return a.frames[Math.min(a.frames.length-1,Math.floor(Math.max(0,elapsed)/a.durationMs*a.frames.length))];}
  const choose=(pool,last,random=Math.random)=>{const p=pool.filter(x=>x!==last);return p[Math.min(p.length-1,Math.floor(Math.max(0,random())*p.length))];};
  window.RagdollGameData={characterId:'ragdoll',name:'布偶猫',frames,stages,levels,actions,clampLevel,frameAt,choose,interactionPool:['pet','wave','jump','celebrate','skill'],idlePool:['think','wave','pet'],idleDelayMs:[10000,18000]};
})();
