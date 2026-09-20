import { recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { addSkillXp, practiceSkillXp } from './partnerSchedule';
import { clampPetEnergy, clampPetHunger, updatePetSatiety } from './petStats';
import type { Inventory, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getCommunityDay, acceptCommunityTask, cancelCommunityTask, claimCommunityTask, recordCommunityTaskEvent } from './communityCommissions';
import { discoverCommunityFacility } from './communityFacilities';
import type { CommunityRoute } from './communityTypes';

export const communityConfig = { buildCoins: 160, wood: 3, stone: 2, repairEnergy: 4, repairHunger: 4, herbHours: 6, carrotHours: 4, herbYield: 4, carrotYield: 3, seedCost: 2, commissionCoins: 40, orderCoins: 80, orderHearts: 5 } as const;
export const communityCrops = {
  herb: { name: '溪谷香草', seed: 'creek_herb_seed', product: 'creek_herb', hours: 6, yield: 4, glyph: '🌿' },
  carrot: { name: '胡萝卜', seed: 'carrot_seed', product: 'carrot', hours: 4, yield: 3, glyph: '🥕' },
  berry: { name: '雾松林莓', seed: 'forest_berry_seed', product: 'forest_berry', hours: 8, yield: 4, glyph: '🫐' },
} as const;
const fail = (pet: PetState, recentEvent: string): PetState => ({ ...pet, recentEvent });
const fits = (pet: PetState, items: Inventory) => Object.entries(items).every(([id, n]) => (pet.inventory[id] ?? 0) + n <= inventoryItemLimit);
const add = (pet: PetState, items: Inventory) => Object.entries(items).reduce((stock, [id, n]) => addInventoryItem(stock, id, n), pet.inventory);
export { getCommunityDay };
export const getCommunityCommissionId = (pet: PetState, now = Date.now()) => `search:${getCommunityDay(pet, now)}`;
export const acceptCommunityCommission = acceptCommunityTask;
export const cancelCommunityCommission = cancelCommunityTask;
export const claimCommunityCommission = claimCommunityTask;

// Called only after a valid exploration node has paid its costs. The finding is
// permanent, while the actual seed still obeys the travel bag and return rules.
export const discoverCommunityFinds = (pet: PetState, now: number, purpose?: CommunityRoute): { pet: PetState; items: Inventory } => {
  pet = discoverCommunityFacility(pet, purpose);
  const c = pet.community, day = getEffectiveDailyDateKey(pet, now);
  const seed = day > c.seedForageDay;
  const forage = c.tasks.some(task => task.template === 'forage' && !task.found && now >= task.acceptedAt);
  let next = { ...pet, community: { ...c, irrigationFound: true, herbDiscovered: true, seedForageDay: seed ? day : c.seedForageDay } };
  next = recordCommunityTaskEvent(next, 'search', now);
  if (forage) next = recordCommunityTaskEvent(next, 'forage', now);
  return { pet: next, items: { ...(seed ? { creek_herb_seed: 1 } : {}), ...(forage ? { creek_herb: 1 } : {}) } };
};
export const repairCommunityGarden = (pet: PetState, expectedStep: number, now = Date.now()): PetState => {
  const c = pet.community, config = communityConfig;
  if (!canSpendCompanionTime(pet) || !c.irrigationFound || c.gardenBuilt || c.repairStep !== expectedStep || expectedStep >= 2) return pet;
  if (pet.hunger < config.repairHunger || pet.energy < config.repairEnergy) return fail(pet, '修复需要 4 饱食、4 体力，请先休整。');
  return updatePetSatiety({ ...pet, hunger: clampPetHunger(pet, pet.hunger - config.repairHunger), energy: clampPetEnergy(pet, pet.energy - config.repairEnergy), lastInteractionAt: now,
    community: { ...c, repairStep: c.repairStep + 1 }, partnerSchedule: { ...pet.partnerSchedule, skills: { ...pet.partnerSchedule.skills, garden: addSkillXp(pet.partnerSchedule.skills.garden, practiceSkillXp) } },
    recentEvent: expectedStep === 0 ? '一起清理了菜地的杂草，园艺练习已记入技能。接下来疏通水渠。' : '水渠已经疏通，装好找到的阀芯、备齐建材就能开放菜地。' });
};
export const buildCommunityGarden = (pet: PetState): PetState => {
  const c = pet.community, config = communityConfig;
  if (!canSpendCompanionTime(pet) || c.gardenBuilt || !c.irrigationFound || c.repairStep < 2) return pet;
  if (pet.coins < config.buildCoins || (pet.inventory.community_wood ?? 0) < config.wood || (pet.inventory.community_stone ?? 0) < config.stone) return fail(pet, '开放菜地需要 160 金币、木料 3、石料 2。');
  return { ...pet, coins: pet.coins - config.buildCoins, inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', config.wood), 'community_stone', config.stone),
    community: { ...c, gardenBuilt: true }, recentEvent: '社区菜地开放了！体力上限永久 +4，新增容量可通过休息恢复。' };
};
export const plantCommunityCrop = (pet: PetState, id: keyof typeof communityCrops, now = Date.now()): PetState => {
  const c = pet.community, definition = communityCrops[id];
  if (!definition || !canSpendCompanionTime(pet) || !c.gardenBuilt || c.crop || (pet.inventory[definition.seed] ?? 0) < 1) return pet;
  const plantedAt = Math.max(now, pet.lastUpdatedAt);
  return { ...pet, inventory: removeInventoryItem(pet.inventory, definition.seed), community: { ...c, crop: { id, plantedAt, readyAt: plantedAt + definition.hours * 3600000 } }, recentEvent: '种下了一份期待。成熟后会一直等你，不会因离线枯萎。' };
};
export const harvestCommunityCrop = (pet: PetState, plantedAt: number, now = Date.now()): PetState => {
  const c = pet.community, crop = c.crop;
  if (!canSpendCompanionTime(pet) || !crop || crop.plantedAt !== plantedAt || now < crop.readyAt) return pet;
  const definition = communityCrops[crop.id], items: Inventory = { [definition.product]: definition.yield };
  if (!fits(pet, items)) return fail(pet, '仓库放不下这次收获，作物会留在菜地等你。');
  return { ...pet, inventory: add(pet, items), community: { ...c, crop: undefined }, recentEvent: `收获${definition.name} ${definition.yield} 份。${crop.id === 'carrot' ? '仓库与厨房共用这些食材。' : '可用 2 份留种 1 份，其余做料理或经营。'}` };
};
export const saveCommunitySeed = (pet: PetState): PetState => {
  if (!canSpendCompanionTime(pet) || !pet.community.herbDiscovered || (pet.inventory.creek_herb ?? 0) < communityConfig.seedCost || !fits(pet, { creek_herb_seed: 1 })) return pet;
  return { ...pet, inventory: addInventoryItem(removeInventoryItem(pet.inventory, 'creek_herb', communityConfig.seedCost), 'creek_herb_seed', 1), recentEvent: '用 2 份香草留得 1 份种子，可以继续种植。' };
};
export const saveForestBerrySeed = (pet: PetState): PetState => {
  if (!canSpendCompanionTime(pet) || (pet.inventory.forest_berry ?? 0) < 2 || !fits(pet, { forest_berry_seed: 1 })) return pet;
  return { ...pet, inventory: addInventoryItem(removeInventoryItem(pet.inventory, 'forest_berry', 2), 'forest_berry_seed', 1), recentEvent: '用两份林莓留下了种子。也可以到林地定向寻找，品种不会永久丢失。' };
};
export const deliverCommunityOrder = (pet: PetState): PetState => {
  if (!canSpendCompanionTime(pet) || !pet.community.gardenBuilt || pet.community.firstOrderDelivered || (pet.inventory.dish_herb_porridge ?? 0) < 1) return pet;
  const { orderCoins, orderHearts } = communityConfig;
  return recordEarnedHearts(recordEarnedCoins({ ...pet, inventory: removeInventoryItem(pet.inventory, 'dish_herb_porridge'), coins: pet.coins + orderCoins, hearts: pet.hearts + orderHearts,
    community: { ...pet.community, firstOrderDelivered: true }, recentEvent: '把第一碗香草暖粥送给了修渠的邻居。收到 80 金币、5 小心心，体力上限永久 +3。' }, orderCoins), orderHearts);
};
