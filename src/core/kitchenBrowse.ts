import { recipes, getRecipeMaterialCost, getIngredientReferenceCost, type RecipeDefinition } from './kitchenRecipes';
import { rarityOrder, type FoodRarity } from './foodCatalog';

export interface RecipeFilter { category: RecipeDefinition['category'] | ''; rarity: FoodRarity | ''; sort: 'energy' | 'hunger' | 'cost' | 'rarity' }
export const recipeReferenceCost = (r: RecipeDefinition) => getRecipeMaterialCost(r, false, getIngredientReferenceCost, 'farm_milk');
export const browseRecipes = (filter: RecipeFilter) => recipes.filter(r => (!filter.category || r.category === filter.category) && (!filter.rarity || r.rarity === filter.rarity))
  .sort((a, b) => (filter.sort === 'cost' ? recipeReferenceCost(a) - recipeReferenceCost(b) : filter.sort === 'rarity' ? rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity) : (b.effect[filter.sort] ?? 0) - (a.effect[filter.sort] ?? 0)) || a.id.localeCompare(b.id));
