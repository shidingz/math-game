/* Shared full-screen level-up presentation. Economy and saved state stay in app.js. */
(() => {
  'use strict';
  class PetLevelUp {
    constructor(){this.active=null;}
    cancel(){this.active?.finish(false);}
    play({config,origin,level,previous,preview=false}){
      if(!config?.create||!origin)return Promise.resolve(false);
      this.cancel();
      const visual=Math.min(15,level),evolved=level>previous&&[6,11].some(n=>previous<n&&level>=n);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const source=origin.getBoundingClientRect(),focus=document.activeElement,visibility=origin.style.visibility,bodyOverflow=document.body.style.overflow;
      const dialog=document.createElement('dialog');dialog.className='pet-upgrade';dialog.setAttribute('aria-labelledby','pet-upgrade-title');dialog.setAttribute('data-pet',config.id);
      const palette=config.ui?.palette||{};
      for(const [key,value] of Object.entries({primary:palette.primary||'#398c75',dark:palette.primaryDark||'#173d55',accent:palette.accent||'#70b79a',surface:palette.surface||'#fff4ce',muted:palette.sceneLine||'#c7e4ea'}))dialog.style.setProperty?.(`--upgrade-${key}`,value);
      dialog.innerHTML=`<div class="pet-upgrade-aura" aria-hidden="true"></div><div class="pet-upgrade-sparks" aria-hidden="true"></div><header class="pet-upgrade-heading"><p class="pet-upgrade-kicker"></p><h2 id="pet-upgrade-title"></h2><p class="pet-upgrade-level"></p><p class="pet-upgrade-detail"></p></header><div class="pet-upgrade-stage" aria-hidden="true" inert></div><p class="pet-upgrade-loading" role="status"></p><footer class="pet-upgrade-footer"><p>每一点进步，都让伙伴更强一点。</p><button type="button" class="pet-upgrade-done">太棒了，继续陪伴</button></footer>`;
      dialog.querySelector('.pet-upgrade-kicker').textContent=preview?`${config.name}成长展示`:evolved?'新形态 · 新本领':'一起努力的成果';
      dialog.querySelector('h2').textContent=evolved?`${config.name}进化啦！`:`${config.name}升级啦！`;
      dialog.querySelector('.pet-upgrade-level').textContent=previous<level?`Lv.${previous} → Lv.${level}`:`Lv.${level}`;
      const stage=config.stages[Math.floor((visual-1)/5)];
      dialog.querySelector('.pet-upgrade-detail').textContent=stage.name+' · '+(level>15?'继续成长，一直陪伴':config.effects[visual-1].name);
      dialog.querySelector('.pet-upgrade-loading').textContent=`${config.name}准备登场…`;
      const sparks=dialog.querySelector('.pet-upgrade-sparks');
      for(let i=0;i<18;i++){const star=document.createElement('i');star.textContent=i%3?'✦':'✧';star.style.cssText=`--x:${(i*37)%96}%;--y:${10+(i*23)%80}%;--delay:${i%5*.13}s;--size:${12+i%4*6}px`;sparks.append(star);}
      const stageEl=dialog.querySelector('.pet-upgrade-stage'),actor=config.create({level:visual});stageEl.append(actor.element);
      let resolve,closed=false,returning=false,started=false,timer,loadTimer,animation;
      const offs=[],promise=new Promise(done=>resolve=done);
      const restore=()=>{
        if(closed)return;closed=true;clearTimeout(timer);clearTimeout(loadTimer);animation?.cancel();offs.forEach(off=>off());
        document.removeEventListener('visibilitychange',onHidden);
        actor.destroy();origin.style.visibility=visibility;document.body.style.overflow=bodyOverflow;
        if(dialog.open)dialog.close();dialog.remove();
        if(this.active===session)this.active=null;
        if(focus?.isConnected)focus.focus({preventScroll:true});resolve(true);
      };
      const transformFrom=rect=>{
        const target=stageEl.getBoundingClientRect();
        return `translate(${rect.left+rect.width/2-target.left-target.width/2}px,${rect.top+rect.height/2-target.top-target.height/2}px) scale(${rect.width/target.width||.4})`;
      };
      const finish=(animated=true)=>{
        if(closed)return;
        if(!animated){restore();return;}
        if(returning)return;returning=true;clearTimeout(timer);clearTimeout(loadTimer);
        if(reduced||!started){restore();return;}
        animation?.cancel();actor.play('wave');dialog.classList.add('is-leaving');
        animation=stageEl.animate([{transform:'none',opacity:1},{transform:transformFrom(origin.getBoundingClientRect()),opacity:.3}],{duration:360,easing:'cubic-bezier(.4,0,.8,1)',fill:'forwards'});
        timer=setTimeout(restore,360);
      };
      const onHidden=()=>{if(document.hidden)finish(false);};
      const session={finish};this.active=session;
      offs.push(actor.on('ready',()=>{
        if(closed||started)return;started=true;clearTimeout(loadTimer);dialog.classList.add('is-ready');
        dialog.querySelector('.pet-upgrade-loading').hidden=true;
        if(!reduced)animation=stageEl.animate([{transform:transformFrom(source),opacity:.4},{transform:'translateY(-12px) scale(1.04)',opacity:1,offset:.8},{transform:'none',opacity:1}],{duration:600,easing:'cubic-bezier(.2,.8,.2,1)'});
        actor.play('celebrate');actor.element.previewEffect?.();
        timer=setTimeout(()=>{
          if(closed||returning)return;actor.play(evolved?'skill':'wave');
          timer=setTimeout(()=>finish(),reduced?650:evolved?1800:1200);
        },reduced?750:1800);
      }));
      offs.push(actor.on('error',()=>finish(false)));
      dialog.querySelector('button').addEventListener('click',()=>finish());
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
      document.addEventListener('visibilitychange',onHidden);
      try{
        document.body.append(dialog);dialog.showModal();origin.style.visibility='hidden';document.body.style.overflow='hidden';
        dialog.querySelector('button').focus({preventScroll:true});loadTimer=setTimeout(()=>finish(false),6000);
      }catch(error){restore();}
      return promise;
    }
  }
  window.PetLevelUp=PetLevelUp;
  window.WukongLevelUp=PetLevelUp;
})();
