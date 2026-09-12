import assert from 'node:assert/strict';
import {
  advanceGarden,
  fertilizeTree,
  gardenCareReductionLimitPercent,
  gardenSchemaVersion,
  gardenMinimumCareRemainingMs,
  gardenWaterReductionMaxMs,
  getGardenCarePreview,
  getGardenSaplingRecycleCoins,
  harvestTree,
  normalizeGardenState,
  recycleGardenSapling,
  waterTree,
} from '../src/core/garden';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import type { GardenSlot, PetState } from '../src/core/petTypes';

const secondMs = 1000;
const minuteMs = 60 * secondMs;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

const createGrowingPet = (
  now: number,
  durationMs: number,
  slotOverrides: Partial<GardenSlot> = {},
  petOverrides: Partial<PetState> = {},
): PetState => {
  const pet = createDefaultPet(now);
  const naturalReadyAt = now + durationMs;
  const slot: GardenSlot = {
    ...pet.garden.slots[0],
    unlocked: true,
    treeId: 'golden_apple_tree',
    plantedAt: now,
    naturalReadyAt,
    careReductionMs: 0,
    nextReadyAt: naturalReadyAt,
    harvestsUsed: 0,
    maxHarvests: 9,
    pendingDrops: [],
    state: 'growing',
    ...slotOverrides,
  };
  return {
    ...pet,
    weather: 'cloudy',
    inventory: {
      ...pet.inventory,
      normal_fertilizer: 3,
      heart_fertilizer: 3,
    },
    garden: {
      ...pet.garden,
      activeSlotIndex: 0,
      slots: [slot, ...pet.garden.slots.slice(1)],
    },
    ...petOverrides,
  };
};

const summerNoon = new Date(2026, 6, 15, 12, 0, 0, 0).getTime();
const longRoundPet = createGrowingPet(summerNoon, 96 * hourMs, {}, {
  weather: 'rainy',
});
longRoundPet.garden.tools.wateringCanLevel = 3;
const longRoundSlot = longRoundPet.garden.slots[0];

const earlyWater = getGardenCarePreview(longRoundPet, longRoundSlot, 'water', summerNoon);
const laterWater = getGardenCarePreview(longRoundPet, longRoundSlot, 'water', summerNoon + 2 * hourMs);
assert.equal(earlyWater.percent, 18);
assert.equal(earlyWater.nominalReductionMs, gardenWaterReductionMaxMs);
assert.equal(laterWater.nominalReductionMs, earlyWater.nominalReductionMs, 'watering value must not depend on action time');

const normalPreview = getGardenCarePreview(longRoundPet, longRoundSlot, 'normal', summerNoon);
const heartPreview = getGardenCarePreview(longRoundPet, longRoundSlot, 'heart', summerNoon);
assert.equal(normalPreview.nominalReductionMs, 10 * hourMs);
assert.equal(heartPreview.nominalReductionMs, 18 * hourMs);

const wateredPet = waterTree(longRoundPet, 0, summerNoon);
assert.equal(wateredPet.partnerSchedule.skills.garden.xp, 1);
assert.equal(longRoundPet.partnerSchedule.skills.garden.xp, 0, 'practice does not mutate the source');
assert.equal(waterTree(wateredPet, 0, summerNoon).partnerSchedule.skills.garden.xp, 1, 'repeat watering grants no XP');
const fedPet = fertilizeTree(wateredPet, 0, 'normal', summerNoon);
assert.equal(fedPet.partnerSchedule.skills.garden.xp, 2, 'fertilizing is one separate practice');
assert.equal(fertilizeTree(fedPet, 0, 'heart', summerNoon).partnerSchedule.skills.garden.xp, 2, 'switching fertilizer cannot repeat the reward');
assert.equal(fertilizeTree({ ...longRoundPet, inventory: {} }, 0, 'normal', summerNoon).partnerSchedule.skills.garden.xp, 0, 'missing fertilizer grants no XP');
assert.equal(waterTree(longRoundPet, 4, summerNoon).partnerSchedule.skills.garden.xp, 0, 'an empty slot grants no XP');
const practiceImported = parseSaveFileText(createSaveFileText(fedPet, null, summerNoon), summerNoon).pet;
assert.equal(practiceImported.partnerSchedule.skills.garden.xp, 2);
assert.equal(waterTree(practiceImported, 0, summerNoon).partnerSchedule.skills.garden.xp, 2, 'saved daily limits still prevent repeat XP');
assert.equal(normalizePet(fedPet, summerNoon).achievements.counters.partnerScheduleClaimCount, 0, 'practice does not count as a schedule');
const almostLevelUp = structuredClone(longRoundPet);
almostLevelUp.partnerSchedule.skills.garden.xp = 39;
assert.deepEqual(waterTree(almostLevelUp, 0, summerNoon).partnerSchedule.skills.garden, { level: 2, xp: 0, masterCompletions: 0 });
const gardenMaster = structuredClone(longRoundPet);
gardenMaster.partnerSchedule.skills.garden = { level: 10, xp: 0, masterCompletions: 7 };
assert.deepEqual(waterTree(gardenMaster, 0, summerNoon).partnerSchedule.skills.garden, gardenMaster.partnerSchedule.skills.garden, 'practice cannot add mastery completions');

const cappedReductionMs = 96 * hourMs * (gardenCareReductionLimitPercent / 100);
const cappedPet = createGrowingPet(summerNoon, 96 * hourMs, {
  careReductionMs: cappedReductionMs,
  nextReadyAt: summerNoon + 96 * hourMs - cappedReductionMs,
});
const cappedPreview = getGardenCarePreview(cappedPet, cappedPet.garden.slots[0], 'water', summerNoon);
assert.equal(cappedPreview.actualReductionMs, 0);
assert.equal(cappedPreview.blockedReason, 'round_limit');
assert.equal(waterTree(cappedPet, 0, summerNoon).partnerSchedule.skills.garden.xp, 0, 'ineffective care grants no XP');

const nearReadyNow = new Date(2026, 0, 15, 12, 0, 0, 0).getTime();
const nearReadyPet = createGrowingPet(nearReadyNow - 59 * minuteMs, hourMs, {
  naturalReadyAt: nearReadyNow + minuteMs,
  nextReadyAt: nearReadyNow + minuteMs,
});
const floorResult = fertilizeTree(nearReadyPet, 0, 'heart', nearReadyNow);
assert.equal(floorResult.garden.slots[0].nextReadyAt - nearReadyNow, gardenMinimumCareRemainingMs);
assert.equal(floorResult.garden.slots[0].state, 'growing');
assert.equal(floorResult.inventory.heart_fertilizer, nearReadyPet.inventory.heart_fertilizer - 1);
assert.equal(floorResult.partnerSchedule.skills.garden.xp, 1, 'heart fertilizer grants one practice XP');
assert.equal(advanceGarden(floorResult, nearReadyNow + gardenMinimumCareRemainingMs - 1).garden.slots[0].state, 'growing');
assert.equal(advanceGarden(floorResult, nearReadyNow + gardenMinimumCareRemainingMs).garden.slots[0].state, 'ready');

const minimumPet = createGrowingPet(nearReadyNow - (hourMs - gardenMinimumCareRemainingMs), hourMs, {
  naturalReadyAt: nearReadyNow + gardenMinimumCareRemainingMs,
  nextReadyAt: nearReadyNow + gardenMinimumCareRemainingMs,
});
const minimumSlotBefore = minimumPet.garden.slots[0];
const minimumWaterResult = waterTree(minimumPet, 0, nearReadyNow);
assert.equal(minimumWaterResult.garden.slots[0].nextReadyAt, minimumSlotBefore.nextReadyAt);
assert.equal(minimumWaterResult.garden.slots[0].lastWateredAt, 0);
assert.equal(minimumWaterResult.garden.dailyWaterCount, minimumPet.garden.dailyWaterCount);
assert.equal(minimumWaterResult.achievements.counters.gardenWaterCount, minimumPet.achievements.counters.gardenWaterCount);
const minimumFertilizerResult = fertilizeTree(minimumPet, 0, 'heart', nearReadyNow);
assert.equal(minimumFertilizerResult.inventory.heart_fertilizer, minimumPet.inventory.heart_fertilizer);
assert.equal(minimumFertilizerResult.garden.slots[0].lastFertilizedAt, 0);
assert.equal(minimumFertilizerResult.garden.dailyFertilizeCount, minimumPet.garden.dailyFertilizeCount);
assert.equal(minimumWaterResult.partnerSchedule.skills.garden.xp, 0);
assert.equal(minimumFertilizerResult.partnerSchedule.skills.garden.xp, 0);

const heartFirstPet = fertilizeTree(createGrowingPet(nearReadyNow, 96 * hourMs), 0, 'heart', nearReadyNow);
const normalNextDayPet = fertilizeTree(heartFirstPet, 0, 'normal', nearReadyNow + dayMs);
assert.equal(heartFirstPet.garden.slots[0].fertilizerType, 'heart');
assert.equal(normalNextDayPet.garden.slots[0].fertilizerType, 'heart', 'normal fertilizer must not downgrade heart fertilizer');

const migrationNow = new Date(2026, 2, 10, 12, 0, 0, 0).getTime();
const migrationPet = createGrowingPet(migrationNow, 48 * hourMs);
const legacyDeadline = migrationPet.garden.slots[0].nextReadyAt;
const legacyGarden = structuredClone(migrationPet.garden) as unknown as Record<string, unknown>;
legacyGarden.schemaVersion = 2;
const legacySlots = legacyGarden.slots as Array<Record<string, unknown>>;
delete legacySlots[0].naturalReadyAt;
delete legacySlots[0].careReductionMs;
const migratedGarden = normalizeGardenState(legacyGarden, migrationNow);
assert.equal(migratedGarden.schemaVersion, gardenSchemaVersion);
assert.equal(migratedGarden.slots[0].nextReadyAt, legacyDeadline);
assert.equal(migratedGarden.slots[0].naturalReadyAt, legacyDeadline);
assert.equal(migratedGarden.slots[0].careReductionMs, 0);
assert.equal(migratedGarden.slots[0].maxHarvests, 9, 'schema 2 migration must not extend golden apple tree life again');

const readyPet = createGrowingPet(migrationNow, hourMs, {
  fertilizerType: 'heart',
  careReductionMs: 20 * minuteMs,
  naturalReadyAt: migrationNow,
  nextReadyAt: migrationNow,
  pendingDrops: [{ itemId: 'golden_apple', amount: 1 }],
  state: 'ready',
});
const harvestedPet = harvestTree(readyPet, 0, migrationNow);
assert.equal(harvestedPet.garden.slots[0].state, 'growing');
assert.equal(harvestedPet.garden.slots[0].careReductionMs, 0);
assert.equal(harvestedPet.garden.slots[0].fertilizerType, undefined);
assert.equal(harvestedPet.garden.slots[0].naturalReadyAt, harvestedPet.garden.slots[0].nextReadyAt);
assert(harvestedPet.garden.slots[0].naturalReadyAt > migrationNow);
assert.equal(harvestedPet.partnerSchedule.skills.garden.xp, 1);
assert.equal(harvestTree(harvestedPet, 0, migrationNow).partnerSchedule.skills.garden.xp, 1, 'a harvested round cannot award XP twice');

const finalHarvestPet = harvestTree({
  ...readyPet,
  garden: {
    ...readyPet.garden,
    slots: [{ ...readyPet.garden.slots[0], maxHarvests: 1 }, ...readyPet.garden.slots.slice(1)],
  },
}, 0, migrationNow);
assert.equal(finalHarvestPet.garden.slots[0].state, 'withered');
assert.equal(finalHarvestPet.garden.slots[0].naturalReadyAt, 0);
assert.equal(finalHarvestPet.garden.slots[0].careReductionMs, 0);
assert.equal(finalHarvestPet.garden.slots[0].nextReadyAt, 0);
assert.equal(finalHarvestPet.partnerSchedule.skills.garden.xp, 1, 'the final harvest still grants practice XP');

const recyclableSaplingPet = {
  ...createDefaultPet(migrationNow),
  coins: 100,
  inventory: { fruit_tree_sapling: 2, money_tree_sapling: 1 },
};
const recycledSaplingPet = recycleGardenSapling(recyclableSaplingPet, 'fruit_tree', migrationNow);
assert.equal(getGardenSaplingRecycleCoins('fruit_tree'), 15);
assert.equal(recycledSaplingPet.inventory.fruit_tree_sapling, 1);
assert.equal(recycledSaplingPet.coins, 115);
const rejectedExpensiveRecycle = recycleGardenSapling(recycledSaplingPet, 'money_tree', migrationNow);
assert.equal(getGardenSaplingRecycleCoins('money_tree'), 0);
assert.equal(rejectedExpensiveRecycle.inventory.money_tree_sapling, 1, 'expensive saplings must not be recyclable');
assert.equal(rejectedExpensiveRecycle.coins, recycledSaplingPet.coins);

console.log('garden care checks passed');
