/* Corgi standalone Web Component. Load corgi-data.js and corgi-effects.js first. */
(() => {
  'use strict';
  const D=window.CorgiGameData, FX=window.CorgiEffects;
  if(!D||!FX)throw new Error('请先加载 corgi-data.js 和 corgi-effects.js');
  const scriptBase=new URL('.',document.currentScript.src);
  const cache=new Map();
  const loadImage=url=>{
    if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{
      const im=new Image();im.onload=()=>resolve(im);
      im.onerror=()=>{cache.delete(url);reject(new Error('素材未能加载：'+url));};im.src=url;
    }));return cache.get(url);
  };
  class CorgiGamePet extends HTMLElement {
    static get observedAttributes(){return ['level','asset-base','auto-idle'];}
    constructor(){
      super();this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML=`<style>
        :host{display:block;width:100%;aspect-ratio:960/680;min-width:0;position:relative}
        .shell{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
        canvas,.fx{position:absolute;inset:0;width:100%;height:100%}.fx{pointer-events:none;opacity:var(--fx-opacity,.34);filter:drop-shadow(0 0 var(--fx-glow,4px) #40c6dc);transition:opacity .3s,filter .3s}.fx svg{display:block;width:100%;height:100%}
        .fx.burst{opacity:1;filter:drop-shadow(0 0 10px #e9f6ff) drop-shadow(0 0 20px #438bdc)}.shell.frozen .cg-motion,.shell.frozen .cg-motion *{animation-play-state:paused!important}
        canvas{touch-action:pan-y;outline:none}canvas:focus-visible{outline:3px solid #438bdc;outline-offset:-4px;border-radius:24px}
        .status{position:absolute;top:43%;left:8%;right:8%;text-align:center;font:14px system-ui;color:#5b6475;pointer-events:none}.status:empty{display:none}
        @media(prefers-reduced-motion:reduce){.fx{transition:none}.cg-motion{animation:none!important}}
      </style><div class="shell"><div class="fx"></div><canvas width="960" height="680" role="button" tabindex="0" aria-label="柯基犬，点击随机互动；左右方向键移动，空格互动"></canvas><span class="status" role="status">正在准备柯基犬…</span></div>`;
      this.shell=this.shadowRoot.querySelector('.shell');this.canvas=this.shadowRoot.querySelector('canvas');
      this.ctx=this.canvas.getContext('2d');const pixelRatio=Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1));if(pixelRatio>1&&typeof this.ctx.setTransform==='function'){this.canvas.width=Math.round(960*pixelRatio);this.canvas.height=Math.round(680*pixelRatio);this.ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);}this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.fx=this.shadowRoot.querySelector('.fx');this.status=this.shadowRoot.querySelector('.status');
      this._level=1;this._action='idle';this._t=0;this._start=0;this._last=0;this._x=480;this._target=480;this._dir=1;
      this._paused=false;this._atlas=null;this._token=0;this._fxUntil=0;this._nextIdle=Infinity;this._previousRandom='';this._pose=null;
      this._motion=matchMedia('(prefers-reduced-motion: reduce)');this._onMotion=()=>this._scheduleIdle();
      this._tick=this._tick.bind(this);
      this.canvas.addEventListener('click',()=>this.interact());
      this.canvas.addEventListener('keydown',e=>{
        if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){
          e.preventDefault();e.key==='ArrowLeft'?this.moveTo(.32):e.key==='ArrowRight'?this.moveTo(.68):this.interact();
        }
      });
    }
    connectedCallback(){
      this._level=D.clampLevel(this.getAttribute('level')??1);this._last=0;
      this._motion.addEventListener('change',this._onMotion);this._updateEffect();this._load();this._scheduleIdle();
      this._raf=requestAnimationFrame(this._tick);
    }
    disconnectedCallback(){cancelAnimationFrame(this._raf);this._token++;this._motion.removeEventListener('change',this._onMotion);}
    attributeChangedCallback(name,old,value){
      if(old===value)return;
      if(name==='level')this.setLevel(value,{animate:this.isConnected});
      else if(name==='asset-base'&&this.isConnected)this._load();
      else if(name==='auto-idle')this._scheduleIdle();
    }
    get level(){return this._level;} set level(value){this.setLevel(value);}
    get stage(){return Math.floor((this.level-1)/5)+1;}
    get info(){return D.levels[this.level-1];}
    get action(){return this._action;} get paused(){return this._paused;}
    get autoIdle(){return this.getAttribute('auto-idle')!=='false';}
    set autoIdle(value){this.setAttribute('auto-idle',String(Boolean(value)));}
    _emit(name,detail={}){this.dispatchEvent(new CustomEvent(name,{bubbles:true,composed:true,detail:{characterId:'corgi',level:this.level,stage:this.stage,action:this.action,...detail}}));}
    async _load(afterLoad){
      const token=++this._token;this._loading=true;this.status.textContent='正在准备柯基犬…';
      const base=new URL(this.getAttribute('asset-base')||'assets/',scriptBase);
      try{
        const im=await loadImage(new URL(`stage-${this.stage}.png?v=police2`,base).href);
        if(token!==this._token||!this.isConnected)return;
        this._atlas=im;this._loading=false;this.status.textContent='';
        if(afterLoad)afterLoad();this._emit('pet-ready');
      }catch(error){
        if(token!==this._token||!this.isConnected)return;
        this._loading=false;this._atlas=null;this.status.textContent='图片未能加载，请检查素材路径。';
        this._emit('pet-error',{message:error.message});
      }
    }
    _updateEffect(){this.fx.innerHTML=FX.svg(this.level);const opacity=(0.74+(this.level-1)*.015).toFixed(2),glow=`${4+Math.floor((this.level-1)/3)}px`;if(this.fx.style.setProperty){this.fx.style.setProperty('--fx-opacity',opacity);this.fx.style.setProperty('--fx-glow',glow);}else{this.fx.style['--fx-opacity']=opacity;this.fx.style['--fx-glow']=glow;}}
    _scheduleIdle(){this._nextIdle=this._t+D.idleDelayMs[0]+Math.random()*(D.idleDelayMs[1]-D.idleDelayMs[0]);}
    setLevel(value,{animate=true}={}){
      const next=D.clampLevel(value),previous=this.level,oldStage=this.stage;
      if(next===previous)return this;
      const oldAtlas=this._atlas,oldScale=this.info.scale;
      this._level=next;
      if(this.getAttribute('level')!==String(next))this.setAttribute('level',String(next));
      this._updateEffect();this.play('idle');
      const evolved=this.stage!==oldStage&&next>previous;
      const finish=()=>{
        if(animate&&next>previous){
          this._evolution=evolved&&oldAtlas?{atlas:oldAtlas,scale:oldScale}:null;
          this.play(evolved?'evolve':'celebrate');this.previewEffect();
        }
      };
      if(oldStage!==this.stage&&this.isConnected)this._load(finish);else finish();
      this._emit('pet-levelchange',{previous,evolved});return this;
    }
    play(name){
      if(!Object.hasOwn(D.actions,name))throw new RangeError('未知动作：'+name);
      this._action=name;this._start=this._t;this._pose=null;
      if(name!=='run')this._target=this._x;
      this._scheduleIdle();
      if(name==='skill'||name==='evolve')this.previewEffect();
      this.canvas.setAttribute('aria-label',`柯基犬，${D.stages[this.stage-1].name}，等级 ${this.level}，${D.actions[name].label}。点击随机互动。`);
      this._emit('pet-action');return this;
    }
    interact(){
      const event=new CustomEvent('pet-interact',{bubbles:true,composed:true,cancelable:true,detail:{characterId:'corgi'}});
      if(!this.dispatchEvent(event))return this;
      const action=D.choose(D.interactionPool,this._previousRandom);this._previousRandom=action;
      this.play(action);return this;
    }
    showFrame(name){
      const i=D.frames.indexOf(name);if(i<0)throw new RangeError('未知图片帧：'+name);
      this.play('idle');this._pose=i;return this;
    }
    moveTo(value){
      if(!Number.isFinite(Number(value)))throw new TypeError('moveTo 需要数字位置 0—1');
      const x=Math.max(.3,Math.min(.7,Number(value)))*960;
      this.play('run');this._target=x;this._dir=x<this._x?-1:1;
      if(this._motion.matches||x===this._x){this._x=x;this.play('idle');}return this;
    }
    previewEffect(){this._fxUntil=this._t+3800;this._emit('pet-effect',{effect:this.info.effect});return this;}
    pause(value=true){this._paused=Boolean(value);this._emit('pet-pause',{paused:this._paused});return this;}
    _tick(now){
      if(!this.isConnected)return;
      const dt=this._last?Math.min(50,now-this._last):0;this._last=now;
      const frozen=this._paused||document.hidden;
      this.shell.classList.toggle('frozen',frozen);
      if(!frozen&&!this._loading){
        this._t+=dt;
        if(this.action==='run'&&this._x!==this._target){
          const distance=this._target-this._x;this._x+=Math.sign(distance)*Math.min(Math.abs(distance),dt*.2);
          if(Math.abs(this._x-this._target)<.1)this.play('idle');
        }
        const duration=D.actions[this.action].durationMs;
        if(duration!==null&&this._t-this._start>=duration){const completed=this.action;this.play('idle');this._emit('pet-actionend',{completed});}
        if(this.autoIdle&&!this._motion.matches&&this.action==='idle'&&this._pose===null&&this._t>=this._nextIdle){
          const action=D.choose(D.idlePool,this._previousRandom);this._previousRandom=action;this.play(action);this._emit('pet-idleaction');
        }
      }
      this._render();this._raf=requestAnimationFrame(this._tick);
    }
    _sprite(frame,x,y,scale,alpha=1,atlas=this._atlas){
      if(!atlas)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(x,y);c.scale(this._dir*scale,scale);
      c.drawImage(atlas,frame%3*512,Math.floor(frame/3)*512,512,512,-256,-470,512,512);c.restore();
    }
    _render(){
      const c=this.ctx;c.clearRect(0,0,960,680);if(!this._atlas)return;
      const reduced=this._motion.matches,elapsed=this._t-this._start,t=reduced?0:this._t/1000;
      const action=D.actions[this.action],frame=this._pose??D.frameAt(this.action,elapsed,reduced);
      let scale=this.info.scale;
      const lift=!reduced&&this._pose===null&&['jump','celebrate'].includes(this.action)?Math.sin(Math.PI*Math.min(1,elapsed/action.durationMs))*(this.action==='jump'?70:24):0;
      const breath=reduced||this._pose!==null?0:Math.sin(t*2)*2;
      if(!reduced&&this._pose===null&&['feed','pet'].includes(this.action))scale*=1+Math.sin(elapsed/95)*.012;
      const base=582-lift-breath;
      this.fx.classList.toggle('burst',this._t<this._fxUntil);
      this.fx.style.visibility=this.action==='sleep'?'hidden':'visible';
      this.fx.style.transform=`translateX(${(this._x-480)/960*100}%)`;
      c.fillStyle='#314b6a18';c.beginPath();c.ellipse(this._x,594,116*scale*(1-lift/250),16*scale,0,0,Math.PI*2);c.fill();
      if(this.action==='evolve'&&!reduced){
        const p=Math.min(1,elapsed/3000);
        if(p<.35&&this._evolution){this._sprite(0,this._x,base,this._evolution.scale*(1-p*.3),1-p/.35,this._evolution.atlas);return;}
        scale*=.82+.18*Math.min(1,Math.max(0,(p-.35)/.4));
      }
      // Small sideways weight shifts give greeting and running a lively canine bounce.
      const sway=!reduced&&this._pose===null&&['wave','run','celebrate'].includes(this.action)?Math.sin(elapsed/110)*6:0;
      this._sprite(frame,this._x+sway,base,scale);
      const top=base-450*scale;
      if(['pet','feed'].includes(this.action)){
        c.fillStyle='#23aeb4';c.font='24px system-ui';for(let i=0;i<3;i++)c.fillText('♥',this._x+(i-1)*55,top+60-(reduced?0:(elapsed/40+i*15)%70));
      }
      if(this.action==='think'){c.fillStyle='#5d789b';c.font='bold 30px system-ui';c.fillText('?',this._x+95*scale,top+70);}
      if(this.action==='sleep'){c.fillStyle='#768ca8';c.font='bold 23px system-ui';c.fillText('z',this._x+76*scale,base-245*scale-5*Math.sin(t));}
    }
  }
  if(!customElements.get('corgi-game-pet'))customElements.define('corgi-game-pet',CorgiGamePet);
})();
