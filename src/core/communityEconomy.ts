import { adventureTreasureValues } from './adventureItems';
import { fish } from './communityData';
import { getDish, getRecipeIngredientEntries, kitchenMaterials } from './kitchenRecipes';
import { expeditionProducts } from './expeditionData';
import { productionIngredients, wildIngredients, type SaleDemand } from './foodCatalog';
import { regionalTreasures } from './regionalTreasures';
import { getShopItem } from './items';
import { processingRecipes } from './foodProcessing';
import type { BuiltinItemId } from './petTypes';

// Only explicitly priced built-ins are saleable. Mod prices, free rewards,
// unique discoveries, seeds and reusable tools never become implicit buybacks.
const produce: Record<string, number> = {
  apple: 4, orange: 4, banana: 5, watermelon: 8, ad_milk: 7, strawberry_milk: 8,
  creek_herb: 6, farm_milk: 8, community_wood: 4, community_stone: 3,
  pig_trotter: 19,
  ...Object.fromEntries(kitchenMaterials.map(item => [item.id, Math.floor(item.price * .4)])),
};
interface CommunitySale { base: number; collector: boolean; exchangeOnly: boolean; demand: SaleDemand; craft?: { processPremium: number; gatheringPremium: number } }
// This is deliberately stricter than the first-unit discount: every purchased
// input is priced at 70%, through all processing and both interchangeable milks.
const purchasedCosts = new Map<string, number>();
const purchasedCost = (id: string): number => {
  if (purchasedCosts.has(id)) return purchasedCosts.get(id)!;
  const shop = getShopItem(id as BuiltinItemId), dish = getDish(id);
  const direct = shop && shop.price > 0 ? Math.ceil(shop.price * .7) : Infinity;
  const processed = processingRecipes.filter(r => r.output === id).map(r => (r.fee + Object.entries(r.inputs).reduce((sum, [item, count]) => sum + purchasedCost(item) * count, 0)) / r.quantity);
  const cooked = dish ? (['farm_milk', 'ad_milk'] as const).map(milk => getRecipeIngredientEntries(dish.recipe, dish.banana, milk).reduce((sum, entry) => sum + purchasedCost(entry.id) * entry.quantity, 0)) : [];
  const cost = Math.min(direct, ...processed, ...cooked);
  purchasedCosts.set(id, cost);
  return cost;
};
const gatheringValue = (id: string): number => {
  if (Object.prototype.hasOwnProperty.call(wildIngredients, id)) return wildIngredients[id as keyof typeof wildIngredients].base;
  if (Object.prototype.hasOwnProperty.call(fish, id)) return fish[id as keyof typeof fish].base;
  if (['valley_mushroom', 'hill_honey', 'forest_berry', 'coast_kelp'].includes(id)) return expeditionProducts[id as keyof typeof expeditionProducts].base;
  if (id === 'creek_herb') return produce.creek_herb;
  const process = processingRecipes.find(r => r.output === id);
  return process ? Object.entries(process.inputs).reduce((sum, [item, count]) => sum + gatheringValue(item) * count, 0) / process.quantity : 0;
};
export const getCommunitySale = (id: string): CommunitySale | undefined => {
  if (Object.prototype.hasOwnProperty.call(regionalTreasures, id)) return { base: regionalTreasures[id as keyof typeof regionalTreasures].base, collector: true, exchangeOnly: false, demand: 'collector' };
  const ingredient = Object.prototype.hasOwnProperty.call(productionIngredients, id) ? productionIngredients[id as keyof typeof productionIngredients] : Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  if (ingredient) return { base: ingredient.base, collector: false, exchangeOnly: false, demand: ingredient.demand };
  if (Object.prototype.hasOwnProperty.call(expeditionProducts, id)) { const product = expeditionProducts[id as keyof typeof expeditionProducts]; return product.base ? { base: product.base, collector: id === 'sea_glass', exchangeOnly: false, demand: id === 'sea_glass' ? 'collector' : 'specialty' } : undefined; }
  if (id === 'coin_hoard') return { base: adventureTreasureValues.coin_hoard, collector: false, exchangeOnly: true, demand: 'basic' };
  if (id === 'valley_amber' || id === 'ancient_gold_bar') return { base: adventureTreasureValues[id], collector: true, exchangeOnly: false, demand: 'collector' };
  if (Object.prototype.hasOwnProperty.call(fish, id)) { const value = fish[id as keyof typeof fish]; return { base: value.base, collector: value.rare, exchangeOnly: false, demand: value.rare ? 'collector' : value.rarity === 'rare' ? 'specialty' : 'basic' }; }
  if (Object.prototype.hasOwnProperty.call(produce, id)) return { base: produce[id], collector: false, exchangeOnly: false, demand: 'basic' };
  const dish = getDish(id);
  if (!dish) return undefined;
  // Select the cheaper recovery value, never reward changing milk in a recipe.
  const ingredients = getRecipeIngredientEntries(dish.recipe, dish.banana, 'ad_milk');
  const prices = ingredients.map(entry => getCommunitySale(entry.id));
  if (prices.some(value => !value)) return undefined;
  const inheritedProcess = prices.reduce((sum, value, index) => sum + (value!.craft?.processPremium ?? 0) * ingredients[index].quantity, 0);
  const inheritedGathering = prices.reduce((sum, value, index) => sum + (value!.craft?.gatheringPremium ?? 0) * ingredients[index].quantity, 0);
  const materialBase = prices.reduce((sum, value, index) => sum + value!.base * ingredients[index].quantity, 0) + 2 - inheritedProcess - inheritedGathering;
  const extraSteps = ingredients.reduce((sum, entry) => sum + (getDish(entry.id) || ['cream', 'cheese', 'forest_berry_jam', 'cooking_oil'].includes(entry.id) ? entry.quantity : 0), 0);
  const gathered = ingredients.reduce((sum, entry) => sum + gatheringValue(entry.id) * entry.quantity, 0);
  const cost = purchasedCost(id);
  // Largest integer base whose 140% stall quote cannot exceed purchased inputs.
  const ceiling = Number.isFinite(cost) ? Math.ceil((Math.floor(cost) + 1) * 100 / 140) - 1 : Infinity;
  const room = Math.max(0, ceiling - materialBase);
  const processPremium = Math.min(inheritedProcess + extraSteps * 12, room);
  const gatheringPremium = Math.min(inheritedGathering + Math.ceil(gathered * .7), room - processPremium);
  return { base: materialBase + processPremium + gatheringPremium, collector: false, exchangeOnly: false, demand: dish.recipe.demand, craft: { processPremium, gatheringPremium } };
};
export const getCuisineSaleNote = (id: string): string => {
  const craft = getCommunitySale(id)?.craft;
  if (!craft || !craft.processPremium && !craft.gatheringPremium) return '';
  return [craft.processPremium ? `工序加价 +${craft.processPremium}` : '', craft.gatheringPremium ? `采集加价 +${craft.gatheringPremium}` : ''].filter(Boolean).join(' · ') + '（已计入基础售价）';
};
