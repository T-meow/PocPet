import { t } from '../i18n';
import { defaultBoostCardState, normalizeBoostCardState } from './boostCards';
import { defaultKitchenState, normalizeKitchenState } from './kitchen';
import { defaultMiniGameState, normalizeMiniGameState } from './miniGames';
import { defaultCompanionMemories, normalizeCompanionMemories } from './companionMemories';
import { createNewSaveMetadata, normalizeSaveMetadata, type SaveMetadata } from './saveMetadata';
import { defaultClassicEndgameState, getClassicLegacyCoinCurveMigrationRefund, normalizeClassicEndgameState } from './classicEndgame';
import { defaultAchievementState, normalizeAchievementState } from './achievements';
import { defaultPetBirthday, getLocalCalendarDate, normalizePetBirthday, normalizePetCalendarDate } from './dateRewards';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { createDailyWish, normalizeDailyWishState, normalizeReturnWelcomeState } from './dailyWishes';
import { defaultGardenState, normalizeGardenState } from './garden';
import { defaultGoldenAppleGachaState, normalizeGoldenAppleGachaState } from './goldenAppleGacha';
import { getDailyDateKeyTime, normalizeTimeGuardState, timeGuardSchemaVersion } from './gameClock';
import { addInventoryItem } from './items';
import { dailyBiscuitClaimLimit, dailyHeartExchangeLimit, isBuiltinItemId } from './items';
import { neighborGiftDailyLimit } from './neighbors';
import { clampCoins, clampCount, clampHealth, clampLevel, clampPetEnergy, clampStat, defaultPetName, getPetStatThreshold, getPetStatCap, lowCleanlinessSleepConfirmClicks } from './petStats';
import type { AchievementState, ActionStreak, BuiltinItemId, Inventory, PartnerScheduleCategory, PetState, PetStatus, RecentActivity, WeatherType } from './petTypes';
import { defaultPomodoroState, normalizePomodoroState } from './pomodoro';
import { defaultPartnerScheduleState, normalizePartnerScheduleState } from './partnerSchedule';
import { getWeatherForDate, weatherTypeSet } from './weather';
import { isNumber } from './utils';
import { defaultYearlyStats, normalizeYearReview, normalizeYearlyStats } from './yearlyStats';

export const helpStarterGiftRewardId = 'starter_help_gift_v1';
export const helpStarterGiftCoins = 800;
export const helpPageGiftRewardId = 'help_page_gift_v1';
export const helpPageGiftCoins = 600;
export const gardenCompensationRewardId = 'garden_compensation_gift_v1';
export const gardenCompensationCoins = 1500;
const goldenAppleStarterBackfillRewardId = 'golden_apple_starter_backfill_v1';
const legacySave13BonusRewardId = 'legacy_save_1_3_bonus_v1';
const legacySave13BonusCoins = 3000;
const goldenAppleBackfillRewardId = 'golden_apple_achievement_backfill_v1';
const partnerScheduleCategories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
const goldenAppleBackfillV2RewardId = 'golden_apple_achievement_backfill_v2';
const goldenAppleBackfillAchievementIds = ['rare_fruit_collector', 'anniversary_first', 'hidden_never_give_you_up', 'companion_100'] as const;
type GoldenAppleBackfillAchievementId = typeof goldenAppleBackfillAchievementIds[number];
const goldenAppleBackfillFruitIds = ['orange', 'apple', 'banana', 'watermelon'] as const;
const goldenAppleBackfillCoinRewards: Partial<Record<GoldenAppleBackfillAchievementId, number>> = {
  anniversary_first: 40,
  hidden_never_give_you_up: 100,
};
const dayMs = 24 * 60 * 60 * 1000;

const getLegacyCompanionDays = (createdAt: number, now: number) => Math.max(1, Math.floor(Math.max(0, now - createdAt) / dayMs) + 1);

const getLegacyActiveDaysTotal = (achievements: AchievementState) => {
  const keys = new Set<string>();
  Object.values(achievements.counters.companionYearActiveDateKeysByYear).forEach((items) => {
    items.forEach((key) => keys.add(key));
  });
  return keys.size;
};

const getLegacyMinFruitUses = (achievements: AchievementState) =>
  Math.min(...goldenAppleBackfillFruitIds.map((id) => achievements.counters.itemUseCountsById[id] ?? 0));

const isGoldenAppleAchievementAutoClaimable = (id: GoldenAppleBackfillAchievementId) =>
  id === 'rare_fruit_collector' || id === 'companion_100';

const isGoldenAppleAchievementCompleteByHistory = (
  id: GoldenAppleBackfillAchievementId,
  achievements: AchievementState,
  createdAt: number,
  now: number,
) => {
  if (id === 'rare_fruit_collector') return getLegacyMinFruitUses(achievements) >= 3;
  if (id === 'anniversary_first') return (achievements.counters.dateRewardClaimCountsByKind.anniversary ?? 0) >= 1;
  if (id === 'hidden_never_give_you_up') return achievements.counters.returnWelcomeClaimCount >= 3;
  return getLegacyCompanionDays(createdAt, now) >= 100 && getLegacyActiveDaysTotal(achievements) >= 60;
};

export const defaultActionStreak = (now: number): ActionStreak => ({
  key: 'none',
  count: 0,
  windowStartedAt: now,
  lastAt: 0,
});

export const recentActivities = new Set<RecentActivity>([
  'idle',
  'happy',
  'bath',
  'eat_cookie',
  'eat_noodles',
  'eat_meat',
  'give_heart',
  'level_up',
  'reading_books',
  'workout',
  'work_food',
  'work_plants',
]);

export const isRecentActivity = (value: unknown): value is RecentActivity =>
  typeof value === 'string' && recentActivities.has(value as RecentActivity);

export const createDefaultPet = (now = Date.now(), saveMetadata: SaveMetadata = createNewSaveMetadata(now)): PetState => ({
  saveMetadata,
  name: defaultPetName,
  level: 1,
  hunger: 78,
  mood: 72,
  cleanliness: 82,
  energy: 76,
  health: 90,
  createdAt: now,
  metDate: getLocalCalendarDate(now),
  ageSeconds: 0,
  lastUpdatedAt: now,
  isSleeping: false,
  recentEvent: t('pet.default.recentEvent'),
  recentActivity: 'idle',
  recentActivityUntil: 0,
  coins: 30,
  hearts: 0,
  inventory: { emergency_biscuit: 1, golden_apple: 1 },
  kitchen: defaultKitchenState(),
  miniGames: defaultMiniGameState(),
  companionMemories: defaultCompanionMemories(),
  lastDailyRewardAt: now,
  lastDailyEncounterAt: now,
  dailyEncounterDateKey: getDailyResetDateKey(now),
  neighborGiftDateKey: getDailyResetDateKey(now),
  neighborGiftCount: 0,
  dailyBiscuitClaimDate: getDailyResetDateKey(now),
  dailyBiscuitClaims: 0,
  dailyDiscountDate: getDailyResetDateKey(now),
  dailyDiscountItemIds: [],
  dailyDiscountUsedItemIds: [],
  dailyDiscountUsed: false,
  dailyHeartExchangeDate: getDailyResetDateKey(now),
  dailyHeartExchangeCount: 0,
  weatherDate: getDailyResetDateKey(now),
  weather: getWeatherForDate(now),
  lastEnergyRecoveryAt: now,
  sleepStartedAt: 0,
  sleepStartMood: 0,
  sleepStartHunger: 0,
  sleepStartCleanliness: 0,
  lowCleanlinessSleepConfirmCount: 0,
  lastDreamTalkAt: 0,
  actionStreak: defaultActionStreak(now),
  lastInteractionAt: now,
  lastPetInteractionAt: 0,
  pomodoro: defaultPomodoroState(now),
  hasOpenedHelp: false,
  hasSeenCommonDreamsUnlock: false,
  suppressGoldenAppleUseConfirm: false,
  claimedRewardIds: [goldenAppleStarterBackfillRewardId, legacySave13BonusRewardId],
  birthday: defaultPetBirthday,
  claimedDateRewardKeys: [],
  yearlyStats: defaultYearlyStats(now),
  achievements: defaultAchievementState(now, now, false, 30),
  lastCleanActionAt: 0,
  garden: defaultGardenState(now),
  boostCards: defaultBoostCardState(now),
  partnerSchedule: defaultPartnerScheduleState({ level: 1, createdAt: now }, now),
  goldenAppleGacha: defaultGoldenAppleGachaState(now, now),
  classicEndgame: defaultClassicEndgameState(),
  dailyWish: createDailyWish({
    level: 1,
    createdAt: now,
    name: defaultPetName,
    energy: 76,
    health: 90,
    isSleeping: false,
  }, now),
  timeGuard: {
    schemaVersion: timeGuardSchemaVersion,
    lastObservedAt: now,
    maxDailyDateKey: getDailyResetDateKey(now),
  },
});

export const getPrimaryStatus = (pet: PetState): PetStatus => {
  if (pet.isSleeping) return 'sleeping';
  if (pet.health <= getPetStatThreshold(pet, 35)) return 'sick';
  if (pet.hunger <= getPetStatThreshold(pet, 32)) return 'hungry';
  if (pet.cleanliness <= getPetStatThreshold(pet, 32)) return 'dirty';
  if (pet.energy <= 28) return 'tired';
  if (pet.mood <= getPetStatThreshold(pet, 30)) return 'sad';
  return 'content';
};

export const getStatusText = (status: PetStatus) => {
  const labels: Record<PetStatus, string> = {
    content: t('pet.status.content'),
    hungry: t('pet.status.hungry'),
    sad: t('pet.status.sad'),
    dirty: t('pet.status.dirty'),
    tired: t('pet.status.tired'),
    sick: t('pet.status.sick'),
    sleeping: t('pet.status.sleeping'),
  };
  return labels[status];
};

const normalizeBuiltinItemIdList = (value: unknown, maxLength: number): BuiltinItemId[] => {
  if (!Array.isArray(value)) return [];
  const ids: BuiltinItemId[] = [];
  value.forEach((rawId) => {
    if (typeof rawId !== 'string') return;
    const id = rawId.trim();
    if (isBuiltinItemId(id) && !ids.includes(id)) ids.push(id);
  });
  return ids.slice(0, maxLength);
};

const normalizeClaimedDateRewardKeys = (raw: Record<string, unknown>) => {
  const keys: string[] = [];
  const addKey = (value: unknown) => {
    if (typeof value !== 'string') return;
    const key = value.trim().slice(0, 128);
    if (key && !keys.includes(key)) keys.push(key);
  };
  const addLegacyYearKey = (prefix: 'birthday' | 'anniversary', value: unknown) => {
    if (!isNumber(value)) return;
    const year = Math.floor(value);
    if (year >= 1) addKey(`${prefix}:${year}`);
  };

  if (Array.isArray(raw.claimedDateRewardKeys)) raw.claimedDateRewardKeys.forEach(addKey);
  addLegacyYearKey('birthday', raw.lastBirthdayRewardYear);
  addLegacyYearKey('anniversary', raw.lastAnniversaryRewardYear);

  if (typeof raw.monthlyGiftDateKey === 'string' && raw.monthlyGiftDateKey.trim()) {
    addKey(`monthly_gift:${raw.monthlyGiftDateKey.trim().slice(0, 16)}`);
  }
  if (Array.isArray(raw.claimedFestivalRewardKeys)) {
    raw.claimedFestivalRewardKeys.forEach((value) => {
      if (typeof value === 'string' && value.trim()) addKey(`festival:${value.trim().slice(0, 96)}`);
    });
  }

  return keys;
};

interface NormalizePetOptions {
  preserveExpiredPartnerSchedule?: boolean;
  preserveMiniGameSession?: boolean;
}

export const normalizePet = (value: unknown, now = Date.now(), options: NormalizePetOptions = {}): PetState => {
  if (!value || typeof value !== 'object') return createDefaultPet(now);
  const raw = value as Record<string, unknown>;
  const fallback = createDefaultPet(now, normalizeSaveMetadata(raw.saveMetadata, raw));
  const actualDailyDateKey = getDailyResetDateKey(now);
  const timeGuard = normalizeTimeGuardState(raw.timeGuard, raw, now);
  const currentDailyDateKey = timeGuard.maxDailyDateKey;
  const effectiveNow = getDailyDateKeyTime(currentDailyDateKey, now);
  const ageSeconds = Math.max(0, isNumber(raw.ageSeconds) ? raw.ageSeconds : fallback.ageSeconds);
  const rawInventory = raw.inventory && typeof raw.inventory === 'object' ? (raw.inventory as Record<string, unknown>) : {};
  const inventory: Inventory = {};
  const dailyDiscountDate = normalizeLegacyDailyDateKey(raw.dailyDiscountDate, now) || fallback.dailyDiscountDate;
  const isDailyDiscountCurrent = dailyDiscountDate === currentDailyDateKey;
  const dailyDiscountItemIds = isDailyDiscountCurrent ? normalizeBuiltinItemIdList(raw.dailyDiscountItemIds, 3) : [];
  const dailyDiscountUsedItemIds = isDailyDiscountCurrent ? normalizeBuiltinItemIdList(raw.dailyDiscountUsedItemIds, 3) : [];
  const dailyHeartExchangeDate = normalizeLegacyDailyDateKey(raw.dailyHeartExchangeDate, now) || fallback.dailyHeartExchangeDate;
  const weatherDate = normalizeLegacyDailyDateKey(raw.weatherDate, now) || fallback.weatherDate;
  const weather =
    weatherDate === actualDailyDateKey && typeof raw.weather === 'string' && weatherTypeSet.has(raw.weather as WeatherType)
      ? (raw.weather as WeatherType)
      : getWeatherForDate(now);
  const storedDailyEncounterDateKey = normalizeLegacyDailyDateKey(raw.dailyEncounterDateKey, now);
  const legacyDailyEncounterDateKey = isNumber(raw.lastDailyEncounterAt)
    ? getDailyResetDateKey(raw.lastDailyEncounterAt)
    : currentDailyDateKey;
  const dailyEncounterDateKey = storedDailyEncounterDateKey
    || (legacyDailyEncounterDateKey > currentDailyDateKey ? currentDailyDateKey : legacyDailyEncounterDateKey);
  const rawActionStreak =
    raw.actionStreak && typeof raw.actionStreak === 'object' ? (raw.actionStreak as Record<string, unknown>) : {};
  const claimedRewardIds = Array.isArray(raw.claimedRewardIds)
    ? Array.from(new Set(raw.claimedRewardIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim().slice(0, 64))))
    : [];
  if (raw.hasClaimedHelpGift === true && !claimedRewardIds.includes(helpStarterGiftRewardId)) {
    claimedRewardIds.push(helpStarterGiftRewardId);
  }
  const claimedDateRewardKeys = normalizeClaimedDateRewardKeys(raw);
  const birthday = normalizePetBirthday(raw.birthday);
  const actionStreakKey =
    typeof rawActionStreak.key === 'string' &&
    ['play', 'clean', 'work', 'feed', 'gift', 'touch', 'none'].includes(rawActionStreak.key)
      ? (rawActionStreak.key as ActionStreak['key'])
      : 'none';

  for (const [rawKey, amount] of Object.entries(rawInventory)) {
    const key = rawKey.trim().slice(0, 128);
    if (key && isNumber(amount) && amount > 0) {
      inventory[key] = Math.min(9999, Math.floor(amount));
    }
  }

  const level = clampLevel(isNumber(raw.level) ? raw.level : fallback.level);
  const classicLegacyCoinCurveRefund = getClassicLegacyCoinCurveMigrationRefund(raw.classicEndgame);
  const classicEndgame = normalizeClassicEndgameState(raw.classicEndgame);
  const statCap = getPetStatCap(level);
  const createdAt = isNumber(raw.createdAt) && raw.createdAt >= 0
    ? raw.createdAt
    : ageSeconds > 0
      ? Math.max(0, now - ageSeconds * 1000)
      : now;
  const metDate = normalizePetCalendarDate(raw.metDate) ?? getLocalCalendarDate(createdAt);
  const pendingYearReview = normalizeYearReview(raw.pendingYearReview);
  const latestYearReview = normalizeYearReview(raw.latestYearReview) ?? pendingYearReview;
  const yearlyStats = normalizeYearlyStats(raw.yearlyStats, now, currentDailyDateKey);
  const normalizedName = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : fallback.name;
  const normalizedEnergy = clampPetEnergy({ level, classicEndgame }, isNumber(raw.energy) ? raw.energy : fallback.energy);
  const normalizedHealth = clampHealth(isNumber(raw.health) ? raw.health : fallback.health, statCap);
  const normalizedIsSleeping = Boolean(raw.isSleeping);
  const hasValidSleepSnapshot = normalizedIsSleeping
    && isNumber(raw.sleepStartedAt)
    && raw.sleepStartedAt > 0
    && raw.sleepStartedAt <= now;
  const dailyWish = normalizeDailyWishState(raw.dailyWish, {
    level,
    createdAt,
    name: normalizedName,
    energy: normalizedEnergy,
    health: normalizedHealth,
    isSleeping: normalizedIsSleeping,
  }, now, currentDailyDateKey);
  const hasAchievementState = Boolean(raw.achievements && typeof raw.achievements === 'object' && !Array.isArray(raw.achievements));
  const baseCoins = clampCoins(isNumber(raw.coins) ? raw.coins : fallback.coins);
  const garden = normalizeGardenState(raw.garden, now, currentDailyDateKey);
  const kitchen = normalizeKitchenState(raw.kitchen);
  const achievements = normalizeAchievementState(
    raw.achievements,
    now,
    createdAt,
    yearlyStats,
    !hasAchievementState,
    baseCoins,
    currentDailyDateKey,
  );
  const shouldBackfillLegacySave13Bonus = !claimedRewardIds.includes(legacySave13BonusRewardId);
  if (shouldBackfillLegacySave13Bonus) {
    claimedRewardIds.push(legacySave13BonusRewardId);
  }
  const shouldBackfillStarterGoldenApple = !claimedRewardIds.includes(goldenAppleStarterBackfillRewardId);
  const inventoryWithStarterGoldenApple = shouldBackfillStarterGoldenApple
    ? addInventoryItem(inventory, 'golden_apple', 1)
    : inventory;
  if (shouldBackfillStarterGoldenApple) {
    claimedRewardIds.push(goldenAppleStarterBackfillRewardId);
  }
  const shouldBackfillGoldenApples = !claimedRewardIds.includes(goldenAppleBackfillRewardId);
  const v1GoldenAppleBackfillIds = shouldBackfillGoldenApples
    ? goldenAppleBackfillAchievementIds.filter((id) => achievements.unlockedAtById[id] && (achievements.claimedOneTimeRewardIds.includes(id) || isGoldenAppleAchievementAutoClaimable(id)))
    : [];
  if (shouldBackfillGoldenApples) {
    claimedRewardIds.push(goldenAppleBackfillRewardId);
  }
  const shouldBackfillGoldenApplesV2 = !claimedRewardIds.includes(goldenAppleBackfillV2RewardId);
  const v2GoldenAppleBackfillIds = shouldBackfillGoldenApplesV2
    ? goldenAppleBackfillAchievementIds.filter((id) => {
      if (v1GoldenAppleBackfillIds.includes(id)) return false;
      return achievements.claimedOneTimeRewardIds.includes(id) || Boolean(achievements.unlockedAtById[id]) || isGoldenAppleAchievementCompleteByHistory(id, achievements, createdAt, effectiveNow);
    })
    : [];
  if (shouldBackfillGoldenApplesV2) {
    claimedRewardIds.push(goldenAppleBackfillV2RewardId);
  }
  const goldenAppleBackfillIds = Array.from(new Set([...v1GoldenAppleBackfillIds, ...v2GoldenAppleBackfillIds]));
  const goldenAppleBackfillCoins = goldenAppleBackfillIds.reduce((sum, id) => sum + (goldenAppleBackfillCoinRewards[id] ?? 0), 0);
  const legacySave13AwardCoins = shouldBackfillLegacySave13Bonus ? legacySave13BonusCoins : 0;
  const migrationBonusCoins = goldenAppleBackfillCoins + legacySave13AwardCoins;
  const normalizedInventory = goldenAppleBackfillIds.length > 0
    ? addInventoryItem(inventoryWithStarterGoldenApple, 'golden_apple', goldenAppleBackfillIds.length)
    : inventoryWithStarterGoldenApple;
  const claimedOneTimeRewardIds = goldenAppleBackfillIds.length > 0
    ? Array.from(new Set([...achievements.claimedOneTimeRewardIds, ...goldenAppleBackfillIds]))
    : achievements.claimedOneTimeRewardIds;
  const unlockedAtById = v2GoldenAppleBackfillIds.length > 0
    ? v2GoldenAppleBackfillIds.reduce<AchievementState['unlockedAtById']>((items, id) => ({ ...items, [id]: items[id] ?? now }), achievements.unlockedAtById)
    : achievements.unlockedAtById;
  const normalizedCoins = clampCoins(baseCoins + migrationBonusCoins + classicLegacyCoinCurveRefund);
  const countersWithMigration = migrationBonusCoins > 0 || classicLegacyCoinCurveRefund > 0
    ? {
      ...achievements.counters,
      coinEarnedTotal: clampCount(achievements.counters.coinEarnedTotal + migrationBonusCoins),
      maxCoinsHeld: Math.max(achievements.counters.maxCoinsHeld, normalizedCoins),
    }
    : achievements.counters;
  const gardenHarvestCountsByTreeId = { ...countersWithMigration.gardenHarvestCountsByTreeId };
  garden.slots.forEach((slot) => {
    if (!slot.treeId || slot.harvestsUsed <= 0) return;
    gardenHarvestCountsByTreeId[slot.treeId] = Math.max(gardenHarvestCountsByTreeId[slot.treeId] ?? 0, 1);
  });
  const partnerSchedule = normalizePartnerScheduleState(
    raw.partnerSchedule,
    { level, createdAt },
    now,
    !options.preserveExpiredPartnerSchedule,
    currentDailyDateKey,
  );
  const partnerScheduleClaimCountsByCategory = { ...countersWithMigration.partnerScheduleClaimCountsByCategory };
  const rawAchievementCounters = hasAchievementState ? (raw.achievements as Partial<AchievementState>).counters : undefined;
  const hasRecordedScheduleClaims = isNumber(rawAchievementCounters?.partnerScheduleClaimCount)
    && rawAchievementCounters?.partnerScheduleClaimCountsByCategory
    && typeof rawAchievementCounters.partnerScheduleClaimCountsByCategory === 'object'
    && !Array.isArray(rawAchievementCounters.partnerScheduleClaimCountsByCategory);
  // Skills can now grow through everyday actions. Only infer missing legacy history.
  if (!hasRecordedScheduleClaims) {
    partnerScheduleCategories.forEach((category) => {
      const skill = partnerSchedule.skills[category];
      if (category === 'cooking' && Object.keys(kitchen.made).length > 0) return;
      if (skill.level > 1 || skill.xp > 0) {
        partnerScheduleClaimCountsByCategory[category] = Math.max(partnerScheduleClaimCountsByCategory[category] ?? 0, 1);
      }
    });
  }
  const inferredPartnerScheduleClaimCount = partnerScheduleCategories.reduce(
    (sum, category) => sum + (partnerScheduleClaimCountsByCategory[category] ?? 0),
    0,
  );
  const counters = {
    ...countersWithMigration,
    gardenPlantCount: Math.max(
      countersWithMigration.gardenPlantCount,
      garden.lifetimeHarvestCount > 0 || garden.slots.some((slot) => slot.state !== 'empty') ? 1 : 0,
    ),
    gardenWaterCount: Math.max(countersWithMigration.gardenWaterCount, garden.dailyWaterCount),
    gardenHarvestCountsByTreeId,
    partnerScheduleClaimCount: Math.max(countersWithMigration.partnerScheduleClaimCount, inferredPartnerScheduleClaimCount),
    partnerScheduleClaimCountsByCategory,
  };
  const normalizedAchievements = { ...achievements, unlockedAtById, claimedOneTimeRewardIds, counters };

  return {
    name: normalizedName,
    saveMetadata: fallback.saveMetadata,
    level,
    hunger: clampStat(isNumber(raw.hunger) ? raw.hunger : fallback.hunger, statCap),
    mood: clampStat(isNumber(raw.mood) ? raw.mood : fallback.mood, statCap),
    cleanliness: clampStat(isNumber(raw.cleanliness) ? raw.cleanliness : fallback.cleanliness, statCap),
    energy: normalizedEnergy,
    health: normalizedHealth,
    createdAt,
    metDate,
    ageSeconds,
    lastUpdatedAt: isNumber(raw.lastUpdatedAt) ? raw.lastUpdatedAt : now,
    isSleeping: normalizedIsSleeping,
    recentEvent: classicLegacyCoinCurveRefund > 0
      ? t('pet.classicEndgame.legacyCurveRefund', { coins: classicLegacyCoinCurveRefund })
      : typeof raw.recentEvent === 'string' ? raw.recentEvent : t('pet.default.welcomeBack'),
    recentActivity: isRecentActivity(raw.recentActivity) ? raw.recentActivity : 'idle',
    recentActivityUntil: isNumber(raw.recentActivityUntil) ? raw.recentActivityUntil : 0,
    coins: normalizedCoins,
    hearts: clampCount(isNumber(raw.hearts) ? raw.hearts : fallback.hearts),
    inventory: normalizedInventory,
    kitchen,
    miniGames: normalizeMiniGameState(raw.miniGames, normalizedInventory, normalizedAchievements.counters.itemUseCountsById, { preserveSession: options.preserveMiniGameSession, level }),
    companionMemories: normalizeCompanionMemories(raw.companionMemories),
    lastDailyRewardAt: isNumber(raw.lastDailyRewardAt) ? raw.lastDailyRewardAt : now,
    lastDailyEncounterAt: isNumber(raw.lastDailyEncounterAt)
      ? raw.lastDailyEncounterAt
      : isNumber(raw.lastDailyRewardAt)
        ? raw.lastDailyRewardAt
        : now,
    dailyEncounterDateKey,
    neighborGiftDateKey: currentDailyDateKey,
    neighborGiftCount: normalizeLegacyDailyDateKey(raw.neighborGiftDateKey, now) === currentDailyDateKey
      ? Math.min(neighborGiftDailyLimit, clampCount(isNumber(raw.neighborGiftCount) ? raw.neighborGiftCount : 0))
      : 0,
    dailyBiscuitClaimDate: currentDailyDateKey,
    dailyBiscuitClaims: normalizeLegacyDailyDateKey(raw.dailyBiscuitClaimDate, now) === currentDailyDateKey
      ? Math.min(dailyBiscuitClaimLimit, clampCount(isNumber(raw.dailyBiscuitClaims) ? raw.dailyBiscuitClaims : 0))
      : 0,
    dailyDiscountDate,
    dailyDiscountItemIds,
    dailyDiscountUsedItemIds,
    dailyDiscountUsed: isDailyDiscountCurrent ? Boolean(raw.dailyDiscountUsed) || dailyDiscountUsedItemIds.length > 0 : false,
    dailyHeartExchangeDate,
    dailyHeartExchangeCount:
      dailyHeartExchangeDate === currentDailyDateKey
        ? Math.min(dailyHeartExchangeLimit, clampCount(isNumber(raw.dailyHeartExchangeCount) ? raw.dailyHeartExchangeCount : 0))
        : 0,
    weatherDate: actualDailyDateKey,
    weather,
    lastEnergyRecoveryAt: isNumber(raw.lastEnergyRecoveryAt) ? raw.lastEnergyRecoveryAt : now,
    sleepStartedAt: normalizedIsSleeping ? hasValidSleepSnapshot ? raw.sleepStartedAt as number : now : 0,
    sleepStartMood: normalizedIsSleeping
      ? clampStat(hasValidSleepSnapshot && isNumber(raw.sleepStartMood) ? raw.sleepStartMood : isNumber(raw.mood) ? raw.mood : fallback.mood, statCap)
      : 0,
    sleepStartHunger: normalizedIsSleeping
      ? clampStat(hasValidSleepSnapshot && isNumber(raw.sleepStartHunger) ? raw.sleepStartHunger : isNumber(raw.hunger) ? raw.hunger : fallback.hunger, statCap)
      : 0,
    sleepStartCleanliness: normalizedIsSleeping
      ? clampStat(hasValidSleepSnapshot && isNumber(raw.sleepStartCleanliness) ? raw.sleepStartCleanliness : isNumber(raw.cleanliness) ? raw.cleanliness : fallback.cleanliness, statCap)
      : 0,
    lowCleanlinessSleepConfirmCount: Math.min(lowCleanlinessSleepConfirmClicks - 1, clampCount(isNumber(raw.lowCleanlinessSleepConfirmCount) ? raw.lowCleanlinessSleepConfirmCount : 0)),
    lastDreamTalkAt: normalizedIsSleeping && isNumber(raw.lastDreamTalkAt) ? raw.lastDreamTalkAt : 0,
    actionStreak: {
      key: actionStreakKey,
      count: clampCount(isNumber(rawActionStreak.count) ? rawActionStreak.count : 0),
      windowStartedAt: isNumber(rawActionStreak.windowStartedAt) ? rawActionStreak.windowStartedAt : now,
      lastAt: isNumber(rawActionStreak.lastAt) ? rawActionStreak.lastAt : 0,
    },
    lastInteractionAt: isNumber(raw.lastInteractionAt)
      ? raw.lastInteractionAt
      : isNumber(raw.lastUpdatedAt)
        ? raw.lastUpdatedAt
        : now,
    lastPetInteractionAt: isNumber(raw.lastPetInteractionAt) ? raw.lastPetInteractionAt : 0,
    pomodoro: normalizePomodoroState(raw.pomodoro, now, currentDailyDateKey),
    hasOpenedHelp: Boolean(raw.hasOpenedHelp),
    hasSeenCommonDreamsUnlock: Boolean(raw.hasSeenCommonDreamsUnlock),
    suppressGoldenAppleUseConfirm: Boolean(raw.suppressGoldenAppleUseConfirm),
    claimedRewardIds,
    birthday,
    claimedDateRewardKeys,
    dailyLoginRewardDateKey: normalizeLegacyDailyDateKey(raw.dailyLoginRewardDateKey, now) || undefined,
    yearlyStats,
    pendingYearReview,
    latestYearReview,
    lastYearReviewYear: isNumber(raw.lastYearReviewYear) ? Math.floor(raw.lastYearReviewYear) : undefined,
    dailyWish,
    returnWelcome: normalizeReturnWelcomeState(raw.returnWelcome),
    achievements: normalizedAchievements,
    lastCleanActionAt: isNumber(raw.lastCleanActionAt) ? Math.max(0, Math.floor(raw.lastCleanActionAt)) : 0,
    garden,
    boostCards: normalizeBoostCardState(raw.boostCards, now, currentDailyDateKey),
    partnerSchedule,
    goldenAppleGacha: normalizeGoldenAppleGachaState(raw.goldenAppleGacha, createdAt, now, currentDailyDateKey),
    classicEndgame,
    timeGuard,
  };
};



