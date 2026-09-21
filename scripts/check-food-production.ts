import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { communityCrops, wildIngredients, wildIngredientIds, rarityOrder } from '../src/core/foodCatalog';
import { plantCommunityCrop, harvestCommunityCrop } from '../src/core/community';
import { processingRecipes, processFood, getProcessingLimit } from '../src/core/foodProcessing';
import { careCommunityAnimal, collectCommunityAnimal, feedCommunityAnimal, claimRanchMilk } from '../src/core/communityFarm';
import { chooseExpeditionStep, claimExpedition, getExpeditionChoices, getExpeditionHarvestLeft, returnExpedition, startExpedition } from '../src/core/expedition';
import { regions } from '../src/core/expeditionData';
import { fish, fishIds, isWaterOpen, waterIds } from '../src/core/communityData';
import { startCommunityFishing, buildWaterBoardwalk, actCommunityFishing, claimCommunityFish } from '../src/core/communityFishing';
import { getCraftLimit, craftRecipe } from '../src/core/kitchen';
import { allDishes, getRecipe, getDish, getRecipeIngredientEntries, hasRecipeMilkChoice, recipes } from '../src/core/kitchenRecipes';
import { browseRecipes } from '../src/core/kitchenBrowse';
import { getInventoryItem, getShopItem, shopItems, specialItems } from '../src/core/items';
import { getCommunitySale } from '../src/core/communityEconomy';
import { advanceCommunityMarket, getMarketQuote, listCommunityGoods, setCommunityMarketOpen } from '../src/core/communityMarket';
import { getMarketVisit } from '../src/core/communityMarketRules';
import { getItemRecoveryPreview, getItemStatEffect } from '../src/core/itemEffects';
import { useInventoryItem, getItemPurchaseQuote } from '../src/core/petActions';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { advancePet } from '../src/core/petLifecycle';
import type { BuiltinItemId, PetState } from '../src/core/petTypes';
import type { MilkChoice } from '../src/core/companionActivityTypes';
import { spendExplorationHarvest } from '../src/core/explorationBudget';

const T = new Date(2026, 8, 20, 8).getTime(), H = 3600000, D = 24 * H;
const originalNow = Date.now; Date.now = () => T;
const ready = () => { const p = createCommunityTestPet('projects', T); p.kitchen.equipment = ['mix', 'pan', 'blender', 'oven']; return p; };
const read = (p: PetState, now = T) => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
const replenish = (p: PetState) => ({ ...p, hunger: getPetStatCap(p), energy: getPetEnergyCap(p), health: getPetStatCap(p), isSleeping: false });
const step = (p: PetState, choice: string, now = T) => {
  for (let i = 0; i < 12; i++) {
    const t = p.community.expedition.active!, choices = getExpeditionChoices(p, now), c = choices.find(c => c.id === choice) ?? choices.find(c => c.id === 'travel');
    if (!c) return p;
    if (p.hunger < c.hunger || p.energy < c.energy) p = replenish(p);
    p = chooseExpeditionStep(p, t.id, t.revision, c.id, now);
    if (c.id === choice) return p;
  }
  return p;
};
const comeBack = (p: PetState, now = T) => { const id = p.community.expedition.active!.id; return claimExpedition(returnExpedition(p, id, now), id); };
try {
  assert.equal(new Set([...shopItems, ...specialItems].map(i => i.id)).size, shopItems.length + specialItems.length, 'no duplicate IDs override existing milk or ingredient definitions');
  assert.equal(getShopItem('farm_milk')!.price, 18); assert.equal(getShopItem('flour')!.price, 10);
  for (const id of ['rice', 'flour', 'farm_milk'] as const) assert(getItemPurchaseQuote({ ...createDefaultPet(T), coins: 100 }, id, 1, T).canPurchase, `${id} available from the start`);
  assert.equal(Object.keys(communityCrops).length, 16); assert.equal(fishIds.length, 18);
  assert(rarityOrder.every(r => fishIds.some(id => fish[id].rarity === r)));
  let p = ready(); p.inventory = { wheat_seed: 1 };
  p = plantCommunityCrop(p, 1, 'wheat', T); assert.equal(p.community.plots[0].crop!.readyAt, T + 8 * H);
  const growing = read(p); assert.equal(harvestCommunityCrop(growing, 1, T, T + 8 * H - 1), growing);
  p = harvestCommunityCrop(growing, 1, T, T + 8 * H); assert.equal(p.inventory.wheat, 4);
  p = processFood(p, 'mill_flour', 4, 0, T + 8 * H);
  assert.equal(p.inventory.flour, 8); assert.equal(p.inventory.wheat ?? 0, 0);
  assert.equal(getCommunitySale('wheat')!.base, 3); assert.equal(getCommunitySale('flour')!.base * 8 - 24, 8);
  assert.equal(processFood(read(p), 'mill_flour', 4, 0).inventory.flour, 8);
  for (const r of processingRecipes) {
    const initial = ready(); initial.inventory = Object.fromEntries(Object.entries(r.inputs).map(([id, n]) => [id, n * 3]));
    const made = processFood(initial, r.id, 3, 0, T);
    assert.equal(made.inventory[r.output], r.quantity * 3, r.id); assert.equal(made.coins, initial.coins - r.fee * 3);
    assert.equal(made.hearts, initial.hearts); assert.deepEqual(made.kitchen, initial.kitchen);
    assert.deepEqual(processFood(read(made), r.id, 3, 0, T).inventory, made.inventory);
    const full = { ...initial, inventory: { ...initial.inventory, [r.output]: 9999 } };
    assert.equal(getProcessingLimit(full, r.id), 0); assert.equal(processFood(full, r.id, 1, 0), full);
    assert.equal(processFood(initial, r.id, 1.5, 0), initial);
  }

  for (const r of recipes.filter(hasRecipeMilkChoice)) for (const milk of ['farm_milk', 'ad_milk'] as const) {
    const initial = ready(); initial.community.waterAccess = { forest_pool: { found: true, built: true }, coast_pier: { found: true, built: true } };
    initial.inventory = { farm_milk: 5, ad_milk: 5 };
    for (const i of getRecipeIngredientEntries(r, false, milk)) initial.inventory[i.id] = i.quantity * 2;
    assert.equal(getCraftLimit(initial, r.id, false, milk), 2, r.id);
    const made = craftRecipe(initial, r.id, false, 2, `milk:${r.id}:${milk}`, T, milk);
    assert.equal(made.inventory[`dish_${r.id}`], 2, r.id); assert.equal(made.inventory[milk] ?? 0, 0);
    const other = milk === 'ad_milk' ? 'farm_milk' : 'ad_milk'; assert.equal(made.inventory[other], initial.inventory[other]);
    assert.equal(normalizePet(made, T).kitchen.lastCraft!.milk, milk);
    assert.equal(read(made).kitchen.made[r.id], 2, 'export retains production history; the last-result overlay is transient');
    assert.equal(craftRecipe(made, r.id, false, 2, `milk:${r.id}:${milk}`, T, milk), made);
  }
  assert(getRecipeIngredientEntries(getRecipe('milk_cookies')!, false, 'ad_milk').some(i => i.id === 'strawberry_milk'));
  const splitMilk = ready(); splitMilk.inventory = { banana: 2, farm_milk: 1, ad_milk: 1 };
  assert.equal(getCraftLimit(splitMilk, 'banana_shake', false, 'farm_milk'), 1, 'a batch never silently mixes milk types');

  p = feedCommunityAnimal(ready(), 'barn', 0, 1, T); p = careCommunityAnimal(p, 'barn', 1, T);
  assert(p.community.ranchDay.cared); const harvestAt = p.community.animals.barn.nextAt!;
  p = collectCommunityAnimal(read(p), 'barn', 3, harvestAt); // one completed cycle advances the revision
  assert(p.community.ranchDay.collected);
  p = claimRanchMilk(p, 'strawberry_milk', harvestAt); assert.equal(p.inventory.strawberry_milk, 1);
  assert.equal(claimRanchMilk(read(p, harvestAt), 'ad_milk', harvestAt).inventory.ad_milk ?? 0, 0);
  assert.equal(claimRanchMilk(p, 'ad_milk', harvestAt - D).inventory.ad_milk ?? 0, 0, 'rolling the clock back cannot repeat a reward');
  assert.equal(claimRanchMilk(p, 'ad_milk', harvestAt + D).inventory.ad_milk ?? 0, 0, 'a new day requires new care and collection');

  // Every target shares the regional quota; rare progress survives target switches and reloads.
  p = ready();
  for (const target of ['matsutake', 'wood_ear', 'matsutake'] as const) {
    p = startExpedition(replenish(p), ['forest'], {}, false, 'test', '测试', 'manual', 1, T);
    const before = p.community.expedition.regions.forest.harvestUsed;
    p = step(p, `forage:${target}`); assert.equal(p.community.expedition.regions.forest.harvestUsed, before + 1);
    p = read(comeBack(p));
  }
  assert.equal(p.inventory.wood_ear, 4); assert.equal(p.inventory.matsutake ?? 0, 0); assert.equal(p.community.forageResearch.matsutake, 2);
  assert.equal(getExpeditionHarvestLeft(p, 'forest', T), 5);
  p = spendExplorationHarvest(p, 5, T);
  p = startExpedition(replenish(p), ['forest'], {}, false, 'test', '测试', 'manual', 1, T);
  assert(!getExpeditionChoices(p, T).some(c => c.id.startsWith('forage:'))); p = comeBack(p);
  p = startExpedition({ ...replenish(p), lastUpdatedAt: T + D }, ['forest'], {}, false, 'test', '测试', 'manual', 1, T + D);
  p = step(p, 'forage:matsutake', T + D); p = comeBack(p, T + D);
  assert.equal(p.inventory.matsutake, 1); assert.equal(p.community.forageResearch.matsutake, 3);
  for (const target of wildIngredientIds) {
    const d = wildIngredients[target], initial = ready(); initial.inventory = {};
    let gathered = startExpedition(initial, [d.region], {}, false, 'test', '测试', 'manual', 1, T, d.region === 'valley' ? { style: 'short', target: target === 'bamboo_shoot' ? 'bamboo_shoot' : 'lotus_seed' } : {});
    gathered = step(gathered, d.region === 'valley' ? 'gather:1' : `forage:${target}`); gathered = comeBack(gathered);
    assert.equal(gathered.inventory[target] ?? 0, target === 'bamboo_shoot' ? 5 : d.investigations === 3 ? 0 : d.yield);
    if (d.investigations === 3) assert.equal(gathered.inventory[regions[d.region].product], 1);
  }

  for (const [region, water] of [['forest', 'forest_pool'], ['coast', 'coast_pier']] as const) {
    let discovered = ready(); assert(!isWaterOpen(discovered, water));
    assert.equal(startCommunityFishing(discovered, water, 'fishing_bait', false, T).inventory.fishing_bait, discovered.inventory.fishing_bait);
    discovered = startExpedition(discovered, [region], {}, false, 'test', '测试', 'manual', 1, T);
    for (const choice of ['gather', 'safe', 'story']) discovered = step(discovered, choice);
    discovered = read(comeBack(discovered)); assert(discovered.community.waterAccess[water].found);
    discovered = buildWaterBoardwalk(discovered, water); assert(isWaterOpen(read(discovered), water));
    assert.equal(buildWaterBoardwalk(discovered, water), discovered);
    for (let repeat = 0; repeat < 2; repeat++) {
      discovered = startCommunityFishing(replenish(discovered), water, 'fishing_bait', false, T + repeat * 60000);
      discovered = read(discovered, T + repeat * 60000);
      let s = discovered.community.fishing.active!; assert(s);
      assert.equal(s.water, water, 'active casts in new waters survive reload');
      discovered = actCommunityFishing(discovered, s.id, 0, 'hook', s.biteAt);
      while (discovered.community.fishing.active) { s = discovered.community.fishing.active; discovered = actCommunityFishing(discovered, s.id, s.revision, s.tension + 32 >= 100 ? 'slack' : 'reel', s.lastActionAt + 700); }
      const pending = discovered.community.fishing.pending!; assert(pending);
      discovered = claimCommunityFish(discovered, pending.id);
    }
    assert.equal(discovered.community.fishing.casts, 2);
  }
  for (const water of waterIds) {
    const initial = ready(); initial.community.waterAccess = { forest_pool: { found: true, built: true }, coast_pier: { found: true, built: true } };
    const seen = new Set<string>();
    for (let cast = 0; cast < 3000; cast++) { const result = startCommunityFishing({ ...initial, community: { ...initial.community, fishing: { ...initial.community.fishing, casts: cast } } }, water, 'river_bait', true, T); seen.add(result.community.fishing.active!.fish); }
    assert.deepEqual([...seen].sort(), fishIds.filter(id => fish[id].water === water).sort(), `${water}: every fish is reachable`);
  }

  // Conservative purchase bound discounts every unit, stronger than the actual first-unit offer.
  const purchaseCost = (id: BuiltinItemId, discounted: boolean, milk: MilkChoice): number => {
    const shop = getShopItem(id), dish = getDish(id);
    const direct = shop && shop.price > 0 ? discounted ? Math.ceil(shop.price * .7) : shop.price : Infinity;
    const processed = processingRecipes.filter(r => r.output === id).map(r => (r.fee + Object.entries(r.inputs).reduce((sum, [input, n]) => sum + n * purchaseCost(input as BuiltinItemId, discounted, milk), 0)) / r.quantity);
    const cooked = dish ? getRecipeIngredientEntries(dish.recipe, dish.banana, milk).reduce((sum, i) => sum + i.quantity * purchaseCost(i.id, discounted, milk), 0) : Infinity;
    return Math.min(direct, cooked, ...processed);
  };
  let audited = 0;
  const maxMarket = ready(); maxMarket.community.market.level = 3; maxMarket.partnerSchedule.skills.study.level = 10;
  for (const item of [...shopItems, ...specialItems]) for (const discount of [false, true]) for (const milk of ['farm_milk', 'ad_milk'] as const) {
    const cost = purchaseCost(item.id, discount, milk), quote = getMarketQuote(maxMarket, item.id);
    if (Number.isFinite(cost) && quote && !quote.exchangeOnly) { assert(quote.price <= cost, `${item.id}: resale ${quote.price} exceeds purchase/processing ${cost}`); audited++; }
  }
  assert(audited > 100); assert.equal(getCommunitySale('constructor'), undefined);
  for (const [id, demand, max] of [['wheat', 'basic', 4], ['wild_lemon', 'specialty', 2], ['matsutake', 'premium', 1]] as const) {
    const initial = ready(); initial.inventory[id] = 20;
    initial.community.market.seed = Array.from({ length: 1000 }, (_, i) => i + 1).find(seed => getMarketVisit(seed, 0).customer === 'foodie')!;
    let listed = listCommunityGoods(initial, id, 20, 1, T); listed = setCommunityMarketOpen(listed, true, T);
    const sold = advanceCommunityMarket(listed, listed.community.market.nextVisitAt!);
    assert.equal(getCommunitySale(id)!.demand, demand); assert(sold.community.market.sold >= (demand === 'basic' ? 2 : 1) && sold.community.market.sold <= max);
  }

  for (const level of [1, 30, 99]) for (const skill of [1, 5, 10]) for (const trophy of [0, 1, 3, 5]) for (const dish of allDishes) {
    let initial = ready(); initial.level = level; initial.partnerSchedule.skills.cooking.level = skill;
    initial.classicEndgame.projects.cooking.completedStages = trophy;
    initial = { ...initial, hunger: getPetStatCap(initial) - 1, energy: getPetEnergyCap(initial) - 3, isOverfed: false, inventory: { [dish.id]: 1 } };
    const item = getInventoryItem(dish.id)!, preview = getItemRecoveryPreview(initial, item, 1, []), effect = getItemStatEffect(initial, item);
    assert.equal(preview.actual.energy, Math.min(3, effect.energy ?? 0));
    assert(Math.abs(preview.actual.hunger! - (1 + ((effect.hunger ?? 0) - 1) * .6)) < 1e-8);
    const used = useInventoryItem(initial, dish.id, T, { favoriteFoodIds: [] });
    assert.equal(used.energy - initial.energy, preview.actual.energy); assert.equal(used.hunger - initial.hunger, preview.actual.hunger);
    assert(getItemRecoveryPreview(used, item).blocked);
    const depleted = { ...initial, energy: 0 };
    const fullRecovery = getItemRecoveryPreview(depleted, item, 1, []);
    assert.equal(fullRecovery.actual.energy, Math.min(getPetEnergyCap(depleted), effect.energy ?? 0));
  }
  const filtered = browseRecipes(ready(), { category: 'drink', rarity: 'epic', unlocked: true, ingredients: false, equipment: true, sort: 'energy' });
  assert.deepEqual(filtered.map(r => r.id), ['mountain_herb_tea']);
  const mains = browseRecipes(ready(), { category: 'main', rarity: '', unlocked: false, ingredients: false, equipment: false, sort: 'rarity' });
  assert(mains.some(r => r.id === 'valley_travel_bento'), 'the travel bento is discoverable in the main-dish filter');
  assert(getInventoryItem('dish_valley_travel_bento')!.tags?.includes('main'), 'the inventory uses the same main-dish category');
  const stockForFilter = ready(); stockForFilter.inventory = { mountain_tea: 1, creek_herb: 1 };
  assert.equal(browseRecipes(stockForFilter, { category: 'drink', rarity: 'epic', unlocked: true, ingredients: true, equipment: true, sort: 'energy' }).length, 1);

  const growingWheat = plantCommunityCrop({ ...ready(), inventory: { wheat_seed: 1, wheat: 2, farm_milk: 4 } }, 1, 'wheat', T);
  growingWheat.community.forageResearch = { matsutake: 2, mountain_tea: 1 };
  growingWheat.community.ranchDay = { day: '2026-09-20', cared: true, collected: true, claimed: false };
  const frozen = prepareTimePause(growingWheat, T), later = T + 30 * D;
  assert.deepEqual(advancePet(read(frozen, later), later).community, frozen.community);
  assert.equal(processFood(frozen, 'mill_flour', 1, 0, later), frozen);
  assert.equal(harvestCommunityCrop(frozen, 1, T, later), frozen);
  assert.equal(claimRanchMilk(frozen, 'ad_milk', T), frozen);
  const resumed = resumePetTime(read(frozen, later), later);
  assert.equal(resumed.community.plots[0].crop!.readyAt, later + 8 * H); assert.deepEqual(resumed.community.forageResearch, frozen.community.forageResearch);
  assert.deepEqual(resumed.community.ranchDay, frozen.community.ranchDay);
  const legacy = ready() as any; delete legacy.community.waterAccess; delete legacy.community.forageResearch; delete legacy.community.ranchDay; delete legacy.community.processing; delete legacy.community.discoveredCrops;
  legacy.community.schemaVersion = 4;
  const migrated = normalizePet(legacy, T); assert(isWaterOpen(migrated, 'pond')); assert(isWaterOpen(migrated, 'upstream')); assert.equal(migrated.community.schemaVersion, 8);
  assert.deepEqual(migrated.inventory, legacy.inventory); assert.deepEqual(migrated.community.fishing.journal, legacy.community.fishing.journal);
  console.log(`Food production passed: 16 crops, 12 wild ingredients, 7 processors, 18 fish, ${recipes.length} recipes, ${audited} purchase-chain scenarios, milk batches, regional quotas, saves, freeze and recovery across levels/skills/trophies.`);
} finally { Date.now = originalNow; }
