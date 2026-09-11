/* Fifteen cumulative cloud-and-starlight effects. */
(() => {
const blue='#398bd9',cyan='#40c6dc',violet='#8877df',silver='#e9f6ff';
const path=(d,c=blue,w=3,fill='none')=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round"/>`;
const star=(x,y,s=9,c=cyan)=>path(`M${x} ${y-s} L${x+s*.3} ${y-s*.3} L${x+s} ${y} L${x+s*.3} ${y+s*.3} L${x} ${y+s} L${x-s*.3} ${y+s*.3} L${x-s} ${y} L${x-s*.3} ${y-s*.3} Z`,blue,1.5,c);
const cloud=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M-45 12 C-70 10 -62 -18 -40 -17 C-36 -51 11 -55 20 -26 C53 -39 72 5 46 12 Z',blue,3,'#e9f6ffd9')}${path('M-34 1 Q-21 -9 -10 1 Q3 12 19 1',cyan,2)}</g>`;
const ring=(rx,ry,y=578,c=blue)=>`<ellipse cx="480" cy="${y}" rx="${rx}" ry="${ry}" stroke="${c}" stroke-width="3" fill="none"/>`;
const orbit=(n,rx,ry,fn,cy=345)=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n-Math.PI/2;return fn(480+rx*Math.cos(a),cy+ry*Math.sin(a),i)}).join('');
const motion=(s,t='float')=>`<g class="bi-motion bi-${t}">${s}</g>`;
const layers=[
()=>`<ellipse cx="480" cy="375" rx="222" ry="215" fill="url(#bi-aura)"/>`+cloud(480,581,.7)+star(330,305,8)+star(635,288,8),
()=>motion(orbit(8,200,177,(x,y,i)=>star(x,y,7+i%3*2)),'turn'),
()=>motion(cloud(276,413,.62)+cloud(687,397,.7)+cloud(355,213,.44)),
()=>ring(180,32)+ring(210,46,578,cyan)+orbit(8,196,37,(x,y)=>star(x,y,7),578),
()=>motion(path('M255 448 C161 315 260 145 394 182',cyan,7)+path('M705 448 C799 315 700 145 566 182',blue,7)+cloud(480,178,.5)),
()=>path('M274 506 V304 Q285 112 480 112 Q675 112 686 304 V506',blue,5)+motion(cloud(480,145,.8)+star(480,97,22,silver)),
()=>motion(orbit(6,235,193,(x,y,i)=>cloud(x,y,.28+i%2*.1)),'slow'),
()=>path('M270 296 L354 202 L480 173 L606 202 L690 296 M270 455 L356 506 L600 506 L690 455',cyan,3)+[[270,296],[354,202],[480,173],[606,202],[690,296],[270,455],[356,506],[600,506],[690,455]].map(([x,y])=>star(x,y,12,silver)).join(''),
()=>motion(Array.from({length:8},(_,i)=>{const x=i%2?713:248,y=179+Math.floor(i/2)*98;return path(`M${x-28} ${y-38} L${x} ${y}`,cyan,4)+star(x,y,12)}).join(''),'fall'),
()=>motion(path('M252 535 C145 376 224 202 346 150 C262 300 335 425 284 543 Z',blue,2,'url(#bi-ribbon)')+path('M708 535 C815 376 736 202 614 150 C698 300 625 425 676 543 Z',violet,2,'url(#bi-ribbon)')),
()=>ring(237,56,580,violet)+motion(orbit(12,244,222,(x,y,i)=>star(x,y,12+i%2*5,i%2?cyan:silver)),'turn')+cloud(480,118,.65),
()=>motion([0,1,2].map(i=>cloud(231-i*7,490-i*119,.63)+cloud(729+i*7,490-i*119,.63)).join('')),
()=>motion([0,1,2].map(i=>path(`M${350+i*9} ${425+i*23} Q${214-i*13} ${379+i*5} ${208-i*6} ${205+i*49} Q${281-i*5} ${294+i*41} ${361+i*9} ${369+i*28} Z`,blue,3,'#8dd8ff66')+path(`M${610-i*9} ${425+i*23} Q${746+i*13} ${379+i*5} ${752+i*6} ${205+i*49} Q${679+i*5} ${294+i*41} ${599-i*9} ${369+i*28} Z`,cyan,3,'#abc7ff77')).join('')),
()=>motion(`<g transform="rotate(28 480 345)">${ring(270,122,345,cyan)}${orbit(10,270,122,(x,y)=>star(x,y,8))}</g><g transform="rotate(-28 480 345)">${ring(270,122,345,violet)}</g>`,'slow'),
()=>ring(277,73,582,blue)+ring(292,85,582,cyan)+motion(star(480,73,32,silver)+cloud(395,116,.48)+cloud(565,116,.48)+orbit(24,282,238,(x,y,i)=>star(x,y,6+i%4*2,i%2?cyan:silver)))+motion(Array.from({length:18},(_,i)=>star(i%2?753:207,140+Math.floor(i/2)*49,5+i%3)).join(''),'fall')
];
function svg(value){const n=BichonGameData.clampLevel(value);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" data-effect="bichon-sky-${n}" data-layers="${n}" aria-hidden="true"><defs><radialGradient id="bi-aura"><stop stop-color="#64c3ff" stop-opacity=".08"/><stop offset=".7" stop-color="#369bee" stop-opacity=".32"/><stop offset="1" stop-color="#72c8ff" stop-opacity="0"/></radialGradient><linearGradient id="bi-ribbon" x2="1" y2="1"><stop stop-color="#49caff" stop-opacity=".65"/><stop offset=".5" stop-color="#88bcff" stop-opacity=".1"/><stop offset="1" stop-color="#9c8cf3" stop-opacity=".6"/></linearGradient></defs><style>.bi-float{animation:bi-float 4s ease-in-out infinite}.bi-turn,.bi-slow{transform-origin:480px 345px;animation:bi-turn 52s linear infinite}.bi-slow{animation-direction:reverse;animation-duration:73s}.bi-fall{animation:bi-fall 4s ease-in-out infinite}@keyframes bi-float{50%{transform:translateY(-9px)}}@keyframes bi-turn{to{transform:rotate(360deg)}}@keyframes bi-fall{50%{transform:translateY(18px);opacity:.5}}@media(prefers-reduced-motion:reduce){.bi-motion{animation:none!important}}</style>${layers.slice(0,n).map((f,i)=>`<g data-unlocked-at="${i+1}">${f()}</g>`).join('')}</svg>`;}
window.BichonEffects={svg};
})();

