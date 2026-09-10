/* Code-native, transparent SVG growth effects. Same artwork used by player and exports. */
(() => {
  'use strict';
  const C={pink:'#f38fa7',red:'#ef655b',gold:'#f2bf58',jade:'#69cbbf',light:'#ffe5ac'};
  const fmt=n=>Number(n.toFixed(2));
  const star=(x,y,r,color=C.gold)=>{
    const pts=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,s=i%2?r*.43:r;return `${fmt(x+Math.cos(a)*s)},${fmt(y+Math.sin(a)*s)}`;}).join(' ');
    return `<polygon points="${pts}" fill="${color}"/>`;
  };
  const ellipse=(x,y,rx,ry,color,rotate=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="4" transform="rotate(${rotate} ${x} ${y})"/>`;
  const petal=(x,y,s,angle,color)=>`<path d="M0 0 Q${-s} ${-s} 0 ${-s*2} Q${s} ${-s} 0 0Z" fill="${color}" fill-opacity=".45" stroke="${color}" stroke-width="2" transform="translate(${x} ${y}) rotate(${angle})"/>`;
  const lotus=(x,y,s,color)=>Array.from({length:7},(_,i)=>petal(x,y,s,(i-3)*25,color)).join('');
  const sparks=(x,y,rx,ry,n)=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return star(fmt(x+Math.cos(a)*rx),fmt(y+Math.sin(a)*ry),i%2?6:9,i%2?C.pink:C.gold);}).join('');
  const wheel=(x,y,r)=>`<g>${ellipse(x,y,r,r,C.gold)}${ellipse(x,y,r*.68,r*.68,C.red)}${Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return `<path d="M${x} ${y}L${fmt(x+Math.cos(a)*r*.85)} ${fmt(y+Math.sin(a)*r*.85)}" stroke="${C.gold}" stroke-width="3"/>`;}).join('')}</g>`;
  const ribbons=(count)=>Array.from({length:count},(_,i)=>`<path d="M${290+i*20} ${420-i*35} C200 ${190+i*30} 740 ${170+i*40} 665 ${430+i*15} S320 580 295 465" stroke="${i%2?C.pink:C.red}" stroke-width="${7-i}" fill="none" stroke-linecap="round" opacity=".8"/>`).join('');
  function svg(value,animated=true) {
    const level=window.NezhaGameData.clampLevel(value);
    let shape='';
    if(level===1)shape=sparks(480,365,130,130,6);
    if(level===2)shape=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return petal(fmt(480+Math.cos(a)*150),fmt(365+Math.sin(a)*150),11,i*45,C.pink);}).join('');
    if(level===3)shape=ellipse(480,567,155,31,C.gold)+sparks(480,567,155,31,6);
    if(level===4)shape=ribbons(2);
    if(level===5)shape=lotus(480,586,52,C.pink)+ellipse(480,586,146,26,C.gold);
    if(level===6)shape=wheel(410,575,36)+wheel(550,575,36)+sparks(480,570,137,45,6);
    if(level===7)shape=ribbons(3)+sparks(480,375,175,140,5);
    if(level===8)shape=ellipse(480,355,180,73,C.gold,-25)+ellipse(480,355,180,73,C.red,25);
    if(level===9)shape=`<path d="M320 370L375 150M310 370L365 150" stroke="${C.gold}" stroke-width="4"/>`+star(375,150,23,C.red)+sparks(405,240,55,100,5);
    if(level===10)shape=wheel(405,574,40)+wheel(555,574,40)+ellipse(480,570,188,50,C.red)+sparks(480,570,188,50,10);
    if(level===11)shape=lotus(480,598,74,C.jade)+ellipse(480,587,189,34,C.gold)+sparks(480,587,190,45,6);
    if(level===12)shape=Array.from({length:5},(_,i)=>`<path d="M${290+i*73} ${175+i*33}l58 27" stroke="${i%2?C.red:C.gold}" stroke-width="4" stroke-linecap="round"/>`+star(348+i*73,202+i*33,10)).join('');
    if(level===13)shape=lotus(480,594,210,C.jade)+ellipse(480,352,205,237,C.jade);
    if(level===14)shape=ellipse(480,355,207,75,C.gold,-38)+ellipse(480,355,207,75,C.red,38)+ellipse(480,355,216,99,C.jade)+sparks(480,355,215,120,10);
    if(level===15)shape=lotus(480,599,80,C.jade)+ellipse(480,350,218,230,C.gold)+sparks(480,350,218,230,12)+wheel(397,573,37)+wheel(563,573,37)+ribbons(2);
    const style=animated?`<style>.nz-pulse{animation:nz-pulse 3.4s ease-in-out infinite;transform-origin:480px 380px}@keyframes nz-pulse{0%,100%{opacity:.65;transform:translateY(0)}50%{opacity:1;transform:translateY(-7px)}}@media(prefers-reduced-motion:reduce){.nz-pulse{animation:none}}</style>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" aria-hidden="true">${style}<g class="nz-pulse">${shape}</g></svg>`;
  }
  window.NezhaEffects=Object.freeze({svg});
})();
