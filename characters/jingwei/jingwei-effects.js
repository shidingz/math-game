/* Jingwei's sea, wind, feathers and island effects are independent of raster art. */
(() => {
  'use strict';
  const C={cyan:'#61d7de',blue:'#3698d0',navy:'#427cac',white:'#e6fcff',coral:'#f58f99',stone:'#8eb7c8',leaf:'#77c49c'};
  const ring=(x,y,rx,ry,color,angle=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="3" transform="rotate(${angle} ${x} ${y})"/>`;
  const pebble=(x,y,s=14)=>`<g transform="translate(${x} ${y})"><path d="M${-s} 0Q${-s*.9} ${-s} 0 ${-s*.8}Q${s} ${-s*.9} ${s} 0Q${s*.8} ${s*.7} 0 ${s*.7}Q${-s} ${s*.9} ${-s} 0Z" fill="${C.stone}" stroke="${C.navy}" stroke-width="2"/><path d="M${-s*.45} ${-s*.2}q${s*.3} ${-s*.35} ${s*.8} ${-s*.12}" fill="none" stroke="${C.white}" stroke-width="2"/></g>`;
  const star=(x,y,s)=>`<path d="M${x} ${y-s}l${s*.3} ${s*.7} ${s*.7} ${s*.3}-${s*.7} ${s*.3}-${s*.3} ${s*.7}-${s*.3}-${s*.7}-${s*.7}-${s*.3} ${s*.7}-${s*.3}Z" fill="${C.white}" stroke="${C.cyan}"/>`;
  const drops=n=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return `<ellipse cx="${480+Math.cos(a)*181}" cy="${365+Math.sin(a)*181}" rx="${i%2?4:6}" ry="${i%2?7:10}" fill="${i%3?C.cyan:C.coral}" transform="rotate(${i*360/n} ${480+Math.cos(a)*181} ${365+Math.sin(a)*181})"/>`;}).join('');
  const stones=(n,rx=180,ry=170)=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return pebble(480+Math.cos(a)*rx,365+Math.sin(a)*ry,12+i%3*3);}).join('');
  const feather=(x,y,a,s=1)=>`<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 30Q-30-5 8-48Q31-10 0 30Z" fill="${C.cyan}" opacity=".8"/><path d="M0 30L8-40M3 10L-10-7M5-8L17-21" stroke="${C.white}" stroke-width="2" fill="none"/></g>`;
  const wind=(color=C.cyan)=>`<path d="M291 430C215 208 703 180 680 347S314 565 316 461" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
  const floor=()=>ring(480,580,179,29,C.blue)+ring(480,580,148,20,C.cyan);
  const island=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${pebble(-13,0,22)}${pebble(14,0,19)}${pebble(0,-17,19)}<path d="M0-25v-23M0-37Q-22-55-20-36Q-8-27 0-37M0-42Q21-61 21-40Q11-32 0-42" fill="${C.leaf}" stroke="${C.leaf}" stroke-width="2"/></g>`;
  const wings=()=>[-1,1].map(sign=>`<g transform="translate(480 370) scale(${sign} 1)"><path d="M100 140Q224 44 222-150Q168-41 101-29Q213-66 200-150" stroke="${C.cyan}" stroke-width="5" fill="none"/>${feather(194,-92,23,.8)}${feather(163,-29,29,.7)}${feather(141,35,36,.6)}</g>`).join('');
  function svg(value,animated=true){
    const n=window.JingweiGameData.clampLevel(value);let shape='';
    if(n===1)shape=drops(5);
    if(n===2)shape=pebble(370,535,20)+star(365,502,10)+drops(4);
    if(n===3)shape=floor();
    if(n===4)shape=feather(320,390,-24)+feather(655,310,32)+drops(5);
    if(n===5)shape=floor()+island(480,566,.75)+drops(6);
    if(n===6)shape=wind()+stones(3)+floor();
    if(n===7)shape=wind(C.coral)+drops(9)+feather(322,295,-22);
    if(n===8)shape=island(480,555,1.15)+floor()+star(480,472,14)+drops(6);
    if(n===9)shape=wind()+ring(480,365,202,83,C.blue,-35)+feather(314,240,-36)+feather(653,425,35);
    if(n===10)shape=floor()+ring(480,365,194,185,C.blue)+stones(5,194,185);
    if(n===11)shape=wings()+floor()+stones(3,199,176);
    if(n===12)shape=wind()+stones(4)+Array.from({length:6},(_,i)=>star(290+i*77,188+(i%3)*35,9)).join('')+floor();
    if(n===13)shape=floor()+island(356,568,.65)+island(480,591,.82)+island(606,568,.65)+wind();
    if(n===14)shape=ring(480,355,225,85,C.cyan,-32)+ring(480,355,225,85,C.blue,32)+ring(480,355,223,108,C.coral)+stones(5,220,114);
    if(n===15)shape=wings()+floor()+island(350,568,.7)+island(612,568,.7)+wind(C.coral)+stones(5,216,187)+drops(12);
    const style=animated?'<style>.jw-pulse{animation:jw-breeze 4s ease-in-out infinite;transform-origin:480px 380px}@keyframes jw-breeze{0%,100%{opacity:.6;transform:translateY(0)}50%{opacity:1;transform:translateY(-8px)}}@media(prefers-reduced-motion:reduce){.jw-pulse{animation:none}}</style>':'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" aria-hidden="true">${style}<g class="jw-pulse">${shape}</g></svg>`;
  }
  window.JingweiEffects=Object.freeze({svg});
})();
