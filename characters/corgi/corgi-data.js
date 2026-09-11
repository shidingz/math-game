/* Character art contract; economy and real levels remain in the game core. */
(() => {
  const frames=['idle','blink','wave','pet','feed','think','sleep','jump','skill'];
  const stages=[
    {id:1,name:'见习小警员',minLevel:1,maxLevel:5,scale:.78,color:'#529ce5',tag:'可爱 · 机灵'},
    {id:2,name:'机敏巡逻员',minLevel:6,maxLevel:10,scale:.94,color:'#3788dc',tag:'敏锐 · 勇敢'},
    {id:3,name:'王牌汪队长',minLevel:11,maxLevel:15,scale:1.10,color:'#41bce5',tag:'帅气 · 守护'}
  ];
  const names=['报到爪印','警星伴行','巡逻双环','追踪足迹','见习徽光','巡逻觉醒','雷达扫描','星点路标','六盾巡游','探照光束','队长觉醒','列阵守护','银蓝护翼','交织警轨','王牌守护领域'];
  const descriptions=['蓝光中亮起两枚小爪印。','八颗警星缓缓环绕。','双重巡逻光环展开。','身旁增加四枚追踪爪印。','两道蓝光与盾形徽章亮起。','进化为巡逻员，展开大徽章和第三层光环。','雷达扇形在身后缓缓扫描。','八颗路标星组成巡逻线路。','六枚小护盾围绕伙伴巡游。','两侧展开蓝色探照光束。','进化为汪队长，巨大守护盾和金星点亮。','六枚守护盾在两侧列阵。','三层银蓝护翼向两侧展开。','双重交织轨道和十六颗星芒环绕。','五重光环、徽章、护盾、护翼和星雨构成完整领域。'];
  const levels=names.map((name,i)=>({level:i+1,stage:Math.floor(i/5)+1,name,effect:'corgi-patrol-'+(i+1),description:descriptions[i],scale:stages[Math.floor(i/5)].scale*(1+i%5*.035),stageGrowth:1+i%5*.035}));
  const a=(label,frames,durationMs,loop=false)=>({label,frames,durationMs,loop});
  const actions={idle:a('呼吸眨眼',[0,1],null,true),wave:a('抬爪招呼',[2,0,2],1400),pet:a('开心蹭手',[3],1500),feed:a('吃鸡肉能量餐',[4],500),think:a('歪头思考',[5],2100),comfort:a('贴心陪伴',[3,2],1700),celebrate:a('雀跃庆祝',[2,7,2],1500),jump:a('短腿蹦跳',[7],1000),sleep:a('蜷身小憩',[6],null,true),run:{...a('轻快奔跑',[0,7],null,true),frameMs:220},skill:a('警犬守护',[8],2400),evolve:a('警犬进化',[8,2],3000)};
  const clampLevel=value=>Math.max(1,Math.min(15,Math.round(Number(value)||1)));
  function frameAt(name,elapsed,reduced=false){const action=actions[name];if(!action)throw new RangeError('未知动作');if(reduced)return action.frames[0];if(name==='idle')return elapsed%4600>4400?1:0;if(name==='run')return action.frames[Math.floor(Math.max(0,elapsed)/action.frameMs)%action.frames.length];if(action.durationMs===null)return action.frames[0];return action.frames[Math.min(action.frames.length-1,Math.floor(Math.max(0,elapsed)/action.durationMs*action.frames.length))];}
  const choose=(pool,last,random=Math.random)=>{const next=pool.filter(x=>x!==last),p=next.length?next:pool;return p[Math.min(p.length-1,Math.floor(Math.max(0,random())*p.length))];};
  window.CorgiGameData={characterId:'corgi',name:'柯基犬',frames,stages,levels,actions,clampLevel,frameAt,choose,interactionPool:['pet','wave','jump','celebrate','skill'],idlePool:['think','wave','pet'],idleDelayMs:[10000,18000]};
})();
