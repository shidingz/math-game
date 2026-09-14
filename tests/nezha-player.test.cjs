const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../characters/nezha');
function setup(){
  const images=[],registered=new Map();
  const context=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
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
  const sandbox={window:{},HTMLElement:Host,CustomEvent,URL,Image:FakeImage,document:{currentScript:{src:'http://local/nezha/nezha.js'},hidden:false},matchMedia:()=>motion,requestAnimationFrame:()=>1,cancelAnimationFrame(){},customElements:{get:n=>registered.get(n),define:(n,c)=>registered.set(n,c)}};
  sandbox.window=sandbox;
  for(const name of ['nezha-data.js','nezha-effects.js','nezha.js'])vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),sandbox);
  const pet=new (registered.get('nezha-game-pet'))();pet.isConnected=true;pet.connectedCallback();
  return {pet,images,sandbox,motion,ready:async()=>{images[0].onload();await Promise.resolve();}};
}
test('哪吒三段武打切换不同姿势，并产生明显横向位移和腾空',async()=>{
  const {pet,ready,sandbox}=setup();await ready();pet.autoIdle=false;pet.play('skill');
  const poses=[];
  for(const ms of [0,480,960,1440,1920]){pet._t=pet._start+ms;pet._render();poses.push({...pet._lastPose});}
  assert.equal(new Set(poses.map(p=>p.frame)).size,3);
  assert.ok(Math.max(...poses.map(p=>p.x))-Math.min(...poses.map(p=>p.x))>180);
  assert.ok(Math.max(...poses.map(p=>p.y))-Math.min(...poses.map(p=>p.y))>85);
  assert.equal(sandbox.NezhaGameData.frames.length,18);
  pet._t=pet._start+2399;pet._last=1;pet._tick(2);assert.equal(pet.action,'idle');
});
test('减少动态效果时哪吒武打停止位移和倾斜',async()=>{
  const {pet,ready,motion}=setup();await ready();motion.matches=true;pet.play('skill');
  pet._t=pet._start+900;pet._render();const first={...pet._lastPose};
  pet._t=pet._start+1800;pet._render();assert.deepEqual({...pet._lastPose},first);assert.equal(first.rotation,0);
});
test('哪吒1至15级喂食均在500ms完成，跨阶段采用新图集',async()=>{
  const {pet,images,ready}=setup();await ready();pet.autoIdle=false;
  for(let level=1;level<=15;level++){
    pet.setLevel(level,{animate:false});if(pet._loading){images.at(-1).onload();await Promise.resolve();}
    assert.ok(pet._atlas.url.includes('realistic2-martial'));
    pet.play('feed');pet._t=pet._start+499;pet._last=1;pet._tick(1);assert.equal(pet.action,'feed');
    pet._tick(2);assert.equal(pet.action,'idle');
  }
});
