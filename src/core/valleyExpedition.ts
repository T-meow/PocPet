import type { ExpeditionChoice } from './expedition';
import type { ExpeditionTrip } from './expeditionTypes';
import type { PetState } from './petTypes';
import { getExplorationBudget } from './explorationBudget';
import { valleyGatherFinds, valleyGatherNames, valleyPatrolEnergy, valleyPatrolHunger, valleyPatrolNodes } from './valleyExplorationData';
import { explorationTravel, getRegionActionCost } from './explorationTravelData';

export const isValleyExpedition = (t: ExpeditionTrip) => t.rulesVersion >= 2 && t.route[t.leg] === 'valley';
export const getExpeditionCampStep = (t: ExpeditionTrip) => isValleyExpedition(t) ? t.style === 'short' ? 2 : 6 : t.rulesVersion >= 3 ? explorationTravel[t.route[t.leg]].actions : 3;
export const getValleyExpeditionChoices = (pet: PetState, now: number): ExpeditionChoice[] => {
  const t = pet.community.expedition.active!;
  if (t.step >= getExpeditionCampStep(t)) return [];
  const short = t.style === 'short', walk = t.style === 'walk', target = t.target ?? 'valley_mushroom';
  const hunger = walk ? 0 : t.rulesVersion >= 3 ? short ? 21 : getRegionActionCost('valley', t.step).hunger : short ? [8, 6][t.step] : valleyPatrolHunger[t.step];
  const energy = walk ? 0 : t.rulesVersion >= 3 ? short ? 12 : getRegionActionCost('valley', t.step).energy : short ? [8, 4][t.step] : valleyPatrolEnergy[t.step];
  const base = { hunger, energy, health: 0, mood: 0, finds: {} };
  const gather = !walk && (short ? t.step === 0 : t.step === 1 || t.step === 3);
  const available = Math.min(getExplorationBudget(pet, now)?.available ?? 0, 2 - (t.harvestSpent ?? 0));
  if (gather && available > 0) {
    if (target === 'aquamarine') {
      const progress = (pet.community.treasureResearch.creek_aquamarine ?? 0) % 6;
      return [1, 2].filter(points => points <= available && (points === 1 || (pet.inventory.prospector_pick ?? 0) > 0)).map(points => ({
        ...base, id: `gather:${points}`, title: `${points === 2 ? '用手镐' : '徒手'}勘探海蓝宝`,
        description: `采集机会 −${points}；调查 ${progress}/6 → ${(progress + points) % 6}/6。${progress + points >= 6 ? '获得海蓝宝 ×1；' : ''}野菇 ×${points}。${points === 2 ? '手镐耐久 −1。' : ''}`,
        harvest: points, equipment: points === 2 ? 'prospector_pick' : undefined,
        research: { kind: 'treasure', id: 'creek_aquamarine', points }, finds: { valley_mushroom: points, ...(progress + points >= 6 ? { creek_aquamarine: 1 } : {}) },
      }));
    }
    return [{ ...base, id: 'gather:1', title: `采集${valleyGatherNames[target]}`, description: '消耗采集机会 1 次，按当前目标取得材料。', harvest: 1, finds: valleyGatherFinds(target) },
      { ...base, id: 'look:b', title: '留下材料，记录风景', description: '保留采集机会，继续这趟旅程。' }];
  }
  const node = valleyPatrolNodes[short ? 5 : t.step];
  return ['a', 'b'].map((branch, index) => ({ ...base, id: `look:${branch}`, title: short ? '带着发现返回' : node[index + 1],
    description: walk ? '轻装散步，不额外消耗饱食或体力；不领取巡路酬谢和采集物资。' : gather ? '本趟或当前采集机会已用完，仍可继续巡路。' : `记录${node[0]}的见闻，继续前行。` }));
};
