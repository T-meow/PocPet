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
import { getHandcraftRecipe, handcraftMaterials, handcraftMaterialBonusPercent, handcraftProfitPercent, type HandcraftMaterialId, type HandcraftRecipe } from './handcraftData';

export const marketPricingVersion = 2;
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
  if (Object.prototype.hasOwnProperty.call(handcraftMaterials, id)) return handcraftMaterials[id as HandcraftMaterialId].value;
  if (id === 'emergency_biscuit') {
    const box = getShopItem('soda_biscuit_box')!;
    return box.price / box.purchaseContents!.find(content => content.itemId === id)!.amount;
  }
  return Math.max(getShopItem(id)?.price ?? 0, getCommunitySale(id)?.base ?? 0);
};
export const getsHandcraftMaterialBonus = (id: string) => {
  if (Object.prototype.hasOwnProperty.call(handcraftMaterials, id)) return true;
  if (id !== 'community_wood' && id !== 'community_stone' && (Object.prototype.hasOwnProperty.call(wildIngredients, id) || Object.prototype.hasOwnProperty.call(expeditionProducts, id) || Object.prototype.hasOwnProperty.call(regionalTreasures, id) || id === 'valley_amber' || id === 'ancient_gold_bar')) return true;
  const item = getShopItem(id as BuiltinItemId);
  return item?.kind === 'item' && (item.effect.mood ?? 0) > 0;
};
export const getHandcraftValuation = (recipe: HandcraftRecipe) => {
  // Keep hundredths of a cent until final pricing to avoid accidental extra coins from floating-point rounding.
  const units = Object.entries(recipe.inputs).reduce((sum, [id, quantity]) => sum + Math.round(getIngredientValuation(id as BuiltinItemId) * 100) * quantity * (100 + (getsHandcraftMaterialBonus(id) ? handcraftMaterialBonusPercent : 0)), 0);
  const materialCost = units / 10000, base = Math.ceil(units * (100 + handcraftProfitPercent) / 1000000);
  return { materialCost, base, processingProfit: base - materialCost };
};
/** Omitted milk uses the more expensive option for the shared finished item. */
export const getRecipePricingCost = (recipe: RecipeDefinition, banana = false, milk?: MilkChoice): number => {
  const cost = (choice: MilkChoice) => getRecipeIngredientEntries(recipe, banana, choice).reduce((sum, entry) => sum + getIngredientValuation(entry.id) * entry.quantity, 0);
  return milk ? cost(milk) : Math.max(cost('farm_milk'), cost('ad_milk'));
};
const craftedSale = (materialCost: number, demand: SaleDemand, fixedProcessingProfit?: number): CommunitySale => {
  const base = Math.ceil(fixedProcessingProfit === undefined ? materialCost * 1.25 : materialCost + fixedProcessingProfit);
  return { base, collector: false, exchangeOnly: false, demand, craft: { materialCost, processingProfit: base - materialCost } };
};
const sales = new Map<string, CommunitySale>();
export const getCommunitySale = (id: string): CommunitySale | undefined => {
  if (sales.has(id)) return sales.get(id);
  const dish = getDish(id), handcraft = getHandcraftRecipe(id), process = processingRecipes.find(recipe => recipe.output === id);
  let sale: CommunitySale | undefined;
  if (handcraft) {
    const value = getHandcraftValuation(handcraft);
    sale = { base: value.base, collector: handcraft.collector, exchangeOnly: false, demand: handcraft.collector ? 'collector' : 'basic', craft: { materialCost: value.materialCost, processingProfit: value.processingProfit } };
  } else if (dish) sale = craftedSale(getRecipePricingCost(dish.recipe, dish.banana), dish.recipe.demand, dish.recipe.fixedProcessingProfit);
  else if (process && rawSale(id)) {
    const cost = (process.fee + Object.entries(process.inputs).reduce((sum, [item, count]) => sum + getIngredientValuation(item as BuiltinItemId) * count, 0)) / process.quantity;
    sale = craftedSale(cost, rawSale(id)!.demand);
  } else {
    const raw = rawSale(id);
    if (raw) sale = { ...raw, base: productionBase(id, raw.base) };
  }
  if (sale) sales.set(id, sale);
  return sale;
};
const dishChainCosts = new Map<string, number>();
/** Expand prepared dishes; processed ingredients keep their own replacement value. */
export const getDishChainCost = (id: string): number | undefined => {
  const cached = dishChainCosts.get(id);
  if (cached !== undefined) return cached;
  const dish = getDish(id);
  if (!dish) return undefined;
  const cost = (milk: MilkChoice) => getRecipeIngredientEntries(dish.recipe, dish.banana, milk)
    .reduce((sum, input) => sum + (getDishChainCost(input.id) ?? getIngredientValuation(input.id)) * input.quantity, 0);
  const chainCost = Math.max(cost('farm_milk'), cost('ad_milk'));
  dishChainCosts.set(id, chainCost);
  return chainCost;
};
export const highProfitDishPercent = 50;
export const isHighValueProduct = (id: string): boolean => {
  const handcraft = getHandcraftRecipe(id);
  const cost = handcraft ? getHandcraftValuation(handcraft).materialCost : getDishChainCost(id);
  if (cost === undefined || cost <= 0) return false;
  const sale = getCommunitySale(id);
  return Boolean(sale && (sale.base - cost) * 100 > cost * highProfitDishPercent);
};
export const isHighProfitDish = (id: string) => Boolean(getDish(id)) && isHighValueProduct(id);
export const getCuisineSaleNote = (id: string): string => {
  const craft = getCommunitySale(id)?.craft;
  if (!craft) return '';
  const format = (value: number) => Math.round(value);
  if (getHandcraftRecipe(id)) return `每件计价成本 ${format(craft.materialCost)} · 工艺收益 +${format(craft.processingProfit)}（采集物、蛋壳/贝壳、商店心情类商品计价 +${handcraftMaterialBonusPercent}%，再加 ${handcraftProfitPercent}% 工艺收益，已计入基础售价）。`;
  const fixed = getDish(id)?.recipe.fixedProcessingProfit !== undefined;
  return `每份计价成本 ${format(craft.materialCost)} · 本步${fixed ? '固定' : ''}制作收益 +${format(craft.processingProfit)}（${fixed ? '材料计价加本步固定收益，前序收益不再按比例加价' : '按成本加 25% 后向上取整'}，已计入基础售价）`;
};
