import { t } from '../i18n';
import { recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryCount, isBuiltinItemId } from './items';
import { clampCoins, clampCount } from './petStats';
import type {
  BuiltinItemId,
  GachaPaymentMethod,
  GachaResult,
  GachaRewardRarity,
  GachaTicketSource,
  GoldenAppleGachaState,
  PetState,
} from './petTypes';
import { hashString, isNumber } from './utils';

export const goldenAppleGachaSchemaVersion = 4 as const;
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

interface BaseGachaRewardDefinition {
  id: string;
  kind: GachaResult['kind'];
  amount: number;
  itemId?: BuiltinItemId;
  weight: number;
  rarity: GachaRewardRarity;
}

export interface GoldenAppleGachaRewardDefinition extends BaseGachaRewardDefinition {
  kind: 'coins' | 'item';
  value: number;
}

export interface GoldenAppleHeartGachaRewardDefinition extends BaseGachaRewardDefinition {
  kind: 'hearts';
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

export const goldenAppleGachaRewards: readonly GoldenAppleGachaRewardDefinition[] = [
  coinReward(100, 10350, 'common'),
  coinReward(200, 8000, 'common'),
  coinReward(300, 7600, 'common'),
  coinReward(500, 5200, 'uncommon'),
  coinReward(888, 6000, 'uncommon'),
  coinReward(1888, 2100, 'rare'),
  coinReward(3888, 638, 'legendary'),
  coinReward(8888, 112, 'legendary'),
  itemReward('bento_5', 'bento', 5, 3200, 'common', 24),
  itemReward('nutri_meal_5', 'nutri_meal', 5, 3200, 'common', 36),
  itemReward('energy_drink_5', 'energy_drink', 5, 3200, 'common', 36),
  itemReward('blanket_5', 'blanket', 5, 2800, 'common', 42),
  itemReward('picture_book_5', 'picture_book', 5, 2000, 'common', 52),
  itemReward('bento_10', 'bento', 10, 8000, 'common', 24),
  itemReward('energy_drink_10', 'energy_drink', 10, 7600, 'common', 36),
  itemReward('blanket_10', 'blanket', 10, 2600, 'uncommon', 42),
  itemReward('picture_book_10', 'picture_book', 10, 2600, 'uncommon', 52),
  itemReward('normal_fertilizer_1', 'normal_fertilizer', 1, 4800, 'uncommon', 300),
  itemReward('harvest_nutrient_1', 'harvest_nutrient', 1, 5000, 'rare', 300),
  itemReward('heart_fertilizer_1', 'heart_fertilizer', 1, 1000, 'rare', 900),
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

const rewardById = new Map(goldenAppleGachaRewards.map((reward) => [reward.id, reward]));
const heartRewardById = new Map(goldenAppleHeartGachaRewards.map((reward) => [reward.id, reward]));
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
  | 'not_enough_coins'
  | 'not_enough_tickets'
  | 'not_enough_golden_apples'
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
  const inventory = results.reduce((next, result) =>
    result.kind === 'item' && result.itemId ? addInventoryItem(next, result.itemId, result.amount) : next,
  pet.inventory);
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
    recentEvent: t('pet.gacha.drawn', { count, coins: coinRewardTotal }),
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
