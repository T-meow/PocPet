import assert from 'node:assert/strict';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { buyItem, getItemPurchaseQuote, useInventoryItem } from '../src/core/petActions';
import { createBuiltinItemRegistry, getDailyShopDiscountInfo, getInventoryDefinitions, getShopDefinitions, inventoryItems } from '../src/core/items';
import { achievementDefinitions, evaluateAchievementUnlocks } from '../src/core/achievements';
import { buyKitchenEquipment, claimKitchenStarter, craftRecipe, getCraftLimit, getKitchenHeartReward, normalizeKitchenState, recordDishTaste } from '../src/core/kitchen';
import { allDishes, findRecipeCombination, getRecipe, getRecipeIngredientEntries, getRecipeIngredients, recipes } from '../src/core/kitchenRecipes';
import { acknowledgeMiniGameResult, actMiniGame, bubbleHoldMs, bubbleSessionMs, buyBubbleWand, catchFlightMs, getCatchPetX, getMiniGameBaseHearts, normalizeMiniGameState, pauseMiniGame, resumeMiniGame, startMiniGame, unlockBallGame, type MiniGameAction } from '../src/core/miniGames';
import { getMiniGameFeedback } from '../src/ui/play/miniGameFeedback';
import { beginCookingStep, cookingActionSound, createCookingProgress, finishCookingAnimation, getCookingActions, isCookingComplete } from '../src/ui/kitchen/cookingProcess';
import { createItemBrowseState, filterBrowseItems, getItemBrowseLimit, getStorageReturnTarget, resolveItemBrowseState, type ItemBrowseState } from '../src/ui/itemBrowse';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText } from '../src/core/saveCodec';
import { advancePet } from '../src/core/petLifecycle';
import type { PetState } from '../src/core/petTypes';

const now = Date.now();
const actor = 'official.furo';
const originalRandom = Math.random;
Math.random = () => .999999;
const fresh = () => createDefaultPet(now);
const stocked = (): PetState => ({ ...fresh(), coins: 10000, inventory: Object.fromEntries(inventoryItems.map((item) => [item.id, 100])), kitchen: { ...fresh().kitchen, starterClaimed: true } });
const base = fresh();
const playBase: PetState = { ...base, level: 3 };
const starter = claimKitchenStarter(base);
assert.equal(starter.inventory.rice, 1);
assert.equal(starter.inventory.egg, 1);
assert.equal(claimKitchenStarter(starter), starter, 'starter is claimed only once');
assert.equal(base.inventory.rice, undefined, 'original state was not mutated');
let cooked = craftRecipe(starter, 'egg_rice', false, 1, 'first', now);
assert.equal(cooked.hearts, 3);
assert.equal(cooked.inventory.dish_egg_rice, 1);
assert.equal(cooked.inventory.rice ?? 0, 0);
assert.equal(cooked.partnerSchedule.skills.cooking.xp, 5);
assert.equal(cooked.achievements.counters.partnerScheduleClaimCount, 0);
assert.equal(normalizePet(cooked, now).achievements.counters.partnerScheduleClaimCount, 0, 'kitchen XP must not backfill a schedule completion');
assert.equal(craftRecipe(cooked, 'egg_rice', false, 1, 'first', now), cooked);
assert.equal(craftRecipe(starter, 'egg_rice', false, 2, 'too-many', now), starter);
for (const quantity of [0, -1, 1.5, NaN, Infinity, 100]) assert.equal(craftRecipe(starter, 'egg_rice', false, quantity, 'bad', now), starter);
assert.equal(craftRecipe(starter, 'milk_cookies', false, 1, 'locked', now), starter);
assert.equal(findRecipeCombination(['rice', 'apple'], 'mix'), undefined);
assert.equal(findRecipeCombination(['egg', 'rice'], 'pan')?.recipe.id, 'egg_rice');
assert.equal(findRecipeCombination(['banana', 'egg', 'flour'], 'pan')?.id, 'dish_fruit_pancake_banana');
const batchBase = { ...stocked(), level: 50 };
const batch = craftRecipe(batchBase, 'egg_rice', false, 5, 'batch', now);
let separate = batchBase;
for (let i = 0; i < 5; i++) separate = craftRecipe(separate, 'egg_rice', false, 1, `single-${i}`, now);
assert.equal(batch.hearts, separate.hearts);
assert.deepEqual(batch.inventory, separate.inventory);
assert.equal(batch.partnerSchedule.skills.cooking.xp, 5, 'first recipe XP is not repeated per serving');
for (const [level, basic, skilled, master] of [[1, 3, 4, 6], [20, 6, 8, 11], [99, 18, 25, 34]]) {
  for (const [skillLevel, expected] of [[1, basic], [5, skilled], [10, master]]) {
    const pet = stocked();
    pet.level = level;
    pet.partnerSchedule.skills.cooking = { level: skillLevel, xp: 0, masterCompletions: 0 };
    assert.equal(getKitchenHeartReward(pet).heartsPerServing, expected);
    const made = craftRecipe(pet, 'egg_rice', false, 2, `reward-${level}-${skillLevel}`, now);
    assert.equal(made.hearts - pet.hearts, expected * 2, 'cooking hearts scale with both pet and cooking levels');
    assert.equal(made.inventory.dish_egg_rice - pet.inventory.dish_egg_rice, 2);
    assert.equal(made.kitchen.lastCraft?.baseHearts, basic * 2);
    assert.equal(made.kitchen.lastCraft?.skillHearts, (expected - basic) * 2);
    assert.deepEqual(normalizeKitchenState(made.kitchen).lastCraft, made.kitchen.lastCraft);
    assert.equal(craftRecipe(made, 'egg_rice', false, 2, `reward-${level}-${skillLevel}`, now), made);
  }
}
const thresholdPet = stocked();
thresholdPet.level = 20;
thresholdPet.partnerSchedule.skills.cooking = { level: 4, xp: 129, masterCompletions: 0 };
const thresholdMade = craftRecipe(thresholdPet, 'egg_rice', false, 5, 'skill-threshold', now);
assert.equal(thresholdMade.partnerSchedule.skills.cooking.level, 5);
assert.equal(thresholdMade.kitchen.lastCraft?.skillLevel, 4, 'the whole batch uses the skill before first-recipe XP');
assert.equal(thresholdMade.hearts, getKitchenHeartReward(thresholdPet).heartsPerServing * 5);
const historicalCraft = { id: 'old-craft', dishId: 'dish_egg_rice' as const, quantity: 1, hearts: 40, at: now };
assert.deepEqual(normalizeKitchenState({ lastCraft: historicalCraft }).lastCraft, historicalCraft, 'old rewards are displayed without recalculation');
assert.deepEqual(normalizeKitchenState({ lastCraft: { ...historicalCraft, baseHearts: NaN, skillHearts: 2, skillLevel: 10 } }).lastCraft, historicalCraft);
assert.deepEqual(getRecipe('plain_rice')?.effect, { hunger: 30 });
assert.deepEqual(getRecipeIngredientEntries(getRecipe('plain_rice')!), [{ id: 'rice', quantity: 1 }]);
assert.deepEqual(getCookingActions('pan', 'simmer'), ['add', 'simmer', 'serve']);
const riceMade = craftRecipe({ ...base, inventory: { rice: 1 } }, 'plain_rice', false, 1, 'plain-rice', now);
assert.equal(riceMade.inventory.dish_plain_rice, 1);
assert.equal(riceMade.inventory.rice ?? 0, 0);
assert.equal(riceMade.hearts, 3);
const cakePet: PetState = { ...stocked(), inventory: { emergency_biscuit: 41, strawberry_milk: 4, egg: 3 }, kitchen: { ...stocked().kitchen, equipment: ['mix', 'pan', 'oven'] } };
assert.equal(getCraftLimit(cakePet, 'biscuit_layer_cake'), 2);
const cake = craftRecipe(cakePet, 'biscuit_layer_cake', false, 2, 'cake-batch', now);
assert.deepEqual(cake.inventory, { emergency_biscuit: 1, egg: 1, dish_biscuit_layer_cake: 2 });
assert.equal(craftRecipe(cakePet, 'biscuit_layer_cake', false, 3, 'too-many-cakes', now), cakePet);
const insufficientCakePet = { ...cakePet, inventory: { emergency_biscuit: 19, strawberry_milk: 2, egg: 1 } };
assert.equal(getCraftLimit(insufficientCakePet, 'biscuit_layer_cake'), 0);
assert.equal(craftRecipe(insufficientCakePet, 'biscuit_layer_cake', false, 1, 'insufficient-cake', now), insufficientCakePet);
assert.equal(getCraftLimit({ ...cakePet, inventory: { emergency_biscuit: 40, strawberry_milk: 3, egg: 2 } }, 'biscuit_layer_cake'), 1, 'all ingredient amounts limit batch size');
assert.equal(findRecipeCombination(['emergency_biscuit', 'strawberry_milk', 'egg'], 'oven')?.recipe.id, 'biscuit_layer_cake');
assert.equal(craftRecipe({ ...starter, isSleeping: true }, 'egg_rice', false, 1, 'asleep', now).hearts, starter.hearts);
for (const [method, action] of [['mix', 'stir'], ['pan', 'flip'], ['blender', 'blend'], ['oven', 'bake']] as const) {
  assert.deepEqual(getCookingActions(method), ['add', action, 'serve']);
  let progress = createCookingProgress();
  let cookingTime = now;
  let dish = starter;
  for (let index = 0; index < 3; index++) {
    progress = beginCookingStep(progress, method, cookingTime);
    assert.equal(cookingActionSound(progress.action!), `kitchen_${getCookingActions(method)[index]}`);
    assert.equal(beginCookingStep(progress, method, cookingTime + 1), progress, 'rapid clicks do not skip an animation');
    assert.equal(finishCookingAnimation(progress, progress.readyAt - 1), progress);
    assert.equal(isCookingComplete(progress), false, 'reward waits for the final plating animation');
    cookingTime = progress.readyAt;
    progress = finishCookingAnimation(progress, cookingTime);
    if (isCookingComplete(progress)) dish = craftRecipe(dish, 'egg_rice', false, 1, `process-${method}`, cookingTime);
    assert.equal(dish.inventory.dish_egg_rice ?? 0, index === 2 ? 1 : 0, 'no materials or food change before completion');
  }
  assert.equal(isCookingComplete(progress), true);
  assert.equal(beginCookingStep(progress, method, cookingTime + 1), progress, 'a completed process cannot restart');
}
const fed = useInventoryItem(cooked, 'dish_egg_rice', now, { actorId: 'official.mint' });
assert.equal(fed.inventory.dish_egg_rice ?? 0, 0);
assert.equal(fed.kitchen.tasted['official.mint']?.dish_egg_rice, now);
assert.equal(fed.kitchen.tasted[actor], undefined);
assert.equal(recordDishTaste(fed, 'dish_egg_rice', 'official.mint', now).companionMemories.entries.length, 1);
assert.equal(useInventoryItem(starter, 'rice', now).inventory.rice, 1, 'raw materials cannot be eaten');
const purchased = buyItem(base, 'rice', now);
assert.equal(purchased.inventory.rice, 1);
assert.equal(purchased.coins, 18);

let catalogue = stocked();
for (const recipe of recipes.filter((recipe) => recipe.method === 'pan' || recipe.method === 'mix')) catalogue = craftRecipe(catalogue, recipe.id, false, 1, `cook-${recipe.id}`, now);
catalogue = buyKitchenEquipment(buyKitchenEquipment(catalogue, 'blender'), 'oven');
assert.deepEqual(catalogue.kitchen.equipment, ['mix', 'pan', 'blender', 'oven']);
const equipmentCoins = catalogue.coins;
assert.equal(buyKitchenEquipment(catalogue, 'oven').coins, equipmentCoins, 'equipment cannot be bought twice');
for (const { recipe, banana, id } of allDishes) {
  assert.ok(getRecipeIngredients(recipe, banana).every((id) => (catalogue.inventory[id] ?? 0) > 0));
  catalogue = craftRecipe(catalogue, recipe.id, banana, 1, `all-${id}`, now);
  catalogue = recordDishTaste(catalogue, id, actor, now);
}
assert.equal(Object.keys(catalogue.kitchen.made).length, 14);
assert.equal(Object.keys(catalogue.kitchen.tasted[actor]).length, 16);
assert.ok(catalogue.companionMemories.entries.some((entry) => entry.kind === 'menu_page'));
assert.ok(catalogue.companionMemories.entries.some((entry) => entry.kind === 'fruit_comparison'));
const registered = getInventoryDefinitions(createBuiltinItemRegistry(), catalogue.inventory);
assert.ok(allDishes.every(({ id }) => registered.some((item) => item.id === id && item.usable && item.source === 'builtin')));
assert.ok(evaluateAchievementUnlocks(catalogue).pet.achievements.unlockedAtById.kitchen_eight);
assert.equal(achievementDefinitions.find((item) => item.id === 'shop_item_collector')?.target, 23);
assert.equal(achievementDefinitions.find((item) => item.id === 'omnivore')?.target, 11);

for (const level of [1, 2]) {
  const locked: PetState = { ...base, level, inventory: { toy_ball: 2 }, miniGames: { ...base.miniGames, unlocked: ['matching', 'catch', 'bubbles'] } };
  for (const game of ['matching', 'catch', 'bubbles'] as const) {
    assert.equal(startMiniGame(locked, game, 'gentle', actor, `locked-${level}-${game}`, now), locked, 'owned tools cannot bypass the level gate or spend a ball');
    assert.equal(getMiniGameBaseHearts(level, game), 0, 'locked levels earn no game rewards');
  }
  const noWand = { ...locked, miniGames: base.miniGames };
  assert.equal(buyBubbleWand(noWand), noWand, 'the wand cannot be purchased before games unlock');
}

// Match the app's lifecycle refresh before input, plus its independent one-second refresh.
for (const game of ['matching', 'catch', 'bubbles'] as const) {
  const id = `live-${game}`;
  let live = startMiniGame({ ...playBase, inventory: { ...playBase.inventory, toy_ball: 2 }, miniGames: { ...playBase.miniGames, unlocked: ['matching', 'catch', 'bubbles'] } }, game, 'gentle', actor, id, now);
  const input = (action: MiniGameAction, at: number) => {
    live = actMiniGame(advancePet(live, at), id, action, at);
  };
  for (const offset of [100, 1000]) {
    live = advancePet(live, now + offset);
    assert.equal(live.miniGames.active?.paused, false, `${game}: lifecycle refresh must keep the game open`);
  }
  input(game === 'matching' ? { type: 'flip', index: 0 } : game === 'catch' ? { type: 'throw', targetX: getCatchPetX(live.miniGames.active!, now + 1100 + catchFlightMs) } : { type: 'blow' }, now + 1100);
  input({ type: 'tick' }, now + 1300);
  assert.equal(live.miniGames.active?.paused, false);
  assert.equal(live.miniGames.active?.elapsedMs, 1000, 'foreground tick baseline survives normalization');
  let lastInputAt = now + 2100;
  if (game === 'matching') {
    assert.deepEqual(live.miniGames.active?.flipped, [0], 'the first click must reach the game');
    const deck = live.miniGames.active!.deck;
    input({ type: 'flip', index: deck.findIndex((face, index) => index !== 0 && face === deck[0]) }, lastInputAt);
    assert.equal(live.miniGames.active?.matched.length, 2);
  } else if (game === 'catch') {
    assert.equal(live.miniGames.active?.throwAt, now + 1100);
    lastInputAt = now + 1100 + catchFlightMs;
    input({ type: 'tick' }, lastInputAt);
    assert.equal(live.miniGames.active?.streak, 1, 'a throw must survive refresh until the catch');
  } else {
    assert.equal(live.miniGames.active?.blowingAt, now + 1100);
    lastInputAt = now + 1100 + bubbleHoldMs;
    input({ type: 'release' }, lastInputAt);
    assert.equal(live.miniGames.active?.bubbles.length, 1);
    assert.equal(live.miniGames.active?.participationMs, bubbleHoldMs, 'holding through refresh still produces a bubble');
  }
  live = advancePet(live, lastInputAt + 1000);
  assert.equal(live.miniGames.active?.paused, false);
  if (game === 'catch') assert.equal(live.miniGames.active?.throwResult, 'caught', 'catch feedback survives refresh');
  const pausedLive = advancePet(pauseMiniGame(live), lastInputAt + 2000);
  assert.equal(pausedLive.miniGames.active?.paused, true, 'refresh must not resume an explicitly paused game');
  assert.equal(advancePet(resumeMiniGame(pausedLive, actor, lastInputAt + 2000), lastInputAt + 2100).miniGames.active?.paused, false);
  assert.equal(advancePet(live, now).miniGames.active?.paused, true, 'clock rollback still pauses games');
  const loaded = loadStoredPetJson(JSON.stringify(live), lastInputAt + 60000);
  assert.equal(loaded.status, 'ok');
  if (loaded.status !== 'ok') throw new Error('Live game save did not load');
  assert.equal(loaded.pet.miniGames.active?.paused, true, 'even a raw running save must load paused');
  assert.equal(loaded.pet.miniGames.active?.elapsedMs, live.miniGames.active?.elapsedMs, 'time away does not count as play');
  assert.deepEqual(loaded.pet.miniGames.active?.matched, live.miniGames.active?.matched);
  assert.deepEqual(loaded.pet.miniGames.active?.bubbles, live.miniGames.active?.bubbles);
  assert.equal(loaded.pet.hearts, live.hearts, 'loading does not award unfinished games');
  const belowLevel = { ...live, level: 2 };
  const blockedInput = actMiniGame(belowLevel, id, { type: 'tick' }, lastInputAt + 2000);
  assert.equal(blockedInput.miniGames.active?.paused, true, `${game}: existing games stop below Lv.3`);
  assert.equal(blockedInput.miniGames.active?.elapsedMs, live.miniGames.active?.elapsedMs);
  assert.equal(blockedInput.hearts, live.hearts);
  assert.deepEqual(blockedInput.inventory, live.inventory);
  assert.equal(resumeMiniGame(blockedInput, actor, lastInputAt + 2000), blockedInput, 'resume also checks the level gate');
  assert.equal(advancePet(belowLevel, lastInputAt + 2000).miniGames.active?.paused, true, 'live normalization cannot revive a locked game');
}
console.log('Live game regression: three games survive refresh and input; pause, resume, reload, and clock rollback passed.');

const finishMatching = (pet: PetState, id: string, mode: 'normal' | 'gentle') => {
  let next = startMiniGame(pet, 'matching', mode, actor, id, now);
  const deck = next.miniGames.active!.deck;
  for (let face = 0; face < 6; face++) for (let index = 0; index < 12; index++) if (deck[index] === face) next = actMiniGame(next, id, { type: 'flip', index }, now + 1000 + index * 100);
  return next;
};
for (const mode of ['normal', 'gentle'] as const) {
  const played = finishMatching(playBase, `pairs-${mode}`, mode);
  assert.equal(played.hearts, 5);
  assert.equal(played.miniGames.active, undefined);
  assert.equal(played.miniGames.records[`matching:${mode}`]?.completed, 1);
  assert.equal(played.achievements.counters.careActionCounts.play, 1);
  assert.equal(actMiniGame(played, `pairs-${mode}`, { type: 'finish' }, now), played);
}
let paused = startMiniGame(playBase, 'matching', 'normal', actor, 'paused', now);
paused = actMiniGame(paused, 'paused', { type: 'flip', index: 0 }, now + 100);
paused = pauseMiniGame(paused);
assert.equal(actMiniGame(paused, 'paused', { type: 'tick' }, now + 60000), paused);
assert.equal(resumeMiniGame(paused, 'official.mint', now + 60000), paused);
const resumed = resumeMiniGame(paused, actor, now + 60000);
assert.equal(resumed.miniGames.active?.elapsedMs, 0);
assert.deepEqual(resumed.miniGames.active?.flipped, [0]);
assert.equal(normalizeMiniGameState(resumed.miniGames).active?.paused, true);
assert.equal(actMiniGame({ ...resumed, isSleeping: true }, 'paused', { type: 'flip', index: 1 }, now + 60001).miniGames.active?.paused, true);

const finishCatch = (pet: PetState, id: string, caught: boolean) => {
  const startedAt = Math.max(now, pet.lastUpdatedAt + 1, pet.timeGuard.lastObservedAt + 1);
  let next = startMiniGame(acknowledgeMiniGameResult(pet, pet.miniGames.lastResult?.id ?? ''), 'catch', 'gentle', actor, id, startedAt);
  for (let round = 0; round < 10; round++) {
    const time = startedAt + round * 600;
    const targetX = caught ? getCatchPetX(next.miniGames.active!, time + catchFlightMs) : -0.2;
    next = actMiniGame(advancePet(next, time), id, { type: 'throw', targetX }, time);
    next = actMiniGame(advancePet(next, time + catchFlightMs), id, { type: 'tick' }, time + catchFlightMs);
  }
  return next;
};
const ball = unlockBallGame({ ...playBase, inventory: { ...playBase.inventory, toy_ball: 3 } });
assert.equal(startMiniGame(unlockBallGame(playBase), 'catch', 'gentle', actor, 'no-ball', now).miniGames.active, undefined, 'an unlocked game still requires a toy ball');
const ballStart = startMiniGame(ball, 'catch', 'normal', actor, 'early', now);
assert.equal(ballStart.inventory.toy_ball, 2);
assert.equal(startMiniGame(ballStart, 'catch', 'normal', actor, 'duplicate', now).inventory.toy_ball, 2, 'duplicate starts cannot charge twice');
assert.equal(resumeMiniGame(pauseMiniGame(ballStart), actor, now).inventory.toy_ball, 2, 'resuming does not charge again');
const earlyThrow = actMiniGame(ballStart, 'early', { type: 'throw', targetX: 0.5 }, now);
assert.equal(actMiniGame(earlyThrow, 'early', { type: 'throw', targetX: 0.8 }, now + 1).miniGames.active?.throwTargetX, 0.5, 'a second swipe cannot replace a flying ball');
assert.equal(actMiniGame(earlyThrow, 'early', { type: 'tick' }, now + 1).miniGames.active?.rounds, 0, 'rapid input cannot skip a throw');
const missed = finishCatch(ball, 'missed', false);
assert.equal(missed.hearts, 15, 'missing all throws still rewards completion');
assert.equal(missed.inventory.toy_ball, 2, 'ten throws cost one toy ball');
const record = finishCatch(ball, 'record', true);
assert.ok(record.companionMemories.entries.some((entry) => entry.kind === 'catch_record'));
const again = finishCatch(record, 'again', false);
assert.ok(again.companionMemories.entries.some((entry) => entry.kind === 'practice_photo'), 'the follow-up does not require another record');
assert.equal(again.hearts, 30);
assert.equal(again.inventory.toy_ball, 1);
let bubbles = startMiniGame(buyBubbleWand(playBase), 'bubbles', 'gentle', actor, 'bubbles', now);
assert.equal(actMiniGame(bubbles, 'bubbles', { type: 'finish' }, now).hearts, 0, 'entry alone earns nothing');
for (let index = 0; index < 3; index++) {
  const at = now + index * 2000;
  bubbles = actMiniGame(bubbles, 'bubbles', { type: 'blow' }, at);
  bubbles = actMiniGame(bubbles, 'bubbles', { type: 'release' }, at + bubbleHoldMs);
  bubbles = actMiniGame(bubbles, 'bubbles', { type: 'pop', index }, at + 1600);
  const participation = bubbles.miniGames.active!.participationMs;
  bubbles = actMiniGame(bubbles, 'bubbles', { type: 'pop', index }, at + 1700);
  assert.equal(bubbles.miniGames.active!.participationMs, participation, 'a bubble cannot be counted twice');
}
assert.equal(actMiniGame(bubbles, 'bubbles', { type: 'finish' }, now + bubbleSessionMs).hearts, 0, 'actual foreground time is required');
for (let second = 1; second <= 6; second++) bubbles = actMiniGame(bubbles, 'bubbles', { type: 'tick' }, now + second * 1000);
bubbles = actMiniGame(bubbles, 'bubbles', { type: 'finish' }, now + bubbleSessionMs);
assert.equal(bubbles.hearts, 5);
assert.equal(bubbles.miniGames.active, undefined);
assert.equal(buyBubbleWand(bubbles).coins, bubbles.coins);

for (const [level, expected] of [[3, 5], [10, 7], [20, 13], [50, 50], [99, 150]]) {
  assert.equal(getMiniGameBaseHearts(level), expected);
  assert.equal(getMiniGameBaseHearts(level, 'bubbles'), expected);
  assert.equal(getMiniGameBaseHearts(level, 'catch'), expected * 3);
  assert.equal(finishMatching({ ...base, level }, `level-${level}`, 'gentle').miniGames.lastResult?.hearts, expected);
  assert.equal(finishCatch({ ...ball, level }, `catch-level-${level}`, true).miniGames.lastResult?.hearts, expected * 3);
}
let frozen = startMiniGame({ ...base, level: 20 }, 'matching', 'gentle', actor, 'frozen', now);
frozen = normalizePet({ ...frozen, level: 99 }, now, { preserveMiniGameSession: true });
assert.equal(frozen.miniGames.active?.baseHearts, 13, 'reward is fixed at the starting level');
const legacySession = { ...frozen.miniGames.active, rewardLevel: undefined, baseHearts: 118 };
assert.equal(normalizePet({ ...frozen, miniGames: { ...frozen.miniGames, active: legacySession } }, now).miniGames.active?.baseHearts, 150, 'old sessions migrate to the new reward curve');
const legacyLocked = normalizePet({ ...resumed, level: 1, miniGames: { ...resumed.miniGames, active: { ...resumed.miniGames.active!, rewardLevel: 1, baseHearts: 80 } } }, now, { preserveMiniGameSession: true });
assert.equal(legacyLocked.miniGames.active?.paused, true);
assert.deepEqual(legacyLocked.miniGames.active?.flipped, [0], 'old games keep their progress while locked');
assert.equal(legacyLocked.miniGames.active?.rewardLevel, 3);
assert.equal(legacyLocked.miniGames.active?.baseHearts, 5);
assert.equal(resumeMiniGame(legacyLocked, actor, now), legacyLocked);
const legacyReady = resumeMiniGame({ ...legacyLocked, level: 3 }, actor, now);
assert.equal(legacyReady.miniGames.active?.paused, false, 'the old game can resume once Lv.3 is reached');
assert.deepEqual(legacyReady.miniGames.active?.flipped, [0]);
assert.equal(bubbles.miniGames.lastResult?.pending, true);
const resultImported = parseSaveFileText(createSaveFileText(bubbles, null, now + 6000), now + 12000).pet;
assert.equal(resultImported.miniGames.lastResult?.pending, true, 'unseen result survives reload');
assert.equal(startMiniGame(bubbles, 'matching', 'gentle', actor, 'before-seeing-result', now), bubbles);
const acknowledged = acknowledgeMiniGameResult(resultImported, 'bubbles');
assert.equal(acknowledged.hearts, resultImported.hearts);
assert.equal(acknowledged.miniGames.lastResult?.pending, false);
assert.equal(acknowledgeMiniGameResult(acknowledged, 'bubbles'), acknowledged, 'closing the result is idempotent');
assert.equal(actMiniGame(acknowledged, 'bubbles', { type: 'finish' }, now).hearts, acknowledged.hearts);
const feedbackBase = startMiniGame(playBase, 'matching', 'gentle', actor, 'feedback', now);
const feedbackFlip = actMiniGame(feedbackBase, 'feedback', { type: 'flip', index: 0 }, now + 100);
assert.equal(getMiniGameFeedback(feedbackBase.miniGames, feedbackFlip.miniGames, actor), 'flip');
assert.equal(getMiniGameFeedback(feedbackFlip.miniGames, actMiniGame(feedbackFlip, 'feedback', { type: 'flip', index: 0 }, now + 200).miniGames, actor), undefined, 'rejected clicks stay silent');
assert.equal(getMiniGameFeedback(feedbackFlip.miniGames, advancePet(feedbackFlip, now + 1000).miniGames, actor), undefined, 'refresh does not replay sound');
assert.equal(getMiniGameFeedback(base.miniGames, bubbles.miniGames, actor), 'finish');
assert.equal(getMiniGameFeedback(bubbles.miniGames, normalizePet(bubbles, now + 6000).miniGames, actor), undefined, 'result refresh does not replay completion sound');

const legacy = { ...base, inventory: { toy_ball: 1, 'sample:unknown': 2 } } as Partial<PetState>;
delete legacy.kitchen; delete legacy.miniGames; delete legacy.companionMemories;
const migrated = normalizePet(legacy, now);
assert.deepEqual(migrated.kitchen.made, {});
assert.ok(migrated.miniGames.unlocked.includes('catch'));
assert.equal(migrated.inventory['sample:unknown'], 2);
const imported = parseSaveFileText(createSaveFileText({ ...catalogue, miniGames: resumed.miniGames }, null, now), now + 86400000).pet;
assert.equal(imported.kitchen.made.egg_rice, catalogue.kitchen.made.egg_rice);
assert.equal(imported.companionMemories.entries[0].at, catalogue.companionMemories.entries[0].at, 'history dates are not shifted on import');
assert.deepEqual(imported.miniGames.active?.flipped, [0]);
assert.equal(imported.miniGames.active?.paused, true);
assert.equal(imported.miniGames.active?.elapsedMs, 0);
Math.random = originalRandom;
console.log('Companion activities: cooking process, skill hearts, all 16 dishes, weighted ingredients, memories, three games, rewards, and save compatibility passed.');

const storagePet = { ...stocked(), level: 20 };
const storageRegistry = createBuiltinItemRegistry();
const shopDefinitions = getShopDefinitions(storageRegistry);
const ingredients = filterBrowseItems(shopDefinitions, 'ingredients');
const food = filterBrowseItems(shopDefinitions, 'food');
assert.deepEqual(ingredients.map((item) => item.id).sort(), ['rice', 'egg', 'flour', 'carrot', 'apple', 'orange', 'banana', 'watermelon', 'ad_milk', 'strawberry_milk', 'emergency_biscuit'].sort());
for (const id of ['rice', 'egg', 'flour', 'carrot']) assert.ok(!food.some((item) => item.id === id), 'dedicated materials leave the food tab');
for (const id of ['apple', 'banana', 'ad_milk', 'strawberry_milk', 'emergency_biscuit']) assert.equal(food.find((item) => item.id === id), ingredients.find((item) => item.id === id), 'both categories reference the same item');
assert.equal(filterBrowseItems([...shopDefinitions, ...ingredients], 'all').length, shopDefinitions.length, 'All deduplicates shared ingredients');
const futureMaterial = { ...shopDefinitions[0], id: 'sample:herb' as const, displayName: 'Herb', displaySummary: 'Fresh cooking LEAVES', tags: ['kitchen_material'], source: 'mod' as const };
assert.equal(filterBrowseItems([futureMaterial], 'ingredients', ' leaves ')[0], futureMaterial, 'tagged future materials and case-insensitive description search work');
const customFood = { ...futureMaterial, id: 'sample:snack' as const, tags: [], usable: true };
assert.equal(filterBrowseItems([customFood], 'food')[0], customFood, 'existing Mod food keeps its category');
const appleDefinition = shopDefinitions.find((item) => item.id === 'apple')!;
const biscuitDefinition = shopDefinitions.find((item) => item.id === 'emergency_biscuit')!;
const defaultBrowse = createItemBrowseState();
const appleBrowse: ItemBrowseState = { ...defaultBrowse, selectedId: 'apple', quantity: 10 };
assert.equal(resolveItemBrowseState(appleBrowse, shopDefinitions, (item) => getItemBrowseLimit(storagePet, item, 'shop', now)), appleBrowse, 'a valid choice survives mode switches and refresh');
assert.equal(resolveItemBrowseState(appleBrowse, shopDefinitions, (item) => getItemBrowseLimit(base, item, 'shop', now)).quantity, 1, 'before Lv.20 purchases are single');
const lessStock = { ...storagePet, inventory: { apple: 3 } };
assert.equal(resolveItemBrowseState(appleBrowse, getInventoryDefinitions(storageRegistry, lessStock.inventory), (item) => getItemBrowseLimit(lessStock, item, 'bag')).quantity, 3, 'consumption clamps the selected quantity');
const afterAppleGone = { ...storagePet, inventory: { orange: 2 } };
const nextSelection = resolveItemBrowseState(appleBrowse, getInventoryDefinitions(storageRegistry, afterAppleGone.inventory), (item) => getItemBrowseLimit(afterAppleGone, item, 'bag'));
assert.equal(nextSelection.selectedId, 'orange'); assert.equal(nextSelection.quantity, 1);
assert.equal(resolveItemBrowseState(appleBrowse, [], () => 0).selectedId, undefined, 'an empty catalogue clears stale actions');
for (const id of ['golden_apple', 'birthday_cake']) assert.equal(getItemBrowseLimit(storagePet, getInventoryDefinitions(storageRegistry, storagePet.inventory).find((item) => item.id === id)!, 'bag'), 1);
assert.equal(getItemBrowseLimit(storagePet, biscuitDefinition, 'shop', now), 3);
const claimedBiscuits = buyItem(storagePet, 'emergency_biscuit', now, { quantity: 3 });
assert.equal(getItemBrowseLimit(claimedBiscuits, biscuitDefinition, 'shop', now), 0, 'free claims respect the daily cap');
const discountedId = getDailyShopDiscountInfo(storagePet, now)!.items[0].itemId;
const discountedDefinition = shopDefinitions.find((item) => item.id === discountedId)!;
const discountQuote = getItemPurchaseQuote(storagePet, discountedId, 5, now, discountedDefinition);
assert.equal(discountQuote.totalPrice, discountQuote.firstItemPrice + discountedDefinition.price * 4);
const boughtDiscount = buyItem(storagePet, discountedId, now, { quantity: 5 });
assert.equal(storagePet.coins - boughtDiscount.coins, discountQuote.totalPrice);
assert.equal(getItemPurchaseQuote(boughtDiscount, discountedId, 1, now).discountApplied, false, 'the first-item discount is consumed once');
const boughtApples = buyItem(storagePet, 'apple', now, { quantity: 5 });
const usedApples = useInventoryItem(boughtApples, 'apple', now, { quantity: 3 });
assert.equal(usedApples.inventory.apple, storagePet.inventory.apple! + 2, 'food and ingredient actions share one stock count');
assert.equal(getStorageReturnTarget('kitchen', null), 'kitchen');
assert.equal(getStorageReturnTarget('shop', 'kitchen'), 'kitchen');
assert.equal(getStorageReturnTarget('inventory', 'kitchen'), 'kitchen');
assert.equal(getStorageReturnTarget('play', null), 'play');
assert.equal(getStorageReturnTarget('shop', 'play'), 'play');
assert.equal(getStorageReturnTarget(null, 'kitchen'), null, 'a new home visit discards old return context');
console.log('Storage: shared ingredients, search, Mod categories, stock changes, batch limits, quotes, and activity return paths passed.');

// Render the actual React components through Vite, without a browser or touching player storage.
const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const [{ KitchenModal }, { PlayModal }, { HomePageV2 }, assets, { ShopModal }, { InventoryModal }, locale, { KitchenCookingModal }] = await Promise.all([
    server.ssrLoadModule('/src/ui/KitchenModal.tsx'), server.ssrLoadModule('/src/ui/PlayModal.tsx'), server.ssrLoadModule('/src/ui/HomePageV2.tsx'), server.ssrLoadModule('/src/assets.ts'),
    server.ssrLoadModule('/src/ui/ShopModal.tsx'), server.ssrLoadModule('/src/ui/InventoryModal.tsx'), server.ssrLoadModule('/src/i18n/index.ts'), server.ssrLoadModule('/src/ui/kitchen/KitchenCookingModal.tsx'),
  ]);
  const noop = () => {};
  const kitchenHtml = renderToStaticMarkup(createElement(KitchenModal, { pet: catalogue, actorId: actor, portrait: assets.petStatusImages.content, workingPortrait: assets.petActivityImages.work_food, icons: assets.itemIcons, registry: createBuiltinItemRegistry(), recipeId: 'egg_rice', banana: false, quantity: 1, onRecipe: noop, onBanana: noop, onQuantity: noop, update: noop, onClose: noop, onShop: noop, onFeed: noop }));
  assert.ok(kitchenHtml.includes('id="kitchen-title"'));
  assert.equal((kitchenHtml.match(/class="recipe-card/g) ?? []).length, 14);
  assert.ok(kitchenHtml.includes('白米饭') && kitchenHtml.includes('草莓饼干千层'));
  const cookingProps = { pet: catalogue, request: { id: 'render-cook', recipeId: 'egg_rice', banana: false, quantity: 1 }, portrait: assets.petActivityImages.work_food, icons: assets.itemIcons, update: noop, onBack: noop, onFeed: noop };
  for (const recipe of recipes) {
    const cookingHtml = renderToStaticMarkup(createElement(KitchenCookingModal, { ...cookingProps, request: { ...cookingProps.request, recipeId: recipe.id } }));
    assert.ok(cookingHtml.includes('id="cooking-title"') && !cookingHtml.includes('id="kitchen-title"'));
    assert.ok(cookingHtml.includes(`cooking-method--${recipe.method}`));
    assert.ok(!cookingHtml.includes('src="undefined"') && !cookingHtml.includes('cooking-reward-hearts'));
  }
  const cookingResultHtml = renderToStaticMarkup(createElement(KitchenCookingModal, { ...cookingProps, pet: cooked, request: { ...cookingProps.request, id: 'first' } }));
  assert.ok(cookingResultHtml.includes('一起做好啦') && cookingResultHtml.includes('料理 Lv.1 +0'));
  assert.ok(cookingResultHtml.includes('cooking-reward-hearts') && !cookingResultHtml.includes('cooking-stage'));
  const oldCookingHtml = renderToStaticMarkup(createElement(KitchenCookingModal, { ...cookingProps, pet: { ...cooked, kitchen: { ...cooked.kitchen, lastCraft: historicalCraft } }, request: { ...cookingProps.request, id: historicalCraft.id } }));
  assert.ok(oldCookingHtml.includes('+40') && !oldCookingHtml.includes('undefined'));
  const playProps = { pet: playBase, actorId: actor, portrait: assets.petStatusImages.content, happyPortrait: assets.petActivityImages.happy, onClose: noop, onShop: noop, onQuickPlay: noop, update: noop, onAct: noop };
  const playHtml = renderToStaticMarkup(createElement(PlayModal, playProps));
  assert.equal((playHtml.match(/class="play-game-card /g) ?? []).length, 3);
  assert.ok(playHtml.includes(assets.itemIcons.toy_ball), 'the lobby uses the existing toy ball');
  const customBallImage = '/test/toy-ball.png';
  const customBallLobby = renderToStaticMarkup(createElement(PlayModal, { ...playProps, ballImage: customBallImage }));
  assert.ok(customBallLobby.includes(`src="${customBallImage}"`));
  const waitingBallHtml = renderToStaticMarkup(createElement(PlayModal, { ...playProps, pet: ballStart, ballImage: customBallImage }));
  assert.equal((waitingBallHtml.match(/src="\/test\/toy-ball.png"/g) ?? []).length, 1);
  const flyingBallHtml = renderToStaticMarkup(createElement(PlayModal, { ...playProps, pet: earlyThrow, ballImage: customBallImage }));
  assert.equal((flyingBallHtml.match(/src="\/test\/toy-ball.png"/g) ?? []).length, 2, 'waiting and flying balls share the supplied image');
  assert.ok(!flyingBallHtml.includes('⚽'));
  for (const locked of [base, { ...base, level: 2 }, legacyLocked]) {
    const lockedHtml = renderToStaticMarkup(createElement(PlayModal, { ...playProps, pet: locked }));
    assert.ok(lockedHtml.includes('Lv.3 解锁小游戏'));
    assert.ok(!lockedHtml.includes('class="play-game-card ') && !lockedHtml.includes('matching-board'), 'a locked modal cannot offer games, purchases, or an old board');
  }
  for (const game of ['matching', 'catch', 'bubbles'] as const) {
    const started = startMiniGame({ ...playBase, inventory: { ...playBase.inventory, toy_ball: 1 }, miniGames: { ...playBase.miniGames, unlocked: ['matching', 'catch', 'bubbles'] } }, game, 'gentle', actor, `render-${game}`, now);
    assert.ok(renderToStaticMarkup(createElement(PlayModal, { ...playProps, pet: started })).includes(`${game === 'catch' ? 'catch' : game}-board`));
  }
  const resultHtml = renderToStaticMarkup(createElement(PlayModal, { ...playProps, pet: bubbles }));
  assert.ok(resultHtml.includes('id="play-reward-title"'));
  assert.ok(resultHtml.includes('+5'));
  assert.ok(!resultHtml.includes('class="play-game-card '), 'the result is shown as a dedicated modal');
  const { getSwipeThrowTarget } = await server.ssrLoadModule('/src/ui/play/CatchBoard.tsx');
  assert.equal(getSwipeThrowTarget({ x: .5, y: .8 }, { x: .5, y: .78 }), undefined, 'a tap does not throw');
  assert.equal(getSwipeThrowTarget({ x: .5, y: .8 }, { x: .5, y: .2 }), .5);
  assert.ok(getSwipeThrowTarget({ x: .5, y: .8 }, { x: .7, y: .2 }) > .5, 'swipe direction controls the throw');
  const homeProps = { pet: base, actorId: actor, neighbors: [], adventure: { status: 'locked' }, hasAchievementNotice: false, onOpenShop: noop, onOpenAchievements: noop, onOpenBoostCards: noop, onOpenGacha: noop, onOpenCommonDreams: noop, petStatusImages: assets.petStatusImages, petActivityImages: assets.petActivityImages, getStatusLabel: () => 'content', canUpgrade: false, nextUpgradeCost: 8, onInteract: noop, onUpgrade: noop, onOpenInventory: noop, onOpenPlay: noop, onOpenKitchen: noop, onOpenGarden: noop, onOpenPartnerSchedule: noop, onOpenPomodoro: noop, onDailyWish: noop, onReturnWelcome: noop, onAction: noop, onOpenMemories: noop };
  const homeHtml = renderToStaticMarkup(createElement(HomePageV2, homeProps));
  assert.ok(homeHtml.includes('home-quick kitchen'));
  assert.ok(homeHtml.includes('home-care-bar'));
  for (const tone of ['peach', 'rose', 'lilac', 'gold', 'sky', 'mint']) assert.ok(homeHtml.includes(`data-tone="${tone}"`));
  for (const level of [1, 2, 3]) {
    const html = renderToStaticMarkup(createElement(HomePageV2, { ...homeProps, pet: { ...base, level } }));
    const playEntry = html.match(/<button class="home-quick play"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(playEntry);
    assert.equal(playEntry.includes('disabled=""'), level < 3, 'the home entry unlocks exactly at Lv.3');
    assert.equal(playEntry.includes('Lv.3 解锁'), level < 3);
  }
  assert.ok(!kitchenHtml.includes('src="undefined"'));
  const storageProps = { pet: storagePet, items: shopDefinitions, browse: { ...defaultBrowse, category: 'ingredients', selectedId: 'apple', quantity: 5 }, onBrowseChange: noop, itemIconMap: assets.itemIcons, onClose: noop };
  const shopProps = { ...storageProps, onOpenInventory: noop, onBuyItem: noop, onExchangeHeart: noop, isHeartExchangeCoolingDown: false };
  const inventoryProps = { ...storageProps, items: getInventoryDefinitions(storageRegistry, storagePet.inventory), isPetBusy: false, onOpenShop: noop, onOpenGarden: noop, onOpenKitchen: noop, onUseItem: noop };
  const shopHtml = renderToStaticMarkup(createElement(ShopModal, shopProps));
  const inventoryHtml = renderToStaticMarkup(createElement(InventoryModal, inventoryProps));
  assert.equal((shopHtml.match(/class="storage-item-tile"/g) ?? []).length, 11);
  assert.ok(shopHtml.includes('storage-detail') && shopHtml.includes('storage-exchange') && shopHtml.includes('购买 5 件'));
  assert.ok(shopHtml.includes('食材') && shopHtml.includes('type="search"'));
  assert.ok(inventoryHtml.includes('喂食 ×5') && inventoryHtml.includes('留着做菜'));
  const rawMaterialHtml = renderToStaticMarkup(createElement(InventoryModal, { ...inventoryProps, browse: { ...defaultBrowse, category: 'ingredients', selectedId: 'rice' } }));
  assert.ok(rawMaterialHtml.includes('去厨房') && !rawMaterialHtml.includes('data-use-item="rice"'));
  const busyHtml = renderToStaticMarkup(createElement(InventoryModal, { ...inventoryProps, isPetBusy: true }));
  assert.ok(busyHtml.includes('data-use-item="apple" disabled=""'));
  const emptyHtml = renderToStaticMarkup(createElement(InventoryModal, { ...inventoryProps, pet: { ...storagePet, inventory: {} }, items: [] }));
  assert.ok(emptyHtml.includes('storage-empty') && !emptyHtml.includes('data-use-item='));
  const searchedHtml = renderToStaticMarkup(createElement(ShopModal, { ...shopProps, browse: { ...defaultBrowse, query: 'nothing-matches' } }));
  assert.ok(searchedHtml.includes('没有找到符合的物品') && !searchedHtml.includes('data-buy-item='));
  const claimHtml = renderToStaticMarkup(createElement(ShopModal, { ...shopProps, pet: claimedBiscuits, browse: { ...defaultBrowse, selectedId: 'emergency_biscuit', quantity: 10 } }));
  assert.ok(claimHtml.includes('data-buy-item="emergency_biscuit" disabled=""'));
  const discountHtml = renderToStaticMarkup(createElement(ShopModal, { ...shopProps, browse: { ...defaultBrowse, selectedId: discountedId, quantity: 5 } }));
  assert.ok(discountHtml.includes(`<strong title="${locale.t('ui.shop.price', { price: discountQuote.totalPrice })}"`), 'the detail displays the actual bulk quote');
  for (const html of [shopHtml, inventoryHtml, rawMaterialHtml, claimHtml]) assert.ok(!html.includes('src="undefined"'));
  locale.setLanguage('en-US');
  try {
    const englishShop = renderToStaticMarkup(createElement(ShopModal, shopProps));
    const englishBag = renderToStaticMarkup(createElement(InventoryModal, inventoryProps));
    const englishCooking = renderToStaticMarkup(createElement(KitchenCookingModal, cookingProps));
    assert.ok(englishCooking.includes('Add ingredients') && englishCooking.includes('Toss the pan'));
    assert.ok(englishShop.includes('Ingredients') && englishShop.includes('Buy 5'));
    assert.ok(englishBag.includes('Feed ×5') && englishBag.includes('Cook with it'));
    assert.ok(!englishShop.includes('ui.shop.') && !englishBag.includes('ui.inventory.'));
  } finally { locale.setLanguage('zh-CN'); }
  console.log('Storage rendering: grid/detail, raw and edible ingredients, empty/busy/claim states, quotes, ball images, colors, and both languages passed.');
  console.log('React rendering: new home, kitchen, game lobby, and all three game boards passed.');
} finally { await server.close(); }
