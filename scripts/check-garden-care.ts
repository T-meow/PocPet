import assert from 'node:assert/strict';
import {
  advanceGarden,
  clearWitheredTree,
  fertilizeTree,
  gardenCareReductionLimitPercent,
  gardenSchemaVersion,
  gardenMinimumCareRemainingMs,
  gardenWaterReductionMaxMs,
  getGardenCarePreview,
  getGardenSaplingRecycleCoins,
  harvestTree,
  normalizeGardenState,
  plantTree,
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
    treeId: 'fruit_tree',
    plantedAt: now,
    naturalReadyAt,
    careReductionMs: 0,
    nextReadyAt: naturalReadyAt,
    harvestsUsed: 0,
    maxHarvests: 10,
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
const longRoundPet = createGrowingPet(summerNoon, 96 * hourMs, { treeId: 'golden_apple_tree' }, {
  weather: 'rainy',
});
longRoundPet.garden.tools.wateringCanLevel = 3;
const longRoundSlot = longRoundPet.garden.slots[0];

const earlyWater = getGardenCarePreview(longRoundPet, longRoundSlot, 'water', summerNoon);
const laterWater = getGardenCarePreview(longRoundPet, longRoundSlot, 'water', summerNoon + 2 * hourMs);
assert.equal(earlyWater.percent, 18);
assert.equal(earlyWater.nominalReductionMs, gardenWaterReductionMaxMs);
assert.equal(laterWater.nominalReductionMs, earlyWater.nominalReductionMs, 'watering value must not depend on action time');

assert.equal(getGardenCarePreview(longRoundPet, longRoundSlot, 'normal', summerNoon).actualReductionMs, 0.96 * hourMs);
assert.equal(getGardenCarePreview(longRoundPet, longRoundSlot, 'heart', summerNoon).actualReductionMs, 1.92 * hourMs);
const ordinaryPet = createGrowingPet(summerNoon, 12 * hourMs);
const normalPreview = getGardenCarePreview(ordinaryPet, ordinaryPet.garden.slots[0], 'normal', summerNoon);
const heartPreview = getGardenCarePreview(ordinaryPet, ordinaryPet.garden.slots[0], 'heart', summerNoon);
assert.equal(normalPreview.nominalReductionMs, 3.6 * hourMs);
assert.equal(heartPreview.nominalReductionMs, 4.8 * hourMs);

for (const treeId of ['money_tree', 'golden_apple_tree'] as const) {
  const advanced = createGrowingPet(summerNoon, 48 * hourMs, { treeId });
  advanced.inventory = { normal_fertilizer: 30, heart_fertilizer: 30 };
  const batch = fertilizeTree(advanced, 0, 'normal', summerNoon, 30);
  assert.equal(batch.inventory.normal_fertilizer, 20, 'only the ten effective doses are consumed');
  assert.equal(batch.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs);
  assert.equal(batch.garden.slots[0].nextReadyAt, summerNoon + 43.2 * hourMs);
  assert.equal(batch.garden.slots[0].fertilizerType, undefined, 'advanced fertilizer does not grant ordinary-tree drop bonuses');
  const atLimit = fertilizeTree(batch, 0, 'heart', summerNoon, 10);
  assert.deepEqual(atLimit.inventory, batch.inventory, 'both fertilizers share the daily cap');
  assert.deepEqual(atLimit.partnerSchedule.skills.garden, batch.partnerSchedule.skills.garden, 'blocked use grants no XP');
  assert.equal(getGardenCarePreview(batch, batch.garden.slots[0], 'heart', summerNoon).blockedReason, 'daily_limit');

  let singles = advanced;
  for (let index = 0; index < 10; index += 1) singles = fertilizeTree(singles, 0, 'normal', summerNoon);
  assert.deepEqual(singles.garden, batch.garden, 'batch and repeated use have the same timing and counters');
  assert.deepEqual(singles.partnerSchedule.skills.garden, batch.partnerSchedule.skills.garden);

  const mixed = fertilizeTree(fertilizeTree(advanced, 0, 'normal', summerNoon, 3), 0, 'heart', summerNoon, 30);
  assert.equal(mixed.inventory.normal_fertilizer, 27);
  assert.equal(mixed.inventory.heart_fertilizer, 26, 'the final dose is limited to the remaining daily allowance');
  assert.equal(mixed.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs);
  const imported = parseSaveFileText(createSaveFileText(mixed, null, summerNoon), summerNoon).pet;
  assert.equal(imported.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs);
  assert.deepEqual(fertilizeTree(imported, 0, 'normal', summerNoon).inventory, imported.inventory, 'save reload cannot reset the daily cap');
  const beforeReset = new Date(2026, 6, 16, 4, 59, 59).getTime();
  const afterReset = new Date(2026, 6, 16, 5, 0, 0).getTime();
  assert.deepEqual(fertilizeTree(imported, 0, 'normal', beforeReset).inventory, imported.inventory);
  const tomorrow = fertilizeTree(imported, 0, 'heart', afterReset, 2);
  assert.equal(tomorrow.inventory.heart_fertilizer, imported.inventory.heart_fertilizer - 2);
  assert.equal(tomorrow.garden.slots[0].dailyAdvancedFertilizerReductionMs, 1.92 * hourMs, 'daily usage resets at 05:00');

  const ready = structuredClone(batch);
  ready.garden.slots[0].state = 'ready';
  ready.garden.slots[0].pendingDrops = [{ itemId: 'apple', amount: 1 }];
  const harvested = harvestTree(ready, 0, summerNoon);
  assert.equal(harvested.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs, 'harvesting does not reset daily usage');
  const cleared = clearWitheredTree({ ...batch, coins: 1000 }, 0, summerNoon);
  const clearedImported = parseSaveFileText(createSaveFileText(cleared, null, summerNoon), summerNoon).pet;
  assert.equal(clearedImported.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs, 'an empty plot retains daily usage');
  const replanted = plantTree({ ...clearedImported, inventory: { ...clearedImported.inventory, [treeId + '_sapling']: 1 } }, 0, treeId, summerNoon);
  assert.equal(replanted.garden.slots[0].dailyAdvancedFertilizerReductionMs, 4.8 * hourMs, 'replanting retains daily usage');
}
const sixHourCapPet = { ...longRoundPet, inventory: { normal_fertilizer: 30, heart_fertilizer: 30 } };
const unevenDurationPet = createGrowingPet(summerNoon, 48 * hourMs + 999, { treeId: 'money_tree' }, { inventory: { normal_fertilizer: 20 } });
const unevenCap = fertilizeTree(unevenDurationPet, 0, 'normal', summerNoon, 20);
assert.equal(unevenCap.inventory.normal_fertilizer, 10, 'fractional percentages must not require an extra dose for a few milliseconds');
const sixHourCap = fertilizeTree(sixHourCapPet, 0, 'normal', summerNoon, 30);
assert.equal(sixHourCap.garden.slots[0].dailyAdvancedFertilizerReductionMs, 6 * hourMs);
assert.equal(sixHourCap.inventory.normal_fertilizer, 23, 'a partial seventh dose reaches the six-hour limit');
const scarce = fertilizeTree({ ...longRoundPet, inventory: { normal_fertilizer: 2 } }, 0, 'normal', summerNoon, 20);
assert.equal(scarce.inventory.normal_fertilizer ?? 0, 0);
assert.equal(scarce.garden.slots[0].dailyAdvancedFertilizerReductionMs, 1.92 * hourMs);
for (const quantity of [0, -1, NaN, Infinity]) assert.deepEqual(fertilizeTree(longRoundPet, 0, 'normal', summerNoon, quantity).inventory, longRoundPet.inventory);
const legacyAdvanced = structuredClone(longRoundPet.garden) as unknown as Record<string, unknown>;
legacyAdvanced.schemaVersion = 5;
delete (legacyAdvanced.slots as Array<Record<string, unknown>>)[0].dailyAdvancedFertilizerReductionMs;
assert.equal(normalizeGardenState(legacyAdvanced, summerNoon).slots[0].dailyAdvancedFertilizerReductionMs, 0, 'old advanced trees start with unused allowance');

const wateredPet = waterTree(longRoundPet, 0, summerNoon);
assert.equal(wateredPet.partnerSchedule.skills.garden.xp, 1);
assert.equal(longRoundPet.partnerSchedule.skills.garden.xp, 0, 'practice does not mutate the source');
assert.equal(waterTree(wateredPet, 0, summerNoon).partnerSchedule.skills.garden.xp, 1, 'repeat watering grants no XP');
const fedPet = fertilizeTree(waterTree(ordinaryPet, 0, summerNoon), 0, 'normal', summerNoon);
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
const advancedRoundCap = structuredClone(cappedPet);
advancedRoundCap.garden.slots[0].treeId = 'golden_apple_tree';
assert.equal(getGardenCarePreview(advancedRoundCap, advancedRoundCap.garden.slots[0], 'normal', summerNoon, 10).blockedReason, 'round_limit');
assert.deepEqual(fertilizeTree(advancedRoundCap, 0, 'normal', summerNoon, 10).inventory, advancedRoundCap.inventory);

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
const advancedNearReady = structuredClone(nearReadyPet);
advancedNearReady.garden.slots[0].treeId = 'money_tree';
const advancedFloor = fertilizeTree(advancedNearReady, 0, 'heart', nearReadyNow, 3);
assert.equal(advancedFloor.garden.slots[0].nextReadyAt - nearReadyNow, gardenMinimumCareRemainingMs);
assert.equal(advancedFloor.inventory.heart_fertilizer, advancedNearReady.inventory.heart_fertilizer - 1);
assert.deepEqual(fertilizeTree(advancedFloor, 0, 'normal', nearReadyNow, 3).inventory, advancedFloor.inventory);

const heartFirstPet = fertilizeTree(createGrowingPet(nearReadyNow, 96 * hourMs), 0, 'heart', nearReadyNow);
const normalNextDayPet = fertilizeTree(heartFirstPet, 0, 'normal', nearReadyNow + dayMs);
assert.equal(heartFirstPet.garden.slots[0].fertilizerType, 'heart');
assert.equal(normalNextDayPet.garden.slots[0].fertilizerType, 'heart', 'normal fertilizer must not downgrade heart fertilizer');
assert.equal(normalNextDayPet.inventory.normal_fertilizer, heartFirstPet.inventory.normal_fertilizer, 'a new day cannot spend fertilizer twice in one round');

const migrationNow = new Date(2026, 2, 10, 12, 0, 0, 0).getTime();
const migrationPet = createGrowingPet(migrationNow, 48 * hourMs, { treeId: 'golden_apple_tree', maxHarvests: 9 });
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
assert.equal(migratedGarden.slots[0].maxHarvests, 10, 'schema 2 trees receive only the new balance extension');

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
