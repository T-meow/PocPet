import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceAdventure, buyAdventureSupply, claimAdventureResult, claimAdventureStarter, discardAdventureItem, getAdventureRewardPreview, getAdventureServiceQuote, getAdventureStartReason, pickupAdventureLoot, redeemAdventureTreasure, returnFromAdventure, startAdventure, transportAdventureSupply, useAdventureSupply } from '../src/core/adventure';
import { adventureBagCapacity, getAdventureRegions, getAdventureSteps } from '../src/core/adventureData';
import { defaultAdventureState, getAdventureBagCount, isAdventureMapUnlocked, normalizeAdventureState } from '../src/core/adventureState';
import { adventureTreasureIds, getAdventureTreasureValue } from '../src/core/adventureItems';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { getEffectiveDailyDateKey } from '../src/core/gameClock';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { applyPetAction, buyItem, getItemPurchaseQuote, useInventoryItem } from '../src/core/petActions';
import { getInventoryItem } from '../src/core/items';
import { getItemRecoveryPreview } from '../src/core/itemEffects';
import { selectNeighborGift } from '../src/core/neighborGifts';
import { advancePet } from '../src/core/petLifecycle';
import { canSpendCompanionTime, craftRecipe } from '../src/core/kitchen';
import { getRecipe, getRecipeMaterialCost } from '../src/core/kitchenRecipes';
import { startMiniGame } from '../src/core/miniGames';
import { startPartnerSchedule } from '../src/core/partnerSchedule';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { createSaveFileText, createSaveFilePlainText, parseSaveFileText, minimumSaveReaderVersion } from '../src/core/saveCodec';
import { toPersistedPet } from '../src/core/persistedPet';
import { inventoryItemLimit } from '../src/core/saveMetadata';
import type { Inventory, ItemId, PetState } from '../src/core/petTypes';
import { createAdventureActionGate, adventureActionCommitMs, adventureActionDurationMs, type AdventureActionState } from '../src/ui/adventureActionGate';

const now = new Date(2026, 8, 17, 12).getTime();
const fresh = (level = 1): PetState => ({ ...createDefaultPet(now), adventure: { ...defaultAdventureState(), completed: { tutorial: 1 } }, level, hunger: getPetStatCap(level), mood: getPetStatCap(level), health: getPetStatCap(level), energy: getPetStatCap(level), coins: 1000, hearts: 100,
  inventory: { dish_carrot_rice: 20, trail_mix: 15, berry_bait: 10, trail_rope: 1, apple: 5, golden_apple: 2, energy_drink: 10, rice: 10, egg: 10 } });
const beginner = (): PetState => ({ ...fresh(), adventure: defaultAdventureState() });
const tutorial = (pet = beginner(), bag: Inventory = {}) => startAdventure(pet, 'tutorial', 'official.furo', 'Furo', bag, false, now);
const start = (pet = fresh(), bag: Inventory = { dish_carrot_rice: 5, berry_bait: 1, energy_drink: 2, apple: 1 }, tool = true) => startAdventure(pet, 'valley', 'official.furo', 'Furo', bag, tool, now);
const step = (pet: PetState, choice?: string) => {
  const trip = pet.adventure.active!;
  return advanceAdventure(pet, trip.id, trip.choices.length, choice ?? getAdventureSteps(trip.rulesVersion, trip.region)[trip.choices.length].choices[0].id, now);
};
const eat = (pet: PetState, id: ItemId, quantity = 1, source: 'bag' | 'loot' = 'bag') => useAdventureSupply(pet, pet.adventure.active!.id, pet.adventure.active!.revision, id, quantity, source);
const buy = (pet: PetState, id: ItemId, quantity = 1) => buyAdventureSupply(pet, pet.adventure.active!.id, pet.adventure.active!.revision, id, quantity);
const deliver = (pet: PetState, id: ItemId, quantity = 1) => transportAdventureSupply(pet, pet.adventure.active!.id, pet.adventure.active!.revision, id, quantity);
const discard = (pet: PetState, id: ItemId, quantity = 1, source: 'bag' | 'loot' | 'tool' = 'bag') => discardAdventureItem(pet, pet.adventure.active!.id, pet.adventure.active!.revision, id, quantity, source);
const roundTrip = (pet: PetState) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const richStep = (pet: PetState, id: string) => step({ ...pet, hunger: getPetStatCap(pet), energy: getPetStatCap(pet) }, id);
const serviceTrip = () => ['entrance', 'bank', 'lure', 'rope'].reduce(richStep, start(fresh(), { berry_bait: 1 }));
const finish = (pet: PetState) => claimAdventureResult(returnFromAdventure(pet, pet.adventure.active!.id, now), pet.adventure.active!.id);

const originalRandom = Math.random;
Math.random = () => .99999;
try {
  assert.deepEqual(getAdventureRegions().filter(region => region.open).map(region => region.id), ['valley']);
  assert.equal(getAdventureRegions().length, 5);
  assert.equal(getAdventureSteps().length, 6);
  for (const node of getAdventureSteps()) for (const choice of node.choices) assert.ok(choice.hunger > 0 && choice.energy > 0);
  const legacy = { ...fresh() } as Partial<PetState>;
  delete legacy.adventure;
  assert.deepEqual(normalizePet(legacy, now).adventure, normalizeAdventureState(undefined));
  assert.equal(minimumSaveReaderVersion, '1.9.0');
  assert.equal(JSON.parse(createSaveFilePlainText(fresh(), null, now)).minimumReaderVersion, '1.9.0');
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url), 'utf8'));
  assert.equal(parseSaveFileText(fixture.text, fixture.savedAt).pet.adventure.active, undefined);

  // A destination must be chosen, and the four-stop tutorial is the only first trip.
  const novice = beginner();
  const unselected = startAdventure(novice, undefined, 'official.furo', 'Furo', {}, false, now);
  assert.equal(unselected.adventure.active, undefined);
  assert.deepEqual(unselected.inventory, novice.inventory);
  assert.ok(getAdventureStartReason(novice, undefined, now));
  assert.equal(startAdventure(novice, 'valley', 'official.furo', 'Furo', {}, false, now).adventure.active, undefined);
  assert.equal(isAdventureMapUnlocked(novice.adventure), false);
  assert.equal(getAdventureSteps(4, 'tutorial').length, 4);
  assert.equal(getInventoryItem('map_handbook')?.usable, false);
  assert.equal(tutorial({ ...novice, hunger: 7, energy: 2 }).adventure.active, undefined);
  let scouting = tutorial({ ...novice, hunger: 32, energy: 8 });
  const tutorialId = scouting.adventure.active!.id;
  assert.equal(scouting.adventure.active!.neighborId, undefined);
  assert.equal(advanceAdventure(scouting, tutorialId, 0, 'entrance', now), scouting, 'a valley choice cannot advance the tutorial');
  for (let i = 0; i < 4; i++) {
    const before = scouting;
    const choice = getAdventureSteps(4, 'tutorial')[i].choices[0].id;
    scouting = step(scouting);
    assert.equal(scouting.adventure.active!.choices.length, i + 1);
    assert.equal(scouting.hunger, before.hunger - 8);
    assert.equal(scouting.energy, before.energy - 2);
    assert.equal(advanceAdventure(scouting, tutorialId, i, choice, now), scouting, 'a repeated tutorial click cannot duplicate finds or costs');
    assert.deepEqual(roundTrip(scouting).adventure, scouting.adventure, 'every tutorial stop survives a saved restart');
    scouting = roundTrip(scouting);
    if (i < 3) {
      assert.deepEqual(scouting.adventure.active!.bag, {}, 'returning before completion cannot farm the fixed reward');
      const earlyTutorial = finish(scouting);
      assert.equal(isAdventureMapUnlocked(earlyTutorial.adventure), false);
      assert.equal(earlyTutorial.inventory.map_handbook, undefined);
      assert.equal(earlyTutorial.inventory.coin_hoard, undefined);
      assert.ok(tutorial({ ...earlyTutorial, hunger: 32, energy: 8 }).adventure.active, 'an unfinished tutorial can be retried');
    }
  }
  assert.deepEqual(scouting.adventure.active!.bag, { map_handbook: 1, coin_hoard: 1 });
  assert.deepEqual(getAdventureRewardPreview(scouting), { steps: 4, complete: true, first: true, hearts: 0, coins: 0 });
  assert.equal(advanceAdventure(scouting, tutorialId, 4, 'tutorial_finish', now), scouting);
  const tutorialReturned = roundTrip(returnFromAdventure(scouting, tutorialId, now));
  assert.ok(tutorialReturned.adventure.pending!.complete);
  const tutorialDone = claimAdventureResult(tutorialReturned, tutorialId);
  assert.equal(isAdventureMapUnlocked(tutorialDone.adventure), true);
  assert.equal(tutorialDone.inventory.map_handbook, 1);
  assert.equal(tutorialDone.inventory.coin_hoard, 1);
  assert.equal(tutorialDone.adventure.discoveries.length, 4);
  assert.equal(tutorialDone.adventure.completed.tutorial, 1);
  assert.equal(tutorialDone.adventure.lastCompletedDay.valley, undefined, 'the tutorial does not consume daily valley scouting');
  assert.equal(claimAdventureResult(tutorialDone, tutorialId), tutorialDone);
  const nextTrip = { ...roundTrip(tutorialDone), hunger: 100, energy: 100 };
  assert.ok(startAdventure(nextTrip, 'valley', 'official.furo', 'Furo', {}, false, now).adventure.active);
  assert.equal(tutorial(nextTrip).adventure.active, undefined, 'the completed tutorial cannot be farmed');
  assert.equal(startAdventure(nextTrip, 'tutorial', 'official.furo', 'Furo', {}, false, now + 86400000).adventure.active, undefined);
  assert.equal(startAdventure(nextTrip, undefined, 'official.furo', 'Furo', {}, false, now).adventure.active, undefined, 'unlocking the map never substitutes a default destination');
  assert.equal(useInventoryItem(nextTrip, 'coin_hoard', now).coins, nextTrip.coins + 360);
  assert.equal(isAdventureMapUnlocked(roundTrip({ ...nextTrip, inventory: {} }).adventure), true, 'map access is recorded independently of the keepsake');
  let fullTutorial = tutorial(beginner(), { trail_mix: 12 });
  for (let i = 0; i < 4; i++) fullTutorial = step(fullTutorial);
  assert.deepEqual(fullTutorial.adventure.active!.loot, { map_handbook: 1, coin_hoard: 1 });
  fullTutorial = roundTrip(fullTutorial);
  assert.ok(returnFromAdventure(fullTutorial, fullTutorial.adventure.active!.id, now).adventure.active, 'pending finds must be handled before returning');
  fullTutorial = discard(fullTutorial, 'trail_mix', 2);
  for (const id of ['map_handbook', 'coin_hoard']) fullTutorial = pickupAdventureLoot(fullTutorial, fullTutorial.adventure.active!.id, fullTutorial.adventure.active!.revision, id, 1);
  assert.equal(finish(fullTutorial).inventory.map_handbook, 1);
  const overflowTutorial = claimAdventureResult({ ...tutorialReturned, inventory: { ...tutorialReturned.inventory, coin_hoard: inventoryItemLimit } }, tutorialId);
  assert.equal(overflowTutorial.adventure.pending!.items.coin_hoard, 1);
  assert.equal(overflowTutorial.inventory.map_handbook, 1);
  assert.equal(claimAdventureResult(roundTrip(overflowTutorial), tutorialId).adventure.completed.tutorial, 1, 'partial collection never repeats tutorial completion');
  const tutorialOverflowCleared = claimAdventureResult(useInventoryItem(roundTrip(overflowTutorial), 'coin_hoard', now), tutorialId);
  assert.equal(tutorialOverflowCleared.adventure.pending, undefined);
  assert.equal(tutorialOverflowCleared.inventory.map_handbook, 1);
  console.log('Tutorial checks passed: explicit destination, map lock, four low-cost stops, fixed finds, safe retries, saves, full bags and one-time completion.');

  const starterBase = { ...fresh(), inventory: {} };
  const starter = claimAdventureStarter(starterBase);
  assert.deepEqual(starter.inventory, { trail_mix: 2, berry_bait: 1, dish_carrot_rice: 4 });
  assert.deepEqual(starterBase.inventory, {});
  assert.equal(claimAdventureStarter(starter), starter);
  const oldStarter = { ...starterBase, adventure: normalizeAdventureState({ schemaVersion: 1, starterClaimed: true }) };
  const topUp = claimAdventureStarter(oldStarter);
  assert.deepEqual(topUp.inventory, { dish_carrot_rice: 4 });
  assert.equal(claimAdventureStarter(roundTrip(topUp)).inventory.dish_carrot_rice, 4);
  const fullStarter = { ...oldStarter, inventory: { dish_carrot_rice: inventoryItemLimit - 3 } };
  assert.deepEqual(claimAdventureStarter(fullStarter).inventory, fullStarter.inventory);
  assert.equal(claimAdventureStarter(fullStarter).adventure.starterMealsClaimed, false);
  assert.equal(claimAdventureStarter({ ...fullStarter, inventory: {} }).inventory.dish_carrot_rice, 4);

  let pet = start();
  const originalTrip = structuredClone(pet.adventure.active!);
  assert.equal(originalTrip.rulesVersion, 6);
  assert.ok(adventureTreasureIds.includes(originalTrip.treasure!));
  assert.equal(pet.inventory.trail_rope, undefined);
  assert.equal(pet.inventory.dish_carrot_rice, 15);
  assert.notEqual(originalTrip.neighborId, 'official.furo');
  assert.equal(pet.energy, 100);
  assert.deepEqual(start(pet).adventure, pet.adventure);
  assert.equal(startAdventure(fresh(), 'coast', 'official.furo', 'Furo', {}, false, now).adventure.active, undefined);
  for (const bag of [{ trail_mix: 13 }, { trail_mix: -1 }, { trail_mix: NaN }, { trail_mix: 1.5 }, { unknown: 1 }, { rice: 1 }]) assert.equal(start(fresh(), bag).adventure.active, undefined);
  assert.equal(getAdventureBagCount(start(fresh(), { trail_mix: 12 }).adventure.active!.bag), adventureBagCapacity);
  for (const base of [{ ...fresh(), isSleeping: true }, { ...fresh(), energy: 11 }, { ...fresh(), hunger: 44 }, { ...fresh(), inventory: {} }]) assert.equal(start(base).adventure.active, undefined);
  pet = step(pet, 'entrance');
  assert.equal(pet.hunger, 55); assert.equal(pet.energy, 88);
  assert.equal(advanceAdventure(pet, originalTrip.id, 0, 'entrance', now), pet);
  assert.equal(advanceAdventure(pet, 'other-trip', 1, 'bank', now), pet);
  assert.deepEqual(roundTrip(pet).adventure.active, pet.adventure.active);
  assert.deepEqual(toPersistedPet(pet, now).adventure, pet.adventure);
  assert.deepEqual(advancePet(pet, now + 1000).adventure.active, pet.adventure.active);
  const night = new Date(2026, 8, 17, 23).getTime();
  assert.equal(advancePet({ ...pet, lastUpdatedAt: night, lastInteractionAt: night - 3600000, lastEnergyRecoveryAt: night }, night + 60000).isSleeping, false);
  const poor = { ...pet, hunger: 1, energy: 1 };
  assert.deepEqual(step(poor, 'bank').adventure, poor.adventure);
  assert.equal(returnFromAdventure(poor, originalTrip.id, now).adventure.active, undefined);
  const restored = eat(poor, 'dish_carrot_rice', 1);
  assert.equal(restored.hunger, 61); assert.equal(restored.energy, 3);
  assert.equal(restored.adventure.active?.bag.dish_carrot_rice, 4);
  assert.equal(useAdventureSupply(restored, originalTrip.id, poor.adventure.active!.revision, 'dish_carrot_rice', 1), restored);
  assert.equal(eat(poor, 'berry_bait'), poor);
  for (const quantity of [0, -1, 1.5, NaN, 13]) assert.equal(eat(poor, 'dish_carrot_rice', quantity), poor);
  const batch = eat(poor, 'dish_carrot_rice', 2);
  assert.equal(batch.hunger, 100); assert.equal(batch.energy, 5);
  assert.equal(batch.adventure.active?.bag.dish_carrot_rice, 3);
  const preview = getItemRecoveryPreview(poor, getInventoryItem('dish_carrot_rice')!, 2, []);
  assert.equal(batch.hunger - poor.hunger, preview.actual.hunger);

  const almostFull = { ...poor, hunger: 90 };
  const limitedBatch = eat(almostFull, 'dish_carrot_rice', 5);
  assert.equal(limitedBatch.adventure.active!.bag.dish_carrot_rice, 4, 'travel meals stop after the first filling serving');
  assert.equal(limitedBatch.energy, almostFull.energy + 2);
  assert.equal(limitedBatch.isOverfed, true);
  assert.equal(limitedBatch.achievements.counters.totalItemUseCount, almostFull.achievements.counters.totalItemUseCount + 1);
  const blockedMeal = eat(limitedBatch, 'dish_carrot_rice', 4);
  assert.deepEqual(blockedMeal.adventure, limitedBatch.adventure, 'a fresh revision cannot bypass satiety');
  assert.deepEqual(blockedMeal.achievements, limitedBatch.achievements);
  assert.deepEqual(eat(roundTrip(limitedBatch), 'dish_carrot_rice').adventure, limitedBatch.adventure);
  const refreshed = eat(limitedBatch, 'energy_drink');
  assert.ok(refreshed.energy > limitedBatch.energy, 'full travelers can restore energy without food');
  const afterWalking = step({ ...limitedBatch, energy: 100 });
  assert.equal(afterWalking.isOverfed, false, 'route costs can release satiety without waiting');
  assert.ok(eat(afterWalking, 'dish_carrot_rice').hunger > afterWalking.hunger);
  const groundFood = { ...almostFull, adventure: { ...almostFull.adventure, active: { ...almostFull.adventure.active!, loot: { apple: 2 } } } };
  const groundMeal = eat(groundFood, 'apple', 2, 'loot');
  assert.equal(groundMeal.adventure.active!.loot.apple, 1, 'ground food uses the same batch protection');
  assert.deepEqual(eat(groundMeal, 'apple', 1, 'loot').adventure, groundMeal.adventure);

  const traveling = { ...pet, level: 3 };
  assert.equal(canSpendCompanionTime(traveling), false);
  assert.equal(applyPetAction(traveling, 'sleep', now).isSleeping, false);
  assert.deepEqual(useInventoryItem(traveling, 'apple', now).inventory, traveling.inventory);
  assert.equal(craftRecipe(traveling, 'egg_rice', false, 1, 'during-trip', now), traveling);
  assert.equal(startMiniGame(traveling, 'matching', 'normal', 'official.furo', 'during-trip', now), traveling);
  assert.equal(startPartnerSchedule(traveling, traveling.partnerSchedule.offers[0].id, now).partnerSchedule.active, undefined);

  // A full bag keeps both finds on the ground across reloads; the same fruit is never granted twice.
  let full = step(step(start(fresh(), { trail_mix: 12 }), 'entrance'), 'bank');
  assert.deepEqual(full.adventure.active!.loot, { apple: 2 });
  assert.equal(getAdventureBagCount(full.adventure.active!.bag), 12);
  assert.deepEqual(roundTrip(full).adventure.active, full.adventure.active);
  assert.deepEqual(step(full, 'apple').adventure, full.adventure);
  assert.deepEqual(returnFromAdventure(full, full.adventure.active!.id, now).adventure, full.adventure);
  assert.equal(pickupAdventureLoot(full, full.adventure.active!.id, full.adventure.active!.revision, 'apple', 1), full);
  const beforeGround = full;
  full = eat(full, 'apple', 1, 'loot');
  assert.equal(full.hunger, 20); assert.equal(full.adventure.active!.loot.apple, 1);
  assert.equal(useAdventureSupply(full, full.adventure.active!.id, beforeGround.adventure.active!.revision, 'apple', 1, 'loot'), full);
  const beforeDrop = full;
  full = discard(full, 'trail_mix', 2);
  assert.equal(full.coins, beforeDrop.coins); assert.deepEqual(full.inventory, beforeDrop.inventory);
  assert.equal(discardAdventureItem(full, full.adventure.active!.id, beforeDrop.adventure.active!.revision, 'trail_mix', 2), full);
  const beforePickup = full;
  full = pickupAdventureLoot(full, full.adventure.active!.id, full.adventure.active!.revision, 'apple', 1);
  assert.equal(full.adventure.active!.bag.apple, 1); assert.deepEqual(full.adventure.active!.loot, {});
  assert.equal(pickupAdventureLoot(full, full.adventure.active!.id, beforePickup.adventure.active!.revision, 'apple', 1), full);
  full = richStep(full, 'apple');
  assert.equal(full.adventure.active!.bag.apple, undefined, 'newly gathered fruit can lure animals');
  full = discard(full, 'trail_rope', 1, 'tool');
  assert.equal(full.adventure.active!.tool, false);
  assert.deepEqual(richStep(full, 'rope').adventure, full.adventure);
  const settledFinds = finish(full);
  assert.equal(settledFinds.inventory.apple, 5, 'eaten/lured fruit is not granted at return');
  assert.equal(settledFinds.inventory.trail_mix, 13, 'two discarded rations stay discarded');
  assert.equal(settledFinds.inventory.trail_rope, undefined);
  let abandoned = step(step(start(fresh(), { trail_mix: 12 }), 'entrance'), 'bank');
  abandoned = discard(abandoned, 'apple', 2, 'loot');
  assert.deepEqual(abandoned.adventure.active!.loot, {});
  assert.equal(finish(abandoned).inventory.apple, 5);
  const partialFit = ['entrance', 'bank'].reduce(richStep, start(fresh(), { trail_mix: 11 }));
  assert.deepEqual(partialFit.adventure.active!.loot, { apple: 2 });
  const onePicked = pickupAdventureLoot(partialFit, partialFit.adventure.active!.id, partialFit.adventure.active!.revision, 'apple', 1);
  assert.equal(onePicked.adventure.active!.loot.apple, 1);
  assert.equal(getAdventureBagCount(onePicked.adventure.active!.bag), 12);

  let shop = serviceTrip();
  assert.ok(shop.adventure.active!.neighborId);
  assert.deepEqual(shop.adventure.active!.shopStock, { dish_egg_rice: 2, trail_mix: 2, berry_bait: 1 });
  const beforeBuy = shop;
  shop = buy(shop, 'dish_egg_rice');
  assert.equal(shop.coins, beforeBuy.coins - 30);
  assert.equal(buyAdventureSupply(shop, shop.adventure.active!.id, beforeBuy.adventure.active!.revision, 'dish_egg_rice'), shop);
  shop = buy(roundTrip(shop), 'dish_egg_rice');
  assert.equal(shop.adventure.active!.bag.dish_egg_rice, 2);
  assert.equal(buy(shop, 'dish_egg_rice'), shop);
  shop = buy(shop, 'trail_mix', 2);
  shop = buy(shop, 'berry_bait');
  assert.equal(shop.coins, beforeBuy.coins - 60 - 72 - 10);
  assert.deepEqual(roundTrip(shop).adventure.active, shop.adventure.active);
  assert.equal(buy(shop, 'trail_mix'), shop);
  const beforeDelivery = shop;
  shop = deliver(shop, 'dish_carrot_rice', 2);
  assert.equal(shop.hearts, beforeDelivery.hearts - 4);
  assert.equal(shop.inventory.dish_carrot_rice, beforeDelivery.inventory.dish_carrot_rice - 2);
  assert.equal(transportAdventureSupply(shop, shop.adventure.active!.id, beforeDelivery.adventure.active!.revision, 'dish_carrot_rice', 2), shop);
  shop = deliver(roundTrip(shop), 'apple');
  assert.equal(shop.adventure.active!.transportedCount, 3);
  assert.equal(deliver(shop, 'apple'), shop);
  for (const state of [
    { ...beforeBuy, coins: 0 },
    { ...beforeBuy, adventure: { ...beforeBuy.adventure, active: { ...beforeBuy.adventure.active!, bag: { trail_mix: 12 } } } },
    { ...beforeBuy, adventure: { ...beforeBuy.adventure, active: { ...beforeBuy.adventure.active!, neighborId: undefined } } },
  ]) assert.equal(buy(state, 'trail_mix'), state);
  for (const state of [{ ...beforeDelivery, hearts: 3 }, { ...beforeDelivery, inventory: {} }]) assert.equal(deliver(state, 'dish_carrot_rice', 2), state);
  const noSpace = { ...beforeDelivery, adventure: { ...beforeDelivery.adventure, active: { ...beforeDelivery.adventure.active!, bag: { trail_mix: 12 } } } };
  assert.equal(deliver(noSpace, 'apple'), noSpace);
  assert.equal(getAdventureServiceQuote(beforeBuy, 'golden_apple', 1, 'buy').canTrade, false);

  // Legacy active trips retain old costs/rewards and receive already discovered fruit only once.
  const oldActive = { ...originalTrip, choices: ['entrance', 'bank'], bag: { trail_mix: 2 }, bought: true, transported: true };
  const migrated = normalizeAdventureState({ schemaVersion: 1, starterClaimed: true, active: oldActive });
  assert.equal(migrated.active!.rulesVersion, 1);
  assert.equal(migrated.active!.bag.apple, 2);
  assert.deepEqual(migrated.active!.shopStock, {});
  assert.equal(migrated.active!.purchases, 1); assert.equal(migrated.active!.transportedCount, 1);
  assert.deepEqual(normalizeAdventureState(migrated), migrated);
  let oldTrip = { ...fresh(), hunger: 80, adventure: migrated };
  oldTrip = eat(oldTrip, 'apple');
  assert.equal(roundTrip(oldTrip).adventure.active!.bag.apple, 1);
  const oldHunger = oldTrip.hunger;
  oldTrip = step(oldTrip, 'apple');
  assert.equal(oldTrip.hunger, oldHunger - 3);
  for (const id of ['rope', 'clearing', 'overlook']) oldTrip = step(oldTrip, id);
  assert.equal(getAdventureRewardPreview(oldTrip).coins, 78);
  assert.equal(finish(oldTrip).inventory.apple, fresh().inventory.apple);
  const oldPending = returnFromAdventure(oldTrip, oldTrip.adventure.active!.id, now).adventure.pending!;
  const pendingMigration = normalizeAdventureState({ schemaVersion: 1, pending: { ...oldPending, items: { apple: 2 } } });
  assert.deepEqual(pendingMigration.pending, { ...oldPending, items: { apple: 2 } });
  assert.equal(start(finish(oldTrip)).adventure.active, undefined, 'completed entrances cannot be restarted on the same day');
  assert.equal(start(finish(start())).adventure.active!.rulesVersion, 6, 'unfinished entrances can be retried under new rules');
  const oldBeforeDiscovery = { ...fresh(), adventure: normalizeAdventureState({ schemaVersion: 1, active: { ...oldActive, choices: ['entrance'], bought: false, transported: false } }) };
  const legacyBank = step(oldBeforeDiscovery, 'bank');
  assert.equal(legacyBank.hunger, 96); assert.equal(legacyBank.adventure.active!.bag.apple, 2);
  assert.equal(roundTrip(legacyBank).adventure.active!.bag.apple, 2);
  let legacyService = ['detour', 'rope'].reduce(richStep, legacyBank);
  legacyService = buy(legacyService, 'trail_mix');
  assert.equal(buy(roundTrip(legacyService), 'berry_bait').coins, legacyService.coins, 'legacy shop stays limited to one purchase');
  assert.equal(deliver(legacyService, 'apple', 2), legacyService);
  legacyService = deliver(legacyService, 'apple');
  assert.equal(deliver(roundTrip(legacyService), 'apple').hearts, legacyService.hearts, 'legacy delivery stays limited to one item');
  const oldSlope = normalizeAdventureState({ schemaVersion: 1, active: { ...oldActive, choices: ['entrance', 'slope'] } });
  assert.equal(oldSlope.active!.bag.orange, 1);
  assert.equal(getAdventureRewardPreview({ ...fresh(), adventure: oldSlope }).coins, 16);

  let capped = start({ ...fresh(), inventory: { trail_rope: inventoryItemLimit, berry_bait: inventoryItemLimit } }, { berry_bait: 1 });
  for (const id of ['trail_rope', 'berry_bait']) {
    assert.equal(getItemPurchaseQuote(capped, id, 1, now).reason, 'inventory_full');
    assert.deepEqual(buyItem(capped, id, now).inventory, capped.inventory);
  }
  for (const id of ['entrance', 'bank', 'detour', 'rope']) capped = richStep(capped, id);
  assert.equal(buy(capped, 'berry_bait'), capped);
  const cappedClaim = finish(capped);
  assert.equal(cappedClaim.inventory.trail_rope, inventoryItemLimit);
  assert.equal(cappedClaim.inventory.berry_bait, inventoryItemLimit);
  assert.equal(cappedClaim.adventure.pending, undefined);
  assert.equal(selectNeighborGift([{ itemId: 'trail_rope', displayName: 'rope', price: 120 }, { itemId: 'berry_bait', displayName: 'bait', price: 12 }], () => .5).itemId, 'emergency_biscuit');
  const completed = richStep(richStep(serviceTrip(), 'clearing'), 'overlook');
  assert.equal(getAdventureRewardPreview(completed).coins, 0, 'coins are held in physical treasure');
  const rewardId = completed.adventure.active!.treasure!;
  assert.equal(completed.adventure.active!.bag[rewardId], 1);
  assert.equal(adventureTreasureIds.reduce((sum, id) => sum + (completed.adventure.active!.bag[id] ?? 0), 0), 1);
  const returned = returnFromAdventure(completed, completed.adventure.active!.id, now);
  assert.equal(returnFromAdventure(returned, completed.adventure.active!.id, now), returned);
  assert.equal(returned.coins, completed.coins);
  assert.equal(start(returned).adventure.active, undefined);
  const resultId = returned.adventure.pending!.id;
  const collected = claimAdventureResult(roundTrip(returned), resultId);
  assert.equal(collected.coins, returned.coins); assert.equal(collected.hearts, returned.hearts + 22);
  assert.equal(collected.inventory[rewardId], 1);
  const exchanged = useInventoryItem(collected, rewardId, now);
  assert.equal(exchanged.coins, collected.coins + getAdventureTreasureValue(rewardId));
  assert.equal(exchanged.inventory[rewardId], undefined);
  assert.equal(useInventoryItem(exchanged, rewardId, now).coins, exchanged.coins);
  assert.equal(start(exchanged).adventure.active, undefined);
  assert.equal(collected.adventure.completed.valley, 1);
  assert.equal(collected.adventure.discoveries.length, 6);
  assert.equal(collected.adventure.journal.length, 1);
  assert.equal(claimAdventureResult(collected, resultId), collected);
  const overloaded = { ...returned, inventory: { ...returned.inventory, trail_rope: inventoryItemLimit, apple: inventoryItemLimit } };
  const partial = claimAdventureResult(overloaded, resultId);
  assert.ok(partial.adventure.pending!.rewardsClaimed);
  assert.equal(partial.adventure.pending!.items.apple, 2);
  const secondClaim = claimAdventureResult(roundTrip(partial), resultId);
  assert.equal(secondClaim.hearts, partial.hearts); assert.equal(secondClaim.coins, partial.coins);
  assert.equal(secondClaim.adventure.journal.length, 1);
  const finalClaim = claimAdventureResult({ ...secondClaim, inventory: { ...secondClaim.inventory, trail_rope: 0, apple: 0 } }, resultId);
  assert.equal(finalClaim.inventory.apple, 2); assert.equal(finalClaim.adventure.pending, undefined);
  assert.equal(finalClaim.hearts, partial.hearts);
  const emptyClaim = finish(start(fresh(), {}, false));
  assert.equal(emptyClaim.coins, fresh().coins); assert.equal(emptyClaim.hearts, fresh().hearts);
  const early = finish(step(start(fresh(), {}, false)));
  assert.equal(early.hearts, fresh().hearts); assert.equal(early.coins, fresh().coins);
  assert.equal(early.adventure.completed.valley, undefined);

  const mealCost = getRecipeMaterialCost(getRecipe('carrot_rice')!, false, id => getInventoryItem(id)!.price);
  assert.equal(mealCost, 32);
  const results: { level: number; route: string; meals: number; profit: number; hunger: number; energy: number }[] = [];
  for (const level of [1, 12, 99]) for (const branch of ['bank', 'slope']) for (const encounter of ['lure', 'apple', 'detour']) for (const crossing of ['rope', 'ford']) {
    const initial = fresh(level);
    let state = start(initial, { dish_carrot_rice: 5, energy_drink: 2, ...(encounter === 'lure' ? { berry_bait: 1 } : {}), ...(encounter === 'apple' && branch === 'slope' ? { apple: 1 } : {}) });
    let meals = 0, drinks = 0, hunger = 0, energy = 0;
    const choices = ['entrance', branch, encounter, crossing, 'clearing', 'overlook'];
    for (const [i, id] of choices.entries()) {
      const choice = getAdventureSteps()[i].choices.find(value => value.id === id)!;
      while (state.hunger < choice.hunger) {
        const stock = state.adventure.active!.bag;
        const appleReserve = encounter === 'apple' && i <= 2 ? 1 : 0;
        const food = (stock.apple ?? 0) > appleReserve ? 'apple' : (stock.orange ?? 0) > 0 ? 'orange' : 'dish_carrot_rice';
        const next = eat(state, food);
        assert.notEqual(next.adventure.active!.revision, state.adventure.active!.revision, 'route has sufficient food');
        state = next; if (food === 'dish_carrot_rice') meals++;
      }
      while (state.energy < choice.energy) { state = eat(state, 'energy_drink'); drinks++; assert.ok(drinks <= 2); }
      const before = state;
      state = step(state, id);
      assert.equal(state.hunger, before.hunger - choice.hunger); assert.equal(state.energy, before.energy - choice.energy);
      assert.equal(state.adventure.active!.choices.length, i + 1);
      state = roundTrip(state);
      hunger += choice.hunger; energy += choice.energy;
    }
    assert.equal(getAdventureRewardPreview(state).hearts, Math.round(22 * getPetStatCap(level) / 100));
    const receipt = state.adventure.active!;
    assert.equal(receipt.bag[receipt.treasure!], 1);
    state = redeemAdventureTreasure(state, receipt.id, receipt.revision, 1, 'bag', receipt.treasure!);
    assert.equal(redeemAdventureTreasure(state, receipt.id, receipt.revision, 1, 'bag', receipt.treasure!), state, 'stale treasure exchange cannot pay twice');
    assert.equal(state.coins, initial.coins + getAdventureTreasureValue(receipt.treasure!), 'all twelve routes pay the treasure saved for their trip');
    const remaining = { ...state.adventure.active!.bag };
    state = finish(state);
    assert.equal(state.inventory.apple, initial.inventory.apple - (encounter === 'apple' && branch === 'slope' ? 1 : 0) + (remaining.apple ?? 0));
    let refillMeals = 0, refillDrinks = 0;
    // Value the complete loop: consume leftover found fruit, then restore both states at home.
    for (const id of ['apple', 'orange'] as const) for (let n = 0; n < (remaining[id] ?? 0) && state.hunger < getPetStatCap(level); n++) state = useInventoryItem(state, id, now);
    while (state.hunger < getPetStatCap(level)) { state = useInventoryItem(state, 'dish_carrot_rice', now); refillMeals++; assert.ok(refillMeals < 12); }
    while (state.energy < getPetStatCap(level)) { state = useInventoryItem(state, 'energy_drink', now); refillDrinks++; assert.ok(refillDrinks < 12); }
    const suppliesCost = (meals + refillMeals) * mealCost + (drinks + refillDrinks) * getInventoryItem('energy_drink')!.price + (encounter === 'lure' ? 12 : encounter === 'apple' && branch === 'slope' ? 18 : 0);
    results.push({ level, route: [branch, encounter, crossing].join('/'), meals, profit: state.coins - initial.coins - suppliesCost, hunger, energy });
  }
  const entry = results.filter(row => row.level === 1);
  assert.deepEqual([Math.min(...entry.map(row => row.hunger)), Math.max(...entry.map(row => row.hunger))], [300, 345]);
  assert.deepEqual([Math.min(...entry.map(row => row.energy)), Math.max(...entry.map(row => row.energy))], [74, 98]);
  assert.ok(entry.every(row => row.meals >= 3 && row.meals <= 5), JSON.stringify(entry));
  assert.ok(entry.every(row => row.profit > 0), JSON.stringify(entry));
  assert.ok(results.filter(row => row.level === 99).every(row => row.meals === 0), 'growth makes entrance scouting easier');
  const golden = { ...start(fresh(99), { golden_apple: 2 }), hunger: 4, energy: 4 };
  assert.equal(eat(golden, 'golden_apple', 2), golden);
  const goldRestored = eat(golden, 'golden_apple');
  assert.equal(goldRestored.hunger, 4 + getPetStatCap(99) / 2);
  assert.equal(goldRestored.energy, Math.round(4 + getPetEnergyCap(golden) / 2));
  for (const id of ['trail_mix', 'berry_bait']) assert.ok(getAdventureServiceQuote(serviceTrip(), id, 1, 'buy').unitPrice > getInventoryItem(id)!.price);
  const activeV2 = { ...serviceTrip(), adventure: { ...serviceTrip().adventure, active: { ...serviceTrip().adventure.active!, rulesVersion: 2 as const } } };
  assert.equal(getAdventureServiceQuote(roundTrip(activeV2), 'dish_egg_rice', 1, 'buy').unitPrice, 36);
  const activeV5 = { ...serviceTrip(), adventure: { ...serviceTrip().adventure, active: { ...serviceTrip().adventure.active!, rulesVersion: 5 as const } } };
  assert.equal(getAdventureServiceQuote(roundTrip(activeV5), 'dish_egg_rice', 1, 'buy').unitPrice, 54, 'existing trips preserve the quoted price');
  assert.equal(getAdventureServiceQuote(roundTrip(activeV5), 'trail_mix', 1, 'buy').unitPrice, 48);
  const completedV2 = richStep(richStep(activeV2, 'clearing'), 'overlook');
  assert.equal(getAdventureRewardPreview(completedV2).coins, 360);
  assert.equal(completedV2.adventure.active!.bag.coin_hoard, undefined, 'old trips keep their original reward form');
  assert.equal(finish(completedV2).coins, completedV2.coins + 360);
  for (const region of ['valley', 'windmill', 'forest', 'coast', 'observatory'] as const) {
    const done = { ...fresh(), adventure: { ...fresh().adventure, completed: { [region]: 1 }, lastCompletedDay: { [region]: getDailyResetDateKey(now) } } };
    assert.ok(getAdventureStartReason(done, region, now));
    assert.equal(startAdventure(done, region, 'official.furo', 'Furo', {}, false, now).adventure.active, undefined);
  }
  const fullFinal = richStep({ ...richStep(serviceTrip(), 'clearing'), adventure: { ...serviceTrip().adventure, active: { ...serviceTrip().adventure.active!, choices: ['entrance', 'bank', 'lure', 'rope', 'clearing'], bag: { trail_mix: 12 } } } }, 'overlook');
  assert.deepEqual(fullFinal.adventure.active!.loot, { [fullFinal.adventure.active!.treasure!]: 1 });
  assert.deepEqual(roundTrip(fullFinal).adventure.active, fullFinal.adventure.active);
  const treasureTrip = fullFinal.adventure.active!;
  const groundExchange = redeemAdventureTreasure(fullFinal, treasureTrip.id, treasureTrip.revision, 1, 'loot', treasureTrip.treasure!);
  assert.equal(groundExchange.coins, fullFinal.coins + getAdventureTreasureValue(treasureTrip.treasure!));
  assert.deepEqual(groundExchange.adventure.active!.loot, {});
  const groundClaim = finish(groundExchange);
  assert.equal(groundClaim.coins, groundExchange.coins);
  assert.equal(groundClaim.inventory[treasureTrip.treasure!], undefined);

  // Each treasure survives every inventory path, with no re-roll or duplicate payment.
  for (const treasure of adventureTreasureIds) {
    const base = serviceTrip();
    const seeded = { ...base, adventure: { ...base.adventure, active: { ...base.adventure.active!, treasure } } };
    const finished = richStep(richStep(roundTrip(seeded), 'clearing'), 'overlook');
    assert.equal(finished.adventure.active!.bag[treasure], 1);
    assert.equal(advanceAdventure(finished, finished.adventure.active!.id, 6, 'overlook', now), finished, 'the completion event cannot grant another treasure');
    const carried = roundTrip(finished);
    const exchanged = redeemAdventureTreasure(carried, carried.adventure.active!.id, carried.adventure.active!.revision, 1, 'bag', treasure);
    assert.equal(exchanged.coins, carried.coins + getAdventureTreasureValue(treasure));
    assert.equal(finish(exchanged).inventory[treasure], undefined, 'exchanged treasure never reappears at return');
    const atHome = finish(carried);
    const redeemed = useInventoryItem(atHome, treasure, now);
    assert.equal(redeemed.coins, atHome.coins + getAdventureTreasureValue(treasure));
    assert.equal(useInventoryItem(redeemed, treasure, now).coins, redeemed.coins);
    assert.deepEqual(start({ ...fresh(), inventory: { [treasure]: 1 } }, { [treasure]: 1 }, false).adventure.active, undefined, 'treasure is not an initial supply');
    const onGround = richStep({ ...seeded, adventure: { ...seeded.adventure, active: { ...seeded.adventure.active!, choices: ['entrance', 'bank', 'lure', 'rope', 'clearing'], bag: { trail_mix: 12 } } } }, 'overlook');
    const ground = roundTrip(onGround);
    assert.deepEqual(ground.adventure.active!.loot, { [treasure]: 1 });
    const leaveBehind = discard(ground, treasure, 1, 'loot');
    assert.equal(finish(leaveBehind).inventory[treasure], undefined, 'discarded treasure stays discarded');
    const converted = redeemAdventureTreasure(ground, ground.adventure.active!.id, ground.adventure.active!.revision, 1, 'loot', treasure);
    assert.equal(converted.coins, ground.coins + getAdventureTreasureValue(treasure));
    assert.equal(redeemAdventureTreasure(converted, ground.adventure.active!.id, ground.adventure.active!.revision, 1, 'loot', treasure), converted);
    const overflow = returnFromAdventure({ ...carried, inventory: { ...carried.inventory, [treasure]: inventoryItemLimit } }, carried.adventure.active!.id, now);
    const waiting = claimAdventureResult(overflow, overflow.adventure.pending!.id);
    assert.equal(waiting.adventure.pending!.items[treasure], 1);
    const cleared = useInventoryItem(waiting, treasure, now);
    const claimed = claimAdventureResult(roundTrip(cleared), waiting.adventure.pending!.id);
    assert.equal(claimed.inventory[treasure], inventoryItemLimit);
    assert.equal(claimed.hearts, waiting.hearts, 'partial claims never duplicate hearts');
  }
  const oldV3 = { ...serviceTrip(), adventure: { ...serviceTrip().adventure, active: { ...serviceTrip().adventure.active!, rulesVersion: 3 as const } } };
  const oldV3Done = richStep(richStep(roundTrip(oldV3), 'clearing'), 'overlook');
  assert.equal(oldV3Done.adventure.active!.bag.coin_hoard, 1, 'existing v3 trips retain the fixed coin hoard');
  assert.equal(oldV3Done.adventure.active!.bag.valley_amber, undefined);
  assert.equal(getAdventureRewardPreview(oldV3Done).coins, 0);

  // Daily completion is recorded at the last step, independent of return/claim time.
  const tomorrowBeforeReset = new Date(2026, 8, 18, 4, 59, 59).getTime();
  const tomorrowAfterReset = new Date(2026, 8, 18, 5).getTime();
  const recovered = { ...collected, hunger: 100, energy: 100 };
  assert.equal(startAdventure(recovered, 'valley', 'official.furo', 'Furo', {}, false, tomorrowBeforeReset).adventure.active, undefined);
  const repeated = startAdventure(recovered, 'valley', 'official.furo', 'Furo', { berry_bait: 1 }, true, tomorrowAfterReset);
  assert.ok(repeated.adventure.active);
  let repeatDone = repeated;
  for (const id of ['entrance', 'bank', 'lure', 'rope', 'clearing', 'overlook']) repeatDone = advanceAdventure({ ...repeatDone, hunger: 100, energy: 100 }, repeatDone.adventure.active!.id, repeatDone.adventure.active!.choices.length, id, tomorrowAfterReset);
  assert.equal(repeatDone.adventure.active!.bag[repeatDone.adventure.active!.treasure!], 1);
  assert.equal(getAdventureRewardPreview(repeatDone).hearts, 22);
  assert.equal(getAdventureRewardPreview(repeatDone).first, false);
  const repeatReturned = returnFromAdventure(repeatDone, repeatDone.adventure.active!.id, tomorrowAfterReset);
  const repeatClaimed = claimAdventureResult(repeatReturned, repeatReturned.adventure.pending!.id);
  assert.equal(repeatClaimed.adventure.completed.valley, 2);
  assert.equal(startAdventure({ ...repeatClaimed, hunger: 100, energy: 100 }, 'valley', 'official.furo', 'Furo', {}, false, tomorrowAfterReset).adventure.active, undefined);
  const delayedReturn = returnFromAdventure(completed, completed.adventure.active!.id, tomorrowAfterReset);
  const delayedClaim = claimAdventureResult(delayedReturn, delayedReturn.adventure.pending!.id);
  assert.equal(delayedClaim.adventure.lastCompletedDay.valley, getDailyResetDateKey(now));
  assert.ok(startAdventure({ ...delayedClaim, hunger: 100, energy: 100 }, 'valley', 'official.furo', 'Furo', {}, false, tomorrowAfterReset).adventure.active);
  const oldDailyState = normalizeAdventureState({ ...collected.adventure, lastCompletedDay: undefined });
  assert.equal(oldDailyState.lastCompletedDay.valley, getDailyResetDateKey(now), 'old journals restore the last completion day');
  assert.equal(normalizeAdventureState({ ...oldDailyState, journal: [] }).lastCompletedDay.valley, oldDailyState.lastCompletedDay.valley, 'daily limit survives journal truncation');
  console.log('Adventure checks passed: 36 routes/levels, daily scouting, three random treasures, atomic exchange, overflow, reset boundaries and legacy migrations.');
} finally { Math.random = originalRandom; }

// Fake time verifies anti-repeat timing, nested dialog callbacks and cancellation without waiting.
{
  let time = 0;
  let sequence = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const phases: AdventureActionState[] = [];
  const gate = createAdventureActionGate(state => phases.push(state), {
    schedule: (callback, delay) => { const id = ++sequence; tasks.set(id, { at: time + delay, callback }); return id; },
    cancel: handle => { tasks.delete(handle as number); },
  });
  const tick = (next: number) => { time = next; for (const [id, task] of [...tasks].sort((a, b) => a[1].at - b[1].at)) if (task.at <= time) { tasks.delete(id); task.callback(); } };
  let commits = 0;
  assert.ok(gate.run(() => { commits++; gate.run(() => { commits++; }); }, 'walk'));
  assert.equal(gate.run(() => { commits += 100; }), false);
  tick(adventureActionCommitMs - 1); assert.equal(commits, 0);
  tick(adventureActionCommitMs); assert.equal(commits, 2, 'nested callbacks share one animation and commit');
  tick(adventureActionDurationMs - 1); assert.equal(gate.run(() => { commits += 100; }), false);
  tick(adventureActionDurationMs); assert.equal(gate.isBusy(), false);
  assert.deepEqual(phases.map(state => state.phase), ['acting', 'settling', 'idle']);
  assert.ok(gate.run(() => { commits += 100; }));
  gate.cancel(); tick(time + 5000); assert.equal(commits, 2, 'leaving cancels the uncommitted action');
  assert.equal(tasks.size, 0);
  assert.ok(gate.run(() => { commits++; }));
  tick(time + adventureActionCommitMs); gate.cancel(); tick(time + 5000);
  assert.equal(commits, 3, 'cancellation after commit never duplicates or reverses it');
  assert.ok(gate.run(() => { commits++; }, 'pack', false));
  assert.ok(gate.run(() => { commits++; }, 'sway', false));
  assert.equal(commits, 5, 'hall and map operations commit immediately, including consecutive clicks');
  assert.equal(gate.isBusy(), false);
  assert.equal(tasks.size, 0, 'immediate operations create no animation timers');
  assert.ok(gate.run(() => { commits += 100; }));
  assert.ok(gate.run(() => { commits++; }, 'sway', false));
  tick(time + 5000);
  assert.equal(commits, 6, 'leaving animation mode clears a queued action before an immediate operation');
  assert.equal(phases.at(-1)?.phase, 'idle');
  console.log('Adventure action gate passed: immediate hall/map actions, 700 ms exploration lead-in, 1050 ms lock, repeated clicks, nested callbacks and cleanup.');
}

// Actual React components, without browser automation, images or player storage.
const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const [page, storage, items, assets, locale] = await Promise.all([
    server.ssrLoadModule('/src/ui/AdventurePage.tsx'), server.ssrLoadModule('/src/ui/AdventureStorage.tsx'), server.ssrLoadModule('/src/core/items.ts'), server.ssrLoadModule('/src/assets.ts'), server.ssrLoadModule('/src/i18n/index.ts'),
  ]);
  const [map, mapData, scenes] = await Promise.all([
    server.ssrLoadModule('/src/ui/AdventureMap.tsx'), server.ssrLoadModule('/src/core/adventureMap.ts'), server.ssrLoadModule('/src/ui/adventureScenes.ts'),
  ]);
  const noop = () => {};
  for (const language of ['zh-CN', 'en-US']) {
    locale.setLanguage(language);
    const english = language === 'en-US';
    const shared = { registry: items.createItemRegistry(), icons: assets.itemIcons, update: noop, onBack: noop, onKitchen: noop, onBuy: noop, onUseHomeItem: noop };
    const render = (pet: PetState, actorId = 'official.furo') => renderToStaticMarkup(createElement(page.AdventurePage, { ...shared, pet, actorId, actorName: 'Furo', portrait: assets.petStatusImages.content }));
    const hall = render(fresh());
    assert.ok(hall.includes(english ? 'Outpost hall' : '基地大厅'));
    assert.equal((hall.match(/class="adventure-actor adventure-neighbor /g) ?? []).length, 2);
    assert.equal((render(fresh(), 'custom.pet').match(/class="adventure-actor adventure-neighbor /g) ?? []).length, 3);
    assert.ok(hall.includes('outpost-hall.webp'));
    assert.equal((hall.match(/role="meter"/g) ?? []).length, 5, 'hunger, energy, mood, health and bag have visible meters');
    assert.ok(!hall.includes('adventure-action-status'), 'the hall has no action waiting indicator');
    assert.ok(hall.includes(english ? 'Choose a destination first' : '请先选择目的地'));
    assert.ok(!hall.includes('<progress'), 'entering the hall does not preselect a trip');
    const beginnerHall = render(beginner());
    assert.ok(beginnerHall.includes(english ? 'Choose tutorial · Prepare' : '选择踩点探索 · 整备'));
    assert.ok(beginnerHall.includes(english ? 'World map locked' : '总地图未解锁'));
    assert.ok(beginnerHall.includes(english ? 'map handbook' : '地图手册'));
    const mapButton = beginnerHall.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes('lucide-lock-keyhole'));
    assert.ok(mapButton?.includes('disabled=""'), 'the map cannot be opened before tutorial completion');
    const tutorialPage = render(step(tutorial()));
    assert.ok(tutorialPage.includes('value="1" max="4"'));
    assert.ok(tutorialPage.includes(english ? 'First scouting trip' : '踩点探索'));
    const toolbar = hall.split('<nav class="adventure-toolbar"')[1].split('</nav>')[0];
    assert.ok(toolbar.includes(english ? 'Pack for the trip' : '出发整备'));
    assert.ok(!toolbar.includes(english ? '>Inventory<' : '>仓库<'), 'the hall has one combined preparation entry');
    assert.ok(!hall.includes('adventure-sidebar') && !hall.includes('adventure-regions'), 'long lists are not below the scene');
    const route = serviceTrip();
    const clearing = render(route);
    assert.ok(clearing.includes('valley.webp') && clearing.includes('adventure-neighbor--encounter'));
    assert.ok(clearing.includes(english ? 'Request delivery' : '请伙伴运输'));
    assert.ok(clearing.includes('value="4" max="6"'), 'progress counts completed steps');
    const poor = render({ ...route, hunger: 0, energy: 0 });
    assert.equal((poor.match(/aria-valuenow="0"/g) ?? []).length, 2, 'empty hunger and energy meters remain at zero');
    const grown = fresh(99);
    assert.ok(render(grown).includes(`aria-valuemax="${getPetStatCap(grown)}"`), 'meters follow the companion level cap');
    assert.ok(poor.includes(english ? 'Not enough hunger or energy' : '体力或饱食度不足'));
    assert.ok(poor.includes(english ? 'Return free' : '免费返程'));
    const returned = returnFromAdventure(route, route.adventure.active!.id, now);
    const result = render(returned);
    assert.ok(result.includes(english ? 'Finds and returned supplies' : '收获与归还物资'));
    assert.ok(result.indexOf('adventure-hud') < result.indexOf('adventure-stage') && result.indexOf('adventure-stage') < result.indexOf('adventure-modal-backdrop'));
    const pendingLoot = ['entrance', 'bank'].reduce(richStep, start(fresh(), { trail_mix: 12 }));
    assert.ok(render(pendingLoot).includes('storage-item-grid'));
    for (const panel of ['bag', 'shop', 'delivery', 'pack', 'loot', 'supplies']) {
      const pet = panel === 'loot' ? pendingLoot : panel === 'shop' || panel === 'bag' || panel === 'delivery' ? route : fresh();
      const html = renderToStaticMarkup(createElement(storage.AdventureStorage, { ...shared, pet, panel, bag: {}, tool: false, onPack: noop, onTool: noop, onDepart: noop, onPanel: noop, onClose: noop }));
      assert.ok(html.includes('storage-item-grid') && html.includes('adventure-modal-backdrop'));
      assert.ok(!/src="undefined"|NaN|\[object Object\]/.test(html));
      if (panel === 'shop') {
        assert.ok(html.includes('data-item-id="dish_egg_rice"'));
        assert.ok(html.includes(english ? '30 coins' : '30 金币'));
        assert.ok(html.includes(english ? 'Stock 2' : '剩余 2'));
      }
      if (panel === 'bag') {
        assert.ok(html.includes('data-item-id="apple"'));
        assert.ok(!html.includes('data-item-id="dish_carrot_rice"'), 'home food is not shown in travel bag');
      }
      if (panel === 'pack') {
        assert.ok(html.includes('adventure-pack-columns') && html.includes('adventure-pack-pane--bag'));
        assert.ok(html.includes(english ? 'Unpacked home supplies' : '仓库未装入物资'));
        assert.ok(html.includes(english ? 'Packed travel bag' : '本次携带的背包'));
        const departButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes('lucide-compass'));
        assert.ok(departButton?.includes('disabled=""'), 'packing cannot depart without a selected destination');
      }
    }
    const packedHtml = renderToStaticMarkup(createElement(storage.AdventureStorage, { ...shared, pet: fresh(), panel: 'pack', bag: { dish_carrot_rice: 2 }, tool: true, onPack: noop, onTool: noop, onDepart: noop, onPanel: noop, onClose: noop }));
    assert.equal((packedHtml.match(/data-item-id="dish_carrot_rice"/g) ?? []).length, 2, 'same item is visible on both sides');
    assert.ok(packedHtml.includes('×18') && packedHtml.includes('×2'), 'draft transfers subtract warehouse display and add bag display');
    const changedInventory = renderToStaticMarkup(createElement(storage.AdventureStorage, { ...shared, pet: { ...fresh(), inventory: {} }, panel: 'pack', bag: { dish_carrot_rice: 2 }, tool: true, onPack: noop, onTool: noop, onDepart: noop, onPanel: noop, onClose: noop }));
    assert.equal((changedInventory.match(/data-item-id="dish_carrot_rice"/g) ?? []).length, 2, 'outdated packing selections remain available to remove');
    assert.ok(hall.includes(english ? 'Landscape' : '横屏查看') && hall.includes(english ? 'Panorama' : '看全景'));
    const today = getEffectiveDailyDateKey(fresh());
    const doneHall = render({ ...fresh(), adventure: { ...fresh().adventure, completed: { tutorial: 1, valley: 1 }, lastCompletedDay: { valley: today } } });
    assert.ok(doneHall.includes(english ? 'Today’s valley scouting is complete' : '今天的溪谷入口探查已完成'));
    assert.ok(doneHall.includes(english ? 'Pack for the trip' : '出发整备'), 'preparation stays available after finishing today');
    const renderMap = (state: PetState, region?: string, node?: string) => renderToStaticMarkup(createElement(map.AdventureMap, {
      adventure: state.adventure, today, selection: region ? { region, node } : undefined, portrait: assets.petStatusImages.content, landscape: false,
      onToggleLandscape: noop, onSelect: noop, onPrepare: noop, onResume: noop, onCollect: noop, onClose: noop,
    }));
    for (const html of [renderMap(fresh()), renderMap(fresh(), 'valley'), renderMap(fresh(), 'coast')]) {
      assert.ok(html.includes(english ? 'No destination selected' : '尚未选择目的地'));
      assert.ok(!/class="adventure-map-node"[^>]*aria-pressed="true"/.test(html), 'opening the map or selecting a region does not select a destination');
      const departButton = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes(english ? 'Choose a destination first' : '先选择目的地'));
      assert.ok(departButton?.includes('disabled=""'));
    }
    assert.equal(mapData.getAdventureNodeStatus(beginner().adventure, 'valley', 'entrance', today), 'locked');
    const newMap = renderMap(fresh(), 'valley', 'entrance');
    assert.equal((newMap.match(/class="adventure-map-node"/g) ?? []).length, 8);
    assert.ok(newMap.includes(english ? 'Enter landmark · Pack to leave' : '进入节点 · 整备出发'));
    assert.ok(newMap.includes('adventure-map-scene-preview') && newMap.includes('valley.webp'));
    const futureNode = renderMap(fresh(), 'valley', 'story');
    assert.ok(futureNode.includes('先完成前置故事'));
    assert.ok(futureNode.includes('data:image/svg+xml') && !futureNode.includes('valley.webp'), 'story nodes have distinct SVG scenery');
    assert.ok(!futureNode.includes(english ? 'Enter landmark · Pack to leave' : '进入节点 · 整备出发'));
    assert.ok(renderMap(route).includes(english ? 'Resume current scouting' : '继续当前探查'));
    assert.ok(renderMap(returned, 'observatory').includes(english ? 'Collect your previous bag' : '先领取上次行囊'));
    const completedState = { ...fresh(), adventure: { ...fresh().adventure, completed: { tutorial: 1, valley: 1 }, lastCompletedDay: { valley: today }, discoveries: Array.from({ length: 6 }, (_, i) => `valley:${i}`) } };
    const completedMap = renderMap(completedState, 'valley', 'entrance');
    assert.ok(!completedMap.includes(english ? 'Enter landmark · Pack to leave' : '进入节点 · 整备出发'));
    assert.equal(mapData.getAdventureNodeStatus(completedState.adventure, 'valley', 'entrance', today), 'complete');
    assert.equal(mapData.getAdventureNodeStatus({ ...completedState.adventure, lastCompletedDay: { valley: '2026-09-16' } }, 'valley', 'entrance', '2026-09-17'), 'available');
    const treasurePack = renderToStaticMarkup(createElement(storage.AdventureStorage, { ...shared, pet: { ...fresh(), inventory: { valley_amber: 1, ancient_gold_bar: 1, dish_carrot_rice: 2 } }, panel: 'pack', bag: { dish_carrot_rice: 1 }, tool: false, onPack: noop, onTool: noop, onDepart: noop, onPanel: noop, onClose: noop }));
    assert.ok(treasurePack.includes('data-item-id="valley_amber"') && treasurePack.includes('data-item-id="ancient_gold_bar"'), 'treasure is visible in the combined warehouse');
    assert.equal(mapData.getAdventureNodeStatus(route.adventure, 'valley', 'entrance'), 'current');
    assert.equal(mapData.getAdventureNodeStatus(returned.adventure, 'valley', 'entrance'), 'pending');
    for (const region of ['valley', 'windmill', 'forest', 'coast', 'observatory']) {
      for (const node of mapData.adventureMapNodes) if (node.id !== 'entrance') assert.equal(mapData.getAdventureNodeStatus(completedState.adventure, region, node.id), region === 'valley' ? ['gather', 'ridge'].includes(node.id) ? 'available' : 'locked' : 'planned', 'the valley starts with two branches; later stories require their own progress');
      const overview = renderMap(fresh(), region, 'entrance');
      assert.ok(overview.includes('data-region="' + region + '"'));
      assert.ok(!/src="undefined"|NaN|\[object Object\]/.test(overview));
      if (region !== 'valley') assert.ok(!overview.includes(english ? 'Enter landmark · Pack to leave' : '进入节点 · 整备出发'));
    }
    // Replacing overview art leaves task art and clickable markers independent.
    scenes.adventureRegionArt.valley.overview = '/test-valley-overview.webp';
    try {
      const illustratedMap = renderMap(fresh(), 'valley', 'entrance');
      assert.ok(illustratedMap.includes('/test-valley-overview.webp') && illustratedMap.includes('valley.webp'));
      assert.equal((illustratedMap.match(/class="adventure-map-node"/g) ?? []).length, 8);
    } finally { delete scenes.adventureRegionArt.valley.overview; }
  }
  console.log('Adventure React checks passed: paired packing, stock/prices, five region maps, planned/current/pending/completed nodes, separate scene art, landscape, HUD and both languages. Visual acceptance remains manual.');
} finally { await server.close(); }
