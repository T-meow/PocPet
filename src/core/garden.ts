import { t } from '../i18n';
import { getAchievementEffects, incrementAchievementGardenHarvest, incrementAchievementGardenPlant, incrementAchievementGardenWater, recordEarnedCoins } from './achievements';
import { getBoostCardEffects, normalizeBoostCardState, spendBoostCardGardenExtraDrop } from './boostCards';
import { getClassicTrophyEffects } from './classicTrophies';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryCount, isBuiltinItemId, removeInventoryItem } from './items';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import { grantPracticeSkillXp } from './partnerSchedule';
import { clampCoins, clampCount } from './petStats';
import { getSeasonForDate, type Season } from './season';
import type { BoostCardState, BuiltinItemId, GardenCareActionId, GardenCarePreview, GardenDrop, GardenFertilizerId, GardenSlot, GardenSlotState, GardenState, GardenToolId, GardenTools, GardenTreeId, ItemId, PetState, WeatherType } from './petTypes';
import { hashString, isNumber } from './utils';

export const gardenSchemaVersion = 4;
export const gardenSlotCount = 5;
export const goldenAppleTreeLimit = 3;
export const maxGardenToolLevel = 3;
export const dailyGardenSlotHarvestLimit = 999;
export const dailyGardenHarvestLimit = 999;
export const gardenTreeIds: readonly GardenTreeId[] = ['fruit_tree', 'care_tree', 'gift_tree', 'money_tree', 'golden_apple_tree'];
export const gardenFertilizerIds: readonly GardenFertilizerId[] = ['normal', 'heart'];
export const gardenToolIds: readonly GardenToolId[] = ['watering_can', 'shovel', 'fertilizer_box'];
export const gardenSlotStates: readonly GardenSlotState[] = ['empty', 'growing', 'ready', 'withered'];
export const gardenSlotUnlockCosts = [100, 1000, 5000, 10000, 30000] as const;
export const gardenWaterCost = 0;
export const gardenNormalFertilizerCost = 300;
export const gardenHeartFertilizerCost = 900;
export const gardenNutrientCost = 300;
export const gardenClearBaseCost = 80;

export const gardenTreeSaplingItemIds: Record<GardenTreeId, BuiltinItemId> = {
  fruit_tree: 'fruit_tree_sapling',
  care_tree: 'care_tree_sapling',
  gift_tree: 'gift_tree_sapling',
  money_tree: 'money_tree_sapling',
  golden_apple_tree: 'golden_apple_tree_sapling',
};

export const gardenFertilizerItemIds: Record<GardenFertilizerId, BuiltinItemId> = {
  normal: 'normal_fertilizer',
  heart: 'heart_fertilizer',
};

export const gardenNutrientItemId: BuiltinItemId = 'harvest_nutrient';

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
export const gardenMinimumCareRemainingMs = 10 * 1000;
export const gardenCareReductionLimitPercent = 60;
export const gardenWaterReductionMaxMs = 6 * hourMs;

type DropPoolEntry = { itemId: ItemId; weight: number; rare?: boolean };

export interface GardenTreeDefinition {
  id: GardenTreeId;
  price: number;
  growDurationMs: number;
  harvestCooldownMs: number;
  maxHarvests: number;
  dropPool: readonly DropPoolEntry[];
}

export const gardenTreeDefinitions: Record<GardenTreeId, GardenTreeDefinition> = {
  fruit_tree: { id: 'fruit_tree', price: 30, growDurationMs: 8 * hourMs, harvestCooldownMs: 8 * hourMs, maxHarvests: 8, dropPool: [{ itemId: 'orange', weight: 24 }, { itemId: 'apple', weight: 22 }, { itemId: 'banana', weight: 20 }, { itemId: 'watermelon', weight: 14 }, { itemId: 'bento', weight: 8 }, { itemId: 'strawberry_milk', weight: 6, rare: true }, { itemId: 'nutri_meal', weight: 4, rare: true }, { itemId: 'strawberry_cake', weight: 2, rare: true }] },
  care_tree: { id: 'care_tree', price: 30, growDurationMs: 10 * hourMs, harvestCooldownMs: 10 * hourMs, maxHarvests: 7, dropPool: [{ itemId: 'wet_wipes', weight: 26 }, { itemId: 'vitamin_tablet', weight: 20 }, { itemId: 'shampoo', weight: 14 }, { itemId: 'energy_drink', weight: 14 }, { itemId: 'blanket', weight: 10 }, { itemId: 'medicine', weight: 6, rare: true }, { itemId: 'apple', weight: 6 }, { itemId: 'watermelon', weight: 4, rare: true }] },
  gift_tree: { id: 'gift_tree', price: 30, growDurationMs: 12 * hourMs, harvestCooldownMs: 12 * hourMs, maxHarvests: 6, dropPool: [{ itemId: 'small_bouquet', weight: 24 }, { itemId: 'shiny_sticker', weight: 22 }, { itemId: 'ribbon_bell', weight: 18 }, { itemId: 'toy_ball', weight: 14 }, { itemId: 'picture_book', weight: 8, rare: true }, { itemId: 'soft_cloud_doll', weight: 5, rare: true }, { itemId: 'strawberry_cake', weight: 5, rare: true }, { itemId: 'strawberry_milk', weight: 4, rare: true }] },
  money_tree: { id: 'money_tree', price: 3000, growDurationMs: 3 * dayMs, harvestCooldownMs: 36 * hourMs, maxHarvests: 8, dropPool: [] },
  golden_apple_tree: { id: 'golden_apple_tree', price: 8888, growDurationMs: 4 * dayMs, harvestCooldownMs: 48 * hourMs, maxHarvests: 9, dropPool: [] },
};

export const gardenSaplingRecycleMaxPrice = 30;
export const getGardenSaplingRecycleCoins = (treeId: GardenTreeId) => {
  const price = gardenTreeDefinitions[treeId]?.price ?? 0;
  return price > 0 && price <= gardenSaplingRecycleMaxPrice ? Math.floor(price / 2) : 0;
};

export const gardenTreeMaxHarvests: Record<GardenTreeId, number> = Object.fromEntries(gardenTreeIds.map((treeId) => [treeId, gardenTreeDefinitions[treeId].maxHarvests])) as Record<GardenTreeId, number>;
export const gardenTreeGrowDurationMs: Record<GardenTreeId, number> = Object.fromEntries(gardenTreeIds.map((treeId) => [treeId, gardenTreeDefinitions[treeId].growDurationMs])) as Record<GardenTreeId, number>;
export const gardenTreeHarvestCooldownMs: Record<GardenTreeId, number> = Object.fromEntries(gardenTreeIds.map((treeId) => [treeId, gardenTreeDefinitions[treeId].harvestCooldownMs])) as Record<GardenTreeId, number>;

const gardenToolUpgradeCosts: Record<GardenToolId, readonly number[]> = { watering_can: [0, 900, 2200], shovel: [0, 800, 2000], fertilizer_box: [0, 1200, 3000] };
const gardenTreeIdSet = new Set<GardenTreeId>(gardenTreeIds);
const gardenFertilizerIdSet = new Set<GardenFertilizerId>(gardenFertilizerIds);
const gardenSlotStateSet = new Set<GardenSlotState>(gardenSlotStates);
const gardenToolIdSet = new Set<GardenToolId>(gardenToolIds);
const clampTimestamp = (value: unknown, now: number) => isNumber(value) ? Math.max(0, Math.min(Math.floor(value), now + 365 * 24 * 60 * 60 * 1000)) : 0;
const clampToolLevel = (value: unknown) => isNumber(value) ? Math.min(maxGardenToolLevel, Math.max(1, Math.floor(value))) : 1;
const isGardenTreeId = (value: unknown): value is GardenTreeId => typeof value === 'string' && gardenTreeIdSet.has(value as GardenTreeId);
const isGardenFertilizerId = (value: unknown): value is GardenFertilizerId => typeof value === 'string' && gardenFertilizerIdSet.has(value as GardenFertilizerId);
const isGardenSlotState = (value: unknown): value is GardenSlotState => typeof value === 'string' && gardenSlotStateSet.has(value as GardenSlotState);
export const isGardenToolId = (value: unknown): value is GardenToolId => typeof value === 'string' && gardenToolIdSet.has(value as GardenToolId);
const defaultGardenTools = (): GardenTools => ({ wateringCanLevel: 1, shovelLevel: 1, fertilizerBoxLevel: 1 });
const defaultGardenSlot = (slotIndex: number, now = Date.now(), dateKey = getDailyResetDateKey(now)): GardenSlot => ({ slotIndex, unlocked: false, plantedAt: 0, lastWateredAt: 0, lastFertilizedAt: 0, lastBoostedAt: 0, lastWateredDateKey: '', lastFertilizedDateKey: '', lastBoostedDateKey: '', naturalReadyAt: 0, careReductionMs: 0, nextReadyAt: 0, harvestsUsed: 0, maxHarvests: 0, hasNutrientBoost: false, dailyHarvestDateKey: dateKey, dailyHarvestCount: 0, pendingDrops: [], state: 'empty' });
export const defaultGardenState = (now = Date.now(), dateKey = getDailyResetDateKey(now)): GardenState => ({ schemaVersion: gardenSchemaVersion, activeSlotIndex: 0, slots: Array.from({ length: gardenSlotCount }, (_, slotIndex) => defaultGardenSlot(slotIndex, now, dateKey)), dailyCareDateKey: dateKey, dailyWaterCount: 0, dailyFertilizeCount: 0, dailyHarvestDateKey: dateKey, dailyHarvestCount: 0, tools: defaultGardenTools(), lifetimeHarvestCount: 0 });

const mergeDrops = (drops: readonly GardenDrop[]): GardenDrop[] => {
  const amounts = new Map<ItemId, number>();
  let coins = 0;
  drops.forEach((drop) => {
    if (drop.amount <= 0) return;
    if (drop.kind === 'coins') { coins += Math.floor(drop.amount); return; }
    if (!drop.itemId) return;
    amounts.set(drop.itemId, Math.min(99, (amounts.get(drop.itemId) ?? 0) + drop.amount));
  });
  const itemDrops = Array.from(amounts.entries()).map(([itemId, amount]) => ({ itemId, amount }));
  return coins > 0 ? [{ kind: 'coins' as const, amount: Math.min(999999, coins) }, ...itemDrops] : itemDrops;
};

const normalizeGardenDrops = (value: unknown): GardenDrop[] => {
  if (!Array.isArray(value)) return [];
  return mergeDrops(value.slice(0, 4).flatMap((entry): GardenDrop[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const raw = entry as Record<string, unknown>;
    const amount = isNumber(raw.amount) ? Math.min(999999, clampCount(raw.amount)) : 0;
    if (raw.kind === 'coins') return amount > 0 ? [{ kind: 'coins' as const, amount }] : [];
    const itemId = typeof raw.itemId === 'string' && isBuiltinItemId(raw.itemId) ? raw.itemId : undefined;
    return itemId && amount > 0 ? [{ itemId, amount: Math.min(99, amount) }] : [];
  }));
};

const normalizeGardenTools = (value: unknown): GardenTools => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultGardenTools();
  const raw = value as Record<string, unknown>;
  return { wateringCanLevel: clampToolLevel(raw.wateringCanLevel), shovelLevel: clampToolLevel(raw.shovelLevel), fertilizerBoxLevel: clampToolLevel(raw.fertilizerBoxLevel) };
};

const normalizeGardenSlot = (value: unknown, slotIndex: number, previousUnlocked: boolean, now: number, resetDateKey: string, migrateGoldenAppleTree: boolean, migrateCareTiming: boolean): GardenSlot => {
  const fallback = defaultGardenSlot(slotIndex, now, resetDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const treeId = isGardenTreeId(raw.treeId) ? raw.treeId : undefined;
  const state = isGardenSlotState(raw.state) ? raw.state : treeId ? 'growing' : 'empty';
  const unlocked = previousUnlocked && (Boolean(raw.unlocked) || Boolean(treeId) || state !== 'empty');
  const pendingDrops = normalizeGardenDrops(raw.pendingDrops);
  const plantedAt = clampTimestamp(raw.plantedAt, now);
  const nextReadyAt = clampTimestamp(raw.nextReadyAt, now);
  const storedMaxHarvests = treeId ? Math.min(99, Math.max(1, isNumber(raw.maxHarvests) ? Math.floor(raw.maxHarvests) : gardenTreeMaxHarvests[treeId])) : 0;
  const shouldExtendGoldenAppleTree = migrateGoldenAppleTree && treeId === 'golden_apple_tree' && state !== 'withered';
  const maxHarvests = shouldExtendGoldenAppleTree ? Math.min(99, storedMaxHarvests + 2) : storedMaxHarvests;
  const harvestsUsed = treeId ? Math.min(maxHarvests, clampCount(isNumber(raw.harvestsUsed) ? raw.harvestsUsed : 0)) : 0;
  const isDailyHarvestCurrent = normalizeLegacyDailyDateKey(raw.dailyHarvestDateKey, now) === resetDateKey;
  const dailyHarvestDateKey = resetDateKey;
  if (!unlocked || !treeId || state === 'empty') return { ...fallback, unlocked, dailyHarvestDateKey };
  const normalizedState: GardenSlotState = state === 'ready' && pendingDrops.length === 0 ? 'growing' : harvestsUsed >= maxHarvests && state !== 'ready' ? 'withered' : state;
  const resolvedNextReadyAt = normalizedState === 'withered' ? 0 : nextReadyAt > 0 ? nextReadyAt : plantedAt + gardenTreeGrowDurationMs[treeId];
  const storedCareReductionMs = isNumber(raw.careReductionMs) ? Math.max(0, Math.floor(raw.careReductionMs)) : 0;
  const storedNaturalReadyAt = clampTimestamp(raw.naturalReadyAt, now);
  const naturalReadyAt = normalizedState === 'withered'
    ? 0
    : migrateCareTiming
      ? resolvedNextReadyAt
      : Math.max(resolvedNextReadyAt, storedNaturalReadyAt > 0 ? storedNaturalReadyAt : resolvedNextReadyAt + storedCareReductionMs);
  const roundDurationMs = Math.max(0, naturalReadyAt - plantedAt);
  const careReductionLimitMs = Math.floor(roundDurationMs * (gardenCareReductionLimitPercent / 100));
  const careReductionMs = migrateCareTiming ? 0 : Math.min(careReductionLimitMs, Math.max(0, naturalReadyAt - resolvedNextReadyAt));
  const normalizedNextReadyAt = naturalReadyAt - careReductionMs;
  const lastWateredAt = clampTimestamp(raw.lastWateredAt, now);
  const lastFertilizedAt = clampTimestamp(raw.lastFertilizedAt, now);
  const lastBoostedAt = clampTimestamp(raw.lastBoostedAt, now);
  const getLegacyActionDateKey = (value: unknown) => {
    if (!isNumber(value) || value <= 0) return '';
    const dateKey = getDailyResetDateKey(value);
    return dateKey > resetDateKey ? resetDateKey : dateKey;
  };
  const lastWateredDateKey = normalizeLegacyDailyDateKey(raw.lastWateredDateKey, now)
    || getLegacyActionDateKey(raw.lastWateredAt);
  const lastFertilizedDateKey = normalizeLegacyDailyDateKey(raw.lastFertilizedDateKey, now)
    || getLegacyActionDateKey(raw.lastFertilizedAt);
  const lastBoostedDateKey = normalizeLegacyDailyDateKey(raw.lastBoostedDateKey, now)
    || getLegacyActionDateKey(raw.lastBoostedAt);
  return { slotIndex, unlocked, treeId, plantedAt, lastWateredAt, lastFertilizedAt, lastBoostedAt, lastWateredDateKey, lastFertilizedDateKey, lastBoostedDateKey, naturalReadyAt, careReductionMs, nextReadyAt: normalizedNextReadyAt, harvestsUsed, maxHarvests, fertilizerType: isGardenFertilizerId(raw.fertilizerType) ? raw.fertilizerType : undefined, hasNutrientBoost: Boolean(raw.hasNutrientBoost), dailyHarvestDateKey, dailyHarvestCount: isDailyHarvestCurrent ? Math.min(999, clampCount(isNumber(raw.dailyHarvestCount) ? raw.dailyHarvestCount : 0)) : 0, pendingDrops: normalizedState === 'ready' ? pendingDrops : [], state: normalizedState };
};

export const normalizeGardenState = (value: unknown, now = Date.now(), effectiveDateKey = getDailyResetDateKey(now)): GardenState => {
  const fallback = defaultGardenState(now, effectiveDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const storedSchemaVersion = isNumber(raw.schemaVersion) ? Math.floor(raw.schemaVersion) : 0;
  const migrateGoldenAppleTree = storedSchemaVersion < 2;
  const migrateCareTiming = storedSchemaVersion < 3;
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
  let previousUnlocked = true;
  const slots = Array.from({ length: gardenSlotCount }, (_, slotIndex) => {
    const slot = normalizeGardenSlot(rawSlots[slotIndex], slotIndex, previousUnlocked, now, effectiveDateKey, migrateGoldenAppleTree, migrateCareTiming);
    previousUnlocked = slot.unlocked;
    return slot;
  });
  const resetDateKey = effectiveDateKey;
  const isDailyCareCurrent = normalizeLegacyDailyDateKey(raw.dailyCareDateKey, now) === resetDateKey;
  const isDailyHarvestCurrent = normalizeLegacyDailyDateKey(raw.dailyHarvestDateKey, now) === resetDateKey;
  return { schemaVersion: gardenSchemaVersion, activeSlotIndex: isNumber(raw.activeSlotIndex) ? Math.min(gardenSlotCount - 1, Math.max(0, Math.floor(raw.activeSlotIndex))) : fallback.activeSlotIndex, slots, dailyCareDateKey: resetDateKey, dailyWaterCount: isDailyCareCurrent ? Math.min(999, clampCount(isNumber(raw.dailyWaterCount) ? raw.dailyWaterCount : 0)) : 0, dailyFertilizeCount: isDailyCareCurrent ? Math.min(999, clampCount(isNumber(raw.dailyFertilizeCount) ? raw.dailyFertilizeCount : 0)) : 0, dailyHarvestDateKey: resetDateKey, dailyHarvestCount: isDailyHarvestCurrent ? Math.min(999, clampCount(isNumber(raw.dailyHarvestCount) ? raw.dailyHarvestCount : 0)) : 0, tools: normalizeGardenTools(raw.tools), lifetimeHarvestCount: Math.min(999999, clampCount(isNumber(raw.lifetimeHarvestCount) ? raw.lifetimeHarvestCount : 0)) };
};

const getToolLevel = (tools: GardenTools, toolId: GardenToolId) => toolId === 'watering_can' ? tools.wateringCanLevel : toolId === 'shovel' ? tools.shovelLevel : tools.fertilizerBoxLevel;
const setToolLevel = (tools: GardenTools, toolId: GardenToolId, level: number): GardenTools => toolId === 'watering_can' ? { ...tools, wateringCanLevel: level } : toolId === 'shovel' ? { ...tools, shovelLevel: level } : { ...tools, fertilizerBoxLevel: level };
export const getGardenToolUpgradeCost = (tools: GardenTools, toolId: GardenToolId) => { const currentLevel = getToolLevel(tools, toolId); return currentLevel >= maxGardenToolLevel ? 0 : gardenToolUpgradeCosts[toolId][currentLevel] ?? 0; };
export const getGardenClearCost = (tools: GardenTools) => tools.shovelLevel >= 3 ? Math.ceil(gardenClearBaseCost * 0.5) : tools.shovelLevel >= 2 ? Math.ceil(gardenClearBaseCost * 0.75) : gardenClearBaseCost;
export const getGardenWaterCost = () => gardenWaterCost;
export const getGardenWaterReductionPercent = (tools: GardenTools, environmentBonusPercent = 0) =>
  (tools.wateringCanLevel >= 3 ? 10 : tools.wateringCanLevel >= 2 ? 8 : 5) + environmentBonusPercent;
const getNormalFertilizerChance = (tools: GardenTools) => tools.fertilizerBoxLevel >= 3 ? 25 : tools.fertilizerBoxLevel >= 2 ? 20 : 15;
const getHeartRareWeightBonusPercent = (tools: GardenTools) => tools.fertilizerBoxLevel >= 3 ? 40 : tools.fertilizerBoxLevel >= 2 ? 30 : 25;

export interface GardenEnvironmentEffects {
  weather: WeatherType;
  season: Season;
  growTimeMultiplier: number;
  waterReductionBonusPercent: number;
  extraDropChancePercent: number;
  maxHarvestBonus: number;
}

const weatherGardenEffects: Record<WeatherType, Omit<GardenEnvironmentEffects, 'weather' | 'season'>> = {
  sunny: { growTimeMultiplier: 0.95, waterReductionBonusPercent: 0, extraDropChancePercent: 0, maxHarvestBonus: 0 },
  cloudy: { growTimeMultiplier: 1, waterReductionBonusPercent: 0, extraDropChancePercent: 5, maxHarvestBonus: 0 },
  rainy: { growTimeMultiplier: 1, waterReductionBonusPercent: 5, extraDropChancePercent: 0, maxHarvestBonus: 0 },
  breezy: { growTimeMultiplier: 0.97, waterReductionBonusPercent: 0, extraDropChancePercent: 0, maxHarvestBonus: 0 },
};

const seasonGardenEffects: Record<Season, Omit<GardenEnvironmentEffects, 'weather' | 'season'>> = {
  spring: { growTimeMultiplier: 0.9, waterReductionBonusPercent: 0, extraDropChancePercent: 0, maxHarvestBonus: 0 },
  summer: { growTimeMultiplier: 1, waterReductionBonusPercent: 3, extraDropChancePercent: 0, maxHarvestBonus: 0 },
  autumn: { growTimeMultiplier: 1, waterReductionBonusPercent: 0, extraDropChancePercent: 10, maxHarvestBonus: 0 },
  winter: { growTimeMultiplier: 1, waterReductionBonusPercent: 0, extraDropChancePercent: 0, maxHarvestBonus: 1 },
};

export const getGardenEnvironmentEffects = (pet: PetState, now = Date.now()): GardenEnvironmentEffects => {
  const weather = pet.weather;
  const season = getSeasonForDate(now);
  const weatherEffects = weatherGardenEffects[weather];
  const seasonEffects = seasonGardenEffects[season];
  return {
    weather,
    season,
    growTimeMultiplier: weatherEffects.growTimeMultiplier * seasonEffects.growTimeMultiplier,
    waterReductionBonusPercent: weatherEffects.waterReductionBonusPercent + seasonEffects.waterReductionBonusPercent,
    extraDropChancePercent: weatherEffects.extraDropChancePercent + seasonEffects.extraDropChancePercent,
    maxHarvestBonus: weatherEffects.maxHarvestBonus + seasonEffects.maxHarvestBonus,
  };
};

const applyGrowMultiplier = (pet: PetState, durationMs: number, now: number) => {
  const environmentMultiplier = getGardenEnvironmentEffects(pet, now).growTimeMultiplier;
  const boostMultiplier = getBoostCardEffects(pet, now).gardenGrowTimeMultiplier;
  const masteryMultiplier = getPartnerScheduleCrossSystemEffects(pet).gardenTimeMultiplier;
  return Math.max(60 * 1000, Math.round(durationMs * environmentMultiplier * boostMultiplier * masteryMultiplier));
};
const getGrowDuration = (pet: PetState, treeId: GardenTreeId, now: number) => applyGrowMultiplier(pet, gardenTreeDefinitions[treeId].growDurationMs, now);
const getHarvestCooldown = (pet: PetState, treeId: GardenTreeId, now: number) => applyGrowMultiplier(pet, gardenTreeDefinitions[treeId].harvestCooldownMs, now);
const fertilizerReductionConfigs: Record<GardenFertilizerId, { percent: number; maxMs: number }> = { normal: { percent: 20, maxMs: 10 * hourMs }, heart: { percent: 35, maxMs: 18 * hourMs } };

export const getGardenCarePreview = (pet: PetState, slot: GardenSlot, actionId: GardenCareActionId, now = Date.now()): GardenCarePreview => {
  const naturalReadyAt = slot.naturalReadyAt > slot.plantedAt ? slot.naturalReadyAt : slot.nextReadyAt + Math.max(0, slot.careReductionMs);
  const roundDurationMs = Math.max(0, naturalReadyAt - slot.plantedAt);
  const percent = actionId === 'water'
    ? getGardenWaterReductionPercent(pet.garden.tools, getGardenEnvironmentEffects(pet, now).waterReductionBonusPercent)
    : fertilizerReductionConfigs[actionId].percent;
  const actionLimitMs = actionId === 'water' ? gardenWaterReductionMaxMs : fertilizerReductionConfigs[actionId].maxMs;
  const nominalReductionMs = Math.min(actionLimitMs, Math.floor(roundDurationMs * (percent / 100)));
  const careReductionMs = Math.max(0, slot.careReductionMs, naturalReadyAt - slot.nextReadyAt);
  const careReductionLimitMs = Math.floor(roundDurationMs * (gardenCareReductionLimitPercent / 100));
  const careCapacityMs = Math.max(0, careReductionLimitMs - careReductionMs);
  const remainingMs = Math.max(0, slot.nextReadyAt - now);
  const reducibleRemainingMs = Math.max(0, remainingMs - gardenMinimumCareRemainingMs);
  const actualReductionMs = Math.min(nominalReductionMs, careCapacityMs, reducibleRemainingMs);
  const blockedReason = actualReductionMs > 0
    ? undefined
    : reducibleRemainingMs <= 0
      ? 'minimum_remaining' as const
      : 'round_limit' as const;
  return { percent, nominalReductionMs, actualReductionMs, remainingAfterMs: remainingMs - actualReductionMs, blockedReason };
};

export const formatGardenCareDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(1, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return t('ui.time.hoursMinutes', { hours, minutes });
  if (minutes > 0) return t('ui.time.minutes', { minutes });
  return t('ui.time.seconds', { seconds: totalSeconds });
};

const getGardenCareBlockedEventKey = (preview: GardenCarePreview) => preview.blockedReason === 'minimum_remaining'
  ? 'pet.garden.careMinimumRemaining'
  : 'pet.garden.careReductionLimitReached';

const getStrongestFertilizerType = (current: GardenFertilizerId | undefined, next: GardenFertilizerId): GardenFertilizerId =>
  current === 'heart' || next === 'heart' ? 'heart' : 'normal';

const pickWeightedDrop = (pool: readonly DropPoolEntry[], seed: string, rareWeightBonusPercent: number) => {
  const weightedPool = pool.map((entry) => ({ ...entry, weight: entry.rare ? entry.weight * (1 + rareWeightBonusPercent / 100) : entry.weight }));
  const total = weightedPool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  let target = hashString(seed) % Math.max(1, Math.round(total * 100));
  for (const entry of weightedPool) { target -= Math.max(0, Math.round(entry.weight * 100)); if (target < 0) return entry.itemId; }
  return weightedPool[weightedPool.length - 1]?.itemId ?? 'orange';
};
const getExtraDropItem = (treeId: GardenTreeId, seed: string) => {
  if (treeId === 'golden_apple_tree') return hashString(seed + ':golden-extra') % 100 < 25 ? 'golden_apple' : 'apple';
  const commonPool = gardenTreeDefinitions[treeId].dropPool.filter((entry) => !entry.rare);
  return pickWeightedDrop(commonPool.length > 0 ? commonPool : gardenTreeDefinitions[treeId].dropPool, seed, 0);
};
const getExtraDropChance = (slot: GardenSlot, garden: GardenState) => {
  if (slot.hasNutrientBoost) return 100;
  if (slot.treeId === 'money_tree' || slot.treeId === 'golden_apple_tree') return 0;
  if (slot.fertilizerType === 'normal') return getNormalFertilizerChance(garden.tools);
  if (slot.fertilizerType === 'heart') return 20;
  return 0;
};
const pickInRange = (seed: string, min: number, max: number) => min + (hashString(seed) % (max - min + 1));
const pickMoneyTreeCoins = (seed: string) => { const roll = hashString(seed + ':money-roll') % 100; if (roll < 70) return pickInRange(seed + ':money-common', 600, 1200); if (roll < 95) return pickInRange(seed + ':money-good', 1200, 2200); return pickInRange(seed + ':money-jackpot', 4000, 6000); };
const pickGoldenAppleTreeAppleSlot = (seed: string): ItemId => hashString(seed) % 100 < 25 ? 'golden_apple' : 'apple';
const pickGoldenAppleTreeDrops = (slot: GardenSlot, seed: string): GardenDrop[] => {
  const harvestNumber = slot.harvestsUsed + 1;
  const appleSlots = harvestNumber >= slot.maxHarvests - 1 ? 2 : 1;
  const drops: GardenDrop[] = [{ itemId: 'golden_apple', amount: 1 }];
  for (let index = 0; index < appleSlots; index += 1) {
    drops.push({ itemId: pickGoldenAppleTreeAppleSlot(seed + ':apple-slot:' + index), amount: 1 });
  }
  return drops;
};
const resolveExtraDrops = (pet: PetState, slot: GardenSlot, seed: string, now: number) => {
  const environmentChance = getGardenEnvironmentEffects(pet, now).extraDropChancePercent;
  const achievementChance = getAchievementEffects(pet).gardenExtraDropChancePercent;
  const trophyChance = getClassicTrophyEffects(pet).gardenExtraDropChancePercent;
  const totalChance = Math.max(0, getExtraDropChance(slot, pet.garden) + environmentChance + achievementChance + trophyChance);
  const remainderChance = totalChance % 100;
  let extraDropCount = Math.floor(totalChance / 100) + (remainderChance > 0 && (hashString(seed + ':extra') % 100) < remainderChance ? 1 : 0);
  let boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  const effects = getBoostCardEffects({ ...pet, boostCards }, now);
  if (extraDropCount === 0 && effects.gardenExtraDropChancePercent > 0 && (hashString(seed + ':boost') % 100) < effects.gardenExtraDropChancePercent) {
    const spend = spendBoostCardGardenExtraDrop({ ...pet, boostCards }, now);
    boostCards = spend.boostCards;
    extraDropCount = spend.didSpend ? 1 : 0;
  }
  return { extraDropCount, boostCards };
};
const generateGardenDrops = (pet: PetState, slot: GardenSlot, now: number): { drops: GardenDrop[]; boostCards: BoostCardState } => {
  if (!slot.treeId) return { drops: [], boostCards: normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now)) };
  const seed = [slot.slotIndex, slot.treeId, slot.plantedAt, slot.nextReadyAt, slot.harvestsUsed].join(':');
  const extra = resolveExtraDrops(pet, slot, seed, now);
  if (slot.treeId === 'money_tree') { const baseCoins = pickMoneyTreeCoins(seed); const coins = Math.floor(baseCoins * (1 + extra.extraDropCount * 0.25)); return { drops: [{ kind: 'coins', amount: coins }], boostCards: extra.boostCards }; }
  if (slot.treeId === 'golden_apple_tree') { const drops: GardenDrop[] = pickGoldenAppleTreeDrops(slot, seed); for (let index = 0; index < extra.extraDropCount; index += 1) drops.push({ itemId: getExtraDropItem(slot.treeId, seed + ':common:' + index), amount: 1 }); return { drops: mergeDrops(drops).slice(0, 4), boostCards: extra.boostCards }; }
  const rareWeightBonusPercent = slot.fertilizerType === 'heart' ? getHeartRareWeightBonusPercent(pet.garden.tools) : 0;
  const drops: GardenDrop[] = [{ itemId: pickWeightedDrop(gardenTreeDefinitions[slot.treeId].dropPool, seed, rareWeightBonusPercent), amount: 1 }];
  for (let index = 0; index < extra.extraDropCount; index += 1) drops.push({ itemId: getExtraDropItem(slot.treeId, seed + ':common:' + index), amount: 1 });
  return { drops: mergeDrops(drops).slice(0, 4), boostCards: extra.boostCards };
};
const resetRoundBoosts = (slot: GardenSlot): GardenSlot => ({ ...slot, fertilizerType: undefined, hasNutrientBoost: false, careReductionMs: 0 });
export const advanceGarden = (pet: PetState, now = Date.now()): PetState => {
  const effectiveDateKey = getEffectiveDailyDateKey(pet, now);
  let boostCards = normalizeBoostCardState(pet.boostCards, now, effectiveDateKey);
  const garden = normalizeGardenState(pet.garden, now, effectiveDateKey);
  const slots = garden.slots.map((slot) => { if (slot.state !== 'growing' || !slot.treeId || slot.nextReadyAt > now) return slot; const generated = generateGardenDrops({ ...pet, garden, boostCards }, slot, now); boostCards = generated.boostCards; return { ...slot, state: 'ready' as const, pendingDrops: generated.drops }; });
  return { ...pet, boostCards, garden: { ...garden, slots } };
};
const updateGardenSlot = (garden: GardenState, slotIndex: number, updater: (slot: GardenSlot) => GardenSlot): GardenState => ({ ...garden, slots: garden.slots.map((slot) => slot.slotIndex === slotIndex ? updater(slot) : slot) });
const failGardenAction = (pet: PetState, messageKey: string, params: Record<string, string | number> = {}): PetState => ({ ...pet, recentEvent: t(messageKey, params) });
const getItemName = (itemId: BuiltinItemId) => t('pet.shop.items.' + itemId + '.name');
export const selectGardenSlot = (pet: PetState, slotIndex: number, now = Date.now()): PetState => { const current = advanceGarden(pet, now); if (slotIndex < 0 || slotIndex >= gardenSlotCount) return current; return { ...current, garden: { ...current.garden, activeSlotIndex: slotIndex }, lastInteractionAt: now }; };
export const unlockGardenSlot = (pet: PetState, slotIndex: number, now = Date.now()): PetState => { const current = advanceGarden(pet, now); const slot = current.garden.slots[slotIndex]; if (!slot) return failGardenAction(current, 'pet.garden.invalidSlot'); if (slot.unlocked) return failGardenAction(current, 'pet.garden.slotAlreadyUnlocked'); if (slotIndex > 0 && !current.garden.slots[slotIndex - 1]?.unlocked) return failGardenAction(current, 'pet.garden.unlockInOrder'); const cost = gardenSlotUnlockCosts[slotIndex] ?? 0; if (current.coins < cost) return failGardenAction(current, 'pet.garden.notEnoughCoins', { coins: cost }); return { ...current, coins: clampCoins(current.coins - cost), garden: updateGardenSlot({ ...current.garden, activeSlotIndex: slotIndex }, slotIndex, (target) => ({ ...target, unlocked: true })), recentEvent: t('pet.garden.unlockSlotSuccess', { slot: slotIndex + 1, coins: cost }), lastInteractionAt: now }; };
export const plantTree = (pet: PetState, slotIndex: number, treeId: GardenTreeId, now = Date.now()): PetState => {
  const current = advanceGarden(pet, now);
  const slot = current.garden.slots[slotIndex];
  const definition = gardenTreeDefinitions[treeId];
  const saplingItemId = gardenTreeSaplingItemIds[treeId];
  if (!slot || !definition || !saplingItemId) return failGardenAction(current, 'pet.garden.invalidSlot');
  if (!slot.unlocked) return failGardenAction(current, 'pet.garden.slotLocked');
  if (slot.state !== 'empty') return failGardenAction(current, 'pet.garden.slotNotEmpty');
  if (treeId === 'golden_apple_tree' && current.garden.slots.filter((candidate) => candidate.treeId === 'golden_apple_tree' && candidate.state !== 'empty').length >= goldenAppleTreeLimit) {
    return failGardenAction(current, 'pet.garden.goldenAppleTreeLimit', { limit: goldenAppleTreeLimit });
  }
  if (getInventoryCount(current.inventory, saplingItemId) <= 0) return failGardenAction(current, 'pet.garden.missingGardenItem', { item: getItemName(saplingItemId) });
  const environment = getGardenEnvironmentEffects(current, now);
  const growDurationMs = getGrowDuration(current, treeId, now);
  const naturalReadyAt = now + growDurationMs;
  return incrementAchievementGardenPlant({
    ...current,
    inventory: removeInventoryItem(current.inventory, saplingItemId),
    garden: updateGardenSlot(current.garden, slotIndex, (target) => ({ ...resetRoundBoosts(target), treeId, plantedAt: now, naturalReadyAt, careReductionMs: 0, nextReadyAt: naturalReadyAt, harvestsUsed: 0, maxHarvests: definition.maxHarvests + environment.maxHarvestBonus, pendingDrops: [], state: 'growing' })),
    recentEvent: t('pet.garden.plantSuccess', { tree: t('ui.garden.trees.' + treeId + '.name'), item: getItemName(saplingItemId) }),
    lastInteractionAt: now,
  });
};
export const recycleGardenSapling = (pet: PetState, treeId: GardenTreeId, now = Date.now()): PetState => {
  const current = advanceGarden(pet, now);
  const saplingItemId = gardenTreeSaplingItemIds[treeId];
  const coins = getGardenSaplingRecycleCoins(treeId);
  if (!saplingItemId || coins <= 0 || getInventoryCount(current.inventory, saplingItemId) <= 0) return current;
  return {
    ...current,
    coins: clampCoins(current.coins + coins),
    inventory: removeInventoryItem(current.inventory, saplingItemId),
    recentEvent: t('pet.garden.recycleSaplingSuccess', { item: getItemName(saplingItemId), coins }),
    lastInteractionAt: now,
  };
};
export const waterTree = (pet: PetState, slotIndex: number, now = Date.now()): PetState => {
  const current = advanceGarden(pet, now);
  const slot = current.garden.slots[slotIndex];
  const dateKey = getEffectiveDailyDateKey(current, now);
  if (!slot || slot.state !== 'growing' || !slot.treeId) return failGardenAction(current, 'pet.garden.cannotWater');
  if (slot.lastWateredDateKey === dateKey) return failGardenAction(current, 'pet.garden.wateredToday');
  const preview = getGardenCarePreview(current, slot, 'water', now);
  if (preview.actualReductionMs <= 0) return failGardenAction(current, getGardenCareBlockedEventKey(preview));
  return grantPracticeSkillXp(incrementAchievementGardenWater({
    ...current,
    garden: updateGardenSlot({ ...current.garden, dailyCareDateKey: dateKey, dailyWaterCount: current.garden.dailyWaterCount + 1 }, slotIndex, (target) => ({ ...target, lastWateredAt: now, lastWateredDateKey: dateKey, careReductionMs: target.careReductionMs + preview.actualReductionMs, nextReadyAt: target.nextReadyAt - preview.actualReductionMs })),
    recentEvent: t('pet.garden.waterSuccess', { time: formatGardenCareDuration(preview.actualReductionMs) }),
    lastInteractionAt: now,
  }), 'garden');
};
export const fertilizeTree = (pet: PetState, slotIndex: number, fertilizerId: GardenFertilizerId, now = Date.now()): PetState => {
  const current = advanceGarden(pet, now);
  const slot = current.garden.slots[slotIndex];
  const dateKey = getEffectiveDailyDateKey(current, now);
  if (!slot || slot.state !== 'growing' || !slot.treeId) return failGardenAction(current, 'pet.garden.cannotFertilize');
  if (slot.lastFertilizedDateKey === dateKey) return failGardenAction(current, 'pet.garden.fertilizedToday');
  const itemId = gardenFertilizerItemIds[fertilizerId];
  if (getInventoryCount(current.inventory, itemId) <= 0) return failGardenAction(current, 'pet.garden.missingGardenItem', { item: getItemName(itemId) });
  const preview = getGardenCarePreview(current, slot, fertilizerId, now);
  if (preview.actualReductionMs <= 0) return failGardenAction(current, getGardenCareBlockedEventKey(preview));
  return grantPracticeSkillXp({
    ...current,
    inventory: removeInventoryItem(current.inventory, itemId),
    garden: updateGardenSlot({ ...current.garden, dailyCareDateKey: dateKey, dailyFertilizeCount: current.garden.dailyFertilizeCount + 1 }, slotIndex, (target) => ({ ...target, fertilizerType: getStrongestFertilizerType(target.fertilizerType, fertilizerId), lastFertilizedAt: now, lastFertilizedDateKey: dateKey, careReductionMs: target.careReductionMs + preview.actualReductionMs, nextReadyAt: target.nextReadyAt - preview.actualReductionMs })),
    recentEvent: t('pet.garden.fertilizeSuccess', { item: getItemName(itemId), time: formatGardenCareDuration(preview.actualReductionMs) }),
    lastInteractionAt: now,
  }, 'garden');
};
export const useGardenNutrient = (pet: PetState, slotIndex: number, now = Date.now()): PetState => { const current = advanceGarden(pet, now); const slot = current.garden.slots[slotIndex]; const dateKey = getEffectiveDailyDateKey(current, now); if (!slot || slot.state !== 'growing' || !slot.treeId) return failGardenAction(current, 'pet.garden.cannotBoost'); if (slot.lastBoostedDateKey === dateKey) return failGardenAction(current, 'pet.garden.boostedToday'); if (getInventoryCount(current.inventory, gardenNutrientItemId) <= 0) return failGardenAction(current, 'pet.garden.missingGardenItem', { item: getItemName(gardenNutrientItemId) }); return { ...current, inventory: removeInventoryItem(current.inventory, gardenNutrientItemId), garden: updateGardenSlot(current.garden, slotIndex, (target) => ({ ...target, hasNutrientBoost: true, lastBoostedAt: now, lastBoostedDateKey: dateKey })), recentEvent: t('pet.garden.nutrientSuccess', { item: getItemName(gardenNutrientItemId) }), lastInteractionAt: now }; };
const addDropsToInventory = (inventory: PetState['inventory'], drops: readonly GardenDrop[]) => drops.reduce((next, drop) => drop.itemId ? addInventoryItem(next, drop.itemId, drop.amount) : next, inventory);
const getDropItemCount = (drops: readonly GardenDrop[]) => drops.reduce((sum, drop) => sum + (drop.itemId ? drop.amount : 0), 0);
const getDropCoinAmount = (drops: readonly GardenDrop[]) => drops.reduce((sum, drop) => sum + (drop.kind === 'coins' ? drop.amount : 0), 0);
const getHarvestEventKey = (itemCount: number, coinAmount: number, isWithered: boolean) => { if (coinAmount > 0 && itemCount > 0) return isWithered ? 'pet.garden.harvestMixedWithered' : 'pet.garden.harvestMixedSuccess'; if (coinAmount > 0) return isWithered ? 'pet.garden.harvestCoinsWithered' : 'pet.garden.harvestCoinsSuccess'; return isWithered ? 'pet.garden.harvestWithered' : 'pet.garden.harvestSuccess'; };
export const harvestTree = (pet: PetState, slotIndex: number, now = Date.now()): PetState => {
  const current = advanceGarden(pet, now);
  const slot = current.garden.slots[slotIndex];
  const dateKey = getEffectiveDailyDateKey(current, now);
  if (!slot || slot.state !== 'ready' || !slot.treeId || slot.pendingDrops.length === 0) return failGardenAction(current, 'pet.garden.cannotHarvest');
  const harvestsUsed = slot.harvestsUsed + 1;
  const isWithered = harvestsUsed >= slot.maxHarvests;
  const nextRoundDurationMs = isWithered ? 0 : getHarvestCooldown(current, slot.treeId, now);
  const nextNaturalReadyAt = isWithered ? 0 : now + nextRoundDurationMs;
  const nextSlot: GardenSlot = isWithered
    ? { ...resetRoundBoosts(slot), naturalReadyAt: 0, nextReadyAt: 0, harvestsUsed, pendingDrops: [], state: 'withered', dailyHarvestDateKey: dateKey, dailyHarvestCount: slot.dailyHarvestCount + 1 }
    : { ...resetRoundBoosts(slot), plantedAt: now, naturalReadyAt: nextNaturalReadyAt, careReductionMs: 0, nextReadyAt: nextNaturalReadyAt, harvestsUsed, pendingDrops: [], state: 'growing', dailyHarvestDateKey: dateKey, dailyHarvestCount: slot.dailyHarvestCount + 1 };
  const itemCount = getDropItemCount(slot.pendingDrops);
  const coinAmount = getDropCoinAmount(slot.pendingDrops);
  const eventKey = getHarvestEventKey(itemCount, coinAmount, isWithered);
  const nextPet = incrementAchievementGardenHarvest({
    ...current,
    coins: clampCoins(current.coins + coinAmount),
    inventory: addDropsToInventory(current.inventory, slot.pendingDrops),
    garden: updateGardenSlot({ ...current.garden, dailyHarvestDateKey: dateKey, dailyHarvestCount: current.garden.dailyHarvestCount + 1, lifetimeHarvestCount: current.garden.lifetimeHarvestCount + 1 }, slotIndex, () => nextSlot),
    recentEvent: t(eventKey, { count: itemCount, coins: coinAmount }),
    lastInteractionAt: now,
  }, slot.treeId);
  return grantPracticeSkillXp(coinAmount > 0 ? recordEarnedCoins(nextPet, coinAmount) : nextPet, 'garden');
};
export const clearWitheredTree = (pet: PetState, slotIndex: number, now = Date.now()): PetState => { const current = advanceGarden(pet, now); const slot = current.garden.slots[slotIndex]; if (!slot || !slot.treeId || slot.state === 'empty') return failGardenAction(current, 'pet.garden.cannotClear'); const cost = getGardenClearCost(current.garden.tools); if (current.coins < cost) return failGardenAction(current, 'pet.garden.notEnoughCoins', { coins: cost }); const eventKey = slot.state === 'withered' ? 'pet.garden.clearSuccess' : 'pet.garden.removeSuccess'; const dateKey = getEffectiveDailyDateKey(current, now); return { ...current, coins: clampCoins(current.coins - cost), garden: updateGardenSlot(current.garden, slotIndex, () => ({ ...defaultGardenSlot(slotIndex, now, dateKey), unlocked: true })), recentEvent: t(eventKey, { coins: cost }), lastInteractionAt: now }; };
export const upgradeGardenTool = (pet: PetState, toolId: GardenToolId, now = Date.now()): PetState => { const current = advanceGarden(pet, now); const currentLevel = getToolLevel(current.garden.tools, toolId); if (currentLevel >= maxGardenToolLevel) return failGardenAction(current, 'pet.garden.toolMaxLevel'); const cost = getGardenToolUpgradeCost(current.garden.tools, toolId); if (current.coins < cost) return failGardenAction(current, 'pet.garden.notEnoughCoins', { coins: cost }); const nextLevel = currentLevel + 1; return { ...current, coins: clampCoins(current.coins - cost), garden: { ...current.garden, tools: setToolLevel(current.garden.tools, toolId, nextLevel) }, recentEvent: t('pet.garden.toolUpgradeSuccess', { tool: t('ui.garden.tools.' + toolId + '.name'), level: nextLevel, coins: cost }), lastInteractionAt: now }; };
const getGardenGrowthProgress = (slot: GardenSlot, now: number) => {
  const naturalReadyAt = slot.naturalReadyAt > slot.plantedAt ? slot.naturalReadyAt : slot.nextReadyAt + Math.max(0, slot.careReductionMs);
  const roundDurationMs = naturalReadyAt - slot.plantedAt;
  if (slot.state !== 'growing' || !slot.treeId || slot.plantedAt <= 0 || roundDurationMs <= 0) return 0;
  return Math.max(0, Math.min(1, (now - slot.plantedAt + Math.max(0, slot.careReductionMs)) / roundDurationMs));
};
export const getGardenStage = (slot: GardenSlot, now = Date.now()) => { if (slot.harvestsUsed > 0 || slot.state === 'ready' || slot.state === 'withered') return 5; const progress = getGardenGrowthProgress(slot, now); if (progress < 0.2) return 1; if (progress < 0.4) return 2; if (progress < 0.65) return 3; if (progress < 0.9) return 4; return 5; };
export const getGardenReminder = (pet: PetState, now = Date.now()) => { const current = advanceGarden(pet, now); if (current.garden.slots.some((slot) => slot.state === 'ready')) return 'ready' as const; if (current.garden.slots.some((slot) => slot.state === 'withered')) return 'withered' as const; return undefined; };
export const getGardenView = (pet: PetState, now = Date.now()) => { const current = advanceGarden(pet, now); const activeSlot = current.garden.slots[current.garden.activeSlotIndex] ?? current.garden.slots[0]; const readyCount = current.garden.slots.filter((slot) => slot.state === 'ready').length; const witheredCount = current.garden.slots.filter((slot) => slot.state === 'withered').length; return { pet: current, garden: current.garden, activeSlot, readyCount, witheredCount, reminder: readyCount > 0 ? 'ready' as const : witheredCount > 0 ? 'withered' as const : undefined, slotViews: current.garden.slots.map((slot) => ({ slot, stage: getGardenStage(slot, now), progressPercent: slot.state === 'ready' || slot.state === 'withered' ? 100 : getGardenGrowthProgress(slot, now) * 100, remainingMs: slot.state === 'growing' ? Math.max(0, slot.nextReadyAt - now) : 0 })) }; };
