/* Police corgi: every level retains its previous layers and adds new geometry. */
(()=>{
const blue='#388eff',cyan='#41d8ee',silver='#e7f4ff',gold='#ffce68';
const path=(d,c=blue,w=3,fill='none')=>`<path d="${d}" stroke="${c}" stroke-width="${w}" fill="${fill}" stroke-linejoin="round" stroke-linecap="round"/>`;
const star=(x,y,s=9,c=silver)=>path(`M${x} ${y-s} L${x+s*.3} ${y-s*.3} L${x+s} ${y} L${x+s*.3} ${y+s*.3} L${x} ${y+s} L${x-s*.3} ${y+s*.3} L${x-s} ${y} L${x-s*.3} ${y-s*.3} Z`,blue,2,c);
const shield=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${path('M0 -42 L36 -28 V4 Q30 31 0 47 Q-30 31 -36 4 V-28 Z',cyan,4,'#194f9844')}${star(0,0,18,gold)}</g>`;
const paw=(x,y,s=.8)=>`<g transform="translate(${x} ${y}) scale(${s})" fill="${silver}" stroke="${blue}" stroke-width="2"><ellipse cy="8" rx="14" ry="11"/><ellipse cx="-15" cy="-6" rx="6" ry="8"/><ellipse cx="-5" cy="-14" rx="6" ry="8"/><ellipse cx="8" cy="-13" rx="6" ry="8"/><ellipse cx="19" cy="-4" rx="6" ry="8"/></g>`;
const ring=(rx,ry,y=579,c=blue)=>`<ellipse cx="480" cy="${y}" rx="${rx}" ry="${ry}" stroke="${c}" stroke-width="3" fill="none"/>`;
const orbit=(n,rx,ry,fn,cy=342)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n-Math.PI/2;return fn(480+rx*Math.cos(a),cy+ry*Math.sin(a),i)}).join('');
const move=(html,type='float')=>`<g class="cg-motion cg-${type}">${html}</g>`;
const layers=[
()=>'<ellipse cx="480" cy="377" rx="215" ry="223" fill="url(#cg-aura)"/>'+paw(424,580)+paw(536,580),
()=>move(orbit(8,196,180,(x,y)=>star(x,y,8)),'spin'),
()=>ring(179,32)+ring(205,46,579,cyan),
()=>move(paw(279,389)+paw(680,389)+paw(312,237)+paw(648,237)),
()=>move(path('M280 498 V286 Q290 172 387 144',cyan,5)+path('M680 498 V286 Q670 172 573 144',blue,5)+shield(480,180,.7)),
()=>ring(218,53)+move(shield(480,122,1)+star(404,149,12)+star(556,149,12)),
()=>move(path('M480 342 L480 132 A210 210 0 0 1 690 342 Z',cyan,2,'#40cfee22'),'spin'),
()=>path('M269 434 L247 329 L308 228 L398 190 M691 434 L713 329 L652 228 L562 190',blue,4)+[[269,434],[247,329],[308,228],[398,190],[691,434],[713,329],[652,228],[562,190]].map(([x,y])=>star(x,y,11)).join(''),
()=>move(orbit(6,239,216,(x,y)=>shield(x,y,.32)),'reverse'),
()=>move(path('M250 543 L293 151 L371 543 Z',cyan,2,'url(#cg-light)')+path('M710 543 L667 151 L589 543 Z',blue,2,'url(#cg-light)')),
()=>path('M480 94 L698 194 L682 430 Q620 527 480 569 Q340 527 278 430 L262 194 Z',cyan,5,'#1260b714')+move(star(480,77,26,gold)),
()=>move([0,1,2].map(i=>shield(241,264+i*108,.48)+shield(719,264+i*108,.48)).join('')),
()=>move([0,1,2].map(i=>path(`M${355+i*10} ${435+i*20} L${215-i*12} ${247+i*60} L${267-i*7} ${442+i*28} Z`,blue,3,'#3a99ee55')+path(`M${605-i*10} ${435+i*20} L${745+i*12} ${247+i*60} L${693+i*7} ${442+i*28} Z`,cyan,3,'#77d4f955')).join('')),
()=>move(`<g transform="rotate(30 480 342)">${ring(265,112,342,cyan)}</g><g transform="rotate(-30 480 342)">${ring(265,112,342,blue)}</g>`,'reverse')+move(orbit(16,272,232,(x,y,i)=>star(x,y,7+i%3*2)),'spin'),
()=>ring(274,74,582,cyan)+ring(292,86,582,gold)+move(shield(480,97,.72)+orbit(28,282,242,(x,y,i)=>star(x,y,6+i%4*2,i%3?silver:gold)))+move(Array.from({length:12},(_,i)=>{const x=i%2?746:214,y=150+Math.floor(i/2)*70;return path(`M${x-14} ${y-25} L${x} ${y}`,cyan,3)+star(x,y,8)}).join(''),'rain')
];
function svg(value){const n=CorgiGameData.clampLevel(value);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" data-effect="corgi-patrol-${n}" data-layers="${n}" aria-hidden="true"><defs><radialGradient id="cg-aura"><stop stop-color="#8bc9ff" stop-opacity=".08"/><stop offset=".72" stop-color="#257ddb" stop-opacity=".36"/><stop offset="1" stop-color="#57cfff" stop-opacity="0"/></radialGradient><linearGradient id="cg-light" x2="0" y2="1"><stop stop-color="#67d8ff" stop-opacity=".65"/><stop offset="1" stop-color="#579fff" stop-opacity="0"/></linearGradient></defs><style>.cg-float{animation:cg-float 4s ease-in-out infinite}.cg-spin,.cg-reverse{transform-origin:480px 342px;animation:cg-spin 48s linear infinite}.cg-reverse{animation-direction:reverse;animation-duration:67s}.cg-rain{animation:cg-rain 4s ease-in-out infinite}@keyframes cg-float{50%{transform:translateY(-8px)}}@keyframes cg-spin{to{transform:rotate(360deg)}}@keyframes cg-rain{50%{transform:translateY(15px);opacity:.45}}@media(prefers-reduced-motion:reduce){.cg-motion{animation:none!important}}</style>${layers.slice(0,n).map((f,i)=>`<g data-unlocked-at="${i+1}">${f()}</g>`).join('')}</svg>`;}
window.CorgiEffects={svg};
})();
