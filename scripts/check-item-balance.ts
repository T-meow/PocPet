import assert from 'node:assert/strict';
import { achievementDefinitions, applyHeartGain, claimAchievementReward, claimAllAchievementRewards, evaluateAchievements, getAchievementBalanceRewardId, getAchievementEffects, getAchievementViews } from '../src/core/achievements';
import { advanceGarden, fertilizeTree, gardenTreeDefinitions, gardenTreeSaplingItemIds, getGardenClearCost, getGardenEnvironmentEffects, getGardenToolUpgradeCost, harvestTree, normalizeGardenState, plantTree, useGardenNutrient } from '../src/core/garden';
import { goldenAppleGachaRewards, normalizeGoldenAppleGachaState } from '../src/core/goldenAppleGacha';
import { getItemRecoveryPreview, getItemStatEffect, getPictureBookReward, itemStatKeys } from '../src/core/itemEffects';
import { getInventoryItem } from '../src/core/items';
import { craftRecipe, getKitchenHeartReward } from '../src/core/kitchen';
import { allDishes, getDish, getRecipe, getRecipeEffect, getRecipeIngredientEntries, getRecipeMaterialCost, recipes } from '../src/core/kitchenRecipes';
import { applyPetAction, useInventoryItem } from '../src/core/petActions';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { getPetStatCap } from '../src/core/petStats';
import type { GardenDrop, GardenSlot, GardenTreeId, ItemId, PetState } from '../src/core/petTypes';
import type { RecipeId } from '../src/core/companionActivityTypes';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';

const hour = 3600000;
const day = 24 * hour;
const now = new Date(2026, 6, 15, 12).getTime();
const originalNow = Date.now;
const originalRandom = Math.random;
Date.now = () => now;
Math.random = () => 0.999;
const fresh = () => ({ ...createDefaultPet(now), level: 99, weather: 'rainy' as const, isSleeping: false });
const roundTrip = (pet: PetState) => parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
const stock = (pet: PetState) => ({ coins: pet.coins, inventory: pet.inventory, tickets: pet.goldenAppleGacha.tickets, receipts: pet.claimedRewardIds });
const item = (id: ItemId) => { const result = getInventoryItem(id); assert.ok(result, id); return result; };
const rawPrice = (id: ItemId) => id === 'emergency_biscuit' ? item('soda_biscuit_box').price / 40 : item(id).price;
const visit = (id: RecipeId, path: RecipeId[] = []): void => {
  assert.ok(!path.includes(id), `cyclic recipe: ${[...path, id].join(' -> ')}`);
  for (const ingredient of getRecipeIngredientEntries(getRecipe(id)!)) {
    assert.ok(Number.isInteger(ingredient.quantity) && ingredient.quantity > 0);
    item(ingredient.id);
    const dish = getDish(ingredient.id);
    if (dish) visit(dish.recipe.id, [...path, id]);
  }
};
const totalChainReward = (pet: PetState, id: RecipeId): number => getKitchenHeartReward(pet, id).heartsPerServing
  + getRecipeIngredientEntries(getRecipe(id)!).reduce((sum, ingredient) => sum + (getDish(ingredient.id) ? ingredient.quantity * totalChainReward(pet, getDish(ingredient.id)!.recipe.id) : 0), 0);
const growing = (treeId: GardenTreeId, duration = 12 * hour, overrides: Partial<GardenSlot> = {}): PetState => {
  const pet = fresh();
  pet.inventory = { normal_fertilizer: 5, heart_fertilizer: 5, harvest_nutrient: 5 };
  pet.garden.slots[0] = { ...pet.garden.slots[0], unlocked: true, treeId, plantedAt: now, naturalReadyAt: now + duration, nextReadyAt: now + duration, maxHarvests: gardenTreeDefinitions[treeId].maxHarvests, state: 'growing', ...overrides };
  return pet;
};
const amount = (drops: readonly GardenDrop[]) => drops.reduce((sum, drop) => sum + drop.amount, 0);

try {
  assert.equal(achievementDefinitions.length, 106);
  const rewardTotals = achievementDefinitions.reduce((totals, entry) => {
    totals.coins += entry.reward.coins ?? 0; totals.hearts += entry.reward.hearts ?? 0; totals.tickets += entry.reward.gachaTickets ?? 0;
    for (const reward of entry.reward.items ?? []) totals.items[reward.itemId] = (totals.items[reward.itemId] ?? 0) + reward.amount;
    return totals;
  }, { coins: 0, hearts: 0, tickets: 0, items: {} as Partial<Record<ItemId, number>> });
  assert.deepEqual(rewardTotals, { coins: 14323, hearts: 90, tickets: 8, items: { golden_apple: 15, heart_fertilizer: 24, harvest_nutrient: 8, watermelon: 1 } });
  for (const recipe of recipes) visit(recipe.id);
  for (let level = 1; level <= 10; level += 1) {
    const pet = fresh(); pet.partnerSchedule.skills.cooking.level = level;
    for (const recipe of recipes) {
      const step = getKitchenHeartReward(pet, recipe.id);
      assert.ok(step.heartsPerServing >= 0, `${recipe.id} has a negative step at skill ${level}`);
      assert.equal(totalChainReward(pet, recipe.id), Math.round(recipe.chainHearts * (1 + (level - 1) / 10)));
      assert.equal(getKitchenHeartReward({ ...pet, level: 1 }, recipe.id).heartsPerServing, step.heartsPerServing);
    }
    let chain = { ...pet, inventory: { rice: 3, egg: 3, carrot: 3 } } as PetState;
    const beforeHearts = chain.hearts;
    for (const id of ['plain_rice', 'egg_rice', 'carrot_rice'] as const) chain = craftRecipe(chain, id, false, 3, `${id}:${level}`, now);
    assert.equal(chain.hearts - beforeHearts, Math.round(2 * (1 + (level - 1) / 10)) * 3);
    assert.deepEqual(chain.inventory, { dish_carrot_rice: 3 });
    const external = craftRecipe({ ...pet, inventory: { dish_egg_rice: 3, carrot: 3 } }, 'carrot_rice', false, 3, `external:${level}`, now);
    assert.equal(external.hearts - pet.hearts, getKitchenHeartReward(pet, 'carrot_rice').heartsPerServing * 3, 'external dishes cannot repay their earlier budget');
  }
  const boosted = fresh();
  boosted.achievements.unlockedAtById = Object.fromEntries(achievementDefinitions.map((entry) => [entry.id, now]));
  boosted.boostCards.bestFriendPassExpiresAt = now + 7 * day;
  boosted.partnerSchedule.skills.cooking.level = 10;
  const rice = craftRecipe({ ...boosted, inventory: { rice: 99 } }, 'plain_rice', false, 99, 'rice-99', now);
  assert.equal(rice.hearts, boosted.hearts);
  assert.deepEqual(rice.boostCards, boosted.boostCards);
  const refined = craftRecipe({ ...boosted, inventory: { dish_plain_rice: 2, egg: 1, tomato: 1, pig_trotter: 1, greens: 1 } }, 'tomato_egg_bowl', false, 1, 'bowl', now);
  assert.equal(refined.hearts - boosted.hearts, 4);
  const pork = craftRecipe(refined, 'pork_rice_bowl', false, 1, 'pork', now);
  assert.equal(pork.hearts - refined.hearts, 6);
  assert.deepEqual(pork.inventory, { dish_tomato_egg_bowl: 1, dish_pork_rice_bowl: 1 });
  assert.strictEqual(craftRecipe(pork, 'pork_rice_bowl', false, 1, 'pork', now), pork, 'a repeated operation is inert');
  const missing = { ...fresh(), inventory: { dish_plain_rice: 1, egg: 1 } };
  assert.strictEqual(craftRecipe(missing, 'tomato_egg_bowl', false, 1, 'missing', now), missing, 'missing raw input rejects the whole operation');
  const fullDish = { ...missing, inventory: { ...missing.inventory, tomato: 1, dish_tomato_egg_bowl: 9999 } };
  assert.strictEqual(craftRecipe(fullDish, 'tomato_egg_bowl', false, 1, 'full', now), fullDish);
  assert.equal(getRecipeMaterialCost(getRecipe('carrot_rice')!, false, rawPrice), 32);
  assert.equal(getRecipeMaterialCost(getRecipe('pork_rice_bowl')!, false, rawPrice), 68);
  assert.equal(getRecipeMaterialCost(getRecipe('biscuit_layer_cake')!, false, rawPrice), 126);
  for (const dish of allDishes) {
    assert.equal(getRecipeEffect(dish.recipe, dish.banana).health ?? 0, 0);
    assert.deepEqual(item(dish.id).effect, getRecipeEffect(dish.recipe, dish.banana));
  }
  for (const recipe of recipes.filter((entry) => entry.fruitVariant)) {
    const apple = getRecipeEffect(recipe); const banana = getRecipeEffect(recipe, true);
    assert.equal(banana.hunger! - apple.hunger!, 2); assert.equal(banana.mood! - apple.mood!, -2); assert.equal(banana.energy! - apple.energy!, 2);
  }
  const endgame = fresh();
  for (const project of Object.values(endgame.classicEndgame.projects)) project.completedStages = 5;
  endgame.partnerSchedule.skills.cooking = { level: 10, xp: 0, masterCompletions: 60 };
  const cake = item('dish_biscuit_layer_cake');
  assert.equal(getItemStatEffect(endgame, cake).hunger, 460);
  for (const testPet of [endgame, { ...endgame, level: 1 }, { ...endgame, hunger: 590, mood: 590, health: 590 }]) {
    const preview = getItemRecoveryPreview(testPet, cake, 1, []);
    const used = useInventoryItem({ ...testPet, inventory: { [cake.id]: 1 } }, cake.id, now, { favoriteFoodIds: [] });
    for (const key of itemStatKeys) assert.equal(used[key] - testPet[key], preview.actual[key], `${key} recovery must match the cap-aware preview`);
    assert.ok(used.hunger <= getPetStatCap(testPet));
  }
  const cross = fresh(); cross.partnerSchedule.skills.study = { level: 9, xp: 618, masterCompletions: 0 }; cross.inventory = { picture_book: 99 };
  assert.deepEqual(getPictureBookReward(cross.partnerSchedule.skills.study, 99), { skill: { level: 10, xp: 0, masterCompletions: 0 }, xp: 3, heartServings: 98 });
  const read = useInventoryItem(cross, 'picture_book', now, { quantity: 99 });
  assert.equal(read.hearts - cross.hearts, 98);
  assert.deepEqual(read.partnerSchedule.skills.study, { level: 10, xp: 0, masterCompletions: 0 });
  assert.equal(read.achievements.counters.partnerScheduleClaimCount, 0);
  assert.equal(read.achievements.counters.heartEarnedTotal - cross.achievements.counters.heartEarnedTotal, 98);
  for (const random of [0, 0.999]) {
    Math.random = () => random;
    const lowBook = useInventoryItem({ ...fresh(), inventory: { picture_book: 1 } }, 'picture_book', now);
    assert.equal(lowBook.hearts, fresh().hearts, 'an unfinished study skill gets XP without a gift proc');
    assert.equal(lowBook.partnerSchedule.skills.study.xp, 3);
    const bell = useInventoryItem({ ...fresh(), inventory: { ribbon_bell: 1 } }, 'ribbon_bell', now);
    assert.equal(bell.hearts - fresh().hearts, 1);
    const master = { ...boosted, inventory: { picture_book: 1, ribbon_bell: 1 } };
    master.partnerSchedule.skills.study = { level: 10, xp: 0, masterCompletions: 8 };
    const expected = applyHeartGain(master, 1).amount;
    assert.equal(useInventoryItem(master, 'picture_book', now).hearts - master.hearts, expected);
    assert.equal(useInventoryItem(master, 'picture_book', now).partnerSchedule.skills.study.masterCompletions, 8);
    assert.equal(useInventoryItem(master, 'ribbon_bell', now).hearts - master.hearts, expected);
  }
  Math.random = () => 0.999;
  const care = fresh(); care.achievements.unlockedAtById = { sleep_rhythm_30: now, rare_gentle_caretaker: now };
  assert.equal(getAchievementEffects(care).careStatBonus, 2);
  const dirty = { ...care, cleanliness: 0, hunger: 500, energy: 300, mood: 0, health: 250 };
  const bath = applyPetAction(dirty, 'clean', now);
  assert.equal(bath.cleanliness, 80); assert.equal(bath.health, dirty.health); assert.equal(bath.mood, 3); assert.equal(bath.energy, 297); assert.ok(Math.abs(bath.hunger - 488.2) < 0.00001);

  for (const treeId of ['fruit_tree', 'care_tree', 'gift_tree'] as const) {
    const tree = growing(treeId);
    assert.equal(useGardenNutrient(tree, 0, now).inventory.harvest_nutrient, 5);
    for (const fertilizer of ['normal', 'heart'] as const) {
      const fed = fertilizeTree(tree, 0, fertilizer, now);
      assert.ok(fed.garden.slots[0].nextReadyAt < tree.garden.slots[0].nextReadyAt);
      assert.deepEqual(fertilizeTree(fed, 0, fertilizer === 'normal' ? 'heart' : 'normal', now).inventory, fed.inventory);
    }
    const fed = fertilizeTree(tree, 0, 'heart', now);
    const readyAt = fed.garden.slots[0].nextReadyAt;
    const harvested = harvestTree(fed, 0, readyAt);
    assert.equal(fertilizeTree(harvested, 0, 'heart', readyAt).inventory.heart_fertilizer, 3, 'the next round accepts fertilizer on the same day');
  }
  for (const treeId of ['money_tree', 'golden_apple_tree'] as const) {
    const tree = growing(treeId, 72 * hour);
    assert.deepEqual(fertilizeTree(tree, 0, 'normal', now).inventory, tree.inventory);
    assert.deepEqual(fertilizeTree(tree, 0, 'heart', now).inventory, tree.inventory);
    const fed = useGardenNutrient(tree, 0, now);
    assert.equal(fed.inventory.harvest_nutrient, 4);
    assert.equal(useGardenNutrient(fed, 0, now + day).inventory.harvest_nutrient, 4, 'nutrient is once per round across dates');
    assert.equal(roundTrip(fed).garden.slots[0].hasNutrientBoost, true);
    const baseDrops = advanceGarden(tree, now + 72 * hour).garden.slots[0].pendingDrops;
    const boostedDrops = advanceGarden(fed, now + 72 * hour).garden.slots[0].pendingDrops;
    assert.equal(amount(boostedDrops), treeId === 'money_tree' ? Math.floor(amount(baseDrops) * 1.25) : amount(baseDrops) + 1);
  }
  let variedRounds = 0;
  const frequencies = new Map<ItemId, number>();
  for (let index = 0; index < 1000; index += 1) {
    const tree = growing('fruit_tree', 12 * hour, { plantedAt: now - 12 * hour - index, naturalReadyAt: now - index, nextReadyAt: now - index });
    const drops = advanceGarden(tree, now).garden.slots[0].pendingDrops;
    assert.equal(amount(drops), 4);
    if (drops.length > 1) variedRounds += 1;
    for (const drop of drops) frequencies.set(drop.itemId!, (frequencies.get(drop.itemId!) ?? 0) + drop.amount);
  }
  assert.ok(variedRounds > 850, 'base items must be independent draws, not correlated copies');
  for (const entry of gardenTreeDefinitions.fruit_tree.dropPool) assert.ok(Math.abs((frequencies.get(entry.itemId) ?? 0) / 4000 - entry.weight / 100) < 0.035, `${entry.itemId} pool distribution`);
  for (const treeId of ['care_tree', 'gift_tree'] as const) {
    const tree = growing(treeId); const drops = advanceGarden(tree, now + 12 * hour).garden.slots[0].pendingDrops;
    assert.equal(amount(drops), 3);
    tree.achievements = boosted.achievements; tree.classicEndgame = endgame.classicEndgame;
    const extra = getAchievementEffects(tree).gardenExtraDropChancePercent + 150;
    const boostedAmount = amount(advanceGarden(tree, now + 12 * hour).garden.slots[0].pendingDrops);
    assert.ok(boostedAmount >= 3 + Math.floor(extra / 100) && boostedAmount <= 3 + Math.ceil(extra / 100), 'late-game extra slots are additive');
  }
  const winter = new Date(2026, 0, 15, 12).getTime(); const spring = new Date(2026, 3, 15, 12).getTime();
  for (const treeId of ['fruit_tree', 'care_tree', 'gift_tree', 'golden_apple_tree'] as const) {
    const seed = gardenTreeSaplingItemIds[treeId];
    const tree = { ...fresh(), inventory: { [seed]: 1 } }; tree.garden.slots[0].unlocked = true;
    assert.equal(plantTree(tree, 0, treeId, winter).garden.slots[0].maxHarvests, 11);
    const planted = plantTree(tree, 0, treeId, spring);
    assert.equal(planted.garden.slots[0].nextReadyAt - spring, Math.round(gardenTreeDefinitions[treeId].growDurationMs * getGardenEnvironmentEffects(tree, spring).growTimeMultiplier));
  }
  const manyDrops: GardenDrop[] = ['apple', 'orange', 'banana', 'watermelon', 'tomato', 'greens', 'golden_apple', 'wet_wipes'].map((id, index) => ({ itemId: id as ItemId, amount: index + 1 }));
  const legacy = fresh();
  (legacy.garden as unknown as { schemaVersion: number }).schemaVersion = 4;
  const oldMax = [8, 7, 6, 8, 9];
  const treeIds: GardenTreeId[] = ['fruit_tree', 'care_tree', 'gift_tree', 'money_tree', 'golden_apple_tree'];
  legacy.garden.slots = treeIds.map((treeId, index) => ({ ...growing(treeId).garden.slots[0], slotIndex: index, state: 'ready', pendingDrops: manyDrops, maxHarvests: oldMax[index] + 1, harvestsUsed: 2, fertilizerType: 'heart', hasNutrientBoost: true, careReductionMs: hour, nextReadyAt: now + 11 * hour }));
  const migrated = normalizeGardenState(legacy.garden, now);
  assert.deepEqual(migrated.slots.map((slot) => slot.maxHarvests), [11, 11, 11, 9, 11]);
  for (const slot of migrated.slots) { assert.deepEqual(slot.pendingDrops, manyDrops); assert.equal(slot.nextReadyAt, now + 11 * hour); assert.equal(slot.careReductionMs, hour); assert.ok(slot.hasNutrientBoost); }
  assert.deepEqual(normalizeGardenState(migrated, now), migrated);
  let imported = roundTrip(legacy);
  for (let index = 0; index < 3; index += 1) imported = roundTrip(imported);
  assert.deepEqual(imported.garden.slots, migrated.slots);
  const deadLegacy = structuredClone(legacy.garden); deadLegacy.slots.forEach((slot, index) => { slot.state = 'withered'; slot.harvestsUsed = oldMax[index] + 1; });
  assert.deepEqual(normalizeGardenState(deadLegacy, now).slots.map((slot) => [slot.state, slot.maxHarvests]), oldMax.map((max) => ['withered', max + 1]));
  assert.equal(getGardenClearCost(fresh().garden.tools, 'fruit_tree'), 20); assert.equal(getGardenClearCost(fresh().garden.tools, 'golden_apple_tree'), 80);
  assert.equal(getGardenToolUpgradeCost(fresh().garden.tools, 'shovel'), 80);
  assert.equal(getGardenToolUpgradeCost({ ...fresh().garden.tools, fertilizerBoxLevel: 2 }, 'fertilizer_box'), 450);

  const supplyIds = ['garden_water_20', 'garden_harvest_30', 'garden_harvest_100', 'garden_tree_catalogue', 'schedule_long_all_categories'] as const;
  const rewards = fresh(); rewards.inventory = {}; rewards.achievements.unlockedAtById = Object.fromEntries(supplyIds.map((id) => [id, now]));
  rewards.goldenAppleGacha.dailyTicketsGranted = 3;
  const full = claimAllAchievementRewards(rewards, now);
  assert.equal(full.claimedIds.length, 5); assert.deepEqual(full.pet.inventory, { heart_fertilizer: 24, harvest_nutrient: 8 });
  assert.equal(full.pet.goldenAppleGacha.tickets, 8); assert.equal(full.pet.coins - rewards.coins, 1600); assert.equal(full.pet.goldenAppleGacha.dailyTicketsGranted, 3);
  for (const id of supplyIds) assert.ok(full.pet.claimedRewardIds.includes(getAchievementBalanceRewardId(id)));
  assert.deepEqual(claimAllAchievementRewards(full.pet, now).claimedIds, []);
  const oldClaimed = structuredClone(rewards); oldClaimed.achievements.claimedOneTimeRewardIds = [...supplyIds]; oldClaimed.inventory = { heart_fertilizer: 8 };
  assert.ok(getAchievementViews(oldClaimed).filter((view) => view.claimable).every((view) => view.claimKind === 'balance' && view.rewardText.includes('扭蛋券')));
  const supplement = claimAllAchievementRewards(oldClaimed, now);
  assert.deepEqual(supplement.pet.inventory, full.pet.inventory); assert.equal(supplement.pet.coins, oldClaimed.coins); assert.equal(supplement.pet.goldenAppleGacha.tickets, 8);
  let saved = supplement.pet;
  const expectedSaved = stock(normalizePet(supplement.pet, now));
  for (let index = 0; index < 3; index += 1) { saved = normalizePet(roundTrip(saved), now); assert.deepEqual(stock(claimAllAchievementRewards(saved, now).pet), expectedSaved); }
  for (const old of [false, true]) for (const capacity of ['item', 'ticket'] as const) {
    const blocked = structuredClone(old ? oldClaimed : rewards);
    if (capacity === 'item') blocked.inventory.harvest_nutrient = 9999; else blocked.goldenAppleGacha.tickets = 9999;
    const result = claimAchievementReward(blocked, 'garden_water_20', now);
    assert.deepEqual(stock(result), stock(blocked), 'capacity failure must keep the whole package pending');
    assert.ok(getAchievementViews(result).find((view) => view.id === 'garden_water_20')?.claimBlocked);
    assert.deepEqual(claimAllAchievementRewards(result, now).claimedIds, []);
    if (capacity === 'item') result.inventory.harvest_nutrient = 9998; else result.goldenAppleGacha.tickets = 9998;
    const partial = claimAllAchievementRewards(result, now);
    assert.deepEqual(partial.claimedIds, ['garden_water_20'], 'batch claims report only rewards that actually fit');
    assert.ok(partial.pet.claimedRewardIds.includes(getAchievementBalanceRewardId('garden_water_20')));
  }
  const eight = fresh(); eight.kitchen.made = Object.fromEntries(recipes.slice(-8).map((recipe) => [recipe.id, 1]));
  assert.ok(evaluateAchievements(eight, now).achievements.unlockedAtById.kitchen_eight);
  const history = normalizeGoldenAppleGachaState({ ...fresh().goldenAppleGacha, recentResults: ['normal_fertilizer_1', 'heart_fertilizer_1', 'normal_fertilizer_20', 'heart_fertilizer_30'].map((rewardId) => ({ rewardId, drawnAt: now })) }, now, now);
  assert.deepEqual(history.recentResults.map((result) => result.amount), [1, 1, 20, 30]);
  assert.equal(goldenAppleGachaRewards.reduce((sum, reward) => sum + reward.weight, 0), 100000);
  assert.equal(goldenAppleGachaRewards.find((reward) => reward.id === 'normal_fertilizer_20')?.value, 300);
  assert.equal(goldenAppleGachaRewards.find((reward) => reward.id === 'heart_fertilizer_30')?.value, 900);
  console.log('Item balance: recipe DAG and all 10 skill budgets, atomic crafting, capped recovery, book mastery, garden draws/restrictions/migrations, achievement supplements/capacity, and legacy gacha history passed.');
} finally { Date.now = originalNow; Math.random = originalRandom; }
