'use strict';
// Fit visible pixels, reserving room for shared motions. No per-pet exceptions.
function home(height,data){
 // A roomy background with a separate, smaller pet envelope. Adult pets
 // occupy roughly two thirds of its height instead of filling the scene.
 const sceneHeight=Math.min(440,Math.max(190,height-436));
 const offset=Math.max(0,(height-(sceneHeight+410))/2),y=165+offset,end=y+sceneHeight;
 return {offset,scene:{x:12,y,width:366,height:sceneHeight},pet:{x:195,top:y+sceneHeight*.14,width:302,height:sceneHeight*.73},noticeY:end+15,growthY:end+30,growthHeight:94,buttonsY:end+135,buttonHeight:64,footerY:end+209,footerHeight:36};
}
function growthScale(level){return .53+.45*Math.pow(Math.max(0,Math.min(1,((Number(level)||1)-1)/14)),.85);}
function fit(data,stage,frameIndex,area,level,action,phase,time=0,reducedMotion=false){
 const frame=data.frames[frameIndex],b=data.stages[stage].bounds[frameIndex];
 const px=data.aligned?frame.pivotX:b.x+b.width/2,py=data.aligned?frame.pivotY:b.y+b.height;
 const turn=.025,dxMax=area.width*.022,liftMax=area.height*.03;
 function limits(box,pivotX,pivotY){
  const half=Math.max(Math.abs(box.x-pivotX),Math.abs(box.x+box.width-pivotX)),up=pivotY-box.y,down=Math.max(0,box.y+box.height-pivotY);
  return {down,scale:Math.min((area.width/2-8-dxMax)/(half+up*turn),(area.height-12-liftMax)/(up+down+half*turn))};
 }
 const current=limits(b,px,py),idle=data.stages[stage].bounds[0],idleFrame=data.frames[0];
 // Idle determines the hero camera. A wide pose may zoom out for containment;
 // short sleeping poses never get enlarged just to fill available height.
 // A common idle height across all stages avoids a size drop when a new shape
 // is wider. Dynamic poses still shrink if necessary to keep every pixel safe.
 const heroHeight=Math.min(...data.stages.map(s=>{
  const b=s.bounds[0];return b.height*limits(b,data.aligned?idleFrame.pivotX:b.x+b.width/2,data.aligned?idleFrame.pivotY:b.y+b.height).scale;
 }));
 const reference=limits(idle,data.aligned?idleFrame.pivotX:idle.x+idle.width/2,data.aligned?idleFrame.pivotY:idle.y+idle.height);
 const scale=Math.min(current.scale,reference.scale,heroHeight/idle.height)*growthScale(level),down=current.down;
 const active=['jump','celebrate','skill','evolve'].includes(action);
 const lift=reducedMotion?0:active?Math.sin(phase*Math.PI)*liftMax:Math.sin(time/600)*1.2;
 const dx=!reducedMotion&&action==='skill'?Math.sin(phase*Math.PI*2)*dxMax:0;
 const rotation=!reducedMotion&&action==='skill'?Math.sin(phase*Math.PI*2)*turn:0;
 const x=area.x+dx,foot=area.top+area.height-8-down*scale-lift;
 const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([xx,yy])=>{xx=(xx-px)*scale;yy=(yy-py)*scale;return {x:x+xx*Math.cos(rotation)-yy*Math.sin(rotation),y:foot+xx*Math.sin(rotation)+yy*Math.cos(rotation)};});
 return {x,foot,scale,rotation,pivotX:px,pivotY:py,bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};
}
module.exports={home,fit,growthScale};
