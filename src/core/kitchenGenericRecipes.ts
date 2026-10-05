import type { GenericRecipeId } from './companionActivityTypes';
import type { FishId } from './communityTypes';
import type { RecipeDefinition } from './kitchenRecipes';
import type { BuiltinItemId } from './petTypes';
import { fish, fishIds } from './communityData';

// Nutrition is authored independently of money, so economic price adjustments
// cannot unexpectedly change recovery effects.
const fishNutrition: Partial<Record<FishId, readonly [number, number, number]>> = {
  pond_crucian: [18, 16, 6], pond_carp: [24, 18, 6], wheat_fish: [16, 14, 6],
  stream_trout: [26, 26, 10], river_perch: [30, 30, 10], stream_grouper: [26, 28, 10], redtail_barbel: [32, 38, 14],
  striped_catfish: [26, 22, 8], moss_bream: [28, 30, 10], glass_eel: [36, 44, 16],
  silver_sardine: [20, 20, 8], blue_mackerel: [28, 30, 10], bluefin_bream: [34, 48, 16],
};
export const cookingFishIds = fishIds.filter(id => !fish[id].rare && fishNutrition[id]);
const grilledFishVariants: RecipeDefinition[] = cookingFishIds.map((id): RecipeDefinition => {
  const [hunger, energy, mood] = fishNutrition[id]!;
  const definition = fish[id];
  return {
    id: 'grilled_fish', name: '烤鱼', en: '烤鱼',
    glyph: '🐟', method: 'pan', category: 'side',
    variantKey: id, variantLabel: definition.name, ingredients: [id as BuiltinItemId],
    rarity: definition.rarity, demand: definition.rarity === 'rare' ? 'specialty' : 'basic',
    effect: { hunger, energy, mood },
    chainHearts: definition.rarity === 'rare' ? 3 : definition.rarity === 'fine' ? 2 : 1,
  };
});

export const genericRecipeVariants: Record<GenericRecipeId, readonly RecipeDefinition[]> = {
  grilled_fish: grilledFishVariants,
};
export const isGenericRecipeId = (id: string): id is GenericRecipeId => Object.prototype.hasOwnProperty.call(genericRecipeVariants, id);
export const genericRecipes = [genericRecipeVariants.grilled_fish[0]];
