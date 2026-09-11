(() => {
  'use strict';
  const core=MathPetCore,Q=MathPetQuestions,storage=MathPetStorage,$=id=>document.getElementById(id);
  let state=storage.load(),config,pet,interactions,feeding=false,feedTimer,toastTimer,autoTimer,previewing=false;
  document.body.classList.toggle('is-test-build',storage.isTest);
  const petUpgrade=new PetLevelUp();let upgradeRun=0;
  const quiz=$('quiz-dialog'),settings=$('settings-dialog'),characterDialog=$('characters-dialog'),starter=$('starter-dialog'),unlockCards=new Map();let starterSelection=null;
  const saveMessage=storage.isTest?'测试进度独立保存 · 不影响正式版':'进度自动保存在这台设备';
  function save(){storage.save(state);$('save-status').textContent=storage.warning||saveMessage;}
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  function mount(){
    upgradeRun++;petUpgrade.cancel();previewing=false;
    interactions?.destroy();pet?.destroy();config=MathPetCharacters.get(state.activePet)||MathPetCharacters.list()[0];state.activePet=config.id;
    if(!Object.hasOwn(state.pets,config.id))state.pets[config.id]={level:1,growth:0,feeds:0};
    const p=state.pets[config.id];while(p.growth>=core.required(p.level,config)){p.growth-=core.required(p.level,config);p.level++;}
    MathPetThemes.apply(config.ui);pet=config.create({level:core.visualLevel(p.level)});pet.on('error',()=>toast('伙伴还没加载好，请刷新页面再试。'));$('pet-host').replaceChildren(pet.element);
    interactions=new PetInteraction(pet,config,message=>$('speech').textContent=message);
    $('speech').textContent=config.messages.idle[0];
  }
  function syncActivity(){interactions.setEnabled(!feeding&&!previewing&&!quiz.open&&!settings.open&&!characterDialog.open&&!starter.open);pet.pause(quiz.open||settings.open||characterDialog.open||starter.open);}
  function render(){
    const p=state.pets[config.id],stageIndex=Math.floor((core.visualLevel(p.level)-1)/5),stage=config.stages[stageIndex],need=core.required(p.level,config),food=core.foodOf(config),grade=core.GRADES[state.grade];
    $('points').textContent=state.points;$('pet-name').textContent=config.name;$('level').textContent=`Lv.${p.level}`;$('stage-name').textContent=stage.name+' · '+stage.tag;
    $('pet-host').style.setProperty('--pet-zoom',config.ui?.zoom?.[stageIndex]||1);
    $('grade-caption').textContent=(grade?grade.name+' · ':'')+'每天进步一点点';$('grade-button').textContent=grade?.name||'选择年级';
    const active=state.round&&!state.round.complete?state.round:{grade:state.grade,topic:state.topic};const scope=core.GRADES[active.grade];$('mode-label').textContent=scope?(active.topic==='balanced'?scope.name+'综合练习':scope.topics[active.topic]):'先选择年级';
    $('growth-title').textContent='成长进度';$('growth-value').textContent=`${p.growth} / ${need}`;$('growth-bar').max=need;$('growth-bar').value=p.growth;
    $('growth-note').textContent=`再喂 ${Math.ceil((need-p.growth)/food.growth)} ${config.food.unit}${config.food.name}，就能升到 Lv.${p.level+1}`;
    $('evolution-hint').textContent=p.level<6?'Lv.6 首次进化 · Lv.11 再次进化':p.level<11?'Lv.6 已进化 · Lv.11 再次进化':'Lv.6、Lv.11 已完成进化';
    $('food-title').textContent=config.food.title||`喂养${config.name}，长大一点`;
    const foodArt=document.querySelector('.food-illustration');
    if(foodArt.dataset.pet!==config.id){foodArt.dataset.pet=config.id;if(config.food.iconImage){const image=document.createElement('img');image.src=config.food.iconImage;image.alt='';foodArt.replaceChildren(image);}else foodArt.textContent=config.food.icon;}
    $('food-copy').textContent=`每${config.food.unit}增加 ${food.growth} 点成长值`;
    $('feed').replaceChildren(document.createTextNode(feeding?'正在享用…':`喂${config.food.unit}${config.food.name} `));const cost=document.createElement('span');cost.textContent=`★ ${food.cost}`;$('feed').append(cost);$('feed').disabled=feeding||state.points<food.cost;
    $('feed-hint').textContent=state.points<food.cost?`再答对 ${Math.ceil((food.cost-state.points)/10)} 道题，就能喂一${config.food.unit}${config.food.name}`:`花 ${food.cost} 积分，送给${config.name}一点甜`;
    $('start').textContent=state.round?(state.round.complete?'查看本轮收获':`继续练习 · 第 ${state.round.index+1} 题`):'开始计算 →';$('start').disabled=feeding;
    $('total-solved').textContent=`已练 ${state.totalAnswered} 题 · 答对 ${state.totalSolved} 题`;$('save-status').textContent=storage.warning||saveMessage;
    const milestoneText=[6,11,15].map(n=>`${Math.ceil(core.totalAt(n,config)/food.growth*food.cost/10)} 题到 Lv.${n}`).join(' · ');
    const continuedQuestions=Math.ceil(core.required(15,config)/food.growth*food.cost/10);
    $('evolution-note').textContent=p.level>=15?`Lv.15 后仍可继续升级，每级沿用 Lv.15 门槛（约 ${continuedQuestions} 道题）；外形、体形与特效不再变化。`:`累计答对 ${milestoneText}。积分需用于喂养当前伙伴，角色兑换另计。`;
    const picker=document.querySelector('.pet-select');
    if(picker){
      picker.value=state.activePet;picker.disabled=feeding;
      for(const option of picker.options){
        const character=MathPetCharacters.get(option.value),required=character?.unlock?.cost||0,unlocked=core.isPetUnlocked(state,option.value);
        option.disabled=!unlocked;
        option.textContent=unlocked?character.name:`${character.name} · 需 ${required} 积分`;
        option.title=unlocked?'':`使用 ${required} 积分兑换后解锁`;
      }
    }
    const unlockButton=$('unlock-pet');
    if(unlockButton){
      const locked=MathPetCharacters.list().filter(c=>!core.isPetUnlocked(state,c.id));
      unlockButton.hidden=false;unlockButton.disabled=feeding;
      unlockButton.textContent=locked.length?'认识新伙伴':'我的伙伴';
      unlockButton.title='查看伙伴与积分兑换';
    }
    for(const [id,{button,note}] of unlockCards){const c=MathPetCharacters.get(id),unlocked=core.isPetUnlocked(state,id),cost=c.unlock?.cost||0;
      button.disabled=feeding||(!unlocked&&state.points<cost);
      button.textContent=unlocked?(id===state.activePet?'正在陪伴':'去陪伴'):state.points<cost?`还差 ${cost-state.points} 积分`:`兑换${c.name} · ★ ${cost}`;
      note.textContent=unlocked?'已解锁 · 成长独立保存':`消耗 ${cost} 积分解锁`;}
    if(storage.isTest){$('test-pet-upgrade').textContent=`预览${config.name}升级`;$('test-level').value=p.level;$('test-effect').textContent=`Lv.${p.level} · ${config.effects[core.visualLevel(p.level)-1].name}：${p.level>15?'保持 Lv.15 外形和特效；等级继续成长。':config.effects[core.visualLevel(p.level)-1].description||''}`;$('test-panel').querySelectorAll('button,select,input').forEach(el=>el.disabled=feeding);}
  }
  function renderResult(){
    const r=state.round,correct=r.questions.filter(q=>q.status==='correct').length,wrong=r.questions.filter(q=>q.status==='wrong'),reward=correct*10,food=core.foodOf(config);
    $('result-accuracy').textContent=`完成 10 题 · 答对 ${correct} 题 · 正确率 ${correct*10}%`;$('result-points').textContent=`+${reward}`;
    $('result-detail').textContent=reward?`这轮赚到 ${reward} 积分，可换 ${Math.floor(reward/food.cost)} ${config.food.unit}${config.food.name}。`:'这轮先记住方法，下次再试试。';
    $('back-home').textContent=`回到${config.name}身边 ${config.food.icon}`;const review=$('mistake-review');review.replaceChildren();review.hidden=!wrong.length;
    if(wrong.length){const title=document.createElement('strong');title.textContent='再看一眼，记住正确结果';review.append(title);for(const q of wrong){const row=document.createElement('div');row.className='review-row';row.textContent=`${q.expression} = ${q.answerText}`;review.append(row);}const note=document.createElement('p');note.textContent='后续同年级练习，会穿插复习这些错题。';review.append(note);}
  }
  function renderQuestion(){
    const r=state.round;if(!r)return;$('question-view').hidden=r.complete;$('result-view').hidden=!r.complete;if(r.complete){renderResult();return;}
    const q=r.questions[r.index],answered=q.status!=='pending';$('question-number').textContent=`${core.GRADES[r.grade].name} · 第 ${r.index+1} / 10 题${q.review?' · 复习':''}`;$('round-points').textContent=`★ 本轮 +${r.questions.filter(q=>q.status==='correct').length*10}`;
    $('question-dots').replaceChildren(...r.questions.map((item,i)=>{const dot=document.createElement('i');dot.className=item.status==='correct'?'done':item.status==='wrong'?'incorrect':i===r.index?'current':'';return dot;}));
    const counting=q.topic==='count10',objects=$('counting-objects');objects.hidden=!counting;objects.replaceChildren();
    if(counting){for(let i=0;i<q.visual.count;i++){const star=document.createElement('span');star.textContent='★';star.setAttribute('aria-label','星星');objects.append(star);}}
    $('equation').textContent=counting?'一共有几颗？':q.expression+' =';document.querySelector('.equation').classList.toggle('long',!counting&&q.expression.length>11);document.querySelector('.equation').classList.toggle('counting',counting);
    $('answer').value=answered?q.response:'';$('answer').disabled=answered;$('answer').classList.toggle('incorrect',q.status==='wrong');$('answer').placeholder=q.format==='fraction'?'a/b':'';
    $('submit').hidden=answered;$('next').hidden=q.status!=='wrong';$('next').textContent=r.index===9?'查看本轮收获 →':'知道了，下一题 →';
    $('answer-form').querySelectorAll('[data-key]').forEach(b=>b.disabled=answered);
    $('decimal-key').hidden=r.grade<3;$('fraction-key').hidden=r.grade<5;$('extra-keys').hidden=r.grade<3;
    $('answer-format-note').textContent=q.format==='fraction'?'分数可输入 1/2，等值分数或小数也算对。':r.grade>=3?'支持小数点 · 答对自动下一题':'答对自动下一题 · 答错看答案后继续';
    const feedback=$('answer-feedback');feedback.className='answer-feedback '+(q.status==='correct'?'correct':q.status==='wrong'?'wrong':'');feedback.replaceChildren();
    if(q.status==='wrong'){const answer=document.createElement('span');answer.className='wrong-answer';answer.textContent=`正确答案是 ${q.answerText}`;const hint=document.createElement('span');hint.textContent=q.explanation;feedback.append(answer,hint);}
    else feedback.textContent=q.status==='correct'?'答对啦！+10 积分':'算好就提交，加油！';
  }
  function cancelAuto(){clearTimeout(autoTimer);autoTimer=null;}
  function focusQuestion(){if(!quiz.open)return;const r=state.round;if(r.complete)$('back-home').focus();else if(r.questions[r.index].status==='wrong')$('next').focus();else if(r.questions[r.index].status==='pending')$('answer').focus();}
  function goNext(){cancelAuto();if(core.advance(state)){save();render();renderQuestion();focusQuestion();}}
  function scheduleAuto(){cancelAuto();if(!quiz.open||document.hidden||!state.round||state.round.complete)return;const round=state.round,index=round.index;if(round.questions[index].status!=='correct')return;autoTimer=setTimeout(()=>{if(quiz.open&&!document.hidden&&state.round===round&&round.index===index)goNext();},400);}
  function openQuiz(){if(feeding)return;if(state.grade===null){openSettings();return;}if(!state.round){core.startRound(state);save();}renderQuestion();quiz.showModal();syncActivity();render();focusQuestion();scheduleAuto();}
  $('start').addEventListener('click',openQuiz);$('quiz-close').addEventListener('click',()=>quiz.close());
  quiz.addEventListener('close',()=>{cancelAuto();syncActivity();render();$('start').focus();});quiz.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.repeat)e.preventDefault();});
  $('answer').addEventListener('input',()=>{$('answer').value=$('answer').value.replace(/[^0-9./\s]/g,'').slice(0,18);});
  $('answer-form').addEventListener('click',e=>{const b=e.target.closest('[data-key]'),input=$('answer');if(!b||input.disabled)return;const k=b.dataset.key,start=input.selectionStart??input.value.length,end=input.selectionEnd??start;input.value=k==='clear'?'':k==='delete'?input.value.slice(0,start===end?Math.max(0,start-1):start)+input.value.slice(end):(input.value.slice(0,start)+k+input.value.slice(end)).slice(0,18);input.focus();input.setSelectionRange(input.value.length,input.value.length);});
  $('answer-form').addEventListener('submit',e=>{e.preventDefault();const result=core.submit(state,$('answer').value);if(result.status==='locked')return;if(result.status==='invalid'){$('answer-feedback').className='answer-feedback wrong';$('answer-feedback').textContent=(state.round.grade<3?'请先输入一个数字，例如 3。':'请填写数字、小数或分数，例如 8、0.5、1/2。');$('answer').focus();return;}save();render();pet.play(result.status==='correct'?'celebrate':'comfort');renderQuestion();if(result.status==='correct')scheduleAuto();else $('next').focus();});
  $('next').addEventListener('click',goNext);
  $('back-home').addEventListener('click',()=>{state.round=null;save();quiz.close();render();$('speech').textContent='练完啦，回来一起玩一会儿吧。';pet.play('wave');});
  $('another-round').addEventListener('click',()=>{cancelAuto();core.startRound(state);save();renderQuestion();render();focusQuestion();});
  $('feed').addEventListener('click',()=>{
    if(feeding)return;
    const result=core.feed(state,state.activePet,config);if(result.status!=='fed')return;
    feeding=true;save();syncActivity();pet.play('feed');$('speech').textContent=`啊呜，${config.food.name}真好吃！谢谢你。`;render();
    feedTimer=setTimeout(()=>{
      if(result.leveled){
        showPetUpgrade(result);return;
      }else toast(`喂养成功 · 成长值 +${result.growth}`);
      endFeeding();
    },core.RULES.feedDurationMs);
  });
  async function showPetUpgrade(result,preview=false){
    const run=++upgradeRun,activePet=pet;
    feeding=true;syncActivity();
    activePet.setLevel(core.visualLevel(result.level),{animate:false});activePet.pause(true);render();
    try{await petUpgrade.play({config,origin:activePet.element,level:result.level,previous:result.previous,preview});}
    finally{
      if(run===upgradeRun&&activePet===pet){
        activePet.play('idle');activePet.pause(false);
        $('speech').textContent=preview?'嘿嘿，和你一起成长真开心！':`我升到 Lv.${result.level} 啦！${result.evolved?'快看，我进化了！':'又进步了一点。'}`;
        endFeeding();
        (preview?$('test-pet-upgrade'):$('feed')).focus({preventScroll:true});
      }
    }
  }
  function endFeeding(){feeding=false;syncActivity();render();}
  function selectedGrade(){return Number(settings.querySelector('input[name="grade"]:checked')?.value??2);}
  function updateTopicOptions(topic='balanced'){const grade=selectedGrade(),info=core.GRADES[grade];$('grade-scope').textContent=info.description;$('topic-select').replaceChildren();for(const [id,name] of Object.entries({balanced:'综合练习 · 巩固本年级计算',...info.topics})){const option=document.createElement('option');option.value=id;option.textContent=name;$('topic-select').append(option);}$('topic-select').value=Q.allowed(grade,topic)?topic:'balanced';}
  function openSettings(){
    if(feeding)return;
    const first=state.grade===null;$('settings-title').textContent=first?'先选孩子的年级':'年级与练习范围';$('settings-description').textContent=first?'我们会按年级安排计算练习，之后随时可以调整。':'更改后立即开始新范围的练习，已获得的积分和成长保留。';$('settings-close').hidden=first;$('settings-save').textContent=first?'选好了，开始陪伴':'保存并使用新设置';
    settings.querySelector(`input[value="${state.grade??2}"]`).checked=true;updateTopicOptions(state.topic);settings.showModal();settings.querySelector('input[name="grade"]:checked').focus();syncActivity();
  }
  for(const [id,grade] of Object.entries(core.GRADES)){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name='grade';input.value=id;span.textContent=grade.name;label.append(input,span);$('grade-options').append(label);input.addEventListener('change',()=>updateTopicOptions());}
  $('settings-open').addEventListener('click',openSettings);$('settings-close').addEventListener('click',()=>settings.close());settings.addEventListener('cancel',e=>{if(state.grade===null)e.preventDefault();});
  $('settings-save').addEventListener('click',()=>{const grade=selectedGrade(),topic=$('topic-select').value,changed=grade!==state.grade||topic!==state.topic;state.grade=grade;state.topic=topic;if(changed){cancelAuto();state.round=null;}save();render();settings.close();toast(`${core.GRADES[grade].name}练习准备好了。`);});
  settings.addEventListener('close',()=>{syncActivity();$('settings-open').focus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAuto();else scheduleAuto();});
  window.addEventListener('storage',e=>{if(e.key!==storage.key)return;cancelAuto();clearTimeout(feedTimer);feeding=false;state=storage.load();mount();render();if(quiz.open){if(state.round){renderQuestion();focusQuestion();scheduleAuto();}else quiz.close();}onboard();syncActivity();toast('已同步另一个页面的最新进度。');});
  window.addEventListener('pagehide',()=>{upgradeRun++;petUpgrade.cancel();interactions.destroy();cancelAuto();clearTimeout(feedTimer);clearTimeout(toastTimer);pet.pause(true);});
  window.addEventListener('pageshow',e=>{if(e.persisted){state=storage.load();feeding=false;mount();render();if(quiz.open&&state.round)renderQuestion();onboard();syncActivity();scheduleAuto();}});
  const registered=MathPetCharacters.list();
  for(const c of registered){
    const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('strong'),tag=document.createElement('span');
    button.type='button';button.className='starter-option';button.dataset.starter=c.id;button.setAttribute('aria-pressed','false');img.src=c.portrait||(c.id==='wukong'?'assets/stage-1-portrait.png':`characters/${c.id}/assets/stage-1-portrait.png`);img.alt='';name.textContent=c.name;tag.textContent=c.stages[0].name;button.append(img,name,tag);$('starter-list').append(button);
    button.addEventListener('click',()=>{starterSelection=c.id;for(const b of $('starter-list').children)b.setAttribute('aria-pressed',String(b===button));$('starter-choice').textContent=c.stages.map(s=>s.name).join(' → ');$('starter-adopt').textContent=`领养${c.name} · 免费`;$('starter-adopt').disabled=false;});
  }
  starter.addEventListener('cancel',e=>e.preventDefault());
  $('starter-adopt').addEventListener('click',()=>{
    // Reload before granting the one free pet in case another tab already chose one.
    const latest=storage.load();if(latest.starterChosen){state=latest;mount();render();starter.close();onboard();return;}
    if(!core.chooseStarter(state,starterSelection,registered.map(c=>c.id)))return;
    save();mount();render();starter.close();onboard();syncActivity();
  });
  function onboard(){
    if(!storage.isTest&&!state.starterChosen){if(settings.open)settings.close();if(quiz.open)quiz.close();if(characterDialog.open)characterDialog.close();if(!starter.open){starter.showModal();$('starter-title').focus();}syncActivity();return;}
    if(starter.open)starter.close();if(state.grade===null&&!settings.open)openSettings();
  }
  function selectCharacter(id){if(feeding)return;if(!core.selectPet(state,id,registered.map(c=>c.id))){render();toast('请先在「认识新伙伴」中使用积分兑换。');return;}mount();save();render();syncActivity();}
  if(registered.length>1){const select=document.createElement('select');select.className='pet-select';select.setAttribute('aria-label','选择宠物');for(const character of registered){const option=document.createElement('option');option.value=character.id;option.textContent=character.name;select.append(option);}select.value=state.activePet;document.querySelector('.welcome').insertBefore(select,$('settings-open'));select.addEventListener('change',()=>selectCharacter(select.value));}
  for(const c of registered){
    const card=document.createElement('article'),img=document.createElement('img'),body=document.createElement('div'),title=document.createElement('h3'),note=document.createElement('p'),button=document.createElement('button');
    card.className='character-option';img.src=c.portrait||(c.id==='wukong'?'assets/stage-1-portrait.png':`characters/${c.id}/assets/stage-1-portrait.png`);img.alt=c.name;title.textContent=c.name;button.type='button';button.dataset.unlock=c.id;body.append(title,note,button);card.append(img,body);$('character-list').append(card);unlockCards.set(c.id,{button,note});
    button.addEventListener('click',()=>{if(feeding)return;if(core.isPetUnlocked(state,c.id)){selectCharacter(c.id);characterDialog.close();return;}const result=core.unlockPet(state,c.id,c);if(result.status==='insufficient')toast(`还需要 ${result.remaining} 积分才能解锁${c.name}。`);else if(result.status==='unlocked'){save();render();toast(`${c.name}解锁成功！已消耗 ${result.cost} 积分。`);}});
  }
  $('unlock-pet').addEventListener('click',()=>{if(feeding)return;render();characterDialog.showModal();syncActivity();});
  $('characters-close').addEventListener('click',()=>characterDialog.close());characterDialog.addEventListener('close',()=>{syncActivity();$('unlock-pet').focus();});
  if(storage.isTest){
    document.title='算算萌宠 · 开发测试版';$('test-panel').hidden=false;document.querySelector('.brand').href='test.html';
    
    for(const [id,label] of Object.entries({idle:'待机 / 眨眼',wave:'挥手',pet:'摸摸头',feed:'进食（仅预览）',think:'思考',comfort:'鼓励',celebrate:'庆祝',jump:'跳跃',sleep:'睡眠',run:'跑动',skill:'本领展示',evolve:'进化特效'})){const option=document.createElement('option');option.value=id;option.textContent=label;$('test-action').append(option);}
    function testChange(command,value){
      if(feeding||quiz.open||settings.open||characterDialog.open)return;
      previewing=false;const previous=state.activePet,previousLevel=state.pets[state.activePet].level;MathPetTestTools.apply(state,command,value,registered);
      if(previous!==state.activePet)mount();else if(command==='level')pet.setLevel(core.visualLevel(state.pets[state.activePet].level));else if(command!=='level-up')pet.play('idle');
      save();render();syncActivity();
      if(command==='level-up')showPetUpgrade({level:state.pets[state.activePet].level,previous:previousLevel,evolved:[6,11].includes(state.pets[state.activePet].level)},true);
    }
    $('test-panel').addEventListener('click',e=>{const target=e.target.closest('button');if(target?.dataset.testCommand)testChange(target.dataset.testCommand);if(target?.dataset.testLevel)testChange('level',target.dataset.testLevel);});
    $('test-level').addEventListener('change',()=>{const n=Number($('test-level').value);if(!Number.isSafeInteger(n)||n<1||n>=Number.MAX_SAFE_INTEGER){render();toast('请输入大于零的整数等级。');return;}testChange('level',n);});
    $('test-pet-upgrade').addEventListener('click',()=>{if(feeding||quiz.open||settings.open||characterDialog.open)return;previewing=false;const level=state.pets[config.id].level;showPetUpgrade({level,previous:Math.max(1,level-1)},true);});
    $('test-play').addEventListener('click',()=>{if(feeding)return;previewing=true;syncActivity();pet.play($('test-action').value);$('speech').textContent=`动作预览：${$('test-action').selectedOptions[0].textContent}`;});
    $('test-idle').addEventListener('click',()=>{if(feeding)return;previewing=false;pet.play('idle');syncActivity();$('speech').textContent=config.messages.idle[0];});
  }
  mount();render();onboard();if(state.starterChosen)save();
})();
