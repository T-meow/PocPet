import { t } from '../i18n';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem } from './items';
import { createNeighborGift } from './neighborGifts';
import { neighborGiftDailyLimit } from './neighbors';
import { clampCoins, clampCount } from './petStats';
import type { BoostCardId, BoostCardState, ItemId, NeighborEventContext, PetState } from './petTypes';
import { isNumber } from './utils';

export const boostCardSchemaVersion = 2;

export const boostCardIds: readonly BoostCardId[] = ['friend_pass', 'best_friend_pass'];

export const boostCardDurationMs = 30 * 24 * 60 * 60 * 1000;

export const boostCardMaxDurationMs = 90 * 24 * 60 * 60 * 1000;

export interface BoostCardDefinition {
  id: BoostCardId;
  priceHearts: number;
  dailyCoins: number;
  workBonusCoins: number;
  workBonusDailyLimit: number;
  extraHeartChancePercent: number;
  partnerScheduleCoinBonusPercent: number;
  gardenGrowTimeMultiplier: number;
}

export interface BoostCardEffects extends BoostCardDefinition {
  activeCardId?: BoostCardId;
}

export const boostCardDefinitions: Record<BoostCardId, BoostCardDefinition> = {
  friend_pass: {
    id: 'friend_pass',
    priceHearts: 10,
    dailyCoins: 15,
    workBonusCoins: 8,
    workBonusDailyLimit: 80,
    extraHeartChancePercent: 10,
    partnerScheduleCoinBonusPercent: 0,
    gardenGrowTimeMultiplier: 1,
  },
  best_friend_pass: {
    id: 'best_friend_pass',
    priceHearts: 90,
    dailyCoins: 50,
    workBonusCoins: 0,
    workBonusDailyLimit: 0,
    extraHeartChancePercent: 30,
    partnerScheduleCoinBonusPercent: 10,
    gardenGrowTimeMultiplier: 0.88,
  },
};

const emptyBoostCardEffects: BoostCardEffects = {
  ...boostCardDefinitions.friend_pass,
  dailyCoins: 0,
  workBonusCoins: 0,
  workBonusDailyLimit: 0,
  extraHeartChancePercent: 0,
  partnerScheduleCoinBonusPercent: 0,
  gardenGrowTimeMultiplier: 1,
};

const boostCardIdSet = new Set<BoostCardId>(boostCardIds);

const isBoostCardId = (value: unknown): value is BoostCardId =>
  typeof value === 'string' && boostCardIdSet.has(value as BoostCardId);

const clampExpiresAt = (value: unknown, now: number) =>
  isNumber(value) ? Math.max(0, Math.min(Math.floor(value), now + boostCardMaxDurationMs)) : 0;

const backfillPurchasedDaysFromExpiresAt = (value: unknown, now: number) => {
  const expiresAt = clampExpiresAt(value, now);
  if (expiresAt <= now) return 0;
  return Math.min(90, Math.ceil((expiresAt - now) / boostCardDurationMs) * 30);
};

export const defaultBoostCardState = (
  now = Date.now(),
  dailyDateKey = getDailyResetDateKey(now),
): BoostCardState => ({
  schemaVersion: boostCardSchemaVersion,
  friendPassExpiresAt: 0,
  bestFriendPassExpiresAt: 0,
  bestFriendPassPurchasedDays: 0,
  dailyDateKey,
  dailyRewardClaimed: false,
  dailyWorkBonusCoinsUsed: 0,
  dailyGardenExtraDrops: 0,
});

export const normalizeBoostCardState = (
  value: unknown,
  now = Date.now(),
  effectiveDateKey = getDailyResetDateKey(now),
): BoostCardState => {
  const fallback = defaultBoostCardState(now, effectiveDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const raw = value as Record<string, unknown>;
  const resetDateKey = effectiveDateKey;
  const rawDailyDateKey = normalizeLegacyDailyDateKey(raw.dailyDateKey, now) || fallback.dailyDateKey;
  const isCurrentDailyState = rawDailyDateKey === resetDateKey;
  const dailyRewardClaimed = isCurrentDailyState && (
    raw.dailyRewardClaimed === true || isBoostCardId(raw.dailyCoinsClaimedCardId)
  );

  return {
    schemaVersion: boostCardSchemaVersion,
    friendPassExpiresAt: clampExpiresAt(raw.friendPassExpiresAt, now),
    bestFriendPassExpiresAt: clampExpiresAt(raw.bestFriendPassExpiresAt, now),
    bestFriendPassPurchasedDays: Math.min(99999, clampCount(isNumber(raw.bestFriendPassPurchasedDays) ? raw.bestFriendPassPurchasedDays : backfillPurchasedDaysFromExpiresAt(raw.bestFriendPassExpiresAt, now))),
    dailyDateKey: resetDateKey,
    dailyRewardClaimed,
    dailyWorkBonusCoinsUsed:
      isCurrentDailyState ? Math.min(999, clampCount(isNumber(raw.dailyWorkBonusCoinsUsed) ? raw.dailyWorkBonusCoinsUsed : 0)) : 0,
    dailyGardenExtraDrops:
      isCurrentDailyState ? Math.min(99, clampCount(isNumber(raw.dailyGardenExtraDrops) ? raw.dailyGardenExtraDrops : 0)) : 0,
  };
};

export const getActiveBoostCard = (pet: PetState, now = Date.now()): BoostCardId | undefined => {
  const boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  if (boostCards.bestFriendPassExpiresAt > now) return 'best_friend_pass';
  if (boostCards.friendPassExpiresAt > now) return 'friend_pass';
  return undefined;
};

export const getBoostCardEffects = (pet: PetState, now = Date.now()): BoostCardEffects => {
  const activeCardId = getActiveBoostCard(pet, now);
  return activeCardId ? { ...boostCardDefinitions[activeCardId], activeCardId } : emptyBoostCardEffects;
};

export const canClaimBoostCardDailyReward = (pet: PetState, now = Date.now()) => {
  const boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  const activeCardId = getActiveBoostCard({ ...pet, boostCards }, now);
  return Boolean(activeCardId && !boostCards.dailyRewardClaimed);
};

const passExpiresAtKey = (cardId: BoostCardId) =>
  cardId === 'friend_pass' ? 'friendPassExpiresAt' : 'bestFriendPassExpiresAt';

export const buyBoostCard = (pet: PetState, cardId: BoostCardId, now = Date.now()): PetState => {
  const definition = boostCardDefinitions[cardId];
  const currentBoostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  if (cardId === 'friend_pass' && currentBoostCards.bestFriendPassExpiresAt > now) {
    return { ...pet, boostCards: currentBoostCards, recentEvent: t('pet.boostCards.bestFriendBlocksFriend') };
  }
  const expiresAtKey = passExpiresAtKey(cardId);
  const currentExpiresAt = currentBoostCards[expiresAtKey];
  const maxExpiresAt = now + boostCardMaxDurationMs;
  const extensionStart = Math.max(now, currentExpiresAt);
  const nextExpiresAt = extensionStart + boostCardDurationMs;

  if (currentExpiresAt >= maxExpiresAt || nextExpiresAt > maxExpiresAt) {
    return { ...pet, boostCards: currentBoostCards, recentEvent: t('pet.boostCards.maxDuration') };
  }

  if (pet.hearts < definition.priceHearts) {
    return { ...pet, boostCards: currentBoostCards, recentEvent: t('pet.boostCards.notEnoughHearts', { hearts: definition.priceHearts }) };
  }

  return {
    ...pet,
    hearts: clampCount(pet.hearts - definition.priceHearts),
    boostCards: {
      ...currentBoostCards,
      [expiresAtKey]: nextExpiresAt,
      bestFriendPassPurchasedDays: cardId === 'best_friend_pass'
        ? clampCount(currentBoostCards.bestFriendPassPurchasedDays + 30)
        : currentBoostCards.bestFriendPassPurchasedDays,
    },
    recentEvent: t('pet.boostCards.buySuccess', { card: t(`ui.boostCards.cards.${cardId}.name`) }),
    lastInteractionAt: now,
  };
};

export interface BoostCardDailyRewardGift {
  itemId: ItemId;
  itemAmount: number;
  displayName: string;
  neighborName?: string;
}

export const claimBoostCardDailyReward = (
  pet: PetState,
  eventContext?: NeighborEventContext,
  now = Date.now(),
): { pet: PetState; coins: number; gift?: BoostCardDailyRewardGift } => {
  const boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  const activeCardId = getActiveBoostCard({ ...pet, boostCards }, now);
  if (!activeCardId) {
    return { pet: { ...pet, boostCards, recentEvent: t('pet.boostCards.noActiveCard') }, coins: 0 };
  }

  if (boostCards.dailyRewardClaimed) {
    return { pet: { ...pet, boostCards, recentEvent: t('pet.boostCards.dailyRewardClaimed') }, coins: 0 };
  }

  const coins = boostCardDefinitions[activeCardId].dailyCoins;
  const dailyDateKey = getEffectiveDailyDateKey(pet, now);
  const storedGiftDateKey = normalizeLegacyDailyDateKey(pet.neighborGiftDateKey, now);
  const currentGiftCount = storedGiftDateKey === dailyDateKey
    ? Math.min(neighborGiftDailyLimit, clampCount(pet.neighborGiftCount))
    : 0;
  const selection = currentGiftCount < neighborGiftDailyLimit ? createNeighborGift(eventContext) : undefined;
  const gift: BoostCardDailyRewardGift | undefined = selection
    ? {
        itemId: selection.gift.itemId,
        itemAmount: 1,
        displayName: selection.gift.displayName,
        neighborName: selection.neighborName,
      }
    : undefined;
  return {
    pet: {
      ...pet,
      coins: clampCoins(pet.coins + coins),
      inventory: gift ? addInventoryItem(pet.inventory, gift.itemId, gift.itemAmount) : pet.inventory,
      boostCards: {
        ...boostCards,
        dailyRewardClaimed: true,
      },
      neighborGiftDateKey: dailyDateKey,
      neighborGiftCount: currentGiftCount + (gift ? 1 : 0),
      recentEvent: gift
        ? t(`pet.boostCards.${gift.neighborName ? 'claimDailyRewardNamed' : 'claimDailyRewardGeneric'}`, {
            coins,
            neighbor: gift.neighborName ?? '',
            item: gift.displayName,
          })
        : t('pet.boostCards.claimDailyRewardCoinsOnly', { coins }),
      lastInteractionAt: now,
    },
    coins,
    gift,
  };
};

export const applyBoostCardWorkBonus = (pet: PetState, now = Date.now()) => {
  const boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  const effects = getBoostCardEffects({ ...pet, boostCards }, now);
  const remaining = Math.max(0, effects.workBonusDailyLimit - boostCards.dailyWorkBonusCoinsUsed);
  const bonusCoins = Math.min(effects.workBonusCoins, remaining);

  return {
    bonusCoins,
    boostCards: bonusCoins > 0
      ? { ...boostCards, dailyWorkBonusCoinsUsed: boostCards.dailyWorkBonusCoinsUsed + bonusCoins }
      : boostCards,
  };
};

export const applyBoostCardHeartBonus = (pet: PetState, gainedHearts: number, now = Date.now()) => {
  const boostCards = normalizeBoostCardState(pet.boostCards, now, getEffectiveDailyDateKey(pet, now));
  const effects = getBoostCardEffects({ ...pet, boostCards }, now);
  const extraHearts = gainedHearts > 0 && effects.extraHeartChancePercent > 0 && Math.random() * 100 < effects.extraHeartChancePercent ? 1 : 0;

  return {
    extraHearts,
    boostCards,
  };
};
