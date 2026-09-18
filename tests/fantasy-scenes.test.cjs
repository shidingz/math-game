const {test}=require('node:test'),assert=require('node:assert/strict');
const {select,scene,effects}=require('../wechat/runtime/fantasy-scenes');
const P=require('../wechat/runtime/pet-presets');
test('shared fantasy art follows hue and neutral contrast; serialized packs keep choices',()=>{
 for(const [hue,id] of [[30,'gold'],[145,'jade'],[215,'ice'],[282,'violet'],[359,'gold']]){
  const raw={...P.choose('custom-x'),version:2,colors:{primary:'#ad7823',secondary:'#bcab99',accent:'#e8c785',sky:'#eee9dd',ground:'#ffffdd'},match:{hue,lightness:.82,neutral:false}};
  const safe=P.compile(JSON.parse(JSON.stringify(raw))),a=select(safe.colors,safe.spec.match);
  assert.equal(a.id,id);assert.equal(a.lightPet,true);assert.match(a.scene,/^shared-art\/v1\/[a-z]+\.jpg$/);
  assert.deepEqual(a,select(safe.colors,safe.spec.match));
 }
 const neutral=select({primary:'#777777',sky:'#dddddd'},{hue:0,lightness:.95,neutral:true});assert.equal(neutral.id,'ice');assert.equal(neutral.lightPet,true);
});
test('shared VFX draws with finite coordinates at every level and during evolution',()=>{
 const ops=[],c=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||((...a)=>ops.push([k,...a])),set:()=>true}),image={width:768,height:768};
 const theme=select({primary:'#227744',sky:'#abcdef'});
 scene(c,image,theme,20,205,350,374,4000);
 for(let n=1;n<=15;n++)effects(c,image,theme,195,550,300,n,5000,n===6||n===11);
 assert.ok(ops.some(a=>a[0]==='drawImage'));assert.ok(ops.every(a=>a.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
});
