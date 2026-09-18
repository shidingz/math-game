'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fit}=require('../wechat/runtime/pet-geometry');
const pet={aligned:true,frames:Array.from({length:3},()=>({pivotX:256,pivotY:480})),stages:[
 {bounds:[{x:146,y:80,width:220,height:400},{x:26,y:120,width:460,height:360},{x:106,y:350,width:300,height:130}]},
 {bounds:[{x:56,y:260,width:400,height:220},{x:6,y:170,width:500,height:310},{x:66,y:340,width:380,height:140}]},
 {bounds:[{x:6,y:200,width:500,height:280},{x:6,y:20,width:500,height:460},{x:26,y:340,width:460,height:140}]}
]};
test('scrollable home frames a tall young pet without reserving the future wide shape, while keeping all poses contained',()=>{
 const area={x:195,top:20,width:354,height:390,growthScale:.86,camera:'stage'};
 const old=fit(pet,0,0,{...area,camera:undefined},1,'idle',0,0,true),close=fit(pet,0,0,area,1,'idle',0,0,true);
 assert(close.scale>old.scale*1.3);
 for(let stage=0;stage<3;stage++)for(let frame=0;frame<3;frame++)for(const phase of [0,.25,.5,.75,1]){
  const p=fit(pet,stage,frame,area,1,'skill',phase,300,false).bounds;
  assert(p.left>=area.x-area.width/2&&p.right<=area.x+area.width/2);
  assert(p.top>=area.top&&p.bottom<=area.top+area.height);
 }
 assert(fit(pet,0,2,area,1,'sleep',0,0,true).scale<=close.scale);
});
test('browser presentation grows within a stage; ordinary viewport fitting keeps its original default',()=>{
 const area={x:195,top:20,width:354,height:390};
 const young=fit(pet,0,0,{...area,camera:'stage',growthScale:.86},1,'idle',0,0,true);
 const older=fit(pet,0,0,{...area,camera:'stage',growthScale:1},5,'idle',0,0,true);
 assert(older.scale>young.scale);
 assert.deepEqual(fit(pet,0,0,area,1,'idle',0,0,true),fit(pet,0,0,{...area,camera:'all'},1,'idle',0,0,true));
});
