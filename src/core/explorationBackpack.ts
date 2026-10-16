import { removeInventoryItem } from './items';
import type { Inventory, PetState } from './petTypes';
import { regionalTreasures, type RegionalTreasureId } from './regionalTreasures';
import { explorationBackpackCapacities, normalizeBackpackLevel } from './explorationTravelData';
import { regionIds } from './expeditionData';

export const getExplorationBagCapacity = (pet: Pick<PetState, 'adventure'>) => explorationBackpackCapacities[normalizeBackpackLevel(pet.adventure.backpackLevel)];
interface BackpackUpgrade { coins: number; items: Inventory; gems?: readonly RegionalTreasureId[]; requiresAllRegions?: boolean }
const upgrades: readonly BackpackUpgrade[] = [
  { coins: 600, items: { community_wood: 8, community_stone: 4 }, gems: ['creek_aquamarine'] },
  { coins: 1800, items: { community_wood: 16, community_stone: 10 }, gems: ['hill_sunstone'] },
  { coins: 4200, items: { community_wood: 24, community_stone: 16 }, gems: ['forest_emerald', 'tidal_pearl'] },
  { coins: 8000, requiresAllRegions: true, items: {
    community_wood: 32, community_stone: 24,
    creek_aquamarine: 1, hill_sunstone: 1, forest_emerald: 1, tidal_pearl: 1, star_sapphire: 1,
    valley_mushroom: 8, hill_honey: 8, forest_berry: 8, coast_kelp: 8, observatory_part: 8,
    pine_resin: 8, sea_glass: 8,
  } },
];
export const getBackpackUpgradeQuote = (pet: PetState, gem?: RegionalTreasureId) => {
  const level = normalizeBackpackLevel(pet.adventure.backpackLevel), q = upgrades[level];
  const gems = q?.gems ?? [], chosen = gems.length ? gem ?? gems[0] : undefined;
  const validGem = chosen !== undefined && gems.includes(chosen);
  const region = chosen && regionalTreasures[chosen]?.region;
  const requiredRegions = q?.requiresAllRegions ? regionIds : region ? [region] : [];
  const unlocked = requiredRegions.length > 0 && requiredRegions.every(id => pet.community.expedition.regions[id].surveyed || id === 'valley' && pet.adventure.valleyCompleted.includes('valley_camp'));
  const items: Inventory = { ...q?.items };
  if (validGem) items[chosen] = (items[chosen] ?? 0) + 1;
  const reason = !q ? '背包已升至最大容量' : pet.timePause ? '时间冻结中' : pet.adventure.active || pet.adventure.pending || pet.community.expedition.active || pet.community.expedition.pending ? '先结束行程并收好回执' : gems.length && !validGem ? '请选择对应地区珍宝' : !unlocked ? q.requiresAllRegions ? '先完成五个地区故事' : '先完成对应地区故事' : pet.coins < q.coins || Object.entries(items).some(([id, quantity]) => (pet.inventory[id] ?? 0) < quantity) ? '金币、建材、地区特产或珍宝不足' : '';
  return { level, capacity: getExplorationBagCapacity(pet), nextCapacity: explorationBackpackCapacities[Math.min(explorationBackpackCapacities.length - 1, level + 1)], coins: q?.coins, items, gems, gem: chosen, reason };
};
export const upgradeExplorationBackpack = (pet: PetState, expectedLevel: number, gem?: RegionalTreasureId): PetState => {
  const q = getBackpackUpgradeQuote(pet, gem);
  if (q.reason || q.level !== expectedLevel || q.coins === undefined) return pet;
  const inventory = Object.entries(q.items).reduce((stock, [id, quantity]) => removeInventoryItem(stock, id, quantity), pet.inventory);
  return { ...pet, coins: pet.coins - q.coins, inventory, adventure: { ...pet.adventure, backpackLevel: q.level + 1 }, recentEvent: `旅行背包已永久扩容至 ${q.nextCapacity} 份，两种探险共用。` };
};
