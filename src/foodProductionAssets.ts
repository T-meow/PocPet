import { communityCrops, productionIngredients, wildIngredients, type CropDefinition, type ProductionItemId } from './core/foodCatalog';
import { expandedRecipes } from './core/kitchenExpansion';
import type { DishId, NewRecipeId, GenericRecipeId } from './core/companionActivityTypes';
import { genericRecipeVariants } from './core/kitchenGenericRecipes';
import { newItemIcons, emojiIcon } from './newItemIconAssets';
import { newDishPresentation } from './newDishPresentation';

export const productionItemIcons = Object.fromEntries([
  ...Object.keys({ ...productionIngredients, ...wildIngredients }).map(id => [id, newItemIcons[id as ProductionItemId]]),
  ...Object.values(communityCrops).map(c => [c.seed, newItemIcons[c.seed]]),
]) as Record<ProductionItemId | CropDefinition['seed'], string>;
const authoredIcons: Partial<Record<DishId, string>> = newItemIcons;
const authoredPresentation: Partial<Record<DishId, { container: string; rimBottom: string }>> = newDishPresentation;
export const expandedDishIcons = Object.fromEntries(expandedRecipes.map(recipe => {
  const id = `dish_${recipe.id}` as `dish_${NewRecipeId}`;
  return [id, authoredIcons[id] ?? emojiIcon(recipe.glyph)];
})) as Record<`dish_${NewRecipeId}`, string>;
export const expandedDishPresentation = Object.fromEntries(expandedRecipes.map(recipe => {
  const id = `dish_${recipe.id}` as `dish_${NewRecipeId}`;
  return [id, authoredPresentation[id] ?? { container: 'emoji', rimBottom: '0%' }];
})) as Record<`dish_${NewRecipeId}`, { container: string; rimBottom: string }>;
type GenericDishId = `dish_${GenericRecipeId}__${string}`;
const genericDishes = Object.values(genericRecipeVariants).flat();
export const genericDishIcons = Object.fromEntries(genericDishes.map(recipe => [`dish_${recipe.id}__${recipe.variantKey}`, emojiIcon(recipe.glyph)])) as Record<GenericDishId, string>;
export const genericDishPresentation = Object.fromEntries(genericDishes.map(recipe => [`dish_${recipe.id}__${recipe.variantKey}`, { container: 'emoji', rimBottom: '0%' }])) as Record<GenericDishId, { container: string; rimBottom: string }>;
