import { adventureTreasureValues } from './adventureItems';
import { animals, fish } from './communityData';
import { getDish, getRecipeIngredientEntries, kitchenMaterials, type RecipeDefinition } from './kitchenRecipes';
import { expeditionProducts } from './expeditionData';
import { communityCrops, productionIngredients, wildIngredients, type SaleDemand } from './foodCatalog';
import { gardenTreeDefinitions } from './garden';
import { regionalTreasures } from './regionalTreasures';
import { getShopItem } from './items';
import { processingRecipes } from './foodProcessing';
import type { BuiltinItemId } from './petTypes';
import type { MilkChoice } from './companionActivityTypes';

export const marketPricingVersion = 1;
// These are valuation anchors, not calculated sale prices. Free gifts, seeds,
// tools and Mod items do not become saleable merely because they have a price.
const produce: Record<string, number> = {
  apple: 4, orange: 4, banana: 5, watermelon: 8, ad_milk: 7, strawberry_milk: 8,
  creek_herb: 6, farm_milk: 8, community_wood: 4, community_stone: 3,
  pig_trotter: 19,
  ...Object.fromEntries(kitchenMaterials.map(item => [item.id, Math.floor(item.price * .4)])),
};
export interface CommunitySale {
  base: number; collector: boolean; exchangeOnly: boolean; demand: SaleDemand;
  craft?: { materialCost: number; processingProfit: number };
}

const rawSale = (id: string): CommunitySale | undefined => {
  if (Object.prototype.hasOwnProperty.call(regionalTreasures, id)) return { base: regionalTreasures[id as keyof typeof regionalTreasures].base, collector: true, exchangeOnly: false, demand: 'collector' };
  const ingredient = Object.prototype.hasOwnProperty.call(productionIngredients, id) ? productionIngredients[id as keyof typeof productionIngredients] : Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  if (ingredient) return { base: ingredient.base, collector: false, exchangeOnly: false, demand: ingredient.demand };
  if (Object.prototype.hasOwnProperty.call(expeditionProducts, id)) { const product = expeditionProducts[id as keyof typeof expeditionProducts]; return product.base ? { base: product.base, collector: id === 'sea_glass', exchangeOnly: false, demand: id === 'sea_glass' ? 'collector' : 'specialty' } : undefined; }
  if (id === 'coin_hoard') return { base: adventureTreasureValues.coin_hoard, collector: false, exchangeOnly: true, demand: 'basic' };
  if (id === 'valley_amber' || id === 'ancient_gold_bar') return { base: adventureTreasureValues[id], collector: true, exchangeOnly: false, demand: 'collector' };
  if (Object.prototype.hasOwnProperty.call(fish, id)) { const value = fish[id as keyof typeof fish]; return { base: value.base, collector: value.rare, exchangeOnly: false, demand: value.rare ? 'collector' : value.rarity === 'rare' ? 'specialty' : 'basic' }; }
  if (Object.prototype.hasOwnProperty.call(produce, id)) return { base: produce[id], collector: false, exchangeOnly: false, demand: 'basic' };
  return undefined;
};

const productionBase = (id: string, reference: number): number => {
  const candidates: number[] = [];
  const grown = (cost: number, hours: number) => Math.ceil(Math.max(reference, cost) * 1.25 + hours);
  for (const crop of Object.values(communityCrops)) if (crop.product === id) candidates.push(grown(crop.seedPrice / crop.yield, crop.hours / crop.yield));
  for (const animal of Object.values(animals)) if (animal.item === id) candidates.push(grown(getShopItem('animal_feed')!.price / 2, animal.hours / 2));
  const tree = gardenTreeDefinitions.fruit_tree;
  if (tree.dropPool.some(drop => drop.itemId === id)) candidates.push(grown(tree.price / tree.maxHarvests / tree.baseDropCount, tree.harvestCooldownMs / 3_600_000 / tree.baseDropCount));
  const wild = Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  const catchDefinition = Object.prototype.hasOwnProperty.call(fish, id) ? fish[id as keyof typeof fish] : undefined;
  const gathered = wild ?? catchDefinition;
  if (gathered) candidates.push(Math.ceil(reference * (['rare', 'epic', 'legendary'].includes(gathered.rarity) || (wild?.investigations ?? 0) > 1 ? 2 : 1.5)));
  if (['valley_mushroom', 'hill_honey', 'forest_berry', 'coast_kelp'].includes(id)) candidates.push(Math.ceil(reference * 1.5));
  return candidates.length ? Math.min(...candidates) : reference;
};

/** The replacement or opportunity cost of one input, before stall bonuses. */
export const getIngredientValuation = (id: BuiltinItemId): number => {
  if (id === 'emergency_biscuit') {
    const box = getShopItem('soda_biscuit_box')!;
    return box.price / box.purchaseContents!.find(content => content.itemId === id)!.amount;
  }
  return Math.max(getShopItem(id)?.price ?? 0, getCommunitySale(id)?.base ?? 0);
};
/** Omitted milk uses the more expensive option for the shared finished item. */
export const getRecipePricingCost = (recipe: RecipeDefinition, banana = false, milk?: MilkChoice): number => {
  const cost = (choice: MilkChoice) => getRecipeIngredientEntries(recipe, banana, choice).reduce((sum, entry) => sum + getIngredientValuation(entry.id) * entry.quantity, 0);
  return milk ? cost(milk) : Math.max(cost('farm_milk'), cost('ad_milk'));
};
const craftedSale = (materialCost: number, demand: SaleDemand): CommunitySale => {
  const base = Math.ceil(materialCost * 1.25);
  return { base, collector: false, exchangeOnly: false, demand, craft: { materialCost, processingProfit: base - materialCost } };
};
const sales = new Map<string, CommunitySale>();
export const getCommunitySale = (id: string): CommunitySale | undefined => {
  if (sales.has(id)) return sales.get(id);
  const dish = getDish(id), process = processingRecipes.find(recipe => recipe.output === id);
  let sale: CommunitySale | undefined;
  if (dish) sale = craftedSale(getRecipePricingCost(dish.recipe, dish.banana), dish.recipe.demand);
  else if (process) {
    const cost = (process.fee + Object.entries(process.inputs).reduce((sum, [item, count]) => sum + getIngredientValuation(item as BuiltinItemId) * count, 0)) / process.quantity;
    sale = craftedSale(cost, rawSale(id)!.demand);
  } else {
    const raw = rawSale(id);
    if (raw) sale = { ...raw, base: productionBase(id, raw.base) };
  }
  if (sale) sales.set(id, sale);
  return sale;
};
export const getCuisineSaleNote = (id: string): string => {
  const craft = getCommunitySale(id)?.craft;
  if (!craft) return '';
  const format = (value: number) => Number(value.toFixed(2));
  return `每份计价成本 ${format(craft.materialCost)} · 本步制作收益 +${format(craft.processingProfit)}（按成本加 25% 后向上取整，已计入基础售价）`;
};
