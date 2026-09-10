/* Pure game transactions; every answered question settles exactly once. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./questions.js'),require('./growth.js')):factory(root.MathPetQuestions,root.MathPetGrowth);if(typeof module==='object'&&module.exports)module.exports=api;else root.MathPetCore=api;})(globalThis,(questions,growth)=>{
  'use strict';
  const RULES=Object.freeze({roundSize:10,reward:10,feedCost:20,feedGrowth:20,visualMaxLevel:15,feedDurationMs:1600,petUnlockCost:Object.freeze({wukong:0,nezha:500,yutu:500,jingwei:500})});
  const safeInt=(v,max=100000000)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  function initialState(){return {version:2,points:0,activePet:'wukong',unlockedPets:{wukong:true},pets:{wukong:{level:1,growth:0,feeds:0}},grade:null,topic:'balanced',round:null,totalSolved:0,totalAnswered:0,totalRounds:0,mistakes:[]};}
  function oldQuestion(q){if(!q||typeof q!=='object')return null;const a=String(q.a),b=String(q.b),answer=questions.calc(questions.parse(a),q.op,questions.parse(b));if(!answer)return null;return {topic:['×','÷'].includes(q.op)?'tables':'add100',expression:`${a} ${q.op} ${b}`,left:a,op:q.op,right:b,answer,answerText:questions.format(answer),format:'number',explanation:`正确结果是 ${questions.format(answer)}。`,status:q.solved?'correct':'pending',response:q.solved?questions.format(answer):''};}
  function restore(value){
    if(!value||![1,2].includes(value.version))return initialState();
    const s=initialState(),legacy=value.version===1;
    for(const k of ['points','totalSolved','totalRounds','totalAnswered'])if(safeInt(value[k]))s[k]=value[k];
    s.totalAnswered=Math.max(s.totalAnswered,s.totalSolved);
    if(!legacy&&questions.GRADES[value.grade])s.grade=Number(value.grade);
    if(questions.allowed(s.grade,value.topic))s.topic=value.topic;
    if(value.pets&&typeof value.pets==='object')for(const [id,p] of Object.entries(value.pets)){
      if(!/^[a-z][a-z0-9-]{0,40}$/.test(id)||['constructor','prototype'].includes(id))continue;
      if(p&&safeInt(p.level,Number.MAX_SAFE_INTEGER-1)&&p.level>=1&&safeInt(p.growth,1000000)&&safeInt(p.feeds))s.pets[id]={level:p.level,growth:legacy?Math.floor(Math.min(59,p.growth)/60*growth.required(p.level)):p.growth,feeds:p.feeds};
    }
    if(!legacy&&value.unlockedPets&&typeof value.unlockedPets==='object')for(const [id,unlocked] of Object.entries(value.unlockedPets))if(/^[a-z][a-z0-9-]{0,40}$/.test(id)&&unlocked===true)s.unlockedPets[id]=true;
    if(typeof value.activePet==='string'&&Object.hasOwn(s.pets,value.activePet)&&isPetUnlocked(s,value.activePet))s.activePet=value.activePet;
    let r=value.round;
    if(legacy&&r&&Array.isArray(r.questions))r={grade:2,topic:value.mode==='addsub'?'add100':value.mode==='tables'?'tables':'balanced',index:r.index,complete:r.complete,questions:r.questions.map(oldQuestion)};
    if(r&&questions.allowed(r.grade,r.topic)&&safeInt(r.index,9)&&typeof r.complete==='boolean'&&Array.isArray(r.questions)&&r.questions.length===10&&r.questions.every(questions.validQuestion)&&r.questions.every((q,i)=>i<r.index?q.status!=='pending':i>r.index?q.status==='pending':true)&&(!r.complete||(r.index===9&&r.questions.every(q=>q.status!=='pending'))))s.round=JSON.parse(JSON.stringify(r));
    if(!legacy&&Array.isArray(value.mistakes))s.mistakes=value.mistakes.filter(m=>m&&questions.GRADES[m.grade]&&questions.allowed(m.grade,m.question?.topic)&&questions.validQuestion(m.question)).slice(-30).map(m=>JSON.parse(JSON.stringify(m)));
    return s;
  }
  function startRound(state,rng=Math.random){
    state.round=questions.makeRound(state.grade??2,state.topic,rng);
    const review=state.mistakes.filter(m=>m.grade===state.grade&&(state.topic==='balanced'||m.question.topic===state.topic)).slice(-2);
    for(let i=0;i<review.length;i++){const q=JSON.parse(JSON.stringify(review[i].question));q.status='pending';q.response='';q.review=true;const existing=state.round.questions.findIndex(item=>item.expression===q.expression);if(existing>=0)state.round.questions[existing]=state.round.questions[i];state.round.questions[i]=q;}
    return state.round;
  }
  function submit(state,text){
    const r=state.round,q=r?.questions[r.index];if(!q||q.status!=='pending'||r.complete)return {status:'locked',reward:0};
    const answer=questions.parse(text);if(!answer)return {status:'invalid',reward:0};
    const correct=questions.equal(answer,q.answer);q.response=String(text).trim();q.status=correct?'correct':'wrong';state.totalAnswered++;
    state.mistakes=state.mistakes.filter(m=>!(m.grade===r.grade&&m.question.expression===q.expression));
    if(correct){state.points+=RULES.reward;state.totalSolved++;}else{state.mistakes.push({grade:r.grade,question:JSON.parse(JSON.stringify(q))});state.mistakes=state.mistakes.slice(-30);}
    return {status:q.status,reward:correct?RULES.reward:0,answer:q.answerText,last:r.index===9};
  }
  function advance(state){const r=state.round;if(!r||r.complete||r.questions[r.index].status==='pending')return false;if(r.index===9){r.complete=true;state.totalRounds++;}else r.index++;return true;}
  function isPetUnlocked(state,id){
    return id==='wukong'||state?.unlockedPets?.[id]===true;
  }
  function unlockPet(state,id,config){
    if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,40}$/.test(id)||['constructor','prototype'].includes(id)||(config&&config.id!==id))return {status:'unavailable'};
    const cost=Number.isSafeInteger(config?.unlock?.cost)?config.unlock.cost:RULES.petUnlockCost[id];
    if(!Number.isSafeInteger(cost)||cost<0)return {status:'unavailable'};
    if(isPetUnlocked(state,id))return {status:'already-unlocked',cost:0};
    if(!state||state.points<cost)return {status:'insufficient',cost,remaining:Math.max(0,cost-(state?.points||0))};
    if(!state.unlockedPets||typeof state.unlockedPets!=='object')state.unlockedPets={wukong:true};
    state.points-=cost;state.unlockedPets[id]=true;
    if(!Object.hasOwn(state.pets,id))state.pets[id]={level:1,growth:0,feeds:0};
    return {status:'unlocked',cost,remaining:0};
  }
  function selectPet(state,id,registeredIds){
    if(typeof id!=='string'||!Array.isArray(registeredIds)||!registeredIds.includes(id)||!/^[a-z][a-z0-9-]{0,40}$/.test(id)||['constructor','prototype'].includes(id))return false;
    if(!isPetUnlocked(state,id))return false;
    if(!Object.hasOwn(state.pets,id))state.pets[id]={level:1,growth:0,feeds:0};
    state.activePet=id;return true;
  }
  function foodOf(config){const food=config?.food||{};return {cost:Number.isSafeInteger(food.cost)&&food.cost>0?food.cost:20,growth:Number.isSafeInteger(food.growth)&&food.growth>0?food.growth:20};}
  function feed(state,petId=state.activePet,config){
    const p=state.pets[petId];if(!p)return {status:'missing'};const food=foodOf(config);
    if(state.points<food.cost)return {status:'insufficient'};
    const previous=p.level;state.points-=food.cost;p.feeds++;
    p.growth+=food.growth;while(p.growth>=growth.required(p.level,config)){p.growth-=growth.required(p.level,config);p.level++;}
    return {status:'fed',previous,level:p.level,leveled:p.level>previous,evolved:Math.floor((growth.visualLevel(p.level)-1)/5)!==Math.floor((growth.visualLevel(previous)-1)/5),growth:food.growth};
  }
  function pick(list,last,rng=Math.random){const filtered=list.filter(x=>x!==last),pool=filtered.length?filtered:list;return pool[Math.floor(Math.min(.999999999,Math.max(0,rng()))*pool.length)];}
  return {RULES,GRADES:questions.GRADES,initialState,restore,startRound,submit,advance,isPetUnlocked,unlockPet,selectPet,feed,foodOf,pick,required:growth.required,totalAt:growth.totalAt,visualLevel:growth.visualLevel};
});
