import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { advancePet } from '../src/core/petLifecycle';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { getInventoryItem } from '../src/core/items';
import { getItemRecoveryPreview } from '../src/core/itemEffects';
import { createSaveFileText, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { reconcilePetClock } from '../src/core/gameClock';
import { chooseExpeditionStep, claimExpedition, continueExpedition, getExpeditionChoices, getExpeditionCampStep, getExpeditionHarvestLeft, getExpeditionStartReason, pauseExpedition, restExpedition, returnExpedition, selectExpeditionReturn, upgradeExpeditionBase, useExpeditionSupply } from '../src/core/expedition';
import { startExpedition } from './fixtures/legacy-exploration';
import { expeditionBagCount, getRegionUnlocked, isExpeditionAway, regionIds } from '../src/core/expeditionData';
import { contributeCommunityProject, getProjectDelivery, startCommunityProject } from '../src/core/expeditionProjects';
import { getCommunitySale } from '../src/core/communityEconomy';
import { harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { canCraftRecipe, canSpendCompanionTime, craftRecipe } from '../src/core/kitchen';
import { startCommunityFishing } from '../src/core/communityFishing';
import { getAdventureStartReason } from '../src/core/adventure';
import { useInventoryItem, applyPetAction, startPomodoro } from '../src/core/petActions';
import type { PetState } from '../src/core/petTypes';
import type { RegionId } from '../src/core/expeditionTypes';
import { completeValleyQuest } from '../src/core/valleyQuests';

const T = new Date(2026, 8, 18, 10).getTime(), H = 3600000;
const fresh = () => createCommunityTestPet('commissions', T);
const ready = () => createCommunityTestPet('projects', T);
const refill = (p: PetState) => ({ ...p, energy: getPetEnergyCap(p), hunger: getPetStatCap(p), mood: getPetStatCap(p), health: getPetStatCap(p), cleanliness: getPetStatCap(p), isSleeping: false });
const roundTrip = (p: PetState, now = T) => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
const choose = (p: PetState, choice: string, now = T) => {
  // Walk inserted route sections to reach the requested event. Food balance has its own suite.
  for (let i = 0; i < 12; i++) {
    const t = p.community.expedition.active!, choices = getExpeditionChoices(p, now), c = choices.find(c => c.id === choice) ?? choices.find(c => c.id === 'travel');
    if (!c) return p;
    if (p.hunger < c.hunger || p.energy < c.energy) p = refill(p);
    p = chooseExpeditionStep(p, t.id, t.revision, c.id, now);
    if (c.id === choice) return p;
  }
  return p;
};
const travel = (p: PetState, region: RegionId, now = T) => {
  p = startExpedition(refill(p), [region], {}, false, 'test.furo', 'Furo', 'manual', 1, now);
  assert(p.community.expedition.active, `${region} starts`);
  while (p.community.expedition.active!.step < getExpeditionCampStep(p.community.expedition.active!)) {
    const c = getExpeditionChoices(p, now)[0]; p = choose(refill(p), c.id, now);
  }
  const id = p.community.expedition.active!.id;
  p = returnExpedition(p, id, now); return claimExpedition(p, id);
};

// Permanent unlocks branch after the hills; story facts and finite growth cannot replay.
assert.match(getExpeditionStartReason(createDefaultPet(T), ['valley']), /教学/);
let p = fresh(), baseCap = getPetEnergyCap(p);
assert(!getRegionUnlocked(p, 'hills'));
p = travel(p, 'valley'); assert(!getRegionUnlocked(p, 'hills'), 'patrol does not bypass the chapter');
p = completeValleyQuest(p, 'valley_camp'); assert(getRegionUnlocked(p, 'hills')); assert.equal(getPetEnergyCap(p), baseCap + 7);
p = travel(p, 'hills'); assert(getRegionUnlocked(p, 'forest')); assert(getRegionUnlocked(p, 'coast')); assert(!getRegionUnlocked(p, 'station'));
p = travel(p, 'coast'); assert(!getRegionUnlocked(p, 'station'));
p = travel(p, 'forest'); assert(getRegionUnlocked(p, 'station'));
p = travel(p, 'station'); assert.equal(getPetEnergyCap(p), baseCap + 15);
const storyAt = p.community.expedition.regions.valley.storyAt;
const firstCoins = p.coins, firstHearts = p.hearts;
p = travel(p, 'valley'); assert(p.coins >= firstCoins); assert.equal(p.hearts, firstHearts); assert.equal(p.community.expedition.regions.valley.storyAt, storyAt);
p = travel(p, 'valley'); const gathered = p.inventory.valley_mushroom;
p = travel(p, 'valley'); assert.equal(p.inventory.valley_mushroom, gathered); assert.equal(getExpeditionHarvestLeft(p, 'valley', T), 0);
assert.equal(getExpeditionHarvestLeft(p, 'valley', T + 24 * H), 8);

// The E recipes, renewed seed and crop actually share inventory with C/D systems.
p = ready();
assert(canCraftRecipe(p, 'berry_milk', false, 1));
const beforeBerry = p.inventory.forest_berry!, beforeMilk = p.inventory.farm_milk!;
p = craftRecipe(p, 'berry_milk', false, 1, 'berry-once', T);
assert.equal(p.inventory.forest_berry, beforeBerry - 1); assert.equal(p.inventory.farm_milk, beforeMilk - 1);
assert.equal(craftRecipe(p, 'berry_milk', false, 1, 'berry-once', T), p);
const seed = p.inventory.forest_berry_seed!;
p = plantCommunityCrop(p, 1, 'berry', T); assert.equal(p.inventory.forest_berry_seed, seed - 1);
p = harvestCommunityCrop(p, 1, T, T + 7 * H); assert(p.community.plots[0].crop);
p = harvestCommunityCrop(p, 1, T, T + 8 * H); assert(!p.community.plots[0].crop);
assert(getCommunitySale('dish_berry_milk')!.base > getCommunitySale('forest_berry')!.base);
assert.equal(getCommunitySale('forest_berry_seed'), undefined);
assert(!canCraftRecipe(fresh(), 'mushroom_rice', false, 1));

// Atomic actions: stale callbacks do not spend again; all away activities block one another.
p = startExpedition(ready(), ['forest'], { field_dressing: 2 }, true, 'test.furo', 'Furo', 'manual', 1, T);
const a = p.community.expedition.active!;
assert(!canSpendCompanionTime(p)); assert.match(getAdventureStartReason(p, 'valley', T), /远征/);
assert.equal(startCommunityFishing(p, 'pond', 'fishing_bait', false, T).community.fishing.active, undefined);
const beforeHunger = p.hunger; p = choose(p, 'observe');
const again = chooseExpeditionStep(p, a.id, a.revision, 'observe', T);
assert.equal(again.hunger, p.hunger); assert.deepEqual(again.community.expedition.active, p.community.expedition.active); assert(p.hunger < beforeHunger);
assert.equal(p.community.expedition.active!.bag.forest_berry_seed, 2);
const homeFeed = useInventoryItem(p, 'dish_mushroom_rice', T); assert.deepEqual(homeFeed.inventory, p.inventory);
assert(!applyPetAction(p, 'sleep', T).isSleeping);
assert(!startPomodoro(p, T).pomodoro.isRunning);

// Expedition meals retain overflow through saves and subsequent route costs.
const supplyBase = ready();
const supplyTrip = startExpedition({ ...supplyBase, inventory: { ...supplyBase.inventory, trail_mix: 2 } }, ['forest'], { trail_mix: 2 }, false, 'test.furo', 'Furo', 'manual', 1, T);
const nearlyFullTrip = { ...supplyTrip, hunger: getPetStatCap(supplyTrip) - 10, isOverfed: false };
const supplyId = nearlyFullTrip.community.expedition.active!.id;
const supplyPreview = getItemRecoveryPreview(nearlyFullTrip, getInventoryItem('trail_mix')!, 1, []);
const suppliedTrip = useExpeditionSupply(nearlyFullTrip, supplyId, nearlyFullTrip.community.expedition.active!.revision, 'trail_mix', T);
assert.equal(suppliedTrip.hunger - nearlyFullTrip.hunger, supplyPreview.actual.hunger, 'expedition food uses the shared overflow preview');
assert(suppliedTrip.hunger > getPetStatCap(suppliedTrip));
assert.equal(suppliedTrip.community.expedition.active!.bag.trail_mix, 1);
const reloadedTrip = roundTrip(suppliedTrip);
assert.equal(reloadedTrip.hunger, suppliedTrip.hunger, 'expedition overflow survives save import');
assert.equal(useExpeditionSupply(reloadedTrip, supplyId, reloadedTrip.community.expedition.active!.revision, 'trail_mix', T).community.expedition.active!.bag.trail_mix, 1, 'full expedition companions cannot eat again');
assert.equal(choose(reloadedTrip, 'observe').hunger, reloadedTrip.hunger - 90, 'travel and gather each pay the new forest action cost');

// Base effects are bounded per trip; pausing is a safe, persistent checkpoint.
p = createCommunityTestPet('long-trip', T); const paused = p.community.expedition.active!;
assert(paused.paused && canSpendCompanionTime(p));
p = roundTrip(p); assert(p.community.expedition.active!.paused);
const pausedEnergy = p.energy;
p = restExpedition(p, paused.id, paused.revision, T); assert.equal(p.energy, pausedEnergy);
p = continueExpedition(p, paused.id, paused.revision, T); assert.equal(p.community.expedition.active!.leg, 1); assert(isExpeditionAway(p));
for (const choice of ['gather', 'safe', 'story']) p = choose(p, choice);
const camp = p.community.expedition.active!;
p = restExpedition(p, camp.id, camp.revision, T); const restedEnergy = p.energy;
p = restExpedition(p, camp.id, p.community.expedition.active!.revision, T); assert.equal(p.energy, restedEnergy);
assert.equal(p.community.expedition.active!.rested.filter(id => id === 'hills').length, 1);
p = pauseExpedition(p, camp.id, p.community.expedition.active!.revision, T);
p = advancePet(p, T + H); assert.equal(p.community.expedition.active!.step, 6); assert.equal(p.community.expedition.active!.leg, 1);

// Health uses the current cap; low health cannot be rescued by a late supply callback.
for (const level of [1, 20, 99]) {
  let q = ready(); q.level = level; q = refill(q); const cap = getPetStatCap(q);
  q.health = cap * .4 - .01; assert.match(getExpeditionStartReason(q, ['valley']), /健康不足/);
  q.health = cap * .4; q = startExpedition(q, ['valley'], { field_dressing: 1 }, false, 'test.furo', 'Furo', 'manual', 1, T);
  assert(q.community.expedition.active);
  q.health = cap * .2; q = normalizePet(q, T); assert(q.community.expedition.active);
  const trip = q.community.expedition.active!; q.health = cap * .2 - .01;
  q = useExpeditionSupply(q, trip.id, trip.revision, 'field_dressing', T);
  assert(!q.community.expedition.active); assert.equal(q.community.expedition.pending!.reason, 'health'); assert.equal(q.community.expedition.pending!.items.field_dressing, 1);
}

// Full bag, overflow, reusable tool and full storage form a single immutable return selection.
p = ready(); p.inventory.dish_carrot_rice = 24;
p = startExpedition(p, ['forest'], { dish_carrot_rice: 24 }, true, 'test.furo', 'Furo', 'manual', 1, T);
p = choose(p, 'observe'); p.health = 19; p = advancePet(p, T);
const receipt = p.community.expedition.pending!; assert(!receipt.selected); assert.equal(receipt.overflow.forest_berry_seed, 2);
assert.equal(selectExpeditionReturn(p, receipt.id, { dish_carrot_rice: 24, forest_berry_seed: 1 }), p);
p = selectExpeditionReturn(p, receipt.id, { dish_carrot_rice: 23, forest_berry_seed: 1 });
assert.equal(selectExpeditionReturn(p, receipt.id, { forest_berry_seed: 1 }), p);
p.inventory.forest_berry_seed = 9999;
p = claimExpedition(p, receipt.id); assert(p.community.expedition.pending);
p = roundTrip(p); p.inventory.forest_berry_seed = 9998;
p = claimExpedition(p, receipt.id); assert(!p.community.expedition.pending); assert.equal(p.inventory.forest_berry_seed, 9999); assert.equal(p.inventory.trail_rope, 1);
assert.equal(claimExpedition(p, receipt.id), p);

// Timed travel reserves bounded quota, never completes stories, and settles exactly once.
p = startExpedition(ready(), ['coast'], {}, false, 'test.furo', 'Furo', 'idle', 4, T);
assert.equal(getExpeditionHarvestLeft(p, 'coast', T), 4);
const timed = p.community.expedition.active!, beforeKelp = p.inventory.coast_kelp;
let half = returnExpedition(p, timed.id, T + H / 2); assert.equal(expeditionBagCount(half.community.expedition.pending!.items), 0);
assert.equal(half.inventory.coast_kelp, beforeKelp);
let chunked = advancePet(p, T + H); chunked = roundTrip(chunked, T + H); chunked = advancePet(chunked, T + 4 * H);
const allAtOnce = advancePet(p, T + 4 * H);
assert.deepEqual(chunked.community.expedition.pending, { ...allAtOnce.community.expedition.pending, journal: [] }, 'save/load preserves every settlement field while omitting the unused display log');
assert.equal(allAtOnce.community.expedition.pending!.items.coast_kelp, 8);
assert.equal(allAtOnce.community.expedition.pending!.coins, 840); assert.equal(allAtOnce.community.expedition.pending!.hearts, 22);
assert.equal(allAtOnce.community.expedition.pending!.at, T + 4 * H);
const nextId = allAtOnce.community.expedition.nextId;
assert.equal(advancePet(allAtOnce, T + 24 * H).community.expedition.nextId, nextId);
// Returning below 20% before hour 1 yields nothing, even if a much later frame sees recovery.
let low = { ...p, health: 21, hunger: 0, mood: 0, cleanliness: 0 };
low = advancePet(low, T + 24 * H); assert.equal(low.community.expedition.pending!.reason, 'health');
assert(low.community.expedition.pending!.at < T + H); assert.equal(expeditionBagCount(low.community.expedition.pending!.items), 0);
// Clock rollback shifts the schedule, preserves collected parts, and cannot refresh its quota.
let rolled = reconcilePetClock(advancePet(p, T + H), T + H / 2).pet;
assert.equal(rolled.community.expedition.active!.endsAt - rolled.community.expedition.active!.startedAt, 4 * H);
assert.equal(rolled.community.expedition.active!.settledParts, 1);
assert.equal(getExpeditionHarvestLeft(rolled, 'coast', T), 4);
rolled = advancePet(rolled, T + 3.5 * H); assert.equal(rolled.community.expedition.pending!.items.coast_kelp, 8);

// Projects use real inventory in stages and preserve both first memories and finite growth.
p = ready(); const capBeforeProject = getPetEnergyCap(p);
p = startCommunityProject(p, 'riverside', 'journey', T);
const delivery = getProjectDelivery(p, 'riverside'), mushrooms = p.inventory.valley_mushroom!;
p = contributeCommunityProject(p, 'riverside', 0, 0, 'test.furo', 'Furo', T);
assert.equal(p.inventory.valley_mushroom, mushrooms - delivery.valley_mushroom!);
const delivered = p.inventory.valley_mushroom;
p = contributeCommunityProject(p, 'riverside', 0, 0, 'test.furo', 'Furo', T); assert.equal(p.inventory.valley_mushroom, delivered);
p = roundTrip(p, T + 24 * H); assert.equal(p.community.expedition.projects.riverside.stage, 1);
p = refill(advancePet(p, T + 24 * H));
p = contributeCommunityProject(p, 'riverside', 0, 1, 'test.furo', 'Furo', T + 24 * H);
p = contributeCommunityProject(p, 'riverside', 0, 2, 'test.furo', 'Furo', T + 24 * H);
assert.equal(p.community.expedition.projects.riverside.completed, 1); assert.equal(getPetEnergyCap(p), capBeforeProject + 3);
const completionCoins = p.coins;
p = contributeCommunityProject(p, 'riverside', 0, 2, 'test.furo', 'Furo', T + 24 * H); assert.equal(p.coins, completionCoins);
p = startCommunityProject(p, 'riverside', 'garden', T + 24 * H); assert(!p.community.expedition.projects.riverside.theme);
p = refill(advancePet(p, T + 48 * H));
p = startCommunityProject(p, 'riverside', 'garden', T + 48 * H);
for (const stage of [0, 1, 2]) p = contributeCommunityProject(p, 'riverside', 1, stage, 'test.other', '另一个伙伴', T + 48 * H);
assert.equal(p.community.expedition.projects.riverside.completed, 2); assert.equal(getPetEnergyCap(p), capBeforeProject + 3); assert.equal(p.community.expedition.projects.riverside.actorId, 'test.furo');
for (const project of ['exhibition', 'observatory'] as const) for (const theme of ['garden', 'journey'] as const) {
  let q = startCommunityProject(ready(), project, theme, T);
  assert.equal(q.community.expedition.projects[project].theme, theme);
  for (const stage of [0, 1, 2]) q = contributeCommunityProject(q, project, 0, stage, 'test.furo', 'Furo', T);
  assert.equal(q.community.expedition.projects[project].completed, 1);
  assert.equal(getPetEnergyCap(q), getPetEnergyCap(ready()) + 3);
}

// Save migration preserves A-D; newer E schemas/rules are refused rather than discarded.
const legacy = ready(); delete (legacy.community as any).expedition; (legacy.community as any).schemaVersion = 2;
const migrated = normalizePet(legacy, T); assert(migrated.community.gardenBuilt); assert(migrated.community.facilities.barn.built); assert(!migrated.community.expedition.regions.valley.surveyed);
const newer = JSON.parse(createSaveFileText(ready(), null, T)); newer.pet.community.expedition.schemaVersion = 5;
assert.throws(() => parseSaveFileText(JSON.stringify(newer), T), UnsupportedSaveVersionError);
const newerTrip = JSON.parse(createSaveFileText(createCommunityTestPet('idle', T), null, T)); newerTrip.pet.community.expedition.active.rulesVersion = 5;
assert.throws(() => parseSaveFileText(JSON.stringify(newerTrip), T), UnsupportedSaveVersionError);
postcss.parse(readFileSync(new URL('../src/styles/outpost.css', import.meta.url), 'utf8'));
console.log('E: five regions, production/recipes, bag/health, checkpoints, timed travel, clock/save migration and staged projects passed.');
