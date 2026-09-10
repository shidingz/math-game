/* Transparent, scalable level effects; each level has its own silhouette. */
(() => {
  'use strict';
  const C={jade:'#55cbc4',blue:'#6298eb',violet:'#9983eb',silver:'#d5efff',gold:'#f1d991'};
  const ring=(x,y,rx,ry,color,angle=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="3" transform="rotate(${angle} ${x} ${y})"/>`;
  const star=(x,y,r,color)=>`<path d="M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}Z" fill="${color}"/>`;
  const moon=(x,y,r)=>`<path d="M${x+r*.55} ${y-r*.83} A${r} ${r} 0 1 0 ${x+r*.55} ${y+r*.83} A${r*.86} ${r*.86} 0 0 1 ${x+r*.55} ${y-r*.83}Z" fill="${C.silver}" stroke="${C.blue}" stroke-width="2"/>`;
  const flower=(x,y,s)=>`<g transform="translate(${x} ${y})">${[0,90,180,270].map(a=>`<ellipse cy="${-s*.55}" rx="${s*.46}" ry="${s*.64}" fill="${C.gold}" transform="rotate(${a})"/>`).join('')}<circle r="${s*.2}" fill="${C.jade}"/></g>`;
  const orbit=(n,rx,ry,kind='star')=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n,x=Math.round(480+Math.cos(a)*rx),y=Math.round(366+Math.sin(a)*ry);return kind==='flower'?flower(x,y,9):star(x,y,i%2?5:9,i%2?C.violet:C.jade);}).join('');
  const leaves=(n)=>Array.from({length:n},(_,i)=>{const a=i*360/n;return `<path d="M480 175q-28-26 0-47q28 26 0 47Z" fill="${i%2?C.jade:C.blue}" opacity=".8" transform="rotate(${a} 480 360)"/>`;}).join('');
  const silk=()=>`<path d="M315 438C200 240 650 180 682 329S307 570 305 477" stroke="${C.violet}" stroke-width="7" fill="none"/><path d="M652 486C757 220 275 258 340 182" stroke="${C.jade}" stroke-width="4" fill="none"/>`;
  const floor=()=>ring(480,580,176,30,C.blue)+ring(480,580,145,21,C.jade);
  function svg(value,animated=true){
    const n=window.YutuGameData.clampLevel(value);let shape='';
    if(n===1)shape=orbit(5,126,132);
    if(n===2)shape=orbit(6,143,139,'flower');
    if(n===3)shape=ring(480,578,147,24,C.jade)+moon(339,564,17);
    if(n===4)shape=leaves(5)+orbit(5,145,145);
    if(n===5)shape=floor()+moon(480,558,32)+flower(375,568,12)+flower(585,568,12);
    if(n===6)shape=floor()+ring(480,365,179,163,C.jade)+orbit(6,179,163);
    if(n===7)shape=orbit(9,175,183,'flower')+leaves(5);
    if(n===8)shape=star(350,233,29,C.silver)+star(370,189,15,C.blue)+orbit(6,175,170);
    if(n===9)shape=silk()+orbit(5,180,170);
    if(n===10)shape=floor()+leaves(8)+orbit(8,187,190,'flower');
    if(n===11)shape=moon(480,310,217)+floor()+orbit(8,204,208);
    if(n===12)shape=moon(480,310,213)+Array.from({length:5},(_,i)=>`<path d="M${277+i*87} ${130+i*35}l45 33" stroke="${C.blue}" stroke-width="3"/>`+star(322+i*87,163+i*35,10,C.silver)).join('');
    if(n===13)shape=ring(480,353,216,233,C.jade)+leaves(12)+orbit(10,217,229,'flower');
    if(n===14)shape=ring(480,353,220,84,C.jade,-32)+ring(480,353,220,84,C.violet,32)+ring(480,353,220,108,C.blue)+orbit(9,220,118);
    if(n===15)shape=moon(480,310,222)+floor()+leaves(12)+orbit(15,222,238)+orbit(7,200,210,'flower');
    const style=animated?'<style>.yt-pulse{animation:yt-float 4s ease-in-out infinite;transform-origin:480px 380px}@keyframes yt-float{0%,100%{opacity:.6;transform:translateY(0)}50%{opacity:1;transform:translateY(-8px)}}@media(prefers-reduced-motion:reduce){.yt-pulse{animation:none}}</style>':'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" aria-hidden="true">${style}<g class="yt-pulse">${shape}</g></svg>`;
  }
  window.YutuEffects=Object.freeze({svg});
})();
