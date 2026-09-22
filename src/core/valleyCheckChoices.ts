import type { ExpeditionChoice } from './expedition';
import type { PetState } from './petTypes';
import { getExplorationBudget } from './explorationBudget';
import { getRegionActionCost } from './explorationTravelData';
import { valleyGatherFinds, valleyGatherNames } from './valleyExplorationData';
import { explorationCheck, explorationMealChoices } from './explorationCheckData';

export const getValleyCheckChoices = (pet: PetState, now: number): ExpeditionChoice[] => {
  const t = pet.community.expedition.active!, short = t.style === 'short', target = t.target ?? 'valley_mushroom';
  const cost = short ? { hunger: 21, energy: 12 } : getRegionActionCost('valley', t.step);
  const base = { ...cost, health: 0, mood: 0, finds: {} };
  const safe: ExpeditionChoice = { ...base, id: 'safe', title: short && t.step === 1 || t.step === 5 ? '沿熟悉道路稳妥返回' : '沿路标稳妥前进', description: '沿着熟悉的小路，稳妥走到下一处。', check: { mode: 'safe' }, observation: 'b' };
  const gather = short ? t.step === 0 : t.step === 1 || t.step === 3;
  const available = Math.min(getExplorationBudget(pet, now)?.available ?? 0, 2 - (t.harvestSpent ?? 0));
  const choices: ExpeditionChoice[] = [];
  if (gather && available > 0) {
    if (target === 'aquamarine') {
      for (const points of [1, 2]) {
        if (points > available) continue;
        choices.push({ ...base, id: `gather:${points}`, title: `${points === 2 ? '用手镐' : '徒手'}勘探海蓝宝`, description: '沿着岩缝，寻找海蓝色的微光。',
          harvest: points, finds: { valley_mushroom: points }, research: { kind: 'treasure', id: 'creek_aquamarine', points },
          equipment: points === 2 ? 'prospector_pick' : undefined, check: explorationCheck('study', 3, points === 2 ? { tool: 'prospector_pick' } : {}), observation: points === 2 ? 'b' : 'a' });
      }
    } else {
      const materials = target === 'materials';
      const ordinary: ExpeditionChoice = { ...base, id: 'gather:1', title: `采集${valleyGatherNames[target]}`, description: materials ? '挑拣结实的木料和石块，带回农场。' : '收集沿途的新鲜食材，装进行囊。',
        harvest: 1, finds: valleyGatherFinds(target), check: explorationCheck(materials ? 'exercise' : 'garden', materials ? 2 : 1), observation: 'a' };
      choices.push(ordinary);
      if (!materials) choices.push({ ...ordinary, id: 'gather:sickle', title: `用镰刀采集${valleyGatherNames[target]}`, equipment: 'harvest_sickle', check: explorationCheck('garden', 1, { tool: 'harvest_sickle' }), observation: 'b' });
    }
    safe.title = '留下材料，沿路标继续';
  } else if (gather) {
    choices.push({ ...base, id: 'observe', title: '记录当地植物与地貌', description: '采集机会已用完，本次只练习观察，不取得物资。', check: explorationCheck(target === 'aquamarine' ? 'study' : target === 'materials' ? 'exercise' : 'garden', target === 'aquamarine' ? 3 : target === 'materials' ? 2 : 1), observation: 'a' });
  } else if (!short && t.step === 0) {
    choices.push({ ...base, id: 'look:a', title: '观察路标，准备下一段路线', description: '看清路标，为接下来的路做好准备。', check: explorationCheck('study', 1, { prepare: 'focus' }), observation: 'a' });
    choices.push({ ...choices[0], id: 'look:lens', title: '用放大镜辨认水位刻痕', equipment: 'survey_lens', check: explorationCheck('study', 1, { prepare: 'focus', tool: 'survey_lens' }), observation: 'b' });
  } else if (!short && t.step === 2) {
    choices.push({ ...base, id: 'look:a', title: '辨认旧农舍留下的记录', description: '翻看旧记录，了解这里曾经的生活。', check: explorationCheck('study', 2), observation: 'a' });
    choices.push({ ...base, id: 'look:b', title: '越过草坡，查看遗留农具', description: '抄过草坡，看看屋后留下的农具。', check: explorationCheck('exercise', 2, { risky: true }), observation: 'b' });
  } else if (!short && t.step === 4) {
    choices.push({ ...base, id: 'look:a', title: '整理温室手账里的见闻', description: '坐在窗边，记下这趟同行的发现。', check: explorationCheck('study', 2), observation: 'a' });
    choices.push(...explorationMealChoices(t.bag).map(m => ({ ...base, id: m.id, title: m.title, mealItem: m.mealItem, description: '吃点热乎的，为接下来的路留些力气。', check: explorationCheck('cooking', 2, { prepare: 'meal' }), observation: 'b' as const })));
  } else if (!gather) {
    choices.push({ ...base, id: 'look:a', title: '辨认归途，找到回家的路', description: '沿着熟悉的地标，找到归途。', check: explorationCheck('study', short ? 1 : 2), observation: 'a' });
    choices.push({ ...base, id: 'look:b', title: '沿河岸近路返回', description: '顺着河岸的小路，早点回到基地。', check: explorationCheck('exercise', short ? 1 : 2, { risky: true }), observation: 'b' });
  }
  if (!short && t.step === 3) {
    choices.push({ ...base, id: 'cross', title: '踩着露石穿过浅滩', description: '看准落脚点，穿过清浅的河水。', check: explorationCheck('exercise', 2, { risky: true }), observation: 'a' });
    choices.push({ ...base, id: 'cross:rope', title: '固定探路绳后穿过浅滩', description: '拉稳绳索，小心走到对岸。', equipment: 'trail_rope', check: explorationCheck('exercise', 2, { risky: true, tool: 'trail_rope' }), observation: 'b' });
  }
  return [...choices, safe];
};
