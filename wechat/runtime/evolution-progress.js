'use strict';
// Read-only estimate. Questions fund food; answering never evolves a pet by itself.
function describe(core, pet, points, character, testMode = false) {
  const level = pet.level, nextLevel = level < 6 ? 6 : level < 11 ? 11 : null;
  const milestones = [6, 11].map(value => ({ level: value, complete: level >= value }));
  if (!nextLevel) return { milestones, completed: true, nextLevel: null, remainingGrowth: 0, feeds: 0, questions: 0,
    message: '已达终极形态', note: '此后不再进化，仍可继续成长' };
  const remainingGrowth = Math.max(0, core.totalAt(nextLevel, character) - core.totalAt(level, character) - pet.growth);
  const food = core.foodOf(character), feeds = Math.max(1, Math.ceil(remainingGrowth / food.growth));
  const cost = feeds * food.cost, balance = Math.max(0, Number(points) || 0);
  const questions = Math.ceil(Math.max(0, cost - balance) / core.RULES.reward);
  const equivalentQuestions = Math.ceil(cost / core.RULES.reward);
  const message = testMode ? `距 Lv.${nextLevel} 进化还差 ${equivalentQuestions} 题` : questions ?
    `距 Lv.${nextLevel} 进化还差 ${questions} 题` : '积分已够，喂养即可进化';
  const note = testMode ? '以上为正常题数；测试积分不限，可直接喂养' :
    '已计入现有积分；积分用于喂养后进化';
  return { milestones, completed: false, nextLevel, remainingGrowth, feeds, cost, questions, equivalentQuestions, message, note };
}
module.exports = { describe };
