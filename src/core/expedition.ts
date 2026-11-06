import { removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { regionIds, regions } from './expeditionData';
import { withExpedition } from './expeditionReturn';
import type { RegionId } from './expeditionTypes';
import type { PetState } from './petTypes';
import { getExplorationBudget } from './explorationBudget';

const fail = (pet: PetState, recentEvent: string): PetState => ({ ...pet, recentEvent });
export const getExpeditionHarvestLeft = (pet: PetState, _id: RegionId, now = Date.now()) => getExplorationBudget(pet, now)?.available ?? 0;
export const getBaseUpgrade = (level: number, region: RegionId = 'valley') => level === 0
  ? { coins: 120, wood: 3, stone: 2, name: '修好休息基地', benefit: '本地区伙伴委托耗时缩短 10%' }
  : { coins: 180, wood: 2, stone: 3, name: '修通往返步道', benefit: region === 'valley' ? '本地区伙伴委托耗时缩短至 20%；累计采集 80 次并制作溪光水景后，提高探索酬谢' : '本地区伙伴委托耗时缩短至 20%；安全通路基础体力消耗降低 20%' };
export const upgradeExpeditionBase = (pet: PetState, region: RegionId, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause || !regionIds.includes(region)) return pet;
  pet = advancePet(pet, now);
  const state = pet.community.expedition, progress = state.regions[region];
  if (progress.base !== expectedLevel || progress.base >= 2 || !progress.surveyed || !canSpendCompanionTime(pet)) return pet;
  const quote = getBaseUpgrade(progress.base, region);
  if (pet.coins < quote.coins || (pet.inventory.community_wood ?? 0) < quote.wood || (pet.inventory.community_stone ?? 0) < quote.stone) return fail(pet, '建材或金币不足，探索成果会永久保留。');
  return { ...withExpedition(pet, { regions: { ...state.regions, [region]: { ...progress, base: progress.base + 1 } } }), coins: pet.coins - quote.coins,
    inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', quote.wood), 'community_stone', quote.stone), recentEvent: regions[region].base + '：' + quote.benefit + '。' };
};
