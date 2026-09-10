/* Character-independent, low-frequency behaviour. Pauses while answering or feeding. */
(() => {
  class PetInteraction {
    constructor(adapter,config,onMessage,{rng=Math.random,minDelay=10000,maxDelay=18000}={}){
      Object.assign(this,{adapter,config,onMessage,rng,minDelay,maxDelay});this.enabled=true;this.destroyed=false;this.last=null;this.lastClick=0;
      this.motion=matchMedia('(prefers-reduced-motion: reduce)');
      this.offInteract=adapter.on('interact',e=>{e.preventDefault();this.interact();});
      this.offEnd=adapter.on('actionEnd',()=>this.schedule());
      this.onVisibility=()=>{this.clear();if(!document.hidden)this.setEnabled(this.enabled);};document.addEventListener('visibilitychange',this.onVisibility);
      this.onMotion=()=>this.setEnabled(this.enabled);this.motion.addEventListener('change',this.onMotion);this.schedule();
    }
    clear(){clearTimeout(this.timer);clearTimeout(this.wakeTimer);}
    setEnabled(value){this.enabled=value;this.clear();if(value){if(this.adapter.action==='sleep')this.adapter.play('idle');this.schedule();}}
    choose(pool){const action=MathPetCore.pick(pool,this.last,this.rng);this.last=action;return action;}
    perform(action){
      this.clear();this.adapter.play(action);
      const lines=this.config.messages[action]||this.config.messages.idle;this.onMessage(MathPetCore.pick(lines,null,this.rng));
      if(action==='sleep')this.wakeTimer=setTimeout(()=>{if(this.enabled&&!this.destroyed&&this.adapter.action==='sleep'){this.adapter.play('idle');this.schedule();}},3600);
    }
    interact(){if(!this.enabled||document.hidden||performance.now()-this.lastClick<450)return;this.lastClick=performance.now();this.perform(this.choose(this.config.clickActions));}
    schedule(){
      clearTimeout(this.timer);if(!this.enabled||this.destroyed||document.hidden||this.motion.matches)return;
      this.timer=setTimeout(()=>{if(this.adapter.action==='idle')this.perform(this.choose(this.config.idleActions));else this.schedule();},this.minDelay+this.rng()*(this.maxDelay-this.minDelay));
    }
    destroy(){this.destroyed=true;this.clear();this.offInteract();this.offEnd();document.removeEventListener('visibilitychange',this.onVisibility);this.motion.removeEventListener('change',this.onMotion);}
  }
  window.PetInteraction=PetInteraction;
})();
