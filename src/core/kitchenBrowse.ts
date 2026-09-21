import { recipes, getRecipeIngredientEntries, getRecipeUnlockReason, getRecipeMaterialCost, getIngredientReferenceCost, type RecipeDefinition } from './kitchenRecipes';
import { rarityOrder, type FoodRarity } from './foodCatalog';
import type { PetState } from './petTypes';

export interface RecipeFilter { category: RecipeDefinition['category'] | ''; rarity: FoodRarity | ''; unlocked: boolean; ingredients: boolean; equipment: boolean; sort: 'energy' | 'hunger' | 'cost' | 'rarity' }
export const recipeReferenceCost = (r: RecipeDefinition) => getRecipeMaterialCost(r, false, getIngredientReferenceCost, 'farm_milk');
export const hasRecipeIngredients = (pet: PetState, r: RecipeDefinition) => ([false, ...(r.fruitVariant ? [true] : [])]).some(banana => (['farm_milk', 'ad_milk'] as const).some(milk => getRecipeIngredientEntries(r, banana, milk).every(i => (pet.inventory[i.id] ?? 0) >= i.quantity)));
export const browseRecipes = (pet: PetState, filter: RecipeFilter) => recipes.filter(r => (!filter.category || r.category === filter.category) && (!filter.rarity || r.rarity === filter.rarity)
  && (!filter.unlocked || !getRecipeUnlockReason(pet, r.id)) && (!filter.ingredients || hasRecipeIngredients(pet, r)) && (!filter.equipment || pet.kitchen.equipment.includes(r.method)))
  .sort((a, b) => (filter.sort === 'cost' ? recipeReferenceCost(a) - recipeReferenceCost(b) : filter.sort === 'rarity' ? rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity) : (b.effect[filter.sort] ?? 0) - (a.effect[filter.sort] ?? 0)) || a.id.localeCompare(b.id));
