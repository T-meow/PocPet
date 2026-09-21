import type { RegionId } from './expeditionTypes';
import type { PetState } from './petTypes';

export type FoodRarity = 'common' | 'fine' | 'rare' | 'epic' | 'legendary';
export type SaleDemand = 'basic' | 'specialty' | 'premium' | 'collector';
export const rarityNames: Record<FoodRarity, string> = { common: '普通', fine: '优良', rare: '稀有', epic: '珍奇', legendary: '传说' };
export const rarityOrder: FoodRarity[] = ['common', 'fine', 'rare', 'epic', 'legendary'];
export const demandNames: Record<SaleDemand, string> = { basic: '日常食材 · 常规 2–4 份', specialty: '地区风味 · 常规 1–2 份', premium: '珍稀美食 · 常规 1 份', collector: '收藏品 · 收藏客人选购' };
export type CropId = 'herb' | 'carrot' | 'berry' | 'greens' | 'tomato' | 'cabbage' | 'potato' | 'corn' | 'wheat' | 'pumpkin' | 'pepper' | 'strawberry' | 'mint' | 'ginger' | 'lotus' | 'sunflower';
export type NewProduceId = 'potato' | 'sweet_corn' | 'wheat' | 'pumpkin' | 'sweet_pepper' | 'strawberry' | 'mint' | 'ginger' | 'lotus_root' | 'sunflower_kernel';
export type NewSeedId = 'greens_seed' | 'tomato_seed' | 'cabbage_seed' | 'potato_seed' | 'corn_seed' | 'wheat_seed' | 'pumpkin_seed' | 'pepper_seed' | 'strawberry_seed' | 'mint_seed' | 'ginger_seed' | 'lotus_seed_packet' | 'sunflower_seed';
export type WildIngredientId = 'bamboo_shoot' | 'wild_onion' | 'wood_ear' | 'sea_salt' | 'lotus_seed' | 'mountain_chestnut' | 'wild_lemon' | 'pine_nut' | 'clam' | 'sea_shrimp' | 'matsutake' | 'mountain_tea';
export type ProcessedIngredientId = 'cream' | 'cheese' | 'forest_berry_jam' | 'cooking_oil';
export type ProductionItemId = NewProduceId | NewSeedId | WildIngredientId | ProcessedIngredientId;
export interface CropDefinition { name: string; seed: NewSeedId | 'creek_herb_seed' | 'carrot_seed' | 'forest_berry_seed'; product: NewProduceId | 'creek_herb' | 'carrot' | 'forest_berry' | 'greens' | 'tomato' | 'cabbage'; hours: number; yield: number; glyph: string; seedPrice: number; region?: RegionId }
export const communityCrops: Record<CropId, CropDefinition> = {
  herb: { name: '溪谷香草', seed: 'creek_herb_seed', product: 'creek_herb', hours: 6, yield: 4, glyph: '🌿', seedPrice: 0 },
  carrot: { name: '胡萝卜', seed: 'carrot_seed', product: 'carrot', hours: 4, yield: 3, glyph: '🥕', seedPrice: 12 },
  berry: { name: '雾松林莓', seed: 'forest_berry_seed', product: 'forest_berry', hours: 8, yield: 4, glyph: '🫐', seedPrice: 0, region: 'forest' },
  greens: { name: '青菜', seed: 'greens_seed', product: 'greens', hours: 2, yield: 3, glyph: '🥬', seedPrice: 10 },
  tomato: { name: '番茄', seed: 'tomato_seed', product: 'tomato', hours: 4, yield: 3, glyph: '🍅', seedPrice: 14 },
  cabbage: { name: '白菜', seed: 'cabbage_seed', product: 'cabbage', hours: 4, yield: 3, glyph: '🥬', seedPrice: 10 },
  potato: { name: '土豆', seed: 'potato_seed', product: 'potato', hours: 6, yield: 3, glyph: '🥔', seedPrice: 16 },
  corn: { name: '甜玉米', seed: 'corn_seed', product: 'sweet_corn', hours: 6, yield: 3, glyph: '🌽', seedPrice: 18 },
  wheat: { name: '小麦', seed: 'wheat_seed', product: 'wheat', hours: 8, yield: 4, glyph: '🌾', seedPrice: 24 },
  pumpkin: { name: '南瓜', seed: 'pumpkin_seed', product: 'pumpkin', hours: 10, yield: 3, glyph: '🎃', seedPrice: 22, region: 'hills' },
  pepper: { name: '甜椒', seed: 'pepper_seed', product: 'sweet_pepper', hours: 6, yield: 3, glyph: '🫑', seedPrice: 18 },
  strawberry: { name: '草莓', seed: 'strawberry_seed', product: 'strawberry', hours: 8, yield: 3, glyph: '🍓', seedPrice: 20 },
  mint: { name: '薄荷', seed: 'mint_seed', product: 'mint', hours: 4, yield: 4, glyph: '🌱', seedPrice: 14, region: 'valley' },
  ginger: { name: '生姜', seed: 'ginger_seed', product: 'ginger', hours: 8, yield: 3, glyph: '🫚', seedPrice: 18, region: 'forest' },
  lotus: { name: '莲藕', seed: 'lotus_seed_packet', product: 'lotus_root', hours: 12, yield: 3, glyph: '🪷', seedPrice: 24, region: 'valley' },
  sunflower: { name: '向日葵', seed: 'sunflower_seed', product: 'sunflower_kernel', hours: 12, yield: 4, glyph: '🌻', seedPrice: 24, region: 'hills' },
};
export const cropIds = Object.keys(communityCrops) as CropId[];
export const getCropUnlockReason = (pet: PetState, id: CropId) => {
  const crop = communityCrops[id];
  return crop.region && !pet.community.expedition.regions[crop.region].surveyed && !(pet.inventory[crop.seed] > 0) && !pet.community.discoveredCrops.includes(id) ? `完成${({ valley: '溪谷', hills: '风车山丘', forest: '雾松林地', coast: '潮汐海岸', station: '旧观测站' })[crop.region]}故事后解锁种子` : '';
};
export interface IngredientDefinition { name: string; glyph: string; base: number; rarity: FoodRarity; demand: SaleDemand; use: string }
export const productionIngredients: Record<NewProduceId | ProcessedIngredientId, IngredientDefinition> = {
  wheat: { name: '小麦', glyph: '🌾', base: 3, rarity: 'common', demand: 'basic', use: '加工台：1 份小麦磨出 2 份面粉，免费加工' },
  potato: { name: '土豆', glyph: '🥔', base: 6, rarity: 'common', demand: 'basic', use: '种植收获；土豆泥、焗蔬菜' },
  sweet_corn: { name: '甜玉米', glyph: '🌽', base: 7, rarity: 'common', demand: 'basic', use: '种植收获；浓汤、鱼汤' },
  pumpkin: { name: '南瓜', glyph: '🎃', base: 9, rarity: 'fine', demand: 'basic', use: '种植收获；炖饭、浓汤、派' },
  sweet_pepper: { name: '甜椒', glyph: '🫑', base: 7, rarity: 'fine', demand: 'basic', use: '种植收获；盖饭和烤鱼' },
  strawberry: { name: '草莓', glyph: '🍓', base: 8, rarity: 'fine', demand: 'basic', use: '种植收获；草莓牛奶和甜品' },
  mint: { name: '薄荷', glyph: '🌱', base: 4, rarity: 'common', demand: 'basic', use: '种植收获；清爽饮品' },
  ginger: { name: '生姜', glyph: '🫚', base: 7, rarity: 'fine', demand: 'basic', use: '种植收获；鱼煲和暖汤' },
  lotus_root: { name: '莲藕', glyph: '🪷', base: 10, rarity: 'fine', demand: 'basic', use: '种植收获；莲藕暖肉汤' },
  sunflower_kernel: { name: '葵花籽', glyph: '🌻', base: 7, rarity: 'fine', demand: 'basic', use: '种植收获；2 份加工食用油 1 份' },
  cream: { name: '奶油', glyph: '🧈', base: 14, rarity: 'fine', demand: 'basic', use: '加工台：鲜奶 2 份；汤羹、土豆泥' },
  cheese: { name: '奶酪', glyph: '🧀', base: 21, rarity: 'fine', demand: 'basic', use: '加工台：鲜奶 3 份；甜品和焗菜' },
  forest_berry_jam: { name: '林莓果酱', glyph: '🫙', base: 25, rarity: 'fine', demand: 'specialty', use: '加工台：林莓 2 份；果酱饼' },
  cooking_oil: { name: '食用油', glyph: '🫗', base: 15, rarity: 'common', demand: 'basic', use: '加工台：葵花籽 2 份；香煎料理' },
};
export const wildIngredients: Record<WildIngredientId, IngredientDefinition & { region: RegionId; yield: number; investigations: number }> = {
  bamboo_shoot: { name: '嫩笋', glyph: '🎋', base: 6, rarity: 'common', demand: 'basic', region: 'valley', yield: 4, investigations: 1, use: '笋菇鲜汤、清蒸鱼；开垦第 2 块菜地交付 4 份' },
  wild_onion: { name: '野洋葱', glyph: '🧅', base: 6, rarity: 'common', demand: 'basic', region: 'hills', yield: 4, investigations: 1, use: '南瓜炖饭；开垦第 3 块菜地交付 4 份' },
  wood_ear: { name: '林地木耳', glyph: '🍄', base: 7, rarity: 'common', demand: 'basic', region: 'forest', yield: 4, investigations: 1, use: '木耳白菜素饺' },
  sea_salt: { name: '海盐', glyph: '🧂', base: 6, rarity: 'common', demand: 'basic', region: 'coast', yield: 4, investigations: 1, use: '盐烤青花鲭鱼' },
  lotus_seed: { name: '莲子', glyph: '🪷', base: 15, rarity: 'fine', demand: 'specialty', region: 'valley', yield: 2, investigations: 1, use: '莲子鲜奶羹' },
  mountain_chestnut: { name: '山栗', glyph: '🌰', base: 16, rarity: 'fine', demand: 'specialty', region: 'hills', yield: 2, investigations: 1, use: '焖饭、鲜奶糕' },
  wild_lemon: { name: '野柠檬', glyph: '🍋', base: 15, rarity: 'fine', demand: 'specialty', region: 'hills', yield: 2, investigations: 1, use: '饮品和香煎鱼' },
  pine_nut: { name: '松子', glyph: '🌰', base: 18, rarity: 'fine', demand: 'specialty', region: 'forest', yield: 2, investigations: 1, use: '松子蜂蜜饼' },
  clam: { name: '蛤蜊', glyph: '🐚', base: 17, rarity: 'fine', demand: 'specialty', region: 'coast', yield: 2, investigations: 1, use: '海鲜烩饭' },
  sea_shrimp: { name: '海虾', glyph: '🦐', base: 19, rarity: 'rare', demand: 'specialty', region: 'coast', yield: 2, investigations: 1, use: '海鲜烩饭' },
  matsutake: { name: '松茸', glyph: '🍄', base: 52, rarity: 'epic', demand: 'premium', region: 'forest', yield: 1, investigations: 3, use: '奶油煎松茸；每 3 次定向调查得 1 份，每次另得林莓 1 份' },
  mountain_tea: { name: '高山茶叶', glyph: '🍵', base: 48, rarity: 'epic', demand: 'premium', region: 'station', yield: 1, investigations: 3, use: '高山香草茶；每 3 次定向调查得 1 份，每次另得观测零件 1 份' },
};
export const wildIngredientIds = Object.keys(wildIngredients) as WildIngredientId[];
