import { recipes, getRecipeVariants, getRecipeUnlockReason, getRecipeIngredientEntries, type RecipeDefinition } from './kitchenRecipes';
import { getRecipePricingCost } from './communityEconomy';
import { rarityOrder, type FoodRarity } from './foodCatalog';
import type { PetState } from './petTypes';

export interface RecipeFilter { category: RecipeDefinition['category'] | ''; rarity: FoodRarity | ''; sort: 'energy' | 'hunger' | 'cost' | 'rarity' }
export const recipeReferenceCost = (r: RecipeDefinition) => getRecipePricingCost(r);
export const browseRecipes = (filter: RecipeFilter, pet?: PetState) => recipes.filter(r => !filter.category || r.category === filter.category)
  .flatMap(recipe => {
    const variants = getRecipeVariants(recipe).filter(r => !filter.rarity || r.rarity === filter.rarity);
    const availability = (r: RecipeDefinition) => !pet ? 0 : getRecipeUnlockReason(pet, r.id, r.variantKey) ? 2
      : getRecipeIngredientEntries(r).every(input => (pet.inventory[input.id] ?? 0) >= input.quantity) ? 0 : 1;
    // One card per method; prefer available, inexpensive ingredients in its preview.
    variants.sort((a, b) => availability(a) - availability(b) || recipeReferenceCost(a) - recipeReferenceCost(b) || (a.variantKey ?? '').localeCompare(b.variantKey ?? ''));
    return variants.length ? [variants[0]] : [];
  })
  .sort((a, b) => (filter.sort === 'cost' ? recipeReferenceCost(a) - recipeReferenceCost(b) : filter.sort === 'rarity' ? rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity) : (b.effect[filter.sort] ?? 0) - (a.effect[filter.sort] ?? 0)) || a.id.localeCompare(b.id));
