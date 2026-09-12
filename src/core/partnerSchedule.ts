import { t } from '../i18n';
import { getAchievementEffects, incrementAchievementPartnerScheduleClaim, recordEarnedCoins } from './achievements';
import { getBoostCardEffects } from './boostCards';
import { getClassicTrophyEffects } from './classicTrophies';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem } from './items';
import { activityText } from './kitchenRecipes';
import { resolveDailyGachaTicket } from './goldenAppleGacha';
import {
  getPartnerScheduleCategoryEffects,
  getPartnerScheduleGlobalCoinBonusPercent,
  getPartnerScheduleUnlockedOfferCount,
  partnerScheduleCategories,
  partnerScheduleDailyCompletionLimit,
} from './partnerScheduleEffects';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetStat, getPetStatThreshold, scalePetStatDelta } from './petStats';
import { getWorkSeasonCoinBonus } from './season';
import type {
  ActivePartnerSchedule,
  BuiltinItemId,
  NeighborReference,
  PartnerScheduleCategory,
  PartnerScheduleOffer,
  PartnerScheduleResult,
  PartnerScheduleRewardChoice,
  PartnerScheduleSize,
  PartnerScheduleSkill,
  PartnerScheduleState,
  PetState,
  RecentActivity,
} from './petTypes';
import { hashString, isNumber } from './utils';

export const partnerScheduleSchemaVersion = 6;
export const partnerScheduleUnlockLevel = 3;
export const partnerScheduleMaxSkillLevel = 10;
export const partnerScheduleNeighborChancePercent = 30;

const partnerScheduleNeighborSchemaVersion = 4;
const validTrophyRewardMultipliers = new Set([1, 1.25, 1.5, 2, 2.5]);

const minuteMs = 60 * 1000;
const maxScheduleDurationMs = 24 * 60 * 60 * 1000;

export interface PartnerScheduleDefinition {
  id: string;
  category: PartnerScheduleCategory;
  size: PartnerScheduleSize;
  activity: RecentActivity;
  durationMinutes: number;
  energyCost: number;
  hungerCost: number;
  moodCost: number;
  requiredHealth: number;
}

const categoryActivities: Record<PartnerScheduleCategory, RecentActivity> = {
  study: 'reading_books',
  cooking: 'work_food',
  garden: 'work_plants',
  exercise: 'workout',
};

const sizeRules: Record<PartnerScheduleSize, Omit<PartnerScheduleDefinition, 'id' | 'category' | 'activity'>> = {
  short: {
    size: 'short',
    durationMinutes: 20,
    energyCost: 12,
    hungerCost: 4,
    moodCost: 2,
    requiredHealth: 40,
  },
  standard: {
    size: 'standard',
    durationMinutes: 60,
    energyCost: 30,
    hungerCost: 10,
    moodCost: 5,
    requiredHealth: 45,
  },
  long: {
    size: 'long',
    durationMinutes: 120,
    energyCost: 55,
    hungerCost: 18,
    moodCost: 8,
    requiredHealth: 55,
  },
};

const templateIds: Record<PartnerScheduleCategory, Record<PartnerScheduleSize, string>> = {
  study: { short: 'study_notes', standard: 'study_archive', long: 'study_research' },
  cooking: { short: 'cooking_snack', standard: 'cooking_lunch', long: 'cooking_feast' },
  garden: { short: 'garden_seedlings', standard: 'garden_orchard', long: 'garden_field_day' },
  exercise: { short: 'exercise_walk', standard: 'exercise_training', long: 'exercise_challenge' },
};

const categories = partnerScheduleCategories;
const sizes: readonly PartnerScheduleSize[] = ['short', 'standard', 'long'];
const categorySet = new Set<PartnerScheduleCategory>(categories);
const sizeSet = new Set<PartnerScheduleSize>(sizes);

const legacyFocusMinutes: Record<PartnerScheduleSize, number> = {
  short: 25,
  standard: 50,
  long: 100,
};

const sizeCoinMultipliers: Record<PartnerScheduleSize, number> = {
  short: 1.6,
  standard: 4.2,
  long: 8.5,
};

const sizeSkillXp: Record<PartnerScheduleSize, number> = {
  short: 10,
  standard: 23,
  long: 50,
};

export const partnerScheduleDefinitions: readonly PartnerScheduleDefinition[] = categories.flatMap((category) =>
  sizes.map((size) => ({
    id: templateIds[category][size],
    category,
    activity: categoryActivities[category],
    ...sizeRules[size],
  })),
);

const definitionMap = new Map(partnerScheduleDefinitions.map((definition) => [definition.id, definition]));

export const getPartnerScheduleDefinition = (id: string) => definitionMap.get(id);

export const getPartnerScheduleActivity = (category: PartnerScheduleCategory) => categoryActivities[category];

const defaultSkill = (): PartnerScheduleSkill => ({ level: 1, xp: 0, masterCompletions: 0 });

const defaultSkills = (): PartnerScheduleState['skills'] => ({
  study: defaultSkill(),
  cooking: defaultSkill(),
  garden: defaultSkill(),
  exercise: defaultSkill(),
});

const getBoardSizes = (level: number, offerCount: number): PartnerScheduleSize[] => {
  const baseSizes: PartnerScheduleSize[] = level >= 8
    ? ['short', 'standard', 'long']
    : level >= 5
      ? ['short', 'standard', 'standard']
      : ['short', 'short', 'standard'];
  if (offerCount >= 4) baseSizes.push('standard');
  if (offerCount >= 5) baseSizes.push('short');
  return baseSizes;
};

const generateOffers = (level: number, createdAt: number, dateKey: string, offerCount: number): PartnerScheduleOffer[] => {
  if (level < partnerScheduleUnlockLevel) return [];
  const usedCategories = new Set<PartnerScheduleCategory>();
  return getBoardSizes(level, offerCount).map((size, index) => {
    const available = categories.filter((category) => !usedCategories.has(category));
    const pool = available.length > 0 ? available : [...categories];
    const category = pool[hashString(`${dateKey}:${Math.floor(createdAt)}:${level}:${index}`) % pool.length];
    usedCategories.add(category);
    const templateId = templateIds[category][size];
    return {
      id: `${dateKey}:${index}:${templateId}`,
      templateId,
      dateKey,
    };
  });
};

const getGeneratedNeighborOfferId = (
  offers: readonly PartnerScheduleOffer[],
  createdAt: number,
  dateKey: string,
) => {
  if (offers.length === 0) return undefined;
  const seed = `${dateKey}:${Math.floor(createdAt)}:neighbor-schedule`;
  if (hashString(seed) % 100 >= partnerScheduleNeighborChancePercent) return undefined;
  return offers[hashString(`${seed}:offer`) % offers.length]?.id;
};

type PartnerSchedulePetSnapshot = Pick<PetState, 'level' | 'createdAt'>;

export const defaultPartnerScheduleState = (
  pet: PartnerSchedulePetSnapshot,
  now = Date.now(),
  boardDateKey = getDailyResetDateKey(now),
): PartnerScheduleState => {
  const boardOfferCount = pet.level < partnerScheduleUnlockLevel ? 0 : 3;
  const offers = generateOffers(pet.level, pet.createdAt, boardDateKey, boardOfferCount);
  return {
    schemaVersion: partnerScheduleSchemaVersion,
    boardDateKey,
    boardOfferCount,
    offers,
    neighborOfferId: getGeneratedNeighborOfferId(offers, pet.createdAt, boardDateKey),
    completedOfferIds: [],
    skills: defaultSkills(),
  };
};

const normalizeSkill = (value: unknown): PartnerScheduleSkill => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultSkill();
  const raw = value as Record<string, unknown>;
  const level = Math.max(1, Math.min(partnerScheduleMaxSkillLevel, clampCount(isNumber(raw.level) ? raw.level : 1)));
  const xp = level >= partnerScheduleMaxSkillLevel ? 0 : Math.min(9999, clampCount(isNumber(raw.xp) ? raw.xp : 0));
  const masterCompletions = level >= partnerScheduleMaxSkillLevel
    ? Math.min(999999, clampCount(isNumber(raw.masterCompletions) ? raw.masterCompletions : 0))
    : 0;
  return { level, xp, masterCompletions };
};

const normalizeOffers = (value: unknown, dateKey: string, limit: number): PartnerScheduleOffer[] => {
  if (!Array.isArray(value)) return [];
  const offers: PartnerScheduleOffer[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.templateId !== 'string') return;
    if (!definitionMap.has(raw.templateId) || offers.some((offer) => offer.id === raw.id)) return;
    offers.push({ id: raw.id.slice(0, 128), templateId: raw.templateId, dateKey });
  });
  return offers.slice(0, limit);
};

const normalizeNeighborReference = (value: unknown): NeighborReference | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.kind === 'generic') return { kind: 'generic' };
  if (raw.kind !== 'mod' || typeof raw.modId !== 'string') return undefined;
  const modId = raw.modId.trim();
  return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(modId) ? { kind: 'mod', modId } : undefined;
};

const getNormalizedCoinReward = (rawReward: unknown, level: number, size: PartnerScheduleSize, now: number) => {
  if (isNumber(rawReward)) return Math.min(999999, clampCount(rawReward));
  const workBase = 24 + Math.max(0, level - 1) + getWorkSeasonCoinBonus(now);
  return Math.max(1, Math.round(workBase * sizeCoinMultipliers[size] * 1.15));
};

const getNormalizedTrophyRewardMultiplier = (value: unknown) =>
  isNumber(value) && validTrophyRewardMultipliers.has(value) ? value : 1;

const normalizeActive = (value: unknown, level: number, now: number, allowNeighbor = false, shortenLegacyDuration = false): ActivePartnerSchedule | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const definition = typeof raw.templateId === 'string' ? definitionMap.get(raw.templateId) : undefined;
  if (!definition || typeof raw.offerId !== 'string') return undefined;
  const durationMs = definition.durationMinutes * minuteMs;
  const savedStartedAt = Math.max(0, Math.min(now, isNumber(raw.startedAt) ? Math.floor(raw.startedAt) : now));
  const isLegacyTogether = raw.mode === 'together';
  let startedAt = savedStartedAt;
  let endsAt: number;

  if (isLegacyTogether) {
    const requiredFocusMs = isNumber(raw.requiredFocusMs) && raw.requiredFocusMs > 0
      ? raw.requiredFocusMs
      : legacyFocusMinutes[definition.size] * minuteMs;
    const focusProgressMs = Math.max(0, isNumber(raw.focusProgressMs) ? raw.focusProgressMs : 0);
    const progressRatio = Math.min(1, focusProgressMs / requiredFocusMs);
    const migratedProgressMs = Math.floor(durationMs * progressRatio);
    startedAt = now;
    endsAt = now + Math.max(0, durationMs - migratedProgressMs);
  } else {
    const fallbackEndsAt = savedStartedAt + durationMs;
    endsAt = Math.max(
      savedStartedAt,
      Math.min(savedStartedAt + maxScheduleDurationMs, isNumber(raw.endsAt) ? Math.floor(raw.endsAt) : fallbackEndsAt),
    );
    if (shortenLegacyDuration && isNumber(raw.endsAt) && endsAt > now) {
      // Keep time already spent; schema v6 makes this a one-time migration.
      const oldMinutes = { short: 45, standard: 120, long: 240 }[definition.size];
      endsAt = savedStartedAt + Math.round((endsAt - savedStartedAt) * definition.durationMinutes / oldMinutes);
    }
  }

  return {
    offerId: raw.offerId.slice(0, 128),
    templateId: definition.id,
    category: definition.category,
    size: definition.size,
    startedAt,
    endsAt,
    coinReward: getNormalizedCoinReward(raw.coinReward, level, definition.size, now),
    skillXp: Math.min(9999, clampCount(isNumber(raw.skillXp) ? raw.skillXp : sizeSkillXp[definition.size])),
    trophyRewardMultiplier: getNormalizedTrophyRewardMultiplier(raw.trophyRewardMultiplier),
    grantsMasterCompletion: raw.grantsMasterCompletion === true,
    neighbor: allowNeighbor ? normalizeNeighborReference(raw.neighbor) : undefined,
  };
};

const normalizeResult = (value: unknown, level: number, now: number, allowNeighbor = false): PartnerScheduleResult | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const definition = typeof raw.templateId === 'string' ? definitionMap.get(raw.templateId) : undefined;
  if (!definition || typeof raw.offerId !== 'string') return undefined;
  return {
    offerId: raw.offerId.slice(0, 128),
    templateId: definition.id,
    category: definition.category,
    size: definition.size,
    completedAt: Math.max(0, Math.min(now, isNumber(raw.completedAt) ? Math.floor(raw.completedAt) : now)),
    coinReward: getNormalizedCoinReward(raw.coinReward, level, definition.size, now),
    skillXp: Math.min(9999, clampCount(isNumber(raw.skillXp) ? raw.skillXp : sizeSkillXp[definition.size])),
    trophyRewardMultiplier: getNormalizedTrophyRewardMultiplier(raw.trophyRewardMultiplier),
    grantsMasterCompletion: raw.grantsMasterCompletion === true,
    neighbor: allowNeighbor ? normalizeNeighborReference(raw.neighbor) : undefined,
  };
};

export const normalizePartnerScheduleState = (
  value: unknown,
  pet: PartnerSchedulePetSnapshot,
  now = Date.now(),
  settleExpired = true,
  effectiveDateKey = getDailyResetDateKey(now),
): PartnerScheduleState => {
  const fallback = defaultPartnerScheduleState(pet, now, effectiveDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const sourceSchemaVersion = isNumber(raw.schemaVersion) ? Math.floor(raw.schemaVersion) : 0;
  const rawSkills = raw.skills && typeof raw.skills === 'object' && !Array.isArray(raw.skills)
    ? raw.skills as Record<string, unknown>
    : {};
  const skills = defaultSkills();
  categories.forEach((category) => {
    skills[category] = normalizeSkill(rawSkills[category]);
  });
  const boardDateKey = effectiveDateKey;
  const savedDateKey = normalizeLegacyDailyDateKey(raw.boardDateKey, now);
  const rawOffersLength = Array.isArray(raw.offers) ? raw.offers.length : 0;
  const savedBoardOfferCount = Math.max(3, Math.min(5, clampCount(
    isNumber(raw.boardOfferCount) ? raw.boardOfferCount : rawOffersLength,
  )));
  const boardOfferCount = pet.level < partnerScheduleUnlockLevel
    ? 0
    : savedDateKey === boardDateKey
      ? savedBoardOfferCount
      : getPartnerScheduleUnlockedOfferCount(skills);
  const savedOffers = savedDateKey === boardDateKey ? normalizeOffers(raw.offers, boardDateKey, boardOfferCount) : [];
  const offers = pet.level < partnerScheduleUnlockLevel
    ? []
    : savedOffers.length === boardOfferCount
      ? savedOffers
      : generateOffers(pet.level, pet.createdAt, boardDateKey, boardOfferCount);
  const savedNeighborOfferId = sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion
    && typeof raw.neighborOfferId === 'string'
    && offers.some((offer) => offer.id === raw.neighborOfferId)
      ? raw.neighborOfferId
      : undefined;
  const neighborOfferId = savedDateKey === boardDateKey
    ? savedNeighborOfferId
    : getGeneratedNeighborOfferId(offers, pet.createdAt, boardDateKey);
  const completedOfferIds = savedDateKey === boardDateKey && Array.isArray(raw.completedOfferIds)
    ? Array.from(new Set(raw.completedOfferIds.filter((id): id is string => typeof id === 'string').map((id) => id.slice(0, 128)))).slice(0, partnerScheduleDailyCompletionLimit)
    : [];
  let pendingResult = normalizeResult(raw.pendingResult, pet.level, now, sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion);
  let active = pendingResult ? undefined : normalizeActive(raw.active, pet.level, now, sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion, sourceSchemaVersion < 6);
  if (settleExpired && active && active.endsAt <= now) {
    pendingResult = {
      offerId: active.offerId,
      templateId: active.templateId,
      category: active.category,
      size: active.size,
      completedAt: active.endsAt,
      coinReward: active.coinReward,
      skillXp: active.skillXp,
      trophyRewardMultiplier: active.trophyRewardMultiplier,
      grantsMasterCompletion: active.grantsMasterCompletion,
      neighbor: active.neighbor,
    };
    active = undefined;
  }
  return {
    schemaVersion: partnerScheduleSchemaVersion,
    boardDateKey,
    boardOfferCount,
    offers,
    neighborOfferId,
    completedOfferIds,
    active,
    pendingResult,
    skills,
  };
};

const refreshBoard = (pet: PetState, now: number): PetState => {
  const dateKey = getEffectiveDailyDateKey(pet, now);
  const isCurrentBoard = pet.partnerSchedule.boardDateKey === dateKey;
  const hasValidCurrentBoard = pet.level < partnerScheduleUnlockLevel
    ? pet.partnerSchedule.boardOfferCount === 0 && pet.partnerSchedule.offers.length === 0
    : pet.partnerSchedule.boardOfferCount >= 3
      && pet.partnerSchedule.boardOfferCount <= 5
      && pet.partnerSchedule.offers.length === pet.partnerSchedule.boardOfferCount;
  if (isCurrentBoard && hasValidCurrentBoard) return pet;
  const boardOfferCount = pet.level < partnerScheduleUnlockLevel
    ? 0
    : isCurrentBoard && pet.partnerSchedule.boardOfferCount >= 3
      ? pet.partnerSchedule.boardOfferCount
      : getPartnerScheduleUnlockedOfferCount(pet.partnerSchedule.skills);
  const offers = generateOffers(pet.level, pet.createdAt, dateKey, boardOfferCount);
  return {
    ...pet,
    partnerSchedule: {
      ...pet.partnerSchedule,
      boardDateKey: dateKey,
      boardOfferCount,
      offers,
      neighborOfferId: getGeneratedNeighborOfferId(offers, pet.createdAt, dateKey),
      completedOfferIds: [],
    },
  };
};

const finishActiveSchedule = (pet: PetState, completedAt: number): PetState => {
  const active = pet.partnerSchedule.active;
  if (!active || pet.partnerSchedule.pendingResult) return pet;
  return {
    ...pet,
    recentActivity: 'idle',
    recentActivityUntil: 0,
    recentEvent: t('pet.partnerSchedule.completed', { name: pet.name }),
    partnerSchedule: {
      ...pet.partnerSchedule,
      active: undefined,
      pendingResult: {
        offerId: active.offerId,
        templateId: active.templateId,
        category: active.category,
        size: active.size,
        completedAt,
        coinReward: active.coinReward,
        skillXp: active.skillXp,
        trophyRewardMultiplier: active.trophyRewardMultiplier,
        grantsMasterCompletion: active.grantsMasterCompletion,
        neighbor: active.neighbor,
      },
    },
  };
};

export const advancePartnerSchedule = (pet: PetState, now = Date.now()): PetState => {
  const current = refreshBoard(pet, now);
  const active = current.partnerSchedule.active;
  if (!active) return current;
  if (now >= active.endsAt) {
    return finishActiveSchedule(current, active.endsAt);
  }
  return current;
};

export const getPartnerScheduleNeighborOfferId = (
  pet: Pick<PetState, 'partnerSchedule'>,
) => pet.partnerSchedule.neighborOfferId;

export const getPartnerScheduleCoinReward = (
  pet: PetState,
  size: PartnerScheduleSize,
  now = Date.now(),
) => {
  const workBase = 24 + Math.max(0, pet.level - 1) + getWorkSeasonCoinBonus(now);
  return Math.max(1, Math.round(workBase * sizeCoinMultipliers[size] * 1.15));
};

export const getPartnerScheduleSkillXpReward = (size: PartnerScheduleSize) => sizeSkillXp[size];

export interface PartnerScheduleOfferPreview {
  durationMs: number;
  energyCost: number;
  hungerCost: number;
  moodCost: number;
  coinReward: number;
  skillXp: number;
  trophyRewardMultiplier: number;
  grantsMasterCompletion: boolean;
  storedCoinReward: number;
  storedSkillXp: number;
}

export const getPartnerScheduleOfferPreview = (
  pet: PetState,
  definition: PartnerScheduleDefinition,
  now = Date.now(),
): PartnerScheduleOfferPreview => {
  const skill = pet.partnerSchedule.skills[definition.category];
  const effects = getPartnerScheduleCategoryEffects(skill);
  const globalCoinBonusPercent = getPartnerScheduleGlobalCoinBonusPercent(pet.partnerSchedule.skills);
  const boostCardCoinBonusPercent = getBoostCardEffects(pet, now).partnerScheduleCoinBonusPercent;
  const trophyRewardMultiplier = getClassicTrophyEffects(pet).partnerScheduleRewardMultiplier;
  const baseCoinReward = getPartnerScheduleCoinReward(pet, definition.size, now);
  const storedCoinReward = Math.max(1, Math.round(
    baseCoinReward * (1 + (globalCoinBonusPercent + effects.coinBonusPercent + boostCardCoinBonusPercent) / 100),
  ));
  const storedSkillXp = effects.grantsMasterCompletion
    ? 0
    : Math.max(1, Math.round(getPartnerScheduleSkillXpReward(definition.size) * effects.skillXpMultiplier));
  return {
    durationMs: Math.max(minuteMs, Math.round(definition.durationMinutes * minuteMs * effects.durationMultiplier)),
    energyCost: Math.max(1, Math.round(definition.energyCost * effects.energyCostMultiplier)),
    hungerCost: scalePetStatDelta(pet, Math.max(1, Math.round(definition.hungerCost * effects.hungerMoodCostMultiplier))),
    moodCost: scalePetStatDelta(pet, Math.max(1, Math.round(definition.moodCost * effects.hungerMoodCostMultiplier))),
    coinReward: Math.max(1, Math.round(storedCoinReward * trophyRewardMultiplier)),
    skillXp: storedSkillXp > 0 ? Math.max(1, Math.round(storedSkillXp * trophyRewardMultiplier)) : 0,
    trophyRewardMultiplier,
    grantsMasterCompletion: effects.grantsMasterCompletion,
    storedCoinReward,
    storedSkillXp,
  };
};

export interface PartnerScheduleStartCheck {
  canStart: boolean;
  reason?: 'locked' | 'busy' | 'pending' | 'completed' | 'daily_limit' | 'sleeping' | 'energy' | 'hunger' | 'mood' | 'health' | 'missing';
}

export const getPartnerScheduleStartCheck = (
  pet: PetState,
  offerId: string,
  now = Date.now(),
): PartnerScheduleStartCheck => {
  const current = advancePartnerSchedule(pet, now);
  if (current.level < partnerScheduleUnlockLevel) return { canStart: false, reason: 'locked' };
  if (current.partnerSchedule.pendingResult) return { canStart: false, reason: 'pending' };
  if (current.partnerSchedule.active) return { canStart: false, reason: 'busy' };
  if (current.partnerSchedule.completedOfferIds.includes(offerId)) return { canStart: false, reason: 'completed' };
  if (current.partnerSchedule.completedOfferIds.length >= partnerScheduleDailyCompletionLimit) {
    return { canStart: false, reason: 'daily_limit' };
  }
  if (current.isSleeping) return { canStart: false, reason: 'sleeping' };
  const offer = current.partnerSchedule.offers.find((item) => item.id === offerId);
  const definition = offer ? definitionMap.get(offer.templateId) : undefined;
  if (!offer || !definition) return { canStart: false, reason: 'missing' };
  const preview = getPartnerScheduleOfferPreview(current, definition, now);
  if (current.energy < preview.energyCost) return { canStart: false, reason: 'energy' };
  if (current.hunger < preview.hungerCost) return { canStart: false, reason: 'hunger' };
  if (current.mood < preview.moodCost) return { canStart: false, reason: 'mood' };
  if (current.health < getPetStatThreshold(current, definition.requiredHealth)) return { canStart: false, reason: 'health' };
  return { canStart: true };
};

export const startPartnerSchedule = (
  pet: PetState,
  offerId: string,
  now = Date.now(),
  neighbor?: NeighborReference,
): PetState => {
  const current = advancePartnerSchedule(pet, now);
  const check = getPartnerScheduleStartCheck(current, offerId, now);
  if (!check.canStart) {
    return { ...current, recentEvent: t(`pet.partnerSchedule.startBlocked.${check.reason ?? 'missing'}`, { name: current.name }) };
  }
  const offer = current.partnerSchedule.offers.find((item) => item.id === offerId);
  const definition = offer ? definitionMap.get(offer.templateId) : undefined;
  if (!offer || !definition) return current;
  const preview = getPartnerScheduleOfferPreview(current, definition, now);
  const resolvedNeighbor = current.partnerSchedule.neighborOfferId === offer.id
    ? normalizeNeighborReference(neighbor) ?? { kind: 'generic' as const }
    : undefined;
  const active: ActivePartnerSchedule = {
    offerId: offer.id,
    templateId: definition.id,
    category: definition.category,
    size: definition.size,
    startedAt: now,
    endsAt: now + preview.durationMs,
    coinReward: preview.storedCoinReward,
    skillXp: preview.storedSkillXp,
    trophyRewardMultiplier: preview.trophyRewardMultiplier,
    grantsMasterCompletion: preview.grantsMasterCompletion,
    neighbor: resolvedNeighbor,
  };
  return {
    ...current,
    energy: clampPetEnergy(current, current.energy - preview.energyCost),
    hunger: clampPetStat(current, current.hunger - preview.hungerCost),
    mood: clampPetStat(current, current.mood - preview.moodCost),
    recentActivity: definition.activity,
    recentActivityUntil: active.endsAt,
    recentEvent: t('pet.partnerSchedule.started', { name: current.name }),
    lastInteractionAt: now,
    lastEnergyRecoveryAt: now,
    partnerSchedule: { ...current.partnerSchedule, active },
  };
};

export const isPartnerSchedulePetBusy = (pet: Pick<PetState, 'partnerSchedule'>) =>
  Boolean(pet.partnerSchedule.active);

export const cancelPartnerSchedule = (pet: PetState, now = Date.now()): PetState => {
  const current = advancePartnerSchedule(pet, now);
  if (!current.partnerSchedule.active) return current;
  return {
    ...current,
    recentActivity: 'idle',
    recentActivityUntil: 0,
    recentEvent: t('pet.partnerSchedule.cancelled', { name: current.name }),
    lastInteractionAt: now,
    partnerSchedule: { ...current.partnerSchedule, active: undefined },
  };
};

const partnerScheduleSkillXpNeededByLevel = [40, 60, 90, 130, 180, 260, 360, 480, 620] as const;

export const getPartnerScheduleSkillXpNeeded = (level: number) =>
  level >= partnerScheduleMaxSkillLevel ? 0 : partnerScheduleSkillXpNeededByLevel[Math.max(1, Math.floor(level)) - 1] ?? 0;

export const addSkillXp = (skill: PartnerScheduleSkill, amount: number): PartnerScheduleSkill => {
  let level = skill.level;
  let xp = skill.xp + Math.max(0, amount);
  while (level < partnerScheduleMaxSkillLevel) {
    const needed = getPartnerScheduleSkillXpNeeded(level);
    if (xp < needed) break;
    xp -= needed;
    level += 1;
  }
  return { ...skill, level, xp: level >= partnerScheduleMaxSkillLevel ? 0 : xp };
};

export const practiceSkillXp = 1;
export const formatPracticeSkillXp = (category: PartnerScheduleCategory, amount = practiceSkillXp) => {
  const skill = t(`ui.partnerSchedule.categories.${category}`);
  return activityText(`${skill}经验 +${amount}`, `${skill} XP +${amount}`);
};
export const grantPracticeSkillXp = (pet: PetState, category: PartnerScheduleCategory): PetState => {
  const skill = pet.partnerSchedule.skills[category];
  if (skill.level >= partnerScheduleMaxSkillLevel) return pet;
  return {
    ...pet,
    partnerSchedule: {
      ...pet.partnerSchedule,
      skills: { ...pet.partnerSchedule.skills, [category]: addSkillXp(skill, practiceSkillXp) },
    },
    recentEvent: `${pet.recentEvent} ${formatPracticeSkillXp(category)}`,
  };
};

export interface PartnerScheduleClaimPreview {
  coins: number;
  skillXp: number;
  itemId?: BuiltinItemId;
  itemAmount?: number;
  energy?: number;
  health?: number;
  mood?: number;
}

export const getPartnerScheduleClaimPreview = (
  result: PartnerScheduleResult,
  choice: PartnerScheduleRewardChoice,
  extraRewardCopies = 0,
  pet?: PetState,
): PartnerScheduleClaimPreview => {
  const rewardMultiplier = result.trophyRewardMultiplier * (1 + Math.max(0, Math.floor(extraRewardCopies)));
  const scaleReward = (value: number) => value > 0 ? Math.max(1, Math.round(value * rewardMultiplier)) : 0;
  if (choice === 'coins' || result.size === 'short') {
    return { coins: scaleReward(result.coinReward), skillXp: scaleReward(result.skillXp) };
  }
  const baseCoins = result.coinReward * 0.8;
  const baseSkillXp = result.skillXp * 1.5;
  const base: PartnerScheduleClaimPreview = { coins: scaleReward(baseCoins), skillXp: scaleReward(baseSkillXp) };
  const amount = result.size === 'long' ? 2 : 1;
  if (result.category === 'study') return { ...base, skillXp: scaleReward(result.skillXp * 2), mood: pet ? scalePetStatDelta(pet, scaleReward(8 * amount)) : scaleReward(8 * amount) };
  if (result.category === 'cooking') return { ...base, itemId: 'bento', itemAmount: scaleReward(amount) };
  if (result.category === 'garden') return { ...base, itemId: 'fruit_tree_sapling', itemAmount: scaleReward(amount) };
  return { ...base, energy: scaleReward(10 * amount), health: pet ? scalePetStatDelta(pet, scaleReward(6 * amount)) : scaleReward(6 * amount) };
};

export const getPartnerScheduleExtraRewardCopies = (
  pet: PetState,
  result: PartnerScheduleResult,
) => {
  const chancePercent = Math.max(0, getAchievementEffects(pet).partnerScheduleExtraRewardChancePercent);
  const guaranteedCopies = Math.floor(chancePercent / 100);
  const remainderChance = chancePercent % 100;
  if (remainderChance <= 0) return guaranteedCopies;
  const seed = [
    result.offerId,
    result.templateId,
    result.category,
    result.size,
    result.completedAt,
    result.coinReward,
    result.skillXp,
    result.grantsMasterCompletion ? 1 : 0,
    'achievement-extra-reward',
  ].join(':');
  return guaranteedCopies + (hashString(seed) % 100 < remainderChance ? 1 : 0);
};

export const claimPartnerScheduleResult = (
  pet: PetState,
  choice: PartnerScheduleRewardChoice,
  now = Date.now(),
  neighborName?: string,
): PetState => {
  const current = advancePartnerSchedule(pet, now);
  const result = current.partnerSchedule.pendingResult;
  if (!result) return { ...current, recentEvent: t('pet.partnerSchedule.noResult') };
  const safeChoice = result.size === 'short' ? 'coins' : choice;
  const extraRewardCopies = getPartnerScheduleExtraRewardCopies(current, result);
  const reward = getPartnerScheduleClaimPreview(result, safeChoice, extraRewardCopies, current);
  const rewardCoins = reward.coins;
  const rewardSkillXp = reward.skillXp;
  const currentSkill = current.partnerSchedule.skills[result.category];
  const nextSkill = result.grantsMasterCompletion && currentSkill.level >= partnerScheduleMaxSkillLevel
    ? { ...currentSkill, xp: 0, masterCompletions: clampCount(currentSkill.masterCompletions + 1) }
    : addSkillXp(currentSkill, rewardSkillXp);
  const skills = {
    ...current.partnerSchedule.skills,
    [result.category]: nextSkill,
  };
  const inventory = reward.itemId
    ? addInventoryItem(current.inventory, reward.itemId, reward.itemAmount ?? 1)
    : current.inventory;
  const belongsToCurrentBoard = current.partnerSchedule.offers.some((offer) => offer.id === result.offerId);
  const completedOfferIds = belongsToCurrentBoard
    ? Array.from(new Set([...current.partnerSchedule.completedOfferIds, result.offerId])).slice(-partnerScheduleDailyCompletionLimit)
    : current.partnerSchedule.completedOfferIds;
  const rewarded = recordEarnedCoins({
    ...current,
    coins: clampCoins(current.coins + rewardCoins),
    inventory,
    energy: clampPetEnergy(current, current.energy + (reward.energy ?? 0)),
    health: clampPetHealth(current, current.health + (reward.health ?? 0)),
    mood: clampPetStat(current, current.mood + (reward.mood ?? 0)),
    recentEvent: [
      t(`pet.partnerSchedule.claimed.${safeChoice}`, { coins: rewardCoins }),
      result.neighbor
        ? t(`pet.partnerSchedule.neighborClaimed.${neighborName ? 'named' : 'generic'}`, { neighbor: neighborName ?? '' })
        : '',
      result.grantsMasterCompletion ? t('pet.partnerSchedule.masterCompletion', { count: nextSkill.masterCompletions }).trim() : '',
      extraRewardCopies > 0 ? t('pet.partnerSchedule.extraRewardTriggered', { count: extraRewardCopies }) : '',
    ].filter(Boolean).join(' '),
    lastInteractionAt: now,
    partnerSchedule: {
      ...current.partnerSchedule,
      completedOfferIds,
      pendingResult: undefined,
      skills,
    },
  }, rewardCoins);
  const withAchievement = incrementAchievementPartnerScheduleClaim(rewarded, result.category, result.size, safeChoice);
  return completedOfferIds.length >= partnerScheduleDailyCompletionLimit
    ? resolveDailyGachaTicket(withAchievement, 'partner_schedule', 100, now).pet
    : withAchievement;
};

export const getPartnerScheduleProgress = (active: ActivePartnerSchedule, now = Date.now()) => {
  const targetMs = Math.max(1, active.endsAt - active.startedAt);
  const progressMs = Math.min(targetMs, Math.max(0, now - active.startedAt));
  return {
    targetMs,
    progressMs,
    remainingMs: Math.max(0, active.endsAt - now),
    percent: Math.min(100, (progressMs / targetMs) * 100),
  };
};

export const isPartnerScheduleCategory = (value: unknown): value is PartnerScheduleCategory =>
  typeof value === 'string' && categorySet.has(value as PartnerScheduleCategory);

export const isPartnerScheduleSize = (value: unknown): value is PartnerScheduleSize =>
  typeof value === 'string' && sizeSet.has(value as PartnerScheduleSize);
