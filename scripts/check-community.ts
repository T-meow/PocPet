import assert from 'node:assert/strict';
import { advanceAdventure, claimAdventureResult, getAdventureChoiceReason, getAdventureStartReason, returnFromAdventure, useAdventureSupply } from '../src/core/adventure';
import { startAdventure } from './fixtures/legacy-exploration';
import { chooseAdventureReturnItems, enforceAdventureHealth } from '../src/core/adventureReturn';
import { getAdventureBagCount, getAdventureItemPurchaseCapacity, isAdventureSupply } from '../src/core/adventureState';
import { getAdventureSteps } from '../src/core/adventureData';
import { acceptCommunityCommission, cancelCommunityCommission, claimCommunityCommission, deliverCommunityOrder, getCommunityCommissionId, harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { advancePet } from '../src/core/petLifecycle';
import { getPetEnergyCap, getPetStatCap, getPetStatScale } from '../src/core/petStats';
import { getInventoryItem, getShopItem } from '../src/core/items';
import { getItemRecoveryPreview } from '../src/core/itemEffects';
import { buyItem, useInventoryItem } from '../src/core/petActions';
import { canCraftRecipe, craftRecipe } from '../src/core/kitchen';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import type { PetState } from '../src/core/petTypes';
import { createCommunityTestPet } from './fixtures/community-pet';

const T = new Date(2026, 8, 18, 10).getTime(), H = 3600000;
const fresh = () => createCommunityTestPet('community', T);
const roundTrip = (pet: PetState, at = T) => parseSaveFileText(createSaveFileText(pet, null, at), at).pet;
const start = (pet: PetState, at = T) => startAdventure(pet, 'valley', 'official.furo', 'Furo', {}, true, at, 'seeds');
const node = (pet: PetState, choice: string, at = T) => {
  const trip = pet.adventure.active!;
  return advanceAdventure(pet, trip.id, trip.choices.length, choice, at);
};
const completeShort = (pet: PetState, at = T) => node(node(node(start({ ...pet, hunger: getPetStatCap(pet), energy: getPetEnergyCap(pet) }, at), 'search_path', at), 'search_bank', at), 'search_find', at);
const collect = (pet: PetState, at = T) => {
  const back = returnFromAdventure(pet, pet.adventure.active!.id, at);
  return claimAdventureResult(back, back.adventure.pending!.id);
};

// Full production chain: the exact modules bundled into the HTML and used by App.
let pet = fresh();
const id = getCommunityCommissionId(pet, T);
pet = acceptCommunityCommission(pet, id, T);
assert.equal(acceptCommunityCommission(pet, id, T), pet);
pet = roundTrip(completeShort(pet));
assert(pet.community.irrigationFound && pet.community.herbDiscovered && pet.community.commission?.found);
assert.equal(pet.adventure.active?.bag.creek_herb_seed, 2);
pet = collect(pet);
assert.equal(pet.adventure.completed.valley, undefined);
assert.equal(pet.adventure.lastCompletedDay.valley, undefined);
assert.equal(pet.inventory.creek_herb_seed, 2);
const coins = pet.coins;
pet = claimCommunityCommission(pet, id);
assert.equal(pet.coins, coins + 40);
assert.equal(claimCommunityCommission(pet, id), pet);
assert.equal(acceptCommunityCommission(pet, id, T), pet);
assert(pet.community.gardenBuilt);
assert.equal(getPetEnergyCap(pet), 107);
assert.equal(getPetStatScale(pet), 1);
pet = plantCommunityCrop(pet, 1, 'herb', T);
assert.equal(pet.inventory.creek_herb_seed, 1);
assert.equal(harvestCommunityCrop(pet, 1, T, T + H), pet);
pet = roundTrip(pet, T + 6 * H);
pet = harvestCommunityCrop(pet, 1, T, T + 6 * H);
assert.equal(pet.inventory.creek_herb, 4);
assert.equal(harvestCommunityCrop(pet, 1, T, T + 6 * H), pet);
assert.equal(pet.inventory.creek_herb, 4); assert.equal(pet.inventory.creek_herb_seed, 1);
assert(canCraftRecipe(pet, 'herb_porridge', false, 1));
pet = craftRecipe(pet, 'herb_porridge', false, 1, 'community-cook-one', T + 6 * H);
assert.equal(craftRecipe(pet, 'herb_porridge', false, 1, 'community-cook-one', T + 6 * H), pet);
pet = deliverCommunityOrder(pet);
assert(pet.community.firstOrderDelivered);
assert.equal(pet.inventory.dish_herb_porridge ?? 0, 0);
assert.equal(getPetEnergyCap(pet), 110); // tutorial +3, garden +4, order +3
assert.equal(deliverCommunityOrder(pet), pet);
assert.equal(JSON.stringify(roundTrip(pet, T + 6 * H).community), JSON.stringify(pet.community));
assert.equal(getShopItem('creek_herb_seed'), undefined);
assert.equal(getShopItem('creek_herb'), undefined);
assert(!canCraftRecipe({ ...fresh(), inventory: { creek_herb: 1, rice: 1 } }, 'herb_porridge', false, 1));

// Seed exhausted: discoveries survive disposal, with a guaranteed daily recovery.
let lost = collect(completeShort(fresh()));
lost.inventory = {};
lost = collect(completeShort({ ...lost, inventory: { trail_rope: 1 } }));
assert.equal(lost.inventory.creek_herb_seed, undefined);
lost = collect(completeShort({ ...lost, inventory: { trail_rope: 1 } }, T + 24 * H), T + 24 * H);
assert.equal(lost.inventory.creek_herb_seed, 2);

// Accepted quests outlive 5 a.m.; prior exploration/stock does not complete a new one.
let quest = acceptCommunityCommission(fresh(), id, T);
quest = roundTrip(quest, T + 24 * H);
assert.equal(quest.community.commission?.id, id);
quest = collect(completeShort(quest, T + 24 * H), T + 24 * H);
quest = claimCommunityCommission(quest, id);
const newId = getCommunityCommissionId(quest, T + 24 * H);
quest = acceptCommunityCommission(quest, newId, T + 24 * H);
assert.equal(quest.community.commission?.id, newId); assert.equal(quest.community.commission?.found, false);
const cancelled = cancelCommunityCommission(quest, newId);
assert.equal(acceptCommunityCommission(cancelled, newId, T + 24 * H), cancelled);
let dailyDone = fresh(); dailyDone.adventure.lastCompletedDay.valley = '2026-09-18';
assert.equal(getAdventureStartReason(dailyDone, 'valley', T), '');
assert(start(dailyDone).adventure.active);

// Strict proportional boundaries, including level 99 and growth/trophy energy caps.
for (const level of [1, 20, 99]) {
  let p = { ...fresh(), level };
  const cap = getPetStatCap(p);
  p = { ...p, hunger: cap, mood: cap, health: cap * 0.4, energy: getPetEnergyCap(p) };
  assert(start(p).adventure.active);
  assert.equal(start({ ...p, health: cap * 0.4 - 0.001 }).adventure.active, undefined);
  p = start(p); p.health = cap * 0.2;
  assert(enforceAdventureHealth(p).adventure.active);
  assert.equal(enforceAdventureHealth({ ...p, health: cap * 0.2 - 0.001 }).adventure.active, undefined);
}
let risky = node(start(fresh()), 'search_path');
risky.health = 26;
const stale = risky.adventure.active!;
risky = node(risky, 'search_shallows');
assert.equal(risky.health, 18); assert(!risky.adventure.active); assert.equal(risky.adventure.pending?.steps, 2);
assert.equal(risky.adventure.pending?.complete, false);
assert.equal(advanceAdventure(risky, stale.id, 1, 'search_shallows', T), risky);
const ill = startAdventure(fresh(), 'valley', 'official.furo', 'Furo', { field_dressing: 1 }, false, T, 'seeds');
ill.health = 19;
const forcedBeforeCure = useAdventureSupply(ill, ill.adventure.active!.id, 0, 'field_dressing');
assert(!forcedBeforeCure.adventure.active); assert.equal(forcedBeforeCure.health, 19); assert.equal(forcedBeforeCure.adventure.pending?.items.field_dressing, 1);
assert(!normalizePet(ill, T).adventure.active);

// Full bag + ground loot: one selection, then warehouse partial delivery exactly once.
let rescued = enforceAdventureHealth(createCommunityTestPet('salvage', T), T);
let receipt = rescued.adventure.pending!;
assert(receipt.salvage); assert.equal(claimAdventureResult(rescued, receipt.id), rescued);
assert.equal(getAdventureItemPurchaseCapacity({ ...rescued, inventory: { trail_rope: 9998 } }, 'trail_rope'), 0, 'a tool awaiting return selection still reserves warehouse space');
assert.equal(chooseAdventureReturnItems(rescued, receipt.id, { dish_carrot_rice: 24, creek_herb_seed: 1 }), rescued);
rescued = chooseAdventureReturnItems(rescued, receipt.id, { dish_carrot_rice: 23, creek_herb_seed: 1 });
assert.equal(chooseAdventureReturnItems(rescued, receipt.id, { dish_carrot_rice: 24 }), rescued);
assert.equal(getAdventureBagCount(rescued.adventure.pending!.items), 25); // 24 + independent tool
rescued.inventory.creek_herb_seed = 9999;
rescued = claimAdventureResult(roundTrip(rescued), receipt.id);
assert.equal(rescued.adventure.pending?.items.creek_herb_seed, 1);
const tools = rescued.inventory.trail_rope;
rescued = claimAdventureResult(rescued, receipt.id);
assert.equal(rescued.inventory.trail_rope, tools);
rescued.inventory.creek_herb_seed = 9998;
rescued = claimAdventureResult(roundTrip(rescued), receipt.id);
assert(!rescued.adventure.pending); assert.equal(rescued.inventory.creek_herb_seed, 9999);
assert.equal(claimAdventureResult(rescued, receipt.id), rescued);

// Offline crossing occurs near the first millisecond under 20%, never at resume.
let offline = start(fresh());
offline = { ...offline, hunger: 0, mood: 0, cleanliness: 0, health: 21, lastInteractionAt: T };
const resumed = advancePet(offline, T + H);
assert(!resumed.adventure.active);
assert(resumed.adventure.pending!.endedAt > T && resumed.adventure.pending!.endedAt < T + H / 2);
assert.equal(advancePet(roundTrip(resumed, T + H), T + 2 * H).adventure.pending?.id, resumed.adventure.pending?.id);
// Completion precedes later forced return: one full reward and original completion date.
let final = fresh(); final.level = 99; final.hunger = 590; final.health = 590; final.mood = 590; final.energy = getPetEnergyCap(final);
final = startAdventure(final, 'valley', 'official.furo', 'Furo', {}, true, T);
for (const choice of ['entrance', 'bank', 'detour', 'rope', 'clearing', 'overlook']) final = node(final, choice);
final = { ...final, hunger: 0, mood: 0, cleanliness: 0, health: 118 };
final = advancePet(final, T + 1000);
assert(final.adventure.pending?.complete); assert.equal(final.adventure.pending.completedDay, '2026-09-18');
const resultId = final.adventure.pending.id;
final = claimAdventureResult(final, resultId);
assert.equal(final.adventure.completed.valley, 1);
assert.equal(claimAdventureResult(roundTrip(final), resultId).adventure.completed.valley, 1);

// Full food protection and non-food supplies work together; no birthday expansion.
assert(isAdventureSupply('field_dressing') && isAdventureSupply('comfort_charm') && isAdventureSupply('medicine'));
assert(!isAdventureSupply('birthday_cake'));
let full = fresh(); full.health = 55;
const foodBefore = full.inventory.dish_carrot_rice;
full = useInventoryItem(full, 'dish_carrot_rice', T, { quantity: 99 });
assert.equal(full.inventory.dish_carrot_rice, foodBefore);
full = useInventoryItem(full, 'field_dressing', T);
assert(full.health > 55); assert.equal(full.inventory.field_dressing, 3);
assert(getItemRecoveryPreview({ ...full, mood: 20 }, getInventoryItem('comfort_charm')!, 1, []).actual.mood > 0);
const bought = buyItem(fresh(), 'carrot_seed', T);
assert.equal(bought.inventory.carrot_seed, 3);
assert.equal(getAdventureSteps(4)[1].choices[1].health, undefined); // no retroactive old-trip cost
const sad = { ...node(start(fresh()), 'search_path'), mood: 29 };
const sadChoices = getAdventureSteps(5, 'valley', 'seeds')[1].choices;
assert.equal(getAdventureChoiceReason(sad, sadChoices[0]), '');
assert(getAdventureChoiceReason(sad, sadChoices[1]));
assert.equal(node(sad, 'search_bank').adventure.active?.choices.length, 2);
let waitingCrop = createCommunityTestPet('harvest', T);
waitingCrop.inventory.creek_herb = 9998;
assert(harvestCommunityCrop(waitingCrop, 1, waitingCrop.community.plots[0].crop!.plantedAt, T).community.plots[0].crop);
const fullQuest = completeShort(acceptCommunityCommission(fresh(), id, T));
let waitingQuest = collect(fullQuest); waitingQuest.inventory.community_wood = 9999;
assert(claimCommunityCommission(waitingQuest, id).community.commission?.found);
const old = createDefaultPet(T) as unknown as Record<string, unknown>; delete old.community;
assert.equal(normalizePet(old, T).community.gardenBuilt, false);
console.log('A+B checks passed: production loop, save migration, health boundaries, offline first crossing, forced capacity settlement, daily search, seed recovery, once-only growth and feeding protection.');

const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const [{ CommunityPage }, { AdventureReturnSelection }, { createItemRegistry }] = await Promise.all([
    server.ssrLoadModule('/src/ui/CommunityPage.tsx'), server.ssrLoadModule('/src/ui/AdventureReturnSelection.tsx'), server.ssrLoadModule('/src/core/items.ts'),
  ]);
  const noop = () => {};
  for (const fixture of [fresh(), createCommunityTestPet('harvest', T), pet]) {
    const html = renderToStaticMarkup(createElement(CommunityPage, { pet: fixture, portrait: 'furo.png', update: noop, onBack: noop, onExplore: noop, onKitchen: noop, onShop: noop, orchard: null }));
    assert(html.includes('溪畔农场') && html.includes('data-scene="farm"'));
    assert(html.includes('data-place="field"') && html.includes('aria-haspopup="dialog"'));
    assert(!html.includes('community-place-dialog'), 'farm opens on the scene; operations wait for a place selection');
    assert(!/NaN|src="undefined"/.test(html));
  }
  const pending = enforceAdventureHealth(createCommunityTestPet('salvage', T)).adventure.pending!;
  const html = renderToStaticMarkup(createElement(AdventureReturnSelection, { result: pending, registry: createItemRegistry(), update: noop }));
  assert(html.includes('未选择 1 份') && html.includes('放弃其余 1 份') && html.includes('探路绳另行归还'));
  console.log('A+B React rendering passed: community start/build/growth states and explicit return selection. Visual and touch acceptance remains manual.');
} finally { await server.close(); }
