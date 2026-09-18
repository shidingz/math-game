const {test}=require('node:test'),assert=require('node:assert/strict');
const Core=require('../game/core'),{describe}=require('../wechat/runtime/evolution-progress');
const info=(level,growth=0,points=0,testMode=false)=>describe(Core,{level,growth,feeds:0},points,{},testMode);
test('进化提示正确换算累计成长与题数，6级后切换到11级',()=>{
 const first=info(1);assert.equal(first.nextLevel,6);assert.equal(first.remainingGrowth,300);assert.equal(first.feeds,15);assert.equal(first.questions,30);
 const second=info(6);assert.equal(second.nextLevel,11);assert.equal(second.remainingGrowth,700);assert.equal(second.questions,70);
 assert.equal(first.questions+second.questions,100);
 assert.deepEqual(second.milestones,[{level:6,complete:true},{level:11,complete:false}]);
 for(const level of [11,15,18,100]){const r=info(level);assert.equal(r.completed,true);assert.equal(r.nextLevel,null);assert.equal(r.questions,0);assert.equal(r.message,'已达终极形态');assert.match(r.note,/此后不再进化/);assert.ok(r.milestones.every(m=>m.complete));}
});
test('题数考虑当前成长、余额和整份食物，不把答题当作直接进化',()=>{
 const almost=info(5,60,0);assert.equal(almost.remainingGrowth,20);assert.equal(almost.feeds,1);assert.equal(almost.questions,2);
 assert.equal(info(5,60,10).questions,1);assert.equal(info(5,60,19).questions,1);
 assert.equal(info(5,60,20).questions,0);assert.match(info(5,60,20).message,/积分已够，喂养即可进化/);
 assert.equal(info(5,79,0).questions,2);assert.equal(info(5,79,0).feeds,1);
 const pet=Object.freeze({level:5,growth:60,feeds:9});describe(Core,pet,10,{});assert.equal(pet.growth,60);
});
test('实际喂食验证所有未进化等级的提示能到目标，少喂一份不能到',()=>{
 for(let level=1;level<=10;level++)for(let growth=0;growth<Core.required(level);growth+=20){
  const state=Core.initialState();Core.chooseStarter(state,'wukong',['wukong']);state.pets.wukong={level,growth,feeds:0};
  const r=describe(Core,state.pets.wukong,0,{});state.points=r.questions*Core.RULES.reward;
  for(let i=0;i<r.feeds-1;i++)Core.feed(state,'wukong',{});
  assert.ok(state.pets.wukong.level<r.nextLevel);Core.feed(state,'wukong',{});assert.ok(state.pets.wukong.level>=r.nextLevel);
 }
});
test('无限积分测试显示正常题数的等价说明，不要求测试用户继续做题',()=>{
 const r=info(1,0,10000,true);assert.equal(r.equivalentQuestions,30);assert.match(r.message,/距 Lv.6 进化还差 30 题/);assert.match(r.note,/测试积分不限，可直接喂养/);
});
