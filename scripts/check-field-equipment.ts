import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { normalizePet } from '../src/core/petState';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { advancePet } from '../src/core/petLifecycle';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { getItemPurchaseQuote } from '../src/core/petActions';
import { getShopItem, getInventoryItem, shopItems, specialItems } from '../src/core/items';
import { fieldEquipmentItems, toolDefinitions } from '../src/core/fieldEquipmentData';
import { getToolUsesLeft } from '../src/core/toolDurability';
import { careCommunityCrop, getCommunityCropYield, harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { actCommunityFishing, cancelCommunityFishing, claimCommunityFish, startCommunityFishing } from '../src/core/communityFishing';
import { advanceAdventure, returnFromAdventure, claimAdventureResult, getAdventureStartReason, discardAdventureItem } from '../src/core/adventure';
import { startAdventure, startExpedition } from './fixtures/legacy-exploration';
import { getAdventureSteps } from '../src/core/adventureData';
import { chooseExpeditionStep, claimExpedition, getExpeditionChoices, getExpeditionHarvestLeft, restExpedition, returnExpedition } from '../src/core/expedition';
import { regionalTreasures, regionalTreasureIds, communityDecorations, communityDecorationIds } from '../src/core/regionalTreasures';
import { buildCommunityDecoration } from '../src/core/communityDecorations';
import { regionIds, regions } from '../src/core/expeditionData';
import { getCommunitySale } from '../src/core/communityEconomy';
import { getMarketQuote, listCommunityGoods, recycleCommunityGoods } from '../src/core/communityMarket';
import type { PetState } from '../src/core/petTypes';
import { spendExplorationHarvest } from '../src/core/explorationBudget';

const T = new Date(2026, 8, 21, 8).getTime(), H = 3600000, D = 24 * H;
const originalNow = Date.now; Date.now = () => T;
const fresh = () => createCommunityTestPet('projects', T);
const read = (pet: PetState, now = T) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const refill = (pet: PetState, now = T): PetState => ({ ...pet, hunger: getPetStatCap(pet), health: getPetStatCap(pet), mood: getPetStatCap(pet), energy: getPetEnergyCap(pet), lastUpdatedAt: now, isSleeping: false });
const step = (pet: PetState, choice: string, now = T) => {
  // Tool assertions isolate tool behavior; the logistics suite exercises real food provisioning.
  for (let i = 0; i < 12; i++) {
    const t = pet.community.expedition.active!, choices = getExpeditionChoices(pet, now);
    const c = choices.find(c => c.id === choice) ?? choices.find(c => c.id === 'travel');
    if (!c) return pet;
    if (pet.hunger < c.hunger || pet.energy < c.energy) pet = refill(pet, now);
    pet = chooseExpeditionStep(pet, t.id, t.revision, c.id, now);
    if (c.id === choice) return pet;
  }
  return pet;
};
const back = (pet: PetState, now = T) => { const id = pet.community.expedition.active!.id; return claimExpedition(returnExpedition(pet, id, now), id); };

try {
  assert.equal(fieldEquipmentItems.length, 8);
  assert.equal(new Set([...shopItems, ...specialItems].map(i => i.id)).size, shopItems.length + specialItems.length);
  for (const item of fieldEquipmentItems) {
    assert(getItemPurchaseQuote(fresh(), item.id, 1, T).canPurchase, `${item.id} can be purchased`);
    assert.equal(getCommunitySale(item.id), undefined, 'equipment cannot be flipped through recycling');
  }
  assert.equal(getShopItem('fishing_rod')!.price, 80); assert.equal(getShopItem('reinforced_rod')!.price, 180); assert.equal(getShopItem('trail_rope')!.price, 80);

  let p = fresh(); p.inventory = { wheat_seed: 1, field_watering_can: 1, nutrient_compost: 2, harvest_sickle: 2 };
  p.community.toolWear.harvest_sickle = toolDefinitions.harvest_sickle.uses - 1;
  p = plantCommunityCrop(p, 1, 'wheat', T);
  const planted = p;
  p = careCommunityCrop(p, 1, T, 'water', T);
  assert.equal(p.community.plots[0].crop!.readyAt, T + 6.4 * H); assert.equal(getToolUsesLeft(p, 'field_watering_can'), 15);
  assert.equal(careCommunityCrop(p, 1, T, 'water', T), p, 'repeated watering is free of side effects');
  p = careCommunityCrop(p, 1, T, 'fertilize', T);
  assert.equal(p.inventory.nutrient_compost, 1); assert.equal(getCommunityCropYield(p, 1), 5);
  assert.equal(careCommunityCrop(p, 1, T, 'fertilize', T), p);
  p = read(p); assert(p.community.plots[0].crop!.watered && p.community.plots[0].crop!.fertilized);
  const full = { ...p, inventory: { ...p.inventory, wheat: 9994 } };
  const blocked = harvestCommunityCrop(full, 1, T, T + 8 * H, true);
  assert.deepEqual(blocked.inventory, full.inventory); assert.deepEqual(blocked.community.toolWear, full.community.toolWear); assert(blocked.community.plots[0].crop);
  p = harvestCommunityCrop(p, 1, T, T + 8 * H, true);
  assert.equal(p.inventory.wheat, 6); assert.equal(p.inventory.harvest_sickle, 1); assert.equal(getToolUsesLeft(p, 'harvest_sickle'), 20);
  assert.equal(harvestCommunityCrop(p, 1, T, T + 8 * H, true), p);
  assert.equal(careCommunityCrop(planted, 1, T, 'water', T + 8 * H), planted, 'mature crop never wastes tool durability');

  for (const strong of [false, true]) {
    const rod = strong ? 'reinforced_rod' : 'fishing_rod';
    p = fresh(); p.inventory = { [rod]: 1, fishing_bait: 100 };
    for (let i = 0; i < toolDefinitions[rod].uses; i++) {
      p = startCommunityFishing(refill(p), 'pond', 'fishing_bait', strong, T);
      assert(p.community.fishing.active);
      assert.equal(startCommunityFishing(p, 'pond', 'fishing_bait', strong, T), p, 'duplicate cast never spends twice');
      p = cancelCommunityFishing(p, p.community.fishing.active!.id);
      if (i === 1) p = read(p);
    }
    assert.equal(p.inventory[rod] ?? 0, 0);
    assert(!startCommunityFishing(refill(p), 'pond', 'fishing_bait', strong, T).community.fishing.active);
  }
  p = fresh(); p.inventory = { fishing_rod: 1, fishing_bait: 2, fishing_float: 1, landing_net: 1 };
  p.community.toolWear = { fishing_rod: 19, fishing_float: 19, landing_net: 19 };
  p = startCommunityFishing(p, 'pond', 'fishing_bait', false, T, { float: true, net: true });
  assert.equal(p.community.fishing.active!.expiresAt - p.community.fishing.active!.biteAt, 30000);
  assert.equal(p.inventory.fishing_rod ?? 0, 0); assert.equal(p.inventory.landing_net ?? 0, 0);
  p = read(p); const fishSession = p.community.fishing.active!;
  p = actCommunityFishing(p, fishSession.id, 0, 'hook', T + 9000);
  for (const [i, action] of (['reel', 'reel', 'slack', 'reel'] as const).entries()) p = actCommunityFishing(p, fishSession.id, i + 1, action, T + 10000 + i * 1000);
  assert(p.community.fishing.pending, 'last durability still completes a fish using the saved net bonus');
  p = claimCommunityFish(p, fishSession.id); assert(!p.community.fishing.pending);
  const noNet = fresh(), rejected = startCommunityFishing(noNet, 'pond', 'fishing_bait', false, T, { net: true });
  assert.deepEqual(rejected.inventory, noNet.inventory); assert.deepEqual(rejected.community, noNet.community);

  // Both legacy adventures and five-region travel spend the same rope stack.
  p = fresh(); p.inventory.trail_rope = 2; p.community.toolWear.trail_rope = 14;
  p = startAdventure(p, 'valley', 'test.furo', 'Furo', {}, true, T);
  assert(p.adventure.active);
  for (let i = 0; i < 4; i++) {
    p = refill(p);
    const t = p.adventure.active!, event = getAdventureSteps(t.rulesVersion, t.region, t.purpose)[i];
    const choice = event.choices.find(c => c.tool) ?? event.choices.find(c => !c.item)!;
    p = advanceAdventure(p, t.id, i, choice.id, T);
  }
  assert.equal(getToolUsesLeft(p, 'trail_rope', true), 1);
  p = read(p); const tripId = p.adventure.active!.id;
  p = claimAdventureResult(returnFromAdventure(p, tripId, T), tripId);
  assert.equal(getToolUsesLeft(p, 'trail_rope'), 1);
  p.community.expedition.regions.hills.base = 0;
  p = startExpedition(refill(p), ['hills'], {}, true, 'test.furo', 'Furo', 'manual', 1, T);
  p = step(p, 'gather'); p = step(p, 'safe');
  assert.equal(p.community.expedition.active!.tool, false, 'last rope use breaks only the carried unit');
  const remainingRopes = p.inventory.trail_rope ?? 0;
  p = back(read(p)); assert.equal(p.inventory.trail_rope ?? 0, remainingRopes, 'broken rope does not return');
  p.community.expedition.regions.forest.base = 2;
  p = startExpedition(refill(p), ['forest'], {}, true, 'test.furo', 'Furo', 'manual', 1, T);
  const beforeSafe = { ...p.community.toolWear }; p = step(p, 'gather'); p = step(p, 'safe');
  assert.deepEqual(p.community.toolWear, beforeSafe, 'built shortcut does not consume rope');
  const pending = returnExpedition(p, p.community.expedition.active!.id, T);
  assert.match(getAdventureStartReason(pending, 'valley', T), /物资与工具/);
  pending.inventory.trail_rope = 9998;
  assert.equal(getItemPurchaseQuote(pending, 'trail_rope', 1, T).canPurchase, false, 'reserve warehouse space for the returning worn rope');
  const crowded = fresh(); crowded.inventory.prospector_pick = 9998;
  assert.equal(getItemPurchaseQuote(crowded, 'prospector_pick', 2, T).canPurchase, false);
  assert.equal(getItemPurchaseQuote(crowded, 'prospector_pick', 1, T).canPurchase, true);
  const discard = startAdventure(fresh(), 'valley', 'test.furo', 'Furo', {}, true, T);
  discard.community.toolWear.trail_rope = 5;
  const discarded = discardAdventureItem(discard, discard.adventure.active!.id, 0, 'trail_rope', 1, 'tool');
  assert.equal(discarded.community.toolWear.trail_rope, undefined);

  // Every region has a valuable, usable, saleable target, with shared daily quota.
  assert.deepEqual(new Set(regionalTreasureIds.map(id => regionalTreasures[id].region)), new Set(regionIds));
  for (const id of regionalTreasureIds) {
    const d = regionalTreasures[id]; p = fresh(); p.inventory.prospector_pick = 2;
    p.community.toolWear.prospector_pick = 11;
    const count = Math.ceil(d.investigations / 2);
    for (let i = 0; i < count; i++) {
      const now = T + Math.floor(i / 3) * D;
      const beforeQuota = getExpeditionHarvestLeft(p, d.region, now);
      p = startExpedition(refill(p, now), [d.region], {}, false, 'test.furo', 'Furo', 'manual', 1, now, d.region === 'valley' ? { style: 'short', target: 'aquamarine' } : {});
      const t = p.community.expedition.active!;
      const action = d.region === 'valley' ? 'gather:2' : `pick:${id}`;
      p = step(p, action, now);
      assert.equal(p.community.treasureResearch[id], (i + 1) * 2);
      const stale = chooseExpeditionStep(p, t.id, t.revision, action, now);
      assert.deepEqual(stale.community, p.community, 'stale choice cannot grant another gem');
      assert.deepEqual(stale.inventory, p.inventory); assert.equal(stale.energy, p.energy);
      assert.equal(getExpeditionHarvestLeft(p, d.region, now), beforeQuota - (d.region === 'valley' ? 2 : 1));
      p = back(read(p, now), now);
    }
    assert.equal(p.inventory[id], 1); assert.equal(p.community.expedition.collection[id], 1);
    assert.equal(p.inventory.prospector_pick, 1);
    const quote = getCommunitySale(id)!; assert(quote.collector && quote.base >= 240);
    assert(getInventoryItem(id)!.summary.includes(`${Math.floor(d.base * 140 / 100)} 金币`), 'treasure description uses the actual maximum stall quote');
    const beforeCoins = p.coins;
    p = recycleCommunityGoods(p, id, 1, 1);
    assert.equal(p.coins - beforeCoins, d.base); assert.equal(p.community.expedition.collection[id], 1);
  }
  p = fresh(); p.inventory.survey_lens = 1; p.community.toolWear.survey_lens = 14; p.community.forageResearch.matsutake = 2;
  p = startExpedition(p, ['forest'], {}, false, 'test.furo', 'Furo', 'manual', 1, T);
  p = step(p, 'lens:matsutake'); assert.equal(p.community.forageResearch.matsutake, 4); assert.equal(p.community.expedition.active!.bag.matsutake, 1); assert.equal(p.inventory.survey_lens ?? 0, 0);
  p = back(p);
  p = spendExplorationHarvest(p, getExpeditionHarvestLeft(p, 'forest', T), T);
  p = startExpedition(refill(p), ['forest'], {}, false, 'test.furo', 'Furo', 'manual', 1, T);
  assert(!getExpeditionChoices(p, T).some(c => c.research), 'food and treasures cannot bypass the shared daily quota');
  p = back(p);

  p = fresh(); p.inventory.camp_kit = 1; p.community.toolWear.camp_kit = 11; p.community.expedition.regions.valley.base = 0;
  p = startExpedition(p, ['valley'], {}, false, 'test.furo', 'Furo', 'manual', 1, T);
  for (let i = 0; i < 6; i++) p = step(p, getExpeditionChoices(p, T)[0].id);
  p.energy = 5; p.health = 50;
  const camp = p.community.expedition.active!;
  p = restExpedition(p, camp.id, camp.revision, T, true);
  assert.equal(p.energy, 5 + Math.floor(getPetEnergyCap(p) * .25)); assert.equal(p.health, 50, 'camp cannot heal damage unrelated to this trip'); assert.equal(p.inventory.camp_kit ?? 0, 0);
  const resting = restExpedition(p, camp.id, p.community.expedition.active!.revision, T, true);
  assert.deepEqual(resting.community, p.community, 'camp tools and bases share the same once-per-region rest');
  assert.equal(resting.energy, p.energy); assert.deepEqual(resting.inventory, p.inventory);

  for (const id of communityDecorationIds) {
    p = fresh(); p.inventory = { ...communityDecorations[id].items };
    const built = buildCommunityDecoration(p, id);
    assert(built.community.decorations.includes(id)); assert.equal(built.coins, p.coins);
    assert.equal(buildCommunityDecoration(built, id), built);
    assert(read(built).community.decorations.includes(id));
    assert.equal(built.inventory[communityDecorations[id].material] ?? 0, 0);
  }

  // New food premiums are included in both recovery and stall prices.
  assert.equal(getCommunitySale('dish_cream_matsutake')!.base, 117);
  assert.equal(getCommunitySale('dish_berry_jam_biscuit')!.base, 64);
  assert.equal(getCommunitySale('dish_valley_travel_bento')!.base, 104);
  assert.equal(getCommunitySale('dish_cream_matsutake')!.craft!.gatheringPremium, 37);
  const oldListing = fresh(); oldListing.inventory.dish_cream_matsutake = 2;
  const listed = listCommunityGoods(oldListing, 'dish_cream_matsutake', 1, oldListing.community.market.nextListingId, T);
  listed.community.market.listings[0].basePrice = 68; listed.community.market.listings[0].unitPrice = 81;
  const reloaded = read(listed), restocked = listCommunityGoods(reloaded, 'dish_cream_matsutake', 1, reloaded.community.market.nextListingId, T);
  assert.equal(restocked.community.market.listings[0].unitPrice, 81, 'existing shelves keep historical prices');
  assert(getMarketQuote(fresh(), 'dish_cream_matsutake')!.price > 81);

  const legacy = planted as any; delete legacy.community.toolWear; delete legacy.community.treasureResearch; delete legacy.community.decorations; legacy.community.schemaVersion = 5;
  p = normalizePet(legacy, T); assert.equal(p.community.schemaVersion, 8); assert.equal(getToolUsesLeft(p, 'field_watering_can'), 16); assert.deepEqual(p.inventory, legacy.inventory);
  p.community.toolWear = { field_watering_can: 3, prospector_pick: 4 }; p.community.treasureResearch = { star_sapphire: 9 };
  p.community.decorations = ['amber_lantern'];
  const frozen = prepareTimePause(p, T), later = T + 30 * D, restored = read(frozen, later);
  assert.deepEqual(advancePet(restored, later).community, restored.community);
  assert.equal(careCommunityCrop(restored, 1, T, 'water', later), restored);
  assert.equal(buildCommunityDecoration(restored, 'golden_sign'), restored);
  assert.equal(startCommunityFishing(restored, 'pond', 'fishing_bait', false, later), restored);
  const resumed = resumePetTime(restored, later);
  assert.deepEqual(resumed.community.toolWear, frozen.community.toolWear); assert.deepEqual(resumed.community.treasureResearch, frozen.community.treasureResearch); assert.deepEqual(resumed.community.decorations, frozen.community.decorations);
  assert.equal(resumed.community.plots[0].crop!.readyAt, later + 8 * H);
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const { createElement } = await import('react'), { renderToStaticMarkup } = await import('react-dom/server');
    const { TreasureDisplay } = await server.ssrLoadModule('/src/ui/community/TreasureDisplay.tsx');
    const { itemIcons } = await server.ssrLoadModule('/src/assets.ts');
    for (const id of [...fieldEquipmentItems.map(item => item.id), ...regionalTreasureIds]) assert.match(itemIcons[id], /\.webp(?:\?|$)/, `${id} has an adopted item icon`);
    const { decorationIcons } = await server.ssrLoadModule('/src/decorationAssets.ts');
    p = fresh(); p.community.decorations = ['amber_lantern'];
    const html = renderToStaticMarkup(createElement(TreasureDisplay, { pet: p, update: () => {} }));
    assert(html.includes('已陈列')); assert(!html.includes('undefined'));
    for (const id of communityDecorationIds) {
      assert(html.includes(communityDecorations[id].name), `${id} can be reviewed in the display`);
      assert(html.includes(decorationIcons[id]), `${id} renders its finished decoration artwork`);
      assert.notEqual(decorationIcons[id], itemIcons[communityDecorations[id].material], `${id} is distinct from its material`);
    }
  } finally { await server.close(); }
  console.log('Field equipment passed: 8 new items, crop yield and atomic harvest, all rod lifetimes, last-use fishing, shared rope wear, 5 regional treasures, quotas, research carry, 7 decorations, food premiums, historical listings, migration and freeze.');
} finally { Date.now = originalNow; }
