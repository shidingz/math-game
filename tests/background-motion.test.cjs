const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const K=require('../wechat/runtime/kingdom-scenes');
const pet=id=>({id,ui:{palette:{primary:'#c28547'}}});
test('16幅场景保留原生443像素细节，8室内8室外，新增道具有Alpha',()=>{
 assert.equal(K.THEMES.length,16);assert.equal(K.OUTDOOR_IDS.size,8);
 const pngHeader=name=>fs.readFileSync(path.join(__dirname,'../assets/toy-worlds',name+'.png')).subarray(16,26);
 for(const id of ['skies','places']){const b=pngHeader(id);assert.equal(b.readUInt32BE(0)/4,443);assert.equal(b.readUInt32BE(4)/2,443);}
 const b=pngHeader('living');assert.equal(b[9],6,'RGBA color type');
 for(const group of K.GROUPS)assert.ok(fs.existsSync(path.join(__dirname,'../assets/toy-worlds',group[0]+'.png')));
});
test('六种场景布局稳定且高道具远离中央宠物区',()=>{
 const layouts=new Set();for(let n=0;n<500;n++){
  const p=K.profile(pet('world-'+n));layouts.add(p.layout);assert.deepEqual(p,K.profile(pet('world-'+n)));
  assert.ok(p.scenery.length>=2&&p.scenery.length<=3);assert.equal(p.living.length,2);
  for(const s of p.scenery){assert.ok(s.x<.25||s.x>.75);assert.ok(s.y-s.w/2>.1);assert.ok(s.w<=.29);}
 }
 assert.equal(layouts.size,6);
});
test('动景按时间移动、减少动态时固定，低频穿行最多一项且只在上沿',()=>{
 let seenTransient=false;for(let n=0;n<32;n++){
  const p=K.profile(pet('moving-'+n));
  assert.notDeepEqual(K.sceneryFrame(p,0).living,K.sceneryFrame(p,1300).living);
  assert.deepEqual(K.sceneryFrame(p,0,true),K.sceneryFrame(p,900000,true));
  for(let time=0;time<65000;time+=350){const frame=K.sceneryFrame(p,time);assert.ok(frame.living.length>=2&&frame.living.length<=3);
   for(const o of frame.living){for(const key of ['x','y','w','rotation','alpha'])assert.ok(Number.isFinite(o[key]));assert.ok(o.alpha>=0&&o.alpha<=1);
    if(o.transient){seenTransient=true;assert.ok(o.y+o.w/2<.2);}else assert.ok(o.x<.2||o.x>.8);
   }
  }
 }
 assert.ok(seenTransient);
});
