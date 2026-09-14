/* Sun Wukong game character • no framework / no network dependencies */
(() => {
  'use strict';
  const scriptBase = new URL('.', document.currentScript.src).href;
  const assetVersion = 'cute-agile-hero4';
  const frames = ['idle','blink','wave-a','wave-b','pet-a','pet-b','feed-a','feed-b','think','sleep','jump','run-a','run-b','skill-a','skill-b','skill-c','comfort','celebrate'];
  const stages = [
    {id:1,name:'小石猴',range:'Lv.1—5',tag:'好奇 · 灵巧',color:'#28b99b',scale:.69},
    {id:2,name:'小行者',range:'Lv.6—10',tag:'勇敢 · 敏捷',color:'#3883ed',scale:.82},
    {id:3,name:'踏云大圣',range:'Lv.11—15',tag:'自信 · 守护',color:'#ee655c',scale:.99}
  ];
  const effects = [
    ['星芽初醒','星点','身边亮起青色星点，第一束灵气开始陪伴。'],
    ['桃心羁绊','桃心','桃红色爱心轻轻上浮，回应每一次陪伴。'],
    ['青叶旋舞','飞叶','鲜绿叶片绕身飞舞，像花果山吹来的风。'],
    ['尾星轨迹','星轨','蓝色弧线带着星星划过身后。'],
    ['花果灵环','叶环','脚下展开一圈青叶，幼年阶段成长完成。'],
    ['如意初芒','棒芒','金色光弧向外展开，小行者正式登场。'],
    ['赤绫流光','红绫','两道红色飘带绕身流动，奔跑更有气势。'],
    ['金箍星辉','冠星','头顶浮起三颗金星，金箍光辉逐渐点亮。'],
    ['踏风云步','风云','脚边生成流动的小云团，轻盈踏风。'],
    ['行者护环','双环','两道蓝色轨道交错环绕，积蓄进化力量。'],
    ['筋斗云起','筋斗云','脚下凝成筋斗云，踏云大圣正式登场。'],
    ['翎羽流星','流星','赤金色流星从翎羽上方掠过。'],
    ['云纹守护','护盾','青蓝色云纹护盾展开，守护身边的伙伴。'],
    ['身外化身','分身','两道半透明分身同时现身，随后归于本体。'],
    ['齐天星阵','星阵','五芒星阵与金色光环同时展开，成长圆满。']
  ];
  const levels = effects.map((e,i) => Object.freeze({level:i+1,stage:Math.floor(i/5)+1,name:e[0],effect:e[1],description:e[2],scale:+(stages[Math.floor(i/5)].scale*(1+(i%5)*.035)).toFixed(3)}));
  const actions = {
    idle:{label:'待机',frames:[0],duration:Infinity},
    wave:{label:'招呼致意',frames:[2,3],duration:1400},
    pet:{label:'伙伴回应',frames:[4,5],duration:1400},
    feed:{label:'吃桃子',frames:[6,6,7,7,6,7],duration:500},
    think:{label:'思考',frames:[8],duration:2800},
    comfort:{label:'鼓励',frames:[16],duration:1800},
    celebrate:{label:'庆祝',frames:[17,10,17],duration:1800},
    jump:{label:'翻跃',frames:[10],duration:1100},
    sleep:{label:'小憩',frames:[9],duration:Infinity},
    run:{label:'冲刺',frames:[11,12],duration:Infinity},
    skill:{label:'耍金箍棒',frames:[13,14,15,14,13],duration:2400},
    evolve:{label:'进化',frames:[13,14,15,17],duration:3000}
  };
  const imageCache = new Map();
  function loadAtlas(url) {
    if(!imageCache.has(url)) imageCache.set(url,new Promise((resolve,reject)=>{
      const im = new Image(); im.onload=()=>resolve(im); im.onerror=()=>{imageCache.delete(url);reject(new Error('角色素材加载失败：'+url));}; im.src=url;
    }));
    return imageCache.get(url);
  }
  class WukongGamePet extends HTMLElement {
    static get observedAttributes(){return ['level','asset-base'];}
    constructor(){
      super(); this.attachShadow({mode:'open'});
      this.shadowRoot.innerHTML=`<style>:host{display:block;width:100%;aspect-ratio:960/680;position:relative;min-width:0}canvas{display:block;width:100%;height:100%;touch-action:pan-y;outline:none}canvas:focus-visible{outline:3px solid #3684e8;outline-offset:-4px;border-radius:24px}.status{position:absolute;inset:45% 10% auto;text-align:center;color:#36465e;font:14px system-ui;pointer-events:none}.status:empty{display:none}</style><canvas width="960" height="680" role="button" tabindex="0" aria-label="孙悟空，点击摸摸头；左右方向键移动，空格互动"></canvas><span class="status" role="status">正在准备角色…</span>`;
      this.canvas=this.shadowRoot.querySelector('canvas');this.ctx=this.canvas.getContext('2d');const pixelRatio=Math.min(2,Math.max(1,Number(globalThis.devicePixelRatio)||1));if(pixelRatio>1&&typeof this.ctx.setTransform==='function'){this.canvas.width=Math.round(960*pixelRatio);this.canvas.height=Math.round(680*pixelRatio);this.ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);}this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.status=this.shadowRoot.querySelector('.status');
      this._level=1;this._action='idle';this._t=0;this._start=0;this._fxStart=-99999;this._fxUntil=0;this._x=480;this._target=480;this._dir=1;this._paused=false;this._atlas=null;this._last=0;this._token=0;this._initialized=false;this._evolution=null;
      this._motion=matchMedia('(prefers-reduced-motion: reduce)');this._reduced=this._motion.matches;
      this._onMotion=()=>{this._reduced=this._motion.matches;};
      this.canvas.addEventListener('click',()=>this.interact());
      this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();e.key==='ArrowLeft'?this.moveTo(.28):e.key==='ArrowRight'?this.moveTo(.72):this.interact();}});
      this._tick=this._tick.bind(this);
    }
    connectedCallback(){
      this._level=this._parseLevel(this.getAttribute('level')||1);this._last=0;this._initialized=true;this.play('idle');this._motion.addEventListener('change',this._onMotion);
      this._load();this._raf=requestAnimationFrame(this._tick);
    }
    disconnectedCallback(){cancelAnimationFrame(this._raf);this._token++;this._motion.removeEventListener('change',this._onMotion);}
    attributeChangedCallback(name,old,value){if(old===value)return;if(name==='level')this.setLevel(value,{animate:this._initialized});else if(this.isConnected)this._load();}
    _parseLevel(value){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.min(15,Math.round(n))):1;}
    get level(){return this._level;}
    set level(value){this.setLevel(value);}
    get stage(){return Math.floor((this._level-1)/5)+1;}
    get action(){return this._action;}
    get paused(){return this._paused;}
    get info(){return levels[this._level-1];}
    interact(){const event=new CustomEvent('pet-interact',{bubbles:true,composed:true,cancelable:true});if(this.dispatchEvent(event))this.play('pet');}
    setInteractionLabel(text){this._interactionLabel=text;this.canvas.setAttribute('aria-label',text);}
    _emit(name,detail={}){this.dispatchEvent(new CustomEvent(name,{detail:{level:this.level,stage:this.stage,action:this.action,...detail},bubbles:true,composed:true}));}
    async _load(){
      const token=++this._token;this._atlas=null;this.status.textContent='正在准备角色…';
      const base=new URL(this.getAttribute('asset-base')||'assets/',scriptBase);
      try {const url=new URL(`stage-${this.stage}.png`,base);url.searchParams.set('v',assetVersion);const im=await loadAtlas(url.href);if(token!==this._token||!this.isConnected)return;this._atlas=im;this._measureFrames(im);this.status.textContent='';this._emit('pet-ready');}
      catch(e){if(token!==this._token)return;this.status.textContent='素材未能加载，请检查 assets 路径。';this._emit('pet-error',{message:e.message});}
    }
    setLevel(value,{animate=true}={}){
      const next=this._parseLevel(value),previous=this._level,oldStage=this.stage;if(next===previous)return;
      this._evolution=animate&&oldStage!==Math.floor((next-1)/5)+1&&next>previous?{atlas:this._atlas,scale:this.info.scale}:null;
      this._level=next;if(this.getAttribute('level')!==String(next))this.setAttribute('level',next);
      this._target=this._x;this._dir=1;this.play('idle');
      if(oldStage!==this.stage&&this.isConnected)this._load();
      if(animate&&this.isConnected&&next>previous){this.play(oldStage!==this.stage?'evolve':'celebrate');this.previewEffect();}
      this._emit('pet-levelchange',{previous,evolved:oldStage!==this.stage&&next>previous});
    }
    play(name){
      if(!Object.hasOwn(actions,name))throw new RangeError('未知动作：'+name);
      this._action=name;this._start=this._t;
      if(name!=='run')this._target=this._x;
      if(name==='skill'||name==='evolve')this.previewEffect();
      this.canvas.setAttribute('aria-label',this._interactionLabel||`${stages[this.stage-1].name}，等级 ${this.level}，${actions[name].label}。点击摸摸头，左右方向键移动。`);
      this._emit('pet-action');return this;
    }
    moveTo(normalizedX){
      if(!Number.isFinite(Number(normalizedX)))throw new TypeError('moveTo 需要 0—1 之间的位置');
      const x=Math.max(.28,Math.min(.72,Number(normalizedX)))*960;
      this.play('run');this._target=x;this._dir=x<this._x?-1:1;
      if(this._reduced){this._x=x;this.play('idle');}return this;
    }
    previewEffect(){this._fxStart=this._t;this._fxUntil=this._t+3800;this._emit('pet-effect',{effect:this.info.effect});return this;}
    pause(value=true){this._paused=Boolean(value);this._emit('pet-pause',{paused:this._paused});return this;}
    _tick(now){
      if(!this.isConnected)return;
      const dt=this._last?Math.min(50,now-this._last):0;this._last=now;
      if(!this._paused&& !document.hidden&&this._atlas){
        this._t+=dt;
        if(this._action==='run'&&this._target!==this._x){const d=this._target-this._x;this._x+=Math.sign(d)*Math.min(Math.abs(d),dt*.21);if(Math.abs(this._target-this._x)<.1)this.play('idle');}
        if(this._t-this._start>=actions[this._action].duration){const completed=this._action;this.play('idle');this._emit('pet-actionend',{completed});}
      }
      this._render();this._raf=requestAnimationFrame(this._tick);
    }
    _sprite(frame,x,y,scale,alpha=1,atlas=this._atlas,rotation=0){
      if(!atlas)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rotation*this._dir);c.scale(this._dir*scale,scale);
      c.drawImage(atlas,(frame%4)*512,Math.floor(frame/4)*640,512,640,-256,-588,512,640);c.restore();
    }
    _measureFrames(atlas){
      this._frameBounds=[];
      try{
        const surface=document.createElement('canvas');surface.width=512;surface.height=640;const ctx=surface.getContext('2d',{willReadFrequently:true});
        for(let frame=0;frame<frames.length;frame++){
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
      const screenRight=Number(globalThis.innerWidth)||clip.right;
      const left=Math.max(0,(Math.max(0,clip.left)+10-rect.left)*960/rect.width),right=Math.min(960,(Math.min(screenRight,clip.right)-10-rect.left)*960/rect.width);
      const top=Math.max(0,(clip.top+12-rect.top)*680/rect.height),bottom=Math.min(660,(clip.bottom-12-rect.top)*680/rect.height);
      if(right<=left||bottom<=top)return {x,y,scale};
      const bounds=this._frameBounds?.[frame]||{left:-250,right:250,top:-560,bottom:0};
      const angle=rotation*this._dir,cos=Math.cos(angle),sin=Math.sin(angle);
      const points=[[bounds.left,bounds.top],[bounds.right,bounds.top],[bounds.left,bounds.bottom],[bounds.right,bounds.bottom]].map(([px,py])=>({x:px*this._dir*cos-py*sin,y:px*this._dir*sin+py*cos}));
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      scale=Math.min(scale,(right-left)/(maxX-minX),(bottom-top)/(maxY-minY));
      return {scale,x:Math.max(left-minX*scale,Math.min(right-maxX*scale,x)),y:Math.max(top-minY*scale,Math.min(bottom-maxY*scale,y))};
    }
    _star(x,y,r,color,rotation=0){const c=this.ctx;c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.43:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fillStyle=color;c.fill();c.restore();}
    _heart(x,y,s,color){const c=this.ctx;c.save();c.translate(x,y);c.scale(s,s);c.beginPath();c.moveTo(0,7);c.bezierCurveTo(-23,-7,-9,-20,0,-10);c.bezierCurveTo(9,-20,23,-7,0,7);c.fillStyle=color;c.fill();c.restore();}
    _leaf(x,y,size,angle){const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(-size,0);c.quadraticCurveTo(0,-size*1.15,size,0);c.quadraticCurveTo(0,size*1.15,-size,0);c.fillStyle='#47cb99';c.fill();c.strokeStyle='#c2ffce';c.lineWidth=1.6;c.beginPath();c.moveTo(-size*.7,0);c.lineTo(size*.7,0);c.stroke();c.restore();}
    _cloud(x,y,s,alpha=1){const c=this.ctx;c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha*=alpha;c.fillStyle='#c8f4ff';c.strokeStyle='#7ad6f2';c.lineWidth=2;c.beginPath();c.moveTo(-100,14);c.bezierCurveTo(-135,-15,-75,-30,-56,-17);c.bezierCurveTo(-58,-65,14,-69,30,-32);c.bezierCurveTo(61,-64,115,-37,96,-8);c.bezierCurveTo(143,3,115,37,75,29);c.bezierCurveTo(0,45,-61,33,-100,14);c.fill();c.stroke();c.strokeStyle='#fff';c.lineWidth=5;c.beginPath();c.moveTo(-67,2);c.bezierCurveTo(-5,-12,12,28,42,3);c.stroke();c.restore();}
    _staffTrails(x,y,bodyHeight,elapsed){
      const c=this.ctx,p=Math.min(1,elapsed/actions.skill.duration),spin=p*Math.PI*4.4;
      c.save();c.globalCompositeOperation='screen';c.lineCap='round';c.translate(x,y-bodyHeight*.48);c.rotate(spin);
      for(let i=0;i<3;i++){
        c.globalAlpha=.42-i*.1;c.strokeStyle=i===0?'#fff2a5':i===1?'#ffc64e':'#ff7a39';c.lineWidth=13-i*4;
        c.beginPath();c.ellipse(0,0,bodyHeight*(.56+i*.035),bodyHeight*(.17+i*.018),0,-1.25,1.28);c.stroke();
      }
      c.restore();
      c.save();c.globalAlpha=.8;for(let i=0;i<7;i++){const a=spin+i*.82,r=bodyHeight*(.4+(i%3)*.07);this._star(x+Math.cos(a)*r,y-bodyHeight*.48+Math.sin(a)*r*.34,5+i%2*3,i%2?'#fff0a8':'#ffb139',a);}c.restore();
    }
    _effect(level,t,x,base,bodyHeight,alpha=1){
      const c=this.ctx,cy=base-bodyHeight*.49,top=base-bodyHeight;
      const r=Math.min(bodyHeight*.44+22,(Math.min(x,960-x,cy,680-cy)-18)/1.35);
      c.save();c.globalAlpha=alpha;c.lineCap='round';
      const ring=(rx,ry,color,a=0)=>{c.save();c.translate(x,cy);c.rotate(a);c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.ellipse(0,0,rx,ry,0,0,Math.PI*2);c.stroke();c.restore();};
      if(level===1){for(let i=0;i<8;i++){const a=i*Math.PI/4+t*.6;this._star(x+Math.cos(a)*r,cy+Math.sin(a)*r*.7,4+3*(1+Math.sin(t*2+i)),i%2?'#78d7ff':'#26c8aa',a);}}
      if(level===2){for(let i=0;i<6;i++){const p=(t*.23+i/6)%1;this._heart(x+Math.sin(i*2.5)*r,base-p*bodyHeight*.9, .65+p*.3,'#f47e9b');}}
      if(level===3){for(let i=0;i<8;i++){const a=t+i*Math.PI/4;this._leaf(x+Math.cos(a)*r,cy+Math.sin(a)*r*.65,12,a);}}
      if(level===4){c.strokeStyle='#79caff';c.lineWidth=4;c.beginPath();c.ellipse(x,cy,r*1.1,r*.6,-.5,.25,Math.PI*1.75);c.stroke();for(let i=0;i<5;i++){const a=t*.7+i*.5;this._star(x+Math.cos(a)*r*1.1,cy+Math.sin(a)*r*.6,9,'#47a6f4',a);}}
      if(level===5){c.strokeStyle='#5acd9a';c.lineWidth=3;c.beginPath();c.ellipse(x,base+8,r,.22*r,0,0,Math.PI*2);c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.3;this._leaf(x+Math.cos(a)*r,base+8+Math.sin(a)*r*.22,11,a);}}
      if(level===6){for(let i=0;i<3;i++){c.strokeStyle=['#ffcd59','#ffe5a7','#f5a739'][i];c.lineWidth=8-i*2;c.beginPath();c.arc(x,cy,r+i*15,-1.4+t*.2,.8+t*.2);c.stroke();}this._star(x+r*.8,cy-r*.6,19,'#ffc646',t);}
      if(level===7){for(let j=0;j<2;j++){c.strokeStyle=j?'#ffae8d':'#f76269';c.lineWidth=j?5:9;c.beginPath();for(let i=0;i<=60;i++){const a=i/60*Math.PI*2+t+j*Math.PI,px=x+Math.cos(a)*r,py=cy+Math.sin(a*2)*r*.28+(i/60-.5)*bodyHeight*.8;i?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();}}
      if(level===8){for(let i=0;i<3;i++){this._star(x+(i-1)*44,top-18-Math.sin(t*2+i)*8,i===1?17:11,'#ffca49',Math.sin(t)*.1);}c.strokeStyle='#f6d98e';c.lineWidth=3;c.beginPath();c.arc(x,top+35,75,Math.PI*1.16,Math.PI*1.84);c.stroke();}
      if(level===9){for(let i=0;i<3;i++)this._cloud(x+(i-1)*92+Math.sin(t+i)*16,base+5+i%2*14,.45,.85);}
      if(level===10){ring(r*1.12,r*.43,'#69c7f9',-.4);ring(r*1.12,r*.43,'#b0a0ff',.4);for(let i=0;i<4;i++){const a=t+i*Math.PI/2;this._star(x+Math.cos(a)*r,cy+Math.sin(a)*r*.5,9,'#4d9afa');}}
      if(level===11){this._cloud(x,base+14,1.03);for(let i=0;i<7;i++){const p=(t*.23+i/7)%1;this._star(x-110+p*220,base+45+Math.sin(i)*10,5,'#78ccea',t);}}
      if(level===12){for(let i=0;i<4;i++){const p=(t*.35+i*.25)%1,xx=x-r+2*r*p,yy=top-12+p*55+i*13;const g=c.createLinearGradient(xx-50,yy-25,xx,yy);g.addColorStop(0,'#ffc17600');g.addColorStop(1,i%2?'#ffc45c':'#fb7c6d');c.strokeStyle=g;c.lineWidth=5;c.beginPath();c.moveTo(xx-50,yy-25);c.lineTo(xx,yy);c.stroke();this._star(xx,yy,7,'#ffc764',.2);}}
      if(level===13){c.fillStyle='#62d5ef13';c.strokeStyle='#62ccef';c.lineWidth=3;c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2,xx=x+Math.cos(a)*r*1.14,yy=cy+Math.sin(a)*bodyHeight*.56;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();c.stroke();for(let i=0;i<3;i++)this._cloud(x+(i-1)*70,base+15,.3,.8);}
      if(level===14){ring(r*1.22,r*.35,'#a89bfa',0);for(let i=0;i<6;i++){const a=t*.6+i*Math.PI/3;this._star(x+Math.cos(a)*r*1.22,cy+Math.sin(a)*r*.35,7,'#b09bfc',a);}}
      if(level===15){c.strokeStyle='#eac374';c.lineWidth=3;c.beginPath();for(let i=0;i<=5;i++){const a=(i*2%5)*Math.PI*2/5-Math.PI/2,xx=x+Math.cos(a)*r*1.2,yy=cy+Math.sin(a)*r*1.2;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.stroke();ring(r*1.35,r*1.35,'#efd4a0');for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;this._star(x+Math.cos(a)*r*1.2,cy+Math.sin(a)*r*1.2,13,'#ffc858',t*.3);}}
      c.restore();
    }
    _render(){
      const c=this.ctx;c.clearRect(0,0,960,680);if(!this._atlas)return;
      const reduced=this._reduced,t=reduced?1:this._t/1000,elapsed=this._t-this._start,act=actions[this._action];
      let scale=this.info.scale;
      if(this._action==='evolve'&&!reduced){
        const p=Math.min(1,elapsed/3000);c.save();c.globalAlpha=Math.sin(p*Math.PI)*.6;c.strokeStyle='#80d1ec';c.lineWidth=5;c.beginPath();c.ellipse(this._x,360,80+p*160,110+p*170,0,0,Math.PI*2);c.stroke();c.restore();
        if(p<.3&&this._evolution?.atlas){this._sprite(0,this._x,575,this._evolution.scale*(1-p*.5),1-p/.3,this._evolution.atlas);return;}
        scale*=.8+.2*Math.min(1,Math.max(0,(p-.3)/.4));
      }
      let h=(this.stage===1?410:480)*scale;
      let frame=act.frames[Math.min(act.frames.length-1,Math.floor(elapsed/act.duration*act.frames.length))]||act.frames[0];
      if(this._action==='idle')frame=!reduced&&this._t%4700>4490?1:0;
      if(this._action==='run')frame=act.frames[reduced?0:Math.floor(elapsed/150)%2];
      if(reduced)frame=act.frames[0];
      let spriteX=this._x,spriteRotation=0,lift=0;
      if(!reduced&&(this._action==='jump'||this._action==='celebrate'))lift=Math.sin(Math.PI*Math.min(1,elapsed/act.duration))*(this._action==='jump'?74:30);
      if(!reduced&&this._action==='skill'){
        const p=Math.min(.999,elapsed/act.duration),segment=Math.floor(p*act.frames.length),within=(p*act.frames.length)%1;
        const ease=within*within*(3-2*within),mix=values=>values[segment]+(values[segment+1]-values[segment])*ease;
        const travel=[[0,-42,58,24,-36,0],[0,-92,108,44,-74,0],[0,-78,96,58,-54,0]][this.stage-1];
        const heights=[[0,58,88,36,12,0],[0,92,138,46,28,0],[0,22,106,36,8,0]][this.stage-1];
        spriteX+=mix(travel)*this._dir;
        lift+=mix(heights);
        spriteRotation=mix(this.stage===2?[0,-.12,.13,-.08,.06,0]:[0,-.06,.05,-.04,.025,0]);
      }
      let base=575-(this.stage===3?18:0)-lift-(reduced?0:Math.sin(t*2)*2);
      const fitted=this._fitPose(frame,spriteX,base,scale,spriteRotation);spriteX=fitted.x;base=fitted.y;scale=fitted.scale;h=(this.stage===1?410:480)*scale;
      c.fillStyle='#3c66851a';c.beginPath();c.ellipse(this._x,595,125*scale*(1-lift/260),18*scale,0,0,Math.PI*2);c.fill();
      const active=this._t<this._fxUntil,fxTime=reduced?1:(this._t-this._fxStart)/1000;
      if(this.stage===3)this._cloud(this._x,base+15,.83,.85);
      if(active&&this.level===14){const a=reduced?.22:.23*Math.sin(Math.PI*Math.min(1,(this._t-this._fxStart)/3800));this._sprite(frame,this._x-105,base+3,scale,a);this._sprite(frame,this._x+105,base+3,scale,a);}
      if(active)this._effect(this.level,fxTime,this._x,base,h,.98);
      else if(this._action!=='sleep')this._effect(this.level,t,this._x,base,h,.34+(this.level-1)*.02);
      if(this._action==='skill'&&!reduced)this._staffTrails(this._x,base,h,elapsed);
      this._sprite(frame,spriteX,base,scale,1,this._atlas,spriteRotation);
      if(this.stage===1&&(this._action==='pet'||this._action==='feed')){for(let i=0;i<3;i++){const p=reduced?.6:((elapsed/1800+i/3)%1);this._heart(this._x+(i-1)*45,base-h*.8-p*50,.5,'#f57f9a');}}
      if(this._action==='sleep'){c.fillStyle='#7b91ba';c.font='bold 26px system-ui';c.fillText('z',this._x+70,base-h*.44-8*Math.sin(t));c.font='bold 18px system-ui';c.fillText('z',this._x+97,base-h*.51);}
      if(this._action==='think'){c.fillStyle='#6981b3';c.font='bold 30px system-ui';c.fillText('?',this._x+100,base-h*.8);}
      if(this._action==='comfort'||this._action==='celebrate')for(let i=0;i<3;i++)this._star(this._x+(i-1)*70,base-h*.85-Math.sin(t+i)*10,10,'#ffcc63',t*.2);
      if(active){const p=Math.min(1,(this._t-this._fxStart)/3800);c.save();c.globalAlpha=reduced?.75:Math.sin(Math.PI*p)*.7;for(let i=0;i<10;i++){const a=i*Math.PI/5+t*.2;this._star(this._x+Math.cos(a)*(h*.55+25),base-h*.5+Math.sin(a)*h*.48,5,stages[this.stage-1].color,a);}c.restore();}
    }
  }
  window.WukongGameData=Object.freeze({version:'4.0.0',frames,stages,levels,actions});
  if(!customElements.get('wukong-game-pet'))customElements.define('wukong-game-pet',WukongGamePet);
})();
