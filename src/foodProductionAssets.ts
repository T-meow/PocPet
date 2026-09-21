import { communityCrops, productionIngredients, wildIngredients, type CropDefinition, type ProductionItemId } from './core/foodCatalog';
import { expandedRecipes } from './core/kitchenExpansion';
import type { NewRecipeId } from './core/companionActivityTypes';
import { newItemIcons } from './newItemIconAssets';
import { newDishPresentation } from './newDishPresentation';

export const productionItemIcons = Object.fromEntries([
  ...Object.keys({ ...productionIngredients, ...wildIngredients }).map(id => [id, newItemIcons[id as ProductionItemId]]),
  ...Object.values(communityCrops).map(c => [c.seed, newItemIcons[c.seed]]),
]) as Record<ProductionItemId | CropDefinition['seed'], string>;
const expandedDishIds = expandedRecipes.map(r => `dish_${r.id}` as `dish_${NewRecipeId}`);
export const expandedDishIcons = Object.fromEntries(expandedDishIds.map(id => [id, newItemIcons[id]])) as Record<`dish_${NewRecipeId}`, string>;
export const expandedDishPresentation = Object.fromEntries(expandedDishIds.map(id => [id, newDishPresentation[id]])) as Record<`dish_${NewRecipeId}`, { container: string; rimBottom: string }>;
