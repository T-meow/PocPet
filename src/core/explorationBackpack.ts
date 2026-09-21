import { removeInventoryItem } from './items';
import type { PetState } from './petTypes';
import type { RegionalTreasureId } from './regionalTreasures';
import { explorationBackpackCapacities, normalizeBackpackLevel } from './explorationTravelData';

export const getExplorationBagCapacity = (pet: Pick<PetState, 'adventure'>) => explorationBackpackCapacities[normalizeBackpackLevel(pet.adventure.backpackLevel)];
const upgrades = [
  { coins: 600, wood: 8, stone: 4, gems: ['creek_aquamarine'] },
  { coins: 1800, wood: 16, stone: 10, gems: ['hill_sunstone'] },
  { coins: 4200, wood: 24, stone: 16, gems: ['forest_emerald', 'tidal_pearl'] },
] as const;
export const getBackpackUpgradeQuote = (pet: PetState, gem?: RegionalTreasureId) => {
  const level = normalizeBackpackLevel(pet.adventure.backpackLevel), q = upgrades[level];
  const chosen = gem ?? q?.gems[0], region = chosen === 'creek_aquamarine' ? 'valley' : chosen === 'hill_sunstone' ? 'hills' : chosen === 'tidal_pearl' ? 'coast' : 'forest';
  const unlocked = pet.community.expedition.regions[region].surveyed || region === 'valley' && pet.adventure.valleyCompleted.includes('valley_camp');
  const reason = !q ? '背包已升至最大容量' : pet.timePause ? '时间冻结中' : pet.adventure.active || pet.adventure.pending || pet.community.expedition.active || pet.community.expedition.pending ? '先结束行程并收好回执' : !q.gems.some(id => id === chosen) ? '请选择对应地区珍宝' : !unlocked ? '先完成对应地区故事' : pet.coins < q.coins || (pet.inventory.community_wood ?? 0) < q.wood || (pet.inventory.community_stone ?? 0) < q.stone || (pet.inventory[chosen!] ?? 0) < 1 ? '金币、建材或地区珍宝不足' : '';
  return { level, capacity: getExplorationBagCapacity(pet), nextCapacity: explorationBackpackCapacities[Math.min(3, level + 1)], ...q, gem: chosen, reason };
};
export const upgradeExplorationBackpack = (pet: PetState, expectedLevel: number, gem?: RegionalTreasureId): PetState => {
  const q = getBackpackUpgradeQuote(pet, gem);
  if (q.reason || q.level !== expectedLevel || !q.gem || q.coins === undefined) return pet;
  const inventory = removeInventoryItem(removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', q.wood), 'community_stone', q.stone), q.gem);
  return { ...pet, coins: pet.coins - q.coins, inventory, adventure: { ...pet.adventure, backpackLevel: q.level + 1 }, recentEvent: `旅行背包已永久扩容至 ${q.nextCapacity} 份，两种探险共用。` };
};
