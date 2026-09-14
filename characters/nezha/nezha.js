/* Nezha standalone Web Component. Load nezha-data.js and nezha-effects.js first. */
(() => {
  'use strict';
  const D=window.NezhaGameData, FX=window.NezhaEffects;
  if(!D||!FX)throw new Error('请先加载 nezha-data.js 和 nezha-effects.js');
  const scriptBase=new URL('.',document.currentScript.src);
  const cache=new Map();
  const loadImage=url=>{
    if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{
      const im=new Image();im.onload=()=>resolve(im);
      im.onerror=()=>{cache.delete(url);reject(new Error('素材未能加载：'+url));};im.src=url;
    }));return cache.get(url);
  };
  class NezhaGamePet extends HTMLElement {
    static get observedAttributes(){return ['level','asset-base','auto-idle'];}
    constructor(){
      super();this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML=`<style>
        :host{display:block;width:100%;aspect-ratio:960/680;min-width:0;position:relative}
        .shell{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
        canvas,.fx{position:absolute;inset:0;width:100%;height:100%}.fx{pointer-events:none;opacity:var(--fx-opacity,.34);filter:drop-shadow(0 0 var(--fx-glow,4px) #f2bf58);transition:opacity .3s,filter .3s}.fx svg{display:block;width:100%;height:100%}
        .fx.burst{opacity:1;filter:drop-shadow(0 0 10px #f2bf58) drop-shadow(0 0 20px #ef655b)}.shell.frozen .nz-pulse{animation-play-state:paused!important}
        canvas{touch-action:pan-y;outline:none}canvas:focus-visible{outline:3px solid #cf4766;outline-offset:-4px;border-radius:24px}
        .status{position:absolute;top:43%;left:8%;right:8%;text-align:center;font:14px system-ui;color:#5b6475;pointer-events:none}.status:empty{display:none}
        @media(prefers-reduced-motion:reduce){.fx{transition:none}.nz-pulse{animation:none!important}}
      </style><div class="shell"><div class="fx"></div><canvas width="960" height="680" role="button" tabindex="0" aria-label="哪吒，点击随机互动；左右方向键移动，空格互动"></canvas><span class="status" role="status">正在准备哪吒…</span></div>`;
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
    _emit(name,detail={}){this.dispatchEvent(new CustomEvent(name,{bubbles:true,composed:true,detail:{characterId:'nezha',level:this.level,stage:this.stage,action:this.action,...detail}}));}
    async _load(afterLoad){
      const token=++this._token;this._loading=true;this.status.textContent='正在准备哪吒…';
      const base=new URL(this.getAttribute('asset-base')||'assets/',scriptBase);
      try{
        const im=await loadImage(new URL(`stage-${this.stage}.png?v=realistic2-martial`,base).href);
        if(token!==this._token||!this.isConnected)return;
        this._atlas=im;this._measureFrames(im);this._loading=false;this.status.textContent='';
        if(afterLoad)afterLoad();this._emit('pet-ready');
      }catch(error){
        if(token!==this._token||!this.isConnected)return;
        this._loading=false;this._atlas=null;this.status.textContent='图片未能加载，请检查素材路径。';
        this._emit('pet-error',{message:error.message});
      }
    }
    _updateEffect(){this.fx.innerHTML=FX.svg(this.level);const opacity=(0.34+(this.level-1)*.02).toFixed(2),glow=`${4+Math.floor((this.level-1)/3)}px`;if(this.fx.style.setProperty){this.fx.style.setProperty('--fx-opacity',opacity);this.fx.style.setProperty('--fx-glow',glow);}else{this.fx.style['--fx-opacity']=opacity;this.fx.style['--fx-glow']=glow;}}
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
      this.canvas.setAttribute('aria-label',`哪吒，${D.stages[this.stage-1].name}，等级 ${this.level}，${D.actions[name].label}。点击随机互动。`);
      this._emit('pet-action');return this;
    }
    interact(){
      const event=new CustomEvent('pet-interact',{bubbles:true,composed:true,cancelable:true,detail:{characterId:'nezha'}});
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
    _sprite(frame,x,y,scale,alpha=1,atlas=this._atlas,rotation=0){
      if(!atlas)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rotation*this._dir);c.scale(this._dir*scale,scale);
      c.drawImage(atlas,frame%4*512,Math.floor(frame/4)*640,512,640,-256,-588,512,640);c.restore();
    }
    _measureFrames(atlas){
      this._frameBounds=[];
      try{
        const surface=document.createElement('canvas');surface.width=512;surface.height=640;const ctx=surface.getContext('2d',{willReadFrequently:true});
        for(let frame=0;frame<D.frames.length;frame++){
          ctx.clearRect(0,0,512,640);ctx.drawImage(atlas,(frame%4)*512,Math.floor(frame/4)*640,512,640,0,0,512,640);
          const pixels=ctx.getImageData(0,0,512,640).data;let left=512,right=0,top=640,bottom=0;
          for(let y=0;y<640;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
          this._frameBounds.push({left:left-256,right:right-256,top:top-588,bottom:bottom-588});
        }
      }catch{this._frameBounds=[];}
    }
    _fitPose(frame,x,y,scale,rotation){
      const viewport=this.closest('.pet-scene, .pet-upgrade-stage'),rect=this.canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return {x,y,scale};
      const clip=viewport?viewport.getBoundingClientRect():rect;
      const screenWidth=globalThis.innerWidth||Infinity;
      const left=Math.max(0,(Math.max(0,clip.left)+10-rect.left)*960/rect.width),right=Math.min(960,(Math.min(screenWidth,clip.right)-10-rect.left)*960/rect.width);
      const top=Math.max(0,(clip.top+12-rect.top)*680/rect.height),bottom=Math.min(660,(clip.bottom-12-rect.top)*680/rect.height);
      if(right<=left||bottom<=top)return {x,y,scale};
      const bounds=this._frameBounds?.[frame]||{left:-250,right:250,top:-560,bottom:0};
      const angle=rotation*this._dir,cos=Math.cos(angle),sin=Math.sin(angle);
      const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.left,bounds.bottom],[bounds.right,bounds.bottom]].map(([px,py])=>({x:px*this._dir*cos-py*sin,y:px*this._dir*sin+py*cos}));
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      scale=Math.min(scale,(right-left)/(maxX-minX),(bottom-top)/(maxY-minY));
      return {scale,x:Math.max(left-minX*scale,Math.min(right-maxX*scale,x)),y:Math.max(top-minY*scale,Math.min(bottom-maxY*scale,y))};
    }
    _martialTrails(x,y,scale,elapsed){
      const c=this.ctx,p=Math.min(1,elapsed/D.actions[this.action].durationMs),spin=p*Math.PI*4;
      c.save();c.translate(x,y-235*scale);c.rotate(spin);
      c.lineCap='round';
      for(let i=0;i<3;i++){
        c.globalAlpha=.68-i*.17;c.strokeStyle=['#f58127','#ffc85c','#fff2c4'][i];c.lineWidth=14-i*4;
        c.beginPath();c.ellipse(0,0,(220+i*12)*scale,(70+i*9)*scale,0,-1.5,1.2);c.stroke();
      }
      c.restore();
      c.save();
      // Moving ribbons and embers echo the spear sweep and wind-fire wheels.
      for(let j=0;j<2;j++){
        c.strokeStyle=j?'#ffb343':'#df3654';c.globalAlpha=.65;c.lineWidth=j?4:8;c.beginPath();
        c.moveTo(x,y-30*scale);c.bezierCurveTo(x-160*scale,y+20*scale,x-240*scale,y-150*scale,x-100*scale,y-210*scale);c.stroke();
        c.translate(0,-28);
      }
      for(let i=0;i<12;i++){
        const a=spin+i*2.4,r=(90+i%4*35)*scale;
        c.globalAlpha=.8;c.fillStyle=i%2?'#ffd25f':'#f3762c';c.beginPath();c.arc(x+Math.cos(a)*r,y-160*scale+Math.sin(a)*r*.7,3+i%3,0,Math.PI*2);c.fill();
      }
      c.restore();
    }
    _render(){
      const c=this.ctx;c.clearRect(0,0,960,680);if(!this._atlas)return;
      const reduced=this._motion.matches,elapsed=this._t-this._start,t=reduced?0:this._t/1000;
      const action=D.actions[this.action],frame=this._pose??D.frameAt(this.action,elapsed,reduced);
      let scale=this.info.scale;
      let lift=!reduced&&this._pose===null&&['jump','celebrate'].includes(this.action)?Math.sin(Math.PI*Math.min(1,elapsed/action.durationMs))*(this.action==='jump'?125:48):0;
      let spriteX=this._x,rotation=0;
      if(!reduced&&this._pose===null&&this.action==='skill'){
        const p=Math.min(.999,elapsed/action.durationMs),segment=Math.floor(p*action.frames.length),within=p*action.frames.length%1;
        const ease=within*within*(3-2*within),mix=values=>values[segment]+(values[segment+1]-values[segment])*ease;
        spriteX+=mix([0,-115,120,65,-80,0])*this._dir;
        lift=mix(this.stage===1?[0,65,140,85,25,0]:[0,40,150,95,20,0]);
        rotation=mix([0,-.13,.12,-.08,.08,0]);
      }
      const breath=reduced||this._pose!==null?0:Math.sin(t*2)*2;
      let base=582-lift-breath;
      this.fx.classList.toggle('burst',this._t<this._fxUntil);
      this.fx.style.visibility=this.action==='sleep'?'hidden':'visible';
      this.fx.style.transform=`translateX(${(this._x-480)/960*100}%)`;
      c.fillStyle='#314b6a18';c.beginPath();c.ellipse(this._x,594,116*scale*(1-lift/250),16*scale,0,0,Math.PI*2);c.fill();
      if(this.action==='evolve'&&!reduced){
        const p=Math.min(1,elapsed/3000);
        if(p<.35&&this._evolution){this._sprite(0,this._x,base,this._evolution.scale*(1-p*.3),1-p/.35,this._evolution.atlas);return;}
        scale*=.82+.18*Math.min(1,Math.max(0,(p-.35)/.4));
      }
      const fitted=this._fitPose(frame,spriteX,base,scale,rotation);
      spriteX=fitted.x;base=fitted.y;scale=fitted.scale;
      this._lastPose={frame,x:spriteX,y:base,scale,rotation};
      if(!reduced&&this._pose===null&&['skill','jump'].includes(this.action))this._martialTrails(spriteX,base,scale,elapsed);
      this._sprite(frame,spriteX,base,scale,1,this._atlas,rotation);
      const top=base-450*scale;
      if(this.stage===1&&['pet','feed'].includes(this.action)){
        c.fillStyle='#e97191';c.font='24px system-ui';for(let i=0;i<3;i++)c.fillText('♥',this._x+(i-1)*55,top+60-(reduced?0:(elapsed/40+i*15)%70));
      }
      if(this.action==='think'){c.fillStyle='#5d789b';c.font='bold 30px system-ui';c.fillText('?',this._x+95*scale,top+70);}
      if(this.action==='sleep'){c.fillStyle='#768ca8';c.font='bold 23px system-ui';c.fillText('z',this._x+76*scale,base-245*scale-5*Math.sin(t));}
    }
  }
  if(!customElements.get('nezha-game-pet'))customElements.define('nezha-game-pet',NezhaGamePet);
})();
