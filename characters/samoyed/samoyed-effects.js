/* Cumulative, bounded SVG layers: every visual level adds actual geometry.
   Effects stay behind the pet and remain legible on the light snow theme. */
(() => {
  const blue='#438fec',ice='#8cddff',violet='#8470ee',white='#edfcff';
  const path=(d,c=blue,w=3,fill='none')=>`<path d="${d}" fill="${fill}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const star=(x,y,r=10,c=white)=>`<path d="M${x} ${y-r}q0 ${r} ${r} ${r}q-${r} 0-${r} ${r}q0-${r}-${r}-${r}q${r} 0 ${r}-${r}Z" fill="${c}" stroke="${blue}" stroke-width="1"/>`;
  const crystal=(x,y,r=18)=>`<g transform="translate(${x} ${y})">${path(`M0 -${r}L${r*.6} 0 0 ${r} -${r*.6} 0Z`,blue,2,ice)}${path(`M0 -${r}V${r}`,white,2)}</g>`;
  const snow=(x,y,r=13)=>`<g transform="translate(${x} ${y})">${Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60})">${path(`M0 0V-${r}M0 -${r*.5}l-${r*.3}-${r*.25}M0 -${r*.5}l${r*.3}-${r*.25}`,ice,2.6)}</g>`).join('')}</g>`;
  const ellipse=(rx,ry,y=570,c=blue)=>`<ellipse cx="480" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="3"/>`;
  const radial=(count,rx,ry,fn,cy=345,phase=-Math.PI/2)=>Array.from({length:count},(_,i)=>{const a=phase+i*Math.PI*2/count;return fn(480+Math.cos(a)*rx,cy+Math.sin(a)*ry,i);}).join('');
  const motion=(body,type='float')=>`<g class="sy-motion sy-${type}">${body}</g>`;
  const layers=[
    ()=>`<ellipse cx="480" cy="374" rx="218" ry="226" fill="url(#sy-aura)"/>`+motion(radial(8,210,165,(x,y,i)=>star(x,y,5+i%3))),
    ()=>motion(radial(6,205,184,(x,y)=>snow(x,y,15)),'turn'),
    ()=>motion([[-190,-90],[190,-90],[-205,80],[205,80]].map(([x,y])=>crystal(480+x,355+y,22)).join('')),
    ()=>ellipse(184,35)+ellipse(210,48,570,ice)+radial(8,185,35,(x,y)=>star(x,y,8),570),
    ()=>`<circle cx="480" cy="345" r="208" fill="none" stroke="${blue}" stroke-width="2" stroke-dasharray="5 12"/>`+motion(radial(10,208,208,(x,y)=>star(x,y,8)),'turn'),
    ()=>path('M480 126L675 237V453L480 563L285 453V237Z',blue,4)+motion(snow(480,124,29)+crystal(447,138,15)+crystal(513,138,15)),
    ()=>motion([0,1,2].map(i=>path(`M${287-i*10} ${470-i*77}Q${205-i*12} ${422-i*80} ${274-i*4} ${345-i*75}`,ice,7)+path(`M${673+i*10} ${470-i*77}Q${755+i*12} ${422-i*80} ${686+i*4} ${345-i*75}`,blue,5)).join('')),
    ()=>path('M290 285L370 177L575 193L681 296M284 432L333 500L619 510L686 428',violet,2)+[[290,285],[370,177],[575,193],[681,296],[284,432],[333,500],[619,510],[686,428]].map(([x,y])=>star(x,y,12)).join(''),
    ()=>motion([0,1,2,3].map(i=>{const x=i%2?680:260,y=185+Math.floor(i/2)*205;return path(`M${x-28} ${y-48}L${x} ${y}`,ice,4)+star(x,y,12);}).join('')+radial(6,239,198,(x,y)=>crystal(x,y,13)),'fall'),
    ()=>motion(path('M265 538C155 358 236 197 344 144C227 278 306 383 265 538Z',blue,2,'url(#sy-curtain)')+path('M695 538C805 358 724 197 616 144C733 278 654 383 695 538Z',violet,2,'url(#sy-curtain)')),
    ()=>motion(radial(12,235,235,(x,y,i)=>`<g transform="translate(${x} ${y}) rotate(${i*30})">${path('M0 -21L10 0 0 21 -10 0Z',violet,2,'#87c8ff55')}</g>`),'turn')+ellipse(239,57,573,violet),
    ()=>motion([0,1,2].map(i=>crystal(245-i*10,470-i*116,33+i*4)+crystal(715+i*10,470-i*116,33+i*4)).join('')),
    ()=>motion(`<g transform="rotate(32 480 345)">${ellipse(254,128,345,ice)}${radial(8,254,128,(x,y)=>star(x,y,10))}</g><g transform="rotate(-32 480 345)">${ellipse(254,128,345,violet)}</g>`,'slow'),
    ()=>motion([0,1,2].map(i=>path(`M${343+i*10} ${385+i*34}Q${233-i*16} ${275+i*20} ${210-i*7} ${202+i*46}Q${245-i*10} ${377+i*19} ${322+i*8} ${438+i*22}`,ice,4,'#62aeef28')+path(`M${617-i*10} ${385+i*34}Q${727+i*16} ${275+i*20} ${750+i*7} ${202+i*46}Q${715+i*10} ${377+i*19} ${638-i*8} ${438+i*22}`,violet,4,'#8995f433')).join('')),
    ()=>ellipse(268,67,570,violet)+ellipse(280,78,570,ice)+motion(snow(480,83,35)+crystal(432,99,23)+crystal(528,99,23)+radial(16,268,235,(x,y,i)=>star(x,y,7+i%3*3)),'float')+motion(Array.from({length:16},(_,i)=>{const x=i%2?724+(i%3)*10:236-(i%3)*10;return star(x,130+Math.floor(i/2)*57,5,ice);}).join(''),'fall')
  ];
  function svg(value){const n=SamoyedGameData.clampLevel(value);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" aria-hidden="true" data-effect="samoyed-snow-${n}" data-layers="${n}"><defs><radialGradient id="sy-aura"><stop stop-color="#c0cfff" stop-opacity=".04"/><stop offset=".73" stop-color="#759fe8" stop-opacity=".2"/><stop offset="1" stop-color="#4789dc" stop-opacity="0"/></radialGradient><linearGradient id="sy-curtain" x2="1" y2="1"><stop stop-color="#5ad7ff" stop-opacity=".55"/><stop offset=".52" stop-color="#6a96fc" stop-opacity=".12"/><stop offset="1" stop-color="#9374eb" stop-opacity=".55"/></linearGradient></defs><style>.sy-float{animation:sy-float 4s ease-in-out infinite}.sy-turn{transform-origin:480px 345px;animation:sy-turn 48s linear infinite}.sy-slow{transform-origin:480px 345px;animation:sy-turn 65s linear infinite reverse}.sy-fall{animation:sy-fall 3.8s ease-in-out infinite}@keyframes sy-float{50%{transform:translateY(-7px)}}@keyframes sy-turn{to{transform:rotate(360deg)}}@keyframes sy-fall{50%{transform:translateY(16px);opacity:.6}}@media(prefers-reduced-motion:reduce){.sy-motion{animation:none!important}}</style>${layers.slice(0,n).map((make,i)=>`<g data-unlocked-at="${i+1}">${make()}</g>`).join('')}</svg>`;}
  window.SamoyedEffects={svg};
})();
