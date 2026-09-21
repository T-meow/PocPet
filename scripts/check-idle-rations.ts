import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { startExpedition, returnExpedition, claimExpedition, getExpeditionStartReason } from '../src/core/expedition';
import { finishExpedition } from '../src/core/expeditionReturn';
import { eatReturningRations, getRemainingRations, rationReturnLines } from '../src/core/expeditionRationReturn';
import { lockRationSegments, normalizeRationPlan, quoteExpeditionRations } from '../src/core/explorationRations';
import { explorationTravel } from '../src/core/explorationTravelData';
import { regionIds } from '../src/core/expeditionData';
import { advanceExplorationBudget } from '../src/core/explorationBudget';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { getInventoryItem, removeInventoryItem } from '../src/core/items';
import { getItemStatEffect, itemStatKeys } from '../src/core/itemEffects';
import { useInventoryItem } from '../src/core/petActions';
import { advancePet } from '../src/core/petLifecycle';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { reconcilePetClock } from '../src/core/gameClock';
import type { Inventory, PetState } from '../src/core/petTypes';

const T = new Date(2026, 8, 21, 10).getTime(), H = 3600000;
const originalNow = Date.now;
Date.now = () => T;
const count = (food: Inventory) => Object.values(food).reduce((sum, n) => sum + n, 0);
const stats = (p: PetState) => itemStatKeys.map(key => p[key]);
const read = (p: PetState, at = p.lastUpdatedAt) => parseSaveFileText(createSaveFileText(p, null, at), at).pet;
const ready = () => {
  let p = createCommunityTestPet('projects', T);
  p.level = 20; p.coins = 50000; p.hunger = p.health = p.mood = p.cleanliness = getPetStatCap(p); p.energy = getPetEnergyCap(p);
  p.inventory = { ...p.inventory, apple: 100, trail_mix: 100, dish_carrot_rice: 100, dish_valley_travel_bento: 100 };
  p = advanceExplorationBudget(p, T); p.community.expedition.loop!.available = 24;
  return p;
};
const depart = (p = ready(), food: Inventory = {}, autoFill = true, actor = 'official.furo') => startExpedition(p, ['valley'], {}, false, actor, actor === 'official.mint' ? 'mint' : 'Furo', 'idle', 8, T, { rations: { food, autoFill } });

try {
  for (const region of regionIds) for (const hours of [2, 4, 8]) {
    const p = ready(), q = quoteExpeditionRations(p, region, hours), profile = explorationTravel[region];
    assert.equal(q.reason, ''); assert.equal(q.minimum, profile.meals * hours / 2); assert.equal(q.maximum, q.minimum * 2);
    assert.equal(q.nutrition, profile.nutrition * hours / 2); assert.equal(q.purchased, q.minimum); assert.equal(q.coins, q.purchased * 28);
    assert.equal(q.chance, 3); assert.deepEqual(q.food, { trail_mix: q.purchased }); assert.deepEqual(q.used, {});
  }
  const draft = { food: { dish_carrot_rice: 14 }, autoFill: false }, snapshot = JSON.stringify(draft);
  assert.equal(quoteExpeditionRations(ready(), 'station', 8, draft).reason.includes('至少'), true);
  assert.equal(quoteExpeditionRations(ready(), 'valley', 8, draft).reason, '');
  assert.match(quoteExpeditionRations(ready(), 'valley', 2, draft).reason, /最多/);
  assert.equal(JSON.stringify(draft), snapshot, 'changing duration and destination leaves every selected food untouched');
  for (const food of [{ golden_apple: 12 }, { trail_mix: -1 }, { trail_mix: 1.5 }, { trail_mix: NaN }, { apple: 100 }]) {
    const p = ready(), result = depart(p, food);
    assert(!result.community.expedition.active); assert.deepEqual(result.inventory, p.inventory); assert.equal(result.coins, p.coins);
  }
  assert.match(quoteExpeditionRations(ready(), 'valley', 2, { food: { apple: 3 }, autoFill: false }).reason, /基础饱食/);
  assert.match(quoteExpeditionRations({ ...ready(), inventory: {} }, 'valley', 2, { food: { trail_mix: 3 }, autoFill: false }).reason, /库存/);
  assert.match(quoteExpeditionRations({ ...ready(), coins: 83 }, 'valley', 2).reason, /金币不足/);
  assert.match(getExpeditionStartReason({ ...ready(), health: 1 }, ['valley'], 'idle', 2, T), /健康不足/);

  const initial = depart(ready(), { apple: 3, dish_carrot_rice: 2, trail_mix: 1 }), trip = initial.community.expedition.active!;
  assert(trip.rationPlan); assert.equal(trip.rationSegments, undefined);
  const allocation = { ...trip, rationPlan: { ...trip.rationPlan, food: { apple: 3, dish_carrot_rice: 2, trail_mix: 1 } } };
  assert.deepEqual(getRemainingRations(allocation, T + 4 * H), { apple: 2, dish_carrot_rice: 1 });
  assert.deepEqual(getRemainingRations(allocation, T), allocation.rationPlan.food);
  assert.deepEqual(getRemainingRations(allocation, T - H), allocation.rationPlan.food);
  assert.deepEqual(getRemainingRations(allocation, T + 8 * H), {});
  assert.equal(count(getRemainingRations(allocation, T + 1)), 5, 'round the combined bag once, retaining mixed single servings');
  const reordered = { ...allocation, rationPlan: { ...allocation.rationPlan, food: { trail_mix: 1, dish_carrot_rice: 2, apple: 3 } } };
  assert.deepEqual(getRemainingRations(reordered, T + 4 * H), getRemainingRations(allocation, T + 4 * H));
  const sanitized = normalizeRationPlan({ version: 1, food: { golden_apple: 2, trail_mix: Infinity, apple: -4 }, chance: Infinity, discoveries: [{ roll: -1 }] }, 8);
  assert.deepEqual(sanitized.food, {}); assert.equal(sanitized.chance, 0); assert.equal(sanitized.discoveries[0].roll, 100);

  for (const elapsed of [0, 1, H / 2, H, 2 * H - 1, 2 * H, 2 * H + 1, 7.9 * H, 8 * H]) {
    const p = depart(ready(), { dish_carrot_rice: 2, trail_mix: 3 }), active = p.community.expedition.active!;
    const direct = returnExpedition(p, active.id, T + elapsed), receipt = direct.community.expedition.pending!;
    let chunked = p;
    for (let at = T + H / 4; at < T + elapsed; at += H / 4) chunked = read(advancePet(chunked, at), at);
    chunked = returnExpedition(chunked, active.id, T + elapsed);
    assert.deepEqual(chunked.community.expedition.pending, { ...receipt, journal: chunked.community.expedition.pending!.journal });
    // The existing lifecycle may skip a final sub-second tick; allow the cost of this 1ms boundary probe.
    stats(direct).forEach((n, i) => assert(Math.abs(n - stats(chunked)[i]) < 1e-5, `${elapsed / H}h ${itemStatKeys[i]}: single=${n}, chunked=${stats(chunked)[i]}`));
    assert.deepEqual(direct.inventory, p.inventory); assert.equal(direct.coins, p.coins);
    assert.equal(receipt.refundCoins, 0);
    assert.equal(count(receipt.rationReturn?.eaten ?? {}) + count(receipt.rationReturn?.shared ?? {}), count(getRemainingRations(active, T + elapsed)));
    assert.equal(finishExpedition(direct, 'return', T + elapsed), direct);
    const loaded = read(direct, T + elapsed); assert.deepEqual(loaded.community.expedition.pending!.rationReturn, receipt.rationReturn);
    const claimed = claimExpedition(loaded, active.id), again = claimExpedition(claimed, active.id);
    assert.deepEqual(stats(claimed), stats(loaded)); assert.deepEqual(stats(again), stats(claimed)); assert.equal(again.coins, claimed.coins);
    assert.deepEqual(read(claimed, T + elapsed).community.expedition.lastReceipt!.rationReturn, receipt.rationReturn);
  }

  // Recall uses the same eating result as a normal single feeding, with no extra warehouse deduction or rewards.
  for (const boosted of [false, true]) {
    let pet = ready();
    if (boosted) { pet.classicEndgame.projects.cooking.completedStages = 5; pet.partnerSchedule.skills.cooking = { ...pet.partnerSchedule.skills.cooking, level: 10, masterCompletions: 60 }; }
    pet = depart(pet, { dish_carrot_rice: 12 }, false);
    const active = pet.community.expedition.active!, cap = getPetStatCap(pet);
    pet = { ...pet, hunger: cap - 5, isOverfed: false, energy: 0, mood: 1, health: cap - 15, cleanliness: 10 };
    const result = eatReturningRations(pet, active, T), normal = useInventoryItem({ ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, active: undefined } } }, 'dish_carrot_rice', T);
    assert.deepEqual(stats(result.pet), stats(normal)); assert.deepEqual(result.summary.eaten, { dish_carrot_rice: 1 }); assert.deepEqual(result.summary.shared, { dish_carrot_rice: 11 });
    assert.deepEqual(result.pet.inventory, pet.inventory); assert.equal(result.pet.coins, pet.coins); assert.equal(result.pet.hearts, pet.hearts);
    const effect = getItemStatEffect(pet, getInventoryItem('dish_carrot_rice')!);
    assert.equal(result.pet.hunger, cap + (effect.hunger! - 5) * .6); assert(result.pet.isOverfed);
  }
  const full = depart(), active = full.community.expedition.active!, cap = getPetStatCap(full);
  for (const hunger of [cap, cap + 20, cap * .96]) {
    const result = eatReturningRations({ ...full, hunger, isOverfed: true }, active, T);
    assert.equal(count(result.summary.eaten), 0); assert.equal(count(result.summary.shared), 12); assert.equal(result.pet.hunger, hunger);
    assert.match(rationReturnLines(result.summary).join(''), /分给了路过的邻居 mint/);
  }
  assert.equal(count(eatReturningRations({ ...full, hunger: cap * .95, isOverfed: true }, active, T).summary.eaten), 1, 'feeding resumes at the normal digestion threshold');
  const mint = depart(ready(), {}, true, 'official.mint'), mintBack = returnExpedition(mint, mint.community.expedition.active!.id, T);
  assert.match(rationReturnLines(mintBack.community.expedition.pending!.rationReturn!).join(''), /路过的邻居 Furo/);
  assert(!/丢弃|作废|浪费/.test(mintBack.recentEvent));

  const frozen = prepareTimePause(initial, T + H), resumed = resumePetTime(read(frozen, T + 24 * H), T + 24 * H);
  assert.deepEqual(resumed.community.expedition.active!.rationPlan, frozen.community.expedition.active!.rationPlan);
  assert.deepEqual(getRemainingRations(resumed.community.expedition.active!, T + 24 * H), getRemainingRations(trip, T + H));
  const rolled = reconcilePetClock(advancePet(initial, T + 2 * H), T + H).pet;
  assert.deepEqual(getRemainingRations(rolled.community.expedition.active!, T + H), getRemainingRations(trip, T + 2 * H));

  // Paid legacy segments stay intact through import and retain the old refund contract.
  for (const elapsed of [0, 2 * H, 2 * H + 1, 4 * H]) {
    const base = ready(), legacy = depart(base), active = legacy.community.expedition.active!;
    const quotes = [{ trail_mix: 1 }, { dish_carrot_rice: 3 }, {}, { trail_mix: 2 }].map(food => quoteExpeditionRations(base, 'valley', 2, { food, autoFill: true }));
    delete active.rationPlan;
    active.rationSegments = lockRationSegments(quotes.map(q => ({ food: q.used, purchased: q.purchased, price: q.coins, count: q.count, hunger: q.hunger, score: q.score, chance: q.chance, reason: q.reason })), 'legacy');
    legacy.coins = base.coins - quotes.reduce((sum, q) => sum + q.coins, 0);
    legacy.inventory = quotes.reduce((stock, q) => Object.entries(q.used).reduce((s, [id, n]) => removeInventoryItem(s, id, n), stock), base.inventory);
    const back = returnExpedition(read(legacy), active.id, T + elapsed), receipt = back.community.expedition.pending!;
    const opened = Math.max(1, Math.ceil(elapsed / (2 * H)));
    assert.equal(receipt.refundCoins, quotes.slice(opened).reduce((sum, q) => sum + q.coins, 0));
    assert.equal(receipt.items.dish_carrot_rice ?? 0, opened === 1 ? 3 : 0);
    assert.equal(receipt.rationReturn, undefined);
    assert.equal(read(back, T + elapsed).community.expedition.pending!.refundCoins, receipt.refundCoins);
  }
  console.log('Idle rations: total provisioning, proportional leftovers, normal eating, neighbors, exactly-once settlement, save/clock and legacy refunds passed.');
} finally { Date.now = originalNow; }
