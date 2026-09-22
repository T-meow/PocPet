import { completedChapter, completedLandmark, mapRegionForExpedition, regionNames } from './landmarkProgress';
import { getLanguage } from '../i18n';
import type { BuiltinItemId, ItemEffect, PetState } from './petTypes';
import type { CookingMethod, DishId, KitchenMaterialId, RecipeId, MilkChoice } from './companionActivityTypes';
import { expandedRecipes } from './kitchenExpansion';
import { wildIngredients, type FoodRarity, type SaleDemand, communityCrops, productionIngredients } from './foodCatalog';
import { fish, isWaterOpen } from './communityData';

export const activityText = (zh: string, en: string) => getLanguage() === 'en-US' ? en : zh;
export interface RecipeDefinition {
  id: RecipeId; name: string; en: string; glyph: string; method: CookingMethod;
  ingredients: BuiltinItemId[]; ingredientAmounts?: Partial<Record<BuiltinItemId, number>>;
  effect: ItemEffect; chainHearts: number; main?: boolean; fruitVariant?: boolean; technique?: 'simmer';
  category: 'main' | 'side' | 'soup' | 'dessert' | 'drink'; rarity: FoodRarity; demand: SaleDemand;
}
export const recipeCategoryNames: Record<RecipeDefinition['category'], string> = { main: '主食', side: '菜肴', soup: '汤羹', dessert: '甜品', drink: '饮品' };
export const kitchenMaterials: readonly { id: KitchenMaterialId; name: string; en: string; price: number; glyph: string; edibleEffect?: ItemEffect }[] = [
  { id: 'rice', name: '大米', en: 'Rice', price: 12, glyph: '🍚' },
  { id: 'egg', name: '鸡蛋', en: 'Egg', price: 12, glyph: '🥚' },
  { id: 'flour', name: '面粉', en: 'Flour', price: 10, glyph: '🌾' },
  { id: 'carrot', name: '胡萝卜', en: 'Carrot', price: 8, glyph: '🥕' },
  { id: 'tomato', name: '番茄', en: 'Tomato', price: 10, glyph: '🍅' },
  { id: 'greens', name: '青菜', en: 'Leafy greens', price: 8, glyph: '🥬' },
  { id: 'pork', name: '鲜猪肉', en: 'Fresh pork', price: 20, glyph: '🥩' },
  { id: 'cabbage', name: '白菜', en: 'Chinese cabbage', price: 8, glyph: '🥬' },
  { id: 'shiitake', name: '香菇', en: 'Shiitake mushrooms', price: 10, glyph: '🍄' },
  { id: 'glutinous_rice', name: '糯米', en: 'Glutinous rice', price: 14, glyph: '🍚' },
  { id: 'braised_pork', name: '烧肉', en: 'Braised pork', price: 28, glyph: '🥩', edibleEffect: { hunger: 38, mood: 6, cleanliness: -1 } },
  { id: 'red_bean_paste', name: '红豆沙', en: 'Red bean paste', price: 16, glyph: '🫘' },
  { id: 'mixed_nuts', name: '混合果仁', en: 'Mixed nuts', price: 20, glyph: '🥜', edibleEffect: { hunger: 22, mood: 4, energy: 4 } },
];
// Rarity and final recovery values are explicit; hearts only budget crafting rewards.
const legacyRecipes: readonly Omit<RecipeDefinition, 'category' | 'demand'>[] = [
  { id: 'mushroom_rice', name: '野菇焖饭', en: '野菇焖饭', glyph: '🍄', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['valley_mushroom', 'rice'], effect: { hunger: 28, energy: 24, health: 6 }, chainHearts: 2, main: true },
  { id: 'honey_drink', name: '蜂蜜暖饮', en: '蜂蜜暖饮', glyph: '🍯', method: 'mix', rarity: 'fine', ingredients: ['hill_honey', 'creek_herb'], effect: { hunger: 8, energy: 14, mood: 30 }, chainHearts: 2 },
  { id: 'berry_milk', name: '林莓奶饮', en: '林莓奶饮', glyph: '🫐', method: 'mix', rarity: 'fine', ingredients: ['forest_berry', 'farm_milk'], effect: { hunger: 10, energy: 24, mood: 24 }, chainHearts: 2 },
  { id: 'kelp_rice', name: '海藻饭团', en: '海藻饭团', glyph: '🍙', method: 'pan', rarity: 'fine', ingredients: ['coast_kelp', 'rice'], effect: { hunger: 32, energy: 20, health: 14 }, chainHearts: 2, main: true },
  { id: 'creek_fish_soup', name: '香草鲜鱼汤', en: '香草鲜鱼汤', glyph: '🍲', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['pond_crucian', 'creek_herb'], effect: { hunger: 18, energy: 24, health: 10, mood: 8 }, chainHearts: 2 },
  { id: 'river_grill', name: '溪流香烤鱼', en: '溪流香烤鱼', glyph: '🐟', method: 'pan', rarity: 'fine', ingredients: ['stream_trout', 'carrot'], effect: { hunger: 30, energy: 30, mood: 12 }, chainHearts: 2, main: true },
  { id: 'milk_custard', name: '鲜奶蛋羹', en: '鲜奶蛋羹', glyph: '🍮', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['farm_milk', 'egg'], effect: { hunger: 24, mood: 30, energy: 24 }, chainHearts: 1 },
  { id: 'carp_rice', name: '鲤鱼焖饭', en: '鲤鱼焖饭', glyph: '🍚', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['pond_carp', 'rice'], effect: { hunger: 48, energy: 34, mood: 10 }, chainHearts: 2, main: true },
  { id: 'herb_porridge', name: '香草暖粥', en: '香草暖粥', glyph: '🥣', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['creek_herb', 'rice'], effect: { hunger: 28, energy: 20, health: 8, mood: 6 }, chainHearts: 1, main: true },
  { id: 'plain_rice', name: '白米饭', en: 'Plain rice', glyph: '🍚', method: 'pan', technique: 'simmer', rarity: 'common', ingredients: ['rice'], effect: { hunger: 24, energy: 8 }, chainHearts: 0, main: true },
  { id: 'fruit_salad', name: '双果沙拉', en: 'Fruit salad', glyph: '🥗', method: 'mix', rarity: 'common', ingredients: ['apple', 'orange'], effect: { hunger: 40, mood: 20, energy: 12 }, chainHearts: 1 },
  { id: 'banana_shake', name: '香蕉奶昔', en: 'Banana shake', glyph: '🥤', method: 'blender', rarity: 'fine', ingredients: ['banana', 'ad_milk'], effect: { hunger: 14, mood: 26, energy: 28 }, chainHearts: 2 },
  { id: 'watermelon_juice', name: '西瓜冰饮', en: 'Watermelon cooler', glyph: '🍉', method: 'blender', rarity: 'common', ingredients: ['watermelon'], effect: { hunger: 10, mood: 20, energy: 14 }, chainHearts: 1 },
  { id: 'biscuit_cup', name: '草莓饼干杯', en: 'Strawberry biscuit cup', glyph: '🍨', method: 'mix', rarity: 'common', ingredients: ['emergency_biscuit', 'strawberry_milk'], effect: { hunger: 38, mood: 20, energy: 14 }, chainHearts: 1 },
  { id: 'egg_rice', name: '蛋炒饭', en: 'Egg fried rice', glyph: '🍛', method: 'pan', rarity: 'common', ingredients: ['dish_plain_rice', 'egg'], effect: { hunger: 42, mood: 10, energy: 22 }, chainHearts: 1, main: true },
  { id: 'carrot_rice', name: '胡萝卜蛋饭', en: 'Carrot egg rice', glyph: '🍲', method: 'pan', rarity: 'rare', ingredients: ['dish_egg_rice', 'carrot'], effect: { hunger: 60, mood: 12, energy: 34 }, chainHearts: 2, main: true },
  { id: 'fruit_pancake', name: '水果松饼', en: 'Fruit pancakes', glyph: '🥞', method: 'pan', rarity: 'fine', ingredients: ['flour', 'egg', 'apple'], effect: { hunger: 48, mood: 24, energy: 26 }, chainHearts: 2, fruitVariant: true },
  { id: 'milk_cookies', name: '草莓小饼干', en: 'Strawberry cookies', glyph: '🍪', method: 'oven', rarity: 'fine', ingredients: ['flour', 'strawberry_milk'], effect: { hunger: 42, mood: 24, energy: 24 }, chainHearts: 2 },
  { id: 'carrot_omelet', name: '胡萝卜蛋饼', en: 'Carrot omelet', glyph: '🍳', method: 'pan', rarity: 'common', ingredients: ['carrot', 'egg'], effect: { hunger: 34, mood: 10, energy: 20 }, chainHearts: 1, main: true },
  { id: 'rice_pancake', name: '米香煎饼', en: 'Rice pancakes', glyph: '🫓', method: 'pan', rarity: 'fine', ingredients: ['rice', 'flour', 'egg'], effect: { hunger: 56, mood: 14, energy: 26 }, chainHearts: 2, main: true },
  { id: 'fruit_pudding', name: '水果蛋奶布丁', en: 'Fruit custard', glyph: '🍮', method: 'oven', rarity: 'rare', ingredients: ['egg', 'ad_milk', 'apple'], effect: { hunger: 54, mood: 36, energy: 30 }, chainHearts: 3, fruitVariant: true },
  { id: 'apple_pie', name: '苹果烤派', en: 'Apple pie', glyph: '🥧', method: 'oven', rarity: 'rare', ingredients: ['apple', 'flour', 'ad_milk'], effect: { hunger: 60, mood: 30, energy: 32 }, chainHearts: 3 },
  { id: 'biscuit_layer_cake', name: '草莓饼干千层', en: 'Strawberry cracker layer cake', glyph: '🍰', method: 'oven', rarity: 'legendary', ingredients: ['emergency_biscuit', 'strawberry_milk', 'egg'], ingredientAmounts: { emergency_biscuit: 10, strawberry_milk: 2 }, effect: { hunger: 160, mood: 60, energy: 64 }, chainHearts: 4 },
  { id: 'tomato_egg_bowl', name: '番茄鸡蛋盖饭', en: 'Tomato egg rice bowl', glyph: '🍅', method: 'pan', rarity: 'rare', ingredients: ['dish_plain_rice', 'egg', 'tomato'], effect: { hunger: 56, mood: 18, energy: 30 }, chainHearts: 2, main: true },
  { id: 'pork_rice_bowl', name: '猪脚饭', en: 'Pork trotter rice bowl', glyph: '🍱', method: 'pan', rarity: 'epic', ingredients: ['pig_trotter', 'dish_plain_rice', 'greens'], effect: { hunger: 110, mood: 26, energy: 50 }, chainHearts: 3, main: true },
  { id: 'dumplings_pork_cabbage', name: '白菜猪肉饺', en: 'Pork and cabbage dumplings', glyph: '🥟', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['flour', 'pork', 'cabbage'], effect: { hunger: 58, mood: 16, energy: 32 }, chainHearts: 2, main: true },
  { id: 'dumplings_vegetable', name: '香菇蔬菜素饺', en: 'Mushroom and vegetable dumplings', glyph: '🥟', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['flour', 'cabbage', 'shiitake', 'carrot'], effect: { hunger: 50, mood: 20, energy: 30 }, chainHearts: 2, main: true },
  { id: 'zongzi_braised_pork', name: '烧肉粽', en: 'Braised pork zongzi', glyph: '🍙', method: 'pan', technique: 'simmer', rarity: 'rare', ingredients: ['glutinous_rice', 'braised_pork'], effect: { hunger: 64, mood: 16, energy: 34 }, chainHearts: 2, main: true },
  { id: 'zongzi_red_bean', name: '豆沙粽', en: 'Red bean zongzi', glyph: '🍙', method: 'pan', technique: 'simmer', rarity: 'fine', ingredients: ['glutinous_rice', 'red_bean_paste'], effect: { hunger: 46, mood: 22, energy: 26 }, chainHearts: 2, main: true },
  { id: 'mooncake_mixed_nuts', name: '五仁月饼', en: 'Mixed nut mooncake', glyph: '🥮', method: 'oven', rarity: 'rare', ingredients: ['flour', 'egg', 'mixed_nuts'], effect: { hunger: 52, mood: 28, energy: 34 }, chainHearts: 3 },
  { id: 'mooncake_red_bean', name: '豆沙月饼', en: 'Red bean mooncake', glyph: '🥮', method: 'oven', rarity: 'rare', ingredients: ['flour', 'egg', 'red_bean_paste'], effect: { hunger: 48, mood: 30, energy: 28 }, chainHearts: 3 },
];
export const recipes: readonly RecipeDefinition[] = [...legacyRecipes.map((r): RecipeDefinition => {
  const category = ['honey_drink', 'berry_milk', 'banana_shake', 'watermelon_juice'].includes(r.id) ? 'drink'
    : ['creek_fish_soup', 'milk_custard', 'herb_porridge'].includes(r.id) ? 'soup'
      : ['river_grill', 'carrot_omelet', 'fruit_salad'].includes(r.id) ? 'side' : r.main ? 'main' : 'dessert';
  return { ...r, category, demand: r.rarity === 'epic' || r.rarity === 'legendary' ? 'premium' : r.rarity === 'rare' ? 'specialty' : 'basic' };
}), ...expandedRecipes];
export const cookingMethods: readonly { id: CookingMethod; name: string; en: string; glyph: string; price: number; requiredRecipes: number }[] = [
  { id: 'mix', name: '拌制', en: 'Mixing', glyph: '🥣', price: 0, requiredRecipes: 0 },
  { id: 'pan', name: '平底锅', en: 'Pan', glyph: '🍳', price: 0, requiredRecipes: 0 },
  { id: 'blender', name: '搅拌机', en: 'Blender', glyph: '🥤', price: 120, requiredRecipes: 3 },
  { id: 'oven', name: '小烤箱', en: 'Oven', glyph: '♨️', price: 240, requiredRecipes: 5 },
];
export const recipeName = (recipe: RecipeDefinition) => activityText(recipe.name, recipe.en);
export const getRecipeUnlockReason = (pet: PetState, id: RecipeId) => {
  const expanded = expandedRecipes.find(r => r.id === id);
  if (expanded) {
    for (const item of expanded.ingredients) {
      const f = fish[item as keyof typeof fish];
      if (f && !isWaterOpen(pet, f.water)) return '在小屋开放对应水域后解锁';
      const wild = wildIngredients[item as keyof typeof wildIngredients];
      if (wild && !completedChapter(pet.adventure, mapRegionForExpedition[wild.region]) && !(wild.region === 'valley' && completedLandmark(pet.adventure, 'valley', 'story'))) return `完成${regionNames[mapRegionForExpedition[wild.region]]}全部地标后解锁（溪谷配方在旧温室开放）`;
      if (['cream', 'cheese'].includes(item) && !pet.community.facilities.barn.built) return '开放牛棚与奶制品加工后解锁';
    }
    if (id === 'valley_travel_bento' && (!pet.kitchen.made.chestnut_rice || !pet.kitchen.made.bamboo_mushroom_soup)) return '先做过山栗焖饭与笋菇鲜汤';
  }
  const region = ({ mushroom_rice: 'valley', honey_drink: 'hills', berry_milk: 'forest', kelp_rice: 'coast' } as const)[id as 'mushroom_rice'];
  if (region && !completedChapter(pet.adventure, mapRegionForExpedition[region]) && !(region === 'valley' && completedLandmark(pet.adventure, 'valley', 'story'))) return region === 'valley' ? '完成溪谷／旧温室的全部阶段后记下配方' : `完成${regionNames[mapRegionForExpedition[region]]}全部 8 个地标后记下配方`;
  if (id === 'honey_drink' && !pet.community.herbDiscovered) return '先去溪谷发现香草';
  if (id === 'berry_milk' && !pet.community.facilities.barn.built) return '先开放牛棚，取得鲜奶';
  if (id === 'herb_porridge' && !pet.community.herbDiscovered) return '完成溪谷／溪边采集地，取得香草线索后解锁';
  if (id === 'creek_fish_soup' && (!pet.community.herbDiscovered || !pet.community.facilities.fishing_hut.built)) return '发现香草并开放钓鱼小屋后解锁';
  if (id === 'carp_rice' && !pet.community.facilities.fishing_hut.built) return '开放钓鱼小屋后解锁';
  if (id === 'river_grill' && !pet.community.facilities.upstream.built) return '修好上游步道后解锁';
  if (id === 'milk_custard' && !pet.community.facilities.barn.built) return '开放牛棚后解锁';
  return '';
};
export const getRecipe = (id: string) => recipes.find((recipe) => recipe.id === id);
export const getDishId = (recipe: RecipeDefinition, banana = false): DishId => `dish_${recipe.id}${recipe.fruitVariant && banana ? '_banana' : ''}` as DishId;
export const hasRecipeMilkChoice = (recipe: RecipeDefinition) => recipe.ingredients.some(id => id === 'farm_milk' || id === 'ad_milk');
export const getRecipeIngredients = (recipe: RecipeDefinition, banana = false, milk?: MilkChoice) => recipe.ingredients.map((id) => milk && (id === 'farm_milk' || id === 'ad_milk') ? milk : recipe.fruitVariant && banana && id === 'apple' ? 'banana' as const : id);
export const getRecipeIngredientEntries = (recipe: RecipeDefinition, banana = false, milk?: MilkChoice) => getRecipeIngredients(recipe, banana, milk).map((id, index) => ({ id, quantity: recipe.ingredientAmounts?.[recipe.ingredients[index]] ?? 1 }));
export const allDishes = recipes.flatMap((recipe) => [false, ...(recipe.fruitVariant ? [true] : [])].map((banana) => ({ recipe, banana, id: getDishId(recipe, banana) })));
export const getDish = (id: string) => allDishes.find((dish) => dish.id === id);
export const getRecipeEffect = (recipe: RecipeDefinition, banana = false): ItemEffect => recipe.fruitVariant && banana
  ? { ...recipe.effect, hunger: (recipe.effect.hunger ?? 0) + 2, mood: (recipe.effect.mood ?? 0) - 2, energy: (recipe.effect.energy ?? 0) + 2 }
  : recipe.effect;
export const getRecipeMaterialCost = (recipe: RecipeDefinition, banana: boolean, ingredientPrice: (id: BuiltinItemId) => number, milk?: MilkChoice): number =>
  getRecipeIngredientEntries(recipe, banana, milk).reduce((sum, { id, quantity }) => {
    const dish = getDish(id);
    return sum + quantity * (dish ? getRecipeMaterialCost(dish.recipe, dish.banana, ingredientPrice, milk) : ingredientPrice(id));
  }, 0);
// A consistent reference cost for sorting: shop quote, seed cost per harvest,
// wild replacement value, or the full input cost of processing.
export const getIngredientReferenceCost = (id: BuiltinItemId): number => {
  const material = kitchenMaterials.find(item => item.id === id);
  if (material) return material.price;
  const direct: Partial<Record<BuiltinItemId, number>> = { farm_milk: 18, ad_milk: 24, strawberry_milk: 22, apple: 18, orange: 16, banana: 20, watermelon: 26, emergency_biscuit: 7, pig_trotter: 48, cream: 36, cheese: 54, forest_berry_jam: 24, cooking_oil: 12 };
  if (direct[id] !== undefined) return direct[id]!;
  const crop = Object.values(communityCrops).find(c => c.product === id && c.seedPrice > 0);
  return crop ? crop.seedPrice / crop.yield : wildIngredients[id as keyof typeof wildIngredients]?.base ?? fish[id as keyof typeof fish]?.base ?? productionIngredients[id as keyof typeof productionIngredients]?.base ?? ({ creek_herb: 6, valley_mushroom: 10, hill_honey: 14, forest_berry: 12, coast_kelp: 12 } as Record<string, number>)[id] ?? 0;
};
export const dishName = (id: string) => {
  const dish = getDish(id);
  return dish ? recipeName(dish.recipe) + (dish.recipe.fruitVariant ? activityText(dish.banana ? ' · 香蕉' : ' · 苹果', dish.banana ? ' · Banana' : ' · Apple') : '') : id;
};
