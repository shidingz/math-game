const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function fixture(){
  let now=1000,id=0;const timers=new Map(),handlers={},events={},plays=[];
  const document={hidden:false,addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};
  const motion={matches:false,addEventListener(){},removeEventListener(){}};
  const adapter={action:'idle',play(a){this.action=a;plays.push(a);},on(n,f){events[n]=f;return ()=>delete events[n];}};
  const config={clickActions:['pet','wave','jump'],idleActions:['sleep'],messages:{idle:['hi'],sleep:['zzz'],pet:['hello'],wave:['hi'],jump:['jump']}};
  const context={window:{},MathPetCore:require('../game/core.js'),document,matchMedia:()=>motion,performance:{now:()=>now},setTimeout:(f,d)=>{timers.set(++id,{f,at:now+d});return id;},clearTimeout:i=>timers.delete(i)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/interaction.js'),'utf8'),context);
  const director=new context.window.PetInteraction(adapter,config,()=>{},{rng:()=>0,minDelay:10000,maxDelay:18000});
  const tick=ms=>{const until=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].f();}now=until;};
  return {director,adapter,plays,tick,document,handlers,timers,events};
}
test('点击选择不同动作，快速连点受限',()=>{const f=fixture();f.director.interact();f.director.interact();assert.equal(f.plays.length,1);f.tick(500);f.director.interact();assert.notEqual(f.plays[0],f.plays[1]);});
test('闲置不会立即动作，小憩后自动恢复待机',()=>{const f=fixture();f.tick(9999);assert.equal(f.plays.length,0);f.tick(1);assert.equal(f.adapter.action,'sleep');f.tick(3600);assert.equal(f.adapter.action,'idle');});
test('做题或喂养禁用互动时，不会被随机动作打断',()=>{const f=fixture();f.director.setEnabled(false);f.adapter.play('feed');f.director.interact();f.tick(50000);assert.deepEqual(f.plays,['feed']);});
test('隐藏页面暂停随机行为，再回来不会永久睡眠',()=>{const f=fixture();f.tick(10000);f.document.hidden=true;f.handlers.visibilitychange();f.tick(100000);assert.equal(f.plays.length,1);f.document.hidden=false;f.handlers.visibilitychange();assert.equal(f.adapter.action,'idle');});
test('销毁后取消所有随机定时器和事件监听',()=>{const f=fixture();f.director.destroy();assert.equal(f.timers.size,0);assert.equal(Object.keys(f.events).length,0);assert.equal(Object.keys(f.handlers).length,0);f.tick(100000);assert.equal(f.plays.length,0);});
