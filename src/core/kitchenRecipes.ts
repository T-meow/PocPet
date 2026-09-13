import { getLanguage } from '../i18n';
import type { BuiltinItemId, ItemEffect } from './petTypes';
import type { CookingMethod, DishId, KitchenMaterialId, RecipeId } from './companionActivityTypes';

export const activityText = (zh: string, en: string) => getLanguage() === 'en-US' ? en : zh;
export interface RecipeDefinition {
  id: RecipeId; name: string; en: string; glyph: string; method: CookingMethod;
  ingredients: BuiltinItemId[]; ingredientAmounts?: Partial<Record<BuiltinItemId, number>>;
  effect: ItemEffect; chainHearts: number; main?: boolean; fruitVariant?: boolean; technique?: 'simmer';
}
export const kitchenMaterials: readonly { id: KitchenMaterialId; name: string; en: string; price: number; glyph: string }[] = [
  { id: 'rice', name: '大米', en: 'Rice', price: 12, glyph: '🍚' },
  { id: 'egg', name: '鸡蛋', en: 'Egg', price: 12, glyph: '🥚' },
  { id: 'flour', name: '面粉', en: 'Flour', price: 10, glyph: '🌾' },
  { id: 'carrot', name: '胡萝卜', en: 'Carrot', price: 8, glyph: '🥕' },
  { id: 'tomato', name: '番茄', en: 'Tomato', price: 10, glyph: '🍅' },
  { id: 'greens', name: '青菜', en: 'Leafy greens', price: 8, glyph: '🥬' },
];
export const recipes: readonly RecipeDefinition[] = [
  { id: 'plain_rice', name: '白米饭', en: 'Plain rice', glyph: '🍚', method: 'pan', technique: 'simmer', ingredients: ['rice'], effect: { hunger: 24 }, chainHearts: 0, main: true },
  { id: 'fruit_salad', name: '双果沙拉', en: 'Fruit salad', glyph: '🥗', method: 'mix', ingredients: ['apple', 'orange'], effect: { hunger: 40, mood: 20 }, chainHearts: 1 },
  { id: 'banana_shake', name: '香蕉奶昔', en: 'Banana shake', glyph: '🥤', method: 'blender', ingredients: ['banana', 'ad_milk'], effect: { hunger: 46, mood: 22, energy: 6 }, chainHearts: 2 },
  { id: 'watermelon_juice', name: '西瓜冰饮', en: 'Watermelon cooler', glyph: '🍉', method: 'blender', ingredients: ['watermelon'], effect: { hunger: 36, mood: 20 }, chainHearts: 1 },
  { id: 'biscuit_cup', name: '草莓饼干杯', en: 'Strawberry biscuit cup', glyph: '🍨', method: 'mix', ingredients: ['emergency_biscuit', 'strawberry_milk'], effect: { hunger: 38, mood: 20 }, chainHearts: 1 },
  { id: 'egg_rice', name: '蛋炒饭', en: 'Egg fried rice', glyph: '🍛', method: 'pan', ingredients: ['dish_plain_rice', 'egg'], effect: { hunger: 42, mood: 10, energy: 2 }, chainHearts: 1, main: true },
  { id: 'carrot_rice', name: '胡萝卜蛋饭', en: 'Carrot egg rice', glyph: '🍲', method: 'pan', ingredients: ['dish_egg_rice', 'carrot'], effect: { hunger: 60, mood: 12, energy: 2 }, chainHearts: 2, main: true },
  { id: 'fruit_pancake', name: '水果松饼', en: 'Fruit pancakes', glyph: '🥞', method: 'pan', ingredients: ['flour', 'egg', 'apple'], effect: { hunger: 48, mood: 24, energy: 4 }, chainHearts: 2, fruitVariant: true },
  { id: 'milk_cookies', name: '草莓小饼干', en: 'Strawberry cookies', glyph: '🍪', method: 'oven', ingredients: ['flour', 'strawberry_milk'], effect: { hunger: 42, mood: 24, energy: 2 }, chainHearts: 2 },
  { id: 'carrot_omelet', name: '胡萝卜蛋饼', en: 'Carrot omelet', glyph: '🍳', method: 'pan', ingredients: ['carrot', 'egg'], effect: { hunger: 34, mood: 10 }, chainHearts: 1, main: true },
  { id: 'rice_pancake', name: '米香煎饼', en: 'Rice pancakes', glyph: '🫓', method: 'pan', ingredients: ['rice', 'flour', 'egg'], effect: { hunger: 56, mood: 14, energy: 3 }, chainHearts: 2, main: true },
  { id: 'fruit_pudding', name: '水果蛋奶布丁', en: 'Fruit custard', glyph: '🍮', method: 'oven', ingredients: ['egg', 'ad_milk', 'apple'], effect: { hunger: 54, mood: 36, energy: 3 }, chainHearts: 3, fruitVariant: true },
  { id: 'apple_pie', name: '苹果烤派', en: 'Apple pie', glyph: '🥧', method: 'oven', ingredients: ['apple', 'flour', 'ad_milk'], effect: { hunger: 60, mood: 30, energy: 4 }, chainHearts: 3 },
  { id: 'biscuit_layer_cake', name: '草莓饼干千层', en: 'Strawberry cracker layer cake', glyph: '🍰', method: 'oven', ingredients: ['emergency_biscuit', 'strawberry_milk', 'egg'], ingredientAmounts: { emergency_biscuit: 10, strawberry_milk: 2 }, effect: { hunger: 160, mood: 60, energy: 20 }, chainHearts: 4 },
  { id: 'tomato_egg_bowl', name: '番茄鸡蛋盖饭', en: 'Tomato egg rice bowl', glyph: '🍅', method: 'pan', ingredients: ['dish_plain_rice', 'egg', 'tomato'], effect: { hunger: 56, mood: 18, energy: 2 }, chainHearts: 2, main: true },
  { id: 'pork_rice_bowl', name: '猪脚饭', en: 'Pork trotter rice bowl', glyph: '🍱', method: 'pan', ingredients: ['pig_trotter', 'dish_plain_rice', 'greens'], effect: { hunger: 110, mood: 26, energy: 4 }, chainHearts: 3, main: true },
];
export const cookingMethods: readonly { id: CookingMethod; name: string; en: string; glyph: string; price: number; requiredRecipes: number }[] = [
  { id: 'mix', name: '拌制', en: 'Mixing', glyph: '🥣', price: 0, requiredRecipes: 0 },
  { id: 'pan', name: '平底锅', en: 'Pan', glyph: '🍳', price: 0, requiredRecipes: 0 },
  { id: 'blender', name: '搅拌机', en: 'Blender', glyph: '🥤', price: 120, requiredRecipes: 3 },
  { id: 'oven', name: '小烤箱', en: 'Oven', glyph: '♨️', price: 240, requiredRecipes: 5 },
];
export const recipeName = (recipe: RecipeDefinition) => activityText(recipe.name, recipe.en);
export const getRecipe = (id: string) => recipes.find((recipe) => recipe.id === id);
export const getDishId = (recipe: RecipeDefinition, banana = false): DishId => `dish_${recipe.id}${recipe.fruitVariant && banana ? '_banana' : ''}` as DishId;
export const getRecipeIngredients = (recipe: RecipeDefinition, banana = false) => recipe.ingredients.map((id) => recipe.fruitVariant && banana && id === 'apple' ? 'banana' as const : id);
export const getRecipeIngredientEntries = (recipe: RecipeDefinition, banana = false) => getRecipeIngredients(recipe, banana).map((id, index) => ({ id, quantity: recipe.ingredientAmounts?.[recipe.ingredients[index]] ?? 1 }));
export const allDishes = recipes.flatMap((recipe) => [false, ...(recipe.fruitVariant ? [true] : [])].map((banana) => ({ recipe, banana, id: getDishId(recipe, banana) })));
export const getDish = (id: string) => allDishes.find((dish) => dish.id === id);
export const getRecipeEffect = (recipe: RecipeDefinition, banana = false): ItemEffect => recipe.fruitVariant && banana
  ? { ...recipe.effect, hunger: (recipe.effect.hunger ?? 0) + 2, mood: (recipe.effect.mood ?? 0) - 2, energy: (recipe.effect.energy ?? 0) + 2 }
  : recipe.effect;
export const getRecipeMaterialCost = (recipe: RecipeDefinition, banana: boolean, ingredientPrice: (id: BuiltinItemId) => number): number =>
  getRecipeIngredientEntries(recipe, banana).reduce((sum, { id, quantity }) => {
    const dish = getDish(id);
    return sum + quantity * (dish ? getRecipeMaterialCost(dish.recipe, dish.banana, ingredientPrice) : ingredientPrice(id));
  }, 0);
export const dishName = (id: string) => {
  const dish = getDish(id);
  return dish ? recipeName(dish.recipe) + (dish.recipe.fruitVariant ? activityText(dish.banana ? ' · 香蕉' : ' · 苹果', dish.banana ? ' · Banana' : ' · Apple') : '') : id;
};
