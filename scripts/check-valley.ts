import assert from 'node:assert/strict';
import { advanceAdventure, claimAdventureResult, getAdventureChoiceReason, getAdventureStartReason, returnFromAdventure } from '../src/core/adventure';
import { startAdventure } from './fixtures/legacy-exploration';
import { getAdventureSteps } from '../src/core/adventureData';
import { chooseAdventureReturnItems, enforceAdventureHealth } from '../src/core/adventureReturn';
import { getAdventureNodeStatus } from '../src/core/adventureMap';
import { getAdventureBagCount, normalizeAdventureState } from '../src/core/adventureState';
import { deliverCommunityOrder, harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { acceptCommunityTask, claimCommunityTask, deliverCommunityParcel } from '../src/core/communityCommissions';
import { canCraftRecipe, craftRecipe } from '../src/core/kitchen';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { getValleyQuestReason, valleyQuestIds, valleyQuests, type ValleyQuestId } from '../src/core/valleyQuests';
import type { CommunityRoute } from '../src/core/communityTypes';
import type { Inventory, PetState } from '../src/core/petTypes';
import { createCommunityTestPet } from './fixtures/community-pet';

const T = new Date(2026, 8, 19, 10).getTime(), H = 3600000;
const fresh = (): PetState => {
  const p = createCommunityTestPet('community', T);
  return { ...p, inventory: { rice: 3, trail_rope: 1, bento: 1, apple: 1, berry_bait: 1 }, adventure: { ...p.adventure, completed: { tutorial: 1, valley: 1 }, lastCompletedDay: { valley: '2026-09-19' } } };
};
const rest = (p: PetState): PetState => ({ ...p, health: getPetStatCap(p), hunger: getPetStatCap(p), mood: getPetStatCap(p), energy: getPetEnergyCap(p) });
const reload = (p: PetState, at = T) => parseSaveFileText(createSaveFileText(p, null, at), at).pet;
const start = (p: PetState, purpose: CommunityRoute, bag: Inventory = {}, tool = false, at = T) => {
  const next = startAdventure(p, 'valley', 'official.furo', 'Furo', bag, tool, at, purpose);
  assert(next.adventure.active, next.recentEvent);
  return next;
};
const step = (p: PetState, id: string, at = T) => {
  const trip = p.adventure.active!;
  const next = advanceAdventure(p, trip.id, trip.choices.length, id, at);
  assert.equal(next.adventure.active?.choices.length, trip.choices.length + 1, next.recentEvent);
  assert.equal(advanceAdventure(next, trip.id, trip.choices.length, id, at), next, 'stale step cannot pay twice');
  return reload(next, at);
};
const finish = (p: PetState, at = T) => {
  const back = returnFromAdventure(p, p.adventure.active!.id, at);
  assert(back.adventure.pending, back.recentEvent);
  return reload(back, at);
};
const collect = (p: PetState, at = T) => {
  const back = finish(p, at), id = back.adventure.pending!.id;
  const next = reload(claimAdventureResult(back, id), at);
  assert(!next.adventure.pending);
  assert.equal(claimAdventureResult(next, id), next);
  return next;
};
const complete = (p: PetState, id: ValleyQuestId) => {
  p = start(rest(p), id);
  for (const event of valleyQuests[id].steps) p = step(p, event.choices[0].id);
  return collect(p);
};

// Existing players need no reset; new players must finish the entry once.
const baseline = fresh();
assert.equal(getAdventureStartReason(baseline, 'valley', T), '', 'repeat entry remains playable');
assert.equal(getValleyQuestReason(baseline.adventure, 'valley_gather'), '');
assert(getValleyQuestReason({ ...baseline.adventure, completed: { tutorial: 1 } }, 'valley_gather'));
assert.equal(getAdventureNodeStatus(baseline.adventure, 'valley', 'crossing', '2026-09-19'), 'locked');
assert.equal(startAdventure(baseline, 'valley', 'official.furo', 'Furo', {}, false, T, 'valley_camp').adventure.active, undefined);
assert.equal(startAdventure(baseline, 'tutorial', 'official.furo', 'Furo', {}, false, T, 'valley_gather'), baseline);
let early = step(start(baseline, 'valley_gather'), 'trace');
early = finish(early);
assert.equal(early.adventure.pending!.coins, 0);
assert(!early.adventure.valleyCompleted.includes('valley_gather'));
early = claimAdventureResult(early, early.adventure.pending!.id);
assert.equal(getValleyQuestReason(early.adventure, 'valley_gather'), '');

// Play every story without optional equipment, saving after each action and return.
let campaign = baseline;
const starts = new Map<ValleyQuestId, PetState>();
for (const id of valleyQuestIds) {
  starts.set(id, rest(campaign));
  const before = campaign;
  campaign = complete(campaign, id);
  assert(campaign.adventure.valleyCompleted.includes(id));
  assert.equal(campaign.coins, before.coins + valleyQuests[id].coins);
  assert.equal(campaign.hearts, before.hearts + valleyQuests[id].hearts);
  for (const [item, amount] of Object.entries(valleyQuests[id].items)) assert((campaign.inventory[item] ?? 0) >= (before.inventory[item] ?? 0) + amount, `${id} keeps ${item} through save/return`);
  assert.equal(campaign.adventure.completed.valley, 1, 'story does not increment daily entrance completion');
  assert.equal(campaign.adventure.lastCompletedDay.valley, '2026-09-19');
  assert.equal(getAdventureNodeStatus(campaign.adventure, 'valley', valleyQuests[id].node), 'complete');
  assert.equal(startAdventure(rest(campaign), 'valley', 'official.furo', 'Furo', {}, false, T + 24 * H, id).adventure.active, undefined, 'story cannot be farmed next day');
}
assert.equal(campaign.coins - baseline.coins, 225);
assert.equal(campaign.hearts - baseline.hearts, 25);
for (const facility of ['coop', 'barn', 'fishing_hut', 'upstream', 'stall'] as const) assert(campaign.community.facilities[facility].found);
assert(campaign.community.irrigationFound && campaign.community.herbDiscovered);
assert.equal(reload({ ...campaign, adventure: { ...campaign.adventure, journal: [] } }).adventure.valleyCompleted.length, 7, 'permanent progress is independent of recent journal');

// Every optional branch is viable; tools survive, gifts are spent without feeding.
for (const id of valleyQuestIds) {
  for (const [index, event] of valleyQuests[id].steps.entries()) {
    for (const option of event.choices.slice(1)) {
      const bag: Inventory = option.item ? { [option.item]: 1 } : {};
      let p = start(starts.get(id)!, id, bag, Boolean(option.tool));
      for (let n = 0; n < index; n++) p = step(p, valleyQuests[id].steps[n].choices[0].id);
      const hunger = p.hunger;
      p = step(p, option.id);
      assert.equal(p.hunger, hunger - Math.ceil(option.hunger * 1.5));
      if (option.item) assert.equal(p.adventure.active!.bag[option.item] ?? 0, 0);
      if (option.tool) assert(p.adventure.active!.tool);
      for (let n = index + 1; n < 3; n++) p = step(p, valleyQuests[id].steps[n].choices[0].id);
      p = collect(p);
      assert.equal(p.inventory.trail_rope, 1);
    }
  }
}
let sad = step(start(starts.get('valley_lookout')!, 'valley_lookout'), 'view');
sad = { ...sad, mood: 0 };
assert.equal(getAdventureChoiceReason(sad, valleyQuests.valley_lookout.steps[1].choices[0]), '');
assert(getAdventureChoiceReason(sad, valleyQuests.valley_lookout.steps[1].choices[1]));

// The tutorial opens the field; two story seeds sustain the herb/porridge loop.
let farmer = complete(complete(baseline, 'valley_gather'), 'valley_ridge');
farmer = rest(farmer);
assert(farmer.community.gardenBuilt);
farmer = plantCommunityCrop(farmer, 1, 'herb', T);
farmer = harvestCommunityCrop(reload(farmer, T + 6 * H), 1, T, T + 6 * H);
assert.equal(farmer.inventory.creek_herb_seed, 1);
assert.equal(farmer.inventory.creek_herb, 6, 'first story supplies two herbs before the first harvest');
assert(canCraftRecipe(farmer, 'herb_porridge', false, 1));
farmer = craftRecipe(farmer, 'herb_porridge', false, 1, 'valley-first-porridge', T + 6 * H);
farmer = deliverCommunityOrder(farmer);
assert(farmer.community.firstOrderDelivered);
assert.equal(deliverCommunityOrder(farmer), farmer);
assert(plantCommunityCrop(farmer, 1, 'herb', T + 6 * H).community.plots[0].crop, 'retained seed starts the next harvest');

// Full bag, forced return, full warehouse and partial claims preserve discoveries and pay once.
let full = start({ ...baseline, inventory: { trail_rope: 1, dish_carrot_rice: 24, creek_herb_seed: 9999 } }, 'valley_gather', { dish_carrot_rice: 24 }, true);
for (const event of valleyQuests.valley_gather.steps) full = step(full, event.choices[0].id);
assert.equal(full.adventure.active!.loot.creek_herb_seed, 2);
assert(full.adventure.valleyCompleted.includes('valley_gather'));
full = reload(enforceAdventureHealth({ ...full, health: 19 }, T));
const receiptId = full.adventure.pending!.id;
assert(full.adventure.pending!.complete && full.adventure.pending!.salvage);
assert.equal(chooseAdventureReturnItems(full, receiptId, { dish_carrot_rice: 24, creek_herb_seed: 1 }), full);
full = chooseAdventureReturnItems(full, receiptId, { dish_carrot_rice: 8, creek_herb_seed: 1, community_wood: 2, community_stone: 1 });
assert.equal(getAdventureBagCount(full.adventure.pending!.items), 13);
full = reload(claimAdventureResult(full, receiptId));
assert.equal(full.coins, baseline.coins + 20);
assert.deepEqual(full.adventure.pending!.items, { creek_herb_seed: 1 });
const paidCoins = full.coins, paidHearts = full.hearts;
full = reload(claimAdventureResult(full, receiptId));
assert.equal(full.coins, paidCoins); assert.equal(full.hearts, paidHearts);
full = claimAdventureResult({ ...full, inventory: { ...full.inventory, creek_herb_seed: 9998 } }, receiptId);
assert(!full.adventure.pending);
assert.equal(full.inventory.trail_rope, 1);
assert.equal(full.inventory.creek_herb_seed, 9999);
assert.equal(claimAdventureResult(full, receiptId), full);

// Delivery and search happen at the bridge, never at an unrelated story landmark.
let courier = { ...baseline, community: { ...baseline.community, boardDay: '2026-09-19', candidates: ['search', 'vegetables', 'delivery'] as PetState['community']['candidates'] } };
const deliveryId = 'delivery:2026-09-19', searchId = 'search:2026-09-19';
courier = acceptCommunityTask(acceptCommunityTask(courier, deliveryId, T), searchId, T);
courier = start(courier, 'valley_gather', { bento: 1 });
for (const event of valleyQuests.valley_gather.steps) courier = step(courier, event.choices[0].id);
let trip = courier.adventure.active!;
assert.equal(deliverCommunityParcel(courier, deliveryId, trip.id, trip.revision, T), courier);
assert.equal(courier.community.commission?.found, false);
courier = complete(collect(courier), 'valley_ridge');
courier = start(rest(courier), 'valley_crossing', { bento: 1 });
trip = courier.adventure.active!;
assert.equal(deliverCommunityParcel(courier, deliveryId, trip.id, trip.revision, T), courier);
courier = step(courier, 'meet');
trip = courier.adventure.active!;
const beforeDeliveryHunger = courier.hunger;
courier = deliverCommunityParcel(courier, deliveryId, trip.id, trip.revision, T);
assert.equal(courier.hunger, beforeDeliveryHunger);
assert.equal(courier.adventure.active!.bag.bento ?? 0, 0);
assert.equal(deliverCommunityParcel(courier, deliveryId, trip.id, trip.revision, T), courier);
courier = step(step(courier, 'bank'), 'letter');
assert(courier.community.commission?.found);
courier = collect(courier);
const beforePayment = courier.coins;
courier = claimCommunityTask(claimCommunityTask(courier, deliveryId), searchId);
assert.equal(courier.coins, beforePayment + 95);
assert.equal(claimCommunityTask(courier, deliveryId), courier);
// A new day's accepted task still has a stable short route after the chapter is done.
let repeat = acceptCommunityTask(rest(campaign), 'search:2026-09-20', T + 24 * H);
repeat = start(repeat, 'commission', {}, false, T + 24 * H);
for (const event of getAdventureSteps(5, 'valley', 'commission')) repeat = step(repeat, event.choices[0].id, T + 24 * H);
repeat = finish(repeat, T + 24 * H);
assert.equal(repeat.adventure.pending!.coins, 0);
assert.equal(repeat.adventure.pending!.hearts, 0);
assert(repeat.community.commission?.found);

// Version 4 migration preserves the old in-progress route, without inventing stories.
const oldTrip = start(baseline, 'seeds');
oldTrip.adventure.active!.purpose = 'irrigation'; // Old in-progress routes still load and finish.
const oldState = { ...oldTrip.adventure, schemaVersion: 4, valleyCompleted: undefined };
const migrated = normalizeAdventureState(oldState);
assert.equal(migrated.schemaVersion, 7);
assert.deepEqual(migrated.valleyCompleted, []);
assert.equal(migrated.active?.purpose, 'irrigation');
assert.equal(migrated.active?.id, oldTrip.adventure.active!.id);
assert.deepEqual(normalizeAdventureState({ ...campaign.adventure, valleyCompleted: ['unknown', 'valley_camp', 'valley_camp'] }).valleyCompleted, ['valley_camp']);
console.log('Valley core passed: seven stories, every branch, prerequisites, daily independence, production loop, bridge commissions, saved returns, full bags/warehouse, migration and once-only rewards.');

const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const [{ CommunityPage }, { GardenPage }, { AdventureMap }, { getAdventureNodeScene }, { CommunityFarm }, { CommunityField }, { CommunityBoard }] = await Promise.all([
    server.ssrLoadModule('/src/ui/CommunityPage.tsx'), server.ssrLoadModule('/src/ui/GardenPage.tsx'), server.ssrLoadModule('/src/ui/AdventureMap.tsx'), server.ssrLoadModule('/src/ui/adventureScenes.ts'),
    server.ssrLoadModule('/src/ui/community/CommunityFarm.tsx'), server.ssrLoadModule('/src/ui/community/CommunityField.tsx'), server.ssrLoadModule('/src/ui/community/CommunityBoard.tsx'),
  ]);
  const noop = () => {};
  const orchard = createElement(GardenPage, { pet: campaign, itemIconMap: {}, embedded: true });
  const props = { pet: campaign, portrait: '', update: noop, onBack: noop, onExplore: noop, onKitchen: noop, onShop: noop, orchard, onAdventure: noop };
  for (const initialTab of ['village', 'fishing']) {
    const html = renderToStaticMarkup(createElement(CommunityPage, { ...props, initialTab }));
    assert(html.includes(`data-scene="${initialTab === 'village' ? 'farm' : 'fishing'}"`));
    assert(html.includes('aria-haspopup="dialog"'));
    assert(!html.includes('role="dialog"'), 'landing scene must not open an operations panel');
  }
  for (const initialPlace of ['field', 'orchard', 'coop', 'barn', 'hut', 'pond', 'upstream', 'fishbook', 'board', 'market', 'journey', 'growth', 'kitchen']) {
    const html = renderToStaticMarkup(createElement(CommunityPage, { ...props, initialPlace }));
    assert(html.includes('role="dialog"') && html.includes('community-place-title'), initialPlace);
    assert(!/NaN|src="undefined"/.test(html), initialPlace);
    assert(html.includes('dialog-shell--fullscreen'), `${initialPlace} operates in a full-screen dialog`);
    assert.equal((html.match(/class="community-event"/g) ?? []).length, 1, 'recent information stays on the scene');
    if (initialPlace === 'orchard') {
      assert.equal((html.match(/<article class="garden-plot /g) ?? []).length, 5, 'orchard controls are inside the place dialog');
      assert(!html.includes('garden-page__header'), 'the orchard uses the dialog header');
    }
  }
  const closedOrchard = renderToStaticMarkup(createElement(CommunityPage, { ...props, initialPlace: 'orchard', place: null }));
  assert(!closedOrchard.includes('role="dialog"'), 'a controlled close overrides the initial orchard request');
  const checkProductionActions = (html: string, harvestable: boolean) => {
    const buttons = (html.match(/<button\b[\s\S]*?<\/button>/g) ?? []).filter(button => !button.includes('community-plot-card'));
    assert.deepEqual(buttons.map(button => button.replace(/<[^>]+>/g, '')), ['收获', '照料', '建设'], 'production scenes keep harvest, care and the existing construction entry');
    assert.equal(buttons[0].includes('disabled=""'), !harvestable, 'only available produce can be harvested');
    assert(buttons[1].includes('aria-haspopup="dialog"'), 'care opens its operations dialog');
    assert(buttons[2].includes('aria-haspopup="dialog"'), 'construction opens its operations dialog');
    assert(!html.includes('community-card') && !html.includes('role="dialog"'), 'operations stay out of the illustrated scene until requested');
  };
  for (const place of ['coop', 'barn'] as const) {
    for (const stock of [0, 4]) {
      const pet = { ...rest(campaign), community: { ...campaign.community, facilities: { ...campaign.community.facilities, [place]: { ...campaign.community.facilities[place], built: true } }, animals: { ...campaign.community.animals, [place]: { ...campaign.community.animals[place], stock } } } };
      const html = renderToStaticMarkup(createElement(CommunityFarm, { ...props, pet, only: place }));
      assert(html.includes(`data-production-scene="${place}"`));
      checkProductionActions(html, stock > 0);
      if (stock) assert(html.includes(`×${stock} · 等你收获`));
    }
  }
  const now = Date.now();
  for (const crop of [undefined, { id: 'herb' as const, plantedAt: now - H, readyAt: now + H }, { id: 'carrot' as const, plantedAt: now - 2 * H, readyAt: now - H }]) {
    const pet = { ...rest(campaign), community: { ...campaign.community, gardenBuilt: true, plots: [{ id: 1, crop }] } };
    const html = renderToStaticMarkup(createElement(CommunityField, { ...props, pet }));
    assert(html.includes('data-production-scene="field"'));
    checkProductionActions(html, Boolean(crop && crop.readyAt < now));
    assert(html.includes(!crop ? '等待播种' : crop.readyAt > now ? '正在慢慢生长' : '可以收获了'));
  }
  const board = renderToStaticMarkup(createElement(CommunityBoard, { ...props, onFishing: noop, onFarm: noop }));
  assert(board.includes('community-noticeboard') && board.includes('community-pinned-note'));
  assert(board.includes('给修渠邻居') && board.includes('的一碗暖粥'), 'the permanent story is pinned alongside daily requests');
  assert(board.includes('specialty-board') && !board.includes('交付并领取酬谢') && !board.includes('role="dialog"'), 'ordinary notes remain closed and specialty quotes are visible');
  const scenes = new Set<string>();
  for (const id of valleyQuestIds) {
    const html = renderToStaticMarkup(createElement(AdventureMap, { adventure: campaign.adventure, selection: { region: 'valley', node: valleyQuests[id].node }, landscape: false, onToggleLandscape: noop, onSelect: noop, onPrepare: noop, onResume: noop, onCollect: noop, onClose: noop, onVisit: noop }));
    assert(html.includes(valleyQuests[id].name) && html.includes('回访这里'));
    const scene = getAdventureNodeScene('valley', valleyQuests[id].node);
    assert(/^data:image\/svg\+xml[;,]/.test(scene)); scenes.add(scene);
  }
  assert.equal(scenes.size, 7);
  console.log('Valley React passed: both scene entrances, all 13 full-screen place dialogs, embedded orchard controls, controlled close, production scenes with harvest, care and construction in empty/growing/ready states, pinned noticeboard, seven task panels and distinct SVG scene assets. Visual/touch acceptance is manual.');
} finally { await server.close(); }
