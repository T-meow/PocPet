import assert from 'node:assert/strict';
import { buyItem, interactWithPet, upgradePet, useInventoryItem, applyPetAction } from '../src/core/petActions';
import { achievementDefinitions, claimAchievementReward, evaluateAchievements, getAchievementEffects, taskMasterCompletionRatio } from '../src/core/achievements';
import {
  applyBoostCardWorkBonus,
  boostCardDefinitions,
  buyBoostCard,
  canClaimBoostCardDailyReward,
  claimBoostCardDailyReward,
  normalizeBoostCardState,
} from '../src/core/boostCards';
import { claimAvailableDateRewards } from '../src/core/dateRewards';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { claimDailyWishReward, getDailyWishView } from '../src/core/dailyWishes';
import { advancePet, advancePomodoro } from '../src/core/petLifecycle';
import { plantTree, selectGardenSlot } from '../src/core/garden';
import { getEnergyRecoveryIntervalMs, scalePetStatDelta } from '../src/core/petStats';
import { getSeasonForDate } from '../src/core/season';
import {
  advancePartnerSchedule,
  claimPartnerScheduleResult,
  getPartnerScheduleClaimPreview,
  getPartnerScheduleDefinition,
  getPartnerScheduleExtraRewardCopies,
  getPartnerScheduleOfferPreview,
  getPartnerScheduleNeighborOfferId,
  getPartnerScheduleProgress,
  getPartnerScheduleSkillXpNeeded,
  getPartnerScheduleStartCheck,
  getPartnerScheduleSkillXpReward,
  normalizePartnerScheduleState,
  partnerScheduleDefinitions,
  partnerScheduleSchemaVersion,
  startPartnerSchedule,
} from '../src/core/partnerSchedule';
import { getNeighborIdentities, neighborGiftDailyLimit, resolveNeighborName, selectNeighborReference } from '../src/core/neighbors';
import { selectNeighborGift } from '../src/core/neighborGifts';
import { applyTimedEvent, getRandomDailyEncounter, getRandomOfflineEvent } from '../src/core/petEvents';
import {
  getPartnerScheduleCategoryEffects,
  getPartnerScheduleCrossSystemEffects,
  getPartnerScheduleGlobalCoinBonusPercent,
  getPartnerScheduleUnlockedOfferCount,
  partnerScheduleDailyCompletionLimit,
} from '../src/core/partnerScheduleEffects';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { loadStoredPetJson } from '../src/core/saveCodec';
import { startPomodoro } from '../src/core/petActions';
import { normalizePetModLibraryState, petModLibraryLimit } from '../src/core/modStorage';
import { ensureYearlyStatsForDate } from '../src/core/yearlyStats';
import type { NeighborEventContext, NeighborGiftCandidate, PartnerScheduleCategory, PartnerScheduleResult, PartnerScheduleState, PetState } from '../src/core/petTypes';

const minuteMs = 60 * 1000;
const now = new Date(2026, 6, 20, 12, 0, 0).getTime();
const skill = (level: number, xp = 0, masterCompletions = 0) => ({ level, xp, masterCompletions });

const createReadyPet = (level: number, createdAt = now - 10 * 24 * 60 * minuteMs) => {
  const pet = createDefaultPet(now);
  return advancePartnerSchedule({
    ...pet,
    level,
    createdAt,
    energy: 100,
    hunger: 100,
    mood: 100,
    cleanliness: 100,
    health: 100,
    lastUpdatedAt: now,
    lastEnergyRecoveryAt: now,
  }, now);
};

const withCategorySkill = (
  pet: PetState,
  category: PartnerScheduleCategory,
  nextSkill: ReturnType<typeof skill>,
): PetState => ({
  ...pet,
  partnerSchedule: {
    ...pet.partnerSchedule,
    skills: { ...pet.partnerSchedule.skills, [category]: nextSkill },
  },
});

const level2 = createReadyPet(2);
assert.equal(level2.partnerSchedule.offers.length, 0, 'Lv2 should remain locked');

const level3 = createReadyPet(3);
assert.equal(level3.partnerSchedule.offers.length, 3, 'Lv3 should receive three offers');
const sameBoard = createReadyPet(3, level3.createdAt);
assert.deepEqual(sameBoard.partnerSchedule.offers, level3.partnerSchedule.offers, 'same-day board should be deterministic');

const level8 = createReadyPet(8);
assert(level8.partnerSchedule.offers.some((offer) => getPartnerScheduleDefinition(offer.templateId)?.size === 'long'), 'Lv8 should receive a long offer');
assert.deepEqual(
  ['short', 'standard', 'long'].map((size) => partnerScheduleDefinitions.find((item) => item.size === size)?.durationMinutes),
  [45, 120, 240],
  'activity durations should use the unified real-time values',
);
assert.deepEqual(
  ['short', 'standard', 'long'].map((size) => getPartnerScheduleSkillXpReward(size as 'short' | 'standard' | 'long')),
  [10, 23, 50],
  'skill XP should use the unified reward values',
);
const xpCurve = Array.from({ length: 9 }, (_, index) => getPartnerScheduleSkillXpNeeded(index + 1));
assert.deepEqual(xpCurve, [40, 60, 90, 130, 180, 260, 360, 480, 620]);
assert.equal(xpCurve.reduce((sum, amount) => sum + amount, 0), 2220, 'one skill should require 2220 XP to reach Lv10');

const allLevel3 = {
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    skills: { study: skill(3), cooking: skill(3), garden: skill(3), exercise: skill(3) },
  },
};
assert.equal(getPartnerScheduleGlobalCoinBonusPercent(allLevel3.partnerSchedule.skills), 5);
assert.equal(getPartnerScheduleUnlockedOfferCount(allLevel3.partnerSchedule.skills), 4);
assert.equal(allLevel3.partnerSchedule.offers.length, 3, 'new choice count should wait for the next board reset');
const level3MilestoneNextDay = advancePartnerSchedule(allLevel3, now + 24 * 60 * minuteMs);
assert.equal(level3MilestoneNextDay.partnerSchedule.offers.length, 4);
assert.equal(new Set(level3MilestoneNextDay.partnerSchedule.offers.map((item) => getPartnerScheduleDefinition(item.templateId)?.category)).size, 4);

const allLevel6 = {
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    skills: { study: skill(6), cooking: skill(6), garden: skill(6), exercise: skill(6) },
  },
};
assert.equal(getPartnerScheduleGlobalCoinBonusPercent(allLevel6.partnerSchedule.skills), 15);
assert.equal(getPartnerScheduleUnlockedOfferCount(allLevel6.partnerSchedule.skills), 5);
assert.equal(allLevel6.partnerSchedule.offers.length, 3);
const level6MilestoneNextDay = advancePartnerSchedule(allLevel6, now + 24 * 60 * minuteMs);
assert.equal(level6MilestoneNextDay.partnerSchedule.offers.length, 5);
assert.equal(new Set(level6MilestoneNextDay.partnerSchedule.offers.slice(0, 4).map((item) => getPartnerScheduleDefinition(item.templateId)?.category)).size, 4);
const expandedSameDay = normalizePartnerScheduleState({
  ...allLevel6.partnerSchedule,
  boardOfferCount: 5,
  offers: [],
}, { level: allLevel6.level, createdAt: allLevel6.createdAt }, now);
assert.deepEqual(
  expandedSameDay.offers.slice(0, 3).map((item) => item.templateId),
  allLevel6.partnerSchedule.offers.map((item) => item.templateId),
  'expanding a board should preserve the original first three deterministic offers',
);
const dailyLimitState = {
  ...allLevel6,
  partnerSchedule: {
    ...expandedSameDay,
    completedOfferIds: expandedSameDay.offers.slice(0, partnerScheduleDailyCompletionLimit).map((item) => item.id),
  },
};
assert.equal(getPartnerScheduleStartCheck(dailyLimitState, expandedSameDay.offers[3].id, now).reason, 'daily_limit');
const resetDailyLimitState = advancePartnerSchedule(dailyLimitState, now + 24 * 60 * minuteMs);
assert.equal(resetDailyLimitState.partnerSchedule.completedOfferIds.length, 0, 'daily completion limit should reset with the board');
assert.equal(resetDailyLimitState.partnerSchedule.offers.length, 5);

const offer = level3.partnerSchedule.offers[0];
const definition = getPartnerScheduleDefinition(offer.templateId);
assert(definition, 'offer definition should exist');
const milestoneDefinition = getPartnerScheduleDefinition(level8.partnerSchedule.offers[0].templateId)!;
const milestoneBasePreview = getPartnerScheduleOfferPreview(level8, milestoneDefinition, now);
assert.equal(
  getPartnerScheduleOfferPreview(allLevel3, milestoneDefinition, now).coinReward,
  Math.round(milestoneBasePreview.coinReward * 1.05),
  'all-skill Lv3 coin bonus should apply immediately to newly started schedules',
);
assert.equal(
  getPartnerScheduleOfferPreview(allLevel6, milestoneDefinition, now).coinReward,
  Math.round(milestoneBasePreview.coinReward * 1.15),
  'all-skill Lv6 total coin bonus should be 15%',
);
const basePreview = getPartnerScheduleOfferPreview(level3, definition, now);
const level2Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(2)), definition, now);
assert.equal(level2Preview.energyCost, Math.max(1, Math.round(definition.energyCost * 0.9)));
const level4Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(4)), definition, now);
assert.equal(level4Preview.hungerCost, scalePetStatDelta(level3, Math.max(1, Math.round(definition.hungerCost * 0.9))));
assert.equal(level4Preview.moodCost, scalePetStatDelta(level3, Math.max(1, Math.round(definition.moodCost * 0.9))));
const level5Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(5)), definition, now);
assert.equal(level5Preview.durationMs, Math.round(definition.durationMinutes * minuteMs * 0.95));
const level7Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(7)), definition, now);
assert.equal(level7Preview.skillXp, Math.round(getPartnerScheduleSkillXpReward(definition.size) * 1.15));
const level8Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(8)), definition, now);
assert.equal(level8Preview.coinReward, Math.round(basePreview.coinReward * 1.05));
const level9Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(9)), definition, now);
assert.equal(level9Preview.durationMs, Math.round(definition.durationMinutes * minuteMs * 0.9));
const level10Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(10)), definition, now);
assert.equal(level10Preview.skillXp, 0);
assert(level10Preview.grantsMasterCompletion);
const master10Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(10, 0, 10)), definition, now);
assert.equal(master10Preview.energyCost, Math.max(1, Math.round(definition.energyCost * 0.85)));
const master30Preview = getPartnerScheduleOfferPreview(withCategorySkill(level3, definition.category, skill(10, 0, 30)), definition, now);
assert.equal(master30Preview.coinReward, Math.round(basePreview.coinReward * 1.1));
assert.equal(getPartnerScheduleCategoryEffects(skill(10, 0, 9)).energyCostMultiplier, 0.9);
assert.equal(getPartnerScheduleCategoryEffects(skill(10, 0, 10)).energyCostMultiplier, 0.85);
assert.equal(getPartnerScheduleCategoryEffects(skill(10, 0, 29)).coinBonusPercent, 5);
assert.equal(getPartnerScheduleCategoryEffects(skill(10, 0, 30)).coinBonusPercent, 10);

const discountedStartPet = withCategorySkill(level3, definition.category, skill(4));
const discountedStartPreview = getPartnerScheduleOfferPreview(discountedStartPet, definition, now);
const exactCostPet = {
  ...discountedStartPet,
  energy: discountedStartPreview.energyCost,
  hunger: discountedStartPreview.hungerCost,
  mood: discountedStartPreview.moodCost,
};
assert.equal(getPartnerScheduleStartCheck(exactCostPet, offer.id, now).canStart, true, 'displayed costs should be sufficient to start a schedule');
assert.equal(getPartnerScheduleStartCheck({ ...exactCostPet, energy: exactCostPet.energy - 1 }, offer.id, now).reason, 'energy');
assert.equal(getPartnerScheduleStartCheck({ ...exactCostPet, hunger: exactCostPet.hunger - 1 }, offer.id, now).reason, 'hunger');
assert.equal(getPartnerScheduleStartCheck({ ...exactCostPet, mood: exactCostPet.mood - 1 }, offer.id, now).reason, 'mood');

let fullBoardPet = createReadyPet(8);
let fullBoardNow = now;
for (const size of ['short', 'standard', 'long'] as const) {
  const nextOffer = fullBoardPet.partnerSchedule.offers.find((item) => getPartnerScheduleDefinition(item.templateId)?.size === size);
  assert(nextOffer, `Lv8 board should contain a ${size} schedule`);
  assert.equal(
    getPartnerScheduleStartCheck(fullBoardPet, nextOffer.id, fullBoardNow).canStart,
    true,
    `a full-energy pet should be able to complete the ${size} schedule in the three-item sequence`,
  );
  fullBoardPet = startPartnerSchedule(fullBoardPet, nextOffer.id, fullBoardNow);
  const completedAt = fullBoardPet.partnerSchedule.active!.endsAt;
  fullBoardPet = claimPartnerScheduleResult(advancePartnerSchedule(fullBoardPet, completedAt), 'coins', completedAt);
  fullBoardNow = completedAt;
}
assert.equal(fullBoardPet.partnerSchedule.completedOfferIds.length, 3, 'all three Lv8 schedules should be completable from 100 starting stats');

const started = startPartnerSchedule(level3, offer.id, now);
assert(started.partnerSchedule.active, 'schedule should start');
assert.equal(started.partnerSchedule.active.endsAt - started.partnerSchedule.active.startedAt, definition.durationMinutes * minuteMs);
assert.equal(started.lastEnergyRecoveryAt, now, 'schedule start should reset the energy recovery baseline');

const startStats = {
  hunger: started.hunger,
  mood: started.mood,
  cleanliness: started.cleanliness,
  health: started.health,
  energy: started.energy,
};
const halfway = advancePet(started, now + 20 * minuteMs);
assert.deepEqual(
  {
    hunger: halfway.hunger,
    mood: halfway.mood,
    cleanliness: halfway.cleanliness,
    health: halfway.health,
    energy: halfway.energy,
  },
  startStats,
  'natural stats and energy recovery should freeze during the schedule',
);
assert.equal(halfway.ageSeconds - started.ageSeconds, 20 * 60, 'age should continue during the schedule');

const pomodoroStarted = startPomodoro(started, now + minuteMs);
const pomodoroAdvanced = advancePet(pomodoroStarted, now + 6 * minuteMs);
assert.equal(
  pomodoroAdvanced.partnerSchedule.active?.endsAt,
  started.partnerSchedule.active.endsAt,
  'Pomodoro progress should not change the schedule end time',
);
assert(pomodoroAdvanced.pomodoro.sessionFocusMs > 0, 'Pomodoro should continue independently');

const blockedAction = applyPetAction(started, 'clean', now + minuteMs);
assert.equal(blockedAction.cleanliness, started.cleanliness, 'cleaning should be blocked in core');
assert(blockedAction.partnerSchedule.active, 'blocked care should not cancel the schedule');
const blockedItem = useInventoryItem(started, 'emergency_biscuit', now + minuteMs);
assert.deepEqual(blockedItem.inventory, started.inventory, 'item use should be blocked in core');
const blockedTouch = interactWithPet(started, now + minuteMs);
assert.equal(blockedTouch.lastPetInteractionAt, started.lastPetInteractionAt, 'pet touch should be blocked in core');
const blockedUpgrade = upgradePet({ ...started, hearts: 999 }, now + minuteMs);
assert.equal(blockedUpgrade.level, started.level, 'pet upgrade should be blocked in core');

const boughtWhileBusy = buyItem(started, 'emergency_biscuit', now + minuteMs);
assert((boughtWhileBusy.inventory.emergency_biscuit ?? 0) > (started.inventory.emergency_biscuit ?? 0), 'shopping should remain available');
const gardenWhileBusy = selectGardenSlot(started, 1, now + minuteMs);
assert.equal(gardenWhileBusy.garden.activeSlotIndex, 1, 'garden actions should remain available');
assert(gardenWhileBusy.partnerSchedule.active);

const completedAt = started.partnerSchedule.active.endsAt;
const completed = advancePet(started, completedAt + 30 * minuteMs);
assert.equal(completed.partnerSchedule.active, undefined, 'expired schedule should stop');
assert(completed.partnerSchedule.pendingResult, 'expired schedule should become claimable');
assert(completed.hunger < started.hunger, 'post-schedule offline time should decay hunger');
assert(completed.hunger > started.hunger - 5, 'only post-schedule offline time should decay hunger');
assert(completed.lastEnergyRecoveryAt >= completedAt, 'energy recovery baseline should resume at schedule end');
const loadedAfterCompletion = loadStoredPetJson(JSON.stringify(started), completedAt + 30 * minuteMs);
assert.equal(loadedAfterCompletion.status, 'ok');
assert.equal(loadedAfterCompletion.status === 'ok' ? loadedAfterCompletion.pet.partnerSchedule.active : undefined, undefined);
assert(loadedAfterCompletion.status === 'ok' && loadedAfterCompletion.pet.partnerSchedule.pendingResult, 'stored expired activity should become claimable on load');
assert(loadedAfterCompletion.status === 'ok' && Math.abs(loadedAfterCompletion.pet.hunger - completed.hunger) < 0.01, 'load should preserve the same frozen activity interval');

const pendingAdvanced = advancePet(completed, completedAt + 60 * minuteMs);
assert(pendingAdvanced.hunger < completed.hunger, 'pending rewards must not freeze natural decay');
const claimed = claimPartnerScheduleResult(completed, 'coins', completedAt + 30 * minuteMs);
const claimedAgain = claimPartnerScheduleResult(claimed, 'coins', completedAt + 30 * minuteMs);
assert.equal(claimedAgain.coins, claimed.coins, 'claiming twice must not duplicate rewards');
assert.equal(claimed.achievements.counters.partnerScheduleClaimCount, 1, 'successful claims should count once');
assert.equal(claimed.achievements.counters.partnerScheduleClaimCountsByCategory[definition.category], 1);
assert.equal(claimedAgain.achievements.counters.partnerScheduleClaimCount, 1, 'duplicate claims must not advance achievements');
const evaluatedClaim = evaluateAchievements(claimed, completedAt + 30 * minuteMs);
assert(evaluatedClaim.achievements.unlockedAtById.schedule_first, 'the first schedule claim should unlock its achievement');

const nearMasterSkillPet = withCategorySkill(level8, definition.category, skill(9, 619));
const reachesMasterState: PetState = {
  ...nearMasterSkillPet,
  partnerSchedule: {
    ...nearMasterSkillPet.partnerSchedule,
    pendingResult: {
      offerId: 'reach-master',
      templateId: definition.id,
      category: definition.category,
      size: definition.size,
      completedAt: now,
      coinReward: 10,
      skillXp: 1,
      grantsMasterCompletion: false,
    },
  },
};
const reachedMaster = claimPartnerScheduleResult(reachesMasterState, 'coins', now);
assert.equal(reachedMaster.partnerSchedule.skills[definition.category].level, 10);
assert.equal(reachedMaster.partnerSchedule.skills[definition.category].masterCompletions, 0, 'the claim that reaches Lv10 must not count as a master completion');
const masterCompletionState: PetState = {
  ...reachedMaster,
  partnerSchedule: {
    ...reachedMaster.partnerSchedule,
    pendingResult: {
      offerId: 'first-master-completion',
      templateId: definition.id,
      category: definition.category,
      size: definition.size,
      completedAt: now,
      coinReward: 10,
      skillXp: 0,
      grantsMasterCompletion: true,
    },
  },
};
const firstMasterCompletion = claimPartnerScheduleResult(masterCompletionState, 'coins', now);
assert.equal(firstMasterCompletion.partnerSchedule.skills[definition.category].masterCompletions, 1);
const afterSixtyMasterState = withCategorySkill(masterCompletionState, definition.category, skill(10, 0, 60));
const afterSixtyMasterClaim = claimPartnerScheduleResult(afterSixtyMasterState, 'coins', now);
assert.equal(afterSixtyMasterClaim.partnerSchedule.skills[definition.category].masterCompletions, 61, 'master completions should keep counting after all effects are capped');

const readyWishPet = createReadyPet(8);
const studyMasterPet = withCategorySkill({
  ...readyWishPet,
  dailyWish: {
    ...readyWishPet.dailyWish,
    progress: readyWishPet.dailyWish.target,
    completedAt: now,
  },
}, 'study', skill(10));
const expectedWishCoins = Math.round(studyMasterPet.dailyWish.rewardCoins * 1.1);
assert(getDailyWishView(studyMasterPet).rewardText.includes(String(expectedWishCoins)), 'daily wish preview should include the study master bonus');
const claimedWish = claimDailyWishReward(studyMasterPet, now);
assert.equal(claimedWish.coins - studyMasterPet.coins, expectedWishCoins, 'daily wish claim should use the displayed study master reward');

const foodTestPet = {
  ...createReadyPet(8),
  hunger: 20,
  mood: 20,
  cleanliness: 20,
  energy: 20,
  health: 20,
  inventory: { emergency_biscuit: 1, golden_apple: 1 },
};
const normalFoodUse = useInventoryItem(foodTestPet, 'emergency_biscuit', now);
const cookingMasterFoodUse = useInventoryItem(withCategorySkill(foodTestPet, 'cooking', skill(10)), 'emergency_biscuit', now);
assert(cookingMasterFoodUse.hunger > normalFoodUse.hunger, 'cooking mastery should improve normal food effects');
const normalGoldenAppleUse = useInventoryItem(foodTestPet, 'golden_apple', now);
const cookingGoldenAppleUse = useInventoryItem(withCategorySkill(foodTestPet, 'cooking', skill(10)), 'golden_apple', now);
assert.equal(cookingGoldenAppleUse.hunger, normalGoldenAppleUse.hunger, 'golden apple fixed effects must ignore cooking mastery');

const gardenTestPet = {
  ...createReadyPet(8),
  inventory: { fruit_tree_sapling: 1 },
  garden: {
    ...createReadyPet(8).garden,
    slots: createReadyPet(8).garden.slots.map((slot, index) => index === 0 ? { ...slot, unlocked: true } : slot),
  },
};
const normalPlant = plantTree(gardenTestPet, 0, 'fruit_tree', now);
const gardenMasterPlant = plantTree(withCategorySkill(gardenTestPet, 'garden', skill(10)), 0, 'fruit_tree', now);
const normalGrowDuration = normalPlant.garden.slots[0].nextReadyAt - now;
const masterGrowDuration = gardenMasterPlant.garden.slots[0].nextReadyAt - now;
assert.equal(masterGrowDuration, Math.round(normalGrowDuration * 0.95), 'garden mastery should affect only newly generated growth time');

const recoveryTestPet = createReadyPet(8);
const exerciseMasterPet = withCategorySkill(recoveryTestPet, 'exercise', skill(10));
assert.equal(getEnergyRecoveryIntervalMs(exerciseMasterPet, false, now), Math.round(getEnergyRecoveryIntervalMs(recoveryTestPet, false, now) * 0.92));
assert.equal(getEnergyRecoveryIntervalMs(exerciseMasterPet, true, now), getEnergyRecoveryIntervalMs(recoveryTestPet, true, now), 'exercise mastery must not affect sleep recovery');
const master60Effects = getPartnerScheduleCrossSystemEffects({
  ...studyMasterPet,
  partnerSchedule: {
    ...studyMasterPet.partnerSchedule,
    skills: {
      study: skill(10, 0, 60),
      cooking: skill(10, 0, 60),
      garden: skill(10, 0, 60),
      exercise: skill(10, 0, 60),
    },
  },
});
assert.deepEqual(master60Effects, {
  dailyWishCoinMultiplier: 1.2,
  foodEffectMultiplier: 1.15,
  gardenTimeMultiplier: 0.92,
  awakeEnergyRecoveryMultiplier: 0.88,
});

const standardDefinition = partnerScheduleDefinitions.find((item) => item.size === 'standard');
assert(standardDefinition, 'a standard schedule definition should exist');
const categoryRewardState: PetState = {
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    active: undefined,
    pendingResult: {
      offerId: 'achievement-category-reward',
      templateId: standardDefinition.id,
      category: standardDefinition.category,
      size: standardDefinition.size,
      completedAt: now,
      coinReward: 100,
      skillXp: getPartnerScheduleSkillXpReward('standard'),
      grantsMasterCompletion: false,
    },
  },
};
const categoryRewardClaimed = claimPartnerScheduleResult(categoryRewardState, 'category', now);
assert.equal(categoryRewardClaimed.achievements.counters.partnerScheduleCategoryRewardClaimCount, 1, 'category reward choices should be tracked');

const withUnlockedAchievements = (pet: PetState, ids: readonly string[]): PetState => ({
  ...pet,
  achievements: {
    ...pet.achievements,
    unlockedAtById: {
      ...pet.achievements.unlockedAtById,
      ...Object.fromEntries(ids.map((id) => [id, now])),
    },
  },
});

const findResultWithExtraCopies = (
  pet: PetState,
  baseResult: PartnerScheduleResult,
  expectedCopies: number,
): PartnerScheduleResult => {
  for (let index = 0; index < 1000; index += 1) {
    const candidate = { ...baseResult, offerId: `${baseResult.offerId}:${index}` };
    if (getPartnerScheduleExtraRewardCopies(pet, candidate) === expectedCopies) return candidate;
  }
  throw new Error(`Could not find a deterministic schedule result with ${expectedCopies} extra copies`);
};

const fullBoardBonusPet = withUnlockedAchievements(level8, ['schedule_daily_three']);
const allSkillsBonusPet = withUnlockedAchievements(level8, ['schedule_all_skills_max']);
const combinedScheduleBonusPet = withUnlockedAchievements(level8, ['schedule_daily_three', 'schedule_all_skills_max']);
assert.equal(getAchievementEffects(level8).partnerScheduleExtraRewardChancePercent, 0);
assert.equal(getAchievementEffects(fullBoardBonusPet).partnerScheduleExtraRewardChancePercent, 10);
assert.equal(getAchievementEffects(allSkillsBonusPet).partnerScheduleExtraRewardChancePercent, 20);
assert.equal(getAchievementEffects(combinedScheduleBonusPet).partnerScheduleExtraRewardChancePercent, 30);

const baseBonusResult: PartnerScheduleResult = {
  offerId: 'deterministic-schedule-bonus',
  templateId: standardDefinition.id,
  category: standardDefinition.category,
  size: 'standard',
  completedAt: now,
  coinReward: 100,
  skillXp: 4,
  trophyRewardMultiplier: 1,
  grantsMasterCompletion: false,
};
const deterministicBonusResult = findResultWithExtraCopies(combinedScheduleBonusPet, baseBonusResult, 1);
const deterministicNoBonusResult = findResultWithExtraCopies(combinedScheduleBonusPet, baseBonusResult, 0);
assert.equal(getPartnerScheduleExtraRewardCopies(combinedScheduleBonusPet, deterministicBonusResult), 1);
assert.equal(getPartnerScheduleExtraRewardCopies(combinedScheduleBonusPet, { ...deterministicBonusResult }), 1, 'the same result snapshot should keep the same bonus roll');
assert.equal(getPartnerScheduleExtraRewardCopies(combinedScheduleBonusPet, deterministicNoBonusResult), 0);

const coinBonusPreview = getPartnerScheduleClaimPreview(deterministicBonusResult, 'coins');
const coinBonusState: PetState = {
  ...combinedScheduleBonusPet,
  coins: 100,
  energy: 50,
  health: 50,
  mood: 50,
  partnerSchedule: {
    ...combinedScheduleBonusPet.partnerSchedule,
    offers: [
      { id: deterministicBonusResult.offerId, templateId: deterministicBonusResult.templateId, dateKey: combinedScheduleBonusPet.partnerSchedule.boardDateKey },
      ...combinedScheduleBonusPet.partnerSchedule.offers.slice(1),
    ],
    completedOfferIds: [],
    active: undefined,
    pendingResult: deterministicBonusResult,
    skills: {
      ...combinedScheduleBonusPet.partnerSchedule.skills,
      [deterministicBonusResult.category]: skill(1),
    },
  },
};
const coinBonusClaimed = claimPartnerScheduleResult(coinBonusState, 'coins', now);
assert.equal(coinBonusClaimed.coins - coinBonusState.coins, coinBonusPreview.coins * 2, 'coin choice should receive a complete extra coin reward');
assert.equal(coinBonusClaimed.partnerSchedule.skills[deterministicBonusResult.category].xp, coinBonusPreview.skillXp * 2, 'coin choice should receive a complete extra skill reward');
assert.equal(coinBonusClaimed.partnerSchedule.completedOfferIds.length, 1, 'bonus rewards must not duplicate daily completion records');
assert.equal(coinBonusClaimed.achievements.counters.partnerScheduleClaimCount, 1, 'bonus rewards must not duplicate achievement claim counts');
assert.equal(coinBonusClaimed.achievements.counters.partnerScheduleCategoryRewardClaimCount, 0);

for (const category of ['study', 'cooking', 'garden', 'exercise'] as const) {
  const categoryDefinition = partnerScheduleDefinitions.find((item) => item.category === category && item.size === 'standard');
  assert(categoryDefinition, `${category} standard schedule should exist`);
  const categoryResult = findResultWithExtraCopies(combinedScheduleBonusPet, {
    ...baseBonusResult,
    offerId: `deterministic-${category}-bonus`,
    templateId: categoryDefinition.id,
    category,
  }, 1);
  const categoryBonusState: PetState = {
    ...combinedScheduleBonusPet,
    coins: 100,
    energy: 50,
    health: 50,
    mood: 50,
    partnerSchedule: {
      ...combinedScheduleBonusPet.partnerSchedule,
      offers: [
        { id: categoryResult.offerId, templateId: categoryResult.templateId, dateKey: combinedScheduleBonusPet.partnerSchedule.boardDateKey },
        ...combinedScheduleBonusPet.partnerSchedule.offers.slice(1),
      ],
      completedOfferIds: [],
      active: undefined,
      pendingResult: categoryResult,
      skills: { ...combinedScheduleBonusPet.partnerSchedule.skills, [category]: skill(1) },
    },
  };
  const categoryPreview = getPartnerScheduleClaimPreview(categoryResult, 'category', 0, categoryBonusState);
  const categoryBonusClaimed = claimPartnerScheduleResult(categoryBonusState, 'category', now);
  assert.equal(categoryBonusClaimed.coins - categoryBonusState.coins, categoryPreview.coins * 2, `${category} should duplicate category coins`);
  assert.equal(categoryBonusClaimed.partnerSchedule.skills[category].xp, categoryPreview.skillXp * 2, `${category} should duplicate category skill XP`);
  assert.equal(categoryBonusClaimed.energy, categoryBonusState.energy + (categoryPreview.energy ?? 0) * 2, `${category} should duplicate energy recovery`);
  assert.equal(categoryBonusClaimed.health, categoryBonusState.health + (categoryPreview.health ?? 0) * 2, `${category} should duplicate health recovery`);
  assert.equal(categoryBonusClaimed.mood, categoryBonusState.mood + (categoryPreview.mood ?? 0) * 2, `${category} should duplicate mood recovery`);
  if (categoryPreview.itemId) {
    assert.equal(
      (categoryBonusClaimed.inventory[categoryPreview.itemId] ?? 0) - (categoryBonusState.inventory[categoryPreview.itemId] ?? 0),
      (categoryPreview.itemAmount ?? 1) * 2,
      `${category} should duplicate item rewards`,
    );
  }
  assert.equal(categoryBonusClaimed.partnerSchedule.completedOfferIds.length, 1);
  assert.equal(categoryBonusClaimed.achievements.counters.partnerScheduleClaimCount, 1);
  assert.equal(categoryBonusClaimed.achievements.counters.partnerScheduleCategoryRewardClaimCount, 1);
}

const masterBonusResult = findResultWithExtraCopies(combinedScheduleBonusPet, {
  ...baseBonusResult,
  offerId: 'deterministic-master-bonus',
  skillXp: 0,
  grantsMasterCompletion: true,
}, 1);
const masterBonusState: PetState = {
  ...combinedScheduleBonusPet,
  partnerSchedule: {
    ...combinedScheduleBonusPet.partnerSchedule,
    offers: [
      { id: masterBonusResult.offerId, templateId: masterBonusResult.templateId, dateKey: combinedScheduleBonusPet.partnerSchedule.boardDateKey },
      ...combinedScheduleBonusPet.partnerSchedule.offers.slice(1),
    ],
    completedOfferIds: [],
    active: undefined,
    pendingResult: masterBonusResult,
    skills: { ...combinedScheduleBonusPet.partnerSchedule.skills, [masterBonusResult.category]: skill(10) },
  },
};
const masterBonusClaimed = claimPartnerScheduleResult(masterBonusState, 'coins', now);
assert.equal(masterBonusClaimed.partnerSchedule.skills[masterBonusResult.category].masterCompletions, 1, 'extra rewards must not duplicate master completions');
assert.equal(masterBonusClaimed.partnerSchedule.completedOfferIds.length, 1);
assert.equal(masterBonusClaimed.achievements.counters.partnerScheduleClaimCount, 1);

const normalAchievementCount = achievementDefinitions.filter((achievement) => achievement.rarity === 'normal').length;
const normalAchievementIds = achievementDefinitions.filter((achievement) => achievement.rarity === 'normal').map((achievement) => achievement.id);
const taskMaster = achievementDefinitions.find((achievement) => achievement.id === 'hidden_full_catalogue');
const expectedTaskMasterTarget = Math.ceil(normalAchievementCount * taskMasterCompletionRatio);
assert.equal(taskMaster?.target, expectedTaskMasterTarget, 'Task Master should require 80% of normal achievements');
assert.equal(expectedTaskMasterTarget, 40, 'the current 50 normal achievements should produce a target of 40');
const taskMasterBase = createReadyPet(1, now);
const taskMasterStateWithCount = (count: number): PetState => ({
  ...taskMasterBase,
  achievements: {
    ...taskMasterBase.achievements,
    unlockedAtById: Object.fromEntries(normalAchievementIds.slice(0, count).map((id) => [id, now])),
  },
});
const taskMasterBelowTarget = evaluateAchievements(taskMasterStateWithCount(expectedTaskMasterTarget - 1), now);
const taskMasterAtTarget = evaluateAchievements(taskMasterStateWithCount(expectedTaskMasterTarget), now);
assert.equal(taskMasterBelowTarget.achievements.unlockedAtById.hidden_full_catalogue, undefined, '39 normal achievements should not unlock Task Master');
assert(taskMasterAtTarget.achievements.unlockedAtById.hidden_full_catalogue, '40 normal achievements should unlock Task Master');
const retainedTaskMaster = evaluateAchievements(withUnlockedAchievements(taskMasterBase, ['hidden_full_catalogue']), now);
assert(retainedTaskMaster.achievements.unlockedAtById.hidden_full_catalogue, 'previously unlocked Task Master should never relock');

const newAchievementIds = [
  'schedule_all_skills_6',
  'schedule_all_master_10',
  'daily_login_30',
  'garden_harvest_100',
  'item_use_100',
  'paid_purchase_100',
  'pomodoro_250',
  'rare_level_20',
] as const;
for (const id of newAchievementIds) {
  assert.equal(achievementDefinitions.find((achievement) => achievement.id === id)?.rarity, 'rare', `${id} should be a rare achievement`);
}

const milestoneBase = createReadyPet(8);
const milestoneBelowCases: readonly [typeof newAchievementIds[number], PetState][] = [
  ['schedule_all_skills_6', {
    ...milestoneBase,
    partnerSchedule: { ...milestoneBase.partnerSchedule, skills: { study: skill(5), cooking: skill(5), garden: skill(5), exercise: skill(5) } },
  }],
  ['schedule_all_master_10', {
    ...milestoneBase,
    partnerSchedule: { ...milestoneBase.partnerSchedule, skills: { study: skill(10, 0, 9), cooking: skill(10, 0, 9), garden: skill(10, 0, 9), exercise: skill(10, 0, 9) } },
  }],
  ['daily_login_30', {
    ...milestoneBase,
    achievements: { ...milestoneBase.achievements, counters: { ...milestoneBase.achievements.counters, dateRewardClaimCountsByKind: { daily_login: 29 } } },
  }],
  ['garden_harvest_100', { ...milestoneBase, garden: { ...milestoneBase.garden, lifetimeHarvestCount: 99 } }],
  ['item_use_100', {
    ...milestoneBase,
    achievements: { ...milestoneBase.achievements, counters: { ...milestoneBase.achievements.counters, totalItemUseCount: 99 } },
  }],
  ['paid_purchase_100', {
    ...milestoneBase,
    achievements: { ...milestoneBase.achievements, counters: { ...milestoneBase.achievements.counters, paidPurchaseCount: 99 } },
  }],
  ['pomodoro_250', {
    ...milestoneBase,
    achievements: { ...milestoneBase.achievements, counters: { ...milestoneBase.achievements.counters, pomodoroFocusCount: 249 } },
  }],
  ['rare_level_20', { ...milestoneBase, level: 19 }],
];
for (const [id, state] of milestoneBelowCases) {
  assert.equal(evaluateAchievements(state, now).achievements.unlockedAtById[id], undefined, `${id} should remain locked one step below its target`);
}

const milestoneTargetBase = createReadyPet(20);
const milestoneTargetState = evaluateAchievements({
  ...milestoneTargetBase,
  garden: { ...milestoneTargetBase.garden, lifetimeHarvestCount: 100 },
  achievements: {
    ...milestoneTargetBase.achievements,
    counters: {
      ...milestoneTargetBase.achievements.counters,
      dateRewardClaimCountsByKind: { daily_login: 30 },
      totalItemUseCount: 100,
      paidPurchaseCount: 100,
      pomodoroFocusCount: 250,
    },
  },
  partnerSchedule: {
    ...milestoneTargetBase.partnerSchedule,
    skills: {
      study: skill(10, 0, 10),
      cooking: skill(10, 0, 10),
      garden: skill(10, 0, 10),
      exercise: skill(10, 0, 10),
    },
  },
}, now);
for (const id of newAchievementIds) {
  assert(milestoneTargetState.achievements.unlockedAtById[id], `${id} should unlock exactly at its target`);
}

const isolatedLevel20State = evaluateAchievements({ ...createReadyPet(20), level: 20 }, now);
const isolatedLevel20Effects = getAchievementEffects(isolatedLevel20State);
assert.equal(isolatedLevel20Effects.extraHeartChancePercent, 20, 'Growing Up Together should grant +20% heart chance');
assert.equal(isolatedLevel20Effects.gardenExtraDropChancePercent, 20, 'Growing Up Together should grant +20% harvest chance');
const claimedLevel20Reward = claimAchievementReward(isolatedLevel20State, 'rare_level_20', now);
const claimedLevel20RewardAgain = claimAchievementReward(claimedLevel20Reward, 'rare_level_20', now);
assert.equal(claimedLevel20Reward.coins - isolatedLevel20State.coins, 1500);
assert.equal((claimedLevel20Reward.inventory.golden_apple ?? 0) - (isolatedLevel20State.inventory.golden_apple ?? 0), 2);
assert.equal(claimedLevel20RewardAgain.coins, claimedLevel20Reward.coins, 'Growing Up Together one-time coins must not duplicate');
assert.equal(claimedLevel20RewardAgain.inventory.golden_apple, claimedLevel20Reward.inventory.golden_apple, 'Growing Up Together one-time items must not duplicate');

const scheduleCoverageState = evaluateAchievements({
  ...level8,
  achievements: {
    ...level8.achievements,
    counters: {
      ...level8.achievements.counters,
      partnerScheduleClaimCount: 50,
      partnerScheduleClaimCountsByCategory: { study: 12, cooking: 12, garden: 13, exercise: 13 },
      partnerScheduleLongClaimCountsByCategory: { study: 2, cooking: 1, garden: 1, exercise: 1 },
      partnerScheduleCategoryRewardClaimCount: 10,
    },
  },
  partnerSchedule: {
    ...level8.partnerSchedule,
    skills: {
      study: skill(3),
      cooking: skill(3),
      garden: skill(3),
      exercise: skill(3),
    },
  },
}, now);
for (const id of ['schedule_10', 'schedule_50', 'schedule_all_categories', 'schedule_long_5', 'schedule_long_all_categories', 'schedule_category_reward_10', 'schedule_all_skills_3']) {
  assert(scheduleCoverageState.achievements.unlockedAtById[id], `${id} should unlock from its completed schedule milestone`);
}

const fullBoardState = evaluateAchievements({
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    completedOfferIds: level8.partnerSchedule.offers.map((item) => item.id),
  },
}, now);
assert(fullBoardState.achievements.unlockedAtById.schedule_daily_three, 'finishing all daily offers should unlock the hidden full-board achievement');

const skillProgressState = evaluateAchievements({
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    skills: {
      study: skill(3),
      cooking: skill(3),
      garden: skill(3),
      exercise: skill(3),
    },
  },
}, now);
assert(skillProgressState.achievements.unlockedAtById.schedule_all_skills_3, 'all four level-three skills should unlock their achievement');
const maxSkillAchievementState = evaluateAchievements({
  ...level8,
  partnerSchedule: {
    ...level8.partnerSchedule,
    skills: {
      study: skill(10),
      cooking: skill(10),
      garden: skill(10),
      exercise: skill(10),
    },
  },
}, now);
assert(maxSkillAchievementState.achievements.unlockedAtById.schedule_all_skills_max, 'the all-skill achievement should now require Lv10');
assert.equal(achievementDefinitions.find((achievement) => achievement.id === 'schedule_all_skills_max')?.target, 10);

const legacySkillState = createReadyPet(8);
legacySkillState.partnerSchedule.skills.study = skill(1, 10);
const backfilledSkillState = normalizePet(legacySkillState, now);
assert.equal(backfilledSkillState.achievements.counters.partnerScheduleClaimCountsByCategory.study, 1, 'existing skill progress should conservatively backfill one category claim');
assert.equal(backfilledSkillState.achievements.counters.partnerScheduleClaimCount, 1, 'backfilled category progress should update the total lower bound');

const baseSchedule = level3.partnerSchedule;
const { boardOfferCount: _legacyBoardOfferCount, ...v2ScheduleWithoutOfferCount } = level8.partnerSchedule;
const { grantsMasterCompletion: _legacyActiveMasterFlag, ...v2ActiveWithoutMasterFlag } = started.partnerSchedule.active!;
const migratedV2Active = normalizePartnerScheduleState({
  ...v2ScheduleWithoutOfferCount,
  schemaVersion: 2,
  active: v2ActiveWithoutMasterFlag,
  pendingResult: undefined,
  skills: {
    study: { level: 5, xp: 0 },
    cooking: { level: 5, xp: 0 },
    garden: { level: 5, xp: 0 },
    exercise: { level: 5, xp: 0 },
  },
}, { level: level8.level, createdAt: level8.createdAt }, now);
assert.equal(migratedV2Active.schemaVersion, partnerScheduleSchemaVersion);
assert.equal(migratedV2Active.boardOfferCount, 3, 'schema v2 should preserve the current three-choice board until reset');
assert.equal(migratedV2Active.skills.study.level, 5);
assert.equal(migratedV2Active.skills.study.masterCompletions, 0);
assert.equal(migratedV2Active.active?.grantsMasterCompletion, false);
const migratedV2Pending = normalizePartnerScheduleState({
  ...v2ScheduleWithoutOfferCount,
  schemaVersion: 2,
  active: undefined,
  pendingResult: {
    offerId: 'v2-pending',
    templateId: definition.id,
    category: definition.category,
    size: definition.size,
    completedAt: now,
    coinReward: 77,
    skillXp: 10,
  },
}, { level: level8.level, createdAt: level8.createdAt }, now);
assert.equal(migratedV2Pending.pendingResult?.coinReward, 77);
assert.equal(migratedV2Pending.pendingResult?.grantsMasterCompletion, false);

const legacyCommon = {
  offerId: offer.id,
  templateId: offer.templateId,
  category: definition.category,
  size: definition.size,
  coinReward: 88,
  skillXp: 10,
};
const normalizeLegacy = (active: Record<string, unknown> | undefined, pendingResult?: Record<string, unknown>) =>
  normalizePartnerScheduleState({
    ...baseSchedule,
    schemaVersion: 1,
    active,
    pendingResult,
  }, { level: level3.level, createdAt: level3.createdAt }, now);

const legacyIndependentEnd = now + 18 * minuteMs;
const migratedIndependent = normalizeLegacy({
  ...legacyCommon,
  mode: 'independent',
  startedAt: now - 27 * minuteMs,
  endsAt: legacyIndependentEnd,
  requiredFocusMs: 25 * minuteMs,
  focusProgressMs: 0,
});
assert.equal(migratedIndependent.schemaVersion, partnerScheduleSchemaVersion);
assert.equal(migratedIndependent.active?.endsAt, legacyIndependentEnd, 'v1 independent activity should preserve its end time');

const migratedTogether = normalizeLegacy({
  ...legacyCommon,
  mode: 'together',
  startedAt: now - 10 * minuteMs,
  endsAt: 0,
  requiredFocusMs: 25 * minuteMs,
  focusProgressMs: 12.5 * minuteMs,
});
assert.equal(
  getPartnerScheduleProgress(migratedTogether.active!, now).remainingMs,
  definition.durationMinutes * minuteMs / 2,
  'v1 together activity should convert focus ratio to real-time remaining duration',
);
assert.equal(migratedTogether.active?.coinReward, 88, 'migration should preserve reward snapshots');

const expiredLegacy = normalizeLegacy({
  ...legacyCommon,
  mode: 'independent',
  startedAt: now - 60 * minuteMs,
  endsAt: now - minuteMs,
});
assert.equal(expiredLegacy.active, undefined);
assert(expiredLegacy.pendingResult, 'expired migrated activity should immediately become claimable');

const migratedPending = normalizeLegacy(undefined, {
  ...legacyCommon,
  mode: 'together',
  completedAt: now - minuteMs,
});
assert(migratedPending.pendingResult, 'v1 pending result should be preserved');
assert.equal(migratedPending.pendingResult?.coinReward, 88);

const missingFields = normalizeLegacy({
  offerId: offer.id,
  templateId: offer.templateId,
  mode: 'independent',
  startedAt: now,
});
assert(missingFields.active, 'legacy activity with optional fields missing should still migrate');
assert.equal(missingFields.active?.endsAt, now + definition.durationMinutes * minuteMs);
assert((missingFields.active?.coinReward ?? 0) > 0);

const nextDayBoard = advancePartnerSchedule(level3, now + 24 * 60 * minuteMs);
assert.notEqual(nextDayBoard.partnerSchedule.boardDateKey, level3.partnerSchedule.boardDateKey, 'the board should refresh after the daily boundary');
assert.equal(nextDayBoard.partnerSchedule.offers.length, 3);

const migratedV3Board = normalizePartnerScheduleState({
  ...level3.partnerSchedule,
  schemaVersion: 3,
  neighborOfferId: level3.partnerSchedule.offers[0]?.id,
  active: undefined,
  pendingResult: undefined,
}, { level: level3.level, createdAt: level3.createdAt }, now);
assert.equal(migratedV3Board.neighborOfferId, undefined, 'a current v3 board should not gain neighbor content retroactively');

let neighborSchedulePet: PetState | undefined;
for (let offset = 0; offset < 200 && !neighborSchedulePet; offset += 1) {
  const candidate = createReadyPet(3, now - (10 * 24 * 60 + offset) * minuteMs);
  if (getPartnerScheduleNeighborOfferId(candidate)) neighborSchedulePet = candidate;
}
assert(neighborSchedulePet, 'the deterministic 30% rule should produce a neighbor board in a bounded sample');
const neighborOfferId = getPartnerScheduleNeighborOfferId(neighborSchedulePet!);
assert(neighborOfferId && neighborSchedulePet!.partnerSchedule.offers.some((item) => item.id === neighborOfferId));
const neighborIdentities = [
  { modId: 'creator.alpha', name: 'Alpha' },
  { modId: 'creator.beta', name: 'Beta' },
];
assert.deepEqual(
  getNeighborIdentities([]).map((neighbor) => neighbor.name),
  ['Doro', 'mint'],
  'Furo should see the other two built-in roles as neighbors',
);
assert.deepEqual(
  getNeighborIdentities([], 'official.doro').map((neighbor) => neighbor.name),
  ['Furo', 'mint'],
  'Doro should see Furo and Mint as neighbors',
);
assert.deepEqual(
  getNeighborIdentities([], 'official.mint').map((neighbor) => neighbor.name),
  ['Doro', 'Furo'],
  'Mint should see Furo and Doro as neighbors',
);
assert.deepEqual(
  getNeighborIdentities([{ manifest: { id: 'creator.alpha', defaultPetName: 'Alpha' } }], 'creator.alpha').map((neighbor) => neighbor.name),
  ['Doro', 'Furo', 'mint'],
  'an active installed mod should still see all three built-in roles as neighbors',
);
const neighborReference = selectNeighborReference(neighborOfferId!, neighborIdentities);
const neighborStarted = startPartnerSchedule(neighborSchedulePet!, neighborOfferId!, now, neighborReference);
assert.deepEqual(neighborStarted.partnerSchedule.active?.neighbor, neighborReference, 'start should snapshot only the neighbor mod id');
const neighborFinished = advancePartnerSchedule(neighborStarted, neighborStarted.partnerSchedule.active!.endsAt);
assert.deepEqual(neighborFinished.partnerSchedule.pendingResult?.neighbor, neighborReference, 'completion should preserve the neighbor reference');
if (neighborReference.kind === 'mod') {
  const neighborName = resolveNeighborName(neighborReference, neighborIdentities);
  assert.equal(neighborName, neighborIdentities.find((item) => item.modId === neighborReference.modId)?.name);
  const namedNeighborClaim = claimPartnerScheduleResult(neighborFinished, 'coins', neighborStarted.partnerSchedule.active!.endsAt, neighborName);
  assert(namedNeighborClaim.recentEvent.includes(neighborName!), 'the claimed activity log should show the built-in or mod neighbor name');
  const genericNeighborClaim = claimPartnerScheduleResult(neighborFinished, 'coins', neighborStarted.partnerSchedule.active!.endsAt);
  assert(!genericNeighborClaim.recentEvent.includes('pet.partnerSchedule.neighborClaimed'), 'generic neighbor text should resolve instead of leaking its translation key');
  assert.equal(resolveNeighborName(neighborReference, [{ modId: neighborReference.modId, name: 'Updated name' }]), 'Updated name');
  assert.equal(resolveNeighborName(neighborReference, []), undefined, 'a deleted mod should fall back to the generic neighbor copy');
}

const randomFrom = (...values: number[]) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
};
const giftCandidates: NeighborGiftCandidate[] = [
  { itemId: 'apple', displayName: 'Apple', price: 1000 },
  { itemId: 'creator.test:rare', displayName: 'Rare', price: 1001 },
];
assert.equal(selectNeighborGift(giftCandidates, randomFrom(0.5, 0)).itemId, 'apple', 'price 1000 should remain in the common pool');
assert.equal(selectNeighborGift(giftCandidates, randomFrom(0.005, 0.59)).itemId, 'golden_apple', '60% of the rare branch should be golden apples');
assert.equal(selectNeighborGift(giftCandidates, randomFrom(0.005, 0.61, 0)).itemId, 'creator.test:rare', 'the remaining rare branch should select price-over-1000 items');
assert.equal(
  selectNeighborGift([{ itemId: 'creator.test:rare', displayName: 'Rare', price: 1001 }], randomFrom(0.5)).itemId,
  'emergency_biscuit',
  'an empty common pool should fall back to a soda biscuit',
);
assert.equal(
  selectNeighborGift([], randomFrom(0.005)).itemId,
  'emergency_biscuit',
  'a completely empty gift pool should still fall back to a soda biscuit on the rare branch',
);

const giftEventContext: NeighborEventContext = {
  neighbors: [{ modId: 'creator.alpha', name: 'Alpha' }],
  giftCandidates,
  random: randomFrom(0.2, 0, 0.5, 0),
};
const dailyGift = getRandomDailyEncounter('Furo', giftEventContext, true);
assert.equal(dailyGift.kind, 'neighbor_gift');
const twiceGifted = { ...createDefaultPet(now), neighborGiftDateKey: '2026-07-20', neighborGiftCount: 2 };
const thirdGift = applyTimedEvent(twiceGifted, dailyGift, now, '');
assert.equal(thirdGift.neighborGiftCount, neighborGiftDailyLimit, 'the third gift should settle normally');
const cappedDailyEvent = getRandomDailyEncounter('Furo', { ...giftEventContext, random: randomFrom(0.2) }, false);
const cappedOfflineEvent = getRandomOfflineEvent('Furo', 'sunny', { ...giftEventContext, random: randomFrom(0.2) }, {
  allowNeighborGift: false,
});
assert.notEqual(cappedDailyEvent.kind, 'neighbor_gift', 'daily gift candidates should be removed after the cap');
assert.notEqual(cappedOfflineEvent.kind, 'neighbor_gift', 'offline gift candidates should be removed after the cap');
const singleTicketEvent = getRandomOfflineEvent('Furo', 'sunny', {
  ...giftEventContext,
  random: randomFrom(0.99, 0.5),
}, { allowNeighborGift: true, allowGachaTicket: true });
assert.equal(singleTicketEvent.gachaTickets, 1, 'the final equal-weight option should grant one ticket normally');
const settledSingleTicket = applyTimedEvent(createDefaultPet(now), singleTicketEvent, now, 'offline: ');
assert.equal(settledSingleTicket.goldenAppleGacha.tickets, 1);
assert.equal(settledSingleTicket.goldenAppleGacha.dailyTicketsGranted, 1);
assert.match(settledSingleTicket.recentEvent, /1/);
const tenTicketEvent = getRandomOfflineEvent('Furo', 'sunny', {
  ...giftEventContext,
  random: randomFrom(0.99, 0.009),
}, { allowNeighborGift: true, allowGachaTicket: true });
assert.equal(tenTicketEvent.gachaTickets, 10, 'a roll below one percent should become a ten-pull reward');
const boundaryTicketEvent = getRandomOfflineEvent('Furo', 'sunny', {
  ...giftEventContext,
  random: randomFrom(0.99, 0.01),
}, { allowNeighborGift: true, allowGachaTicket: true });
assert.equal(boundaryTicketEvent.gachaTickets, 1, 'the exact one-percent boundary should remain a single ticket');
const noNeighborTicketEvent = getRandomOfflineEvent('Furo', 'sunny', {
  ...giftEventContext,
  random: randomFrom(0.99, 0.5),
}, { allowNeighborGift: false, allowGachaTicket: true });
assert.equal(noNeighborTicketEvent.gachaTickets, 1, 'the seventh option should be the ticket event without neighbor gifts');
const noTicketOptionEvent = getRandomOfflineEvent('Furo', 'sunny', {
  ...giftEventContext,
  random: randomFrom(0.99),
}, { allowNeighborGift: false, allowGachaTicket: false });
assert.equal(noTicketOptionEvent.gachaTickets, undefined, 'the ticket option must disappear after the daily quota is exhausted');
const cappedTenTicket = applyTimedEvent({
  ...createDefaultPet(now),
  goldenAppleGacha: { ...createDefaultPet(now).goldenAppleGacha, tickets: 9995 },
}, tenTicketEvent, now, 'offline: ');
assert.equal(cappedTenTicket.goldenAppleGacha.tickets, 9999);
assert.equal(cappedTenTicket.goldenAppleGacha.dailyTicketsGranted, 1);
assert.match(cappedTenTicket.recentEvent, /4/);
const offlineTicketStart = createDefaultPet(now - 2 * 60 * minuteMs);
const offlineTicketSettlement = advancePet(offlineTicketStart, now, {
  neighbors: [],
  giftCandidates,
  random: randomFrom(0.99, 0.5),
});
assert.equal(offlineTicketSettlement.goldenAppleGacha.tickets, 1, 'a qualifying offline settlement should expose the ticket event');
assert.equal(offlineTicketSettlement.goldenAppleGacha.dailyTicketsGranted, 1);
assert.match(offlineTicketSettlement.recentEvent, /1/);
const nextDayAfterEvent = applyTimedEvent(thirdGift, { text: 'next day' }, now + 24 * 60 * minuteMs, '');
assert.equal(nextDayAfterEvent.neighborGiftCount, 0, 'the local-day gift count should reset on the next event');

const fourthGiftInventoryBefore = thirdGift.inventory[dailyGift.itemId!] ?? 0;
const blockedFourthGift = applyTimedEvent(thirdGift, dailyGift, now, '');
assert.equal(blockedFourthGift.neighborGiftCount, neighborGiftDailyLimit, 'the settlement layer should keep the neighbor gift cap at three');
assert.equal(blockedFourthGift.inventory[dailyGift.itemId!] ?? 0, fourthGiftInventoryBefore, 'a fourth neighbor gift must not enter inventory');
assert.equal(blockedFourthGift.recentEvent, thirdGift.recentEvent, 'a blocked fourth gift must not claim that an item was received');
const malformedGift = applyTimedEvent(twiceGifted, { kind: 'neighbor_gift', text: 'missing item' }, now, '');
assert.equal(malformedGift.neighborGiftCount, twiceGifted.neighborGiftCount, 'a malformed gift without an item must not consume a daily gift slot');

assert.deepEqual(
  {
    friendPrice: boostCardDefinitions.friend_pass.priceHearts,
    friendCoins: boostCardDefinitions.friend_pass.dailyCoins,
    friendWork: boostCardDefinitions.friend_pass.workBonusCoins,
    friendWorkLimit: boostCardDefinitions.friend_pass.workBonusDailyLimit,
    friendHearts: boostCardDefinitions.friend_pass.extraHeartChancePercent,
    bestPrice: boostCardDefinitions.best_friend_pass.priceHearts,
    bestCoins: boostCardDefinitions.best_friend_pass.dailyCoins,
    bestWork: boostCardDefinitions.best_friend_pass.workBonusCoins,
    bestWorkLimit: boostCardDefinitions.best_friend_pass.workBonusDailyLimit,
    bestHearts: boostCardDefinitions.best_friend_pass.extraHeartChancePercent,
    bestSchedule: boostCardDefinitions.best_friend_pass.partnerScheduleCoinBonusPercent,
  },
  {
    friendPrice: 10,
    friendCoins: 15,
    friendWork: 8,
    friendWorkLimit: 80,
    friendHearts: 10,
    bestPrice: 90,
    bestCoins: 50,
    bestWork: 0,
    bestWorkLimit: 0,
    bestHearts: 30,
    bestSchedule: 10,
  },
  'boost-card values should match the v2 balance',
);

let friendWorkPet = buyBoostCard({ ...createDefaultPet(now), hearts: 200 }, 'friend_pass', now);
let friendWorkCoins = 0;
for (let index = 0; index < 11; index += 1) {
  const workBonus = applyBoostCardWorkBonus(friendWorkPet, now);
  friendWorkCoins += workBonus.bonusCoins;
  friendWorkPet = { ...friendWorkPet, boostCards: workBonus.boostCards };
}
assert.equal(friendWorkCoins, 80, 'Friend Pass work rewards should stop at the daily 80-coin cap');
const bestWorkPet = buyBoostCard({ ...createDefaultPet(now), hearts: 200 }, 'best_friend_pass', now);
assert.equal(applyBoostCardWorkBonus(bestWorkPet, now).bonusCoins, 0, 'Best Friend Pass should no longer affect work');

const friendRewardContext: NeighborEventContext = {
  neighbors: [{ modId: 'creator.alpha', name: 'Alpha' }],
  giftCandidates: [{ itemId: 'creator.test:gift', displayName: 'Mod Gift', price: 30 }],
  random: randomFrom(0, 0.5, 0),
};
const friendRewardStart = buyBoostCard({ ...createDefaultPet(now), hearts: 200 }, 'friend_pass', now);
const friendCoinsBefore = friendRewardStart.coins;
const friendReward = claimBoostCardDailyReward(friendRewardStart, friendRewardContext, now);
assert.equal(friendReward.coins, 15);
assert.equal(friendReward.pet.coins, friendCoinsBefore + 15);
assert.equal(friendReward.gift?.itemId, 'creator.test:gift', 'card claims should use the current Mod-aware gift pool');
assert.equal(friendReward.gift?.neighborName, 'Alpha', 'card claims should retain a named installed neighbor');
assert.equal(friendReward.pet.inventory['creator.test:gift'], 1);
assert.equal(friendReward.pet.neighborGiftCount, 1, 'card gifts should count toward the daily neighbor cap');
assert.equal(canClaimBoostCardDailyReward(friendReward.pet, now), false);
const upgradedAfterClaim = buyBoostCard(friendReward.pet, 'best_friend_pass', now);
assert.equal(canClaimBoostCardDailyReward(upgradedAfterClaim, now), false, 'switching to Best Friend Pass must not grant a second daily claim');
assert.equal(claimBoostCardDailyReward(upgradedAfterClaim, friendRewardContext, now).coins, 0);

const fullGiftPet = buyBoostCard({
  ...createDefaultPet(now),
  hearts: 200,
  neighborGiftDateKey: getDailyResetDateKey(now),
  neighborGiftCount: neighborGiftDailyLimit,
}, 'best_friend_pass', now);
const fullGiftInventoryBefore = fullGiftPet.inventory.apple ?? 0;
const coinsOnlyReward = claimBoostCardDailyReward(fullGiftPet, {
  neighbors: [],
  giftCandidates: [{ itemId: 'apple', displayName: 'Apple', price: 10 }],
  random: randomFrom(0.5, 0),
}, now);
assert.equal(coinsOnlyReward.coins, 50);
assert.equal(coinsOnlyReward.gift, undefined, 'a card bought after three random gifts should grant coins only');
assert.equal(coinsOnlyReward.pet.inventory.apple ?? 0, fullGiftInventoryBefore);
assert.equal(coinsOnlyReward.pet.neighborGiftCount, neighborGiftDailyLimit);

const unclaimedReservedPet = buyBoostCard({
  ...createDefaultPet(now),
  hearts: 200,
  neighborGiftDateKey: getDailyResetDateKey(now),
  neighborGiftCount: 2,
  lastUpdatedAt: now - 3 * 60 * minuteMs,
  lastInteractionAt: now,
}, 'friend_pass', now);
const reservedAfterOffline = advancePet(unclaimedReservedPet, now, {
  neighbors: [],
  giftCandidates: [{ itemId: 'apple', displayName: 'Apple', price: 10 }],
  random: randomFrom(0.2, 0.5, 0),
});
assert.equal(reservedAfterOffline.neighborGiftCount, 2, 'random events should stop at two gifts while the card reward is unclaimed');
const claimedReservedPet = {
  ...unclaimedReservedPet,
  boostCards: { ...unclaimedReservedPet.boostCards, dailyRewardClaimed: true },
};
const thirdRandomAfterClaim = advancePet(claimedReservedPet, now, {
  neighbors: [],
  giftCandidates: [{ itemId: 'apple', displayName: 'Apple', price: 10 }],
  random: randomFrom(0.2, 0.5, 0),
});
assert.equal(thirdRandomAfterClaim.neighborGiftCount, 3, 'random gifts may use the third slot after the card claim is settled');

const bestSchedulePet = buyBoostCard({ ...level3, hearts: 200 }, 'best_friend_pass', now);
const baseSchedulePreview = getPartnerScheduleOfferPreview(level3, definition, now);
const bestSchedulePreview = getPartnerScheduleOfferPreview(bestSchedulePet, definition, now);
assert.equal(bestSchedulePreview.coinReward, Math.round(baseSchedulePreview.coinReward * 1.1), 'Best Friend Pass should add 10% schedule coins');
assert.equal(bestSchedulePreview.skillXp, baseSchedulePreview.skillXp, 'the card must not increase schedule XP');
const bestScheduleStarted = startPartnerSchedule(bestSchedulePet, offer.id, now);
const snapshottedScheduleCoins = bestScheduleStarted.partnerSchedule.active!.coinReward;
const expiredDuringSchedule = {
  ...bestScheduleStarted,
  boostCards: { ...bestScheduleStarted.boostCards, bestFriendPassExpiresAt: now - 1 },
};
const scheduleAfterCardExpiry = advancePartnerSchedule(expiredDuringSchedule, bestScheduleStarted.partnerSchedule.active!.endsAt);
assert.equal(scheduleAfterCardExpiry.partnerSchedule.pendingResult?.coinReward, snapshottedScheduleCoins, 'schedule rewards should remain snapshotted after the card expires');

const beforeFive = new Date(2026, 6, 21, 4, 59, 59, 999).getTime();
const atFive = new Date(2026, 6, 21, 5, 0, 0, 0).getTime();
assert.equal(getDailyResetDateKey(beforeFive), '2026-07-20');
assert.equal(getDailyResetDateKey(atFive), '2026-07-21');

const legacyMidnightBase = createDefaultPet(beforeFive);
const legacyMidnightBoard = normalizePartnerScheduleState(
  undefined,
  { level: 3, createdAt: legacyMidnightBase.createdAt },
  beforeFive,
);
const legacyMidnightPet = {
  ...legacyMidnightBase,
  level: 3,
  neighborGiftDateKey: '2026-07-21',
  neighborGiftCount: 2,
  dailyBiscuitClaimDate: '2026-07-21',
  dailyBiscuitClaims: 2,
  dailyDiscountDate: '2026-07-21',
  dailyDiscountItemIds: ['apple' as const],
  dailyDiscountUsedItemIds: ['apple' as const],
  dailyDiscountUsed: true,
  dailyHeartExchangeDate: '2026-07-21',
  dailyHeartExchangeCount: 2,
  weatherDate: '2026-07-21',
  weather: 'rainy' as const,
  dailyLoginRewardDateKey: '2026-07-21',
  pomodoro: {
    ...createDefaultPet(beforeFive).pomodoro,
    dailyFocusDate: '2026-07-21',
    dailyCompletedFocusCount: 3,
  },
  garden: {
    ...createDefaultPet(beforeFive).garden,
    dailyCareDateKey: '2026-07-21',
    dailyWaterCount: 2,
    dailyFertilizeCount: 1,
    dailyHarvestDateKey: '2026-07-21',
    dailyHarvestCount: 2,
  },
  boostCards: {
    schemaVersion: 1,
    friendPassExpiresAt: beforeFive + 10 * 24 * 60 * minuteMs,
    bestFriendPassExpiresAt: 0,
    bestFriendPassPurchasedDays: 0,
    dailyDateKey: '2026-07-21',
    dailyCoinsClaimedCardId: 'friend_pass',
    dailyWorkBonusCoinsUsed: 24,
    dailyExtraHeartCount: 9,
    dailyGardenExtraDrops: 0,
  } as unknown as PetState['boostCards'],
  partnerSchedule: {
    ...legacyMidnightBoard,
    boardDateKey: '2026-07-21',
    completedOfferIds: [legacyMidnightBoard.offers[0].id],
  },
};
const normalizedBeforeFive = normalizePet(legacyMidnightPet, beforeFive);
assert.equal(normalizedBeforeFive.neighborGiftDateKey, '2026-07-20');
assert.equal(normalizedBeforeFive.neighborGiftCount, 2);
assert.equal(normalizedBeforeFive.dailyBiscuitClaims, 2);
assert.deepEqual(normalizedBeforeFive.dailyDiscountUsedItemIds, ['apple']);
assert.equal(normalizedBeforeFive.dailyHeartExchangeCount, 2);
assert.equal(normalizedBeforeFive.weather, 'rainy');
assert.equal(normalizedBeforeFive.dailyLoginRewardDateKey, '2026-07-20');
assert.equal(normalizedBeforeFive.pomodoro.dailyCompletedFocusCount, 3);
assert.equal(normalizedBeforeFive.garden.dailyWaterCount, 2);
assert.equal(normalizedBeforeFive.garden.dailyHarvestCount, 2);
assert.equal(normalizedBeforeFive.boostCards.schemaVersion, 2);
assert.equal(normalizedBeforeFive.boostCards.dailyRewardClaimed, true, 'a v1 card coin claim should migrate to the shared reward flag');
assert.equal(normalizedBeforeFive.boostCards.dailyWorkBonusCoinsUsed, 24);
assert.equal('dailyExtraHeartCount' in normalizedBeforeFive.boostCards, false, 'obsolete extra-heart counters should be discarded');
assert.equal(normalizedBeforeFive.partnerSchedule.completedOfferIds.length, 1, 'a legacy midnight board should remain on the same 05:00 game day');

const normalizedAtFive = normalizePet(normalizedBeforeFive, atFive);
assert.equal(normalizedAtFive.neighborGiftCount, 0);
assert.equal(normalizedAtFive.dailyBiscuitClaims, 0);
assert.equal(normalizedAtFive.dailyHeartExchangeCount, 0);
assert.equal(normalizedAtFive.pomodoro.dailyCompletedFocusCount, 0);
assert.equal(normalizedAtFive.garden.dailyWaterCount, 0);
assert.equal(normalizedAtFive.garden.dailyHarvestCount, 0);
assert.equal(normalizedAtFive.boostCards.dailyRewardClaimed, false);
assert.equal(normalizedAtFive.boostCards.dailyWorkBonusCoinsUsed, 0);

const fiveThirty = new Date(2026, 6, 21, 5, 30, 0).getTime();
const migratedOldSixState = normalizeBoostCardState({
  ...normalizedBeforeFive.boostCards,
  schemaVersion: 1,
  dailyDateKey: '2026-07-20',
  dailyCoinsClaimedCardId: 'friend_pass',
  dailyWorkBonusCoinsUsed: 24,
}, fiveThirty);
assert.equal(migratedOldSixState.dailyRewardClaimed, false, 'the former 6:00 system should refresh early between 5:00 and 6:00');
assert.equal(migratedOldSixState.dailyWorkBonusCoinsUsed, 0);

const calendarMidnight = new Date(2027, 0, 1, 0, 1, 0).getTime();
const calendarPet = {
  ...createDefaultPet(calendarMidnight),
  birthday: { month: 1, day: 1 },
  dailyLoginRewardDateKey: getDailyResetDateKey(calendarMidnight),
  monthlyGiftDateKey: '2027-01',
};
const calendarRewards = claimAvailableDateRewards(calendarPet, calendarMidnight).rewards;
assert(calendarRewards.some((reward) => reward.kind === 'birthday'), 'calendar-date birthday rewards should still switch at midnight');

const februaryEnd = new Date(2027, 1, 28, 23, 59, 59).getTime();
const marchStart = new Date(2027, 2, 1, 0, 0, 0).getTime();
assert.equal(getSeasonForDate(februaryEnd), 'winter');
assert.equal(getSeasonForDate(marchStart), 'spring', 'seasons should continue to switch at calendar midnight');

const focusStartedAt = new Date(2026, 6, 21, 4, 30, 0).getTime();
const focusEndedAt = new Date(2026, 6, 21, 4, 55, 0).getTime();
const afterFive = new Date(2026, 6, 21, 5, 1, 0).getTime();
const crossResetPomodoroPet = {
  ...createDefaultPet(focusStartedAt),
  pomodoro: {
    ...createDefaultPet(focusStartedAt).pomodoro,
    isRunning: true,
    phase: 'focus' as const,
    phaseStartedAt: focusStartedAt,
    phaseEndsAt: focusEndedAt,
    focusRewardCheckpointAt: focusStartedAt,
    dailyFocusDate: getDailyResetDateKey(focusStartedAt),
  },
};
const crossResetPomodoro = advancePomodoro(crossResetPomodoroPet, afterFive);
assert.equal(crossResetPomodoro.pomodoro.completedFocusCount, 1);
assert.equal(crossResetPomodoro.pomodoro.dailyFocusDate, getDailyResetDateKey(afterFive));
assert.equal(crossResetPomodoro.pomodoro.dailyCompletedFocusCount, 0, 'a focus completed before 5:00 must not count toward the new day');

const beforeNewYearReset = new Date(2027, 0, 1, 4, 59, 0).getTime();
const atNewYearReset = new Date(2027, 0, 1, 5, 0, 0).getTime();
const yearlyPet = {
  ...createDefaultPet(new Date(2026, 11, 31, 12, 0, 0).getTime()),
  yearlyStats: {
    ...createDefaultPet(new Date(2026, 11, 31, 12, 0, 0).getTime()).yearlyStats,
    year: 2026,
    activeDateKeys: ['2026-12-31'],
  },
};
const yearlyBeforeFive = ensureYearlyStatsForDate(yearlyPet, beforeNewYearReset);
assert.equal(yearlyBeforeFive.yearlyStats.year, 2026, 'annual statistics should not roll before the 5:00 game-day reset');
assert.equal(yearlyBeforeFive.pendingYearReview, undefined);
const yearlyAtFive = ensureYearlyStatsForDate(yearlyBeforeFive, atNewYearReset);
assert.equal(yearlyAtFive.yearlyStats.year, 2027);
assert.equal(yearlyAtFive.pendingYearReview?.year, 2026, 'the prior-year review should appear at the 5:00 reset');

const libraryMods = Array.from({ length: petModLibraryLimit + 1 }, (_, index) => ({
  manifest: {
    schemaVersion: 1 as const,
    id: `creator.mod${index}`,
    name: `Mod ${index}`,
    version: '1.0.0',
    defaultPetName: `Pet ${index}`,
  },
  importedAt: index,
}));
const normalizedLibrary = normalizePetModLibraryState({
  schemaVersion: 1,
  activeModId: libraryMods.at(-1)!.manifest.id,
  mods: [{ manifest: { schemaVersion: 99 }, importedAt: 0 }, ...libraryMods],
});
assert.equal(normalizedLibrary.mods.length, petModLibraryLimit, 'the library catalog should enforce its 12-mod limit');
assert.equal(normalizedLibrary.activeModId, libraryMods.at(-1)!.manifest.id, 'a valid active mod id should survive normalization');
assert.equal(
  normalizePetModLibraryState({ ...normalizedLibrary, activeModId: 'missing.mod' }).activeModId,
  undefined,
  'an invalid active id should fall back to the built-in pet',
);
const normalizedBuiltinLibrary = normalizePetModLibraryState({
  schemaVersion: 1,
  activeModId: 'official.doro',
  mods: [{ ...libraryMods[0], manifest: { ...libraryMods[0].manifest, id: 'official.doro' } }],
});
assert.equal(normalizedBuiltinLibrary.activeModId, 'official.doro', 'a built-in mod id should survive normalization');
assert.equal(normalizedBuiltinLibrary.mods.length, 0, 'a built-in mod must not be duplicated in the imported library');

const schemaCheck: PartnerScheduleState['schemaVersion'] = partnerScheduleSchemaVersion;
const stateCheck: PetState = { ...level3, partnerSchedule: migratedTogether };
assert.equal(schemaCheck, stateCheck.partnerSchedule.schemaVersion);

console.log('partner schedule core checks passed');
