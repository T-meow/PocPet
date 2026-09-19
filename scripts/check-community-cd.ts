import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { advancePet } from '../src/core/petLifecycle';
import { reconcilePetClock } from '../src/core/gameClock';
import { facilities } from '../src/core/communityData';
import { buildCommunityFacility, discoverCommunityFacility, workCommunityFacility } from '../src/core/communityFacilities';
import { advanceCommunityAnimals, careCommunityAnimal, collectCommunityAnimal, feedCommunityAnimal } from '../src/core/communityFarm';
import { actCommunityFishing, advanceCommunityFishing, cancelCommunityFishing, claimCommunityFish, startCommunityFishing } from '../src/core/communityFishing';
import { acceptCommunityTask, advanceCommunityBoard, canClaimCommunityTask, cancelCommunityTask, claimCommunityTask, commissionDefinitions, deliverCommunityParcel, getCommunityCandidates, getCommunityDay, getCommunityTasks } from '../src/core/communityCommissions';
import { advanceCommunityMarket, getCommunitySaleable, getMarketCapacity, getMarketQuote, listCommunityGoods, sellCommunityGuild, setCommunityMarketOpen, setCommunityReserve, unlistCommunityGoods, upgradeCommunityMarket } from '../src/core/communityMarket';
import { getCommunitySale } from '../src/core/communityEconomy';
import { normalizeCommunityState } from '../src/core/communityState';
import { startAdventure, advanceAdventure, returnFromAdventure, claimAdventureResult, getAdventureStartReason } from '../src/core/adventure';
import { canCraftRecipe, craftRecipe } from '../src/core/kitchen';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { getShopItem, createItemRegistry } from '../src/core/items';
import { getItemPurchaseQuote, buyItem, useInventoryItem } from '../src/core/petActions';
import type { CommissionTemplate, CommunityRoute, FacilityId, WaterId } from '../src/core/communityTypes';
import type { PetState } from '../src/core/petTypes';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const T = new Date(2026, 8, 18, 10).getTime(), H = 3600000;
const fresh = () => createCommunityTestPet('construction', T);
const ready = () => createCommunityTestPet('commissions', T);
const refill = (pet: PetState) => ({ ...pet, isSleeping: false, hunger: getPetStatCap(pet), health: getPetStatCap(pet), mood: getPetStatCap(pet), energy: getPetEnergyCap(pet) });
const roundTrip = (pet: PetState, now = T) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const search = (pet: PetState, purpose: CommunityRoute, now = T, bag = {}) => {
  pet = startAdventure(refill(pet), 'valley', 'official.furo', 'Furo', bag, false, now, purpose);
  for (const choice of ['search_path', 'search_bank', 'search_find']) {
    const trip = pet.adventure.active!;
    assert(trip, 'route is accessible');
    pet = advanceAdventure(pet, trip.id, trip.choices.length, choice, now);
  }
  return pet;
};
const returnTrip = (pet: PetState, now = T) => { const p = returnFromAdventure(pet, pet.adventure.active!.id, now); return claimAdventureResult(p, p.adventure.pending!.id); };

// C: two independent construction lines, actual exploration, work, cost and no replay.
let build = fresh();
build.community.gardenBuilt = false;
assert.equal(discoverCommunityFacility(build, 'coop'), build);
assert.equal(discoverCommunityFacility(build, 'barn'), build);
build = returnTrip(search(build, 'fishing_hut'));
assert(build.community.facilities.fishing_hut.found && !build.community.facilities.coop.found);
build = workCommunityFacility(build, 'fishing_hut', 0, T);
assert.equal(workCommunityFacility(build, 'fishing_hut', 0, T), build);
build = workCommunityFacility(build, 'fishing_hut', 1, T);
const beforeBuild = build.coins, beforeRod = build.inventory.fishing_rod ?? 0;
build = buildCommunityFacility(build, 'fishing_hut', T);
assert.equal(build.coins, beforeBuild - facilities.fishing_hut.coins);
assert.equal(build.inventory.fishing_rod, beforeRod + 1);
assert.equal(buildCommunityFacility(build, 'fishing_hut', T), build);
for (const id of ['upstream', 'stall', 'coop', 'barn'] as FacilityId[]) {
  if (id === 'coop') build.community.gardenBuilt = true;
  build = returnTrip(search(build, id));
  build = workCommunityFacility(build, id, 0, T);
  build = workCommunityFacility(build, id, 1, T);
  build = buildCommunityFacility(build, id, T);
  assert(build.community.facilities[id].built, id);
}
assert.equal(roundTrip(build).community.market.level, 1);
assert.deepEqual(roundTrip(build).community.facilities, build.community.facilities);

// Queued feed is finite; split and whole offline settlements produce identical states.
let farm = ready();
farm = feedCommunityAnimal(farm, 'coop', 0, 3, T);
assert.equal(farm.inventory.animal_feed, 9);
assert.equal(feedCommunityAnimal(farm, 'coop', 0, 3, T), farm);
let split = farm;
for (let i = 1; i <= 24; i++) split = advanceCommunityAnimals(split, T + i * H);
const whole = advanceCommunityAnimals(farm, T + 24 * H);
assert.deepEqual(split.community.animals, whole.community.animals);
assert.equal(whole.community.animals.coop.stock, 6); assert.equal(whole.community.animals.coop.feed, 0);
assert.deepEqual(advanceCommunityAnimals(whole, T + 10000 * H).community.animals, whole.community.animals);
let full = { ...whole, inventory: { ...whole.inventory, egg: 9999 } };
assert.equal(collectCommunityAnimal(full, 'coop', full.community.animals.coop.revision, T + 24 * H).community.animals.coop.stock, 6);
let resumed = feedCommunityAnimal(whole, 'coop', whole.community.animals.coop.revision, 1, T + 24 * H);
assert.equal(resumed.community.animals.coop.nextAt, undefined);
const revision = resumed.community.animals.coop.revision;
resumed = collectCommunityAnimal(resumed, 'coop', revision, T + 24 * H);
assert.equal(resumed.community.animals.coop.nextAt, T + 30 * H);
assert.equal(collectCommunityAnimal(resumed, 'coop', revision, T + 24 * H), resumed);
const care = careCommunityAnimal(resumed, 'coop', resumed.community.animals.coop.revision, T + 24 * H);
assert.equal(care.community.animals.coop.nextAt, T + 29.4 * H);
assert.equal(careCommunityAnimal(care, 'coop', care.community.animals.coop.revision, T + 24 * H), care);
assert.equal(roundTrip(care, T + 24 * H).community.animals.coop.cared, true);
const lifecycleFarm = advancePet(farm, T + 24 * H);
assert.equal(lifecycleFarm.community.animals.coop.stock, 6);

// Manual fishing: atomic bait/costs, early/duplicate actions, slack, failure, cancel,
// save/reload during a session, full warehouse and permanent journal after use/sale.
const catchFish = (pet: PetState, water: WaterId = 'pond', at = T) => {
  pet = startCommunityFishing(refill(pet), water, 'fishing_bait', false, at);
  assert(pet.community.fishing.active);
  const id = pet.community.fishing.active.id;
  assert.equal(actCommunityFishing(pet, id, 0, 'hook', at + 1000), pet);
  pet = actCommunityFishing(roundTrip(pet, at + 8000), id, 0, 'hook', at + 8000);
  let clock = at + 8000;
  while (pet.community.fishing.active) {
    const a = pet.community.fishing.active;
    clock += 1000;
    pet = actCommunityFishing(pet, id, a.revision, a.tension >= 60 ? 'slack' : 'reel', clock);
  }
  assert(pet.community.fishing.pending, 'manual sequence catches a fish');
  assert.equal(actCommunityFishing(pet, id, 0, 'reel', clock), pet);
  return pet;
};
const fishingStart = startCommunityFishing(ready(), 'pond', 'fishing_bait', false, T);
assert.equal(fishingStart.inventory.fishing_bait, 19); assert.equal(fishingStart.energy, ready().energy - 3);
assert(getAdventureStartReason(fishingStart, 'valley', T, 'commission').includes('鱼竿'));
assert(!canCraftRecipe(fishingStart, 'milk_custard', false, 1));
assert.equal(advanceCommunityFishing(fishingStart, T + H).community.fishing.pending, undefined);
assert.equal(advanceCommunityFishing(fishingStart, T + H).community.fishing.active, undefined);
assert.equal(Object.keys(advanceCommunityFishing(fishingStart, T + H).community.fishing.journal).length, 0);
const resumedFishing = loadStoredPetJson(createSaveFileText(fishingStart, null, T), T + 8000);
assert(resumedFishing.status === 'ok' && resumedFishing.pet.community.fishing.active?.id === fishingStart.community.fishing.active!.id, 'normal save reload preserves a live bite window');
const expiredFishing = loadStoredPetJson(createSaveFileText(fishingStart, null, T), T + H);
assert(expiredFishing.status === 'ok' && !expiredFishing.pet.community.fishing.active && !expiredFishing.pet.community.fishing.pending, 'offline reload never manufactures fish');
const cancelled = cancelCommunityFishing(fishingStart, fishingStart.community.fishing.active!.id);
assert.equal(cancelled.inventory.fishing_bait, 19); assert.equal(cancelCommunityFishing(cancelled, 'stale'), cancelled);
let failFish = actCommunityFishing(fishingStart, fishingStart.community.fishing.active!.id, 0, 'hook', T + 8000);
for (let i = 0; i < 3; i++) { const a = failFish.community.fishing.active!; failFish = actCommunityFishing(failFish, a.id, a.revision, 'reel', T + 9000 + 1000 * i); }
assert(!failFish.community.fishing.active && !failFish.community.fishing.pending);
let caught = catchFish(ready());
const basket = caught.community.fishing.pending!;
assert.equal(basket.fish, 'pond_crucian');
caught.inventory[basket.fish] = 9999;
assert(claimCommunityFish(caught, basket.id).community.fishing.pending);
caught.inventory[basket.fish] = 0;
caught = claimCommunityFish(roundTrip(caught), basket.id);
assert.equal(claimCommunityFish(caught, basket.id), caught);
caught = sellCommunityGuild(caught, basket.fish, 1, 1);
assert.equal(caught.community.fishing.journal[basket.fish]?.count, 1);
assert.equal(roundTrip(caught).community.fishing.journal[basket.fish]?.largest, basket.size);
const futureSave = JSON.parse(createSaveFileText(caught, null, T)); futureSave.pet.community.schemaVersion = 4;
assert.throws(() => parseSaveFileText(JSON.stringify(futureSave), T), UnsupportedSaveVersionError);
assert(!canCraftRecipe(fresh(), 'creek_fish_soup', false, 1));
for (const recipe of ['creek_fish_soup', 'carp_rice', 'river_grill', 'milk_custard'] as const) {
  const base = ready(), cooked = craftRecipe(base, recipe, false, 1, `cook:${recipe}`, T);
  assert.equal(cooked.inventory[`dish_${recipe}`], 1, recipe);
  assert.equal(craftRecipe(cooked, recipe, false, 1, `cook:${recipe}`, T), cooked);
}

// Daily offers use reachable unlocks. Candidate snapshots, 5 a.m., two active/two per
// day, cancellations, old tasks and actual new-action facts are independent.
for (let i = 0; i < 30; i++) {
  const p = createCommunityTestPet('community', T + i * 24 * H), offered = getCommunityCandidates(p, T + i * 24 * H);
  assert.equal(offered.length, 3);
  assert(offered.every(q => ['search', 'vegetables', 'delivery'].includes(q.template)));
}
const offerOn = (template: CommissionTemplate) => {
  for (let i = 0; i < 180; i++) { const now = T + i * 24 * H, p = ready(), q = getCommunityCandidates(p, now).find(q => q.template === template); if (q) return { pet: acceptCommunityTask(p, q.id, now), task: q, now }; }
  throw Error(`No candidate for ${template}`);
};
const fixedBoard = advanceCommunityBoard(createCommunityTestPet('community', T), T);
const fixedCandidates = getCommunityCandidates(fixedBoard, T);
fixedBoard.community.facilities = ready().community.facilities;
assert.deepEqual(getCommunityCandidates(fixedBoard, T), fixedCandidates, 'new unlocks do not reroll today\'s posted offers');
let q = ready(); const offers = getCommunityCandidates(q, T);
q = acceptCommunityTask(q, offers[0].id, T); q = acceptCommunityTask(q, offers[1].id, T);
assert.equal(acceptCommunityTask(q, offers[2].id, T), q);
q = cancelCommunityTask(q, offers[1].id);
assert.equal(acceptCommunityTask(q, offers[2].id, T), q);
const oldId = q.community.commission!.id;
q = returnTrip(search(roundTrip(q, T + 24 * H), 'commission', T + 24 * H), T + 24 * H);
q = claimCommunityTask(q, oldId);
assert.equal(claimCommunityTask(q, oldId), q);
const nextOffers = getCommunityCandidates(q, T + 24 * H);
q = acceptCommunityTask(q, nextOffers[0].id, T + 24 * H);
assert.equal(q.community.acceptedToday.length, 1);
assert.notEqual(getCommunityDay(q, new Date(2026, 8, 20, 4, 59).getTime()), getCommunityDay(q, new Date(2026, 8, 20, 5).getTime()));
for (const template of ['vegetables', 'eggs', 'milk', 'soup'] as CommissionTemplate[]) {
  const { pet, task } = offerOn(template), def = commissionDefinitions[template];
  const stock = { ...pet.inventory, ...def.take }; // isolate exactly one payment
  let order = { ...pet, inventory: stock };
  const baseCoins = order.coins;
  order = claimCommunityTask(order, task.id);
  assert.equal(order.coins, baseCoins + def.coins);
  for (const id of Object.keys(def.take!)) assert.equal(order.inventory[id] ?? 0, 0);
  assert.equal(claimCommunityTask(order, task.id), order);
}
const freshOrder = offerOn('fresh_porridge');
freshOrder.pet.inventory.dish_herb_porridge = 10;
assert(!canClaimCommunityTask(freshOrder.pet, getCommunityTasks(freshOrder.pet)[0]));
const freshCooked = craftRecipe(freshOrder.pet, 'herb_porridge', false, 1, 'new-order-cook', freshOrder.now);
assert(canClaimCommunityTask(freshCooked, getCommunityTasks(freshCooked)[0]));
const gather = offerOn('forage');
assert(!canClaimCommunityTask(gather.pet, getCommunityTasks(gather.pet)[0]));
const gathered = returnTrip(search(gather.pet, 'commission', gather.now), gather.now);
assert(canClaimCommunityTask(gathered, getCommunityTasks(gathered)[0]));
for (const template of ['fish_pond', 'fish_upstream'] as const) {
  const task = offerOn(template), p = catchFish(task.pet, template === 'fish_pond' ? 'pond' : 'upstream', task.now);
  assert(getCommunityTasks(p)[0].found);
}
const delivery = offerOn('delivery');
let parcel = search(delivery.pet, 'commission', delivery.now, { bento: 1 });
const trip = parcel.adventure.active!;
parcel = deliverCommunityParcel(parcel, delivery.task.id, trip.id, trip.revision, delivery.now);
assert.equal(parcel.adventure.active!.bag.bento ?? 0, 0); assert(getCommunityTasks(parcel)[0].found);
assert.equal(deliverCommunityParcel(parcel, delivery.task.id, trip.id, trip.revision, delivery.now), parcel);
const beforeParcelCoins = parcel.coins;
parcel = claimCommunityTask(returnTrip(parcel, delivery.now), delivery.task.id);
assert.equal(parcel.coins, beforeParcelCoins + 55);

// D: reservation, inventory transfer, frozen quotes, collector traffic, once-only
// checkout and exact equivalence between split and lumped offline time.
let market = setCommunityReserve(ready(), 'egg', 4);
assert.equal(getCommunitySaleable(market, 'egg'), 2);
assert.equal(listCommunityGoods(market, 'egg', 3, 1, T), market);
market = listCommunityGoods(market, 'egg', 2, 1, T);
assert.equal(listCommunityGoods(market, 'egg', 2, 1, T), market);
const quoteBefore = market.community.market.listings[0].unitPrice;
market.partnerSchedule.skills.study.level = 10;
market = upgradeCommunityMarket(market, 1, T);
market = upgradeCommunityMarket(market, 2, T);
assert.equal(getMarketCapacity(market), 12); assert.equal(getMarketQuote(market, 'egg')!.bonus, 40);
assert.equal(roundTrip(market).community.market.listings[0].unitPrice, quoteBefore);
market = listCommunityGoods(market, 'valley_amber', 1, market.community.market.nextListingId, T);
market = setCommunityMarketOpen(market, true, T);
let fragmented = market;
for (let minute = 15; minute <= 720; minute += 15) fragmented = advanceCommunityMarket(fragmented, T + minute * 60000);
const offline = advanceCommunityMarket(market, T + 12 * H);
assert.deepEqual(offline.community.market, fragmented.community.market);
assert.equal(offline.coins, fragmented.coins);
assert.equal(offline.community.market.sold, 3);
assert.equal(offline.community.market.listings.length, 0);
assert.equal(offline.hearts, market.hearts);
assert.equal(advanceCommunityMarket(offline, T + 12 * H), offline);
assert.equal(advanceCommunityMarket(market, T + 2.5 * H).community.market.listings[0].itemId, 'valley_amber');
assert.equal(advanceCommunityMarket(market, T + 3 * H).community.market.listings.length, 0);
const closed = setCommunityMarketOpen(market, false, T);
assert.equal(advanceCommunityMarket(closed, T + 24000 * H), closed);
const unlisted = unlistCommunityGoods(market, 1, T);
assert.equal(unlisted.inventory.egg, 6);
assert.equal(unlistCommunityGoods(unlisted, 1, T), unlisted);
const blocked = { ...market, inventory: { ...market.inventory, egg: 9999 } };
assert(unlistCommunityGoods(blocked, 1, T).community.market.listings.some(l => l.id === 1));
assert.equal(getCommunitySale('golden_apple'), undefined); assert.equal(getCommunitySale('creek_herb_seed'), undefined); assert.equal(getCommunitySale('custom:fish'), undefined);
assert.equal(getCommunitySale('coin_hoard')!.exchangeOnly, true);
const reservedTreasure = setCommunityReserve(ready(), 'valley_amber', 1);
assert.equal(useInventoryItem(reservedTreasure, 'valley_amber', T).inventory.valley_amber, 1);
const sold = sellCommunityGuild(ready(), 'egg', 2, 6);
assert.equal(sellCommunityGuild(sold, 'egg', 2, 6), sold);
assert.equal(sold.inventory.egg, 4);

// Module migration, invalid inputs, time rollback and gated shops.
const legacy = normalizeCommunityState({ schemaVersion: 1, gardenBuilt: true, herbDiscovered: true, boardDay: '2026-09-18', acceptedToday: ['search:2026-09-18'], commission: { id: 'search:2026-09-18', found: true, acceptedAt: T } });
assert.equal(legacy.schemaVersion, 3); assert(legacy.commission?.found); assert.equal(legacy.facilities.barn.built, false);
assert.equal(normalizePet({ ...createDefaultPet(T), community: undefined }, T).community.market.level, 0);
assert.equal(getItemPurchaseQuote(fresh(), 'river_bait', 1, T).canPurchase, false);
assert.equal(getItemPurchaseQuote(ready(), 'river_bait', 1, T).canPurchase, true);
assert.equal(buyItem(fresh(), 'reinforced_rod', T).inventory.reinforced_rod, fresh().inventory.reinforced_rod);
assert.equal(getShopItem('farm_milk'), undefined); assert.equal(getShopItem('pond_crucian'), undefined);
for (const n of [-1, NaN, Infinity, .5, 10000]) {
  const p = ready(); assert.equal(feedCommunityAnimal(p, 'coop', 0, n, T), p); assert.equal(sellCommunityGuild(p, 'egg', n, 6), p); assert.equal(listCommunityGoods(p, 'egg', n, 1, T), p);
}
let timed = feedCommunityAnimal(ready(), 'barn', 0, 2, T);
timed = listCommunityGoods(timed, 'egg', 2, 1, T); timed = setCommunityMarketOpen(timed, true, T);
timed.timeGuard.lastObservedAt = T; timed.lastUpdatedAt = T;
const rolled = reconcilePetClock(timed, T - H).pet;
assert.equal(rolled.community.animals.barn.nextAt, T + 7 * H);
assert.equal(rolled.community.market.lastVisitAt, T - H);
assert.equal(advanceCommunityAnimals(rolled, T - H).community.animals.barn.stock, 0);
assert.equal(advanceCommunityMarket(rolled, T - H).community.market.sold, 0);
assert.deepEqual(roundTrip(offline, T + 12 * H).community.market, offline.community.market);

// Economic separation: level/food trophies do not multiply prices or production;
// skill and stall changes only affect new quotes. Common bought inputs have no
// instant guild resale profit, including a conservative 50% purchase discount.
for (const level of [1, 20, 99]) {
  const p = ready(); p.level = level;
  assert.equal(getMarketQuote(p, 'egg')!.price, 4);
  for (const id of ['egg', 'rice', 'carrot', 'community_wood', 'community_stone'] as const) assert(getCommunitySale(id)!.base < getShopItem(id)!.price * .5);
  const after = advanceCommunityAnimals(feedCommunityAnimal(refill(p), 'barn', 0, 3, T), T + 48 * H);
  assert.equal(after.community.animals.barn.stock, 6);
  for (const tier of ['none', 'gold', 'diamond'] as const) {
    const boosted = ready(); boosted.level = level;
    if (tier !== 'none') boosted.classicEndgame.projects.cooking.completedStages = 5;
    if (tier === 'diamond') for (const project of Object.values(boosted.classicEndgame.projects)) project.completedStages = 5;
    boosted.partnerSchedule.skills.cooking.level = 10; boosted.partnerSchedule.skills.garden.level = 10; boosted.partnerSchedule.skills.study.level = 10;
    boosted.community.market.level = 3;
    assert.equal(getMarketQuote(boosted, 'egg')!.price, 5, 'food/garden trophies do not multiply sale prices');
    const produced = feedCommunityAnimal(refill(boosted), 'coop', 0, 3, T);
    assert.equal(produced.community.animals.coop.cycleMs, 6 * H * .92);
    assert.equal(advanceCommunityAnimals(produced, T + 48 * H).community.animals.coop.stock, 6, 'extra garden drop slots do not double animal output');
  }
}
const communityCss = postcss.parse(readFileSync('src/styles/community.css', 'utf8'));
communityCss.walkRules(rule => {
  for (const selector of rule.selectors) if (/\.community-(?:layout|card|header|note|actions|steps)(?![\w-])/.test(selector)) assert(selector.startsWith('.community-page ') || selector.startsWith('.adventure-page '), `style must not leak into the old community work page: ${selector}`);
});
console.log('C+D core checks passed: both construction lines, finite production, manual fishing and journal, all 10 quest templates, daily/stock atomicity, frozen sales and traffic, saves and rollback.');

const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { CommunityPage } = await server.ssrLoadModule('/src/ui/CommunityPage.tsx');
  const noop = () => {};
  for (const [tab, required] of [['village', '钓鱼小屋'], ['farm', 'data-place="coop"'], ['fishing', 'data-place="pond"'], ['board', '今日候选'], ['market', '工会回收']] as const) {
    const html = renderToStaticMarkup(createElement(CommunityPage, { pet: ready(), initialTab: tab, portrait: 'furo.png', update: noop, onBack: noop, onExplore: noop, onKitchen: noop, onShop: noop, onGarden: noop }));
    assert(html.includes(required), tab); assert(!/NaN|src="undefined"/.test(html), tab);
  }
  const { AdventurePage } = await server.ssrLoadModule('/src/ui/AdventurePage.tsx');
  const html = renderToStaticMarkup(createElement(AdventurePage, { pet: search(delivery.pet, 'commission', delivery.now, { bento: 1 }), actorId: 'official.furo', actorName: 'Furo', portrait: 'furo.png', happyPortrait: 'furo.png', registry: createItemRegistry(), icons: {}, update: noop, onBack: noop, onKitchen: noop, onBuy: noop, onUseHomeItem: noop }));
  assert(html.includes('将便当交给守望者'));
  console.log('C+D React rendering passed: construction, farm, fishing, board, market and real adventure delivery. Visual/touch review is manual.');
} finally { await server.close(); }
