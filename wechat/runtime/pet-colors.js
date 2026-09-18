'use strict';
// Deterministic opaque-pixel histogram; no model, animal names, or ID-based colours.
function hsl(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;let h=0;if(d)h=(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4)*60;return {h,s:d?d/(1-Math.abs(2*l-1)):0,l};}
function hex(h,s,l){h=((h%360)+360)%360;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
function matchPixels(data){
 const buckets=Array.from({length:24},()=>({w:0,x:0,y:0,s:0}));let count=0,light=0,chromatic=0;
 for(let i=0;i+3<data.length;i+=4){if(data[i+3]<224)continue;const c=hsl(data[i],data[i+1],data[i+2]);count++;light+=c.l;if(c.s<.16||c.l<.07||c.l>.94)continue;
  const w=.25+c.s,b=buckets[Math.floor(c.h/15)%24];b.w+=w;b.x+=Math.cos(c.h*Math.PI/180)*w;b.y+=Math.sin(c.h*Math.PI/180)*w;b.s+=c.s*w;chromatic++;
 }
 if(count<10)throw Error('Not enough opaque pet pixels to match colours');
 const best=buckets.reduce((a,b)=>b.w>a.w?b:a),neutral=chromatic/count<.04;
 const hue=neutral?210:((Math.atan2(best.y,best.x)*180/Math.PI+360)%360),s=neutral?.12:Math.min(.66,Math.max(.35,best.s/best.w*.7)),l=light/count;
 const colors={primary:hex(hue,s,.31),secondary:hex(hue+24,s*.75,.48),accent:hex(hue-18,neutral?.18:.78,.58),sky:hex(hue+12,s*.45,l>.78?.78:.96),ground:hex(hue-10,s*.5,l>.78?.70:.88)};
 const warm=hue<75||hue>=330;
 return {version:2,seed:Math.round(hue*1000)+Math.round(l*1000)*360001,scene:warm?'lotus':hue<175?'meadow':'moon',motif:warm?'stars':hue<175?'lotus':'crystal',food:'fruit',colors,match:{method:'opaque-hue-histogram-v1',hue:Math.round(hue),lightness:Number(l.toFixed(3)),neutral}};
}
module.exports={matchPixels,hsl,hex};
