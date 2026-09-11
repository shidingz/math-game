(() => {
  'use strict';
  const pet=document.getElementById('pet'),data=window.WukongGameData;
  const $=id=>document.getElementById(id);
  const icons=['✦','♡','❧','✧','❋','ϟ','≈','♛','☁','◎','☁','☄','⬡','♧','☆'];
  $('level-buttons').innerHTML=data.levels.map(l=>`<button data-level="${l.level}" aria-label="等级 ${l.level}，${l.name}">${l.level}</button>`).join('');
  $('journey').innerHTML=data.levels.map(l=>`<button data-level="${l.level}" aria-label="预览等级 ${l.level}，${l.name}"><span>${String(l.level).padStart(2,'0')}</span><div><strong>${l.name}</strong><small>${l.level===6||l.level===11?'进化 · ':''}${l.effect}</small></div></button>`).join('');
  const say={idle:['再做一道题，一起变强吧！','今天的冒险，我准备好了。','准备好了吗？我们一起去闯关。'],wave:['嗨！快来一起玩。','嘿，伙伴！这边！','伙伴，见到你真高兴。'],pet:['嘿嘿，有点痒。','哈哈，被你发现了！','嗯……偶尔这样也不错。'],feed:['桃子真甜，谢谢你！','吃饱啦，又有力气了！','好桃！这份心意，俺收下了。'],think:['让我数一数……','换个方法，或许就明白了。','别急，我们一起想一想。'],comfort:['没关系，我们再试一次。','差一点点，咱们再想想。','有我陪着你，慢慢来。'],celebrate:['答对啦！你真棒！','漂亮！这一关拿下了。','好本领！和你配合真痛快。'],jump:['看我跳！','这点距离，难不倒我！','起！'],sleep:['呼……桃子……','歇一会儿，等下继续。','养精蓄锐，再出发。'],run:['追上我呀！','出发，去看看那边。','跟上，伙伴！'],skill:['看，我也有小本领！','金箍棒，听我号令！','看俺老孙的本领！'],evolve:['又长大了一点！','从今天起，一起去闯荡。','筋斗云起，大圣来了！']};
  function sync(){
    const l=pet.info,s=data.stages[l.stage-1];$('pet-name').textContent=s.name;$('pet-tag').textContent=s.tag;
    $('stage-range').textContent=`第${['一','二','三'][l.stage-1]}阶段 / ${s.range}`;$('level-badge').textContent=`Lv.${l.level}`;
    $('size-label').textContent=`阶段体型 ${Math.round(l.scale/s.scale*100)}%`;
    $('effect-name').textContent=l.name;$('effect-description').textContent=l.description;$('effect-icon').textContent=icons[l.level-1];
    $('upgrade').disabled=l.level===15;$('upgrade').innerHTML=l.level===15?'已达最高等级 <span>★</span>':`升到 Lv.${l.level+1} <span>↑</span>`;
    document.querySelectorAll('[data-level]').forEach(b=>{b.dataset.active=String(Number(b.dataset.level)===l.level);b.setAttribute('aria-pressed',b.dataset.active);});
    document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===l.stage)));
  }
  function unpause(){if(pet.paused){pet.pause(false);$('pause').textContent='Ⅱ 暂停动画';$('pause').setAttribute('aria-pressed','false');}}
  document.addEventListener('click',e=>{
    const level=e.target.closest('[data-level]');if(level){unpause();pet.setLevel(level.dataset.level,{animate:false});pet.play('skill');sync();return;}
    const stage=e.target.closest('[data-stage]');if(stage){unpause();pet.setLevel((Number(stage.dataset.stage)-1)*5+1,{animate:false});pet.play('wave');sync();return;}
    const action=e.target.closest('[data-action]');if(action){unpause();pet.play(action.dataset.action);return;}
    const move=e.target.closest('[data-move]');if(move){unpause();pet.moveTo(Number(move.dataset.move));}
  });
  pet.addEventListener('pet-action',()=>{$('action-label').textContent=data.actions[pet.action].label;$('speech').textContent=say[pet.action][pet.stage-1];document.querySelectorAll('[data-action]').forEach(b=>{b.dataset.active=String(b.dataset.action===pet.action);b.setAttribute('aria-pressed',b.dataset.active);});});
  pet.addEventListener('pet-levelchange',sync);
  $('preview-effect').addEventListener('click',()=>{unpause();pet.play('skill');});
  $('upgrade').addEventListener('click',()=>{unpause();pet.level=pet.level+1;});
  $('pause').addEventListener('click',()=>{pet.pause(!pet.paused);$('pause').textContent=pet.paused?'▶ 继续动画':'Ⅱ 暂停动画';$('pause').setAttribute('aria-pressed',String(pet.paused));});
  $('reset-position').addEventListener('click',()=>{unpause();pet.moveTo(.5);});
  sync();
})();
