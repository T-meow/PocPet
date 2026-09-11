import { t } from '../i18n';
import { applyBoostCardHeartBonus } from './boostCards';
import { getDailyResetDate, getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getDailyDateKeyTime, getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryItem, shopItems } from './items';
import { clampCoins, clampCount } from './petStats';
import type { AchievementCounters, AchievementId, AchievementState, CareActionKey, GardenTreeId, ItemId, PartnerScheduleCategory, PartnerScheduleRewardChoice, PartnerScheduleSize, PetState, YearlyCareActionKey, YearlyStats } from './petTypes';
import { isNumber } from './utils';
import { recipes } from './kitchenRecipes';

export type AchievementCategory = 'care' | 'daily' | 'garden' | 'shop' | 'inventory' | 'pomodoro' | 'growth' | 'date' | 'schedule' | 'hidden' | 'kitchen' | 'play';
export type AchievementRarity = 'normal' | 'rare' | 'hidden';

export interface AchievementReward {
  coins?: number;
  hearts?: number;
  items?: readonly { itemId: ItemId; amount: number }[];
  workCoinBonus?: number;
  pomodoroCoinBonus?: number;
  cleanCooldownMs?: number;
  extraHeartChancePercent?: number;
  gardenExtraDropChancePercent?: number;
  partnerScheduleExtraRewardChancePercent?: number;
  dailyStipendCoins?: number;
  dailyLoginItemBonus?: number;
  careStatBonus?: number;
  cgId?: string;
  revealsHiddenAchievements?: boolean;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  target: number;
  progress: (pet: PetState) => number;
  reward: AchievementReward;
  isComplete?: (pet: PetState) => boolean;
  hiddenUntilUnlocked?: boolean;
}

export interface AchievementEffects {
  workCoinBonus: number;
  pomodoroCoinBonus: number;
  cleanCooldownMs: number;
  extraHeartChancePercent: number;
  guaranteedExtraHearts: number;
  gardenExtraDropChancePercent: number;
  partnerScheduleExtraRewardChancePercent: number;
  dailyStipendCoins: number;
  dailyLoginItemBonus: number;
  careStatBonus: number;
  unlockedCgIds: string[];
  revealsHiddenAchievements: boolean;
}

export interface AchievementView extends AchievementDefinition {
  progressValue: number;
  unlocked: boolean;
  unlockedAt?: number;
  rewardText: string;
  claimed: boolean;
  claimable: boolean;
  effectActive: boolean;
}

export interface AchievementEvaluationResult {
  pet: PetState;
  unlocked: AchievementView[];
}

export interface AchievementClaimAllResult {
  pet: PetState;
  claimedIds: AchievementId[];
}

export interface AchievementSummary {
  total: number;
  unlocked: number;
  claimable: number;
  pendingReviewNotice: boolean;
  dailyStipendCoins: number;
  dailyStipendClaimed: boolean;
  dailyStipendClaimable: boolean;
  gardenExtraDropChancePercent: number;
}

export const baseCleanCooldownMs = 30 * 1000;
export const goodEndingCgId = 'good_ending_year_1';
export const goodEndingDailyStipendCoinsPerYear = 30;
export const goodEndingExtraHeartChancePercentPerYear = 30;

const careKeys: readonly YearlyCareActionKey[] = ['play', 'clean', 'work', 'feed', 'gift', 'touch'];
const dayMs = 24 * 60 * 60 * 1000;
const fruitIds: readonly ItemId[] = ['orange', 'apple', 'banana', 'watermelon'];
const nonWatermelonFruitIds: readonly ItemId[] = ['orange', 'apple', 'banana'];
const careKitIds: readonly ItemId[] = ['wet_wipes', 'shampoo', 'vitamin_tablet'];
const gentleCareKeys: readonly YearlyCareActionKey[] = ['feed', 'clean', 'play', 'touch'];
const workPlayKeys: readonly YearlyCareActionKey[] = ['work', 'play'];
const achievementGardenTreeIds: readonly GardenTreeId[] = ['fruit_tree', 'care_tree', 'gift_tree', 'money_tree', 'golden_apple_tree'];
const achievementPartnerScheduleCategories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
const legacyShopIds = new Set(['emergency_biscuit', 'bento', 'orange', 'apple', 'banana', 'watermelon', 'nutri_meal', 'pig_trotter', 'strawberry_cake', 'ad_milk', 'strawberry_milk', 'small_bouquet', 'shiny_sticker', 'soft_cloud_doll', 'ribbon_bell', 'toy_ball', 'picture_book', 'shampoo', 'wet_wipes', 'medicine', 'vitamin_tablet', 'blanket', 'energy_drink']);
const usableShopItems = shopItems.filter((item) => legacyShopIds.has(item.id));
const shopItemIds: readonly ItemId[] = usableShopItems.map((item) => item.id);
const shopFoodItemIds: readonly ItemId[] = usableShopItems.filter((item) => item.kind === 'food').map((item) => item.id);
const manualUnlockAchievementIds = new Set<AchievementId>(['hidden_good_ending_year_1']);
const getAchievementTitle = (id: AchievementId) => t(`pet.achievements.definitions.${id}.title`);
const getAchievementDescription = (id: AchievementId) => t(`pet.achievements.definitions.${id}.description`);


const defaultCareCounts = (): Record<YearlyCareActionKey, number> => ({
  play: 0,
  clean: 0,
  work: 0,
  feed: 0,
  gift: 0,
  touch: 0,
});

export const defaultAchievementCounters = (): AchievementCounters => ({
  careActionCounts: defaultCareCounts(),
  pomodoroFocusCount: 0,
  bestDailyPomodoroFocusCount: 0,
  itemUseCountsById: {},
  totalItemUseCount: 0,
  purchaseCount: 0,
  paidPurchaseCount: 0,
  sleepStartCount: 0,
  dailyWishClaimCount: 0,
  returnWelcomeClaimCount: 0,
  dateRewardClaimCountsByKind: {},
  heartEarnedTotal: 0,
  coinEarnedTotal: 0,
  maxCoinsHeld: 0,
  manualWakeCount: 0,
  naturalWakeCount: 0,
  gardenPlantCount: 0,
  gardenWaterCount: 0,
  gardenHarvestCountsByTreeId: {},
  partnerScheduleClaimCount: 0,
  partnerScheduleClaimCountsByCategory: {},
  partnerScheduleLongClaimCountsByCategory: {},
  partnerScheduleCategoryRewardClaimCount: 0,
  companionYearActiveDateKeysByYear: {},
});

export const getCompanionYear = (createdAt: number, now = Date.now()) => {
  const created = new Date(createdAt);
  const current = new Date(now);
  let year = current.getFullYear() - created.getFullYear() + 1;
  const anniversaryThisYear = new Date(current.getFullYear(), created.getMonth(), created.getDate()).getTime();
  if (now < anniversaryThisYear) year -= 1;
  return Math.max(1, year);
};

const getCompanionActivityYear = (createdAt: number, now = Date.now()) =>
  getCompanionYear(createdAt, getDailyResetDate(now).getTime());

export const defaultAchievementState = (now = Date.now(), createdAt = now, pendingReviewNotice = false, initialCoins = 0): AchievementState => {
  const counters = defaultAchievementCounters();
  counters.maxCoinsHeld = clampCount(initialCoins);
  counters.companionYearActiveDateKeysByYear[String(getCompanionActivityYear(createdAt, now))] = [getDailyResetDateKey(now)];
  return {
    unlockedAtById: {},
    claimedOneTimeRewardIds: [],
    dailyStipendClaimDateKey: '',
    completedGoodEndingYears: [],
    unlockedCgIds: [],
    pendingReviewNotice,
    counters,
  };
};

const normalizeStringArray = (value: unknown, max = 500) =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 96)))).slice(0, max)
    : [];

const normalizeNumberArray = (value: unknown, max = 100) =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is number => isNumber(item) && item > 0).map((item) => Math.floor(item)))).slice(0, max)
    : [];

const backfillAchievementCountersFromYearlyStats = (state: AchievementState, yearlyStats?: YearlyStats): AchievementState => {
  if (!yearlyStats) return state;
  const careActionCounts = { ...state.counters.careActionCounts };
  careKeys.forEach((key) => {
    careActionCounts[key] = Math.max(careActionCounts[key] ?? 0, yearlyStats.careActionCounts[key] ?? 0);
  });
  return {
    ...state,
    counters: {
      ...state.counters,
      careActionCounts,
      pomodoroFocusCount: Math.max(state.counters.pomodoroFocusCount, yearlyStats.pomodoroFocusCount),
      bestDailyPomodoroFocusCount: Math.max(state.counters.bestDailyPomodoroFocusCount, yearlyStats.pomodoroFocusCount),
      totalItemUseCount: Math.max(state.counters.totalItemUseCount, yearlyStats.itemUseCount),
    },
  };
};

export const normalizeAchievementState = (
  value: unknown,
  now = Date.now(),
  createdAt = now,
  yearlyStats?: YearlyStats,
  pendingReviewNotice = false,
  currentCoins = 0,
  effectiveDateKey = getDailyResetDateKey(now),
): AchievementState => {
  const effectiveNow = Math.max(now, getDailyDateKeyTime(effectiveDateKey, now));
  const fallback = backfillAchievementCountersFromYearlyStats(defaultAchievementState(effectiveNow, createdAt, pendingReviewNotice, currentCoins), yearlyStats);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const rawCounters = raw.counters && typeof raw.counters === 'object' && !Array.isArray(raw.counters)
    ? (raw.counters as Record<string, unknown>)
    : {};
  const rawCareCounts = rawCounters.careActionCounts && typeof rawCounters.careActionCounts === 'object'
    ? (rawCounters.careActionCounts as Record<string, unknown>)
    : {};
  const careActionCounts = defaultCareCounts();
  careKeys.forEach((key) => {
    careActionCounts[key] = clampCount(isNumber(rawCareCounts[key]) ? rawCareCounts[key] : 0);
  });
  const rawItemCounts = rawCounters.itemUseCountsById && typeof rawCounters.itemUseCountsById === 'object'
    ? (rawCounters.itemUseCountsById as Record<string, unknown>)
    : {};
  const itemUseCountsById: Partial<Record<string, number>> = {};
  Object.entries(rawItemCounts).forEach(([key, amount]) => {
    if (isNumber(amount) && amount > 0) itemUseCountsById[key] = clampCount(amount);
  });
  const totalItemUseCount = Object.values(itemUseCountsById).reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const rawDateRewardCounts = rawCounters.dateRewardClaimCountsByKind && typeof rawCounters.dateRewardClaimCountsByKind === 'object'
    ? (rawCounters.dateRewardClaimCountsByKind as Record<string, unknown>)
    : {};
  const dateRewardClaimCountsByKind: Partial<Record<string, number>> = {};
  Object.entries(rawDateRewardCounts).forEach(([kind, amount]) => {
    if (isNumber(amount) && amount > 0) dateRewardClaimCountsByKind[kind.slice(0, 48)] = clampCount(amount);
  });
  const rawGardenHarvestCounts = rawCounters.gardenHarvestCountsByTreeId && typeof rawCounters.gardenHarvestCountsByTreeId === 'object'
    ? (rawCounters.gardenHarvestCountsByTreeId as Record<string, unknown>)
    : {};
  const gardenHarvestCountsByTreeId: Partial<Record<GardenTreeId, number>> = {};
  achievementGardenTreeIds.forEach((treeId) => {
    const amount = rawGardenHarvestCounts[treeId];
    if (isNumber(amount) && amount > 0) gardenHarvestCountsByTreeId[treeId] = clampCount(amount);
  });
  const normalizePartnerScheduleCounts = (rawValue: unknown) => {
    const rawCounts = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? rawValue as Record<string, unknown>
      : {};
    const counts: Partial<Record<PartnerScheduleCategory, number>> = {};
    achievementPartnerScheduleCategories.forEach((category) => {
      const amount = rawCounts[category];
      if (isNumber(amount) && amount > 0) counts[category] = clampCount(amount);
    });
    return counts;
  };
  const partnerScheduleClaimCountsByCategory = normalizePartnerScheduleCounts(rawCounters.partnerScheduleClaimCountsByCategory);
  const partnerScheduleLongClaimCountsByCategory = normalizePartnerScheduleCounts(rawCounters.partnerScheduleLongClaimCountsByCategory);
  const rawYears = rawCounters.companionYearActiveDateKeysByYear && typeof rawCounters.companionYearActiveDateKeysByYear === 'object'
    ? (rawCounters.companionYearActiveDateKeysByYear as Record<string, unknown>)
    : {};
  const companionYearActiveDateKeysByYear: Record<string, string[]> = {};
  Object.entries(rawYears).forEach(([year, keys]) => {
    if (!/^\d+$/.test(year)) return;
    companionYearActiveDateKeysByYear[year] = Array.from(new Set(
      normalizeStringArray(keys, 370)
        .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
        .map((key) => normalizeLegacyDailyDateKey(key, now) || key),
    ));
  });
  const currentYear = String(getCompanionActivityYear(createdAt, effectiveNow));
  const today = effectiveDateKey;
  const currentKeys = companionYearActiveDateKeysByYear[currentYear] ?? [];
  companionYearActiveDateKeysByYear[currentYear] = currentKeys.includes(today) ? currentKeys : [...currentKeys, today].slice(-370);
  const rawUnlocked = raw.unlockedAtById && typeof raw.unlockedAtById === 'object'
    ? (raw.unlockedAtById as Record<string, unknown>)
    : {};
  const unlockedAtById: Partial<Record<AchievementId, number>> = {};
  Object.entries(rawUnlocked).forEach(([id, time]) => {
    if (isNumber(time) && time > 0) unlockedAtById[id.slice(0, 96)] = Math.floor(time);
  });
  return {
    unlockedAtById,
    claimedOneTimeRewardIds: normalizeStringArray(raw.claimedOneTimeRewardIds),
    dailyStipendClaimDateKey: normalizeLegacyDailyDateKey(raw.dailyStipendClaimDateKey, now),
    completedGoodEndingYears: normalizeNumberArray(raw.completedGoodEndingYears),
    unlockedCgIds: normalizeStringArray(raw.unlockedCgIds),
    pendingReviewNotice: Boolean(raw.pendingReviewNotice),
    counters: {
      careActionCounts,
      pomodoroFocusCount: clampCount(isNumber(rawCounters.pomodoroFocusCount) ? rawCounters.pomodoroFocusCount : 0),
      bestDailyPomodoroFocusCount: clampCount(isNumber(rawCounters.bestDailyPomodoroFocusCount) ? rawCounters.bestDailyPomodoroFocusCount : 0),
      itemUseCountsById,
      totalItemUseCount: clampCount(isNumber(rawCounters.totalItemUseCount) ? rawCounters.totalItemUseCount : totalItemUseCount),
      purchaseCount: clampCount(isNumber(rawCounters.purchaseCount) ? rawCounters.purchaseCount : 0),
      paidPurchaseCount: clampCount(isNumber(rawCounters.paidPurchaseCount) ? rawCounters.paidPurchaseCount : 0),
      sleepStartCount: clampCount(isNumber(rawCounters.sleepStartCount) ? rawCounters.sleepStartCount : 0),
      dailyWishClaimCount: clampCount(isNumber(rawCounters.dailyWishClaimCount) ? rawCounters.dailyWishClaimCount : 0),
      returnWelcomeClaimCount: clampCount(isNumber(rawCounters.returnWelcomeClaimCount) ? rawCounters.returnWelcomeClaimCount : 0),
      dateRewardClaimCountsByKind,
      heartEarnedTotal: clampCount(isNumber(rawCounters.heartEarnedTotal) ? rawCounters.heartEarnedTotal : 0),
      coinEarnedTotal: clampCount(isNumber(rawCounters.coinEarnedTotal) ? rawCounters.coinEarnedTotal : 0),
      maxCoinsHeld: Math.max(clampCount(isNumber(rawCounters.maxCoinsHeld) ? rawCounters.maxCoinsHeld : 0), clampCount(currentCoins)),
      manualWakeCount: clampCount(isNumber(rawCounters.manualWakeCount) ? rawCounters.manualWakeCount : 0),
      naturalWakeCount: clampCount(isNumber(rawCounters.naturalWakeCount) ? rawCounters.naturalWakeCount : 0),
      gardenPlantCount: clampCount(isNumber(rawCounters.gardenPlantCount) ? rawCounters.gardenPlantCount : 0),
      gardenWaterCount: clampCount(isNumber(rawCounters.gardenWaterCount) ? rawCounters.gardenWaterCount : 0),
      gardenHarvestCountsByTreeId,
      partnerScheduleClaimCount: clampCount(isNumber(rawCounters.partnerScheduleClaimCount) ? rawCounters.partnerScheduleClaimCount : 0),
      partnerScheduleClaimCountsByCategory,
      partnerScheduleLongClaimCountsByCategory,
      partnerScheduleCategoryRewardClaimCount: clampCount(isNumber(rawCounters.partnerScheduleCategoryRewardClaimCount) ? rawCounters.partnerScheduleCategoryRewardClaimCount : 0),
      companionYearActiveDateKeysByYear,
    },
  };
};

const getCareCount = (pet: PetState, key: YearlyCareActionKey) => pet.achievements.counters.careActionCounts[key] ?? 0;
const getTotalCareCount = (pet: PetState) => careKeys.reduce((sum, key) => sum + getCareCount(pet, key), 0);
const getItemUseCount = (pet: PetState, id: ItemId) => pet.achievements.counters.itemUseCountsById[id] ?? 0;
const minItemUses = (pet: PetState, ids: readonly ItemId[]) => Math.min(...ids.map((id) => getItemUseCount(pet, id)));
const usedItemKinds = (pet: PetState, ids: readonly ItemId[]) => ids.filter((id) => getItemUseCount(pet, id) > 0).length;
const minCareUses = (pet: PetState, keys: readonly YearlyCareActionKey[]) => Math.min(...keys.map((key) => getCareCount(pet, key)));
const getDateRewardCount = (pet: PetState, kind: string) => pet.achievements.counters.dateRewardClaimCountsByKind[kind] ?? 0;
const getCompanionDays = (pet: PetState, now = Date.now()) => {
  const effectiveNow = Math.max(now, getDailyDateKeyTime(getEffectiveDailyDateKey(pet, now), now));
  return Math.max(1, Math.floor(Math.max(0, effectiveNow - pet.createdAt) / dayMs) + 1);
};
const getActiveDaysTotal = (pet: PetState) => {
  const keys = new Set<string>();
  Object.values(pet.achievements.counters.companionYearActiveDateKeysByYear).forEach((items) => {
    items.forEach((key) => keys.add(key));
  });
  return keys.size;
};
const getCompanionMarkCount = (pet: PetState) => pet.achievements.counters.returnWelcomeClaimCount + Math.floor(getActiveDaysTotal(pet) / 30);
const getHarvestedGardenTreeKindCount = (pet: PetState) => achievementGardenTreeIds.filter((treeId) => (pet.achievements.counters.gardenHarvestCountsByTreeId[treeId] ?? 0) > 0).length;
const getUnlockedGardenSlotCount = (pet: PetState) => pet.garden.slots.filter((slot) => slot.unlocked).length;
const getMaxedGardenToolCount = (pet: PetState) => [pet.garden.tools.wateringCanLevel, pet.garden.tools.shovelLevel, pet.garden.tools.fertilizerBoxLevel].filter((level) => level >= 3).length;
const getPartnerScheduleCategoryCount = (pet: PetState) => achievementPartnerScheduleCategories.filter((category) => (pet.achievements.counters.partnerScheduleClaimCountsByCategory[category] ?? 0) > 0).length;
const getPartnerScheduleLongCount = (pet: PetState) => achievementPartnerScheduleCategories.reduce((sum, category) => sum + (pet.achievements.counters.partnerScheduleLongClaimCountsByCategory[category] ?? 0), 0);
const getPartnerScheduleLongCategoryCount = (pet: PetState) => achievementPartnerScheduleCategories.filter((category) => (pet.achievements.counters.partnerScheduleLongClaimCountsByCategory[category] ?? 0) > 0).length;
const getPartnerScheduleMinimumSkillLevel = (pet: PetState) => Math.min(...achievementPartnerScheduleCategories.map((category) => pet.partnerSchedule.skills[category].level));
const getPartnerScheduleMinimumMasterCompletionCount = (pet: PetState) => Math.min(...achievementPartnerScheduleCategories.map((category) => pet.partnerSchedule.skills[category].masterCompletions));
const getInventoryItemTotal = (pet: PetState) =>
  Object.values(pet.inventory).reduce((sum, amount) => sum + Math.max(0, Math.floor(amount ?? 0)), 0);

const baseAchievementDefinitionConfigs: readonly Omit<AchievementDefinition, 'title' | 'description'>[] = [
  { id: 'first_feed', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'feed'), reward: { coins: 20 } },
  { id: 'first_clean', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'clean'), reward: { coins: 20 } },
  { id: 'first_play', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'play'), reward: { coins: 20 } },
  { id: 'first_touch', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'touch'), reward: { coins: 20 } },
  { id: 'first_work', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'work'), reward: { coins: 24 } },
  { id: 'first_sleep', category: 'care', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.sleepStartCount, reward: { coins: 20 } },
  { id: 'first_gift', category: 'care', rarity: 'normal', target: 1, progress: (pet) => getCareCount(pet, 'gift'), reward: { coins: 20 } },
  { id: 'care_25', category: 'care', rarity: 'normal', target: 25, progress: getTotalCareCount, reward: { coins: 36 } },
  { id: 'care_100', category: 'care', rarity: 'normal', target: 100, progress: getTotalCareCount, reward: { coins: 90 } },
  { id: 'feed_30', category: 'care', rarity: 'normal', target: 30, progress: (pet) => getCareCount(pet, 'feed'), reward: { coins: 45 } },
  { id: 'clean_30', category: 'care', rarity: 'normal', target: 30, progress: (pet) => getCareCount(pet, 'clean'), reward: { coins: 45 } },
  { id: 'play_30', category: 'care', rarity: 'normal', target: 30, progress: (pet) => getCareCount(pet, 'play'), reward: { coins: 45 } },
  { id: 'touch_30', category: 'care', rarity: 'normal', target: 30, progress: (pet) => getCareCount(pet, 'touch'), reward: { coins: 45 } },
  { id: 'work_10', category: 'care', rarity: 'normal', target: 10, progress: (pet) => getCareCount(pet, 'work'), reward: { workCoinBonus: 1 } },
  { id: 'work_50', category: 'care', rarity: 'rare', target: 50, progress: (pet) => getCareCount(pet, 'work'), reward: { workCoinBonus: 1 } },
  { id: 'work_100', category: 'care', rarity: 'rare', target: 100, progress: (pet) => getCareCount(pet, 'work'), reward: { workCoinBonus: 1 } },
  { id: 'work_master', category: 'care', rarity: 'rare', target: 300, progress: (pet) => getCareCount(pet, 'work'), reward: { dailyStipendCoins: 1 } },
  { id: 'work_play_balance', category: 'care', rarity: 'rare', target: 50, progress: (pet) => minCareUses(pet, workPlayKeys), reward: { dailyStipendCoins: 1 } },
  { id: 'daily_wish_1', category: 'daily', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.dailyWishClaimCount, reward: { coins: 20 } },
  { id: 'daily_wish_7', category: 'daily', rarity: 'normal', target: 7, progress: (pet) => pet.achievements.counters.dailyWishClaimCount, reward: { coins: 45 } },
  { id: 'daily_wish_30', category: 'daily', rarity: 'normal', target: 30, progress: (pet) => pet.achievements.counters.dailyWishClaimCount, reward: { coins: 80 } },
  { id: 'daily_wish_100', category: 'daily', rarity: 'rare', target: 100, progress: (pet) => pet.achievements.counters.dailyWishClaimCount, reward: { dailyStipendCoins: 2 } },
  { id: 'return_welcome_1', category: 'daily', rarity: 'normal', target: 1, progress: getCompanionMarkCount, reward: { coins: 24 } },
  { id: 'daily_login_7', category: 'daily', rarity: 'normal', target: 7, progress: (pet) => getDateRewardCount(pet, 'daily_login'), reward: { coins: 45 } },
  { id: 'daily_login_30', category: 'daily', rarity: 'rare', target: 30, progress: (pet) => getDateRewardCount(pet, 'daily_login'), reward: { coins: 300, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'companion_100', category: 'daily', rarity: 'rare', target: 60, progress: getActiveDaysTotal, isComplete: (pet: PetState) => getCompanionDays(pet) >= 100 && getActiveDaysTotal(pet) >= 60, reward: { dailyStipendCoins: 3, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'garden_first_plant', category: 'garden', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.gardenPlantCount, reward: { coins: 50 } },
  { id: 'garden_first_harvest', category: 'garden', rarity: 'normal', target: 1, progress: (pet) => pet.garden.lifetimeHarvestCount, reward: { coins: 80 } },
  { id: 'garden_water_20', category: 'garden', rarity: 'normal', target: 20, progress: (pet) => pet.achievements.counters.gardenWaterCount, reward: { coins: 100, items: [{ itemId: 'heart_fertilizer', amount: 1 }] } },
  { id: 'garden_harvest_30', category: 'garden', rarity: 'normal', target: 30, progress: (pet) => pet.garden.lifetimeHarvestCount, reward: { coins: 200, items: [{ itemId: 'heart_fertilizer', amount: 1 }] } },
  { id: 'garden_harvest_100', category: 'garden', rarity: 'rare', target: 100, progress: (pet) => pet.garden.lifetimeHarvestCount, reward: { coins: 500, items: [{ itemId: 'heart_fertilizer', amount: 2 }], gardenExtraDropChancePercent: 10 } },
  { id: 'garden_tree_catalogue', category: 'garden', rarity: 'rare', target: achievementGardenTreeIds.length, progress: getHarvestedGardenTreeKindCount, reward: { coins: 300, items: [{ itemId: 'heart_fertilizer', amount: 2 }], gardenExtraDropChancePercent: 10 } },
  { id: 'garden_all_slots', category: 'garden', rarity: 'rare', target: 5, progress: getUnlockedGardenSlotCount, reward: { coins: 500, gardenExtraDropChancePercent: 20 } },
  { id: 'garden_tools_max', category: 'garden', rarity: 'rare', target: 3, progress: getMaxedGardenToolCount, reward: { coins: 300, gardenExtraDropChancePercent: 10 } },
  { id: 'schedule_first', category: 'schedule', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.partnerScheduleClaimCount, reward: { coins: 80 } },
  { id: 'schedule_10', category: 'schedule', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.partnerScheduleClaimCount, reward: { coins: 200 } },
  { id: 'schedule_50', category: 'schedule', rarity: 'rare', target: 50, progress: (pet) => pet.achievements.counters.partnerScheduleClaimCount, reward: { coins: 500, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'schedule_all_categories', category: 'schedule', rarity: 'normal', target: achievementPartnerScheduleCategories.length, progress: getPartnerScheduleCategoryCount, reward: { coins: 300 } },
  { id: 'schedule_long_5', category: 'schedule', rarity: 'normal', target: 5, progress: getPartnerScheduleLongCount, reward: { coins: 300 } },
  { id: 'schedule_long_all_categories', category: 'schedule', rarity: 'rare', target: achievementPartnerScheduleCategories.length, progress: getPartnerScheduleLongCategoryCount, reward: { coins: 500, items: [{ itemId: 'heart_fertilizer', amount: 2 }] } },
  { id: 'schedule_category_reward_10', category: 'schedule', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.partnerScheduleCategoryRewardClaimCount, reward: { coins: 250 } },
  { id: 'schedule_daily_three', category: 'hidden', rarity: 'hidden', target: 3, progress: (pet) => pet.partnerSchedule.completedOfferIds.length, reward: { coins: 500, partnerScheduleExtraRewardChancePercent: 10 }, hiddenUntilUnlocked: true },
  { id: 'schedule_all_skills_3', category: 'schedule', rarity: 'rare', target: 3, progress: getPartnerScheduleMinimumSkillLevel, reward: { coins: 500, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'schedule_all_skills_6', category: 'schedule', rarity: 'rare', target: 6, progress: getPartnerScheduleMinimumSkillLevel, reward: { coins: 800, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'schedule_all_skills_max', category: 'hidden', rarity: 'hidden', target: 10, progress: getPartnerScheduleMinimumSkillLevel, reward: { coins: 1000, items: [{ itemId: 'golden_apple', amount: 2 }], partnerScheduleExtraRewardChancePercent: 20 }, hiddenUntilUnlocked: true },
  { id: 'schedule_all_master_10', category: 'schedule', rarity: 'rare', target: 10, progress: getPartnerScheduleMinimumMasterCompletionCount, reward: { coins: 1500, items: [{ itemId: 'golden_apple', amount: 2 }] } },
  { id: 'first_purchase', category: 'shop', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.paidPurchaseCount, reward: { coins: 20 } },
  { id: 'purchase_20', category: 'shop', rarity: 'normal', target: 20, progress: (pet) => pet.achievements.counters.purchaseCount, reward: { coins: 55 } },
  { id: 'paid_purchase_100', category: 'shop', rarity: 'rare', target: 100, progress: (pet) => pet.achievements.counters.paidPurchaseCount, reward: { coins: 500 } },
  { id: 'shop_item_collector', category: 'shop', rarity: 'rare', target: shopItemIds.length, progress: (pet) => usedItemKinds(pet, shopItemIds), reward: { extraHeartChancePercent: 10 } },
  { id: 'item_use_20', category: 'inventory', rarity: 'normal', target: 20, progress: (pet) => pet.achievements.counters.totalItemUseCount, reward: { coins: 50 } },
  { id: 'item_use_100', category: 'inventory', rarity: 'rare', target: 100, progress: (pet) => pet.achievements.counters.totalItemUseCount, reward: { coins: 300, extraHeartChancePercent: 10 } },
  { id: 'fruit_taster', category: 'inventory', rarity: 'normal', target: 1, progress: (pet) => minItemUses(pet, fruitIds), reward: { coins: 20, items: [{ itemId: 'watermelon', amount: 1 }] } },
  { id: 'watermelon_first', category: 'inventory', rarity: 'normal', target: 1, progress: (pet) => getItemUseCount(pet, 'watermelon'), reward: { coins: 20 } },
  { id: 'care_kit', category: 'inventory', rarity: 'normal', target: 1, progress: (pet) => minItemUses(pet, careKitIds), reward: { coins: 30 } },
  { id: 'fruit_master', category: 'inventory', rarity: 'rare', target: 20, progress: (pet) => minItemUses(pet, fruitIds), reward: { extraHeartChancePercent: 30 } },
  { id: 'omnivore', category: 'inventory', rarity: 'rare', target: shopFoodItemIds.length, progress: (pet) => usedItemKinds(pet, shopFoodItemIds), reward: { extraHeartChancePercent: 10 } },
  { id: 'pomodoro_1', category: 'pomodoro', rarity: 'normal', target: 1, progress: (pet) => pet.achievements.counters.pomodoroFocusCount, reward: { coins: 20 } },
  { id: 'pomodoro_10', category: 'pomodoro', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.pomodoroFocusCount, reward: { pomodoroCoinBonus: 1 } },
  { id: 'pomodoro_50', category: 'pomodoro', rarity: 'rare', target: 50, progress: (pet) => pet.achievements.counters.pomodoroFocusCount, reward: { pomodoroCoinBonus: 1 } },
  { id: 'pomodoro_100', category: 'pomodoro', rarity: 'rare', target: 100, progress: (pet) => pet.achievements.counters.pomodoroFocusCount, reward: { pomodoroCoinBonus: 1 } },
  { id: 'pomodoro_250', category: 'pomodoro', rarity: 'rare', target: 250, progress: (pet) => pet.achievements.counters.pomodoroFocusCount, reward: { coins: 500, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'pomodoro_day_4', category: 'pomodoro', rarity: 'normal', target: 4, progress: (pet) => pet.achievements.counters.bestDailyPomodoroFocusCount, reward: { coins: 45 } },
  { id: 'level_2', category: 'growth', rarity: 'normal', target: 2, progress: (pet) => pet.level, reward: { coins: 30 } },
  { id: 'level_5', category: 'growth', rarity: 'normal', target: 5, progress: (pet) => pet.level, reward: { coins: 80 } },
  { id: 'heart_10', category: 'growth', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.heartEarnedTotal, reward: { coins: 40 } },
  { id: 'coin_500', category: 'growth', rarity: 'normal', target: 500, progress: (pet) => pet.achievements.counters.coinEarnedTotal, reward: { coins: 60 } },
  { id: 'coin_2000', category: 'growth', rarity: 'rare', target: 2000, progress: (pet) => pet.achievements.counters.coinEarnedTotal, reward: { dailyStipendCoins: 2 } },
  { id: 'heart_50', category: 'growth', rarity: 'normal', target: 50, progress: (pet) => pet.achievements.counters.heartEarnedTotal, reward: { coins: 80 } },
  { id: 'heart_100', category: 'growth', rarity: 'rare', target: 100, progress: (pet) => pet.achievements.counters.heartEarnedTotal, reward: { extraHeartChancePercent: 20 } },
  { id: 'heart_200', category: 'growth', rarity: 'rare', target: 200, progress: (pet) => pet.achievements.counters.heartEarnedTotal, reward: { extraHeartChancePercent: 20 } },
  { id: 'max_coin_500', category: 'growth', rarity: 'normal', target: 500, progress: (pet) => pet.achievements.counters.maxCoinsHeld, reward: { coins: 60 } },
  { id: 'max_coin_2000', category: 'growth', rarity: 'rare', target: 2000, progress: (pet) => pet.achievements.counters.maxCoinsHeld, reward: { dailyStipendCoins: 2 } },
  { id: 'heart_500', category: 'growth', rarity: 'rare', target: 500, progress: (pet) => pet.achievements.counters.heartEarnedTotal, reward: { extraHeartChancePercent: 30 } },
  { id: 'birthday_first', category: 'date', rarity: 'normal', target: 1, progress: (pet) => getDateRewardCount(pet, 'birthday'), reward: { coins: 30 } },
  { id: 'monthly_gift_3', category: 'date', rarity: 'normal', target: 3, progress: (pet) => getDateRewardCount(pet, 'monthly_gift'), reward: { coins: 55 } },
  { id: 'festival_1', category: 'date', rarity: 'normal', target: 1, progress: (pet) => getDateRewardCount(pet, 'festival'), reward: { coins: 24 } },
  { id: 'anniversary_first', category: 'date', rarity: 'normal', target: 1, progress: (pet) => getDateRewardCount(pet, 'anniversary'), reward: { coins: 40, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'sleep_30', category: 'care', rarity: 'normal', target: 30, progress: (pet) => pet.achievements.counters.sleepStartCount, reward: { coins: 60 } },
  { id: 'manual_wake_10', category: 'care', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.manualWakeCount, reward: { coins: 45 } },
  { id: 'natural_wake_10', category: 'care', rarity: 'normal', target: 10, progress: (pet) => pet.achievements.counters.naturalWakeCount, reward: { coins: 45 } },
  { id: 'sleep_rhythm_30', category: 'care', rarity: 'rare', target: 30, progress: (pet) => Math.min(pet.achievements.counters.sleepStartCount, pet.achievements.counters.naturalWakeCount), reward: { careStatBonus: 1 } },
  { id: 'rare_trusted_companion', category: 'daily', rarity: 'rare', target: 10, progress: getActiveDaysTotal, isComplete: (pet: PetState) => getCompanionDays(pet) >= 30 && getActiveDaysTotal(pet) >= 10, reward: { dailyStipendCoins: 4 } },
  { id: 'rare_fruit_collector', category: 'inventory', rarity: 'rare', target: 3, progress: (pet) => minItemUses(pet, fruitIds), reward: { dailyStipendCoins: 3, items: [{ itemId: 'golden_apple', amount: 1 }] } },
  { id: 'rare_gentle_caretaker', category: 'care', rarity: 'rare', target: 50, progress: (pet) => minCareUses(pet, gentleCareKeys), reward: { careStatBonus: 1 } },
  { id: 'rare_level_10', category: 'growth', rarity: 'rare', target: 10, progress: (pet) => pet.level, reward: { dailyStipendCoins: 5 } },
  { id: 'rare_level_20', category: 'growth', rarity: 'rare', target: 20, progress: (pet) => pet.level, reward: { coins: 1500, items: [{ itemId: 'golden_apple', amount: 2 }], extraHeartChancePercent: 20, gardenExtraDropChancePercent: 20 } },
  { id: 'hidden_good_ending_year_1', category: 'hidden', rarity: 'hidden', target: 1, progress: (pet) => pet.achievements.completedGoodEndingYears.includes(1) ? 1 : 0, reward: { dailyStipendCoins: goodEndingDailyStipendCoinsPerYear, extraHeartChancePercent: goodEndingExtraHeartChancePercentPerYear, cgId: goodEndingCgId }, hiddenUntilUnlocked: true },
  { id: 'hidden_never_give_you_up', category: 'hidden', rarity: 'hidden', target: 3, progress: getCompanionMarkCount, reward: { coins: 100, items: [{ itemId: 'golden_apple', amount: 1 }] }, hiddenUntilUnlocked: true },
  { id: 'hidden_never_let_you_down', category: 'hidden', rarity: 'hidden', target: 10, progress: getCompanionMarkCount, reward: { coins: 100, hearts: 10 }, hiddenUntilUnlocked: true },
  { id: 'hidden_quiet_companion', category: 'hidden', rarity: 'hidden', target: 100, progress: getActiveDaysTotal, reward: { dailyStipendCoins: 2 }, hiddenUntilUnlocked: true },
  { id: 'hidden_prepared_bag', category: 'hidden', rarity: 'hidden', target: 11, progress: getInventoryItemTotal, reward: { coins: 100 }, hiddenUntilUnlocked: true },
  { id: 'hidden_hoarder', category: 'hidden', rarity: 'hidden', target: 51, progress: getInventoryItemTotal, reward: { dailyLoginItemBonus: 1 }, hiddenUntilUnlocked: true },
  { id: 'hidden_regular_life', category: 'hidden', rarity: 'hidden', target: 100, progress: (pet) => pet.achievements.counters.sleepStartCount, reward: { dailyStipendCoins: 1 }, hiddenUntilUnlocked: true },
  { id: 'hidden_big_watermelon', category: 'hidden', rarity: 'hidden', target: 20, progress: (pet) => minItemUses(pet, nonWatermelonFruitIds), reward: { extraHeartChancePercent: 10 }, hiddenUntilUnlocked: true },
  { id: 'hidden_good_friend', category: 'hidden', rarity: 'hidden', target: 90, progress: (pet) => pet.boostCards.bestFriendPassPurchasedDays, reward: { extraHeartChancePercent: 20 }, hiddenUntilUnlocked: true },
] as const;

const normalAchievementIds = baseAchievementDefinitionConfigs
  .filter((definition) => definition.rarity === 'normal')
  .map((definition) => definition.id);
export const taskMasterCompletionRatio = 0.8;
const taskMasterTarget = Math.ceil(normalAchievementIds.length * taskMasterCompletionRatio);
const getUnlockedNormalAchievementCount = (pet: PetState) =>
  normalAchievementIds.filter((id) => pet.achievements.unlockedAtById[id]).length;

const achievementDefinitionConfigs: readonly Omit<AchievementDefinition, 'title' | 'description'>[] = [
  ...baseAchievementDefinitionConfigs,
  { id: 'kitchen_first', category: 'kitchen', rarity: 'normal', target: 1, progress: (pet) => Object.keys(pet.kitchen.made).length, reward: { coins: 50, hearts: 5 } },
  { id: 'kitchen_three', category: 'kitchen', rarity: 'normal', target: 3, progress: (pet) => Object.keys(pet.kitchen.made).length, reward: { coins: 100, hearts: 10 } },
  { id: 'kitchen_eight', category: 'kitchen', rarity: 'rare', target: 8, progress: (pet) => recipes.slice(0, 8).filter((recipe) => (pet.kitchen.made[recipe.id] ?? 0) > 0).length, reward: { coins: 200, hearts: 20 } },
  { id: 'kitchen_thirty', category: 'kitchen', rarity: 'normal', target: 30, progress: (pet) => Object.values(pet.kitchen.made).reduce((sum, amount) => sum + (amount ?? 0), 0), reward: { coins: 200, hearts: 10 } },
  { id: 'kitchen_methods', category: 'kitchen', rarity: 'normal', target: 4, progress: (pet) => new Set(recipes.filter((recipe) => pet.kitchen.made[recipe.id]).map((recipe) => recipe.method)).size, reward: { coins: 150, hearts: 10 } },
  { id: 'kitchen_tastes', category: 'kitchen', rarity: 'normal', target: 3, progress: (pet) => new Set(Object.values(pet.kitchen.tasted).flatMap((tastes) => Object.keys(tastes).map((id) => id.replace(/_banana$/, '')))).size, reward: { coins: 100, hearts: 10 } },
  ...(['matching', 'catch', 'bubbles'] as const).map((game): Omit<AchievementDefinition, 'title' | 'description'> => ({ id: `play_${game}`, category: 'play', rarity: 'normal', target: 1, progress: (pet) => (pet.miniGames.records[`${game}:normal`]?.completed ?? 0) + (pet.miniGames.records[`${game}:gentle`]?.completed ?? 0), reward: { coins: 30, hearts: 5 } })),
  {
    id: 'hidden_full_catalogue',
    category: 'hidden',
    rarity: 'hidden',
    target: taskMasterTarget,
    progress: getUnlockedNormalAchievementCount,
    reward: { revealsHiddenAchievements: true },
    hiddenUntilUnlocked: true,
  },
] as const;

export const achievementDefinitions: readonly AchievementDefinition[] = achievementDefinitionConfigs.map((definition) => ({
  ...definition,
  title: getAchievementTitle(definition.id),
  description: getAchievementDescription(definition.id),
}));

export const recordCompanionYearActivity = (pet: PetState, now = Date.now()): PetState => {
  const dateKey = getEffectiveDailyDateKey(pet, now);
  const effectiveNow = Math.max(now, getDailyDateKeyTime(dateKey, now));
  const year = String(getCompanionActivityYear(pet.createdAt, effectiveNow));
  const keys = pet.achievements.counters.companionYearActiveDateKeysByYear[year] ?? [];
  if (keys.includes(dateKey)) return pet;
  return {
    ...pet,
    achievements: {
      ...pet.achievements,
      counters: {
        ...pet.achievements.counters,
        companionYearActiveDateKeysByYear: {
          ...pet.achievements.counters.companionYearActiveDateKeysByYear,
          [year]: [...keys, dateKey].slice(-370),
        },
      },
    },
  };
};

const unlockedDefinitions = (pet: PetState) => achievementDefinitions.filter((definition) => Boolean(pet.achievements.unlockedAtById[definition.id]));
const sumUnlockedReward = (pet: PetState, pick: (reward: AchievementReward) => number | undefined) =>
  unlockedDefinitions(pet).reduce((sum, definition) => sum + (pick(definition.reward) ?? 0), 0);
const sumStandardUnlockedReward = (pet: PetState, pick: (reward: AchievementReward) => number | undefined) =>
  unlockedDefinitions(pet)
    .filter((definition) => definition.id !== 'hidden_good_ending_year_1')
    .reduce((sum, definition) => sum + (pick(definition.reward) ?? 0), 0);

const getCompletedGoodEndingYearCount = (pet: PetState) =>
  new Set(
    pet.achievements.completedGoodEndingYears
      .filter((year) => Number.isFinite(year) && year > 0)
      .map((year) => Math.floor(year)),
  ).size;

export const getAchievementEffects = (pet: PetState): AchievementEffects => {
  const goodEndingCount = getCompletedGoodEndingYearCount(pet);
  const extraHeartChancePercent = Math.max(
    0,
    sumStandardUnlockedReward(pet, (reward) => reward.extraHeartChancePercent)
      + goodEndingCount * goodEndingExtraHeartChancePercentPerYear,
  );
  const gardenExtraDropChancePercent = Math.max(0, sumUnlockedReward(pet, (reward) => reward.gardenExtraDropChancePercent));
  const partnerScheduleExtraRewardChancePercent = Math.max(0, sumUnlockedReward(pet, (reward) => reward.partnerScheduleExtraRewardChancePercent));
  return {
    workCoinBonus: Math.min(3, sumUnlockedReward(pet, (reward) => reward.workCoinBonus)),
    pomodoroCoinBonus: Math.min(3, sumUnlockedReward(pet, (reward) => reward.pomodoroCoinBonus)),
    cleanCooldownMs: baseCleanCooldownMs,
    extraHeartChancePercent,
    guaranteedExtraHearts: Math.floor(extraHeartChancePercent / 100),
    gardenExtraDropChancePercent,
    partnerScheduleExtraRewardChancePercent,
    dailyStipendCoins: Math.max(
      0,
      sumStandardUnlockedReward(pet, (reward) => reward.dailyStipendCoins)
        + goodEndingCount * goodEndingDailyStipendCoinsPerYear,
    ),
    dailyLoginItemBonus: Math.max(0, sumUnlockedReward(pet, (reward) => reward.dailyLoginItemBonus)),
    careStatBonus: Math.min(1, sumUnlockedReward(pet, (reward) => reward.careStatBonus)),
    unlockedCgIds: pet.achievements.unlockedCgIds,
    revealsHiddenAchievements: unlockedDefinitions(pet).some((definition) => Boolean(definition.reward.revealsHiddenAchievements)),
  };
};

export const applyCoinGain = (pet: PetState, coins: number): { coins: number; amount: number } => {
  const base = Math.max(0, Math.floor(coins));
  const amount = base;
  return { coins: clampCoins(pet.coins + amount), amount };
};

export const applyHeartGain = (pet: PetState, hearts: number): { hearts: number; amount: number; boostCards: PetState['boostCards'] } => {
  const base = Math.max(0, Math.floor(hearts));
  const effects = getAchievementEffects(pet);
  const chance = effects.extraHeartChancePercent % 100;
  const extraHearts = base > 0 ? effects.guaranteedExtraHearts + (chance > 0 && Math.random() * 100 < chance ? 1 : 0) : 0;
  const achievementAmount = base > 0 ? base + extraHearts : 0;
  const boost = applyBoostCardHeartBonus(pet, achievementAmount);
  const amount = achievementAmount + boost.extraHearts;
  return { hearts: clampCount(pet.hearts + amount), amount, boostCards: boost.boostCards };
};

export const rollExtraHearts = (pet: PetState) => {
  const effects = getAchievementEffects(pet);
  const chance = effects.extraHeartChancePercent % 100;
  return effects.guaranteedExtraHearts + (chance > 0 && Math.random() * 100 < chance ? 1 : 0);
};

export const incrementAchievementCareAction = (pet: PetState, action: CareActionKey, amount = 1): PetState => {
  if (!careKeys.includes(action as YearlyCareActionKey)) return pet;
  const key = action as YearlyCareActionKey;
  const increment = Math.max(0, Math.floor(amount));
  return {
    ...pet,
    achievements: {
      ...pet.achievements,
      counters: {
        ...pet.achievements.counters,
        careActionCounts: {
          ...pet.achievements.counters.careActionCounts,
          [key]: (pet.achievements.counters.careActionCounts[key] ?? 0) + increment,
        },
      },
    },
  };
};

export const incrementAchievementItemUse = (pet: PetState, itemId: ItemId, amount = 1): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      itemUseCountsById: {
        ...pet.achievements.counters.itemUseCountsById,
        [itemId]: (pet.achievements.counters.itemUseCountsById[itemId] ?? 0) + Math.max(0, Math.floor(amount)),
      },
      totalItemUseCount: pet.achievements.counters.totalItemUseCount + Math.max(0, Math.floor(amount)),
    },
  },
});

export const incrementAchievementPomodoroFocus = (
  pet: PetState,
  count: number,
  completedDailyFocusCount = pet.pomodoro.dailyCompletedFocusCount,
): PetState =>
  count <= 0
    ? pet
    : {
        ...pet,
        achievements: {
          ...pet.achievements,
          counters: {
            ...pet.achievements.counters,
            pomodoroFocusCount: pet.achievements.counters.pomodoroFocusCount + Math.floor(count),
            bestDailyPomodoroFocusCount: Math.max(
              pet.achievements.counters.bestDailyPomodoroFocusCount,
              completedDailyFocusCount,
            ),
          },
        },
      };


export const incrementAchievementPurchase = (pet: PetState, paid = true, amount = 1): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      purchaseCount: pet.achievements.counters.purchaseCount + Math.max(0, Math.floor(amount)),
      paidPurchaseCount: pet.achievements.counters.paidPurchaseCount + (paid ? Math.max(0, Math.floor(amount)) : 0),
    },
  },
});

export const incrementAchievementSleepStart = (pet: PetState): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      sleepStartCount: pet.achievements.counters.sleepStartCount + 1,
    },
  },
});

export const incrementAchievementDateReward = (pet: PetState, kind: string): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      dateRewardClaimCountsByKind: {
        ...pet.achievements.counters.dateRewardClaimCountsByKind,
        [kind]: (pet.achievements.counters.dateRewardClaimCountsByKind[kind] ?? 0) + 1,
      },
    },
  },
});
export const incrementDailyWishClaim = (pet: PetState): PetState => ({
  ...pet,
  achievements: { ...pet.achievements, counters: { ...pet.achievements.counters, dailyWishClaimCount: pet.achievements.counters.dailyWishClaimCount + 1 } },
});

export const incrementReturnWelcomeClaim = (pet: PetState): PetState => ({
  ...pet,
  achievements: { ...pet.achievements, counters: { ...pet.achievements.counters, returnWelcomeClaimCount: pet.achievements.counters.returnWelcomeClaimCount + 1 } },
});

export const recordCoinBalance = (pet: PetState): PetState => {
  const currentCoins = isNumber(pet.coins) ? clampCount(pet.coins) : 0;
  return {
    ...pet,
    achievements: {
      ...pet.achievements,
      counters: {
        ...pet.achievements.counters,
        maxCoinsHeld: Math.max(pet.achievements.counters.maxCoinsHeld, currentCoins),
      },
    },
  };
};

export const recordEarnedCoins = (pet: PetState, amount: number): PetState => {
  const earned = isNumber(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const withBalance = recordCoinBalance(pet);
  return earned <= 0
    ? withBalance
    : {
        ...withBalance,
        achievements: {
          ...withBalance.achievements,
          counters: {
            ...withBalance.achievements.counters,
            coinEarnedTotal: withBalance.achievements.counters.coinEarnedTotal + earned,
          },
        },
      };
};

export const recordEarnedHearts = (pet: PetState, amount: number): PetState => {
  const earned = isNumber(amount) ? Math.max(0, Math.floor(amount)) : 0;
  return earned <= 0
    ? pet
    : { ...pet, achievements: { ...pet.achievements, counters: { ...pet.achievements.counters, heartEarnedTotal: pet.achievements.counters.heartEarnedTotal + earned } } };
};

export const incrementManualWake = (pet: PetState): PetState => ({
  ...pet,
  achievements: { ...pet.achievements, counters: { ...pet.achievements.counters, manualWakeCount: pet.achievements.counters.manualWakeCount + 1 } },
});

export const incrementNaturalWake = (pet: PetState): PetState => ({
  ...pet,
  achievements: { ...pet.achievements, counters: { ...pet.achievements.counters, naturalWakeCount: pet.achievements.counters.naturalWakeCount + 1 } },
});

export const incrementAchievementGardenPlant = (pet: PetState): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: { ...pet.achievements.counters, gardenPlantCount: pet.achievements.counters.gardenPlantCount + 1 },
  },
});

export const incrementAchievementGardenWater = (pet: PetState): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: { ...pet.achievements.counters, gardenWaterCount: pet.achievements.counters.gardenWaterCount + 1 },
  },
});

export const incrementAchievementGardenHarvest = (pet: PetState, treeId: GardenTreeId): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      gardenHarvestCountsByTreeId: {
        ...pet.achievements.counters.gardenHarvestCountsByTreeId,
        [treeId]: (pet.achievements.counters.gardenHarvestCountsByTreeId[treeId] ?? 0) + 1,
      },
    },
  },
});

export const incrementAchievementPartnerScheduleClaim = (
  pet: PetState,
  category: PartnerScheduleCategory,
  size: PartnerScheduleSize,
  choice: PartnerScheduleRewardChoice,
): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    counters: {
      ...pet.achievements.counters,
      partnerScheduleClaimCount: pet.achievements.counters.partnerScheduleClaimCount + 1,
      partnerScheduleClaimCountsByCategory: {
        ...pet.achievements.counters.partnerScheduleClaimCountsByCategory,
        [category]: (pet.achievements.counters.partnerScheduleClaimCountsByCategory[category] ?? 0) + 1,
      },
      partnerScheduleLongClaimCountsByCategory: size === 'long'
        ? {
            ...pet.achievements.counters.partnerScheduleLongClaimCountsByCategory,
            [category]: (pet.achievements.counters.partnerScheduleLongClaimCountsByCategory[category] ?? 0) + 1,
          }
        : pet.achievements.counters.partnerScheduleLongClaimCountsByCategory,
      partnerScheduleCategoryRewardClaimCount: pet.achievements.counters.partnerScheduleCategoryRewardClaimCount + (choice === 'category' ? 1 : 0),
    },
  },
});

const applyOneTimeAchievementReward = (pet: PetState, definition: AchievementDefinition, now: number): PetState => {
  if (!definition.reward.coins && !definition.reward.hearts && !definition.reward.items?.length) return pet;
  if (pet.achievements.claimedOneTimeRewardIds.includes(definition.id)) return pet;
  let next = pet;
  if (definition.reward.coins) {
    const gain = applyCoinGain(next, definition.reward.coins);
    next = recordEarnedCoins({ ...next, coins: gain.coins }, gain.amount);
  }
  if (definition.reward.hearts) {
    const gain = applyHeartGain(next, definition.reward.hearts);
    next = recordEarnedHearts({ ...next, hearts: gain.hearts }, gain.amount);
  }
  if (definition.reward.items) {
    next = { ...next, inventory: definition.reward.items.reduce((inventory, item) => addInventoryItem(inventory, item.itemId, item.amount), next.inventory) };
  }
  return {
    ...next,
    achievements: { ...next.achievements, claimedOneTimeRewardIds: [...next.achievements.claimedOneTimeRewardIds, definition.id] },
    recentEvent: t('pet.achievements.events.rewardClaimed', { title: definition.title }),
    lastInteractionAt: now,
  };
};

export const maybeUnlockGoodEnding = (pet: PetState, now = Date.now()): PetState => {
  const effectiveDateKey = getEffectiveDailyDateKey(pet, now);
  const effectiveNow = Math.max(now, getDailyDateKeyTime(effectiveDateKey, now));
  const companionYear = getCompanionYear(pet.createdAt, effectiveNow);
  if (companionYear < 2 || pet.level < 10) return pet;
  const completedYear = companionYear - 1;
  if (pet.achievements.completedGoodEndingYears.includes(completedYear)) return pet;
  const activeDays = pet.achievements.counters.companionYearActiveDateKeysByYear[String(completedYear)]?.length ?? 0;
  if (activeDays < 200) return pet;
  const id = completedYear === 1 ? 'hidden_good_ending_year_1' : 'hidden_together_year_' + completedYear;
  const title = completedYear === 1 ? getAchievementTitle('hidden_good_ending_year_1') : t('pet.achievements.extraYear.title', { year: completedYear });
  const unlockedCgIds = completedYear === 1 && !pet.achievements.unlockedCgIds.includes(goodEndingCgId)
    ? [...pet.achievements.unlockedCgIds, goodEndingCgId]
    : pet.achievements.unlockedCgIds;
  return {
    ...pet,
    achievements: {
      ...pet.achievements,
      unlockedAtById: { ...pet.achievements.unlockedAtById, [id]: now },
      completedGoodEndingYears: [...pet.achievements.completedGoodEndingYears, completedYear],
      unlockedCgIds,
    },
    recentEvent: t('pet.achievements.events.unlocked', { title }),
  };
};

export const evaluateAchievementUnlocks = (pet: PetState, now = Date.now()): AchievementEvaluationResult => {
  const beforeUnlocked = new Set(Object.keys(pet.achievements.unlockedAtById));
  let next = recordCompanionYearActivity(pet, now);
  for (const definition of achievementDefinitions) {
    if (manualUnlockAchievementIds.has(definition.id)) continue;
    if (next.achievements.unlockedAtById[definition.id]) continue;
    if ((definition.isComplete ? definition.isComplete(next) : definition.progress(next) >= definition.target)) {
      next = { ...next, achievements: { ...next.achievements, unlockedAtById: { ...next.achievements.unlockedAtById, [definition.id]: now } } };
    }
  }
  next = maybeUnlockGoodEnding(next, now);
  const unlockedIds = Object.keys(next.achievements.unlockedAtById).filter((id) => !beforeUnlocked.has(id));
  if (unlockedIds.length > 1 || pet.achievements.pendingReviewNotice) {
    next = { ...next, achievements: { ...next.achievements, pendingReviewNotice: true } };
  }
  const views = getAchievementViews(next);
  return { pet: next, unlocked: unlockedIds.map((id) => views.find((view) => view.id === id)).filter((view): view is AchievementView => Boolean(view)) };
};

export const evaluateAchievements = (pet: PetState, now = Date.now()): PetState => evaluateAchievementUnlocks(pet, now).pet;

const getItemName = (itemId: ItemId) => getInventoryItem(itemId)?.name ?? itemId;

export const formatAchievementReward = (reward: AchievementReward) => {
  const parts: string[] = [];
  if (reward.coins) parts.push(t('pet.achievements.rewards.coins', { coins: reward.coins }));
  if (reward.hearts) parts.push(t('pet.achievements.rewards.hearts', { hearts: reward.hearts }));
  reward.items?.forEach((item) => parts.push(t('pet.achievements.rewards.item', { item: getItemName(item.itemId), count: item.amount })));
  if (reward.workCoinBonus) parts.push(t('pet.achievements.rewards.workCoinBonus', { amount: reward.workCoinBonus }));
  if (reward.pomodoroCoinBonus) parts.push(t('pet.achievements.rewards.pomodoroCoinBonus', { amount: reward.pomodoroCoinBonus }));
  if (reward.cleanCooldownMs) parts.push(t('pet.achievements.rewards.cleanCooldown', { seconds: Math.round(reward.cleanCooldownMs / 1000) }));
  if (reward.extraHeartChancePercent) parts.push(t('pet.achievements.rewards.extraHeartChance', { percent: reward.extraHeartChancePercent }));
  if (reward.gardenExtraDropChancePercent) parts.push(t('pet.achievements.rewards.gardenExtraDropChance', { percent: reward.gardenExtraDropChancePercent }));
  if (reward.partnerScheduleExtraRewardChancePercent) parts.push(t('pet.achievements.rewards.partnerScheduleExtraRewardChance', { percent: reward.partnerScheduleExtraRewardChancePercent }));
  if (reward.dailyStipendCoins) parts.push(t('pet.achievements.rewards.dailyStipend', { coins: reward.dailyStipendCoins }));
  if (reward.dailyLoginItemBonus) parts.push(t('pet.achievements.rewards.dailyLoginItemBonus', { amount: reward.dailyLoginItemBonus }));
  if (reward.careStatBonus) parts.push(t('pet.achievements.rewards.careStatBonus', { amount: reward.careStatBonus }));
  if (reward.cgId) parts.push(t('pet.achievements.rewards.cg'));
  if (reward.revealsHiddenAchievements) parts.push(t('pet.achievements.rewards.hiddenReveal'));
  return parts.length > 0 ? parts.join(t('common.comma')) : t('pet.achievements.rewards.badge');
};

export const getAchievementViews = (pet: PetState): AchievementView[] => {
  const showHiddenConditions = getAchievementEffects(pet).revealsHiddenAchievements;
  const views = achievementDefinitions
    .filter((definition) => !definition.hiddenUntilUnlocked || pet.achievements.unlockedAtById[definition.id] || showHiddenConditions)
    .map((definition) => {
      const progressValue = Math.min(definition.target, definition.progress(pet));
      const unlockedAt = pet.achievements.unlockedAtById[definition.id];
      const unlocked = Boolean(unlockedAt);
      const hasReward = Boolean(definition.reward.coins || definition.reward.hearts || definition.reward.items?.length);
      const claimed = !hasReward || pet.achievements.claimedOneTimeRewardIds.includes(definition.id);
      const effectActive = unlocked && Boolean(definition.reward.workCoinBonus || definition.reward.pomodoroCoinBonus || definition.reward.cleanCooldownMs || definition.reward.extraHeartChancePercent || definition.reward.gardenExtraDropChancePercent || definition.reward.partnerScheduleExtraRewardChancePercent || definition.reward.dailyStipendCoins || definition.reward.dailyLoginItemBonus || definition.reward.careStatBonus || definition.reward.cgId || definition.reward.revealsHiddenAchievements);
      return { ...definition, progressValue, unlocked, unlockedAt, rewardText: formatAchievementReward(definition.reward), claimed, claimable: unlocked && hasReward && !claimed, effectActive };
    });
  const extraYears = pet.achievements.completedGoodEndingYears.filter((year) => year > 1);
  return [
    ...views,
    ...extraYears.map((year) => {
      const reward: AchievementReward = {
        dailyStipendCoins: goodEndingDailyStipendCoinsPerYear,
        extraHeartChancePercent: goodEndingExtraHeartChancePercentPerYear,
      };
      return {
        id: 'hidden_together_year_' + year,
        title: t('pet.achievements.extraYear.title', { year }),
        description: t('pet.achievements.extraYear.description'),
        category: 'hidden' as const,
        rarity: 'hidden' as const,
        target: 1,
        progress: () => 1,
        progressValue: 1,
        unlocked: true,
        unlockedAt: pet.achievements.unlockedAtById['hidden_together_year_' + year],
        reward,
        rewardText: formatAchievementReward(reward),
        claimed: true,
        claimable: false,
        effectActive: true,
      };
    }),
  ];
};






export const claimAchievementReward = (pet: PetState, id: AchievementId, now = Date.now()): PetState => {
  const definition = achievementDefinitions.find((item) => item.id === id);
  if (!definition || !pet.achievements.unlockedAtById[id]) return pet;
  return applyOneTimeAchievementReward(pet, definition, now);
};

export const claimAllAchievementRewards = (pet: PetState, now = Date.now()): AchievementClaimAllResult => {
  const claimedIds = getAchievementViews(pet).filter((view) => view.claimable).map((view) => view.id);
  if (claimedIds.length === 0) return { pet, claimedIds };
  const definitionsById = new Map(achievementDefinitions.map((definition) => [definition.id, definition]));
  const claimedPet = claimedIds.reduce((next, id) => {
    const definition = definitionsById.get(id);
    return definition ? applyOneTimeAchievementReward(next, definition, now) : next;
  }, pet);
  return {
    pet: {
      ...claimedPet,
      recentEvent: t('pet.achievements.events.rewardsClaimed', { count: claimedIds.length }),
      lastInteractionAt: now,
    },
    claimedIds,
  };
};

export const claimAchievementDailyStipendWithResult = (pet: PetState, now = Date.now(), dateKey = getEffectiveDailyDateKey(pet, now)): { pet: PetState; coins: number } => {
  const coins = getAchievementEffects(pet).dailyStipendCoins;
  if (coins <= 0 || pet.achievements.dailyStipendClaimDateKey === dateKey) return { pet, coins: 0 };
  const gain = applyCoinGain(pet, coins);
  return {
    pet: recordEarnedCoins({
      ...pet,
      coins: gain.coins,
      achievements: { ...pet.achievements, dailyStipendClaimDateKey: dateKey },
      recentEvent: t('pet.achievements.events.dailyStipendClaimed', { coins: gain.amount }),
      lastInteractionAt: now,
    }, gain.amount),
    coins: gain.amount,
  };
};

export const claimAchievementDailyStipend = (pet: PetState, now = Date.now()): PetState =>
  claimAchievementDailyStipendWithResult(pet, now).pet;

export const getAchievementSummary = (pet: PetState, now = Date.now()): AchievementSummary => {
  const views = getAchievementViews(pet);
  const effects = getAchievementEffects(pet);
  const dailyStipendCoins = effects.dailyStipendCoins;
  const dateKey = getEffectiveDailyDateKey(pet, now);
  return {
    total: views.length,
    unlocked: views.filter((view) => view.unlocked).length,
    claimable: views.filter((view) => view.claimable).length,
    pendingReviewNotice: pet.achievements.pendingReviewNotice,
    dailyStipendCoins,
    dailyStipendClaimed: pet.achievements.dailyStipendClaimDateKey === dateKey,
    dailyStipendClaimable: dailyStipendCoins > 0 && pet.achievements.dailyStipendClaimDateKey !== dateKey,
    gardenExtraDropChancePercent: effects.gardenExtraDropChancePercent,
  };
};

export const markAchievementReviewSeen = (pet: PetState): PetState =>
  pet.achievements.pendingReviewNotice ? { ...pet, achievements: { ...pet.achievements, pendingReviewNotice: false } } : pet;









