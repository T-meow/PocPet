import type { RecipeId } from './companionActivityTypes';
import { recipes } from './kitchenRecipes';
import type { ItemId, PetState } from './petTypes';

export interface FavoritesState {
  itemIds: ItemId[];
  recipeIds: RecipeId[];
}

const maxFavoriteIds = 4096;
export const defaultFavorites = (): FavoritesState => ({ itemIds: [], recipeIds: [] });
const readIds = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => typeof id === 'string').map(id => id.trim().slice(0, 128)).filter(Boolean))].slice(0, maxFavoriteIds)
  : [];

export const normalizeFavorites = (value: unknown): FavoritesState => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    // Inventory can contain temporarily unavailable Mod items; keep their IDs.
    itemIds: readIds(raw.itemIds) as ItemId[],
    recipeIds: readIds(raw.recipeIds).filter((id): id is RecipeId => recipes.some(recipe => recipe.id === id)),
  };
};

const toggleId = <T extends string>(ids: readonly T[], id: T): T[] => ids.includes(id)
  ? ids.filter(value => value !== id) : [...ids, id].slice(0, maxFavoriteIds);

export const toggleItemFavorite = (pet: PetState, id: ItemId): PetState => ({
  ...pet, favorites: { ...pet.favorites, itemIds: toggleId(pet.favorites.itemIds, id) },
});
export const toggleRecipeFavorite = (pet: PetState, id: RecipeId): PetState => ({
  ...pet, favorites: { ...pet.favorites, recipeIds: toggleId(pet.favorites.recipeIds, id) },
});

// Partition after the existing filters and sort, preserving both groups' order.
export const favoritesFirst = <T>(entries: readonly T[], ids: readonly string[], idFor: (entry: T) => string): T[] => {
  const favorites = new Set(ids);
  const first: T[] = [], rest: T[] = [];
  for (const entry of entries) (favorites.has(idFor(entry)) ? first : rest).push(entry);
  return [...first, ...rest];
};
