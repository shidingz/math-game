/* Every level cumulatively adds visible Thai-inspired geometry behind the pet. */
(() => {
  const gold='#e5ad38',pale='#ffe49a',teal='#36c3bd',purple='#8e5bd0',ruby='#e55e78';
  const path=(d,c=gold,w=3,fill='none')=>`<path d="${d}" fill="${fill}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ring=(rx,ry,y=579,c=gold,w=3)=>`<ellipse cx="480" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  const star=(x,y,r=8,c=pale)=>`<path d="M${x} ${y-r}Q${x} ${y} ${x+r} ${y}Q${x} ${y} ${x} ${y+r}Q${x} ${y} ${x-r} ${y}Q${x} ${y} ${x} ${y-r}Z" fill="${c}"/>`;
  const gem=(x,y,r=16,c=teal)=>`<path d="M${x} ${y-r}L${x+r*.7} ${y}L${x} ${y+r}L${x-r*.7} ${y}Z" fill="${c}" stroke="${pale}" stroke-width="2"/>`;
  const lotus=(x,y,s=1,c=gold)=>`<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${c}" stroke-width="3"><path d="M0 0Q-14-30 0-49Q14-30 0 0Z"/><path d="M0 0Q-35-20-30-43Q-8-40 0 0Z"/><path d="M0 0Q35-20 30-43Q8-40 0 0Z"/><path d="M0 0Q-42-3-43-25Q-16-28 0 0Z"/><path d="M0 0Q42-3 43-25Q16-28 0 0Z"/></g>`;
  const flame=(x,y,flip=1,s=1)=>`<g transform="translate(${x} ${y}) scale(${flip*s} ${s})">${path('M0 75Q-42 20 2-65Q-8-10 30-22Q55 20 0 75Z',gold,4,'#e5ad3822')}${path('M5 55Q-18 15 7-34Q6-4 28 2Q34 29 5 55Z',teal,3)}</g>`;
  const radial=(n,rx,ry,fn,cy=350,phase=-Math.PI/2)=>Array.from({length:n},(_,i)=>{const a=phase+i*Math.PI*2/n;return fn(480+Math.cos(a)*rx,cy+Math.sin(a)*ry,i);}).join('');
  const motion=(body,type='float')=>`<g class="si-motion si-${type}">${body}</g>`;
  const layers=[
    ()=>`<ellipse cx="480" cy="360" rx="210" ry="225" fill="url(#si-aura)"/>`+lotus(480,596,.42),
    ()=>motion(radial(6,205,170,(x,y)=>star(x,y,8,teal)),'turn'),
    ()=>motion([[-185,90],[185,90],[-160,-80],[160,-80]].map(([x,y],i)=>`<path d="M${480+x} ${350+y}q${i%2?24:-24}-30 ${i%2?40:-40}-58q-2 38 ${i%2?40:-40} 58Z" fill="${pale}" stroke="${gold}" stroke-width="2"/>`).join('')),
    ()=>motion(path('M248 477Q175 345 300 248Q218 390 330 492',teal,7)+path('M712 477Q785 345 660 248Q742 390 630 492',purple,7),'float'),
    ()=>ring(178,35)+ring(205,48,579,teal)+lotus(480,583,.88)+radial(8,196,39,(x,y)=>star(x,y,7),579),
    ()=>path('M300 514V267Q300 188 480 113Q660 188 660 267V514',gold,5)+flame(480,116,1,.42)+gem(447,137,12)+gem(513,137,12),
    ()=>motion([[280,290,teal],[680,290,teal],[250,425,ruby],[710,425,ruby],[480,155,purple],[480,545,gold]].map(([x,y,c],i)=>gem(x,y,15+i%2*4,c)).join('')),
    ()=>motion(radial(8,225,195,(x,y,i)=>lotus(x,y+18,.25,i%2?teal:gold)),'turn'),
    ()=>path('M280 293L370 179L480 142L590 179L680 293M280 430L360 509L480 545L600 509L680 430',purple,2)+[[280,293],[370,179],[480,142],[590,179],[680,293],[280,430],[360,509],[480,545],[600,509],[680,430]].map(([x,y],i)=>gem(x,y,10,i%3===0?ruby:teal)).join(''),
    ()=>motion(path('M268 522V260Q268 145 480 75Q692 145 692 260V522',gold,6)+path('M305 506V282Q305 191 480 121Q655 191 655 282V506',pale,3),'float'),
    ()=>motion(radial(12,242,226,(x,y,i)=>`<g transform="translate(${x} ${y}) rotate(${i*30})">${lotus(0,20,.26,i%2?gold:teal)}</g>`),'turn')+ring(237,56,579,purple),
    ()=>motion(radial(9,252,210,(x,y,i)=>gem(x,y,14+i%3*3,[teal,ruby,purple][i%3])),'slow'),
    ()=>motion([0,1,2].map(i=>flame(310-i*34,405-i*72,-1,.66+i*.14)+flame(650+i*34,405-i*72,1,.66+i*.14)).join('')),
    ()=>motion(path('M245 550C110 360 206 135 365 170C230 290 323 404 275 550Z',teal,2,'url(#si-curtain)')+path('M715 550C850 360 754 135 595 170C730 290 637 404 685 550Z',purple,2,'url(#si-curtain)')),
    ()=>ring(275,70,578,gold,5)+ring(255,58,578,teal,4)+motion(lotus(480,104,.75)+flame(405,117,-1,.5)+flame(555,117,1,.5)+radial(18,278,237,(x,y,i)=>star(x,y,6+i%3*2,i%2?pale:teal)),'float')+motion(Array.from({length:16},(_,i)=>gem(i%2?735+(i%3)*8:225-(i%3)*8,135+Math.floor(i/2)*54,6+i%3,[teal,ruby,purple][i%3])).join(''),'fall')
  ];
  function svg(value){const n=SiameseGameData.clampLevel(value);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" aria-hidden="true" data-effect="siamese-thai-${n}" data-layers="${n}"><defs><radialGradient id="si-aura"><stop stop-color="#fff0bb" stop-opacity=".1"/><stop offset=".7" stop-color="#43c9c3" stop-opacity=".25"/><stop offset="1" stop-color="#7d50c5" stop-opacity="0"/></radialGradient><linearGradient id="si-curtain" x2="1" y2="1"><stop stop-color="#31c8bd" stop-opacity=".56"/><stop offset=".5" stop-color="#f2c75b" stop-opacity=".15"/><stop offset="1" stop-color="#8f55cf" stop-opacity=".58"/></linearGradient></defs><style>.si-float{animation:si-float 4s ease-in-out infinite}.si-turn{transform-origin:480px 350px;animation:si-turn 50s linear infinite}.si-slow{transform-origin:480px 350px;animation:si-turn 70s linear infinite reverse}.si-fall{animation:si-fall 3.7s ease-in-out infinite}@keyframes si-float{50%{transform:translateY(-8px)}}@keyframes si-turn{to{transform:rotate(360deg)}}@keyframes si-fall{50%{transform:translateY(17px);opacity:.6}}@media(prefers-reduced-motion:reduce){.si-motion{animation:none!important}}</style>${layers.slice(0,n).map((make,i)=>`<g data-unlocked-at="${i+1}">${make()}</g>`).join('')}</svg>`;}
  window.SiameseEffects={svg};
})();
