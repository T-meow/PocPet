import { t } from '../i18n';
import { recordEarnedHearts } from './achievements';
import { addInventoryItem, getInventoryCount } from './items';
import { clampCoins, clampCount } from './petStats';
import type {
  ClassicEndgameState,
  DreamProjectProgress,
  Inventory,
  ItemId,
  PartnerScheduleCategory,
  PetState,
} from './petTypes';
import { isNumber } from './utils';
import { classicTrophyTotal, getClassicTrophyCount, isClassicDiamondTrophyUnlocked } from './classicTrophies';

export const classicEndgameSchemaVersion = 2 as const;
export const classicEndgameUnlockLevel = 20;
export const classicEndgameUnlockSkillLevel = 6;
export const dreamProjectCategories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];
export const dreamStageCoinCosts = [2000, 4000, 8000, 16000, 30000] as const;
export const dreamStageAppleCosts = [1, 3, 5, 15, 30] as const;
export const dreamStageScheduleRequirements = [10, 25, 50, 80, 120] as const;
export const dreamStageSkillRequirements = [6, 7, 8, 10, 10] as const;
export const dreamStageMasterRequirements = [0, 0, 0, 10, 30] as const;
export const dreamProjectTotalCoinCost = dreamStageCoinCosts.reduce((sum, cost) => sum + cost, 0);
export const dreamTotalCoinCost = dreamProjectTotalCoinCost * dreamProjectCategories.length;
export const dreamProjectTotalAppleCost = dreamStageAppleCosts.reduce<number>((sum, cost) => sum + cost, 0);
export const dreamTotalAppleCost = dreamProjectTotalAppleCost * dreamProjectCategories.length;
export const classicLegacyFirstLevelCoinCost = 20000;
export const classicLegacyCoinCurveCoefficient = 2500;
export const classicLegacyCoinCurveExponent = 1.5;
export const classicLegacyCoinRoundingUnit = 100;
export const classicLegacyAppleLevelStep = 2;
export const classicGoldenAppleHeartExchangeRate = 100;

const maxSafeEconomyValue = Number.MAX_SAFE_INTEGER;

const removeInventoryAmount = (inventory: Inventory, itemId: ItemId, amount: number): Inventory => {
  const nextAmount = Math.max(0, (inventory[itemId] ?? 0) - Math.max(0, Math.floor(amount)));
  const next = { ...inventory };
  if (nextAmount > 0) next[itemId] = nextAmount;
  else delete next[itemId];
  return next;
};

export interface DreamStageDefinition {
  stage: number;
  coinCost: number;
  appleCost: number;
  skillLevel: number;
  scheduleCount: number;
  masterCount: number;
}

export const dreamStageDefinitions: readonly DreamStageDefinition[] = dreamStageCoinCosts.map((coinCost, index) => ({
  stage: index + 1,
  coinCost,
  appleCost: dreamStageAppleCosts[index],
  skillLevel: dreamStageSkillRequirements[index],
  scheduleCount: dreamStageScheduleRequirements[index],
  masterCount: dreamStageMasterRequirements[index],
}));

const stageRewards: readonly { hearts: number; itemId?: ItemId; itemAmount?: number }[] = [
  { hearts: 2, itemId: 'bento', itemAmount: 2 },
  { hearts: 3, itemId: 'energy_drink', itemAmount: 2 },
  { hearts: 5, itemId: 'normal_fertilizer', itemAmount: 1 },
  { hearts: 8, itemId: 'picture_book', itemAmount: 2 },
  { hearts: 12, itemId: 'harvest_nutrient', itemAmount: 1 },
];

const defaultDreamProgress = (): DreamProjectProgress => ({ completedStages: 0, currentStageCoins: 0 });

export const defaultClassicEndgameState = (): ClassicEndgameState => ({
  schemaVersion: classicEndgameSchemaVersion,
  projects: {
    study: defaultDreamProgress(),
    cooking: defaultDreamProgress(),
    garden: defaultDreamProgress(),
    exercise: defaultDreamProgress(),
  },
  legacyLevel: 0,
  legacyCoinsInvested: 0,
  lifetimeCoinsInvested: 0,
});

const normalizeProgress = (value: unknown): DreamProjectProgress => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultDreamProgress();
  const raw = value as Record<string, unknown>;
  const completedStages = Math.min(dreamStageDefinitions.length, clampCount(isNumber(raw.completedStages) ? raw.completedStages : 0));
  const currentCost = dreamStageCoinCosts[completedStages] ?? 0;
  return {
    completedStages,
    currentStageCoins: completedStages >= dreamStageDefinitions.length
      ? 0
      : Math.min(currentCost, clampCount(isNumber(raw.currentStageCoins) ? raw.currentStageCoins : 0)),
    completedAt: completedStages >= dreamStageDefinitions.length && isNumber(raw.completedAt)
      ? Math.max(0, Math.floor(raw.completedAt))
      : undefined,
  };
};

export const getClassicLegacyLevelCoinCost = (targetLevel: number) => {
  const safeTarget = isNumber(targetLevel)
    ? Math.max(1, Math.min(maxSafeEconomyValue, clampCount(targetLevel)))
    : 1;
  const rawCost = classicLegacyFirstLevelCoinCost
    + classicLegacyCoinCurveCoefficient * (safeTarget - 1) ** classicLegacyCoinCurveExponent;
  const roundedCost = Math.round(rawCost / classicLegacyCoinRoundingUnit) * classicLegacyCoinRoundingUnit;
  return Math.min(maxSafeEconomyValue, roundedCost);
};

export const getClassicGoalInvestedCoins = (state: ClassicEndgameState) => dreamProjectCategories.reduce((sum, category) => {
  const progress = state.projects[category];
  const completed = dreamStageCoinCosts.slice(0, progress.completedStages).reduce((stageSum, cost) => stageSum + cost, 0);
  return sum + completed + progress.currentStageCoins;
}, 0);

const getCompletedLegacyCoinTotal = (legacyLevel: number) => {
  let total = 0;
  for (let level = 1; level <= legacyLevel; level += 1) {
    total = Math.min(maxSafeEconomyValue, total + getClassicLegacyLevelCoinCost(level));
    if (total >= maxSafeEconomyValue) break;
  }
  return total;
};

export const normalizeClassicEndgameState = (value: unknown): ClassicEndgameState => {
  const fallback = defaultClassicEndgameState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const rawProjects = raw.projects && typeof raw.projects === 'object' && !Array.isArray(raw.projects)
    ? raw.projects as Record<string, unknown>
    : {};
  const projects = dreamProjectCategories.reduce<ClassicEndgameState['projects']>((items, category) => ({
    ...items,
    [category]: normalizeProgress(rawProjects[category]),
  }), fallback.projects);
  const allCompleted = dreamProjectCategories.every((category) => projects[category].completedStages >= dreamStageDefinitions.length);
  const legacyLevel = allCompleted ? Math.min(maxSafeEconomyValue, clampCount(isNumber(raw.legacyLevel) ? raw.legacyLevel : 0)) : 0;
  const legacyCost = getClassicLegacyLevelCoinCost(legacyLevel + 1);
  const legacyCoinsInvested = allCompleted
    ? Math.min(legacyCost, clampCount(isNumber(raw.legacyCoinsInvested) ? raw.legacyCoinsInvested : 0))
    : 0;
  const state: ClassicEndgameState = {
    schemaVersion: classicEndgameSchemaVersion,
    projects,
    completedAt: allCompleted && isNumber(raw.completedAt) ? Math.max(0, Math.floor(raw.completedAt)) : undefined,
    legacyLevel,
    legacyCoinsInvested,
    lifetimeCoinsInvested: 0,
  };
  const minimumLifetime = Math.min(
    maxSafeEconomyValue,
    getClassicGoalInvestedCoins(state) + getCompletedLegacyCoinTotal(legacyLevel) + legacyCoinsInvested,
  );
  state.lifetimeCoinsInvested = Math.min(maxSafeEconomyValue, Math.max(
    minimumLifetime,
    clampCount(isNumber(raw.lifetimeCoinsInvested) ? raw.lifetimeCoinsInvested : 0),
  ));
  return state;
};

export const getClassicLegacyCoinCurveMigrationRefund = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const raw = value as Record<string, unknown>;
  const sourceSchemaVersion = isNumber(raw.schemaVersion) ? clampCount(raw.schemaVersion) : 1;
  if (sourceSchemaVersion >= classicEndgameSchemaVersion) return 0;

  const normalized = normalizeClassicEndgameState(value);
  const allCompleted = dreamProjectCategories.every((category) =>
    normalized.projects[category].completedStages >= dreamStageDefinitions.length,
  );
  if (!allCompleted) return 0;

  const rawInvested = Math.min(
    maxSafeEconomyValue,
    clampCount(isNumber(raw.legacyCoinsInvested) ? raw.legacyCoinsInvested : 0),
  );
  const currentCost = getClassicLegacyLevelCoinCost(normalized.legacyLevel + 1);
  return Math.max(0, rawInvested - currentCost);
};

export const isClassicEndgameUnlocked = (pet: PetState) =>
  pet.level >= classicEndgameUnlockLevel && dreamProjectCategories.every((category) =>
    pet.partnerSchedule.skills[category].level >= classicEndgameUnlockSkillLevel,
  );

export const hasClassicEndgameUnlockNotice = (pet: PetState) =>
  isClassicEndgameUnlocked(pet) && !pet.hasSeenCommonDreamsUnlock;

export const markClassicEndgameUnlockSeen = (pet: PetState): PetState =>
  hasClassicEndgameUnlockNotice(pet) ? { ...pet, hasSeenCommonDreamsUnlock: true } : pet;

export const isClassicEndgameComplete = (pet: PetState) =>
  dreamProjectCategories.every((category) => pet.classicEndgame.projects[category].completedStages >= dreamStageDefinitions.length);

export const getClassicGoalProgress = (pet: Pick<PetState, 'classicEndgame'>) => {
  const completedStages = dreamProjectCategories.reduce(
    (sum, category) => sum + pet.classicEndgame.projects[category].completedStages,
    0,
  );
  return {
    completedStages,
    totalStages: dreamProjectCategories.length * dreamStageDefinitions.length,
    investedCoins: getClassicGoalInvestedCoins(pet.classicEndgame),
    totalCoins: dreamTotalCoinCost,
    unlockedTrophies: getClassicTrophyCount(pet),
    totalTrophies: classicTrophyTotal,
    diamondUnlocked: isClassicDiamondTrophyUnlocked(pet),
  };
};

export interface ClassicGoldenAppleHeartExchangePreview {
  unlocked: boolean;
  availableApples: number;
  appleAmount: number;
  heartAmount: number;
  canExchange: boolean;
}

export const getClassicGoldenAppleHeartExchangePreview = (
  pet: Pick<PetState, 'classicEndgame' | 'inventory'>,
  requestedApples: number,
): ClassicGoldenAppleHeartExchangePreview => {
  const availableApples = getInventoryCount(pet.inventory, 'golden_apple');
  const requestedAmount = isNumber(requestedApples) ? clampCount(requestedApples) : 0;
  const appleAmount = Math.min(availableApples, requestedAmount);
  const unlocked = isClassicDiamondTrophyUnlocked(pet);
  return {
    unlocked,
    availableApples,
    appleAmount,
    heartAmount: appleAmount * classicGoldenAppleHeartExchangeRate,
    canExchange: unlocked && appleAmount > 0,
  };
};

export const getDreamStageEligibility = (pet: PetState, category: PartnerScheduleCategory) => {
  const progress = pet.classicEndgame.projects[category];
  const definition = dreamStageDefinitions[progress.completedStages];
  if (!definition) return { complete: true, requirementsMet: true, coinsMet: true, applesMet: true };
  const skill = pet.partnerSchedule.skills[category];
  const scheduleCount = pet.achievements.counters.partnerScheduleClaimCountsByCategory[category] ?? 0;
  const apples = getInventoryCount(pet.inventory, 'golden_apple');
  return {
    complete: false,
    definition,
    skillLevel: skill.level,
    scheduleCount,
    masterCount: skill.masterCompletions,
    requirementsMet: skill.level >= definition.skillLevel && scheduleCount >= definition.scheduleCount && skill.masterCompletions >= definition.masterCount,
    coinsMet: progress.currentStageCoins >= definition.coinCost,
    applesMet: apples >= definition.appleCost,
  };
};

const failEndgameAction = (pet: PetState, key: string, params: Record<string, string | number> = {}): PetState => ({
  ...pet,
  recentEvent: t(key, params),
});

export const exchangeClassicGoldenApplesForHearts = (
  pet: PetState,
  requestedApples: number,
  now = Date.now(),
): PetState => {
  const preview = getClassicGoldenAppleHeartExchangePreview(pet, requestedApples);
  if (!preview.unlocked) return failEndgameAction(pet, 'pet.classicEndgame.exchangeLocked');
  if (!preview.canExchange) return failEndgameAction(pet, 'pet.classicEndgame.exchangeEmpty');

  const next = {
    ...pet,
    hearts: clampCount(pet.hearts + preview.heartAmount),
    inventory: removeInventoryAmount(pet.inventory, 'golden_apple', preview.appleAmount),
    recentEvent: t('pet.classicEndgame.exchangeSuccess', {
      apples: preview.appleAmount,
      hearts: preview.heartAmount,
    }),
    lastInteractionAt: now,
  };
  return recordEarnedHearts(next, preview.heartAmount);
};

export const investDreamProject = (
  pet: PetState,
  category: PartnerScheduleCategory,
  requestedCoins: number,
  now = Date.now(),
): PetState => {
  if (!isClassicEndgameUnlocked(pet)) return failEndgameAction(pet, 'pet.classicEndgame.locked');
  const state = normalizeClassicEndgameState(pet.classicEndgame);
  const progress = state.projects[category];
  const definition = dreamStageDefinitions[progress.completedStages];
  if (!definition) return failEndgameAction(pet, 'pet.classicEndgame.projectComplete');
  const remaining = Math.max(0, definition.coinCost - progress.currentStageCoins);
  const amount = Math.min(remaining, pet.coins, clampCount(requestedCoins));
  if (amount <= 0) return failEndgameAction(pet, pet.coins <= 0 ? 'pet.classicEndgame.notEnoughCoins' : 'pet.classicEndgame.stageFunded');
  return {
    ...pet,
    coins: clampCoins(pet.coins - amount),
    classicEndgame: {
      ...state,
      projects: { ...state.projects, [category]: { ...progress, currentStageCoins: progress.currentStageCoins + amount } },
      lifetimeCoinsInvested: Math.min(maxSafeEconomyValue, state.lifetimeCoinsInvested + amount),
    },
    recentEvent: t('pet.classicEndgame.invested', { coins: amount }),
    lastInteractionAt: now,
  };
};

export const completeDreamProjectStage = (
  pet: PetState,
  category: PartnerScheduleCategory,
  now = Date.now(),
): PetState => {
  if (!isClassicEndgameUnlocked(pet)) return failEndgameAction(pet, 'pet.classicEndgame.locked');
  const state = normalizeClassicEndgameState(pet.classicEndgame);
  const progress = state.projects[category];
  const eligibility = getDreamStageEligibility({ ...pet, classicEndgame: state }, category);
  if (eligibility.complete || !eligibility.definition) return failEndgameAction(pet, 'pet.classicEndgame.projectComplete');
  if (!eligibility.coinsMet) return failEndgameAction(pet, 'pet.classicEndgame.stageNeedsCoins');
  if (!eligibility.requirementsMet) return failEndgameAction(pet, 'pet.classicEndgame.requirementsMissing');
  if (!eligibility.applesMet) return failEndgameAction(pet, 'pet.classicEndgame.applesMissing', { apples: eligibility.definition.appleCost });

  const nextCompletedStages = progress.completedStages + 1;
  const projectCompleted = nextCompletedStages >= dreamStageDefinitions.length;
  const nextProjects = {
    ...state.projects,
    [category]: {
      completedStages: nextCompletedStages,
      currentStageCoins: 0,
      completedAt: projectCompleted ? now : undefined,
    },
  };
  const allCompleted = dreamProjectCategories.every((projectCategory) =>
    nextProjects[projectCategory].completedStages >= dreamStageDefinitions.length,
  );
  const reward = stageRewards[progress.completedStages];
  const withInventoryReward = reward.itemId
    ? addInventoryItem(pet.inventory, reward.itemId, reward.itemAmount ?? 1)
    : pet.inventory;
  const withAppleCost = eligibility.definition.appleCost > 0
    ? removeInventoryAmount(withInventoryReward, 'golden_apple', eligibility.definition.appleCost)
    : withInventoryReward;
  const next = {
    ...pet,
    hearts: clampCount(pet.hearts + reward.hearts),
    inventory: withAppleCost,
    classicEndgame: {
      ...state,
      projects: nextProjects,
      completedAt: allCompleted ? state.completedAt ?? now : state.completedAt,
    },
    recentEvent: t(allCompleted ? 'pet.classicEndgame.allComplete' : 'pet.classicEndgame.stageComplete', {
      stage: eligibility.definition.stage,
      hearts: reward.hearts,
    }),
    lastInteractionAt: now,
  };
  return recordEarnedHearts(next, reward.hearts);
};

export const getClassicLegacyAppleCost = (targetLevel: number) => {
  const safeTarget = isNumber(targetLevel)
    ? Math.max(1, Math.min(maxSafeEconomyValue, clampCount(targetLevel)))
    : 1;
  return Math.max(1, Math.ceil(safeTarget / classicLegacyAppleLevelStep));
};

export const investClassicLegacy = (pet: PetState, requestedCoins: number, now = Date.now()): PetState => {
  if (!isClassicEndgameComplete(pet)) return failEndgameAction(pet, 'pet.classicEndgame.legacyLocked');
  const state = normalizeClassicEndgameState(pet.classicEndgame);
  const cost = getClassicLegacyLevelCoinCost(state.legacyLevel + 1);
  const remaining = Math.max(0, cost - state.legacyCoinsInvested);
  const amount = Math.min(remaining, pet.coins, clampCount(requestedCoins));
  if (amount <= 0) return failEndgameAction(pet, pet.coins <= 0 ? 'pet.classicEndgame.notEnoughCoins' : 'pet.classicEndgame.legacyFunded');
  return {
    ...pet,
    coins: clampCoins(pet.coins - amount),
    classicEndgame: {
      ...state,
      legacyCoinsInvested: state.legacyCoinsInvested + amount,
      lifetimeCoinsInvested: Math.min(maxSafeEconomyValue, state.lifetimeCoinsInvested + amount),
    },
    recentEvent: t('pet.classicEndgame.legacyInvested', { coins: amount }),
    lastInteractionAt: now,
  };
};

export const completeClassicLegacyLevel = (pet: PetState, now = Date.now()): PetState => {
  if (!isClassicEndgameComplete(pet)) return failEndgameAction(pet, 'pet.classicEndgame.legacyLocked');
  const state = normalizeClassicEndgameState(pet.classicEndgame);
  const targetLevel = state.legacyLevel + 1;
  const coinCost = getClassicLegacyLevelCoinCost(targetLevel);
  const appleCost = getClassicLegacyAppleCost(targetLevel);
  if (state.legacyCoinsInvested < coinCost) return failEndgameAction(pet, 'pet.classicEndgame.legacyNeedsCoins');
  if (getInventoryCount(pet.inventory, 'golden_apple') < appleCost) {
    return failEndgameAction(pet, 'pet.classicEndgame.applesMissing', { apples: appleCost });
  }
  return {
    ...pet,
    inventory: removeInventoryAmount(pet.inventory, 'golden_apple', appleCost),
    classicEndgame: { ...state, legacyLevel: targetLevel, legacyCoinsInvested: 0 },
    recentEvent: t('pet.classicEndgame.legacyComplete', { level: targetLevel, apples: appleCost }),
    lastInteractionAt: now,
  };
};
