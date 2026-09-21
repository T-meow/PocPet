import { removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { communityDecorations, communityDecorationIds, type CommunityDecorationId } from './regionalTreasures';
import type { PetState } from './petTypes';
import type { Inventory } from './petTypes';
import { adventureTreasureIds } from './adventureItems';
import { decorationEffects, getDecorationLevel } from './decorationEffects';
import { advanceCommunityAnimals } from './communityFarm';

export const decorationUpgradeCosts = [
  { coins: 300, common: 1, building: 1 }, { coins: 500, common: 1, building: 1 },
  { coins: 800, common: 1, building: 2 }, { coins: 1200, common: 2, building: 2 },
  { coins: 1800, common: 2, building: 3 }, { coins: 2600, common: 3, building: 4 },
  { coins: 3600, common: 3, building: 5 }, { coins: 4800, common: 4, building: 6 },
  { coins: 6400, common: 5, building: 8 },
] as const;
export const getDecorationUpgradeQuote = (pet: PetState, id: CommunityDecorationId, selection?: Inventory) => {
  const level = getDecorationLevel(pet, id), cost = decorationUpgradeCosts[level - 1];
  const common: Inventory = {};
  let reason = pet.timePause ? '时间冻结中，恢复后可升级' : !canSpendCompanionTime(pet) ? '等伙伴回家并空闲后再升级' : !level ? '请先制作这件装饰' : !cost ? '已达到最高等级' : '';
  if (cost) {
    if (selection === undefined) {
      let remaining = cost.common;
      for (const item of adventureTreasureIds) {
        const count = Math.min(remaining, pet.inventory[item] ?? 0);
        if (count) common[item] = count;
        remaining -= count;
      }
    } else for (const [item, count] of Object.entries(selection)) {
      if (!adventureTreasureIds.includes(item as typeof adventureTreasureIds[number]) || !Number.isSafeInteger(count) || count < 0 || count > cost.common) reason ||= '请重新选择通用探索物品';
      else if (count) common[item] = count;
    }
  }
  const items: Inventory = cost ? { ...common, community_wood: cost.building, community_stone: cost.building, ...(level >= 5 ? { [decorationEffects[id].treasure]: 1 } : {}) } : {};
  const missing = Object.fromEntries(Object.entries(items).flatMap(([item, count]) => count > (pet.inventory[item] ?? 0) ? [[item, count - (pet.inventory[item] ?? 0)]] : []));
  if (cost && Object.values(common).reduce((sum, n) => sum + n, 0) !== cost.common) reason ||= `需要选择通用探索物品 ${cost.common} 件`;
  if (Object.keys(missing).length) reason ||= '升级材料不足';
  if (cost && pet.coins < cost.coins) reason ||= `还差 ${cost.coins - pet.coins} 金币`;
  return { level, nextLevel: Math.min(10, level + 1), coins: cost?.coins ?? 0, commonCount: cost?.common ?? 0, common, items, missing, reason, ready: !reason };
};
export const upgradeCommunityDecoration = (pet: PetState, id: CommunityDecorationId, expectedLevel: number, selection?: Inventory, now = Date.now()): PetState => {
  if (!communityDecorationIds.includes(id) || !Number.isFinite(now) || now < pet.lastUpdatedAt || getDecorationLevel(pet, id) !== expectedLevel) return pet;
  const quote = getDecorationUpgradeQuote(pet, id, selection);
  if (!quote.ready) return { ...pet, recentEvent: quote.reason };
  pet = advanceCommunityAnimals(pet, now);
  return { ...pet, coins: pet.coins - quote.coins,
    inventory: Object.entries(quote.items).reduce((stock, [item, count]) => removeInventoryItem(stock, item, count), pet.inventory),
    community: { ...pet.community, decorationLevels: { ...pet.community.decorationLevels, [id]: quote.nextLevel } },
    recentEvent: `「${communityDecorations[id].name}」升至 Lv.${quote.nextLevel}，新一轮订单、生产与旅途会使用提升后的效果。` };
};

export const buildCommunityDecoration = (pet: PetState, id: CommunityDecorationId, now = Date.now()): PetState => {
  if (pet.timePause || !communityDecorationIds.includes(id) || !canSpendCompanionTime(pet) || pet.community.decorations.includes(id)) return pet;
  const decoration = communityDecorations[id];
  if (Object.entries(decoration.items).some(([item, count]) => (pet.inventory[item] ?? 0) < count)) return { ...pet, recentEvent: '装饰材料还未备齐，珍宝也可以保留收藏或换钱。' };
  if (!Number.isFinite(now) || now < pet.lastUpdatedAt) return pet;
  pet = advanceCommunityAnimals(pet, now);
  return { ...pet, inventory: Object.entries(decoration.items).reduce((stock, [item, count]) => removeInventoryItem(stock, item, count), pet.inventory),
    community: { ...pet.community, decorations: [...pet.community.decorations, id], decorationLevels: { ...pet.community.decorationLevels, [id]: 1 } }, recentEvent: `「${decoration.name}」建好了！永久效果已生效，可在农场「旅途与日常」继续升级。` };
};
