import { recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import type { Inventory, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getCommunityDay, acceptCommunityTask, cancelCommunityTask, claimCommunityTask, recordCommunityTaskEvent } from './communityCommissions';
import type { CommunityCrop, CommunityRoute } from './communityTypes';
import { communityCrops, getCropUnlockReason } from './foodCatalog';
import { spendToolUse } from './toolDurability';
export { communityCrops } from './foodCatalog';

export const communityConfig = { herbHours: 6, carrotHours: 4, herbYield: 4, carrotYield: 3, commissionCoins: 40, orderCoins: 80, orderHearts: 5 } as const;
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
export const discoverCommunityFinds = (pet: PetState, now: number, _purpose?: CommunityRoute): { pet: PetState; items: Inventory } => {
  const c = pet.community, day = getEffectiveDailyDateKey(pet, now);
  const seed = day > c.seedForageDay;
  const forage = c.tasks.some(task => task.template === 'forage' && !task.found && now >= task.acceptedAt);
  let next = { ...pet, community: { ...c, irrigationFound: true, herbDiscovered: true, seedForageDay: seed ? day : c.seedForageDay } };
  next = recordCommunityTaskEvent(next, 'search', now);
  if (forage) next = recordCommunityTaskEvent(next, 'forage', now);
  return { pet: next, items: { ...(seed ? { creek_herb_seed: 2 } : {}), ...(forage ? { creek_herb: 1 } : {}) } };
};
const setPlotCrop = (pet: PetState, plotId: number, crop?: CommunityCrop): PetState => ({ ...pet, community: { ...pet.community, plots: pet.community.plots.map(plot => plot.id === plotId ? { ...plot, crop } : plot) } });
export const plantCommunityCrop = (pet: PetState, plotId: number, id: keyof typeof communityCrops, now = Date.now()): PetState => {
  const c = pet.community, definition = communityCrops[id];
  const plot = c.plots.find(plot => plot.id === plotId);
  if (!definition || !plot || !Number.isFinite(now) || pet.timePause || !canSpendCompanionTime(pet) || !c.gardenBuilt || plot.crop || getCropUnlockReason(pet, id) || (pet.inventory[definition.seed] ?? 0) < 1) return pet;
  const plantedAt = Math.max(now, pet.lastUpdatedAt);
  return { ...setPlotCrop(pet, plotId, { id, plantedAt, readyAt: plantedAt + definition.hours * 3600000 }), inventory: removeInventoryItem(pet.inventory, definition.seed), recentEvent: `第 ${plotId} 块菜地种下了一份期待。成熟后会一直等你，不会因离线枯萎。` };
};
export const careCommunityCrop = (pet: PetState, plotId: number, plantedAt: number, action: 'water' | 'fertilize', now = Date.now()): PetState => {
  const crop = pet.community.plots.find(plot => plot.id === plotId)?.crop;
  if (!Number.isFinite(now) || pet.timePause || !canSpendCompanionTime(pet) || !crop || crop.plantedAt !== plantedAt || Math.max(now, pet.lastUpdatedAt) >= crop.readyAt) return pet;
  if (action === 'water') {
    if (crop.watered) return pet;
    const use = spendToolUse(pet, 'field_watering_can');
    if (!use) return pet;
    const readyAt = Math.max(now, pet.lastUpdatedAt, crop.readyAt - communityCrops[crop.id].hours * 3600000 * .2);
    return { ...setPlotCrop(use.pet, plotId, { ...crop, watered: true, readyAt: Math.min(crop.readyAt, readyAt) }), recentEvent: `第 ${plotId} 块菜地浇水完成，本轮已缩短生长时间。浇水壶耐久 −1${use.broken ? '，这只壶已用尽' : ''}。` };
  }
  if (action !== 'fertilize' || crop.fertilized || !(pet.inventory.nutrient_compost ?? 0)) return pet;
  return { ...setPlotCrop(pet, plotId, { ...crop, fertilized: true }), inventory: removeInventoryItem(pet.inventory, 'nutrient_compost'), recentEvent: `第 ${plotId} 块菜地施入营养堆肥 ×1，本轮收获 +1 份。` };
};
export const getCommunityCropYield = (pet: PetState, plotId: number, sickle = false) => {
  const crop = pet.community.plots.find(plot => plot.id === plotId)?.crop;
  return crop ? communityCrops[crop.id].yield + Number(Boolean(crop.fertilized)) + Number(sickle) : 0;
};
export const harvestCommunityCrop = (pet: PetState, plotId: number, plantedAt: number, now = Date.now(), sickle = false): PetState => {
  if (!Number.isFinite(now) || pet.timePause) return pet;
  const c = pet.community, crop = c.plots.find(plot => plot.id === plotId)?.crop;
  if (!canSpendCompanionTime(pet) || !crop || crop.plantedAt !== plantedAt || now < crop.readyAt) return pet;
  if (sickle && !(pet.inventory.harvest_sickle ?? 0)) return pet;
  const definition = communityCrops[crop.id], quantity = getCommunityCropYield(pet, plotId, sickle), items: Inventory = { [definition.product]: quantity };
  if (!fits(pet, items)) return fail(pet, '仓库放不下这次收获，作物会留在菜地等你。');
  const use = sickle ? spendToolUse(pet, 'harvest_sickle') : undefined;
  if (sickle && !use) return pet;
  pet = use?.pet ?? pet;
  pet = setPlotCrop(pet, plotId);
  return { ...pet, inventory: add(pet, items), community: { ...pet.community, discoveredCrops: [...new Set([...c.discoveredCrops, crop.id])] }, recentEvent: `第 ${plotId} 块菜地收获${definition.name} ${quantity} 份。${sickle ? `精收镰刀耐久 −1${use?.broken ? '，这把镰刀已用尽' : ''}。` : ''}${crop.id === 'wheat' ? `可免费磨出面粉 ${quantity * 2} 份；本轮种子成本 24 金币。` : '仓库、加工台与厨房共用这些食材。'}` };
};
export const deliverCommunityOrder = (pet: PetState): PetState => {
  if (!canSpendCompanionTime(pet) || !pet.community.gardenBuilt || pet.community.firstOrderDelivered || (pet.inventory.dish_herb_porridge ?? 0) < 1) return pet;
  const { orderCoins, orderHearts } = communityConfig;
  return recordEarnedHearts(recordEarnedCoins({ ...pet, inventory: removeInventoryItem(pet.inventory, 'dish_herb_porridge'), coins: pet.coins + orderCoins, hearts: pet.hearts + orderHearts,
    community: { ...pet.community, firstOrderDelivered: true }, recentEvent: '把第一碗香草暖粥送给了修渠的邻居。收到 80 金币、5 小心心，体力上限永久 +3。' }, orderCoins), orderHearts);
};
