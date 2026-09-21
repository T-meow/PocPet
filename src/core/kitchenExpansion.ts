import type { RecipeDefinition } from './kitchenRecipes';
import type { NewRecipeId, CookingMethod } from './companionActivityTypes';
import type { BuiltinItemId } from './petTypes';
import type { FoodRarity } from './foodCatalog';

const dish = (id: NewRecipeId, name: string, category: RecipeDefinition['category'], rarity: FoodRarity, ingredients: BuiltinItemId[], hunger: number, energy: number, mood: number, chainHearts: number, method: CookingMethod = 'pan'): RecipeDefinition => ({
  id, name, en: name, category, rarity, demand: rarity === 'epic' || rarity === 'legendary' ? 'premium' : rarity === 'rare' ? 'specialty' : 'basic', ingredients,
  method, glyph: id === 'valley_travel_bento' ? '🍱' : ({ main: '🍚', side: '🍽️', soup: '🍲', dessert: '🍰', drink: '🍵' })[category],
  effect: { hunger, energy, mood }, chainHearts, main: category === 'main', ...(category === 'soup' ? { technique: 'simmer' as const } : {}),
});
export const expandedRecipes: readonly RecipeDefinition[] = [
  dish('mashed_potato', '奶油土豆泥', 'side', 'rare', ['potato', 'cream'], 36, 36, 18, 2),
  dish('corn_chowder', '田园玉米浓汤', 'soup', 'fine', ['sweet_corn', 'farm_milk'], 22, 28, 18, 2),
  dish('pumpkin_rice', '南瓜炖饭', 'main', 'fine', ['pumpkin', 'rice', 'wild_onion'], 48, 32, 14, 2),
  dish('pepper_pork_bowl', '甜椒肉末盖饭', 'main', 'rare', ['sweet_pepper', 'pork', 'dish_plain_rice'], 62, 38, 14, 3),
  dish('bamboo_mushroom_soup', '笋菇鲜汤', 'soup', 'fine', ['bamboo_shoot', 'valley_mushroom', 'creek_herb'], 18, 30, 12, 2),
  dish('lotus_pork_soup', '莲藕暖肉汤', 'soup', 'rare', ['lotus_root', 'pork', 'ginger'], 26, 40, 16, 3),
  dish('chestnut_rice', '山栗焖饭', 'main', 'rare', ['mountain_chestnut', 'rice'], 46, 40, 14, 2),
  dish('cream_matsutake', '奶油煎松茸', 'side', 'epic', ['matsutake', 'cream'], 28, 72, 34, 4),
  dish('cheese_vegetables', '奶酪焗蔬菜', 'side', 'rare', ['potato', 'greens', 'cheese'], 44, 50, 28, 3, 'oven'),
  dish('wood_ear_dumplings', '木耳白菜素饺', 'main', 'fine', ['wood_ear', 'cabbage', 'flour'], 50, 30, 18, 2),
  dish('crispy_wheat_fish', '香酥麦穗鱼', 'side', 'common', ['wheat_fish', 'flour'], 28, 22, 12, 1),
  dish('tomato_crucian', '番茄鲫鱼煲', 'soup', 'fine', ['pond_crucian', 'tomato', 'ginger'], 24, 34, 14, 2),
  dish('lemon_trout', '柠檬香煎鳟鱼', 'side', 'rare', ['stream_trout', 'wild_lemon', 'cooking_oil'], 34, 44, 22, 3),
  dish('pumpkin_perch_soup', '南瓜鲈鱼浓汤', 'soup', 'rare', ['river_perch', 'pumpkin', 'farm_milk'], 26, 42, 18, 3),
  dish('bamboo_grouper', '笋香清蒸溪石斑', 'side', 'rare', ['stream_grouper', 'bamboo_shoot', 'ginger'], 32, 40, 18, 3),
  dish('pepper_redtail', '甜椒赤尾烤鱼', 'side', 'epic', ['redtail_barbel', 'sweet_pepper', 'creek_herb'], 38, 54, 24, 4),
  dish('herb_catfish', '香草烤鲶鱼', 'side', 'fine', ['striped_catfish', 'creek_herb'], 32, 34, 16, 2),
  dish('corn_bream_soup', '玉米鳊鱼汤', 'soup', 'rare', ['moss_bream', 'sweet_corn'], 22, 38, 18, 2),
  dish('honey_eel_rice', '蜜烤鳗鱼饭', 'main', 'epic', ['glass_eel', 'hill_honey', 'rice'], 70, 62, 30, 4),
  dish('sardine_rice_ball', '海藻沙丁饭团', 'main', 'fine', ['silver_sardine', 'coast_kelp', 'rice'], 52, 38, 16, 2),
  dish('salt_mackerel', '盐烤青花鲭鱼', 'side', 'rare', ['blue_mackerel', 'sea_salt'], 34, 42, 16, 2),
  dish('lemon_bream_rice', '柠香鲷鱼烩饭', 'main', 'epic', ['bluefin_bream', 'wild_lemon', 'rice'], 56, 68, 30, 4),
  dish('strawberry_cheese_cup', '草莓奶酪杯', 'dessert', 'rare', ['strawberry', 'cheese'], 28, 44, 48, 3, 'mix'),
  dish('berry_jam_biscuit', '林莓果酱饼', 'dessert', 'rare', ['forest_berry_jam', 'flour', 'egg'], 40, 40, 42, 3, 'oven'),
  dish('honey_pumpkin_pie', '蜂蜜南瓜派', 'dessert', 'rare', ['pumpkin', 'hill_honey', 'flour'], 44, 38, 38, 3, 'oven'),
  dish('chestnut_milk_cake', '山栗鲜奶糕', 'dessert', 'rare', ['mountain_chestnut', 'farm_milk', 'glutinous_rice'], 44, 42, 40, 3),
  dish('mint_lemon_drink', '薄荷柠檬饮', 'drink', 'fine', ['mint', 'wild_lemon'], 8, 26, 26, 2, 'mix'),
  dish('lotus_milk_soup', '莲子鲜奶羹', 'soup', 'rare', ['lotus_seed', 'farm_milk'], 16, 34, 28, 2),
  dish('pine_honey_biscuit', '松子蜂蜜饼', 'dessert', 'rare', ['pine_nut', 'hill_honey', 'flour'], 38, 40, 36, 3, 'oven'),
  dish('mountain_herb_tea', '高山香草茶', 'drink', 'epic', ['mountain_tea', 'creek_herb'], 6, 64, 36, 4, 'mix'),
  dish('seafood_rice', '蛤蜊海虾烩饭', 'main', 'rare', ['clam', 'sea_shrimp', 'rice'], 54, 48, 24, 3),
  dish('valley_travel_bento', '溪谷远行便当', 'main', 'legendary', ['dish_chestnut_rice', 'dish_bamboo_mushroom_soup', 'egg'], 78, 84, 32, 6, 'mix'),
];
