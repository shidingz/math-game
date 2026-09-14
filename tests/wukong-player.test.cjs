const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function setup(){
  const images=[],registered=new Map();
  const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const element=()=>({style:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},innerHTML:'',textContent:''});
  class Host extends EventTarget{
    constructor(){super();this.attrs=new Map();this.isConnected=false;}
    attachShadow(){const canvas={...element(),getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,right:960,bottom:680,width:960,height:680})},nodes={'.shell':element(),'.fx':element(),'.status':element(),canvas};this.shadowRoot={innerHTML:'',querySelector:s=>nodes[s]};}
    closest(){return null;}
    getAttribute(k){return this.attrs.get(k)??null;}
    setAttribute(k,v){const old=this.getAttribute(k);this.attrs.set(k,v);if(this.constructor.observedAttributes.includes(k))this.attributeChangedCallback(k,old,v);}
  }
  class FakeImage{constructor(){images.push(this);}set src(v){this.url=v;}}
  const motion={matches:false,addEventListener(){},removeEventListener(){}};
  const sandbox={window:{},HTMLElement:Host,CustomEvent,URL,Image:FakeImage,document:{currentScript:{src:'http://local/wukong.js'},hidden:false},matchMedia:()=>motion,requestAnimationFrame:()=>1,cancelAnimationFrame(){},customElements:{get:n=>registered.get(n),define:(n,c)=>registered.set(n,c)}};
  sandbox.window=sandbox;
  for(const name of ['wukong.js'])vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox);
  const pet=new (registered.get('wukong-game-pet'))();pet.isConnected=true;pet.connectedCallback();
  return {pet,images,sandbox,motion,ready:async()=>{images[0].onload();await Promise.resolve();}};
}

test('孙悟空三个成长阶段具有独立武打幅度，减少动态时停止位移',async()=>{
  const {pet,images,ready}=setup();await ready();
  const ranges=[];
  for(const level of [1,6,11]){
    pet.setLevel(level,{animate:false});if(!pet._atlas){images.at(-1).onload();await Promise.resolve();}
    const poses=[];pet._sprite=(frame,x,y,scale,alpha,atlas,rotation)=>poses.push({frame,x,y,rotation});
    pet.play('skill');
    for(const ms of [0,480,960,1440,1920]){pet._t=pet._start+ms;pet._render();}
    assert.equal(new Set(poses.map(p=>p.frame)).size,3);
    const range=Math.max(...poses.map(p=>p.x))-Math.min(...poses.map(p=>p.x));ranges.push(range);
    assert.ok(range>80);
    pet._reduced=true;poses.length=0;
    for(const ms of [500,1700]){pet._t=pet._start+ms;pet._render();}
    assert.deepEqual(poses[0],poses[1]);pet._reduced=false;
  }
  assert.ok(ranges[1]>ranges[0]);assert.ok(ranges[2]>ranges[0]);
});
test('悟空所有等级喂食500ms结束，切换阶段等待新素材就绪',async()=>{
  const {pet,images,ready}=setup();await ready();
  for(let level=1;level<=15;level++){
    pet.setLevel(level,{animate:false});
    if(!pet._atlas){pet.play('feed');pet._last=1;const t=pet._t;pet._tick(50);assert.equal(pet._t,t);images.at(-1).onload();await Promise.resolve();}
    assert.ok(pet._atlas.url.includes('cute-agile-hero4'));
    pet.play('feed');pet._t=pet._start+499;pet._last=1;pet._tick(1);assert.equal(pet.action,'feed');
    pet._tick(2);assert.equal(pet.action,'idle');
  }
});
test('进化后的悟空伙伴互动没有爱心，鼓励和庆祝使用独立姿势',async()=>{
  const {pet,images,ready,sandbox}=setup();await ready();let hearts=0;pet._heart=()=>hearts++;
  for(const level of [1,6,11]){
    pet.setLevel(level,{animate:false});if(!pet._atlas){images.at(-1).onload();await Promise.resolve();}
    pet.play('pet');hearts=0;pet._render();assert.equal(hearts,level===1?3:0);
  }
  assert.deepEqual(Array.from(sandbox.WukongGameData.actions.comfort.frames),[16]);
  assert.deepEqual(Array.from(sandbox.WukongGameData.actions.celebrate.frames),[17,10,17]);
});
