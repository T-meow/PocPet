import assert from 'node:assert/strict';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { advancePet } from '../src/core/petLifecycle';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { advanceAdventure, claimAdventureResult, getAdventureStartReason, returnFromAdventure } from '../src/core/adventure';
import { startAdventure, startExpedition } from './fixtures/legacy-exploration';
import { getAdventureSteps } from '../src/core/adventureData';
import { facilities, facilityIds, facilityStories, isWaterOpen, waterIds } from '../src/core/communityData';
import { buildCommunityFacility } from '../src/core/communityFacilities';
import { careCommunityCrop, discoverCommunityFinds, harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { communityUpgrades, getAnimalCapacity, getCommunityUpgradeLevel, getCommunityUpgradeQuote } from '../src/core/communityUpgradeData';
import { upgradeCommunityFacility } from '../src/core/communityUpgrades';
import { advanceCommunityAnimals, feedCommunityAnimal } from '../src/core/communityFarm';
import { actCommunityFishing, buildWaterBoardwalk, claimCommunityFish, startCommunityFishing } from '../src/core/communityFishing';
import { getMarketQuote, listCommunityGoods, setCommunityMarketOpen, upgradeCommunityMarket } from '../src/core/communityMarket';
import { chooseExpeditionStep, getExpeditionChoices, getExpeditionHarvestLeft } from '../src/core/expedition';
import { advanceExplorationBudget, spendExplorationHarvest } from '../src/core/explorationBudget';
import { acceptSpecialtyOrder, getSpecialtyCandidates } from '../src/core/communitySpecialtyOrders';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { getShopItem } from '../src/core/items';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { shiftPetRuntimeTimestamps } from '../src/core/gameClock';
import { valleyQuestIds, valleyQuests } from '../src/core/valleyQuests';
import { createCommunityTestPet } from './fixtures/community-pet';
import type { PetState } from '../src/core/petTypes';

// No preview helper or browser storage: these saves start with automatic unlocks off.
const T = new Date(2026, 8, 21, 10).getTime(), H = 3600000;
const reload = (pet: PetState, now = T) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const refill = (pet: PetState): PetState => ({ ...pet, hunger: getPetStatCap(pet), health: getPetStatCap(pet), mood: getPetStatCap(pet), energy: getPetEnergyCap(pet), isSleeping: false });
const fresh = () => ({ ...refill(createDefaultPet(T)), coins: 0, inventory: {} });
const ready = () => {
  const pet = createCommunityTestPet('projects', T);
  pet.coins = 30000;
  pet.inventory = { ...pet.inventory, community_wood: 200, community_stone: 200, bamboo_shoot: 20, wild_onion: 20,
    valley_mushroom: 20, hill_honey: 20, pine_resin: 20, sea_glass: 20, creek_aquamarine: 10, hill_sunstone: 10,
    forest_emerald: 10, tidal_pearl: 10, star_sapphire: 10, animal_feed: 30, carrot_seed: 10, creek_herb_seed: 10,
    field_watering_can: 2, nutrient_compost: 5, harvest_sickle: 2, fishing_float: 2, landing_net: 2 };
  pet.community.waterAccess = { forest_pool: { found: true, built: true }, coast_pier: { found: true, built: true } };
  return pet;
};
const finish = (pet: PetState, now = T) => {
  const returned = returnFromAdventure(pet, pet.adventure.active!.id, now);
  assert(returned.adventure.pending);
  return claimAdventureResult(returned, returned.adventure.pending.id);
};

// Actual tutorial completion grants the field only at settlement, with no construction fee.
let novice: PetState = startAdventure(fresh(), 'tutorial', 'official.furo', 'Furo', {}, false, T);
assert(novice.adventure.active && !novice.community.gardenBuilt);
for (const step of getAdventureSteps(7, 'tutorial')) {
  const trip = novice.adventure.active!;
  novice = advanceAdventure(novice, trip.id, trip.choices.length, step.choices[0].id, T);
  assert(!novice.community.gardenBuilt);
}
novice = returnFromAdventure(novice, novice.adventure.active!.id, T);
const tutorial = novice.adventure.pending!, coinsBefore = novice.coins;
assert(!novice.community.gardenBuilt);
novice = claimAdventureResult(novice, tutorial.id);
assert(novice.community.gardenBuilt && novice.community.plots.length === 1);
assert.equal(novice.coins, coinsBefore + tutorial.coins);
assert.equal(getPetEnergyCap(novice), 107);
assert.equal(claimAdventureResult(novice, tutorial.id), novice);
assert.equal(normalizePet({ ...novice, community: { ...novice.community, schemaVersion: 6, gardenBuilt: false } }, T).community.gardenBuilt, true);
assert.equal(normalizePet(fresh(), T).community.gardenBuilt, false);

// Each construction gate uses the actual valley story. Old discovery and work flags do not qualify.
let campaign: PetState = { ...refill(novice), coins: 10000, inventory: { community_wood: 100, community_stone: 100 } };
for (const id of facilityIds) {
  const legacy = structuredClone(campaign);
  legacy.community.facilities[id] = { found: true, work: 2, built: false };
  assert.equal(buildCommunityFacility(legacy, id, T), legacy, id);
  assert(getAdventureStartReason(campaign, 'valley', T, id));
}
assert(getAdventureStartReason(campaign, 'valley', T, 'irrigation'));
campaign = startAdventure(campaign, 'valley', 'official.furo', 'Furo', {}, false, T);
for (const step of getAdventureSteps(7, 'valley')) {
  const trip = campaign.adventure.active!;
  const choice = step.choices.find(choice => !choice.tool && !choice.item)!;
  campaign = advanceAdventure(campaign, trip.id, trip.choices.length, choice.id, T);
  assert.equal(campaign.adventure.active?.choices.length, trip.choices.length + 1, campaign.recentEvent);
}
campaign = finish(campaign);
assert(facilityIds.every(id => !campaign.community.facilities[id].found), 'ordinary scouting cannot discover facilities');
for (const quest of valleyQuestIds) {
  campaign = startAdventure(refill(campaign), 'valley', 'official.furo', 'Furo', {}, false, T, quest);
  assert(campaign.adventure.active, `${quest}: ${campaign.recentEvent}`);
  for (const step of valleyQuests[quest].steps) {
    const trip = campaign.adventure.active!;
    campaign = advanceAdventure(campaign, trip.id, trip.choices.length, step.choices[0].id, T);
  }
  campaign = finish(campaign);
  for (const id of facilityIds.filter(id => facilityStories[id].id === quest)) {
    const c = facilities[id], before = campaign;
    const missing = { ...campaign, inventory: { ...campaign.inventory, community_stone: c.stone - 1 } };
    const blocked = buildCommunityFacility(missing, id, T);
    assert.equal(blocked.coins, missing.coins); assert.deepEqual(blocked.inventory, missing.inventory);
    campaign = buildCommunityFacility(campaign, id, T);
    assert(campaign.community.facilities[id].built, id);
    assert.equal(campaign.coins, before.coins - c.coins);
    assert.equal(campaign.inventory.community_wood, before.inventory.community_wood - c.wood);
    assert.equal(campaign.inventory.community_stone, before.inventory.community_stone - c.stone);
    assert.equal(buildCommunityFacility(campaign, id, T), campaign);
  }
}
for (const id of ['coop', 'barn', 'upstream', 'stall'] as const) {
  const blocked = structuredClone(campaign);
  blocked.community.facilities[id].built = false;
  blocked.community.gardenBuilt = false;
  blocked.community.facilities.coop.built = false;
  blocked.community.facilities.fishing_hut.built = false;
  assert.equal(buildCommunityFacility(blocked, id, T), blocked, 'construction prerequisites remain required');
}
let hills = structuredClone(campaign);
hills.community.facilities.upstream = { found: false, work: 0, built: false };
hills = startExpedition(refill(hills), ['hills'], {}, false, 'official.furo', 'Furo', 'manual', 1, T);
for (let i = 0; i < 6; i++) { const trip = hills.community.expedition.active!, choice = getExpeditionChoices(hills, T)[0]; hills = chooseExpeditionStep(refill(hills), trip.id, trip.revision, choice.id, T); }
assert(!hills.community.facilities.upstream.found, 'hills story does not discover upstream');
for (const water of ['forest_pool', 'coast_pier'] as const) {
  const pet = ready(), region = water === 'forest_pool' ? 'forest' : 'coast';
  pet.community.waterAccess[water].built = false;
  pet.community.expedition.regions[region].surveyed = false;
  assert.equal(buildWaterBoardwalk(pet, water), pet);
  pet.community.expedition.regions[region].surveyed = true;
  const built = buildWaterBoardwalk(pet, water);
  assert(isWaterOpen(built, water)); assert.equal(buildWaterBoardwalk(built, water), built);
}

// Seeds remain unsold, daily herb rewards cannot replay, and forest gathering spends one shared opportunity.
assert.equal(getShopItem('creek_herb_seed'), undefined); assert.equal(getShopItem('forest_berry_seed'), undefined);
const found = discoverCommunityFinds(ready(), T, 'seeds');
assert.equal(found.items.creek_herb_seed, 2);
assert.equal(discoverCommunityFinds(reload(found.pet), T, 'seeds').items.creek_herb_seed, undefined);
assert.equal(discoverCommunityFinds(found.pet, T + 24 * H, 'seeds').items.creek_herb_seed, 2);
assert.equal(valleyQuests.valley_gather.items.creek_herb_seed, 2);
let forest = startExpedition(ready(), ['forest'], {}, false, 'official.furo', 'Furo', 'manual', 1, T);
forest = chooseExpeditionStep(forest, forest.community.expedition.active!.id, forest.community.expedition.active!.revision, 'travel', T);
const forestTrip = forest.community.expedition.active!, opportunities = getExpeditionHarvestLeft(forest, 'forest', T);
forest = chooseExpeditionStep(forest, forestTrip.id, forestTrip.revision, 'observe', T);
assert.equal(forest.community.expedition.active!.bag.forest_berry_seed, 2);
assert.equal(getExpeditionHarvestLeft(forest, 'forest', T), opportunities - 1);
assert.deepEqual(chooseExpeditionStep(forest, forestTrip.id, forestTrip.revision, 'observe', T), forest);
let exhausted = advanceExplorationBudget(ready(), T);
exhausted = spendExplorationHarvest(exhausted, exhausted.community.expedition.loop!.available, T);
exhausted = startExpedition(exhausted, ['forest'], {}, false, 'official.furo', 'Furo', 'manual', 1, T);
assert.equal(getExpeditionChoices(exhausted, T).find(c => c.id === 'observe')?.finds.forest_berry_seed, undefined);

// Every upgrade: exact costs, regional gate, missing-one-item atomicity, sequential levels and duplicate requests.
for (const id of Object.keys(communityUpgrades) as (keyof typeof communityUpgrades)[]) {
  let pet = ready();
  for (const task of communityUpgrades[id]) {
    const level = getCommunityUpgradeLevel(pet, id), quote = getCommunityUpgradeQuote(pet, id, level);
    assert(quote.ready && quote.task === task);
    const gated = structuredClone(pet); gated.community.expedition.regions[task.region].surveyed = false;
    assert(!getCommunityUpgradeQuote(gated, id).ready);
    assert.equal(upgradeCommunityFacility(gated, id, level, T), gated);
    if (task.water) {
      const locked = structuredClone(pet);
      if (task.water === 'upstream') locked.community.facilities.upstream.built = false;
      else locked.community.waterAccess[task.water].built = false;
      assert.equal(upgradeCommunityFacility(locked, id, level, T), locked);
    }
    for (const [item, quantity] of Object.entries(task.items)) {
      const missing = { ...pet, inventory: { ...pet.inventory, [item]: quantity - 1 } };
      assert.equal(upgradeCommunityFacility(missing, id, level, T), missing, `${id}: missing ${item}`);
    }
    const poor = { ...pet, coins: task.coins - 1 };
    assert.equal(upgradeCommunityFacility(poor, id, level, T), poor);
    assert.equal(upgradeCommunityFacility(pet, id, level + 1, T), pet);
    const before = pet;
    pet = upgradeCommunityFacility(pet, id, level, T);
    assert.equal(getCommunityUpgradeLevel(pet, id), level + 1);
    assert.equal(pet.coins, before.coins - task.coins);
    for (const [item, quantity] of Object.entries(task.items)) assert.equal(pet.inventory[item], before.inventory[item] - quantity);
    assert.deepEqual(pet.community.acceptedToday, before.community.acceptedToday);
    assert.equal(upgradeCommunityFacility(pet, id, level, T), pet);
    assert.equal(getCommunityUpgradeLevel(reload(pet), id), level + 1);
  }
  assert.equal(upgradeCommunityFacility(pet, id, getCommunityUpgradeLevel(pet, id), T), pet);
}

// Independent same/different crops, selected-plot actions, full inventory, offline, save and all-plot timer shifts.
let crops = upgradeCommunityFacility(upgradeCommunityFacility(ready(), 'garden', 1, T), 'garden', 2, T);
crops = plantCommunityCrop(plantCommunityCrop(plantCommunityCrop(crops, 1, 'herb', T), 2, 'herb', T), 3, 'carrot', T);
assert(crops.community.plots.every(p => p.crop));
assert.equal(plantCommunityCrop(crops, 4, 'herb', T), crops);
crops = careCommunityCrop(crops, 2, T, 'water', T);
crops = careCommunityCrop(crops, 3, T, 'fertilize', T);
assert(!crops.community.plots[0].crop!.watered && crops.community.plots[1].crop!.watered);
assert(!crops.community.plots[1].crop!.fertilized && crops.community.plots[2].crop!.fertilized);
assert.equal(careCommunityCrop(crops, 2, T, 'water', T), crops);
assert.deepEqual(reload(crops).community.plots, crops.community.plots);
const frozen = prepareTimePause(crops, T), later = T + 100 * 24 * H;
assert.equal(upgradeCommunityFacility(frozen, 'coop', 1, later), frozen);
assert.equal(harvestCommunityCrop(frozen, 1, T, later), frozen);
const resumed = resumePetTime(reload(frozen, later), later), shifted = shiftPetRuntimeTimestamps(crops, -H, true);
for (let i = 0; i < 3; i++) {
  assert.equal(resumed.community.plots[i].crop!.readyAt - crops.community.plots[i].crop!.readyAt, later - T);
  assert.equal(shifted.community.plots[i].crop!.readyAt, crops.community.plots[i].crop!.readyAt - H);
}
const fullCrop = { ...crops, inventory: { ...crops.inventory, carrot: 9999 } };
assert.deepEqual(harvestCommunityCrop(fullCrop, 3, T, T + 6 * H, true).community, fullCrop.community);
crops = reload(advancePet(crops, T + 6 * H), T + 6 * H);
const firstPlot = crops.community.plots[0], thirdYield = crops.inventory.carrot ?? 0;
crops = harvestCommunityCrop(crops, 3, T, T + 6 * H);
assert.equal(crops.inventory.carrot, thirdYield + 4);
assert.deepEqual(crops.community.plots[0], firstPlot);
assert.equal(harvestCommunityCrop(crops, 3, T, T + 6 * H), crops);
crops = harvestCommunityCrop(harvestCommunityCrop(crops, 2, T, T + 6 * H), 1, T, T + 6 * H);
assert(crops.community.plots.every(p => !p.crop));

// Animal capacities, split/offline equality and full-store expansion restart at upgrade time.
for (const id of ['coop', 'barn'] as const) {
  for (let level = 1; level <= 3; level++) {
    let pet = ready(); pet.community.upgrades[id] = level;
    const cap = getAnimalCapacity(pet.community, id), period = pet.community.animals[id].cycleMs;
    assert.deepEqual(cap, { feed: [3, 5, 8][level - 1], stock: [6, 10, 16][level - 1] });
    pet = feedCommunityAnimal(pet, id, 0, cap.feed, T);
    assert.equal(feedCommunityAnimal(pet, id, pet.community.animals[id].revision, 1, T), pet);
    let split = pet;
    for (let n = 1; n <= 10; n++) split = advanceCommunityAnimals(split, T + n * period);
    const offline = advanceCommunityAnimals(pet, T + 10 * period);
    assert.deepEqual(split.community.animals[id], offline.community.animals[id]);
    assert.equal(offline.community.animals[id].stock, cap.stock);
    assert.deepEqual(reload(offline, T + 10 * period).community.animals[id], JSON.parse(JSON.stringify(offline.community.animals[id])));
  }
  let pet = ready(), period = pet.community.animals[id].cycleMs;
  pet.community.animals[id] = { ...pet.community.animals[id], stock: 4, feed: 3, nextAt: T + period, cared: true };
  pet = upgradeCommunityFacility(pet, id, 1, T + 10 * period);
  assert.equal(pet.community.animals[id].stock, 6);
  assert.equal(pet.community.animals[id].feed, 2);
  assert.equal(pet.community.animals[id].nextAt, T + 11 * period);
  assert.equal(advanceCommunityAnimals(pet, T + 10 * period).community.animals[id].stock, 6);
  assert.equal(advanceCommunityAnimals(pet, T + 11 * period).community.animals[id].stock, 8);
  let running = ready(); running.community.animals[id] = { ...running.community.animals[id], feed: 1, nextAt: T + period, cared: true };
  running = upgradeCommunityFacility(running, id, 1, T + H);
  assert.equal(running.community.animals[id].nextAt, T + period); assert(running.community.animals[id].cared);
}

// Historical market prices and its active visit clock survive new upgrade costs.
let market = listCommunityGoods(ready(), 'egg', 2, 1, T);
market = setCommunityMarketOpen(market, true, T);
const oldMarket = structuredClone(market.community.market), oldQuote = getMarketQuote(market, 'egg')!;
market = upgradeCommunityFacility(market, 'stall', 1, T);
assert.deepEqual(market.community.market.listings, oldMarket.listings);
assert.equal(market.community.market.nextVisitAt, oldMarket.nextVisitAt);
assert.equal(market.community.market.lastVisitAt, oldMarket.lastVisitAt);
assert.equal(getMarketQuote(market, 'egg')!.bonus, oldQuote.bonus + 5);
assert.equal(upgradeCommunityMarket(market, 1, T), market);

// All five hut levels, every open water and both rod/gear combinations. Exactly one fish per success.
const energy = [3, 3, 2, 2, 1], hunger = [2, 1, 1, 1, 1];
for (let level = 1; level <= 5; level++) {
  const base = ready(); base.community.upgrades.fishing_hut = level;
  const cast = startCommunityFishing(base, 'pond', 'fishing_bait', false, T);
  assert.equal(cast.community.fishing.active!.biteAt - T, (9 - level) * 1000);
  assert.equal(cast.community.toolWear.fishing_float, undefined); assert.equal(cast.community.toolWear.landing_net, undefined);
}
for (let level = 1; level <= 5; level++) for (const water of waterIds) for (const strong of [false, true]) {
  let pet = ready(); pet.community.upgrades.fishing_hut = level;
  assert(isWaterOpen(pet, water));
  const before = pet;
  pet = startCommunityFishing(pet, water, 'fishing_bait', strong, T, { float: true, net: true });
  const session = pet.community.fishing.active!;
  assert(session); assert.equal(session.hutLevel, level);
  assert.equal(before.energy - pet.energy, energy[level - 1]); assert.equal(before.hunger - pet.hunger, hunger[level - 1]);
  assert.equal(session.biteAt - T, (9 - level) * 1000);
  assert.equal(session.requiredClicks, strong ? 2 : 3);
  for (const tool of [strong ? 'reinforced_rod' : 'fishing_rod', 'landing_net'] as const) assert.equal(pet.community.toolWear[tool], 1);
  pet = reload(pet);
  pet.community.upgrades.fishing_hut = 5; // The in-flight snapshot stays authoritative even when the saved hut level changes.
  pet = actCommunityFishing(pet, session.id, 0, 'hook', session.biteAt);
  pet = actCommunityFishing(pet, session.id, 1, 'reel', session.biteAt + 600);
  assert.equal(pet.community.fishing.active!.clicks, 1);
  let at = session.biteAt + 600;
  while (pet.community.fishing.active) {
    const s = pet.community.fishing.active; at += 600;
    pet = actCommunityFishing(pet, s.id, s.revision, 'reel', at);
  }
  const pending = pet.community.fishing.pending!; assert(pending);
  const caughtFish = pending.catches[0].fish, count = pet.inventory[caughtFish] ?? 0;
  pet = claimCommunityFish(pet, pending.id);
  assert.equal(pet.inventory[caughtFish], count + 1);
  assert.equal(claimCommunityFish(pet, pending.id), pet);
}

// V6/V7 migrations preserve the single crop, built facilities, market, animals and unrelated loop/order state.
for (const version of [6, 7]) {
  let legacy = advanceExplorationBudget(ready(), T);
  legacy = spendExplorationHarvest(legacy, 3, T);
  legacy = acceptSpecialtyOrder(legacy, getSpecialtyCandidates(legacy, T)[0].id, T);
  legacy.community.market.level = 3;
  legacy.community.animals.coop = { feed: 3, stock: 4, nextAt: T + H, cycleMs: 6 * H, cared: true, revision: 8 };
  legacy = startCommunityFishing(legacy, 'pond', 'fishing_bait', true, T);
  const raw = JSON.parse(JSON.stringify(legacy));
  raw.community.schemaVersion = version;
  raw.community.crop = { id: 'herb', plantedAt: T - H, readyAt: T + H, watered: true, fertilized: true };
  delete raw.community.plots; delete raw.community.upgrades; delete raw.community.fishing.active.hutLevel;
  const migrated = normalizePet(raw, T);
  assert.equal(migrated.community.schemaVersion, 10);
  assert.deepEqual(migrated.community.plots, [{ id: 1, crop: raw.community.crop }]);
  assert.equal(migrated.community.fishing.active!.hutLevel, 1);
  assert.deepEqual(migrated.community.facilities, legacy.community.facilities);
  assert.deepEqual(migrated.community.market, legacy.community.market);
  assert.deepEqual(migrated.community.animals, legacy.community.animals);
  assert.deepEqual(migrated.community.specialtyOrders, legacy.community.specialtyOrders);
  assert.deepEqual(migrated.community.expedition.loop, legacy.community.expedition.loop);
  assert.deepEqual(migrated.inventory, legacy.inventory);
  assert.deepEqual(reload(migrated).community, migrated.community);
}
console.log('Farm progression passed: fresh tutorial, all story/build gates, seeds/budgets, every upgrade/cost/duplicate, three independent plots, offline/full-store animals, historical market, 40 fishing combinations, V6/V7 saves and full timer freeze.');

// Structural rendering only; desktop and narrow-screen appearance remain human-reviewed.
const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const [{ CommunityField }, { CommunityUpgradeTask }, { CommunityFacilities }] = await Promise.all([
    server.ssrLoadModule('/src/ui/community/CommunityField.tsx'), server.ssrLoadModule('/src/ui/community/CommunityUpgradeTask.tsx'), server.ssrLoadModule('/src/ui/community/CommunityFacilities.tsx'),
  ]);
  const noop = () => {}, props = { pet: ready(), update: noop, onExplore: noop, onShop: noop, onKitchen: noop, onAdventure: noop };
  for (const id of Object.keys(communityUpgrades) as (keyof typeof communityUpgrades)[]) {
    let pet = ready();
    for (const task of communityUpgrades[id]) {
      const html = renderToStaticMarkup(createElement(CommunityUpgradeTask, { ...props, pet, id }));
      assert(html.includes(task.name) && html.includes('不占每日委托名额') && html.includes('community-upgrade-materials'));
      assert(!/NaN|src="undefined"/.test(html));
      assert(!html.match(/<button[^>]*disabled/));
      const gated = structuredClone(pet); gated.community.expedition.regions[task.region].surveyed = false;
      assert(renderToStaticMarkup(createElement(CommunityUpgradeTask, { ...props, pet: gated, id })).match(/<button[^>]*disabled/));
      pet = upgradeCommunityFacility(pet, id, getCommunityUpgradeLevel(pet, id), T);
    }
  }
  const field = renderToStaticMarkup(createElement(CommunityField, { ...props, pet: crops }));
  for (const id of [1, 2, 3]) assert(field.includes(`第 ${id} 块菜地`));
  assert.equal((field.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert(!field.includes('留种') && !field.includes('阀芯'));
  const locked = renderToStaticMarkup(createElement(CommunityFacilities, { ...props, pet: novice }));
  for (const story of Object.values(facilityStories)) assert(locked.includes(story.name));
  assert(!locked.includes('修复 0/2') && !locked.includes('定向搜寻'));
  console.log('Farm UI rendering passed: three numbered plots, all upgrade materials/regions, disabled gates and story-only construction.');
} finally { await server.close(); }
