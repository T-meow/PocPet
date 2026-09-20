import { t } from '../i18n';
import { adventureBusyMessage } from './adventureData';
import { getAdventureTreasureValue, isAdventureTreasure } from './adventureItems';
import { activityText as L } from './kitchenRecipes';
import { getAdventureItemPurchaseCapacity } from './adventureState';
import { getCommunityPurchaseReason } from './communityData';
import { getCommunitySaleable } from './communityMarket';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, dailyBiscuitClaimLimit, favoriteFoodIdSet, getDailyHeartExchangeInfo, getDailyShopDiscountInfo, getInventoryCount, getInventoryItem, getShopItem, giftItemIdSet, heartExchangeCoins, removeInventoryItem } from './items';
import { applyBoostCardWorkBonus } from './boostCards';
import { applyActionStreak, basePlayMoodGain, getRandomHealthIncident, getRandomPetInteractionCost, lowSleepMoodWarningThreshold, markInteraction, petInteractionHeartHealthThreshold, petInteractionHeartMoodThreshold, petInteractionMoodPerEnergy, playEnergyCost, withActivity } from './petCommon';
import { normalizePetBirthday } from './dateRewards';
import { applyHeartGain, getAchievementEffects, incrementAchievementCareAction, incrementAchievementItemUse, incrementAchievementPurchase, incrementAchievementSleepStart, incrementManualWake, recordCoinBalance, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { recordWishProgress } from './dailyWishes';
import { advancePet, getDailyBiscuitClaimInfo, isPetCriticallyHungry, isPetLowEnergy, pausePomodoroForReason } from './petLifecycle';
import { getCleanActionSeasonBonus, getWorkSeasonCoinBonus } from './season';
import { recordYearlyCareAction, recordYearlyItemUse } from './yearlyStats';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetStat, getPetEnergyCap, getPetStatCap, getPetStatScale, getPetStatThreshold, getUpgradeHeartCost, lowCleanlinessSleepConfirmClicks, lowCleanlinessSleepMoodPenalty, lowCleanlinessSleepWarningThreshold, maxPetLevel, roundPetStatDisplayAmount, scalePetStatDelta, statCapPerLevel } from './petStats';
import type { BuiltinItemId, BuyItemOptions, CareActionKey, ItemDefinition, ItemId, PetAction, PetBirthday, PetState, PomodoroDurations, RecentActivity, UseInventoryItemOptions } from './petTypes';
import { defaultPomodoroState, getDefaultPomodoroRemainingMs, getPomodoroPhaseDurationMs, normalizePomodoroSettings, pickPomodoroActivity, pomodoroMinHealthThreshold, pomodoroPhaseLabels, pomodoroResetEventMinFocusMs } from './pomodoro';
import { startSleepSnapshot, wakePet } from './petEvents';
import { applyItemHungerEffect, getItemStatEffect, getItemUsePlan, getPictureBookReward, goldenAppleRecoveryPercent, overfedMessage } from './itemEffects';
import { clampPetHunger, updatePetSatiety } from './petStats';
import { randomInt } from './utils';
import { formatPracticeSkillXp, isPartnerSchedulePetBusy } from './partnerSchedule';
import { recordDishTaste } from './kitchen';
import { unlockBallGame } from './miniGames';
import { deliverPurchasedItems, getPurchaseCapacity } from './items';

const clearLowCleanlinessSleepConfirm = (pet: PetState): PetState =>
  pet.lowCleanlinessSleepConfirmCount > 0 ? { ...pet, lowCleanlinessSleepConfirmCount: 0 } : pet;

export const batchActionUnlockLevel = 1;
export const maxBatchQuantity = 99;

export const normalizeBatchQuantity = (quantity: number | undefined) => {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(maxBatchQuantity, Math.floor(quantity ?? 1)));
};

export const getEffectiveBatchQuantity = (pet: Pick<PetState, 'level'>, quantity: number | undefined) =>
  pet.level >= batchActionUnlockLevel ? normalizeBatchQuantity(quantity) : 1;

export type ItemPurchaseQuoteReason = 'missing' | 'unavailable' | 'daily_limit' | 'coins' | 'inventory_full';

export interface ItemPurchaseQuote {
  quantity: number;
  totalPrice: number;
  firstItemPrice: number;
  discountApplied: boolean;
  canPurchase: boolean;
  reason?: ItemPurchaseQuoteReason;
  remainingDailyLimit?: number;
}

export const getItemPurchaseQuote = (
  pet: PetState,
  itemId: ItemId,
  requestedQuantity = 1,
  now = Date.now(),
  itemOverride?: ItemDefinition,
): ItemPurchaseQuote => {
  const quantity = getEffectiveBatchQuantity(pet, requestedQuantity);
  const item = itemOverride ?? getShopItem(itemId);
  if (!item) return { quantity, totalPrice: 0, firstItemPrice: 0, discountApplied: false, canPurchase: false, reason: 'missing' };
  const isShopAvailable = 'shop' in item ? item.shop : true;
  if (!isShopAvailable) return { quantity, totalPrice: 0, firstItemPrice: 0, discountApplied: false, canPurchase: false, reason: 'unavailable' };
  if (getCommunityPurchaseReason(pet, itemId)) return { quantity, totalPrice: item.price * quantity, firstItemPrice: item.price, discountApplied: false, canPurchase: false, reason: 'unavailable' };

  if (itemId === 'emergency_biscuit') {
    const claimInfo = getDailyBiscuitClaimInfo(pet, now);
    const remainingDailyLimit = Math.max(0, claimInfo.limit - claimInfo.claimed);
    return {
      quantity,
      totalPrice: 0,
      firstItemPrice: 0,
      discountApplied: false,
      canPurchase: quantity <= remainingDailyLimit,
      reason: quantity <= remainingDailyLimit ? undefined : 'daily_limit',
      remainingDailyLimit,
    };
  }

  const discountInfo = getDailyShopDiscountInfo(pet, now);
  const discountEntry = discountInfo?.items.find((discountItem) => discountItem.itemId === itemId);
  const discountApplied = Boolean(discountEntry && !discountEntry.used);
  const firstItemPrice = discountApplied ? discountEntry?.price ?? item.price : item.price;
  const totalPrice = firstItemPrice + item.price * (quantity - 1);
  const hasCapacity = quantity <= getPurchaseCapacity(pet, item) && quantity <= getAdventureItemPurchaseCapacity(pet, itemId);
  return {
    quantity,
    totalPrice,
    firstItemPrice,
    discountApplied,
    canPurchase: hasCapacity && pet.coins >= totalPrice,
    reason: !hasCapacity ? 'inventory_full' : pet.coins >= totalPrice ? undefined : 'coins',
  };
};

export const recordPetInteraction = (pet: PetState, now = Date.now()): PetState =>
  clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));

export const standardWorkEnergyCost = 12;

export const getWorkEnergyCost = (pet: Pick<PetState, 'weather'>) =>
  pet.weather === 'breezy' ? 10 : standardWorkEnergyCost;

const getWorkQuote = (pet: PetState, now: number, energyCost: number) => {
  const standardOutputCoins = (pet.weather === 'rainy' ? 20 : 24) + getWorkSeasonCoinBonus(now);
  const energyOutputMultiplier = Math.max(1, energyCost / standardWorkEnergyCost);
  const energyAdjustedOutputCoins = Math.round(standardOutputCoins * energyOutputMultiplier);
  const levelBonusCoins = Math.max(0, pet.level - 1);
  const baseCoins = energyAdjustedOutputCoins + levelBonusCoins;
  const statCap = getPetStatCap(pet);
  const moodRatio = statCap > 0 ? Math.max(0, Math.min(1, pet.mood / statCap)) : 0;
  const bonusChance = 0.05 + moodRatio * 0.4;
  const achievementBonusCoins = getAchievementEffects(pet).workCoinBonus;
  const boostBonus = applyBoostCardWorkBonus(pet, now);
  return { baseCoins, energyCost, energyOutputMultiplier, energyAdjustedOutputCoins, levelBonusCoins, bonusChance, achievementBonusCoins, boostBonus };
};

export const getQuickWorkPreview = (pet: PetState, now = Date.now()) => {
  const quote = getWorkQuote(pet, now, getWorkEnergyCost(pet));
  const minimumCoins = quote.baseCoins + quote.achievementBonusCoins + quote.boostBonus.bonusCoins;
  const reason = pet.partnerSchedule.active || (pet.adventure.active || isExpeditionAway(pet)) ? 'busy' : pet.isSleeping ? 'sleeping'
    : isPetCriticallyHungry(pet) ? 'hunger' : pet.energy < quote.energyCost ? 'energy' : undefined;
  return { energyCost: quote.energyCost, minimumCoins, maximumCoins: minimumCoins + Math.max(1, Math.floor(quote.baseCoins * 0.15)),
    boostBonusCoins: quote.boostBonus.bonusCoins, canWork: !reason, reason };
};

export const getWorkReward = (pet: PetState, now = Date.now(), energyCost = getWorkEnergyCost(pet)) => {
  const { baseCoins, energyOutputMultiplier, energyAdjustedOutputCoins, levelBonusCoins, bonusChance, achievementBonusCoins, boostBonus } = getWorkQuote(pet, now, energyCost);
  const bonusCoins =
    Math.random() < bonusChance
      ? Math.max(1, Math.floor(baseCoins * (randomInt(5, 15) / 100)))
      : 0;

  return {
    baseCoins,
    energyCost,
    energyOutputMultiplier,
    energyAdjustedOutputCoins,
    levelBonusCoins,
    bonusCoins,
    boostBonusCoins: boostBonus.bonusCoins,
    boostCards: boostBonus.boostCards,
    totalCoins: baseCoins + bonusCoins + achievementBonusCoins + boostBonus.bonusCoins,
  };
};

export const upgradePet = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  if (current.community.fishing.active) return { ...current, recentEvent: '先收起鱼竿，再进行其他活动。' };
  if (current.adventure.active || isExpeditionAway(current)) return { ...current, recentEvent: isExpeditionAway(current) ? '伙伴正在远行，请先在基地暂停或返回。' : adventureBusyMessage() };
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
  if (current.level >= maxPetLevel) {
    return { ...current, recentEvent: t('pet.upgrade.maxLevel', { level: current.level }) };
  }

  const nextLevel = current.level + 1;
  const cost = getUpgradeHeartCost(nextLevel);
  if (current.hearts < cost) {
    return { ...current, recentEvent: t('pet.upgrade.notEnoughHearts', { level: nextLevel, cost }) };
  }

  const next: PetState = {
    ...current,
    level: nextLevel,
    hearts: clampCount(current.hearts - cost),
    recentEvent: t('pet.upgrade.success', { level: nextLevel, cost, max: getPetStatCap(nextLevel) }),
    lastInteractionAt: now,
  };

  const upgraded = {
    ...next,
    hunger: current.hunger + statCapPerLevel,
    mood: clampPetStat(next, current.mood + statCapPerLevel),
    cleanliness: clampPetStat(next, current.cleanliness + statCapPerLevel),
    energy: clampPetEnergy(next, current.energy + statCapPerLevel),
    health: clampPetHealth(next, current.health + statCapPerLevel),
  };

  return withActivity(upgraded, 'level_up', now, 4200);
};


export const exchangeHeartForCoins = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  const exchangeInfo = getDailyHeartExchangeInfo(current, now);

  if (current.hearts < 1) {
    return { ...current, recentEvent: t('pet.exchange.notEnoughHearts') };
  }

  if (!exchangeInfo.canExchange) {
    return { ...current, recentEvent: t('pet.exchange.limitReached') };
  }

  return recordCoinBalance({
    ...current,
    hearts: clampCount(current.hearts - 1),
    coins: clampCoins(current.coins + heartExchangeCoins),
    dailyHeartExchangeDate: exchangeInfo.dateKey,
    dailyHeartExchangeCount: exchangeInfo.count + 1,
    recentEvent: t('pet.exchange.success', { coins: heartExchangeCoins }),
  });
};

export const applyPetAction = (pet: PetState, action: PetAction, now = Date.now()): PetState => {
  const advanced = markInteraction(advancePet(pet, now), now);
  const current = action === 'sleep' ? advanced : clearLowCleanlinessSleepConfirm(advanced);

  if (current.community.fishing.active) return { ...current, recentEvent: '先收起鱼竿，再进行其他活动。' };
  if (current.adventure.active || isExpeditionAway(current)) return { ...current, recentEvent: isExpeditionAway(current) ? '伙伴正在远行，请先在基地暂停或返回。' : adventureBusyMessage() };
  if (isPartnerSchedulePetBusy(current)) {
    return {
      ...current,
      recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }),
    };
  }

  if (action !== 'sleep' && current.isSleeping) {
    if (action === 'work') return { ...current, recentEvent: t('pet.partnerSchedule.startBlocked.sleeping', { name: current.name }) };
    return incrementManualWake(wakePet({
      ...current,
      mood: clampPetStat(current, current.mood + scalePetStatDelta(current, -4)),
      lowCleanlinessSleepConfirmCount: 0,
      recentEvent: t('pet.action.woke', { name: current.name }),
    }, now));
  }

  if (action !== 'sleep' && isPetCriticallyHungry(current)) {
    return {
      ...current,
      lowCleanlinessSleepConfirmCount: 0,
      recentEvent: t('pet.action.lowHungerBlocked', { name: current.name }),
    };
  }

  switch (action) {
    case 'play':
      if (isPetLowEnergy(current)) {
        return { ...current, recentEvent: t('pet.action.lowEnergyPlay', { name: current.name }) };
      }
      {
        const overuse = applyActionStreak(current, 'play', now);
        const base = overuse.pet;
        const incident = getRandomHealthIncident('play', base);
        const healthDrop = incident?.amount ?? 0;
        const incidentText = incident ? ` ${incident.text}` : '';

        return incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, 'happy', now),
          mood: clampPetStat(base, base.mood + scalePetStatDelta(base, basePlayMoodGain + (base.weather === 'sunny' ? 2 : 0))),
          energy: clampPetEnergy(base, base.energy - playEnergyCost),
          hunger: clampPetHunger(base, base.hunger + scalePetStatDelta(base, -4)),
          health: clampPetHealth(base, base.health - healthDrop),
          recentEvent: `${t('pet.action.play', { name: base.name })}${base.weather === 'sunny' ? t('pet.weather.effect.sunnyPlay') : ''}${incidentText}${overuse.text}`,
        }, 'play', now), 'play', now), 'play');
      }
    case 'clean':
      {
        const overuse = applyActionStreak(current, 'clean', now);
        const base = overuse.pet;
        const seasonCleanBonus = getCleanActionSeasonBonus(now);
        const achievementCareBonus = getAchievementEffects(base).careStatBonus;
        return incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, 'bath', now),
          cleanliness: clampPetStat(base, base.cleanliness + Math.min(80, scalePetStatDelta(base, 20 + (base.weather === 'rainy' ? 5 : 0) + seasonCleanBonus + achievementCareBonus))),
          energy: clampPetEnergy(base, base.energy - 3),
          hunger: clampPetHunger(base, base.hunger + scalePetStatDelta(base, -2)),
          mood: clampPetStat(base, base.mood + Math.min(3, scalePetStatDelta(base, 1))),
          recentEvent: `${t('pet.action.clean', {
            name: base.name,
            hunger: Math.abs(roundPetStatDisplayAmount(scalePetStatDelta(base, -2))),
            mood: roundPetStatDisplayAmount(Math.min(3, scalePetStatDelta(base, 1))),
            energy: 3,
          })}${base.weather === 'rainy' ? t('pet.weather.effect.rainyClean') : ''}${seasonCleanBonus > 0 ? t('pet.season.effect.summerClean') : ''}${overuse.text}`,
        }, 'clean', now), 'clean', now), 'clean');
      }
    case 'work':
      if (current.energy < getWorkEnergyCost(current)) {
        return { ...current, recentEvent: t('pet.action.lowEnergyWork') };
      }
      {
        const base = current;
        const energyCost = getWorkEnergyCost(base);
        const reward = getWorkReward(base, now, energyCost);
        const bonusText = reward.bonusCoins > 0 ? t('pet.action.workBonus', { coins: reward.bonusCoins }) : '';
        const boostBonusText = reward.boostBonusCoins > 0 ? t('pet.boostCards.workBonus', { coins: reward.boostBonusCoins }) : '';
        const seasonWorkText = getWorkSeasonCoinBonus(now) > 0 ? t('pet.season.effect.autumnWork') : '';

        return recordEarnedCoins(incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, Math.floor(base.ageSeconds / 60) % 2 === 0 ? 'work_food' : 'work_plants', now, 2200),
          coins: base.coins + reward.totalCoins,
          boostCards: reward.boostCards,
          energy: clampPetEnergy(base, base.energy - energyCost),
          recentEvent: `${t('pet.action.work', { name: base.name, coins: reward.totalCoins })}${bonusText}${boostBonusText}${base.weather === 'rainy' ? t('pet.weather.effect.rainyWork') : ''}${base.weather === 'breezy' ? t('pet.weather.effect.breezyWork') : ''}${seasonWorkText}`,
        }, 'work', now), 'work', now), 'work'), reward.totalCoins);
      }
    case 'sleep':
      if (current.isSleeping) {
        return incrementManualWake(wakePet({
            ...current,
            lowCleanlinessSleepConfirmCount: 0,
            mood: clampPetStat(current, current.mood + scalePetStatDelta(current, -2)),
          }, now));
      }

      {
        const needsCleanlinessConfirm = current.cleanliness <= getPetStatThreshold(current, lowCleanlinessSleepWarningThreshold);
        const confirmCount = current.lowCleanlinessSleepConfirmCount;
        if (needsCleanlinessConfirm && confirmCount < lowCleanlinessSleepConfirmClicks - 1) {
          const nextCount = confirmCount + 1;
          return {
            ...current,
            lowCleanlinessSleepConfirmCount: nextCount,
            recentEvent: t(
              nextCount >= lowCleanlinessSleepConfirmClicks - 1
                ? 'pet.action.sleep.lowCleanlinessFinalWarning'
                : 'pet.action.sleep.lowCleanlinessWarning',
              { name: current.name, amount: roundPetStatDisplayAmount(scalePetStatDelta(current, lowCleanlinessSleepMoodPenalty)) },
            ),
          };
        }

        const cleanlinessMoodPenalty = needsCleanlinessConfirm ? scalePetStatDelta(current, lowCleanlinessSleepMoodPenalty) : 0;
        return incrementAchievementSleepStart(recordWishProgress(
          startSleepSnapshot(
            {
              ...current,
              isSleeping: true,
              lowCleanlinessSleepConfirmCount: 0,
              mood: clampPetStat(current, current.mood - cleanlinessMoodPenalty),
              recentEvent: needsCleanlinessConfirm
                ? t('pet.action.sleep.lowCleanlinessStarted', { name: current.name, amount: roundPetStatDisplayAmount(cleanlinessMoodPenalty) })
                : current.pomodoro.isRunning
                  ? t('pet.action.sleep.pomodoroPaused', { name: current.name })
                  : current.mood <= getPetStatThreshold(current, lowSleepMoodWarningThreshold)
                    ? t('pet.action.sleep.lowMood', { name: current.name })
                    : t('pet.action.sleep.normal', { name: current.name }),
            },
            now,
          ),
          'sleep',
          now,
        ));
      }
  }
};
export const buyItem = (pet: PetState, itemId: ItemId, now = Date.now(), options: BuyItemOptions = {}): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  const item = options.item ?? getShopItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.buy.missing') };
  const isShopAvailable = 'shop' in item ? item.shop : true;
  if (!isShopAvailable) return { ...current, recentEvent: t('pet.buy.missing') };
  const quote = getItemPurchaseQuote(current, itemId, options.quantity, now, options.item);
  const quantity = quote.quantity;
  if (quote.reason === 'unavailable') return { ...current, recentEvent: getCommunityPurchaseReason(current, itemId) || t('pet.buy.missing') };

  if (itemId === 'emergency_biscuit') {
    const claimInfo = getDailyBiscuitClaimInfo(current, now);
    if (!quote.canPurchase) {
      return {
        ...current,
        recentEvent: quote.remainingDailyLimit && quote.remainingDailyLimit > 0
          ? t('pet.buy.biscuitLimitInsufficient', { remaining: quote.remainingDailyLimit })
          : t('pet.buy.biscuitClaimedOut'),
      };
    }

    return incrementAchievementPurchase({
      ...current,
      inventory: addInventoryItem(current.inventory, itemId, quantity),
      dailyBiscuitClaimDate: getEffectiveDailyDateKey(current, now),
      dailyBiscuitClaims: claimInfo.claimed + quantity,
      recentEvent: t(quantity > 1 ? 'pet.buy.freeClaimBatch' : 'pet.buy.freeClaim', {
        item: item.name,
        count: quantity,
        claimed: claimInfo.claimed + quantity,
        limit: dailyBiscuitClaimLimit,
      }),
    }, false, quantity);
  }

  const discountInfo = getDailyShopDiscountInfo(current, now);
  const isDiscountPurchase = quote.discountApplied;
  const price = quote.totalPrice;
  const discountDateKey = discountInfo?.dateKey ?? current.dailyDiscountDate;
  const discountItemIds = discountInfo?.items.map((discountItem) => discountItem.itemId) ?? current.dailyDiscountItemIds;
  const migratedUsedDiscountItemIds =
    current.dailyDiscountDate === discountDateKey
      ? current.dailyDiscountUsedItemIds.length > 0
        ? current.dailyDiscountUsedItemIds
        : current.dailyDiscountUsed && discountItemIds[0]
          ? [discountItemIds[0]]
          : []
      : [];
  const nextDailyDiscountUsedItemIds = isDiscountPurchase
    ? Array.from(new Set([...migratedUsedDiscountItemIds, itemId as BuiltinItemId])).slice(0, 3)
    : current.dailyDiscountUsedItemIds;

  if (!quote.canPurchase) {
    return { ...current, recentEvent: quote.reason === 'inventory_full' ? t('pet.buy.inventoryFull') : t('pet.buy.notEnoughCoins', { item: item.name, price }) };
  }

  return incrementAchievementPurchase({
    ...current,
    coins: current.coins - price,
    inventory: deliverPurchasedItems(current.inventory, item, quantity),
    dailyDiscountDate: isDiscountPurchase ? discountDateKey : current.dailyDiscountDate,
    dailyDiscountItemIds: isDiscountPurchase ? discountItemIds : current.dailyDiscountItemIds,
    dailyDiscountUsedItemIds: nextDailyDiscountUsedItemIds,
    dailyDiscountUsed: isDiscountPurchase ? true : current.dailyDiscountUsed,
    recentEvent: item.purchaseContents?.length
      ? t('pet.buy.bundle', { count: quantity, biscuits: quantity * 40, price })
      : isDiscountPurchase
      ? t(quantity > 1 ? 'pet.buy.discountBatch' : 'pet.buy.discount', { item: item.name, count: quantity, price })
      : item.price === 0
        ? t(quantity > 1 ? 'pet.buy.freeBatch' : 'pet.buy.free', { item: item.name, count: quantity })
        : t(quantity > 1 ? 'pet.buy.paidBatch' : 'pet.buy.paid', { item: item.name, count: quantity, price }),
  }, price > 0, quantity);
};

const useInventoryItemInternal = (
  pet: PetState,
  itemId: ItemId,
  now = Date.now(),
  options: UseInventoryItemOptions = {},
): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  if (current.community.fishing.active) return { ...current, recentEvent: '先收起鱼竿，再进行其他活动。' };
  if (current.adventure.active || isExpeditionAway(current)) return { ...current, recentEvent: isExpeditionAway(current) ? '伙伴正在远行，请先在基地暂停或返回。' : adventureBusyMessage() };
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
  const item = options.item ?? getInventoryItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.item.missing') };
  const isUsable = 'usable' in item ? item.usable : true;
  if (!isUsable) return { ...current, recentEvent: t('pet.item.missing') };
  const displayItemName = options.itemName ?? item.name;

  const count = getInventoryCount(current.inventory, itemId);
  const isSingleUseItem = itemId === 'birthday_cake' || itemId === 'golden_apple' || item.kind === 'garden';
  const plan = getItemUsePlan(current, item, isSingleUseItem ? 1 : getEffectiveBatchQuantity(current, options.quantity));
  if (plan.blocked) return { ...current, recentEvent: overfedMessage };
  const quantity = plan.quantity;
  if (count < quantity) {
    return { ...current, recentEvent: t('pet.item.empty', { item: displayItemName }) };
  }

  if (isAdventureTreasure(itemId)) {
    if (quantity > getCommunitySaleable(current, itemId)) return { ...current, recentEvent: '这些战利品已设置自用保留量，请先在社区小摊调整保留。' };
    const coins = getAdventureTreasureValue(itemId) * quantity;
    if (clampCoins(current.coins + coins) !== current.coins + coins) return { ...current, recentEvent: '金币已满，战利品仍保留在仓库。' };
    return recordEarnedCoins({ ...current, coins: clampCoins(current.coins + coins), inventory: removeInventoryItem(current.inventory, itemId, quantity),
      recentEvent: L(`${displayItemName}已兑换为 ${coins} 金币。`, `Exchanged ${displayItemName} for ${coins} coins.`) }, coins);
  }

  const wokePet = current.isSleeping;
  const awakeCurrent = wokePet ? wakePet(current, now) : current;

  if (itemId === 'birthday_cake') {
    const statCap = getPetStatCap(awakeCurrent);
    const energyCap = getPetEnergyCap(awakeCurrent);
    return (wokePet ? incrementManualWake : (nextPet: PetState) => nextPet)(incrementAchievementItemUse(incrementAchievementCareAction(recordWishProgress(recordYearlyItemUse({
      ...withActivity(awakeCurrent, 'eat_cookie', now),
      isSleeping: false,
      hunger: Math.max(awakeCurrent.hunger, statCap),
      mood: statCap,
      cleanliness: statCap,
      energy: energyCap,
      health: statCap,
      inventory: removeInventoryItem(awakeCurrent.inventory, itemId),
      recentEvent: t(wokePet ? 'pet.item.use.birthdayCakeWoke' : 'pet.item.use.birthdayCake', {
        name: current.name,
        item: displayItemName,
      }),
    }, now), 'feed', now), 'feed'), itemId));
  }

  if (itemId === 'golden_apple') {
    const effect = getItemStatEffect(awakeCurrent, item);
    const heartAmount = randomInt(1, 10);
    const heartGain = applyHeartGain(awakeCurrent, heartAmount);
    const usedGoldenApple = recordYearlyItemUse(recordYearlyCareAction({
      ...withActivity(awakeCurrent, 'eat_cookie', now),
      isSleeping: false,
      hunger: applyItemHungerEffect(awakeCurrent, item, effect.hunger ?? 0),
      mood: clampPetStat(awakeCurrent, awakeCurrent.mood + (effect.mood ?? 0) + scalePetStatDelta(awakeCurrent, wokePet ? -2 : 0)),
      cleanliness: clampPetStat(awakeCurrent, awakeCurrent.cleanliness + (effect.cleanliness ?? 0)),
      energy: clampPetEnergy(awakeCurrent, awakeCurrent.energy + (effect.energy ?? 0)),
      health: clampPetHealth(awakeCurrent, awakeCurrent.health + (effect.health ?? 0)),
      hearts: heartGain.hearts,
      boostCards: heartGain.boostCards,
      inventory: removeInventoryItem(awakeCurrent.inventory, itemId),
      recentEvent: t(wokePet ? 'pet.item.use.goldenAppleWoke' : 'pet.item.use.goldenApple', {
        name: current.name,
        item: displayItemName,
        percent: goldenAppleRecoveryPercent,
        hearts: heartGain.amount,
      }),
    }, 'feed', now), now);
    const withAchievementUse = incrementAchievementItemUse(incrementAchievementCareAction(usedGoldenApple, 'feed'), itemId);
    const withWakeRecord = wokePet ? incrementManualWake(withAchievementUse) : withAchievementUse;
    return recordWishProgress(recordEarnedHearts(withWakeRecord, heartGain.amount), 'feed', now);
  }

  const effect = getItemStatEffect(current, item);
  const runtimeFavoriteFoodIdSet = options.favoriteFoodIds ? new Set<ItemId>(options.favoriteFoodIds) : favoriteFoodIdSet;
  const favoriteMoodBonus = runtimeFavoriteFoodIdSet.has(itemId) ? 4 * quantity : 0;
  const overuseKey: CareActionKey = item.kind === 'food' ? 'feed' : giftItemIdSet.has(itemId) ? 'gift' : 'touch';
  const overuse = applyActionStreak(awakeCurrent, overuseKey, now);
  const base = overuse.pet;
  let giftHeartPet = base;
  let giftHeartAmount = 0;
  const bookReward = itemId === 'picture_book' ? getPictureBookReward(base.partnerSchedule.skills.study, quantity) : undefined;
  const studyXp = bookReward?.xp ?? 0;
  if (giftItemIdSet.has(itemId) || itemId === 'picture_book') {
    for (let index = 0; index < (bookReward?.heartServings ?? quantity); index += 1) {
      if (itemId !== 'ribbon_bell' && itemId !== 'picture_book' && Math.random() >= 0.2) continue;
      const gain = applyHeartGain(giftHeartPet, 1);
      giftHeartAmount += gain.amount;
      giftHeartPet = { ...giftHeartPet, hearts: gain.hearts, boostCards: gain.boostCards };
    }
  }
  const defaultItemActivity: RecentActivity = item.kind === 'food' ? 'eat_cookie' : item.kind === 'care' ? 'bath' : 'happy';
  const itemActivity: Partial<Record<ItemId, RecentActivity>> = {
    emergency_biscuit: 'eat_cookie',
    bento: 'eat_noodles',
    orange: 'eat_cookie',
    apple: 'eat_cookie',
    banana: 'eat_cookie',
    watermelon: 'eat_cookie',
    nutri_meal: 'eat_meat',
    pig_trotter: 'eat_meat',
    strawberry_cake: 'eat_cookie',
    birthday_cake: 'eat_cookie',
    ad_milk: 'eat_cookie',
    strawberry_milk: 'eat_cookie',
    small_bouquet: 'give_heart',
    shiny_sticker: 'give_heart',
    soft_cloud_doll: 'happy',
    ribbon_bell: 'give_heart',
    toy_ball: 'happy',
    picture_book: 'reading_books',
    shampoo: 'bath',
    wet_wipes: 'bath',
    medicine: 'give_heart',
    vitamin_tablet: 'give_heart',
    blanket: 'happy',
    energy_drink: 'happy',
  };
  const baseEvent =
    item.kind === 'food'
      ? t(quantity > 1
        ? wokePet ? 'pet.item.use.foodBatchWoke' : 'pet.item.use.foodBatch'
        : wokePet ? 'pet.item.use.foodWoke' : 'pet.item.use.food', { name: base.name, item: displayItemName, count: quantity })
      : giftItemIdSet.has(itemId)
        ? t(quantity > 1 ? 'pet.item.use.giftBatch' : 'pet.item.use.gift', { name: base.name, item: displayItemName, count: quantity })
        : t(quantity > 1
          ? wokePet ? 'pet.item.use.careBatchWoke' : 'pet.item.use.careBatch'
          : wokePet ? 'pet.item.use.careWoke' : 'pet.item.use.care', { name: base.name, item: displayItemName, count: quantity });
  const favoriteText =
    favoriteMoodBonus > 0
      ? options.favoriteText?.(favoriteMoodBonus) ?? t('pet.item.use.favorite', { amount: favoriteMoodBonus })
      : '';
  const giftHeartText = giftHeartAmount > 0 ? t('pet.item.use.giftHeart', { hearts: giftHeartAmount }) : '';
  const usedItemPet = recordYearlyItemUse(
    recordYearlyCareAction({
      ...withActivity(base, itemActivity[itemId] ?? defaultItemActivity, now),
      isSleeping: false,
      hunger: applyItemHungerEffect(base, item, (effect.hunger ?? 0) * quantity),
      mood: clampPetStat(base, base.mood + (effect.mood ?? 0) * quantity + favoriteMoodBonus + scalePetStatDelta(base, wokePet ? -2 : 0)),
      cleanliness: clampPetStat(base, base.cleanliness + (effect.cleanliness ?? 0) * quantity),
      energy: clampPetEnergy(base, base.energy + (effect.energy ?? 0) * quantity),
      health: clampPetHealth(base, base.health + (effect.health ?? 0) * quantity),
      hearts: giftHeartPet.hearts,
      boostCards: giftHeartPet.boostCards,
      partnerSchedule: bookReward && studyXp > 0 ? { ...base.partnerSchedule, skills: { ...base.partnerSchedule.skills, study: bookReward.skill } } : base.partnerSchedule,
      inventory: removeInventoryItem(base.inventory, itemId, quantity),
      recentEvent: `${baseEvent}${favoriteText}${giftHeartText}${studyXp > 0 ? ` ${formatPracticeSkillXp('study', studyXp)}` : ''}${overuse.text}${plan.quantity < plan.requestedQuantity ? ` 已吃饱，本次仅使用 ${quantity} 份，其余未消耗。` : ''}`,
    }, overuseKey, now, quantity),
    now,
    quantity,
  );

  const withAchievementUse = incrementAchievementItemUse(incrementAchievementCareAction(usedItemPet, overuseKey, quantity), itemId, quantity);
  const withWakeRecord = wokePet ? incrementManualWake(withAchievementUse) : withAchievementUse;
  let withHeartRecord = giftHeartAmount > 0 ? recordEarnedHearts(withWakeRecord, giftHeartAmount) : withWakeRecord;
  if (itemId === 'toy_ball') withHeartRecord = unlockBallGame(withHeartRecord);
  withHeartRecord = recordDishTaste(withHeartRecord, itemId, options.actorId ?? 'official.furo', now);
  const wishAction = item.kind === 'food' ? 'feed' : itemId === 'shampoo' || itemId === 'wet_wipes' ? 'clean' : undefined;
  return wishAction ? recordWishProgress(withHeartRecord, wishAction, now) : withHeartRecord;
};

export const useInventoryItem = (...args: Parameters<typeof useInventoryItemInternal>): PetState =>
  updatePetSatiety(useInventoryItemInternal(...args));

export const interactWithPet = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  if (current.community.fishing.active) return { ...current, recentEvent: '先收起鱼竿，再进行其他活动。' };
  if (current.adventure.active || isExpeditionAway(current)) return { ...current, recentEvent: isExpeditionAway(current) ? '伙伴正在远行，请先在基地暂停或返回。' : adventureBusyMessage() };
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
  if (current.isSleeping) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.sleeping', { name: current.name }),
    };
  }

  if (isPetCriticallyHungry(current)) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.lowHunger', { name: current.name }),
    };
  }

  if (isPetLowEnergy(current)) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.lowEnergy', { name: current.name }),
    };
  }

  const interactionCost = getRandomPetInteractionCost(current);
  const base = current;
  const nextEnergy = clampPetEnergy(base, base.energy - interactionCost.energy);
  const actualEnergyCost = Math.max(0, base.energy - nextEnergy);

  if (base.mood >= petInteractionHeartMoodThreshold && base.health >= petInteractionHeartHealthThreshold) {
    const interactionHeartAmount = Math.max(1, Math.round(getPetStatScale(base)));
    const heartGain = applyHeartGain(base, interactionHeartAmount);
    const touched = recordWishProgress(recordYearlyCareAction({
      ...withActivity(base, 'give_heart', now, 3600),
      hearts: heartGain.hearts,
      boostCards: heartGain.boostCards,
      mood: clampPetStat(base, base.mood + scalePetStatDelta(base, -12)),
      hunger: clampPetHunger(base, base.hunger - interactionCost.hunger),
      cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
      energy: nextEnergy,
      lastPetInteractionAt: now,
      recentEvent: `${t('pet.interaction.heart', { name: base.name, hearts: heartGain.amount })}${interactionCost.text}`,
    }, 'touch', now), 'touch', now);
    return recordEarnedHearts(incrementAchievementCareAction(touched, 'touch'), heartGain.amount);
  }

  const lowHealthText = base.health < petInteractionHeartHealthThreshold
    ? ` ${t('pet.interaction.lowHealth', { health: petInteractionHeartHealthThreshold })}`
    : '';
  const touched = recordWishProgress(recordYearlyCareAction({
    ...withActivity(base, 'happy', now, 3200),
    mood: clampPetStat(base, base.mood + actualEnergyCost * petInteractionMoodPerEnergy),
    hunger: clampPetHunger(base, base.hunger - interactionCost.hunger),
    cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
    energy: nextEnergy,
    lastPetInteractionAt: now,
    recentEvent: `${t('pet.interaction.touch', { name: base.name })}${interactionCost.text}${lowHealthText}`,
  }, 'touch', now), 'touch', now);
  return incrementAchievementCareAction(touched, 'touch');
};
export const startPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  if (current.pomodoro.isRunning) return current;
  if (isExpeditionAway(current)) return { ...current, recentEvent: '伙伴正在远行，请先在基地暂停或返回，再开始专注。' };


  if (isPetLowEnergy(current)) {
    return { ...current, recentEvent: t('pet.pomodoro.start.lowEnergy', { name: current.name }) };
  }

  if (current.health <= getPetStatThreshold(current, pomodoroMinHealthThreshold)) {
    return { ...current, recentEvent: t('pet.pomodoro.start.lowHealth', { name: current.name }) };
  }

  const remainingMs =
    current.pomodoro.pausedRemainingMs > 0
      ? current.pomodoro.pausedRemainingMs
      : getDefaultPomodoroRemainingMs(current.pomodoro.phase, current.pomodoro.settings);
  const activity = pickPomodoroActivity();
  const phaseEndsAt = now + remainingMs;

  return {
    ...current,
    lastInteractionAt: now,
    recentActivity: current.isSleeping ? current.recentActivity : activity,
    recentActivityUntil: current.isSleeping ? current.recentActivityUntil : phaseEndsAt,
    recentEvent: t('pet.pomodoro.start.started', {
      name: current.name,
      phase: pomodoroPhaseLabels[current.pomodoro.phase],
    }),
    pomodoro: {
      ...current.pomodoro,
      isRunning: true,
      phaseStartedAt: now,
      phaseEndsAt,
      currentActivity: activity,
      pausedRemainingMs: 0,
      focusRewardCheckpointAt: current.pomodoro.phase === 'focus' ? now : 0,
    },
  };
};

export const pausePomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  if (!current.pomodoro.isRunning) return current;

  return pausePomodoroForReason(current, now, t('pet.pomodoro.pause.manual', { name: current.name }));
};
export const resetPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  const today = getEffectiveDailyDateKey(current, now);
  const settings = current.pomodoro.settings;
  const dailyCompletedFocusCount =
    current.pomodoro.dailyFocusDate === today ? current.pomodoro.dailyCompletedFocusCount : 0;
  const shouldTriggerResetEvent =
    current.pomodoro.sessionFocusMs >= pomodoroResetEventMinFocusMs && !current.pomodoro.hasTriggeredSessionResetEvent;
  const resetEventCoins = shouldTriggerResetEvent ? randomInt(1, 3) : 0;
  const resetEventMood = shouldTriggerResetEvent ? scalePetStatDelta(current, 1) : 0;
  const resetEventText = shouldTriggerResetEvent
    ? t('pet.pomodoro.resetSessionEvent', { name: current.name, coins: resetEventCoins, mood: roundPetStatDisplayAmount(resetEventMood) })
    : '';
  const resetBase = recordEarnedCoins({
    ...current,
    coins: clampCoins(current.coins + resetEventCoins),
    mood: clampPetStat(current, current.mood + resetEventMood),
  }, resetEventCoins);

  return {
    ...resetBase,
    recentEvent: t('pet.pomodoro.reset', { name: current.name }) + resetEventText,
    recentActivity: 'idle',
    recentActivityUntil: 0,
    lastInteractionAt: now,
    pomodoro: {
      ...defaultPomodoroState(now),
      settings,
      dailyFocusDate: today,
      dailyCompletedFocusCount,
      pausedRemainingMs: getPomodoroPhaseDurationMs('focus', settings),
    },
  };
};

export const updatePomodoroSettings = (
  pet: PetState,
  settings: Partial<PomodoroDurations>,
  now = Date.now(),
): PetState => {
  const current = advancePet(pet, now);
  const nextSettings = normalizePomodoroSettings({
    ...current.pomodoro.settings,
    ...settings,
  });

  return {
    ...current,
    pomodoro: {
      ...current.pomodoro,
      settings: nextSettings,
      pausedRemainingMs: current.pomodoro.isRunning
        ? current.pomodoro.pausedRemainingMs
        : getDefaultPomodoroRemainingMs(current.pomodoro.phase, nextSettings),
    },
  };
};

export const renamePet = (pet: PetState, name: string): PetState => {
  const nextName = name.trim().slice(0, 32) || pet.name;
  return {
    ...pet,
    name: nextName,
    recentEvent: t('pet.rename.updated', { name: nextName }),
  };
};

export const updatePetProfile = (pet: PetState, name: string, birthday?: PetBirthday): PetState => {
  const nextName = name.trim().slice(0, 32) || pet.name;
  const nextBirthday = normalizePetBirthday(birthday);

  return {
    ...pet,
    name: nextName,
    ...(nextBirthday ? { birthday: nextBirthday } : {}),
    recentEvent: t('pet.profile.updated', { name: nextName }),
  };
};



import { isExpeditionAway } from './expeditionData';
