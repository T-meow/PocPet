import assert from 'node:assert/strict';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { getDailyShopDiscountInfo, getShopItem } from '../src/core/items';
import {
  applyPetAction,
  buyItem,
  getItemPurchaseQuote,
  getWorkReward,
  interactWithPet,
  maxBatchQuantity,
  useInventoryItem,
} from '../src/core/petActions';
import { advancePet, isPetCriticallyHungry, isPetLowEnergy } from '../src/core/petLifecycle';
import {
  getPetInteractionEnergyCost,
  petInteractionHeartHealthThreshold,
  petInteractionHeartMoodThreshold,
  petInteractionMoodPerEnergy,
} from '../src/core/petCommon';
import { applyTimedEvent } from '../src/core/petEvents';
import {
  getPartnerScheduleClaimPreview,
  getPartnerScheduleOfferPreview,
  partnerScheduleDefinitions,
} from '../src/core/partnerSchedule';
import { createDefaultPet, getPrimaryStatus } from '../src/core/petState';
import { getPetStatCap, getPetStatThreshold, roundPetStatDisplayAmount, scalePetStatDelta } from '../src/core/petStats';
import type { ItemDefinition, PetState } from '../src/core/petTypes';
import { getValidQuantityPreset } from '../src/ui/QuantityPresets';

const now = new Date(2026, 6, 22, 12, 0, 0, 0).getTime();
const closeTo = (actual: number, expected: number, message: string) =>
  assert(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, got ${actual}`);
const atLevel = (level: number, overrides: Partial<PetState> = {}): PetState => {
  const pet = createDefaultPet(now);
  const cap = getPetStatCap(level);
  return {
    ...pet,
    level,
    hunger: cap,
    mood: cap,
    cleanliness: cap,
    energy: cap,
    health: cap,
    lastUpdatedAt: now,
    lastDailyEncounterAt: now,
    lastInteractionAt: now,
    lastEnergyRecoveryAt: now,
    ...overrides,
  };
};

assert.equal(getPetStatCap(1), 100);
assert.equal(getPetStatCap(20), 195);
assert.equal(getPetStatCap(50), 345);
assert.equal(getPetStatCap(99), 590);
closeTo(scalePetStatDelta(50, 10), 34.5, 'level 50 stat delta');
closeTo(getPetStatThreshold(99, 10), 59, 'level 99 ratio threshold');
assert.equal(roundPetStatDisplayAmount(34.5), 35, 'scaled positive values display as integers');
assert.equal(roundPetStatDisplayAmount(-20.7), -21, 'scaled costs display as integers');

const lowRatioPet = atLevel(50, { hunger: 110 });
assert.equal(getPrimaryStatus(lowRatioPet), 'hungry');
assert.equal(isPetCriticallyHungry(atLevel(50, { hunger: 34 })), true);
assert.equal(isPetCriticallyHungry(atLevel(50, { hunger: 35 })), false);
assert.equal(isPetLowEnergy(atLevel(99, { energy: 9 })), true);
assert.equal(isPetLowEnergy(atLevel(99, { energy: 10 })), false);

const timedEventPet = atLevel(50, { mood: 0, energy: 0 });
const timedEventResult = applyTimedEvent(timedEventPet, { effect: { mood: 10, energy: 10 }, text: 'event' }, now, '');
closeTo(timedEventResult.mood, 34.5, 'timed four-stat effects scale with the stat cap');
assert.equal(timedEventResult.energy, 10, 'timed energy effects stay fixed');

const scheduleDefinition = partnerScheduleDefinitions.find((definition) => definition.category === 'study' && definition.size === 'short');
assert(scheduleDefinition);
const levelOneSchedule = getPartnerScheduleOfferPreview(atLevel(1), scheduleDefinition, now);
const levelFiftySchedule = getPartnerScheduleOfferPreview(atLevel(50), scheduleDefinition, now);
closeTo(levelFiftySchedule.hungerCost, levelOneSchedule.hungerCost * 3.45, 'schedule hunger cost scales');
closeTo(levelFiftySchedule.moodCost, levelOneSchedule.moodCost * 3.45, 'schedule mood cost scales');
assert.equal(levelFiftySchedule.energyCost, levelOneSchedule.energyCost, 'schedule energy cost stays fixed');
const exerciseReward = {
  offerId: 'exercise-check',
  templateId: 'exercise_challenge',
  category: 'exercise' as const,
  size: 'long' as const,
  completedAt: now,
  coinReward: 100,
  skillXp: 10,
  trophyRewardMultiplier: 1,
  grantsMasterCompletion: false,
};
const levelOneExerciseReward = getPartnerScheduleClaimPreview(exerciseReward, 'category', 0, atLevel(1));
const levelFiftyExerciseReward = getPartnerScheduleClaimPreview(exerciseReward, 'category', 0, atLevel(50));
closeTo(levelFiftyExerciseReward.health ?? 0, (levelOneExerciseReward.health ?? 0) * 3.45, 'schedule health reward scales');
assert.equal(levelFiftyExerciseReward.energy, levelOneExerciseReward.energy, 'schedule energy reward stays fixed');

const levelOneClean = applyPetAction(atLevel(1, { cleanliness: 0, health: 50 }), 'clean', now);
const levelFiftyClean = applyPetAction(atLevel(50, { cleanliness: 0, health: 172.5 }), 'clean', now);
closeTo(
  levelFiftyClean.cleanliness,
  levelOneClean.cleanliness * (getPetStatCap(50) / getPetStatCap(1)),
  'clean action scales with the four-stat cap',
);
assert.equal(levelOneClean.energy, 97);
assert.equal(levelFiftyClean.energy, 342, 'energy action cost must remain fixed at 3');

const standardWorkReward = getWorkReward(atLevel(20, { weather: 'sunny' }), now, 12);
const extraEnergyWorkReward = getWorkReward(atLevel(20, { weather: 'sunny' }), now, 18);
assert.equal(standardWorkReward.energyAdjustedOutputCoins, 24);
assert.equal(standardWorkReward.levelBonusCoins, 19);
assert.equal(standardWorkReward.baseCoins, 43);
assert.equal(extraEnergyWorkReward.energyOutputMultiplier, 1.5);
assert.equal(extraEnergyWorkReward.energyAdjustedOutputCoins, 36, 'extra energy scales the work output before level rewards');
assert.equal(extraEnergyWorkReward.baseCoins, 55, 'the fixed level reward must not be multiplied by extra energy');

for (const [level, expectedHearts] of [[1, 1], [20, 2], [50, 3], [99, 6]] as const) {
  const pet = atLevel(level, { hearts: 0 });
  const interacted = interactWithPet(pet, now);
  assert.equal(interacted.hearts, expectedHearts, `level ${level} interaction heart gain`);
  closeTo(interacted.mood, getPetStatCap(level) - scalePetStatDelta(level, 12), `level ${level} interaction mood cost`);
  assert.equal(interacted.achievements.counters.heartEarnedTotal, expectedHearts, `level ${level} earned-heart counter`);
}

const fixedThresholdHeart = interactWithPet(atLevel(50, {
  hearts: 0,
  mood: petInteractionHeartMoodThreshold,
  health: petInteractionHeartHealthThreshold,
}), now);
assert.equal(fixedThresholdHeart.hearts, 3, 'interaction heart thresholds stay fixed at high levels');
const belowMoodThreshold = interactWithPet(atLevel(50, {
  hearts: 0,
  mood: petInteractionHeartMoodThreshold - 0.01,
  health: petInteractionHeartHealthThreshold,
}), now);
assert.equal(belowMoodThreshold.hearts, 0, 'mood below the fixed threshold does not grant hearts');
const belowHealthThreshold = interactWithPet(atLevel(50, {
  hearts: 0,
  mood: petInteractionHeartMoodThreshold,
  health: petInteractionHeartHealthThreshold - 0.01,
}), now);
assert.equal(belowHealthThreshold.hearts, 0, 'health below the fixed threshold does not grant hearts');
assert(belowHealthThreshold.recentEvent.includes(String(petInteractionHeartHealthThreshold)), 'low health interaction explains the heart requirement');

for (const level of [1, 20, 50, 99]) {
  const pet = atLevel(level, { mood: 0 });
  const interacted = interactWithPet(pet, now);
  const expectedEnergyCost = getPetInteractionEnergyCost(pet);
  assert.equal(pet.energy - interacted.energy, expectedEnergyCost, `level ${level} interaction consumes one percent energy`);
  closeTo(interacted.mood, expectedEnergyCost * petInteractionMoodPerEnergy, `level ${level} interaction mood follows actual energy cost`);
}

const rapidInteractionStart = atLevel(1, { hearts: 0 });
const rapidInteractionOne = interactWithPet(rapidInteractionStart, now);
const rapidInteractionTwo = interactWithPet(rapidInteractionOne, now);
const rapidInteractionThree = interactWithPet(rapidInteractionTwo, now);
assert.equal(rapidInteractionThree.hearts, 3, 'rapid consecutive interactions should grant hearts without a cooldown');
assert.equal(rapidInteractionThree.lastPetInteractionAt, now);

let rapidFeed = atLevel(1, { inventory: { emergency_biscuit: 3 } });
for (let index = 0; index < 3; index += 1) rapidFeed = useInventoryItem(rapidFeed, 'emergency_biscuit', now);
assert.equal(rapidFeed.mood, 97, 'rapid consecutive feeding should only apply the food effect');
assert.equal(rapidFeed.cleanliness, getPetStatCap(1), 'rapid consecutive feeding should not trigger an overuse penalty');

const originalRandom = Math.random;
Math.random = () => 0;
try {
  const bonusPet = atLevel(50, {
    hearts: 0,
    achievements: {
      ...atLevel(50).achievements,
      completedGoodEndingYears: [1],
    },
    boostCards: {
      ...atLevel(50).boostCards,
      friendPassExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
    },
  });
  const bonusInteraction = interactWithPet(bonusPet, now);
  assert.equal(bonusInteraction.hearts, 5, 'scaled base, good-ending chance bonus, and Boost Card bonus apply once per interaction');
  assert.equal(bonusInteraction.achievements.counters.heartEarnedTotal, 5, 'bonus hearts are recorded once');
} finally {
  Math.random = originalRandom;
}

const lifecycleStart = atLevel(50);
const oneHour = advancePet(lifecycleStart, now + 60 * 60 * 1000);
let stepped = lifecycleStart;
for (let second = 1; second <= 3600; second += 1) {
  stepped = advancePet(stepped, now + second * 1000);
}
closeTo(stepped.hunger, oneHour.hunger, 'one-second hunger decay matches one-hour settlement');
closeTo(stepped.mood, oneHour.mood, 'one-second mood decay matches one-hour settlement');
closeTo(stepped.cleanliness, oneHour.cleanliness, 'one-second cleanliness decay matches one-hour settlement');
closeTo(stepped.health, oneHour.health, 'one-second health decay matches one-hour settlement');

const levelNineteenUse = useInventoryItem(atLevel(19, {
  hunger: 0,
  inventory: { emergency_biscuit: 99 },
}), 'emergency_biscuit', now, { quantity: 99 });
assert.equal(levelNineteenUse.inventory.emergency_biscuit, 98, 'batch use is locked before level 20');

const levelTwentyUse = useInventoryItem(atLevel(20, {
  hunger: 0,
  mood: getPetStatCap(20),
  inventory: { emergency_biscuit: 99 },
}), 'emergency_biscuit', now, { quantity: 120 });
assert.equal(maxBatchQuantity, 99);
assert.equal(levelTwentyUse.inventory.emergency_biscuit, undefined);
assert.equal(levelTwentyUse.hunger, getPetStatCap(20));
assert.equal(levelTwentyUse.mood, getPetStatCap(20) - 99, 'item effects stay fixed per item at high levels');
assert.equal(levelTwentyUse.actionStreak.count, 0, 'feeding should not advance the action streak');
assert.equal(levelTwentyUse.achievements.counters.totalItemUseCount, 99);
assert.equal(levelTwentyUse.yearlyStats.itemUseCount, 99);

for (const [ownedCount, expectedPreset] of [[1, 1], [4, 1], [5, 5], [9, 5], [10, 10], [99, 10]] as const) {
  assert.equal(getValidQuantityPreset(10, ownedCount), expectedPreset, `preset fallback for ${ownedCount} owned items`);
}
assert.equal(getValidQuantityPreset(5, 10), 5, 'a still-valid selected preset must be retained');

const presetFiveUse = useInventoryItem(atLevel(20, {
  hunger: 0,
  inventory: { emergency_biscuit: 10 },
}), 'emergency_biscuit', now, { quantity: 5 });
assert.equal(presetFiveUse.inventory.emergency_biscuit, 5, 'x5 preset uses exactly five items');

const presetTenUse = useInventoryItem(atLevel(20, {
  hunger: 0,
  inventory: { emergency_biscuit: 10 },
}), 'emergency_biscuit', now, { quantity: 10 });
assert.equal(presetTenUse.inventory.emergency_biscuit, undefined, 'x10 preset uses exactly ten items');

const fixedEnergyUse = useInventoryItem(atLevel(99, {
  mood: 100,
  energy: 0,
  inventory: { energy_drink: 2 },
}), 'energy_drink', now, { quantity: 2 });
assert.equal(fixedEnergyUse.energy, 60, 'batch item energy recovery must not scale with level');
assert.equal(fixedEnergyUse.mood, 98, 'batch item mood effect must not scale with level');

const insufficientInventory = atLevel(20, { hunger: 0, inventory: { emergency_biscuit: 2 } });
const rejectedUse = useInventoryItem(insufficientInventory, 'emergency_biscuit', now, { quantity: 3 });
assert.equal(rejectedUse.inventory.emergency_biscuit, 2);
assert.equal(rejectedUse.hunger, 0, 'insufficient inventory must reject the entire batch');

const discountPet = atLevel(20, { coins: 100000 });
const discountInfo = getDailyShopDiscountInfo(discountPet, now);
assert(discountInfo?.items[0], 'daily discount should exist');
const discountItem = getShopItem(discountInfo.items[0].itemId);
assert(discountItem);
const discountedQuote = getItemPurchaseQuote(discountPet, discountItem.id, 3, now);
assert.equal(discountedQuote.totalPrice, discountInfo.items[0].price + discountItem.price * 2);
const bought = buyItem(discountPet, discountItem.id, now, { quantity: 3 });
assert.equal(bought.inventory[discountItem.id], 3);
assert.equal(bought.coins, discountPet.coins - discountedQuote.totalPrice);
assert.equal(bought.achievements.counters.purchaseCount, 3);
const fullPriceQuote = getItemPurchaseQuote(bought, discountItem.id, 3, now);
assert.equal(fullPriceQuote.totalPrice, discountItem.price * 3, 'daily discount only applies to the first item once');

const biscuitLimitPet = atLevel(20, {
  dailyBiscuitClaimDate: getDailyResetDateKey(now),
  dailyBiscuitClaims: 2,
});
assert.equal(getItemPurchaseQuote(biscuitLimitPet, 'emergency_biscuit', 1, now).canPurchase, true);
const rejectedBiscuitQuote = getItemPurchaseQuote(biscuitLimitPet, 'emergency_biscuit', 2, now);
assert.equal(rejectedBiscuitQuote.canPurchase, false);
assert.equal(rejectedBiscuitQuote.remainingDailyLimit, 1);

const modItem: ItemDefinition = {
  id: 'test.mod:snack',
  name: 'Test Snack',
  kind: 'food',
  price: 7,
  effect: { hunger: 3, energy: 2 },
  source: 'mod',
  shop: true,
  tags: [],
  usable: true,
  summary: 'Test item',
};
const boughtMod = buyItem(atLevel(20, { coins: 100 }), modItem.id, now, { item: modItem, quantity: 4 });
assert.equal(boughtMod.inventory[modItem.id], 4);
assert.equal(boughtMod.coins, 72);
const usedMod = useInventoryItem({ ...boughtMod, hunger: 0, energy: 0, lastUpdatedAt: now }, modItem.id, now, {
  item: modItem,
  quantity: 4,
});
assert.equal(usedMod.hunger, 12, 'mod item effects remain fixed');
assert.equal(usedMod.energy, 8, 'mod item energy effects remain fixed');
assert.equal(usedMod.inventory[modItem.id], undefined);

console.log('stat scaling and batch checks passed');
