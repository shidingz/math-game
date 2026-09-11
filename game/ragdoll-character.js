(() => {
  MathPetCharacters.register({
    id:'ragdoll',name:'布偶猫',portrait:'characters/ragdoll/assets/stage-1-portrait.png?v=frost2',unlock:{cost:300,description:'使用 300 积分兑换'},
    food:{name:'鲜鱼猫粮',unit:'碗',icon:'🐟',title:'一碗鲜鱼猫粮',cost:20,growth:20},
    growthCurve:MathPetGrowth.WUKONG,
    ui:{title:'慢慢长大，温柔陪伴。',location:'霜华小屋 · 银晶花园',symbol:'喵',scene:'starlight',style:'soft',zoom:[1.2,1.2,1.2],
      palette:{background:'#f2f6fc',ink:'#30445f',muted:'#7186a2',primary:'#528bd5',primaryDark:'#3668ac',accent:'#66c3d4',surface:'#ffffff',border:'#dbe5f3',sceneFrom:'#eaf4ff',sceneTo:'#e8e5fb',sceneLine:'#becfec',hill:'#bacce655',foodBackground:'#eef6ff',foodBorder:'#b8d3f0',foodInk:'#426fa6',radius:'24px'},
      decorate(slot){const stars=document.createElement('div');stars.className='moon-garden';stars.innerHTML='<span>✦</span><span>✧</span><span>✦</span><span>✧</span>';slot.append(stars);return ()=>stars.remove();}},
    stages:RagdollGameData.stages,effects:RagdollGameData.levels,
    clickActions:['pet','wave','jump','celebrate','skill'],idleActions:['think','wave','sleep','pet'],
    messages:{idle:['喵，我在这里陪你。','今天的星星，等我们一起点亮。'],pet:['只许摸一下……再一下也行。','呼噜……有你陪着真好。'],wave:['给你一只小爪爪，接好哦。','喵，慢慢来，我等你。'],jump:['轻轻一跳，接住小星星！','伸伸爪，又有精神啦。'],celebrate:['算得不错嘛，给你一颗星！','你又进步了，我也替你开心。'],skill:['霜华亮起，守护你的每一点进步。','一起长大的光，温柔又明亮。'],think:['歪歪头，慢慢想。','这道题，我们一起想想。'],sleep:['呼噜……做个甜甜的梦。','眯一会儿，醒来再陪你。']},
    create({level}){const element=document.createElement('ragdoll-game-pet');element.setAttribute('level',level);element.setAttribute('auto-idle','false');
      return {element,play:a=>element.play(a),setLevel:(n,o)=>element.setLevel(n,o),pause:v=>element.pause(v),get action(){return element.action;},on(event,fn){const names={interact:'pet-interact',actionEnd:'pet-actionend',ready:'pet-ready',error:'pet-error'};element.addEventListener(names[event],fn);return ()=>element.removeEventListener(names[event],fn);},destroy(){element.remove();}};}
  });
})();
