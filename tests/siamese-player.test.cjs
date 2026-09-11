const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../characters/siamese');
function setup(){
  const images=[],registered=new Map();
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({style:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},innerHTML:'',textContent:''});
  class Host extends EventTarget{
    constructor(){super();this.attrs=new Map();this.isConnected=false;}
    attachShadow(){const canvas={...element(),getContext:()=>context},nodes={'.shell':element(),'.fx':element(),'.status':element(),canvas};this.shadowRoot={innerHTML:'',querySelector:s=>nodes[s]};}
    getAttribute(k){return this.attrs.get(k)??null;}
    setAttribute(k,v){const old=this.getAttribute(k);this.attrs.set(k,v);if(this.constructor.observedAttributes.includes(k))this.attributeChangedCallback(k,old,v);}
  }
  class FakeImage{constructor(){images.push(this);}set src(v){this.url=v;}}
  const motion={matches:false,addEventListener(){},removeEventListener(){}};
  const sandbox={window:{},HTMLElement:Host,CustomEvent,URL,Image:FakeImage,document:{currentScript:{src:'http://local/siamese/siamese.js'},hidden:false},matchMedia:()=>motion,requestAnimationFrame:()=>1,cancelAnimationFrame(){},customElements:{get:n=>registered.get(n),define:(n,c)=>registered.set(n,c)}};
  sandbox.window=sandbox;
  for(const name of ['siamese-data.js','siamese-effects.js','siamese.js'])vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox);
  const pet=new (registered.get('siamese-game-pet'))();pet.isConnected=true;pet.connectedCallback();
  return {pet,images,sandbox,motion,ready:async()=>{images[0].onload();await Promise.resolve();}};
}
test('暹罗猫动作结束后回到待机，暂停后时钟停止',async()=>{const {pet,ready}=setup();await ready();pet.autoIdle=false;pet.play('feed');pet._tick(1);for(let n=51;n<=451;n+=50)pet._tick(n);assert.equal(pet.action,'feed');pet._tick(501);assert.equal(pet.action,'idle');pet.pause(true);const t=pet._t;pet._tick(2901);assert.equal(pet._t,t);});
test('后台页面与图片加载期间不推进动作时间',async()=>{const {pet,ready,sandbox}=setup();pet._tick(1);pet._tick(51);assert.equal(pet._t,0);await ready();sandbox.document.hidden=true;pet._tick(101);assert.equal(pet._t,0);sandbox.document.hidden=false;pet._tick(151);assert.equal(pet._t,50);});
test('旧阶段图片晚到时不会覆盖最新阶段',async()=>{const {pet,images,ready}=setup();await ready();pet.setLevel(6);pet.setLevel(11);assert.equal(images.length,3);images[2].onload();await Promise.resolve();assert.equal(pet._atlas,images[2]);images[1].onload();await Promise.resolve();assert.equal(pet._atlas,images[2]);assert.equal(pet.stage,3);});
test('随机待机仅在待机状态触发并遵循减少动态效果设置',async()=>{const {pet,ready,motion}=setup();await ready();pet._nextIdle=0;pet._tick(1);assert.notEqual(pet.action,'idle');pet.play('feed');pet._nextIdle=0;pet._tick(51);assert.equal(pet.action,'feed');motion.matches=true;pet.play('idle');pet._nextIdle=0;pet._tick(101);assert.equal(pet.action,'idle');});
test('游戏可以取消角色点击互动',async()=>{const {pet,ready}=setup();await ready();pet.addEventListener('pet-interact',e=>e.preventDefault());pet.interact();assert.equal(pet.action,'idle');});
test('移动会限制边界、朝向目标并最终回到待机',async()=>{const {pet,ready}=setup();await ready();pet.autoIdle=false;pet.moveTo(-10);assert.equal(pet._target,288);assert.equal(pet._dir,-1);for(let t=1;t<1500;t+=50)pet._tick(t);assert.equal(pet._x,288);assert.equal(pet.action,'idle');});
test('三阶段全部动作可渲染且所有等级喂食均在500ms结束',async()=>{const {pet,images,ready}=setup();await ready();pet.autoIdle=false;for(let level=1;level<=15;level++){pet.setLevel(level,{animate:false});if(pet._loading){images.at(-1).onload();await Promise.resolve();}for(const action of ['idle','wave','pet','feed','think','comfort','celebrate','jump','sleep','run','skill','evolve']){pet.play(action);pet._render();}pet.play('feed');const start=pet._t;pet._t=start+450;pet._last=1;pet._tick(50);assert.equal(pet.action,'feed',`Lv.${level}: still feeding at 499ms`);pet._tick(51);assert.equal(pet.action,'idle',`Lv.${level}: finished at 500ms`);}});
