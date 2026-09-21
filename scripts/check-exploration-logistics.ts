import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { chooseExpeditionStep, getExpeditionChoices, getExpeditionCampStep, useExpeditionSupply, returnExpedition, claimExpedition, restExpedition, continueExpedition, selectExpeditionReturn } from '../src/core/expedition';
import { advanceAdventure, useAdventureSupply, pickupAdventureLoot, returnFromAdventure, claimAdventureResult } from '../src/core/adventure';
import { startAdventure, startExpedition } from './fixtures/legacy-exploration';
import { getAdventureSteps } from '../src/core/adventureData';
import { getBackpackUpgradeQuote, getExplorationBagCapacity, upgradeExplorationBackpack } from '../src/core/explorationBackpack';
import { explorationTravel, getExpeditionEvent } from '../src/core/explorationTravelData';
import { quoteExpeditionRations, getRationTreasureChance, isTravelFood } from '../src/core/explorationRations';
import { getExplorationCampQuote, getExplorationRescueQuote, rescueExploration, restExplorationWithKit, type ExplorationSystem } from '../src/core/explorationSupport';
import { regionIds } from '../src/core/expeditionData';
import { advanceExplorationBudget, earnExplorationPay } from '../src/core/explorationBudget';
import { getInventoryItem } from '../src/core/items';
import { getItemStatEffect } from '../src/core/itemEffects';
import { useInventoryItem } from '../src/core/petActions';
import { advancePet } from '../src/core/petLifecycle';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { reconcilePetClock } from '../src/core/gameClock';
import { createAdventureActionGate } from '../src/ui/adventureActionGate';
import type { PetState } from '../src/core/petTypes';
import type { RegionalTreasureId } from '../src/core/regionalTreasures';

const T = new Date(2026, 8, 21, 9).getTime(), H = 3600000;
const full = (p: PetState) => ({ ...p, hunger: getPetStatCap(p), energy: getPetEnergyCap(p), mood: getPetStatCap(p), health: getPetStatCap(p), cleanliness: getPetStatCap(p) });
const read = (p: PetState, now = p.lastUpdatedAt) => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
const ready = () => {
  let p = createCommunityTestPet('projects', T);
  p.level = 20; p.coins = 50000; p.hearts = 5000;
  p.inventory = { ...p.inventory, dish_carrot_rice: 300, dish_valley_travel_bento: 100, trail_mix: 100, camp_kit: 2, prospector_pick: 1, survey_lens: 1, community_wood: 100, community_stone: 100, creek_aquamarine: 2, hill_sunstone: 2, forest_emerald: 2, tidal_pearl: 2 };
  p.community.expedition.regions.valley.base = 2;
  p.community.decorations = ['creek_fountain'];
  p = advanceExplorationBudget(p, T);
  p.community.expedition.loop = { ...p.community.expedition.loop!, used: 80, day: '', vouchers: [], heartDays: [] };
  return full(advanceExplorationBudget(p, T));
};
const choose = (p: PetState, choice?: string) => { const t = p.community.expedition.active!; return chooseExpeditionStep(p, t.id, t.revision, choice ?? getExpeditionChoices(p, T)[0].id, T); };
const trip = (p: PetState, system: ExplorationSystem) => system === 'adventure' ? p.adventure.active! : p.community.expedition.active!;
assert.deepEqual(regionIds.map(id => { const p = explorationTravel[id]; return [p.hunger, p.energy, p.actions, p.idleHunger, p.idleEnergy, p.meals, p.nutrition]; }), [[90, 50, 6, 18, 14, 3, 100], [180, 100, 6, 20, 16, 4, 130], [360, 200, 8, 22, 18, 5, 160], [600, 320, 10, 24, 20, 6, 190], [900, 480, 12, 26, 22, 7, 225]]);

// Shared capacity, immutable upgrades and save/import conservation at every level.
for (const finalGem of ['forest_emerald', 'tidal_pearl'] as RegionalTreasureId[]) {
  let p = ready();
  for (const [level, capacity] of [24, 36, 48, 72].entries()) {
    assert.equal(getExplorationBagCapacity(read(p)), capacity);
    const stock = p.inventory.dish_carrot_rice!;
    let a = startAdventure(p, 'valley', 'test', 'test', { dish_carrot_rice: capacity }, false, T);
    assert.equal(read(a).adventure.active!.bag.dish_carrot_rice, capacity);
    if (level < 3) assert.equal(getBackpackUpgradeQuote(a).reason, '先结束行程并收好回执');
    a = returnFromAdventure(a, a.adventure.active!.id, T);
    a = claimAdventureResult(read(a), a.adventure.pending!.id); assert.equal(a.inventory.dish_carrot_rice, stock);
    let e = startExpedition(p, ['valley'], { dish_carrot_rice: capacity }, false, 'test', 'test', 'manual', 1, T);
    assert.equal(read(e).community.expedition.active!.bag.dish_carrot_rice, capacity);
    e = returnExpedition(e, e.community.expedition.active!.id, T); e = claimExpedition(read(e), e.community.expedition.pending!.id);
    assert.equal(e.inventory.dish_carrot_rice, stock);
    if (level === 3) break;
    const gem = (['creek_aquamarine', 'hill_sunstone', finalGem] as RegionalTreasureId[])[level];
    const before = p, q = getBackpackUpgradeQuote(p, gem); assert.equal(q.reason, '');
    p = upgradeExplorationBackpack(p, level, gem);
    assert.equal(p.coins, before.coins - q.coins!); assert.equal(p.inventory[gem], before.inventory[gem]! - 1);
    assert.equal(upgradeExplorationBackpack(p, level, gem), p, 'stale upgrade is atomic');
  }
}
const old = createDefaultPet(T) as any; delete old.adventure.backpackLevel; old.adventure.schemaVersion = 5;
assert.equal(getExplorationBagCapacity(normalizePet(old, T)), 24);
let denied = ready(); denied.community.expedition.regions.valley.surveyed = false;
assert(getBackpackUpgradeQuote(denied).reason); assert.equal(upgradeExplorationBackpack(denied, 0), denied);

// All ordinary manual budgets, event-only findings and risky/investigation modifiers.
for (const region of regionIds) {
  let p = startExpedition(ready(), [region], {}, false, 'test', 'test', 'manual', 1, T), hunger = 0, energy = 0, events = 0;
  for (let i = 0; i < explorationTravel[region].actions; i++) {
    const t = p.community.expedition.active!, choices = getExpeditionChoices(p, T), c = choices.find(c => c.id === 'safe') ?? choices[0];
    assert.equal(t.step, i); hunger += c.hunger; energy += c.energy;
    if (region !== 'valley') {
      if (getExpeditionEvent(t) === 'travel') assert(choices.every(c => Object.keys(c.finds).length === 0 && !c.research)); else events++;
      const risky = choices.find(c => c.id === 'cross');
      if (risky) { assert.equal(risky.hunger, Math.ceil(c.hunger * .75)); assert.equal(risky.energy, Math.ceil(c.energy * .75)); }
    }
    p = choose(full(p), c.id);
  }
  assert.equal(hunger, explorationTravel[region].hunger); assert.equal(energy, explorationTravel[region].energy);
  if (region !== 'valley') assert.equal(events, 3);
}
assert.equal(getAdventureSteps(8, 'valley', 'commission').reduce((n, s) => n + s.choices[0].hunger, 0), 42);
assert.equal(getAdventureSteps(8, 'valley', 'commission').reduce((n, s) => n + s.choices[0].energy, 0), 24);
assert.equal(getAdventureSteps(7, 'valley').reduce((n, s) => n + s.choices[0].hunger, 0), 30, 'old trips retain costs');

// Rescue is independent of bag space and food multipliers, and cannot charge twice.
for (const system of ['adventure', 'expedition'] as const) {
  let p = system === 'adventure' ? startAdventure(ready(), 'valley', 'test', 'test', { dish_carrot_rice: 24 }, false, T) : startExpedition(ready(), ['valley'], { dish_carrot_rice: 24 }, false, 'test', 'test', 'manual', 1, T);
  p = { ...p, hunger: 1, energy: 1, mood: 1 };
  const t = trip(p, system), q = getExplorationRescueQuote(p, system), before = p;
  p = rescueExploration(p, system, t.id, t.revision, T);
  assert.equal(p.hearts, before.hearts - 100); assert.equal(p.hunger, before.hunger + q.hunger); assert.equal(p.energy, before.energy + q.energy);
  assert.deepEqual(trip(p, system).bag, t.bag); assert.equal(trip(p, system).id, t.id);
  const duplicate = rescueExploration(p, system, t.id, t.revision, T); assert.equal(duplicate.hearts, p.hearts); assert.equal(duplicate.energy, p.energy);
  p = rescueExploration(p, system, t.id, trip(p, system).revision, T); assert.equal(p.hearts, before.hearts - 200);
  assert(getExplorationRescueQuote({ ...full(p), mood: 1 }, system).reason, 'mood alone cannot buy rescue');
  assert(getExplorationRescueQuote({ ...p, hearts: 99, hunger: 1 }, system).reason);
  const frozen = prepareTimePause(p, T); assert.equal(rescueExploration(frozen, system, t.id, trip(frozen, system).revision, T), frozen);
  const sick = { ...p, health: 1 }, sickHearts = sick.hearts;
  assert.equal(rescueExploration(sick, system, t.id, trip(sick, system).revision, T).hearts, sickHearts);
}

// Camp uses current caps, region debt, actual food recovery and the final tool charge.
for (const system of ['adventure', 'expedition'] as const) {
  let p = ready(); p.mood = 10;
  p = system === 'adventure' ? startAdventure(p, 'valley', 'test', 'test', { trail_mix: 2 }, false, T) : startExpedition(p, ['valley'], { trail_mix: 2 }, false, 'test', 'test', 'manual', 1, T);
  assert(getExplorationCampQuote(p, system).reason);
  if (system === 'adventure') p = advanceAdventure(p, p.adventure.active!.id, 0, 'entrance', T); else p = choose(p);
  let t = trip(p, system), q = getExplorationCampQuote(p, system);
  assert.equal(q.energy, t.energySpent); assert.equal(q.mood, Math.floor(getPetStatCap(p) * .2)); assert.equal(q.health, 0);
  p = system === 'adventure' ? useAdventureSupply(p, t.id, t.revision, 'trail_mix') : useExpeditionSupply(p, t.id, t.revision, 'trail_mix', T);
  assert.equal(trip(p, system).energySpent, 0, 'food repays energy debt');
  p.community.toolWear.camp_kit = 11; t = trip(p, system); const before = p;
  p = restExplorationWithKit(p, system, t.id, t.revision, T);
  assert.equal(p.energy, before.energy); assert.equal(p.mood - before.mood, q.mood); assert.equal(p.inventory.camp_kit, 1);
  assert(getExplorationCampQuote(p, system).reason);
}
let walk = startExpedition({ ...ready(), mood: 1 }, ['valley'], {}, false, 'test', 'test', 'manual', 1, T, { style: 'walk' }); walk = choose(walk);
assert(getExplorationCampQuote(walk, 'expedition').reason);
let noNeed = choose(startExpedition(ready(), ['valley'], {}, false, 'test', 'test', 'manual', 1, T));
noNeed = full(noNeed);
const noNeedTrip = noNeed.community.expedition.active!;
assert(getExplorationCampQuote(noNeed, 'expedition').reason);
assert.deepEqual(restExplorationWithKit(noNeed, 'expedition', noNeedTrip.id, noNeedTrip.revision, T).inventory, noNeed.inventory);
let continuous = startExpedition(ready(), ['valley', 'hills'], {}, false, 'test', 'test', 'manual', 1, T);
for (let i = 0; i < 6; i++) continuous = choose(continuous);
let ct = continuous.community.expedition.active!;
continuous = restExpedition(continuous, ct.id, ct.revision, T); assert(getExplorationCampQuote(continuous, 'expedition').reason);
ct = continuous.community.expedition.active!; continuous = continueExpedition(continuous, ct.id, ct.revision, T);
assert.equal(continuous.community.expedition.active!.energySpent, 0); assert.equal(continuous.community.expedition.active!.healthLost, 0); assert.equal(continuous.community.expedition.active!.paidActions, 0);

// Rations use base values, both minimums, pooled stock and deterministic saved rolls.
for (const region of regionIds) {
  const p = ready(), q = quoteExpeditionRations(p, region, 8), profile = explorationTravel[region];
  assert.equal(q.reason, ''); assert.equal(q.coins, profile.meals * 28 * 4);
  assert.equal(q.chance, 3); assert(q.hunger >= profile.nutrition * 4); assert.equal(q.count, profile.meals * 4);
}
assert(!isTravelFood('golden_apple')); assert(!isTravelFood('birthday_cake')); assert(!isTravelFood('blanket'));
assert.equal(getRationTreasureChance(0, 3), 1); assert.equal(getRationTreasureChance(10000, 3), 15);
assert(quoteExpeditionRations(ready(), 'valley', 2, { food: { dish_carrot_rice: 1 }, autoFill: false }).reason, 'one nourishing dish still fails quantity');
assert(quoteExpeditionRations(ready(), 'valley', 2, { food: { apple: 7 }, autoFill: true }).reason);
assert(quoteExpeditionRations({ ...ready(), inventory: { dish_carrot_rice: 3 } }, 'valley', 4, { food: { dish_carrot_rice: 6 }, autoFill: false }).reason);

for (const region of regionIds) for (const hours of [2, 4, 8]) {
  const base = ready(), p = startExpedition(base, [region], {}, false, 'test', 'test', 'idle', hours, T); assert(p.community.expedition.active);
  const all = advancePet(p, T + hours * H);
  let chunks = p; for (let i = 1; i <= hours * 4; i++) chunks = read(advancePet(chunks, T + i * H / 4), T + i * H / 4);
  assert.deepEqual(chunks.community.expedition.pending, { ...all.community.expedition.pending, journal: [] }, 'all settlement fields survive reload; display logs are transient');
  assert.equal(chunks.energy, all.energy); assert(Math.abs(chunks.hunger - all.hunger) < 1e-6);
  assert.equal(all.energy, p.energy - explorationTravel[region].idleEnergy * hours / 2);
  assert(Math.abs(all.hunger - p.hunger + explorationTravel[region].idleHunger * hours / 2) < .001);
  assert.equal(all.community.expedition.pending!.coins, Math.floor(1920 * explorationTravel[region].payPercent / 100) * hours / 8);
}

for (const elapsed of [0, .5, 2, 2 + 1 / H, 4, 7.9]) {
  const p = startExpedition(ready(), ['valley'], {}, false, 'test', 'test', 'idle', 8, T, { rations: { food: { trail_mix: 3, dish_carrot_rice: 1 }, autoFill: true } });
  const back = returnExpedition(p, p.community.expedition.active!.id, T + elapsed * H), receipt = back.community.expedition.pending!;
  assert.equal(receipt.refundCoins, 0);
  assert.equal(receipt.items.trail_mix ?? 0, 0);
  assert.equal(receipt.items.dish_carrot_rice ?? 0, 0);
  assert.deepEqual(back.inventory, p.inventory, 'recall never refunds or deducts warehouse food again');
  const total = Object.values(p.community.expedition.active!.rationPlan!.food).reduce((sum, n) => sum + n, 0);
  assert.equal(Object.values(receipt.rationReturn!.eaten).reduce((sum, n) => sum + n, 0) + Object.values(receipt.rationReturn!.shared).reduce((sum, n) => sum + n, 0), Math.floor(total * (8 - elapsed) / 8));
  const claimed = claimExpedition(read(back, T + elapsed * H), receipt.id);
  assert.equal(claimed.achievements.counters.coinEarnedTotal - back.achievements.counters.coinEarnedTotal, receipt.coins);
  assert.equal(claimExpedition(claimed, receipt.id).coins, claimed.coins);
}

let lucky = startExpedition(ready(), ['valley'], {}, false, 'test', 'test', 'idle', 4, T);
lucky.community.expedition.active!.rationPlan!.discoveries[0].roll = 0;
lucky.community.expedition.active!.rationPlan!.discoveries[1].roll = 99;
lucky = read(lucky);
const atTwo = advancePet(lucky, T + 2 * H); assert.equal(atTwo.community.expedition.active!.bag.creek_aquamarine, 1);
assert.equal(atTwo.community.expedition.active!.rationPlan!.discoveries[1].settled, false);
const atFour = advancePet(read(atTwo, T + 2 * H), T + 4 * H); assert.equal(atFour.community.expedition.pending!.items.creek_aquamarine, 1);
const frozen = prepareTimePause(atTwo, T + 2 * H), resumed = resumePetTime(read(frozen, T + 24 * H), T + 24 * H);
assert.equal(resumed.community.expedition.active!.rationPlan!.discoveries[0].roll, 0);
assert.equal(advancePet(resumed, T + 26 * H).community.expedition.pending!.items.creek_aquamarine, 1);
const rollback = reconcilePetClock(atTwo, T + H).pet;
assert.equal(advancePet(rollback, T + 3 * H).community.expedition.pending!.items.creek_aquamarine, 1);
let richFuture = startExpedition(ready(), ['valley'], {}, false, 'test', 'test', 'idle', 4, T, { rations: { food: { dish_valley_travel_bento: 6 }, autoFill: true } });
assert.equal(richFuture.community.expedition.active!.rationPlan!.chance, 15);
richFuture.community.expedition.active!.rationPlan!.discoveries[0].roll = 5;
richFuture = returnExpedition(read(richFuture), richFuture.community.expedition.active!.id, T + 2 * H);
assert.equal(richFuture.community.expedition.pending!.items.creek_aquamarine, 1, 'the entire journey uses the packed food quality');
assert.equal(richFuture.community.expedition.pending!.items.dish_valley_travel_bento, undefined);
const healthTie = { ...lucky, health: getPetStatCap(lucky) * (.2 + .08) - 1e-6, mood: 0, cleanliness: 0 };
const retreated = advancePet(healthTie, T + 2 * H);
assert.equal(retreated.community.expedition.pending!.reason, 'health'); assert.equal(retreated.community.expedition.pending!.items.creek_aquamarine, undefined);
assert.equal(retreated.community.expedition.pending!.items.valley_mushroom, 2, 'health wins the two-hour treasure and material boundary');
const beforeReset = T + 19 * H;
let midnight = ready(); midnight.lastUpdatedAt = beforeReset; midnight.lastEnergyRecoveryAt = beforeReset;
midnight = startExpedition(midnight, ['station'], {}, false, 'test', 'test', 'idle', 8, beforeReset);
let midnightChunks = midnight;
for (let i = 1; i <= 8; i++) midnightChunks = read(advancePet(midnightChunks, beforeReset + i * H), beforeReset + i * H);
assert.deepEqual(midnightChunks.community.expedition.pending, { ...advancePet(midnight, beforeReset + 8 * H).community.expedition.pending, journal: [] });
assert.equal(midnightChunks.community.expedition.loop!.vouchers.length, 8, 'daily reset issues four new regional-neutral shares');

// In-flight v2 rations and costs survive the v3 state migration.
let legacyIdle = startExpedition(ready(), ['valley'], {}, false, 'test', 'test', 'idle', 8, T);
legacyIdle.coins += 336; legacyIdle.inventory.trail_mix! -= 4;
legacyIdle.community.expedition.active!.rulesVersion = 2; delete legacyIdle.community.expedition.active!.rationPlan;
legacyIdle.community.expedition.active!.rationsRemaining = 3;
(legacyIdle.community.expedition as any).schemaVersion = 2;
legacyIdle = read(legacyIdle);
const legacyBack = returnExpedition(legacyIdle, legacyIdle.community.expedition.active!.id, T + 2 * H);
assert.equal(legacyBack.energy, legacyIdle.energy - 6); assert.equal(legacyBack.hunger, legacyIdle.hunger - 6);
assert.equal(legacyBack.community.expedition.pending!.items.trail_mix, 3);
assert.equal(legacyBack.community.expedition.pending!.refundCoins, 0);

// Older manual trips keep their route costs but retain new support accounting after saving.
for (const rulesVersion of [1, 2] as const) {
  let legacy = startExpedition(ready(), ['hills'], {}, false, 'test', 'test', 'manual', 1, T);
  legacy.community.expedition.active!.rulesVersion = rulesVersion;
  legacy = choose(legacy, 'gather');
  const spent = legacy.community.expedition.active!.energySpent;
  legacy = read(legacy);
  assert.equal(legacy.community.expedition.active!.energySpent, spent);
  assert.equal(getExplorationCampQuote(legacy, 'expedition').energy, spent);
  const t = legacy.community.expedition.active!;
  legacy = restExplorationWithKit(legacy, 'expedition', t.id, t.revision, T);
  assert.equal(read(legacy).community.expedition.active!.energySpent, 0);
  assert(getExplorationCampQuote(read(legacy), 'expedition').reason);
}

// First payment locks geography and price, including fractional faces and migration.
let ledger = ready(); ledger.community.expedition.loop!.vouchers = [{ day: '2026-09-21', slot: 0, face: 150, paid: 0 }];
let paid = earnExplorationPay(ledger, 'hour', T, 'hills'); assert.equal(paid.coins, 74);
ledger = read(paid.pet); assert.equal(earnExplorationPay(ledger, 'manual', T, 'station').coins, 0);
paid = earnExplorationPay(ledger, 'manual', T, 'hills'); assert.equal(paid.coins, 113); assert.equal(paid.pet.community.expedition.loop!.vouchers[0].quote, 187);

// Real food, overflow and trophy/mastery/achievement combinations across four full station trips.
for (const [tier, level] of [['none', 1], ['gold', 20], ['diamond', 20], ['diamond', 99]] as const) for (const mastery of [false, true]) for (const achievements of [false, true]) {
  let p = ready(); p.level = level;
  if (tier !== 'none') p.classicEndgame.projects.cooking.completedStages = 5;
  if (tier === 'diamond') for (const project of Object.values(p.classicEndgame.projects)) project.completedStages = 5;
  if (mastery) p.partnerSchedule.skills.cooking = { ...p.partnerSchedule.skills.cooking, level: 10, masterCompletions: 60 };
  if (achievements) p.achievements.unlockedAtById = { ...p.achievements.unlockedAtById, sleep_rhythm_30: T, rare_gentle_caretaker: T };
  p = full(p); const counts: number[] = [];
  const food = getInventoryItem('dish_carrot_rice')!, preview = getItemStatEffect(p, food);
  assert(preview.hunger! >= 60);
  if (mastery && !achievements && tier !== 'none') assert.equal(preview.hunger, Math.round(food.effect.hunger! * (tier === 'gold' ? 2.3 : 2.875)));
  assert.equal(quoteExpeditionRations(p, 'station', 2, { food: { dish_carrot_rice: 7 }, autoFill: false }).hunger, food.effect.hunger! * 7, 'ration nutrition ignores trophy and other food bonuses');
  for (let journey = 0; journey < 4; journey++) {
    p = startExpedition(p, ['station'], { dish_carrot_rice: 24 }, false, 'test', 'test', 'manual', 1, T);
    assert(p.community.expedition.active, `${tier}/${mastery}/${achievements} departure ${journey}`);
    let consumed = 0;
    while (p.community.expedition.active!.step < 12) {
      const choices = getExpeditionChoices(p, T), c = journey % 2 ? choices.find(c => c.id === 'pick:star_sapphire') ?? choices.find(c => c.id === 'cross') ?? choices[0] : choices.find(c => c.id === 'safe') ?? choices[0];
      while (p.hunger < c.hunger || p.energy < c.energy) {
        const t = p.community.expedition.active!, next = useExpeditionSupply(p, t.id, t.revision, 'dish_carrot_rice', T);
        assert(next.hunger > p.hunger || next.energy > p.energy, `${tier}: route cannot require blankets`); p = next; consumed++; assert(consumed <= 24);
      }
      p = choose(p, c.id);
    }
    const t = p.community.expedition.active!; p = restExpedition(p, t.id, t.revision, T);
    p = returnExpedition(p, t.id, T);
    const receipt = p.community.expedition.pending!, all = { ...receipt.items };
    for (const [id, n] of Object.entries(receipt.overflow)) all[id] = (all[id] ?? 0) + n;
    if (!receipt.selected) p = selectExpeditionReturn(p, t.id, all);
    p = claimExpedition(p, t.id);
    // A new departure has a 12H/10E readiness threshold. A meal before leaving counts in provisioning.
    if (p.hunger < 12 || p.energy < 10) { p = useInventoryItem(p, 'dish_carrot_rice', T); consumed++; }
    counts.push(consumed);
  }
  console.log(`Station food ${tier}, level=${level}, mastery=${mastery}, achievement=${achievements}: ${counts.join('/')} carrot rice, zero blankets`);
}

// Timer cancellation rejects expired callbacks; immediate inventory actions leave moves queued.
const scheduled: (() => void)[] = [], gate = createAdventureActionGate(() => {}, { schedule: fn => { scheduled.push(fn); return fn; }, cancel: () => {} });
let moves = 0, inventory = 0;
gate.run(() => { moves++; }, 'walk'); gate.run(() => { inventory++; }, 'pack', false); assert.equal(inventory, 1); assert.equal(moves, 0);
assert.equal(gate.run(() => { moves++; }), false); scheduled[0](); assert.equal(moves, 1); scheduled[1]();
scheduled[0](); assert.equal(moves, 1, 'duplicate timer callbacks cannot recommit');
gate.run(() => { moves++; }); gate.cancel(); scheduled[2](); scheduled[3](); assert.equal(moves, 1);
console.log('Exploration logistics: backpacks, costs, rescue, camp, meals, recall, rolls, regional pay, real food and action gate passed.');

// SSR checks the actual five-region controls; visual and touch acceptance stays manual.
const { createServer } = await import('vite'), { createElement } = await import('react'), { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const [rations, prep, journey] = await Promise.all([server.ssrLoadModule('/src/ui/expedition/ExpeditionRations.tsx'), server.ssrLoadModule('/src/ui/expedition/RegionPreparation.tsx'), server.ssrLoadModule('/src/ui/expedition/ExpeditionJourney.tsx')]);
  const noop = () => {}, props = { pet: ready(), update: noop, actorId: 'test', actorName: 'test', portrait: '', onCommunity: noop, onKitchen: noop, onShop: noop };
  for (const region of regionIds) {
    const html = renderToStaticMarkup(createElement(rations.ExpeditionRations, { pet: props.pet, region, hours: 8, setHours: noop, selection: { food: {}, autoFill: true }, onChange: noop }));
    assert.match(html, /全程至少/); assert.match(html, /吃饱后分给路过的邻居/); assert(!/第 4 段|复制到全部时段/.test(html));
    assert.match(renderToStaticMarkup(createElement(prep.RegionPreparation, { ...props, selected: region })), /永久旅行背包/);
  }
  const p = choose(startExpedition(ready(), ['forest'], {}, false, 'test', 'test', 'manual', 1, T));
  const html = renderToStaticMarkup(createElement(journey.ExpeditionJourney, { ...props, pet: p }));
  assert.match(html, /邻居救援/); assert.match(html, /便携营具/); assert.match(html, /行囊 0\/24/);
  const { default: postcss } = await import('postcss'), { readFileSync } = await import('node:fs');
  postcss.parse(readFileSync(new URL('../src/styles/exploration-logistics.css', import.meta.url), 'utf8'));
} finally { await server.close(); }
console.log('Exploration UI SSR and stylesheet checks passed; no browser automation or screenshots.');
await import('./check-idle-rations');
