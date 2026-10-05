import type { GenericRecipeId } from './companionActivityTypes';
import type { FishId } from './communityTypes';
import type { RecipeDefinition } from './kitchenRecipes';
import type { BuiltinItemId } from './petTypes';
import { fish, fishIds } from './communityData';

// Retired juice and soup variants only register existing inventory, prices and
// tasting memories. They are not offered in the recipe book or craftable.
const juiceFruits = [
  { id: 'apple', name: '苹果', hunger: 4, energy: 6, mood: 8, regional: false },
  { id: 'orange', name: '橘子', hunger: 2, energy: 7, mood: 8, regional: false },
  { id: 'banana', name: '香蕉', hunger: 6, energy: 10, mood: 6, regional: false },
  { id: 'watermelon', name: '西瓜', hunger: 2, energy: 8, mood: 8, regional: false },
  { id: 'strawberry', name: '草莓', hunger: 3, energy: 6, mood: 12, regional: true },
  { id: 'forest_berry', name: '林莓', hunger: 3, energy: 10, mood: 10, regional: true },
  { id: 'wild_lemon', name: '野柠檬', hunger: 1, energy: 9, mood: 10, regional: true },
] as const;

const juiceVariants: RecipeDefinition[] = juiceFruits.flatMap((first, index) => juiceFruits.slice(index + 1).map((second): RecipeDefinition => ({
  id: 'mixed_juice', name: '混合果汁', en: '混合果汁', glyph: '🥤', method: 'blender', category: 'drink', retired: true,
  variantKey: [first.id, second.id].sort().join('__'), variantLabel: `${first.name}＋${second.name}`,
  ingredients: [first.id, second.id], rarity: first.regional || second.regional ? 'fine' : 'common', demand: 'basic',
  effect: { hunger: 4 + first.hunger + second.hunger, energy: 8 + first.energy + second.energy, mood: 10 + first.mood + second.mood },
  chainHearts: first.regional || second.regional ? 2 : 1,
})));

// Nutrition is authored independently of money, so economic price adjustments
// cannot unexpectedly change recovery effects.
const fishNutrition: Partial<Record<FishId, readonly [number, number, number]>> = {
  pond_crucian: [18, 16, 6], pond_carp: [24, 18, 6], wheat_fish: [16, 14, 6],
  stream_trout: [26, 26, 10], river_perch: [30, 30, 10], stream_grouper: [26, 28, 10], redtail_barbel: [32, 38, 14],
  striped_catfish: [26, 22, 8], moss_bream: [28, 30, 10], glass_eel: [36, 44, 16],
  silver_sardine: [20, 20, 8], blue_mackerel: [28, 30, 10], bluefin_bream: [34, 48, 16],
};
export const cookingFishIds = fishIds.filter(id => !fish[id].rare && fishNutrition[id]);
const fishVariants = (soup: boolean): RecipeDefinition[] => cookingFishIds.map((id): RecipeDefinition => {
  const [hunger, energy, mood] = fishNutrition[id]!;
  const definition = fish[id];
  return {
    id: soup ? 'fish_soup' : 'grilled_fish', name: soup ? '家常鱼汤' : '烤鱼', en: soup ? '家常鱼汤' : '烤鱼',
    ...(soup ? { retired: true } : {}),
    glyph: soup ? '🍲' : '🐟', method: 'pan', category: soup ? 'soup' : 'side',
    ...(soup ? { technique: 'simmer' as const } : {}),
    variantKey: id, variantLabel: definition.name, ingredients: [id as BuiltinItemId],
    rarity: definition.rarity, demand: definition.rarity === 'rare' ? 'specialty' : 'basic',
    effect: soup ? { hunger: Math.ceil(hunger / 2), energy: energy + 2, mood: mood - 2 } : { hunger, energy, mood },
    chainHearts: definition.rarity === 'rare' ? 3 : definition.rarity === 'fine' ? 2 : 1,
  };
});

export const genericRecipeVariants: Record<GenericRecipeId, readonly RecipeDefinition[]> = {
  mixed_juice: juiceVariants, fish_soup: fishVariants(true), grilled_fish: fishVariants(false),
};
export const isGenericRecipeId = (id: string): id is GenericRecipeId => Object.prototype.hasOwnProperty.call(genericRecipeVariants, id);
export const genericRecipes = [genericRecipeVariants.grilled_fish[0]];
export const retiredRecipes = [genericRecipeVariants.mixed_juice[0], genericRecipeVariants.fish_soup[0]];
