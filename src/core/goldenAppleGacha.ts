import { t } from '../i18n';
import { recordEarnedCoins, recordEarnedHearts } from './achievements';
import { isClassicEndgameUnlocked } from './classicEndgame';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryCount, getInventoryItem, isBuiltinItemId } from './items';
import { inventoryItemLimit } from './saveMetadata';
import { clampCoins, clampCount } from './petStats';
import type {
  BuiltinItemId,
  GachaPaymentMethod,
  GoldenAppleOnlyPaymentMethod,
  GachaItemContent,
  GachaResult,
  GachaRewardRarity,
  GachaTicketSource,
  GoldenAppleGachaState,
  PetState,
} from './petTypes';
import { hashString, isNumber } from './utils';

export const goldenAppleGachaSchemaVersion = 5 as const;
const goldenAppleGachaPitySchemaVersion = 2;
export const goldenAppleGachaSingleCost = 500;
export const goldenAppleGachaTenCost = 5000;
export const goldenAppleGachaDailyTicketLimit = 3;
export const goldenAppleGachaJackpotPityThreshold = 1000;
export const goldenAppleGachaStarterGiftRewardId = 'golden-apple-gacha-starter-gift-v1';
export const goldenAppleGachaStarterGiftTickets = 10;
export const authorLinkGiftRewardId = 'author-link-gacha-ticket-gift-v1';
export const authorLinkGiftTickets = 10;
export const authorFollowGiftRewardId = 'author-follow-gacha-ticket-gift-v2';
export const authorFollowGiftTickets = 10;
export const goldenAppleValue = 888;
export const goldenAppleGachaPoolWeight = 100000;
export const goldenAppleHeartGachaPoolWeight = 100000;
export const goldenAppleHeartGachaSingleCost = 1;
export const goldenAppleHeartGachaTenCost = 10;
export const goldenAppleHeartGachaGuaranteeMinimum = 100;
export const goldenAppleOnlyGachaSingleCost = 1000;
export const goldenAppleOnlyGachaPoolWeight = 100000;
export const specialGachaTicketHeartCost = 100;
export const specialGachaTicketLimit = 9999;

interface BaseGachaRewardDefinition {
  id: string;
  kind: GachaResult['kind'];
  amount: number;
  itemId?: BuiltinItemId;
  contents?: readonly GachaItemContent[];
  weight: number;
  rarity: GachaRewardRarity;
}

export interface GoldenAppleGachaRewardDefinition extends BaseGachaRewardDefinition {
  kind: 'coins' | 'item' | 'bundle';
  value: number;
}

export interface GoldenAppleHeartGachaRewardDefinition extends BaseGachaRewardDefinition {
  kind: 'hearts';
}

export interface GoldenAppleOnlyGachaRewardDefinition extends BaseGachaRewardDefinition {
  kind: 'item' | 'hearts';
}

const coinReward = (amount: number, weight: number, rarity: GachaRewardRarity): GoldenAppleGachaRewardDefinition => ({
  id: `coins_${amount}`,
  kind: 'coins',
  amount,
  weight,
  rarity,
  value: amount,
});

const itemReward = (
  id: string,
  itemId: BuiltinItemId,
  amount: number,
  weight: number,
  rarity: GachaRewardRarity,
  unitValue: number,
): GoldenAppleGachaRewardDefinition => ({ id, kind: 'item', itemId, amount, weight, rarity, value: amount * unitValue });

const bundleReward = (
  id: string,
  contents: readonly GachaItemContent[],
  weight: number,
  rarity: GachaRewardRarity = 'common',
): GoldenAppleGachaRewardDefinition => ({
  id, kind: 'bundle', amount: 1, contents, weight, rarity,
  value: contents.reduce((sum, { itemId, amount }) => {
    // Free daily biscuits use their existing box purchase cost for the prize budget.
    const price = itemId === 'emergency_biscuit'
      ? (getInventoryItem('soda_biscuit_box')?.price ?? 0) / 40
      : getInventoryItem(itemId)?.price ?? 0;
    return sum + amount * price;
  }, 0),
});

export const getGachaRewardItems = (
  reward: Pick<GachaResult, 'kind' | 'itemId' | 'amount' | 'contents'>,
): readonly GachaItemContent[] => reward.kind === 'bundle'
  ? reward.contents ?? []
  : reward.kind === 'item' && reward.itemId ? [{ itemId: reward.itemId, amount: reward.amount }] : [];

export const goldenAppleGachaRewards: readonly GoldenAppleGachaRewardDefinition[] = [
  bundleReward('fruit_crate_v1', [
    { itemId: 'apple', amount: 6 }, { itemId: 'orange', amount: 6 }, { itemId: 'banana', amount: 6 },
  ], 10000),
  bundleReward('strawberry_milk_crate_v1', [{ itemId: 'strawberry_milk', amount: 16 }], 4000),
  bundleReward('home_cooking_crate_v1', [
    { itemId: 'rice', amount: 10 }, { itemId: 'egg', amount: 10 }, { itemId: 'tomato', amount: 10 },
  ], 5000),
  bundleReward('baking_crate_v1', [
    { itemId: 'apple', amount: 6 }, { itemId: 'flour', amount: 6 }, { itemId: 'ad_milk', amount: 6 },
  ], 4000),
  bundleReward('biscuit_crate_v1', [{ itemId: 'emergency_biscuit', amount: 40 }], 3000),
  bundleReward('energy_crate_v1', [
    { itemId: 'energy_drink', amount: 6 }, { itemId: 'blanket', amount: 3 },
  ], 3000, 'uncommon'),
  bundleReward('care_crate_v1', [
    { itemId: 'wet_wipes', amount: 10 }, { itemId: 'vitamin_tablet', amount: 10 }, { itemId: 'medicine', amount: 3 },
  ], 3000, 'uncommon'),
  bundleReward('companion_gift_v1', [
    { itemId: 'picture_book', amount: 4 }, { itemId: 'toy_ball', amount: 4 }, { itemId: 'ribbon_bell', amount: 4 },
  ], 3000, 'uncommon'),
  itemReward('normal_fertilizer_20', 'normal_fertilizer', 20, 6000, 'uncommon', 15),
  itemReward('heart_fertilizer_15', 'heart_fertilizer', 15, 3000, 'uncommon', 30),
  itemReward('harvest_nutrient_2', 'harvest_nutrient', 2, 2000, 'rare', 300),
  coinReward(500, 34000, 'uncommon'),
  coinReward(888, 5000, 'uncommon'),
  coinReward(1888, 1000, 'rare'),
  itemReward('money_tree_sapling_1', 'money_tree_sapling', 1, 1180, 'rare', 3000),
  itemReward('golden_apple_tree_sapling_1', 'golden_apple_tree_sapling', 1, 320, 'legendary', 8888),
  itemReward('golden_apple_1', 'golden_apple', 1, 11632, 'rare', goldenAppleValue),
  itemReward('golden_apple_3', 'golden_apple', 3, 593, 'legendary', goldenAppleValue),
  itemReward('golden_apple_5', 'golden_apple', 5, 200, 'legendary', goldenAppleValue),
  itemReward('golden_apple_10', 'golden_apple', 10, 73, 'legendary', goldenAppleValue),
  itemReward('golden_apple_100', 'golden_apple', 100, 2, 'jackpot', goldenAppleValue),
] as const;

const heartReward = (
  amount: number,
  weight: number,
  rarity: GachaRewardRarity,
): GoldenAppleHeartGachaRewardDefinition => ({
  id: `hearts_${amount}`,
  kind: 'hearts',
  amount,
  weight,
  rarity,
});

export const goldenAppleHeartGachaRewards: readonly GoldenAppleHeartGachaRewardDefinition[] = [
  heartReward(10, 15000, 'common'),
  heartReward(20, 20000, 'common'),
  heartReward(30, 20000, 'common'),
  heartReward(40, 15000, 'uncommon'),
  heartReward(60, 13000, 'uncommon'),
  heartReward(88, 9000, 'rare'),
  heartReward(100, 5000, 'rare'),
  heartReward(233, 2500, 'legendary'),
  heartReward(888, 500, 'jackpot'),
] as const;

const goldenOnlyReward = (amount: number, weight: number, rarity: GachaRewardRarity): GoldenAppleOnlyGachaRewardDefinition => ({
  id: `golden_only_apples_${amount}`, kind: 'item', itemId: 'golden_apple', amount, weight, rarity,
});
// Per draw: 0.85 apples + 5 hearts; at 100 hearts/apple, the round trip returns 90 hearts.
export const goldenAppleOnlyGachaRewards: readonly GoldenAppleOnlyGachaRewardDefinition[] = [
  { id: 'golden_only_hearts_10', kind: 'hearts', amount: 10, weight: 50000, rarity: 'common' },
  goldenOnlyReward(1, 38000, 'uncommon'),
  goldenOnlyReward(2, 9000, 'rare'),
  goldenOnlyReward(5, 2000, 'legendary'),
  goldenOnlyReward(10, 900, 'legendary'),
  goldenOnlyReward(100, 100, 'jackpot'),
];

// Old result IDs retain the amounts actually awarded, without entering the active pool.
const legacyGachaRewards = [
  coinReward(100, 0, 'common'),
  coinReward(200, 0, 'common'),
  coinReward(300, 0, 'common'),
  coinReward(3888, 0, 'legendary'),
  coinReward(8888, 0, 'legendary'),
  itemReward('bento_5', 'bento', 5, 0, 'common', 24),
  itemReward('nutri_meal_5', 'nutri_meal', 5, 0, 'common', 36),
  itemReward('energy_drink_5', 'energy_drink', 5, 0, 'common', 36),
  itemReward('blanket_5', 'blanket', 5, 0, 'common', 52),
  itemReward('picture_book_5', 'picture_book', 5, 0, 'common', 52),
  itemReward('bento_10', 'bento', 10, 0, 'common', 24),
  itemReward('energy_drink_10', 'energy_drink', 10, 0, 'common', 36),
  itemReward('blanket_10', 'blanket', 10, 0, 'uncommon', 52),
  itemReward('picture_book_10', 'picture_book', 10, 0, 'uncommon', 52),
  itemReward('heart_fertilizer_30', 'heart_fertilizer', 30, 0, 'rare', 30),
  itemReward('harvest_nutrient_1', 'harvest_nutrient', 1, 0, 'rare', 300),
  itemReward('normal_fertilizer_1', 'normal_fertilizer', 1, 0, 'uncommon', 300),
  itemReward('heart_fertilizer_1', 'heart_fertilizer', 1, 0, 'rare', 900),
];
const rewardById = new Map([...legacyGachaRewards, ...goldenAppleGachaRewards].map((reward) => [reward.id, reward]));
const heartRewardById = new Map(goldenAppleHeartGachaRewards.map((reward) => [reward.id, reward]));
const goldenOnlyRewardById = new Map(goldenAppleOnlyGachaRewards.map((reward) => [reward.id, reward]));
const guaranteedHeartRewards = goldenAppleHeartGachaRewards.filter((reward) =>
  reward.amount >= goldenAppleHeartGachaGuaranteeMinimum,
);
const guaranteedHeartPoolWeight = guaranteedHeartRewards.reduce((sum, reward) => sum + reward.weight, 0);
const ticketSources = new Set<GachaTicketSource>(['partner_schedule', 'daily_wish', 'daily_encounter']);

const createSeed = (createdAt: number) => `golden-apple-gacha:${Math.max(0, Math.floor(createdAt)).toString(36)}:v1`;

export const defaultGoldenAppleGachaState = (
  createdAt: number,
  now = Date.now(),
  dailyDateKey = getDailyResetDateKey(now),
): GoldenAppleGachaState => ({
  schemaVersion: goldenAppleGachaSchemaVersion,
  tickets: 0,
  totalDraws: 0,
  coinsSpent: 0,
  ticketsSpent: 0,
  rngSeed: createSeed(createdAt),
  rngCounter: 0,
  dailyDateKey,
  dailyProcessedSources: [],
  dailyGrantedSources: [],
  dailyTicketsGranted: 0,
  jackpotCount: 0,
  jackpotPityMisses: 0,
  jackpotPityUsed: false,
  recentResults: [],
  heartGachaTotalDraws: 0,
  heartGachaApplesSpent: 0,
  heartGachaRngCounter: 0,
  recentHeartResults: [],
  specialTickets: 0,
  specialTicketHeartsSpent: 0,
  goldenGachaTotalDraws: 0,
  goldenGachaCoinsSpent: 0,
  goldenGachaTicketsSpent: 0,
  goldenGachaRngCounter: 0,
  goldenGachaJackpotCount: 0,
  recentGoldenResults: [],
});

const normalizeSources = (value: unknown): GachaTicketSource[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((source): source is GachaTicketSource =>
    typeof source === 'string' && ticketSources.has(source as GachaTicketSource),
  ))).slice(0, goldenAppleGachaDailyTicketLimit);
};

const normalizeResult = (
  value: unknown,
  definitions: ReadonlyMap<string, BaseGachaRewardDefinition>,
  pityRewardId?: string,
): GachaResult | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const definition = typeof raw.rewardId === 'string' ? definitions.get(raw.rewardId) : undefined;
  if (!definition) return undefined;
  const drawnAt = isNumber(raw.drawnAt) ? Math.max(0, Math.floor(raw.drawnAt)) : 0;
  const pityGuaranteed = definition.id === pityRewardId && Boolean(raw.pityGuaranteed);
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 96) : `${definition.id}:${drawnAt}`,
    rewardId: definition.id,
    kind: definition.kind,
    itemId: definition.itemId,
    ...(definition.contents ? { contents: definition.contents.map((content) => ({ ...content })) } : {}),
    amount: definition.amount,
    rarity: definition.rarity,
    guaranteed: !pityGuaranteed && Boolean(raw.guaranteed),
    pityGuaranteed,
    drawnAt,
  };
};

export const normalizeGoldenAppleGachaState = (
  value: unknown,
  createdAt: number,
  now = Date.now(),
  requestedDateKey = getDailyResetDateKey(now),
): GoldenAppleGachaState => {
  const fallback = defaultGoldenAppleGachaState(createdAt, now, requestedDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const sourceSchemaVersion = isNumber(raw.schemaVersion) ? Math.max(0, Math.floor(raw.schemaVersion)) : 0;
  const currentDateKey = requestedDateKey;
  const storedDateKey = normalizeLegacyDailyDateKey(raw.dailyDateKey, now);
  const effectiveDateKey = storedDateKey && storedDateKey > currentDateKey ? storedDateKey : currentDateKey;
  const isCurrentDay = storedDateKey === effectiveDateKey;
  const processed = isCurrentDay ? normalizeSources(raw.dailyProcessedSources) : [];
  const granted = isCurrentDay ? normalizeSources(raw.dailyGrantedSources).filter((source) => processed.includes(source)) : [];
  const dailyTicketsGranted = isCurrentDay && sourceSchemaVersion >= 3 && isNumber(raw.dailyTicketsGranted)
    ? Math.max(
        granted.length,
        Math.min(goldenAppleGachaDailyTicketLimit, clampCount(raw.dailyTicketsGranted)),
      )
    : granted.length;
  const recentResults = Array.isArray(raw.recentResults)
    ? raw.recentResults
        .map((result) => normalizeResult(result, rewardById, 'golden_apple_100'))
        .filter((result): result is GachaResult => Boolean(result))
        .slice(0, 20)
    : [];
  const hasHeartGachaState = sourceSchemaVersion >= 4;
  const goldenCount = (value: unknown) => sourceSchemaVersion >= 5 && isNumber(value) ? clampCount(value) : 0;
  const recentGoldenResults = sourceSchemaVersion >= 5 && Array.isArray(raw.recentGoldenResults)
    ? raw.recentGoldenResults.map((result) => normalizeResult(result, goldenOnlyRewardById))
        .filter((result): result is GachaResult => Boolean(result))
        .slice(0, 20).map(result => ({ ...result, guaranteed: false, pityGuaranteed: false }))
    : [];
  const recentHeartResults = hasHeartGachaState && Array.isArray(raw.recentHeartResults)
    ? raw.recentHeartResults
        .map((result) => normalizeResult(result, heartRewardById))
        .filter((result): result is GachaResult => Boolean(result))
        .slice(0, 20)
    : [];
  const totalDraws = clampCount(isNumber(raw.totalDraws) ? raw.totalDraws : 0);
  const jackpotPityUsed = sourceSchemaVersion >= goldenAppleGachaPitySchemaVersion && raw.jackpotPityUsed === true;
  const jackpotPityMisses = sourceSchemaVersion >= goldenAppleGachaPitySchemaVersion && !jackpotPityUsed
    ? Math.min(
        goldenAppleGachaJackpotPityThreshold,
        totalDraws,
        clampCount(isNumber(raw.jackpotPityMisses) ? raw.jackpotPityMisses : 0),
      )
    : 0;
  return {
    schemaVersion: goldenAppleGachaSchemaVersion,
    tickets: Math.min(9999, clampCount(isNumber(raw.tickets) ? raw.tickets : 0)),
    totalDraws,
    coinsSpent: clampCount(isNumber(raw.coinsSpent) ? raw.coinsSpent : 0),
    ticketsSpent: clampCount(isNumber(raw.ticketsSpent) ? raw.ticketsSpent : 0),
    rngSeed: typeof raw.rngSeed === 'string' && raw.rngSeed.trim() ? raw.rngSeed.trim().slice(0, 128) : fallback.rngSeed,
    rngCounter: clampCount(isNumber(raw.rngCounter) ? raw.rngCounter : 0),
    dailyDateKey: effectiveDateKey,
    dailyProcessedSources: processed,
    dailyGrantedSources: granted,
    dailyTicketsGranted,
    jackpotCount: clampCount(isNumber(raw.jackpotCount) ? raw.jackpotCount : 0),
    jackpotPityMisses,
    jackpotPityUsed,
    recentResults,
    heartGachaTotalDraws: hasHeartGachaState
      ? clampCount(isNumber(raw.heartGachaTotalDraws) ? raw.heartGachaTotalDraws : 0)
      : 0,
    heartGachaApplesSpent: hasHeartGachaState
      ? clampCount(isNumber(raw.heartGachaApplesSpent) ? raw.heartGachaApplesSpent : 0)
      : 0,
    heartGachaRngCounter: hasHeartGachaState
      ? clampCount(isNumber(raw.heartGachaRngCounter) ? raw.heartGachaRngCounter : 0)
      : 0,
    recentHeartResults,
    specialTickets: Math.min(specialGachaTicketLimit, goldenCount(raw.specialTickets)),
    specialTicketHeartsSpent: goldenCount(raw.specialTicketHeartsSpent),
    goldenGachaTotalDraws: goldenCount(raw.goldenGachaTotalDraws),
    goldenGachaCoinsSpent: goldenCount(raw.goldenGachaCoinsSpent),
    goldenGachaTicketsSpent: goldenCount(raw.goldenGachaTicketsSpent),
    goldenGachaRngCounter: goldenCount(raw.goldenGachaRngCounter),
    goldenGachaJackpotCount: goldenCount(raw.goldenGachaJackpotCount),
    recentGoldenResults,
  };
};

const pickReward = (seed: string, counter: number) => {
  let target = hashString(`${seed}:${counter}:reward`) % goldenAppleGachaPoolWeight;
  for (const reward of goldenAppleGachaRewards) {
    target -= reward.weight;
    if (target < 0) return reward;
  }
  return goldenAppleGachaRewards[goldenAppleGachaRewards.length - 1];
};

const createResult = (
  definition: GoldenAppleGachaRewardDefinition,
  state: GoldenAppleGachaState,
  counter: number,
  now: number,
  guaranteed = false,
  pityGuaranteed = false,
): GachaResult => ({
  id: `${state.rngSeed}:${counter}:${now}`,
  rewardId: definition.id,
  kind: definition.kind,
  itemId: definition.itemId,
  ...(definition.contents ? { contents: definition.contents.map((content) => ({ ...content })) } : {}),
  amount: definition.amount,
  rarity: definition.rarity,
  guaranteed,
  pityGuaranteed,
  drawnAt: now,
});

const pickHeartReward = (seed: string, counter: number) => {
  let target = hashString(`${seed}:heart:${counter}:reward`) % goldenAppleHeartGachaPoolWeight;
  for (const reward of goldenAppleHeartGachaRewards) {
    target -= reward.weight;
    if (target < 0) return reward;
  }
  return goldenAppleHeartGachaRewards[goldenAppleHeartGachaRewards.length - 1];
};

const pickGuaranteedHeartReward = (seed: string, counter: number) => {
  let target = hashString(`${seed}:heart:${counter}:guarantee`) % guaranteedHeartPoolWeight;
  for (const reward of guaranteedHeartRewards) {
    target -= reward.weight;
    if (target < 0) return reward;
  }
  return guaranteedHeartRewards[guaranteedHeartRewards.length - 1];
};

const createHeartResult = (
  definition: GoldenAppleHeartGachaRewardDefinition,
  state: GoldenAppleGachaState,
  counter: number,
  now: number,
  guaranteed = false,
): GachaResult => ({
  id: `${state.rngSeed}:heart:${counter}:${now}`,
  rewardId: definition.id,
  kind: definition.kind,
  amount: definition.amount,
  rarity: definition.rarity,
  guaranteed,
  pityGuaranteed: false,
  drawnAt: now,
});

const spendGoldenApples = (inventory: PetState['inventory'], amount: number) => {
  const next = { ...inventory };
  const remaining = Math.max(0, getInventoryCount(inventory, 'golden_apple') - amount);
  if (remaining > 0) next.golden_apple = remaining;
  else delete next.golden_apple;
  return next;
};

export type GoldenAppleGachaDrawError =
  | 'save_failed'
  | 'not_enough_coins'
  | 'not_enough_tickets'
  | 'not_enough_golden_apples'
  | 'not_enough_special_tickets'
  | 'not_enough_hearts'
  | 'tickets_full'
  | 'locked'
  | 'paused'
  | 'invalid_payment'
  | 'inventory_full'
  | 'invalid_count';

export interface GoldenAppleGachaDrawOutcome {
  pet: PetState;
  results: GachaResult[];
  error?: GoldenAppleGachaDrawError;
}

export interface GoldenAppleGachaStarterGiftOutcome {
  pet: PetState;
  claimed: boolean;
}

export const claimGoldenAppleGachaStarterGift = (pet: PetState): GoldenAppleGachaStarterGiftOutcome => {
  if (pet.claimedRewardIds.includes(goldenAppleGachaStarterGiftRewardId)) {
    return { pet, claimed: false };
  }

  return {
    pet: {
      ...pet,
      goldenAppleGacha: {
        ...pet.goldenAppleGacha,
        tickets: Math.min(9999, pet.goldenAppleGacha.tickets + goldenAppleGachaStarterGiftTickets),
      },
      claimedRewardIds: [...pet.claimedRewardIds, goldenAppleGachaStarterGiftRewardId],
      recentEvent: t('pet.gacha.starterGiftClaimed', { count: goldenAppleGachaStarterGiftTickets }),
    },
    claimed: true,
  };
};

export const claimAuthorLinkGift = (pet: PetState): GoldenAppleGachaStarterGiftOutcome => {
  if (pet.claimedRewardIds.includes(authorLinkGiftRewardId)) {
    return { pet, claimed: false };
  }

  const tickets = Math.min(9999, pet.goldenAppleGacha.tickets + authorLinkGiftTickets);
  const grantedTickets = tickets - pet.goldenAppleGacha.tickets;

  return {
    pet: {
      ...pet,
      goldenAppleGacha: {
        ...pet.goldenAppleGacha,
        tickets,
      },
      claimedRewardIds: [...pet.claimedRewardIds, authorLinkGiftRewardId],
      recentEvent: t('pet.reward.authorLinkGift', { count: grantedTickets }),
    },
    claimed: true,
  };
};

export const drawGoldenAppleGacha = (
  pet: PetState,
  payment: GachaPaymentMethod,
  count: 1 | 10,
  now = Date.now(),
): GoldenAppleGachaDrawOutcome => {
  if (count !== 1 && count !== 10) return { pet, results: [], error: 'invalid_count' };
  const state = normalizeGoldenAppleGachaState(pet.goldenAppleGacha, pet.createdAt, now, getEffectiveDailyDateKey(pet, now));
  const coinCost = count === 10 ? goldenAppleGachaTenCost : goldenAppleGachaSingleCost;
  const ticketCost = count;
  if (payment === 'coins' && pet.coins < coinCost) return { pet, results: [], error: 'not_enough_coins' };
  if (payment === 'tickets' && state.tickets < ticketCost) return { pet, results: [], error: 'not_enough_tickets' };

  let jackpotPityMisses = state.jackpotPityUsed ? 0 : state.jackpotPityMisses;
  let jackpotPityUsed = state.jackpotPityUsed;
  const jackpotReward = rewardById.get('golden_apple_100');
  const results = Array.from({ length: count }, (_, index) => {
    const counter = state.rngCounter + index;
    const pityGuaranteed = !jackpotPityUsed
      && jackpotPityMisses >= goldenAppleGachaJackpotPityThreshold
      && Boolean(jackpotReward);
    const definition = pityGuaranteed && jackpotReward
      ? jackpotReward
      : pickReward(state.rngSeed, counter);
    const result = createResult(definition, state, counter, now, false, pityGuaranteed);
    if (definition.id === 'golden_apple_100') {
      jackpotPityMisses = 0;
      if (pityGuaranteed) jackpotPityUsed = true;
    } else if (!jackpotPityUsed) {
      jackpotPityMisses = Math.min(goldenAppleGachaJackpotPityThreshold, jackpotPityMisses + 1);
    }
    return result;
  });
  if (count === 10 && !results.some((result) => result.itemId === 'golden_apple')) {
    const guaranteed = rewardById.get('golden_apple_1');
    if (guaranteed) results[9] = createResult(guaranteed, state, state.rngCounter + 9, now, true);
  }

  const coinRewardTotal = results.reduce((sum, result) => sum + (result.kind === 'coins' ? result.amount : 0), 0);
  const itemRewards = results.flatMap(getGachaRewardItems);
  const inventory = itemRewards.reduce((next, { itemId, amount }) => addInventoryItem(next, itemId, amount), pet.inventory);
  if (itemRewards.some(({ itemId }) => getInventoryCount(inventory, itemId) > inventoryItemLimit)) {
    return { pet, results: [], error: 'inventory_full' };
  }
  const nextState: GoldenAppleGachaState = {
    ...state,
    tickets: payment === 'tickets' ? state.tickets - ticketCost : state.tickets,
    totalDraws: state.totalDraws + count,
    coinsSpent: state.coinsSpent + (payment === 'coins' ? coinCost : 0),
    ticketsSpent: state.ticketsSpent + (payment === 'tickets' ? ticketCost : 0),
    rngCounter: state.rngCounter + count,
    jackpotCount: state.jackpotCount + results.filter((result) => result.rewardId === 'golden_apple_100').length,
    jackpotPityMisses,
    jackpotPityUsed,
    recentResults: [...results].reverse().concat(state.recentResults).slice(0, 20),
  };
  const settled = {
    ...pet,
    coins: clampCoins(pet.coins - (payment === 'coins' ? coinCost : 0) + coinRewardTotal),
    inventory,
    goldenAppleGacha: nextState,
    recentEvent: t('pet.gacha.drawn', { count, coins: coinRewardTotal, items: itemRewards.reduce((sum, item) => sum + item.amount, 0) }),
    lastInteractionAt: now,
  };
  return {
    pet: coinRewardTotal > 0 ? recordEarnedCoins(settled, coinRewardTotal) : settled,
    results,
  };
};

export const claimAuthorFollowGift = (
  pet: PetState,
  grantTickets = true,
): GoldenAppleGachaStarterGiftOutcome => {
  if (pet.claimedRewardIds.includes(authorFollowGiftRewardId)) {
    return { pet, claimed: false };
  }

  const tickets = grantTickets
    ? Math.min(9999, pet.goldenAppleGacha.tickets + authorFollowGiftTickets)
    : pet.goldenAppleGacha.tickets;
  const grantedTickets = tickets - pet.goldenAppleGacha.tickets;

  return {
    pet: {
      ...pet,
      goldenAppleGacha: {
        ...pet.goldenAppleGacha,
        tickets,
      },
      claimedRewardIds: [...pet.claimedRewardIds, authorFollowGiftRewardId],
      recentEvent: grantTickets
        ? t('pet.reward.authorFollowGift', { count: grantedTickets })
        : pet.recentEvent,
    },
    claimed: true,
  };
};

export const drawGoldenAppleHeartGacha = (
  pet: PetState,
  count: 1 | 10,
  now = Date.now(),
): GoldenAppleGachaDrawOutcome => {
  if (count !== 1 && count !== 10) return { pet, results: [], error: 'invalid_count' };
  const appleCost = count === 10 ? goldenAppleHeartGachaTenCost : goldenAppleHeartGachaSingleCost;
  if (getInventoryCount(pet.inventory, 'golden_apple') < appleCost) {
    return { pet, results: [], error: 'not_enough_golden_apples' };
  }

  const state = normalizeGoldenAppleGachaState(
    pet.goldenAppleGacha,
    pet.createdAt,
    now,
    getEffectiveDailyDateKey(pet, now),
  );
  const results = Array.from({ length: count }, (_, index) => {
    const counter = state.heartGachaRngCounter + index;
    return createHeartResult(pickHeartReward(state.rngSeed, counter), state, counter, now);
  });
  if (count === 10 && !results.some((result) => result.amount >= goldenAppleHeartGachaGuaranteeMinimum)) {
    const counter = state.heartGachaRngCounter + 9;
    results[9] = createHeartResult(pickGuaranteedHeartReward(state.rngSeed, counter), state, counter, now, true);
  }

  const heartRewardTotal = results.reduce((sum, result) => sum + result.amount, 0);
  const hearts = clampCount(pet.hearts + heartRewardTotal);
  const nextState: GoldenAppleGachaState = {
    ...state,
    heartGachaTotalDraws: state.heartGachaTotalDraws + count,
    heartGachaApplesSpent: state.heartGachaApplesSpent + appleCost,
    heartGachaRngCounter: state.heartGachaRngCounter + count,
    recentHeartResults: [...results].reverse().concat(state.recentHeartResults).slice(0, 20),
  };
  const settled: PetState = {
    ...pet,
    hearts,
    inventory: spendGoldenApples(pet.inventory, appleCost),
    goldenAppleGacha: nextState,
    recentEvent: t('pet.gacha.heartsDrawn', { count, apples: appleCost, hearts: heartRewardTotal }),
    lastInteractionAt: now,
  };
  return {
    pet: recordEarnedHearts(settled, hearts - pet.hearts),
    results,
  };
};

export interface SpecialGachaTicketExchangeOutcome {
  pet: PetState;
  tickets: number;
  error?: GoldenAppleGachaDrawError;
}

export const getSpecialGachaTicketExchangeLimit = (pet: PetState) => Math.max(0, Math.min(
  Math.floor(pet.hearts / specialGachaTicketHeartCost),
  specialGachaTicketLimit - pet.goldenAppleGacha.specialTickets,
));

export const exchangeHeartsForSpecialGachaTickets = (
  pet: PetState,
  count: number,
  now = Date.now(),
): SpecialGachaTicketExchangeOutcome => {
  const fail = (error: GoldenAppleGachaDrawError): SpecialGachaTicketExchangeOutcome => ({ pet, tickets: 0, error });
  if (pet.timePause) return fail('paused');
  if (!isClassicEndgameUnlocked(pet)) return fail('locked');
  if (!Number.isSafeInteger(count) || count <= 0) return fail('invalid_count');
  const state = normalizeGoldenAppleGachaState(pet.goldenAppleGacha, pet.createdAt, now, getEffectiveDailyDateKey(pet, now));
  if (count > specialGachaTicketLimit - state.specialTickets) return fail('tickets_full');
  const cost = count * specialGachaTicketHeartCost;
  if (pet.hearts < cost) return fail('not_enough_hearts');
  return {
    tickets: count,
    pet: {
      ...pet,
      hearts: pet.hearts - cost,
      goldenAppleGacha: { ...state, specialTickets: state.specialTickets + count, specialTicketHeartsSpent: state.specialTicketHeartsSpent + cost },
      recentEvent: t('pet.gacha.specialTicketsExchanged', { hearts: cost, count }),
      lastInteractionAt: now,
    },
  };
};

export const drawGoldenAppleOnlyGacha = (
  pet: PetState,
  payment: GoldenAppleOnlyPaymentMethod,
  count: 1 | 10,
  now = Date.now(),
): GoldenAppleGachaDrawOutcome => {
  const fail = (error: GoldenAppleGachaDrawError): GoldenAppleGachaDrawOutcome => ({ pet, results: [], error });
  if (pet.timePause) return fail('paused');
  if (!isClassicEndgameUnlocked(pet)) return fail('locked');
  if (count !== 1 && count !== 10) return fail('invalid_count');
  if (payment !== 'coins' && payment !== 'specialTickets') return fail('invalid_payment');
  const state = normalizeGoldenAppleGachaState(pet.goldenAppleGacha, pet.createdAt, now, getEffectiveDailyDateKey(pet, now));
  const coinCost = payment === 'coins' ? count * goldenAppleOnlyGachaSingleCost : 0;
  const ticketCost = payment === 'specialTickets' ? count : 0;
  if (pet.coins < coinCost) return fail('not_enough_coins');
  if (state.specialTickets < ticketCost) return fail('not_enough_special_tickets');
  const results = Array.from({ length: count }, (_, index): GachaResult => {
    const counter = state.goldenGachaRngCounter + index;
    let target = hashString(`${state.rngSeed}:golden:${counter}:reward`) % goldenAppleOnlyGachaPoolWeight;
    const definition = goldenAppleOnlyGachaRewards.find(reward => (target -= reward.weight) < 0)!;
    return {
      id: `${state.rngSeed}:golden:${counter}:${now}`, rewardId: definition.id,
      kind: definition.kind, itemId: definition.itemId, amount: definition.amount, rarity: definition.rarity,
      guaranteed: false, pityGuaranteed: false, drawnAt: now,
    };
  });
  const apples = results.reduce((sum, result) => sum + (result.kind === 'item' ? result.amount : 0), 0);
  const hearts = results.reduce((sum, result) => sum + (result.kind === 'hearts' ? result.amount : 0), 0);
  if (getInventoryCount(pet.inventory, 'golden_apple') + apples > inventoryItemLimit) return fail('inventory_full');
  const settled: PetState = {
    ...pet,
    coins: pet.coins - coinCost,
    hearts: pet.hearts + hearts,
    inventory: apples ? addInventoryItem(pet.inventory, 'golden_apple', apples) : pet.inventory,
    goldenAppleGacha: {
      ...state,
      specialTickets: state.specialTickets - ticketCost,
      goldenGachaTotalDraws: state.goldenGachaTotalDraws + count,
      goldenGachaCoinsSpent: state.goldenGachaCoinsSpent + coinCost,
      goldenGachaTicketsSpent: state.goldenGachaTicketsSpent + ticketCost,
      goldenGachaRngCounter: state.goldenGachaRngCounter + count,
      goldenGachaJackpotCount: state.goldenGachaJackpotCount + results.filter(result => result.rarity === 'jackpot').length,
      recentGoldenResults: [...results].reverse().concat(state.recentGoldenResults).slice(0, 20),
    },
    recentEvent: t('pet.gacha.goldenOnlyDrawn', { count, apples, hearts }),
    lastInteractionAt: now,
  };
  return { pet: hearts ? recordEarnedHearts(settled, hearts) : settled, results };
};

export interface DailyGachaTicketOutcome {
  pet: PetState;
  granted: boolean;
  processed: boolean;
}

export interface DailyGachaTicketGrantOutcome {
  pet: PetState;
  grantedTickets: number;
  quotaConsumed: boolean;
}

export const grantDailyGachaTickets = (
  pet: PetState,
  requestedTickets: number,
  now = Date.now(),
): DailyGachaTicketGrantOutcome => {
  const state = normalizeGoldenAppleGachaState(pet.goldenAppleGacha, pet.createdAt, now, getEffectiveDailyDateKey(pet, now));
  const requested = isNumber(requestedTickets) ? clampCount(requestedTickets) : 0;
  const availableCapacity = Math.max(0, 9999 - state.tickets);
  const grantedTickets = state.dailyTicketsGranted < goldenAppleGachaDailyTicketLimit
    ? Math.min(requested, availableCapacity)
    : 0;

  if (grantedTickets <= 0) {
    return {
      pet: state === pet.goldenAppleGacha ? pet : { ...pet, goldenAppleGacha: state },
      grantedTickets: 0,
      quotaConsumed: false,
    };
  }

  return {
    pet: {
      ...pet,
      goldenAppleGacha: {
        ...state,
        tickets: state.tickets + grantedTickets,
        dailyTicketsGranted: state.dailyTicketsGranted + 1,
      },
    },
    grantedTickets,
    quotaConsumed: true,
  };
};

export const resolveDailyGachaTicket = (
  pet: PetState,
  source: GachaTicketSource,
  chancePercent: number,
  now = Date.now(),
): DailyGachaTicketOutcome => {
  const state = normalizeGoldenAppleGachaState(pet.goldenAppleGacha, pet.createdAt, now, getEffectiveDailyDateKey(pet, now));
  if (state.dailyProcessedSources.includes(source)) return { pet: { ...pet, goldenAppleGacha: state }, granted: false, processed: false };
  const dailyProcessedSources = [...state.dailyProcessedSources, source];
  const chance = Math.max(0, Math.min(100, Math.floor(chancePercent)));
  const won = state.dailyTicketsGranted < goldenAppleGachaDailyTicketLimit && state.tickets < 9999 &&
    hashString(`${state.rngSeed}:${state.dailyDateKey}:${source}:ticket`) % 100 < chance;
  const processedPet: PetState = {
    ...pet,
    goldenAppleGacha: {
      ...state,
      dailyProcessedSources,
    },
  };
  const grant = won ? grantDailyGachaTickets(processedPet, 1, now) : undefined;
  const nextState: GoldenAppleGachaState = grant ? {
    ...grant.pet.goldenAppleGacha,
    dailyGrantedSources: grant.quotaConsumed ? [...state.dailyGrantedSources, source] : state.dailyGrantedSources,
  } : {
    ...state,
    dailyProcessedSources,
  };
  return {
    pet: {
      ...pet,
      goldenAppleGacha: nextState,
      recentEvent: grant?.quotaConsumed ? `${pet.recentEvent} ${t('pet.gacha.ticketGranted')}`.trim() : pet.recentEvent,
    },
    granted: grant?.quotaConsumed ?? false,
    processed: true,
  };
};

export const getGoldenAppleGachaExpectedValue = () =>
  goldenAppleGachaRewards.reduce((sum, reward) => sum + reward.value * reward.weight / goldenAppleGachaPoolWeight, 0);

export const getGoldenAppleGachaCoinExpectedValue = () =>
  goldenAppleGachaRewards.reduce((sum, reward) => sum + (reward.kind === 'coins' ? reward.amount * reward.weight / goldenAppleGachaPoolWeight : 0), 0);

export const getGoldenAppleGachaTenExpectedValue = () => {
  const singleExpected = getGoldenAppleGachaExpectedValue();
  const appleExpected = goldenAppleGachaRewards
    .filter((reward) => reward.itemId === 'golden_apple')
    .reduce((sum, reward) => sum + reward.value * reward.weight / goldenAppleGachaPoolWeight, 0);
  const appleProbability = goldenAppleGachaRewards
    .filter((reward) => reward.itemId === 'golden_apple')
    .reduce((sum, reward) => sum + reward.weight / goldenAppleGachaPoolWeight, 0);
  const nonAppleExpected = (singleExpected - appleExpected) / (1 - appleProbability);
  return singleExpected * 10 + (1 - appleProbability) ** 10 * (goldenAppleValue - nonAppleExpected);
};

export const getGoldenAppleHeartGachaExpectedValue = () =>
  goldenAppleHeartGachaRewards.reduce(
    (sum, reward) => sum + reward.amount * reward.weight / goldenAppleHeartGachaPoolWeight,
    0,
  );

export const getGoldenAppleHeartGachaTenExpectedValue = () => {
  const singleExpected = getGoldenAppleHeartGachaExpectedValue();
  const guaranteedProbability = guaranteedHeartPoolWeight / goldenAppleHeartGachaPoolWeight;
  const guaranteedExpected = guaranteedHeartRewards.reduce(
    (sum, reward) => sum + reward.amount * reward.weight / guaranteedHeartPoolWeight,
    0,
  );
  const nonGuaranteedExpected = goldenAppleHeartGachaRewards
    .filter((reward) => reward.amount < goldenAppleHeartGachaGuaranteeMinimum)
    .reduce(
      (sum, reward) => sum + reward.amount * reward.weight
        / (goldenAppleHeartGachaPoolWeight - guaranteedHeartPoolWeight),
      0,
    );
  return singleExpected * 10
    + (1 - guaranteedProbability) ** 10 * (guaranteedExpected - nonGuaranteedExpected);
};

export const isGoldenAppleGachaRewardItem = (value: unknown): value is BuiltinItemId =>
  typeof value === 'string' && isBuiltinItemId(value);
