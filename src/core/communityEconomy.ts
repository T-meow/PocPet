import { adventureTreasureValues } from './adventureItems';
import { fish } from './communityData';
import { getDish, getRecipeIngredientEntries, kitchenMaterials } from './kitchenRecipes';
import { expeditionProducts } from './expeditionData';

// Only explicitly priced built-ins are saleable. Mod prices, free rewards,
// unique discoveries, seeds and reusable tools never become implicit buybacks.
const produce: Record<string, number> = {
  apple: 4, orange: 4, banana: 5, watermelon: 8, ad_milk: 7, strawberry_milk: 8,
  creek_herb: 6, farm_milk: 8, community_wood: 4, community_stone: 3,
  ...Object.fromEntries(kitchenMaterials.map(item => [item.id, Math.floor(item.price * .4)])),
};
export const getCommunitySale = (id: string): { base: number; collector: boolean; exchangeOnly: boolean } | undefined => {
  if (Object.prototype.hasOwnProperty.call(expeditionProducts, id)) { const product = expeditionProducts[id as keyof typeof expeditionProducts]; return product.base ? { base: product.base, collector: id === 'sea_glass', exchangeOnly: false } : undefined; }
  if (id === 'coin_hoard') return { base: adventureTreasureValues.coin_hoard, collector: false, exchangeOnly: true };
  if (id === 'valley_amber' || id === 'ancient_gold_bar') return { base: adventureTreasureValues[id], collector: true, exchangeOnly: false };
  if (Object.prototype.hasOwnProperty.call(fish, id)) { const value = fish[id as keyof typeof fish]; return { base: value.base, collector: value.rare, exchangeOnly: false }; }
  if (Object.prototype.hasOwnProperty.call(produce, id)) return { base: produce[id], collector: false, exchangeOnly: false };
  const dish = getDish(id);
  if (!dish) return undefined;
  const ingredients = getRecipeIngredientEntries(dish.recipe, dish.banana);
  const prices = ingredients.map(entry => getCommunitySale(entry.id));
  if (prices.some(value => !value)) return undefined;
  return { base: prices.reduce((sum, value, index) => sum + value!.base * ingredients[index].quantity, 0) + 2, collector: false, exchangeOnly: false };
};
