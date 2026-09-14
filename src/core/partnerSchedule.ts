import { t } from '../i18n';
import { getAchievementEffects, incrementAchievementPartnerScheduleClaim, recordEarnedCoins } from './achievements';
import { getBoostCardEffects } from './boostCards';
import { getClassicTrophyEffects } from './classicTrophies';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem } from './items';
import { activityText } from './kitchenRecipes';
import { advancePet } from './petLifecycle';
import { goldenAppleGachaDailyTicketLimit } from './goldenAppleGacha';
import {
  getPartnerScheduleCategoryEffects,
  getPartnerScheduleGlobalCoinBonusPercent,
  getPartnerScheduleUnlockedOfferCount,
  partnerScheduleCategories,
  partnerScheduleDailyContributionTargetMs,
} from './partnerScheduleEffects';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetStat, getPetStatScale, getPetStatThreshold, scalePetStatDelta } from './petStats';
import { getWorkSeasonCoinBonus } from './season';
import type {
  ActivePartnerSchedule,
  BuiltinItemId,
  NeighborReference,
  PartnerScheduleCategory,
  PartnerScheduleCosts,
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

export const partnerScheduleSchemaVersion = 7;
// Kept as a compatibility export; community work is available from the start.
export const partnerScheduleUnlockLevel = 1;
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
  short: 9,
  standard: 21,
  long: 45,
};
const legacySizeSkillXp: Record<PartnerScheduleSize, number> = { short: 10, standard: 23, long: 50 };
const serviceRewardMultiplier = 0.9;

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

const getBoardSizes = (offerCount: number): PartnerScheduleSize[] => {
  const baseSizes: PartnerScheduleSize[] = ['short', 'standard', 'standard', 'long'];
  if (offerCount >= 5) baseSizes.push('long');
  if (offerCount >= 6) baseSizes.push('standard');
  return baseSizes;
};

const generateOffers = (level: number, createdAt: number, dateKey: string, offerCount: number, revision = 0): PartnerScheduleOffer[] => {
  const usedCategories = new Set<PartnerScheduleCategory>();
  return getBoardSizes(offerCount).map((size, index) => {
    const available = categories.filter((category) => !usedCategories.has(category));
    const pool = available.length > 0 ? available : [...categories];
    const category = pool[hashString(`${dateKey}:${Math.floor(createdAt)}:${level}:${revision}:${index}`) % pool.length];
    usedCategories.add(category);
    const templateId = templateIds[category][size];
    return {
      id: `${dateKey}:${revision}:${index}:${templateId}`,
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
  const boardOfferCount = 4;
  const offers = generateOffers(pet.level, pet.createdAt, boardDateKey, boardOfferCount);
  return {
    schemaVersion: partnerScheduleSchemaVersion,
    boardDateKey,
    boardRevision: 0,
    dailyRefreshCount: 0,
    dailyContributionMs: 0,
    dailyCompletedCount: 0,
    boardOfferCount,
    offers,
    neighborOfferId: getGeneratedNeighborOfferId(offers, pet.createdAt, boardDateKey),
    completedOfferIds: [],
    earlyEndedOfferIds: [],
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

const getNormalizedCoinReward = (rawReward: unknown, level: number, size: PartnerScheduleSize, now: number, legacy = false) => {
  if (isNumber(rawReward)) return Math.min(999999, clampCount(rawReward));
  const workBase = 24 + Math.max(0, level - 1) + getWorkSeasonCoinBonus(now);
  return Math.max(1, Math.round(workBase * sizeCoinMultipliers[size] * 1.15 * (legacy ? 1 : serviceRewardMultiplier)));
};

const getNormalizedTrophyRewardMultiplier = (value: unknown) =>
  isNumber(value) && validTrophyRewardMultipliers.has(value) ? value : 1;

const getScheduleCosts = (definition: PartnerScheduleDefinition, level: number, skill: PartnerScheduleSkill): PartnerScheduleCosts => {
  const effects = getPartnerScheduleCategoryEffects(skill);
  return {
    energy: Math.max(1, Math.round(definition.energyCost * effects.energyCostMultiplier)),
    hunger: scalePetStatDelta(level, Math.max(1, Math.round(definition.hungerCost * effects.hungerMoodCostMultiplier))),
    mood: scalePetStatDelta(level, Math.max(1, Math.round(definition.moodCost * effects.hungerMoodCostMultiplier))),
  };
};

const normalizeCosts = (value: unknown, fallback: PartnerScheduleCosts): PartnerScheduleCosts => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const cost = (key: keyof PartnerScheduleCosts) => isNumber(raw[key]) && raw[key] >= 0
    ? Math.min(100000, raw[key]) : fallback[key];
  return { energy: Math.round(cost('energy')), hunger: cost('hunger'), mood: cost('mood') };
};

const normalizeActive = (value: unknown, level: number, now: number, allowNeighbor = false, shortenLegacyDuration = false, skills = defaultSkills(), legacyPrepaid = false): ActivePartnerSchedule | undefined => {
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
    startedAt = Math.max(0, now - migratedProgressMs);
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
    coinReward: getNormalizedCoinReward(raw.coinReward, level, definition.size, now, legacyPrepaid),
    skillXp: Math.min(9999, clampCount(isNumber(raw.skillXp) ? raw.skillXp : (legacyPrepaid ? legacySizeSkillXp : sizeSkillXp)[definition.size])),
    trophyRewardMultiplier: getNormalizedTrophyRewardMultiplier(raw.trophyRewardMultiplier),
    grantsMasterCompletion: raw.grantsMasterCompletion === true,
    neighbor: allowNeighbor ? normalizeNeighborReference(raw.neighbor) : undefined,
    costs: legacyPrepaid ? getScheduleCosts(definition, level, skills[definition.category]) : normalizeCosts(raw.costs, getScheduleCosts(definition, level, skills[definition.category])),
    settledProgressMs: Math.min(Math.max(0, endsAt - startedAt), clampCount(isNumber(raw.settledProgressMs) ? raw.settledProgressMs : 0)),
    legacyPrepaid: legacyPrepaid || raw.legacyPrepaid === true,
    extraRewardChancePercent: isNumber(raw.extraRewardChancePercent) ? Math.max(0, raw.extraRewardChancePercent) : undefined,
    rewardSeed: isNumber(raw.rewardSeed) ? raw.rewardSeed : endsAt,
    statScale: isNumber(raw.statScale) && raw.statScale > 0 ? Math.min(100, raw.statScale) : getPetStatScale(level),
  };
};

const normalizeResult = (value: unknown, level: number, now: number, allowNeighbor = false, legacyRewards = false): PartnerScheduleResult | undefined => {
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
    startedAt: isNumber(raw.startedAt) ? Math.max(0, Math.min(now, raw.startedAt)) : undefined,
    coinReward: getNormalizedCoinReward(raw.coinReward, level, definition.size, now, legacyRewards),
    skillXp: Math.min(9999, clampCount(isNumber(raw.skillXp) ? raw.skillXp : (legacyRewards ? legacySizeSkillXp : sizeSkillXp)[definition.size])),
    trophyRewardMultiplier: getNormalizedTrophyRewardMultiplier(raw.trophyRewardMultiplier),
    grantsMasterCompletion: raw.grantsMasterCompletion === true,
    neighbor: allowNeighbor ? normalizeNeighborReference(raw.neighbor) : undefined,
    outcome: raw.outcome === 'early' ? 'early' : 'completed',
    progressRatio: raw.outcome === 'early' && isNumber(raw.progressRatio) ? Math.max(0, Math.min(1, raw.progressRatio)) : 1,
    contributionMs: isNumber(raw.contributionMs) ? Math.max(0, Math.min(definition.durationMinutes * minuteMs, raw.contributionMs)) : undefined,
    energyCost: isNumber(raw.energyCost) ? Math.max(0, Math.min(100000, raw.energyCost)) : definition.energyCost,
    legacyRewards: legacyRewards || raw.legacyRewards === true,
    extraRewardChancePercent: isNumber(raw.extraRewardChancePercent) ? Math.max(0, raw.extraRewardChancePercent) : undefined,
    rewardSeed: isNumber(raw.rewardSeed) ? raw.rewardSeed : isNumber(raw.completedAt) ? raw.completedAt : now,
    statScale: isNumber(raw.statScale) && raw.statScale > 0 ? Math.min(100, raw.statScale) : getPetStatScale(level),
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
  const sameDay = savedDateKey === boardDateKey;
  const boardRevision = sameDay ? clampCount(isNumber(raw.boardRevision) ? raw.boardRevision : 0) : 0;
  const rawOffersLength = Array.isArray(raw.offers) ? raw.offers.length : 0;
  const savedBoardOfferCount = Math.max(4, Math.min(6, clampCount(
    isNumber(raw.boardOfferCount) ? raw.boardOfferCount : rawOffersLength,
  )));
  const boardOfferCount = savedDateKey === boardDateKey
      ? savedBoardOfferCount
      : getPartnerScheduleUnlockedOfferCount(skills);
  const savedOffers = savedDateKey === boardDateKey ? normalizeOffers(raw.offers, boardDateKey, boardOfferCount) : [];
  const generated = generateOffers(pet.level, pet.createdAt, boardDateKey, boardOfferCount, boardRevision);
  const offers = [...savedOffers];
  for (const offer of [...generated.slice(savedOffers.length), ...generated]) {
    if (offers.length >= boardOfferCount) break;
    if (!offers.some((saved) => saved.id === offer.id)) offers.push(offer);
  }
  const savedNeighborOfferId = sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion
    && typeof raw.neighborOfferId === 'string'
    && offers.some((offer) => offer.id === raw.neighborOfferId)
      ? raw.neighborOfferId
      : undefined;
  const neighborOfferId = savedDateKey === boardDateKey
    ? savedNeighborOfferId
    : getGeneratedNeighborOfferId(offers, pet.createdAt, boardDateKey);
  const completedOfferIds = savedDateKey === boardDateKey && Array.isArray(raw.completedOfferIds)
    ? Array.from(new Set(raw.completedOfferIds.filter((id): id is string => typeof id === 'string').map((id) => id.slice(0, 128)))).filter((id) => offers.some((offer) => offer.id === id))
    : [];
  const earlyEndedOfferIds = sameDay && Array.isArray(raw.earlyEndedOfferIds)
    ? Array.from(new Set(raw.earlyEndedOfferIds.filter((id): id is string => typeof id === 'string' && offers.some((offer) => offer.id === id) && !completedOfferIds.includes(id)))) : [];
  const legacyContributionMs = completedOfferIds.reduce((total, id) => total + (definitionMap.get(offers.find((offer) => offer.id === id)!.templateId)?.durationMinutes ?? 0) * minuteMs, 0);
  let pendingResult = normalizeResult(raw.pendingResult, pet.level, now, sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion, sourceSchemaVersion < 7);
  let active = pendingResult ? undefined : normalizeActive(raw.active, pet.level, now, sourceSchemaVersion >= partnerScheduleNeighborSchemaVersion, sourceSchemaVersion < 6, skills, sourceSchemaVersion < 7);
  // New activities still owe their progressive costs. Only the full-pet advance path may finish them.
  if (settleExpired && active?.legacyPrepaid && active.endsAt <= now) {
    pendingResult = makeScheduleResult(active, active.endsAt, 'completed');
    active = undefined;
  }
  return {
    schemaVersion: partnerScheduleSchemaVersion,
    boardDateKey,
    boardRevision,
    dailyRefreshCount: sameDay ? clampCount(isNumber(raw.dailyRefreshCount) ? raw.dailyRefreshCount : 0) : 0,
    dailyContributionMs: sameDay ? Math.max(0, sourceSchemaVersion >= 7 && isNumber(raw.dailyContributionMs) ? raw.dailyContributionMs : legacyContributionMs) : 0,
    dailyCompletedCount: sameDay ? clampCount(sourceSchemaVersion >= 7 && isNumber(raw.dailyCompletedCount) ? raw.dailyCompletedCount : completedOfferIds.length) : 0,
    boardOfferCount,
    offers,
    neighborOfferId,
    completedOfferIds,
    earlyEndedOfferIds,
    active,
    pendingResult,
    skills,
  };
};

const refreshBoard = (pet: PetState, now: number): PetState => {
  const dateKey = getEffectiveDailyDateKey(pet, now);
  const isCurrentBoard = pet.partnerSchedule.boardDateKey === dateKey;
  const hasValidCurrentBoard = pet.partnerSchedule.boardOfferCount >= 4
      && pet.partnerSchedule.boardOfferCount <= 6
      && pet.partnerSchedule.offers.length === pet.partnerSchedule.boardOfferCount;
  if (isCurrentBoard && hasValidCurrentBoard) return pet;
  const boardOfferCount = isCurrentBoard && pet.partnerSchedule.boardOfferCount >= 4
      ? pet.partnerSchedule.boardOfferCount
      : getPartnerScheduleUnlockedOfferCount(pet.partnerSchedule.skills);
  const offers = generateOffers(pet.level, pet.createdAt, dateKey, boardOfferCount);
  return {
    ...pet,
    partnerSchedule: {
      ...pet.partnerSchedule,
      boardDateKey: dateKey,
      boardRevision: 0,
      dailyRefreshCount: isCurrentBoard ? pet.partnerSchedule.dailyRefreshCount : 0,
      dailyContributionMs: isCurrentBoard ? pet.partnerSchedule.dailyContributionMs : 0,
      dailyCompletedCount: isCurrentBoard ? pet.partnerSchedule.dailyCompletedCount : 0,
      boardOfferCount,
      offers,
      neighborOfferId: getGeneratedNeighborOfferId(offers, pet.createdAt, dateKey),
      completedOfferIds: [],
      earlyEndedOfferIds: [],
    },
  };
};

const costsAtRatio = (costs: PartnerScheduleCosts, ratio: number): PartnerScheduleCosts => ({
  energy: Math.ceil(costs.energy * ratio - 1e-9),
  hunger: costs.hunger * ratio,
  mood: costs.mood * ratio,
});

export const getPartnerScheduleCostPreview = (active: ActivePartnerSchedule, now = Date.now()) => {
  const definition = definitionMap.get(active.templateId)!;
  const costs = active.costs ?? { energy: definition.energyCost, hunger: definition.hungerCost, mood: definition.moodCost };
  const progress = getPartnerScheduleProgress(active, now);
  const ratio = progress.progressMs / progress.targetMs;
  return { total: costs, consumed: costsAtRatio(costs, ratio), progress, ratio };
};

const settleActiveCosts = (pet: PetState, now: number): PetState => {
  const active = pet.partnerSchedule.active;
  if (!active) return pet;
  const preview = getPartnerScheduleCostPreview(active, now);
  const settled = Math.min(preview.progress.targetMs, active.settledProgressMs ?? 0);
  if (preview.progress.progressMs <= settled) return pet;
  const previous = costsAtRatio(preview.total, settled / preview.progress.targetMs);
  return {
    ...pet,
    energy: active.legacyPrepaid ? pet.energy : clampPetEnergy(pet, pet.energy - (preview.consumed.energy - previous.energy)),
    hunger: active.legacyPrepaid ? pet.hunger : clampPetStat(pet, pet.hunger - (preview.consumed.hunger - previous.hunger)),
    mood: active.legacyPrepaid ? pet.mood : clampPetStat(pet, pet.mood - (preview.consumed.mood - previous.mood)),
    partnerSchedule: { ...pet.partnerSchedule, active: { ...active, costs: preview.total, settledProgressMs: preview.progress.progressMs } },
  };
};

const makeScheduleResult = (active: ActivePartnerSchedule, completedAt: number, outcome: 'completed' | 'early'): PartnerScheduleResult => {
  const preview = getPartnerScheduleCostPreview(active, completedAt);
  const ratio = outcome === 'completed' ? 1 : preview.ratio;
  return {
    offerId: active.offerId, templateId: active.templateId, category: active.category, size: active.size,
    completedAt, startedAt: active.startedAt, coinReward: active.coinReward, skillXp: active.skillXp, trophyRewardMultiplier: active.trophyRewardMultiplier,
    grantsMasterCompletion: outcome === 'completed' && active.grantsMasterCompletion, neighbor: active.neighbor,
    outcome, progressRatio: ratio, contributionMs: definitionMap.get(active.templateId)!.durationMinutes * minuteMs * ratio,
    energyCost: costsAtRatio(preview.total, ratio).energy, legacyRewards: active.legacyPrepaid,
    extraRewardChancePercent: active.extraRewardChancePercent, rewardSeed: active.rewardSeed, statScale: active.statScale,
  };
};

const finishActiveSchedule = (pet: PetState, completedAt: number, outcome: 'completed' | 'early' = 'completed'): PetState => {
  const active = pet.partnerSchedule.active;
  if (!active || pet.partnerSchedule.pendingResult) return pet;
  const preview = getPartnerScheduleCostPreview(active, completedAt);
  const refund = outcome === 'early' && active.legacyPrepaid;
  const isOnBoard = pet.partnerSchedule.offers.some((offer) => offer.id === active.offerId);
  return {
    ...pet,
    energy: refund ? clampPetEnergy(pet, pet.energy + preview.total.energy - preview.consumed.energy) : pet.energy,
    hunger: refund ? clampPetStat(pet, pet.hunger + preview.total.hunger - preview.consumed.hunger) : pet.hunger,
    mood: refund ? clampPetStat(pet, pet.mood + preview.total.mood - preview.consumed.mood) : pet.mood,
    recentActivity: 'idle',
    recentActivityUntil: 0,
    recentEvent: t(`pet.partnerSchedule.${outcome === 'early' ? 'cancelled' : 'completed'}`, { name: pet.name }),
    partnerSchedule: {
      ...pet.partnerSchedule,
      active: undefined,
      earlyEndedOfferIds: outcome === 'early' && isOnBoard
        ? Array.from(new Set([...pet.partnerSchedule.earlyEndedOfferIds, active.offerId])) : pet.partnerSchedule.earlyEndedOfferIds,
      pendingResult: makeScheduleResult(active, completedAt, outcome),
    },
  };
};

export const advancePartnerSchedule = (pet: PetState, now = Date.now()): PetState => {
  const current = settleActiveCosts(refreshBoard(pet, now), now);
  const active = current.partnerSchedule.active;
  if (!active) return current;
  if (now >= active.endsAt) {
    return finishActiveSchedule(current, active.endsAt);
  }
  return current;
};

export const getPartnerScheduleBoardKey = (schedule: PartnerScheduleState) => `${schedule.boardDateKey}:${schedule.boardRevision}`;

export const getPartnerScheduleRefreshPreview = (pet: PetState, now = Date.now()) => {
  const current = advancePartnerSchedule(pet, now);
  const count = current.partnerSchedule.dailyRefreshCount;
  const cost = count === 0 ? 1 : count * 2;
  const reason = current.partnerSchedule.active ? 'busy' : current.partnerSchedule.pendingResult ? 'pending'
    : current.hearts < cost ? 'hearts' : undefined;
  const [year, month, day] = current.partnerSchedule.boardDateKey.split('-').map(Number);
  const nextReset = new Date(year, month - 1, day + 1, 5);
  return { cost, canRefresh: !reason, reason, boardKey: getPartnerScheduleBoardKey(current.partnerSchedule), nextResetAt: nextReset.getTime(), offerCount: getPartnerScheduleUnlockedOfferCount(current.partnerSchedule.skills) };
};

export const refreshPartnerScheduleOffers = (pet: PetState, expectedBoardKey: string, now = Date.now()): PetState => {
  const current = advancePet(pet, now);
  const preview = getPartnerScheduleRefreshPreview(current, now);
  if (expectedBoardKey !== preview.boardKey) return current;
  if (!preview.canRefresh) return { ...current, recentEvent: t(`pet.partnerSchedule.refreshBlocked.${preview.reason}`) };
  const schedule = current.partnerSchedule;
  const revision = schedule.boardRevision + 1;
  let offers = generateOffers(current.level, current.createdAt, schedule.boardDateKey, preview.offerCount, revision);
  const templates = (board: readonly PartnerScheduleOffer[]) => board.map((offer) => offer.templateId).sort().join('|');
  if (templates(offers) === templates(schedule.offers)) {
    // Rotate all categories so an unlucky seed still guarantees a different board.
    offers = offers.map((offer, index) => {
      const definition = definitionMap.get(offer.templateId)!;
      const category = categories[(categories.indexOf(definition.category) + 1) % categories.length];
      const templateId = templateIds[category][definition.size];
      return { ...offer, templateId, id: `${schedule.boardDateKey}:${revision}:${index}:${templateId}` };
    });
  }
  return {
    ...current, hearts: clampCount(current.hearts - preview.cost),
    recentEvent: t('pet.partnerSchedule.refreshed', { hearts: preview.cost }),
    partnerSchedule: { ...schedule, boardRevision: revision, dailyRefreshCount: schedule.dailyRefreshCount + 1,
      boardOfferCount: preview.offerCount, offers, completedOfferIds: [], earlyEndedOfferIds: [],
      neighborOfferId: getGeneratedNeighborOfferId(offers, current.createdAt + revision, schedule.boardDateKey) },
  };
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
  return Math.max(1, Math.round(workBase * sizeCoinMultipliers[size] * 1.15 * serviceRewardMultiplier));
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
  baseCoins: number;
  baseSkillXp: number;
  completionCoins: number;
  completionSkillXp: number;
  categoryReward?: PartnerScheduleClaimPreview;
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
  const fullCoins = Math.max(1, Math.round(storedCoinReward * trophyRewardMultiplier));
  const fullXp = storedSkillXp > 0 ? Math.max(1, Math.round(storedSkillXp * trophyRewardMultiplier)) : 0;
  const costs = getScheduleCosts(definition, pet.level, skill);
  return {
    durationMs: Math.max(minuteMs, Math.round(definition.durationMinutes * minuteMs * effects.durationMultiplier)),
    energyCost: costs.energy,
    hungerCost: costs.hunger,
    moodCost: costs.mood,
    coinReward: fullCoins,
    skillXp: fullXp,
    trophyRewardMultiplier,
    grantsMasterCompletion: effects.grantsMasterCompletion,
    storedCoinReward,
    storedSkillXp,
    baseCoins: Math.floor(fullCoins * 0.8),
    baseSkillXp: Math.floor(fullXp * 0.8),
    completionCoins: fullCoins - Math.floor(fullCoins * 0.8),
    completionSkillXp: fullXp - Math.floor(fullXp * 0.8),
    categoryReward: definition.size === 'short' ? undefined : getPartnerScheduleClaimPreview({
      offerId: 'preview', templateId: definition.id, category: definition.category, size: definition.size,
      completedAt: now, coinReward: storedCoinReward, skillXp: storedSkillXp, trophyRewardMultiplier,
      grantsMasterCompletion: effects.grantsMasterCompletion, energyCost: costs.energy, statScale: getPetStatScale(pet),
    }, 'category', 0, pet),
  };
};

export const getPartnerScheduleFullRewardPreview = (active: ActivePartnerSchedule, pet: PetState) => {
  const result = makeScheduleResult(active, active.endsAt, 'completed');
  const coins = getPartnerScheduleClaimPreview(result, 'coins', 0, pet);
  return { coins, category: getPartnerScheduleClaimPreview(result, 'category', 0, pet),
    completionCoins: coins.coins - Math.floor(coins.coins * 0.8),
    completionSkillXp: coins.skillXp - Math.floor(coins.skillXp * 0.8) };
};

export interface PartnerScheduleStartCheck {
  canStart: boolean;
  reason?: 'busy' | 'pending' | 'completed' | 'ended' | 'sleeping' | 'energy' | 'hunger' | 'mood' | 'health' | 'missing';
}

export const getPartnerScheduleStartCheck = (
  pet: PetState,
  offerId: string,
  now = Date.now(),
): PartnerScheduleStartCheck => {
  const current = advancePartnerSchedule(pet, now);
  if (current.partnerSchedule.pendingResult) return { canStart: false, reason: 'pending' };
  if (current.partnerSchedule.active) return { canStart: false, reason: 'busy' };
  if (current.partnerSchedule.completedOfferIds.includes(offerId)) return { canStart: false, reason: 'completed' };
  if (current.partnerSchedule.earlyEndedOfferIds.includes(offerId)) return { canStart: false, reason: 'ended' };
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
  const current = advancePet(pet, now);
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
    costs: { energy: preview.energyCost, hunger: preview.hungerCost, mood: preview.moodCost },
    settledProgressMs: 0,
    legacyPrepaid: false,
    extraRewardChancePercent: getAchievementEffects(current).partnerScheduleExtraRewardChancePercent,
    rewardSeed: now + preview.durationMs,
    statScale: getPetStatScale(current),
  };
  return {
    ...current,
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
  const current = advancePet(pet, now);
  if (!current.partnerSchedule.active) return current;
  return { ...finishActiveSchedule(current, now, 'early'), lastInteractionAt: now };
};

export const getPartnerScheduleEndPreview = (pet: PetState, now = Date.now()) => {
  const active = pet.partnerSchedule.active;
  if (!active) return undefined;
  const costs = getPartnerScheduleCostPreview(active, now);
  const outcome = costs.ratio >= 1 ? 'completed' : 'early';
  const result = makeScheduleResult(active, Math.min(now, active.endsAt), outcome);
  return { ...costs, result, reward: getPartnerScheduleClaimPreview(result, 'coins', 0, pet) };
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
  if (result.outcome === 'early') {
    const ratio = Math.max(0, Math.min(1, result.progressRatio ?? 0));
    return {
      coins: Math.floor(Math.round(result.coinReward * result.trophyRewardMultiplier) * 0.8 * ratio),
      skillXp: Math.floor(Math.round(result.skillXp * result.trophyRewardMultiplier) * 0.8 * ratio),
    };
  }
  const rewardMultiplier = result.trophyRewardMultiplier * (1 + Math.max(0, Math.floor(extraRewardCopies)));
  const scaleReward = (value: number) => value > 0 ? Math.max(1, Math.round(value * rewardMultiplier)) : 0;
  const scaleStat = (value: number) => result.statScale ? value * result.statScale : pet ? scalePetStatDelta(pet, value) : value;
  if (choice === 'coins' || result.size === 'short') {
    return { coins: scaleReward(result.coinReward), skillXp: scaleReward(result.skillXp) };
  }
  const baseCoins = result.coinReward * 0.8;
  const baseSkillXp = result.skillXp * 1.5;
  const base: PartnerScheduleClaimPreview = { coins: scaleReward(baseCoins), skillXp: scaleReward(baseSkillXp) };
  const amount = result.size === 'long' ? 2 : 1;
  if (result.category === 'study') return { ...base, skillXp: scaleReward(result.skillXp * 2), mood: scaleStat(scaleReward(8 * amount)) };
  if (result.category === 'cooking') return { ...base, itemId: 'bento', itemAmount: scaleReward(amount) };
  if (result.category === 'garden') return { ...base, itemId: 'fruit_tree_sapling', itemAmount: scaleReward(amount) };
  const energy = result.legacyRewards ? scaleReward(10 * amount)
    : Math.min(10 * amount, Math.floor((result.energyCost ?? sizeRules[result.size].energyCost) / 2));
  return { ...base, energy, health: scaleStat(scaleReward(6 * amount)) };
};

export const getPartnerScheduleExtraRewardCopies = (
  pet: PetState,
  result: PartnerScheduleResult,
) => {
  if (result.outcome === 'early') return 0;
  const chancePercent = Math.max(0, result.extraRewardChancePercent ?? getAchievementEffects(pet).partnerScheduleExtraRewardChancePercent);
  const guaranteedCopies = Math.floor(chancePercent / 100);
  const remainderChance = chancePercent % 100;
  if (remainderChance <= 0) return guaranteedCopies;
  const seed = [
    result.offerId,
    result.templateId,
    result.category,
    result.size,
    result.rewardSeed ?? result.completedAt,
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
  const current = advancePet(pet, now);
  const result = current.partnerSchedule.pendingResult;
  if (!result) return { ...current, recentEvent: t('pet.partnerSchedule.noResult') };
  const isComplete = result.outcome !== 'early';
  const safeChoice = result.size === 'short' || !isComplete ? 'coins' : choice;
  const extraRewardCopies = getPartnerScheduleExtraRewardCopies(current, result);
  const reward = getPartnerScheduleClaimPreview(result, safeChoice, extraRewardCopies, current);
  const rewardCoins = reward.coins;
  const rewardSkillXp = reward.skillXp;
  const currentSkill = current.partnerSchedule.skills[result.category];
  const nextSkill = isComplete && result.grantsMasterCompletion && currentSkill.level >= partnerScheduleMaxSkillLevel
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
  const completedOfferIds = belongsToCurrentBoard && isComplete
    ? Array.from(new Set([...current.partnerSchedule.completedOfferIds, result.offerId]))
    : current.partnerSchedule.completedOfferIds;
  const dailyContributionMs = current.partnerSchedule.dailyContributionMs
    + (result.contributionMs ?? sizeRules[result.size].durationMinutes * minuteMs * (result.progressRatio ?? 1));
  const rewarded = recordEarnedCoins({
    ...current,
    coins: clampCoins(current.coins + rewardCoins),
    inventory,
    energy: clampPetEnergy(current, current.energy + (reward.energy ?? 0)),
    health: clampPetHealth(current, current.health + (reward.health ?? 0)),
    mood: clampPetStat(current, current.mood + (reward.mood ?? 0)),
    recentEvent: [
      t(isComplete ? `pet.partnerSchedule.claimed.${safeChoice}` : 'pet.partnerSchedule.claimedEarly', { coins: rewardCoins, xp: rewardSkillXp }),
      result.neighbor
        ? t(`pet.partnerSchedule.neighborClaimed.${neighborName ? 'named' : 'generic'}`, { neighbor: neighborName ?? '' })
        : '',
      isComplete && result.grantsMasterCompletion ? t('pet.partnerSchedule.masterCompletion', { count: nextSkill.masterCompletions }).trim() : '',
      extraRewardCopies > 0 ? t('pet.partnerSchedule.extraRewardTriggered', { count: extraRewardCopies }) : '',
    ].filter(Boolean).join(' '),
    lastInteractionAt: now,
    partnerSchedule: {
      ...current.partnerSchedule,
      completedOfferIds,
      earlyEndedOfferIds: !isComplete && belongsToCurrentBoard
        ? Array.from(new Set([...current.partnerSchedule.earlyEndedOfferIds, result.offerId])) : current.partnerSchedule.earlyEndedOfferIds,
      dailyContributionMs,
      dailyCompletedCount: current.partnerSchedule.dailyCompletedCount + (isComplete ? 1 : 0),
      pendingResult: undefined,
      skills,
    },
  }, rewardCoins);
  const withAchievement = isComplete ? incrementAchievementPartnerScheduleClaim(rewarded, result.category, result.size, safeChoice) : rewarded;
  const gacha = withAchievement.goldenAppleGacha;
  if (dailyContributionMs < partnerScheduleDailyContributionTargetMs
    || gacha.dailyGrantedSources.includes('partner_schedule') || gacha.tickets >= 9999) return withAchievement;
  // A fixed contribution reward cannot be displaced by earlier random ticket grants.
  return {
    ...withAchievement,
    recentEvent: `${withAchievement.recentEvent} ${t('pet.gacha.ticketGranted')}`.trim(),
    goldenAppleGacha: { ...gacha, tickets: gacha.tickets + 1,
      dailyProcessedSources: Array.from(new Set([...gacha.dailyProcessedSources, 'partner_schedule' as const])),
      dailyGrantedSources: [...gacha.dailyGrantedSources, 'partner_schedule'],
      dailyTicketsGranted: Math.min(goldenAppleGachaDailyTicketLimit, gacha.dailyTicketsGranted + 1) },
  };
};

export const getPartnerScheduleProgress = (active: ActivePartnerSchedule, now = Date.now()) => {
  const targetMs = Math.max(1, active.endsAt - active.startedAt);
  const progressMs = Math.min(targetMs, Math.max(0, active.settledProgressMs ?? 0, now - active.startedAt));
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
