const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(reduced=false){
  let now=0,nextTimer=0;const timers=new Map(),actors=[],dialogs=[];
  class Node extends EventTarget{
    constructor(){super();this.style={visibility:''};this.children=[];this.isConnected=true;this.classList={add(){}};this.nodes={};this.textContent='';this.open=false;}
    setAttribute(k,v){this[k]=v;}append(n){this.children.push(n);}querySelector(s){return this.nodes[s];}
    getBoundingClientRect(){return {left:0,top:0,width:400,height:300};}
    animate(){return {cancel(){}};}focus(){this.focused=true;}showModal(){this.open=true;}close(){this.open=false;}remove(){this.isConnected=false;}
    set innerHTML(v){for(const s of ['.pet-upgrade-kicker','h2','.pet-upgrade-level','.pet-upgrade-detail','.pet-upgrade-sparks','.pet-upgrade-stage','.pet-upgrade-loading','button'])this.nodes[s]=new Node();}
  }
  const doc=new EventTarget();Object.assign(doc,{body:new Node(),hidden:false,activeElement:new Node(),createElement(tag){const n=new Node();if(tag==='dialog')dialogs.push(n);return n;}});
  const context={document:doc,matchMedia:()=>({matches:reduced}),setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../game/wukong-level-up.js'),'utf8'),context);
  const config={id:'wukong',name:'孙悟空',ui:{palette:{}},stages:[{name:'小石猴'},{name:'小行者'},{name:'踏云大圣'}],effects:Array.from({length:15},(_,i)=>({name:'特效'+(i+1)})),create({level}){
    const events=new Map(),element=new Node();element.previewEffect=()=>{};
    const actor={level,element,actions:[],destroyed:false,play(a){this.actions.push(a);},destroy(){this.destroyed=true;},on(name,fn){events.set(name,fn);return ()=>events.delete(name);},emit(name){events.get(name)?.();}};actors.push(actor);return actor;
  }};
  function tick(ms){const end=now+ms;while(true){const item=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!item)break;now=item[1].at;timers.delete(item[0]);item[1].fn();}now=end;}
  const origin=new Node(),controller=new context.PetLevelUp();return {controller,config,origin,doc,actors,dialogs,timers,tick};
}
test('every registered pet can receive its own full-screen presentation',async()=>{const s=setup();for(const [id,name] of [['wukong','孙悟空'],['nezha','哪吒'],['yutu','玉兔'],['ragdoll','布偶猫'],['corgi','柯基犬']]){s.config.id=id;s.config.name=name;const p=s.controller.play({config:s.config,origin:s.origin,previous:1,level:2});assert.equal(s.dialogs.at(-1)["data-pet"],id);assert.equal(s.dialogs.at(-1).querySelector('h2').textContent,`${name}升级啦！`);s.controller.cancel();await p;}});
test('normal pet upgrade celebrates, returns to its origin and releases modal/timers without mutating config',async()=>{
  const s=setup(),p=s.controller.play({config:s.config,origin:s.origin,previous:7,level:8});assert.equal(s.origin.style.visibility,'hidden');assert.equal(s.dialogs[0].open,true);
  s.actors[0].emit('ready');assert.deepEqual(s.actors[0].actions,['celebrate']);s.tick(1800);assert.deepEqual(s.actors[0].actions,['celebrate','wave']);s.tick(1560);await p;
  assert.equal(s.origin.style.visibility,'');assert.equal(s.actors[0].destroyed,true);assert.equal(s.controller.active,null);assert.equal(s.timers.size,0);assert.equal(s.doc.activeElement.focused,true);
});
test('evolution announces the active pet; Lv.16 still celebrates using final art',async()=>{
  const s=setup();s.config.id='yutu';s.config.name='玉兔';const p=s.controller.play({config:s.config,origin:s.origin,previous:5,level:6});assert.equal(s.dialogs[0].querySelector('h2').textContent,'玉兔进化啦！');assert.equal(s.actors[0].level,6);s.actors[0].emit('ready');s.tick(1800);assert.equal(s.actors[0].actions.at(-1),'skill');s.controller.cancel();await p;
  const q=s.controller.play({config:s.config,origin:s.origin,previous:15,level:16});assert.equal(s.actors[1].level,15);assert.equal(s.dialogs[1].querySelector('.pet-upgrade-level').textContent,'Lv.15 → Lv.16');s.controller.cancel();await q;
});
test('early close, image failure and timeout cannot strand the hidden original',async()=>{
  for(const reason of ['cancel','error','timeout']){const s=setup(),p=s.controller.play({config:s.config,origin:s.origin,previous:1,level:2});
    if(reason==='cancel')s.dialogs[0].dispatchEvent(new Event('cancel',{cancelable:true}));else if(reason==='error')s.actors[0].emit('error');else s.tick(6000);await p;
    assert.equal(s.origin.style.visibility,'');assert.equal(s.timers.size,0);assert.equal(s.controller.active,null);
  }
});
test('backgrounding during return cleans up immediately; repeated cancel is safe',async()=>{
  const s=setup(),p=s.controller.play({config:s.config,origin:s.origin,previous:10,level:11});s.actors[0].emit('ready');s.dialogs[0].querySelector('button').dispatchEvent(new Event('click'));assert.equal(s.dialogs[0].open,true);
  s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));await p;s.controller.cancel();assert.equal(s.origin.style.visibility,'');assert.equal(s.timers.size,0);assert.equal(s.dialogs[0].isConnected,false);
});
test('reduced motion skips flight and returns after a short static celebration',async()=>{
  const s=setup(true),p=s.controller.play({config:s.config,origin:s.origin,previous:5,level:6,preview:true});assert.equal(s.dialogs[0].querySelector('.pet-upgrade-kicker').textContent,'孙悟空成长展示');s.actors[0].emit('ready');s.tick(1400);await p;assert.equal(s.controller.active,null);
});
