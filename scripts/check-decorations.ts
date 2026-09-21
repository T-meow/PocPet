import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { communityDecorationIds, communityDecorations, regionalTreasureIds } from '../src/core/regionalTreasures';
import { decorationEffects, getDecorationLevel, getDecorationValue } from '../src/core/decorationEffects';
import { buildCommunityDecoration, getDecorationUpgradeQuote, upgradeCommunityDecoration } from '../src/core/communityDecorations';
import { getCommunityCandidates, acceptCommunityTask, claimCommunityTask, recordCommunityTaskEvent } from '../src/core/communityCommissions';
import { getSpecialtyCandidates, acceptSpecialtyOrder, claimSpecialtyOrder } from '../src/core/communitySpecialtyOrders';
import { plantCommunityCrop } from '../src/core/community';
import { advanceCommunityAnimals, feedCommunityAnimal } from '../src/core/communityFarm';
import { getMarketQuote, listCommunityGoods } from '../src/core/communityMarket';
import { getPurchasedSaleCeiling } from '../src/core/communityEconomy';
import { advanceExplorationBudget, earnExplorationPay, settleExplorationLoot, spendExplorationHarvest, commonLootMeanValue } from '../src/core/explorationBudget';
import { quoteExpeditionRations, getRationTreasureChance, normalizeRationPlan } from '../src/core/explorationRations';
import { chooseExpeditionStep, startExpedition, returnExpedition, claimExpedition, getExpeditionChoices } from '../src/core/expedition';
import { settleExpeditionTime } from '../src/core/expeditionReturn';
import { startAdventure, advanceAdventure } from '../src/core/adventure';
import { getAdventureSteps } from '../src/core/adventureData';
import { getPetStatCap, getPetEnergyCap } from '../src/core/petStats';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { normalizeCommunityState } from '../src/core/communityState';
import { prepareTimePause } from '../src/core/timePause';
import { adventureTreasureIds } from '../src/core/adventureItems';
import { regionIds } from '../src/core/expeditionData';
import type { Inventory, PetState } from '../src/core/petTypes';
import { startCommunityFishing, getFishingWaitMs, actCommunityFishing, claimCommunityFish } from '../src/core/communityFishing';

const T = new Date(2026, 8, 21, 10).getTime(), H = 3600000;
const originalNow = Date.now;
Date.now = () => T;
const refill = (p: PetState): PetState => ({ ...p, hunger: getPetStatCap(p), health: getPetStatCap(p), mood: getPetStatCap(p), energy: getPetEnergyCap(p), cleanliness: getPetStatCap(p) });
const ready = () => {
  let p = createCommunityTestPet('projects', T);
  p.level = 30; p.coins = 100000;
  p.inventory = { ...p.inventory, community_wood: 500, community_stone: 500, pine_resin: 100, sea_glass: 100, observatory_part: 100,
    coin_hoard: 100, valley_amber: 100, ancient_gold_bar: 100, carrot_seed: 20, animal_feed: 20, dish_valley_travel_bento: 100, trail_mix: 100,
    ...Object.fromEntries(regionalTreasureIds.map(id => [id, 100])) };
  p = advanceExplorationBudget(refill(p), T); p.community.expedition.loop!.available = 24;
  return p;
};
const reload = (p: PetState, at = T) => parseSaveFileText(createSaveFileText(p, null, at), at).pet;
const total = (items: Inventory) => Object.values(items).reduce((sum, n) => sum + n, 0);

try {
  for (const id of communityDecorationIds) {
    let p = ready();
    const before = structuredClone(p);
    p = buildCommunityDecoration(p, id, T);
    assert.equal(getDecorationLevel(p, id), 1); assert.equal(buildCommunityDecoration(p, id, T), p);
    for (const [item, n] of Object.entries(communityDecorations[id].items)) assert.equal(p.inventory[item], before.inventory[item] - n);
    const start = structuredClone(p);
    for (let level = 1; level < 10; level++) {
      const q = getDecorationUpgradeQuote(p, id); assert(q.ready, q.reason);
      assert.equal(q.items[decorationEffects[id].treasure] ?? 0, level >= 5 ? 1 : 0);
      const stale = p, next = upgradeCommunityDecoration(p, id, level, q.common, T);
      assert.equal(getDecorationLevel(next, id), level + 1);
      assert.equal(upgradeCommunityDecoration(next, id, level, q.common, T), next, 'stale double click cannot spend twice');
      assert.equal(stale.coins - next.coins, q.coins);
      assert(getDecorationValue(id, level + 1) > getDecorationValue(id, level));
      p = reload(next);
    }
    assert.equal(p.coins, start.coins - 22000);
    assert.equal(p.inventory.coin_hoard, start.inventory.coin_hoard - 22);
    assert.equal(p.inventory.community_wood, start.inventory.community_wood - 32);
    assert.equal(p.inventory.community_stone, start.inventory.community_stone - 32);
    assert.equal(p.inventory[decorationEffects[id].treasure], start.inventory[decorationEffects[id].treasure] - 5);
    assert.equal(getDecorationValue(id, 1), decorationEffects[id].values[0]);
    assert.equal(getDecorationValue(id, 5), decorationEffects[id].values[1]);
    assert.equal(getDecorationValue(id, 10), decorationEffects[id].values[2]);
    assert(!getDecorationUpgradeQuote(p, id).ready);
    assert.equal(upgradeCommunityDecoration(p, id, 10, undefined, T).coins, p.coins);
  }
  let mixed = buildCommunityDecoration(ready(), 'amber_lantern', T);
  mixed.community.decorationLevels.amber_lantern = 6;
  const selection = { coin_hoard: 1, valley_amber: 1, ancient_gold_bar: 1 };
  const upgraded = upgradeCommunityDecoration(mixed, 'amber_lantern', 6, selection, T);
  for (const id of adventureTreasureIds) assert.equal(upgraded.inventory[id], mixed.inventory[id] - 1);
  for (const bad of [{ coin_hoard: 4 }, { coin_hoard: 2 }, { coin_hoard: -1 }, { coin_hoard: 1.5 }, { apple: 3 }, { coin_hoard: NaN }]) {
    const result = upgradeCommunityDecoration(mixed, 'amber_lantern', 6, bad, T);
    assert.equal(result.coins, mixed.coins); assert.deepEqual(result.inventory, mixed.inventory);
  }
  for (const blocked of [{ ...mixed, coins: 0 }, { ...mixed, inventory: {} }, prepareTimePause(mixed, T)]) {
    const result = upgradeCommunityDecoration(blocked, 'amber_lantern', 6, selection, T);
    assert.equal(result.coins, blocked.coins); assert.deepEqual(result.inventory, blocked.inventory);
  }
  const legacy = normalizeCommunityState({ ...ready().community, decorations: ['amber_lantern'], decorationLevels: undefined });
  assert.equal(legacy.decorationLevels.amber_lantern, 1);
  const malformed = normalizeCommunityState({ ...legacy, decorationLevels: { amber_lantern: 200, star_dome: 10, fake: 10 } });
  assert.deepEqual(malformed.decorationLevels, { amber_lantern: 10 });

  const withLamp = buildCommunityDecoration(ready(), 'amber_lantern', T);
  const search = getCommunityCandidates(withLamp, T).find(q => q.template === 'search')!;
  let accepted = acceptCommunityTask(withLamp, search.id, T);
  assert.equal(accepted.community.commission!.rewardCoins, 42);
  accepted.community.decorationLevels = { ...accepted.community.decorationLevels, amber_lantern: 10 };
  accepted = reload(recordCommunityTaskEvent(accepted, 'search', T));
  assert.equal(claimCommunityTask(accepted, search.id).coins - accepted.coins, 42);
  delete accepted.community.commission!.rewardCoins;
  assert.equal(claimCommunityTask(accepted, search.id).coins - accepted.coins, 40, 'old orders retain their original pay');
  let specialty = acceptSpecialtyOrder(withLamp, getSpecialtyCandidates(withLamp, T)[0].id, T);
  const order = specialty.community.specialtyOrders.active!, reward = Math.floor(order.quantity * order.unitPrice * 1.05);
  specialty.inventory[order.item] = order.quantity; specialty.community.decorationLevels.amber_lantern = 10;
  specialty = reload(specialty);
  assert.equal(claimSpecialtyOrder(specialty, order.id).coins - specialty.coins, reward);

  let plants = buildCommunityDecoration(ready(), 'creek_fountain', T);
  plants = plantCommunityCrop(plants, 1, 'carrot', T);
  assert.equal(plants.community.plots[0].crop!.readyAt, T + 4 * H * .95);
  const planted = plants.community.plots[0].crop;
  plants = upgradeCommunityDecoration(plants, 'creek_fountain', 1, undefined, T);
  assert.deepEqual(plants.community.plots[0].crop, planted);
  let ranch = ready(); ranch.community.upgrades.coop = 3;
  ranch = feedCommunityAnimal(ranch, 'coop', 0, 6, T);
  const deadline = ranch.community.animals.coop.nextAt!;
  ranch = buildCommunityDecoration(ranch, 'sun_weather_vane', T);
  assert.equal(ranch.community.animals.coop.nextAt, deadline);
  const firstCycle = advanceCommunityAnimals(ranch, deadline);
  assert.equal(firstCycle.community.animals.coop.stock, 2);
  assert.equal(firstCycle.community.animals.coop.nextAt, deadline + 6 * H * .95);
  assert.deepEqual(advanceCommunityAnimals(ranch, deadline + 12 * H).community.animals, advanceCommunityAnimals(reload(firstCycle, deadline), deadline + 12 * H).community.animals);

  for (const level of [1, 5, 10]) for (const hut of [1, 5]) {
    const angler = buildCommunityDecoration(ready(), 'pearl_lamp', T);
    angler.community.decorationLevels.pearl_lamp = level; angler.community.upgrades.fishing_hut = hut;
    const wait = Math.round((9 - hut) * 1000 * (1 - getDecorationValue('pearl_lamp', level) / 100));
    assert.equal(getFishingWaitMs(angler), wait);
    let cast = startCommunityFishing(angler, 'pond', 'fishing_bait', false, T);
    assert.equal(cast.community.fishing.active?.mode, 'manual');
    const session = cast.community.fishing.active!; assert(session.mode === 'manual');
    assert.equal(session.biteAt, T + wait);
    cast.community.decorationLevels = { ...cast.community.decorationLevels, pearl_lamp: 10 };
    cast = reload(cast);
    assert.equal(cast.community.fishing.active?.mode === 'manual' && cast.community.fishing.active.biteAt, session.biteAt);
    assert.equal(actCommunityFishing(cast, session.id, 0, 'hook', session.biteAt - 1), cast);
    cast = actCommunityFishing(cast, session.id, 0, 'hook', session.biteAt);
    for (let i = 1; i <= session.requiredClicks; i++) cast = actCommunityFishing(cast, session.id, i, 'reel', session.biteAt + i * 700);
    const caught = cast.community.fishing.pending!; assert(caught.items.pond_crucian);
    const claimed = claimCommunityFish(reload(cast), caught.id);
    assert.equal(claimCommunityFish(claimed, caught.id), claimed);
  }

  let merchant = ready(); merchant.inventory.ancient_gold_bar = 20;
  merchant = listCommunityGoods(merchant, 'ancient_gold_bar', 1, merchant.community.market.nextListingId, T);
  const oldPrice = merchant.community.market.listings[0].unitPrice;
  merchant = buildCommunityDecoration(merchant, 'golden_sign', T); merchant.community.decorationLevels.golden_sign = 10;
  assert.equal(getMarketQuote(merchant, 'ancient_gold_bar')!.price, Math.floor(oldPrice * 1.15));
  assert.equal(reload(merchant).community.market.listings[0].unitPrice, oldPrice);
  assert.equal(getMarketQuote(merchant, 'coin_hoard')!.price, 360);
  for (const item of ['dish_carrot_rice', 'dish_herb_porridge', 'dish_mushroom_rice', 'cheese', 'egg']) {
    const quoted = getMarketQuote(merchant, item), plain = getMarketQuote(ready(), item);
    if (quoted && plain) assert(quoted.price <= Math.max(plain.price, getPurchasedSaleCeiling(item)), item);
  }

  assert.equal(getRationTreasureChance(54 * 3, 3), 5);
  assert.equal(getRationTreasureChance(54 * 6, 3), 20);
  assert.equal(getRationTreasureChance(1, 3), 5);
  let dome = buildCommunityDecoration(ready(), 'star_dome', T); dome.community.decorationLevels.star_dome = 10;
  for (const region of regionIds) for (const hours of [2, 4, 8]) {
    const q = quoteExpeditionRations(dome, region, hours);
    assert.equal(q.baseChance, 5); assert.equal(q.decorationBonus, 6); assert.equal(q.chance, 11);
    const rich = quoteExpeditionRations(dome, region, hours, { food: { dish_valley_travel_bento: q.maximum }, autoFill: false });
    assert.equal(rich.baseChance, 20); assert.equal(rich.chance, 26);
    let trip = startExpedition(dome, [region], {}, false, 'test', 'Test', 'idle', hours, T);
    const plan = trip.community.expedition.active!.rationPlan;
    trip.community.decorationLevels.star_dome = 1;
    assert.deepEqual(reload(trip).community.expedition.active!.rationPlan, plan);
  }

  const mature = () => {
    let p = ready(); p.community.decorations = ['creek_fountain']; p.community.decorationLevels = { creek_fountain: 1 };
    p.community.expedition.regions.valley.base = 2;
    p.community.expedition.loop!.used = 80;
    p.community.expedition.loop!.vouchers = p.community.expedition.loop!.vouchers.map(v => ({ ...v, face: 600 }));
    return p;
  };
  let budget = mature();
  assert.equal(earnExplorationPay(budget, 'manual', T).coins, 450);
  const oldVouchers = structuredClone(budget);
  for (const v of oldVouchers.community.expedition.loop!.vouchers) delete v.rewardsVersion;
  assert.equal(earnExplorationPay(oldVouchers, 'manual', T).coins, 600);
  const oldTripPay = earnExplorationPay(budget, 'manual', T, 'valley', false);
  assert.equal(oldTripPay.coins, 600);
  assert.equal(oldTripPay.pet.community.expedition.loop!.vouchers[0].rewardsVersion, undefined);
  let expectedValue = 0;
  for (let i = 0; i < 8; i++) {
    budget = spendExplorationHarvest(budget, 1, T);
    const drop = settleExplorationLoot(budget, 1, 'hour', 'valley', T);
    expectedValue += 60; budget = drop.pet;
    assert(total(drop.finds) <= 1);
    const repeated = settleExplorationLoot(budget, 1, 'hour', 'valley', T);
    assert.deepEqual(repeated.finds, {}); assert.deepEqual(repeated.pet.community.expedition.loop, budget.community.expedition.loop);
  }
  assert.equal(expectedValue, 480); assert.equal(commonLootMeanValue, 1960 / 3);
  assert.deepEqual(budget.community.expedition.loop!.vouchers.map(v => v.lootUsed), [80, 80, 80, 80]);
  budget = settleExplorationLoot(spendExplorationHarvest(budget, 1, T), 1, 'manual', 'valley', T).pet;
  assert.equal(budget.community.expedition.loop!.vouchers[0].lootUsed, 100, 'manual action consumes only the remaining 20%');
  assert.deepEqual(reload(budget).community.expedition.loop, budget.community.expedition.loop);
  const oldConsumed = spendExplorationHarvest(oldVouchers, 1, T);
  assert.deepEqual(settleExplorationLoot(oldConsumed, 1, 'manual', 'valley', T).finds, {});
  const oldReceipt = ready(); oldReceipt.community.expedition.loop = undefined;
  oldReceipt.adventure.pending = { id: 'legacy-receipt', region: 'valley', actorId: 'test', actorName: 'Test', endedAt: T, steps: 6, complete: true, first: false, hearts: 22, coins: 300, items: { coin_hoard: 1 }, rewardsClaimed: false };
  const migratedReceipt = advanceExplorationBudget(oldReceipt, T);
  assert(migratedReceipt.community.expedition.loop!.vouchers.every(v => v.paid === 100 && v.lootUsed === 100));
  assert.deepEqual(migratedReceipt.adventure.pending, oldReceipt.adventure.pending);

  // Distribution uses the real deterministic resolver, including region scaling and empty outcomes.
  const counts: Inventory = {}, samples = 20000;
  let common = mature();
  for (let i = 0; i < samples; i++) {
    const trial = structuredClone(common), loop = trial.community.expedition.loop!;
    loop.used = i + 1; loop.vouchers.forEach(v => { v.lootUsed = 0; });
    const result = settleExplorationLoot(trial, 1, 'manual', 'valley', T, { community_wood: 2, creek_aquamarine: 1, forest_berry_seed: 2 }, 100);
    assert.equal(result.finds.community_wood, 1); assert.equal(result.finds.creek_aquamarine, undefined); assert.equal(result.finds.forest_berry_seed, undefined);
    for (const id of adventureTreasureIds) counts[id] = (counts[id] ?? 0) + (result.finds[id] ?? 0);
  }
  for (const id of adventureTreasureIds) assert(Math.abs(counts[id] / samples - (75 / commonLootMeanValue / 3)) < .007, `${id}: ${counts[id]}`);

  for (const region of regionIds) {
    let p = startExpedition(mature(), [region], {}, false, 'test', 'Test', 'idle', 8, T), id = p.community.expedition.active!.id;
    assert.equal(p.community.expedition.loop!.used, 80, 'reserving opportunities does not settle drops');
    const recalled = returnExpedition(p, id, T);
    assert.equal(recalled.community.expedition.loop!.used, 80);
    assert(recalled.community.expedition.loop!.vouchers.every(v => !v.lootUsed));
    const one = settleExpeditionTime(p, T + 8 * H);
    for (let hour = 1; hour <= 8; hour++) p = reload(settleExpeditionTime(p, T + hour * H), T + hour * H);
    assert.deepEqual(p.community.expedition.pending!.items, one.community.expedition.pending!.items);
    assert.equal(p.community.expedition.pending!.coins, one.community.expedition.pending!.coins);
    assert.deepEqual(p.community.expedition.loop, one.community.expedition.loop);
    const receipt = p.community.expedition.pending!, full = structuredClone(p);
    for (const item of Object.keys(receipt.items)) full.inventory[item] = 9999;
    const partial = claimExpedition(full, id, T + 8 * H);
    assert(partial.community.expedition.pending);
    assert.equal(claimExpedition(partial, id, T + 8 * H).coins, partial.coins);
    for (const item of Object.keys(receipt.items)) partial.inventory[item] = 0;
    assert.equal(claimExpedition(reload(partial, T + 8 * H), id, T + 8 * H).community.expedition.pending, undefined);
  }
  let oldIdle = startExpedition(mature(), ['valley'], {}, false, 'test', 'Test', 'idle', 8, T);
  delete oldIdle.community.expedition.active!.rewardsVersion;
  const savedPlan = oldIdle.community.expedition.active!.rationPlan!;
  oldIdle.community.expedition.active!.rationPlan = { ...savedPlan, version: 1, chance: 3, discoveries: savedPlan.discoveries.map(d => ({ ...d, roll: 0 })) };
  delete oldIdle.community.expedition.active!.rationPlan!.baseChance;
  delete oldIdle.community.expedition.active!.rationPlan!.decorationBonus;
  oldIdle.community.decorations = [...oldIdle.community.decorations, 'star_dome']; oldIdle.community.decorationLevels.star_dome = 10;
  oldIdle = settleExpeditionTime(reload(oldIdle), T + 8 * H);
  assert.equal(oldIdle.community.expedition.pending!.coins, 1920, 'old idle journeys retain the full cash contract');
  assert.equal(oldIdle.community.expedition.pending!.items.creek_aquamarine, 4);
  for (const id of adventureTreasureIds) assert.equal(oldIdle.community.expedition.pending!.items[id], undefined);
  assert(oldIdle.community.expedition.loop!.vouchers.every(v => v.paid === 80 && v.rewardsVersion === undefined));
  assert.equal(normalizeRationPlan({ ...savedPlan, version: 1, chance: 3 }, 8).chance, 3);
  assert.equal(normalizeRationPlan({ ...savedPlan, version: 2, chance: 26, baseChance: 20, decorationBonus: 6 }, 8).chance, 26);

  let double = mature(); double.inventory.prospector_pick = 1;
  double = startExpedition(double, ['valley'], {}, false, 'test', 'Test', 'manual', 1, T, { style: 'short', target: 'aquamarine' });
  const twice = double.community.expedition.active!;
  double = chooseExpeditionStep(double, twice.id, twice.revision, 'gather:2', T);
  assert.equal(double.community.expedition.loop!.used, 82);
  assert.equal(double.community.expedition.loop!.vouchers[0].lootUsed, 100, 'two actual opportunities allocate two half shares');
  assert.deepEqual(chooseExpeditionStep(double, twice.id, twice.revision, 'gather:2', T).community.expedition.loop, double.community.expedition.loop);
  for (const region of regionIds.filter(id => id !== 'valley')) {
    let p = startExpedition(mature(), [region], {}, false, 'test', 'Test', 'manual', 1, T);
    for (let i = 0; i < 4 && p.community.expedition.loop!.used === 80; i++) {
      p = refill(p); const t = p.community.expedition.active!, choices = getExpeditionChoices(p, T);
      const choice = choices.find(c => (c.harvest ?? 0) > 0 && !c.equipment) ?? choices.find(c => c.check?.mode === 'safe') ?? choices[0];
      p = chooseExpeditionStep(p, t.id, t.revision, choice.id, T);
    }
    assert.equal(p.community.expedition.loop!.used, 81, region);
    assert.equal(p.community.expedition.loop!.vouchers[0].lootUsed, 100, region);
  }
  for (const target of ['materials', 'aquamarine'] as const) {
    let p = startExpedition(mature(), ['valley'], {}, false, 'test', 'Test', 'manual', 1, T, { style: 'short', target });
    for (let step = 0; step < 2; step++) {
      p = refill(p); const t = p.community.expedition.active!, choice = getExpeditionChoices(p, T).find(c => (c.harvest ?? 0) > 0 && !c.equipment) ?? getExpeditionChoices(p, T).find(c => c.check?.mode === 'safe')!;
      p = chooseExpeditionStep(p, t.id, t.revision, choice.id, T);
    }
    assert(p.community.expedition.loop!.vouchers.some(v => v.lootUsed! > 0));
  }
  let adventure = startAdventure(mature(), 'valley', 'test', 'Test', {}, false, T);
  for (let i = 0; i < 4; i++) {
    adventure = refill(adventure); const t = adventure.adventure.active!, choices = getAdventureSteps(t.rulesVersion, t.region)[i].choices;
    const choice = choices.find(c => (c.harvest ?? 0) > 0 && !c.equipment) ?? choices.find(c => c.check?.mode === 'safe') ?? choices[0];
    adventure = advanceAdventure(adventure, t.id, i, choice.id, T, t.revision);
    assert.equal(adventure.adventure.active?.choices.length, i + 1, adventure.recentEvent);
  }
  assert(adventure.community.expedition.loop!.vouchers.some(v => v.lootUsed! > 0));
  console.log('Decorations passed: all 10 levels, costs, mixed materials, atomic spending, saved effects, orders, production, market limits, 5–26% rations, shared common loot, legacy vouchers, independent drops, recalls and partial claims.');
} finally { Date.now = originalNow; }
