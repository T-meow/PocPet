import { recordEarnedHearts } from './achievements';
import { addInventoryItem, removeInventoryItem } from './items';
import { addSkillXp, formatPracticeSkillXp, partnerScheduleMaxSkillLevel, practiceSkillXp } from './partnerSchedule';
import { clampCount } from './petStats';
import type { PetState } from './petTypes';
import type { CookingMethod, DishId, KitchenState, RecipeId, MilkChoice } from './companionActivityTypes';
import { activityText, cookingMethods, dishName, getDish, getDishId, getRecipe, getRecipeIngredientEntries, getRecipeUnlockReason, recipes } from './kitchenRecipes';
import { recordCommunityTaskEvent } from './communityCommissions';
import { rememberTogether } from './companionMemories';
import { isExpeditionAway } from './expeditionData';

const kitchenFirstRecipeXp = 5;
export const getKitchenSkillXpReward = (pet: PetState, recipeId: RecipeId) => pet.partnerSchedule.skills.cooking.level >= partnerScheduleMaxSkillLevel
  ? 0 : practiceSkillXp + (pet.kitchen.made[recipeId] ? 0 : kitchenFirstRecipeXp);
export const getKitchenHeartReward = (pet: PetState, recipeId: RecipeId, banana = false) => {
  const recipe = getRecipe(recipeId);
  const skillLevel = Math.max(1, Math.min(partnerScheduleMaxSkillLevel, Math.floor(pet.partnerSchedule.skills.cooking.level)));
  const skillBonusPercent = (skillLevel - 1) * 10;
  const inputBudgets = recipe ? getRecipeIngredientEntries(recipe, banana).map(({ id, quantity }) => ({ hearts: getDish(id)?.recipe.chainHearts ?? 0, quantity })) : [];
  const chainHearts = recipe?.chainHearts ?? 0;
  const baseHearts = chainHearts - inputBudgets.reduce((sum, input) => sum + input.hearts * input.quantity, 0);
  // Round whole-chain budgets before subtraction so extra processing cannot mint hearts.
  const scaleBudget = (hearts: number) => Math.round(hearts * (100 + skillBonusPercent) / 100);
  const heartsPerServing = scaleBudget(chainHearts) - inputBudgets.reduce((sum, input) => sum + scaleBudget(input.hearts) * input.quantity, 0);
  return { baseHearts, skillLevel, skillBonusPercent, skillHearts: heartsPerServing - baseHearts, heartsPerServing };
};
export const defaultKitchenState = (): KitchenState => ({ schemaVersion: 1, starterClaimed: false, equipment: ['mix', 'pan'], made: {}, firstMadeAt: {}, tasted: {}, recentOperationIds: [], plating: 'plain' });
export const normalizeKitchenState = (raw: unknown): KitchenState => {
  const value = raw && typeof raw === 'object' ? raw as Partial<KitchenState> : {};
  const next = defaultKitchenState();
  next.starterClaimed = value.starterClaimed === true;
  const equipment = Array.isArray(value.equipment) ? value.equipment : [];
  next.equipment = cookingMethods.filter((method) => method.price === 0 || equipment.includes(method.id)).map((method) => method.id);
  for (const recipe of recipes) {
    const count = value.made?.[recipe.id];
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) next.made[recipe.id] = Math.floor(count);
    const at = value.firstMadeAt?.[recipe.id];
    if (typeof at === 'number' && Number.isFinite(at) && at >= 0) next.firstMadeAt[recipe.id] = at;
  }
  if (value.tasted && typeof value.tasted === 'object') for (const [actor, dishes] of Object.entries(value.tasted)) {
    if (!dishes || typeof dishes !== 'object') continue;
    const tastes: Partial<Record<DishId, number>> = {};
    for (const [id, at] of Object.entries(dishes)) if (getDish(id) && typeof at === 'number' && Number.isFinite(at) && at >= 0) tastes[id as DishId] = at;
    next.tasted[actor.slice(0, 128)] = tastes;
  }
  next.recentOperationIds = Array.isArray(value.recentOperationIds) ? [...new Set(value.recentOperationIds.filter((id) => typeof id === 'string').slice(-32).map((id) => id.slice(0, 128)))] : [];
  next.plating = value.plating === 'flower' || value.plating === 'stars' ? value.plating : 'plain';
  const result = value.lastCraft;
  if (result && typeof result.id === 'string' && getDish(result.dishId) && Number.isInteger(result.quantity) && result.quantity > 0 && result.quantity <= 99 && Number.isFinite(result.hearts) && result.hearts >= 0 && Number.isFinite(result.at)) {
    next.lastCraft = { id: result.id.slice(0, 128), dishId: result.dishId, quantity: result.quantity, hearts: result.hearts, at: result.at };
    if (result.milk === 'farm_milk' || result.milk === 'ad_milk') next.lastCraft.milk = result.milk;
    if (typeof result.skillXp === 'number' && Number.isInteger(result.skillXp) && result.skillXp >= 0 && result.skillXp <= practiceSkillXp + kitchenFirstRecipeXp) next.lastCraft.skillXp = result.skillXp;
    if (typeof result.baseHearts === 'number' && Number.isFinite(result.baseHearts) && result.baseHearts >= 0 && typeof result.skillHearts === 'number' && Number.isFinite(result.skillHearts) && result.skillHearts >= 0 && typeof result.skillLevel === 'number' && Number.isInteger(result.skillLevel) && result.skillLevel >= 1 && result.skillLevel <= partnerScheduleMaxSkillLevel) {
      Object.assign(next.lastCraft, { baseHearts: result.baseHearts, skillHearts: result.skillHearts, skillLevel: result.skillLevel });
    }
  }
  return next;
};
export const kitchenMadeCount = (pet: PetState) => Object.values(pet.kitchen.made).reduce((sum, count) => sum + (count ?? 0), 0);
export const kitchenRecipeCount = (pet: PetState) => recipes.filter((recipe) => (pet.kitchen.made[recipe.id] ?? 0) > 0).length;
export const canSpendCompanionTime = (pet: PetState) => !pet.isSleeping && !pet.partnerSchedule.active && !pet.adventure.active && !isExpeditionAway(pet) && !pet.community.fishing.active && (!pet.miniGames.active || pet.miniGames.active.paused);
export const claimKitchenStarter = (pet: PetState): PetState => {
  if (pet.kitchen.starterClaimed) return pet;
  const inventory = ['apple', 'orange', 'rice', 'egg'].reduce((stock, id) => addInventoryItem(stock, id as 'apple' | 'orange' | 'rice' | 'egg', 1), pet.inventory);
  return { ...pet, inventory, kitchen: { ...pet.kitchen, starterClaimed: true } };
};
export const getCraftLimit = (pet: PetState, recipeId: RecipeId, banana = false, milk?: MilkChoice) => {
  if (milk !== undefined && milk !== 'farm_milk' && milk !== 'ad_milk') return 0;
  if (getRecipeUnlockReason(pet, recipeId)) return 0;
  const recipe = getRecipe(recipeId);
  if (!recipe) return 0;
  return Math.max(0, Math.min(99, 9999 - (pet.inventory[getDishId(recipe, banana)] ?? 0), ...getRecipeIngredientEntries(recipe, banana, milk).map(({ id, quantity }) => Math.floor((pet.inventory[id] ?? 0) / quantity))));
};
export const canCraftRecipe = (pet: PetState, recipeId: RecipeId, banana: boolean, quantity: number, milk?: MilkChoice) => {
  const recipe = getRecipe(recipeId);
  return Boolean(recipe && !pet.timePause && canSpendCompanionTime(pet) && pet.kitchen.equipment.includes(recipe.method) && Number.isInteger(quantity) && quantity >= 1 && quantity <= getCraftLimit(pet, recipeId, banana, milk));
};
export const craftRecipe = (pet: PetState, recipeId: RecipeId, banana: boolean, quantity: number, operationId: string, now = Date.now(), milk?: MilkChoice): PetState => {
  const recipe = getRecipe(recipeId);
  if (!recipe || !operationId || pet.kitchen.recentOperationIds.includes(operationId) || !canCraftRecipe(pet, recipeId, banana, quantity, milk)) return pet;
  const dishId = getDishId(recipe, banana);
  const first = !pet.kitchen.made[recipeId];
  let next: PetState = { ...pet, lastInteractionAt: now, kitchen: { ...pet.kitchen, made: { ...pet.kitchen.made, [recipeId]: (pet.kitchen.made[recipeId] ?? 0) + quantity }, firstMadeAt: first ? { ...pet.kitchen.firstMadeAt, [recipeId]: now } : pet.kitchen.firstMadeAt, recentOperationIds: [...pet.kitchen.recentOperationIds, operationId].slice(-32) } };
  next.inventory = getRecipeIngredientEntries(recipe, banana, milk).reduce((stock, ingredient) => removeInventoryItem(stock, ingredient.id, ingredient.quantity * quantity), pet.inventory);
  next.inventory = addInventoryItem(next.inventory, dishId, quantity);
  const reward = getKitchenHeartReward(pet, recipeId, banana);
  const skillXp = getKitchenSkillXpReward(pet, recipeId);
  const nextHearts = clampCount(next.hearts + reward.heartsPerServing * quantity);
  const hearts = nextHearts - next.hearts;
  next = { ...next, hearts: nextHearts };
  if (skillXp > 0) next.partnerSchedule = { ...next.partnerSchedule, skills: { ...next.partnerSchedule.skills, cooking: addSkillXp(next.partnerSchedule.skills.cooking, skillXp) } };
  next.kitchen.lastCraft = { id: operationId, dishId, quantity, hearts, baseHearts: reward.baseHearts * quantity, skillHearts: reward.skillHearts * quantity, skillLevel: reward.skillLevel, skillXp, at: now, ...(milk ? { milk } : {}) };
  next.recentActivity = 'work_food';
  next.recentActivityUntil = now + 3000;
  next.recentEvent = activityText(`一起做好了 ${quantity} 份${dishName(dishId)}，收获 ${hearts} 颗心心。`, `Made ${quantity} × ${dishName(dishId)} together and earned ${hearts} hearts.`);
  if (skillXp > 0) next.recentEvent += ` ${formatPracticeSkillXp('cooking', skillXp)}`;
  if (recipeId === 'herb_porridge') next = recordCommunityTaskEvent(next, 'cook_porridge', now);
  return recordEarnedHearts(next, hearts);
};
export const buyKitchenEquipment = (pet: PetState, id: CookingMethod): PetState => {
  const equipment = cookingMethods.find((item) => item.id === id);
  if (!equipment || pet.kitchen.equipment.includes(id) || kitchenRecipeCount(pet) < equipment.requiredRecipes || pet.coins < equipment.price) return pet;
  return { ...pet, coins: pet.coins - equipment.price, kitchen: { ...pet.kitchen, equipment: [...pet.kitchen.equipment, id] }, recentEvent: activityText(`厨房添置了${equipment.name}。`, `Added a ${equipment.en.toLowerCase()} to the kitchen.`) };
};
export const recordDishTaste = (pet: PetState, itemId: string, actorId: string, now: number): PetState => {
  const dish = getDish(itemId);
  if (!dish) return pet;
  const previous = pet.kitchen.tasted[actorId] ?? {};
  let next = pet;
  if (previous[dish.id] === undefined) {
    next = { ...pet, kitchen: { ...pet.kitchen, tasted: { ...pet.kitchen.tasted, [actorId]: { ...previous, [dish.id]: now } } } };
    next = rememberTogether(next, actorId, 'first_taste', dish.id, now);
    next.recentEvent += activityText(' 这是我们第一次尝到这个味道，记下来啦。', ' Our first taste of this recipe — a memory to keep.');
  }
  const tasted = next.kitchen.tasted[actorId] ?? {};
  if (tasted.dish_egg_rice !== undefined && recipes.some((recipe) => recipe.main && recipe.id !== 'egg_rice' && tasted[getDishId(recipe)] !== undefined)) next = rememberTogether(next, actorId, 'menu_page', 'first_menu', now);
  if (tasted.dish_fruit_pancake !== undefined && tasted.dish_fruit_pancake_banana !== undefined) next = rememberTogether(next, actorId, 'fruit_comparison', 'pancakes', now);
  return next;
};
