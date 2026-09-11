/* Test-only transactions. The app only connects these to the isolated test save. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.MathPetCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.MathPetTestTools=api;})(globalThis,core=>{
  'use strict';
  function createState(characters){
    const state=core.initialState({chooseStarter:false});state.points=10000;state.grade=2;
    apply(state,'unlock-all',null,characters);
    // Test mode keeps Wukong as its default and unlocks every registered pet.
    if(characters.some(c=>c.id==='wukong'))state.activePet='wukong';
    else if(characters.some(c=>c.id==='ragdoll'))state.activePet='ragdoll';
    else if(characters.some(c=>c.id==='yutu'))state.activePet='yutu';
    return state;
  }
  function apply(state,command,value,characters){
    const config=characters.find(c=>c.id===state.activePet);
    if(!config)throw new Error('测试角色不存在');
    switch(command){
      case 'add-points':state.points=Math.min(100000000,state.points+1000);break;
      case 'zero-points':state.points=0;break;
      case 'unlock-all':for(const c of characters){state.unlockedPets[c.id]=true;state.pets[c.id]??={level:1,growth:0,feeds:0};}break;
      case 'lock-others':state.unlockedPets={wukong:true};state.activePet='wukong';break;
      case 'level':{
        const level=Number(value);if(!Number.isSafeInteger(level)||level<1||level>=Number.MAX_SAFE_INTEGER)throw new RangeError('等级必须是正整数');
        state.pets[state.activePet].level=level;state.pets[state.activePet].growth=0;break;
      }
      case 'level-up':{
        const p=state.pets[state.activePet];p.level++;p.growth=0;break;
      }
      default:throw new RangeError('未知测试指令');
    }
    return state;
  }
  return Object.freeze({createState,apply});
});
