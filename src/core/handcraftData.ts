import type { Inventory } from './petTypes';
import type { RegionId } from './expeditionTypes';
import type { FoodRarity } from './foodCatalog';

export const handcraftIds = ['eggshell_sticker_roly_poly', 'shell_hand_rattle', 'sticker_pinwheel', 'flower_bell_wand', 'creek_shell_wind_chime', 'sunstone_clockwork_bird', 'mistpine_resin_ornament', 'tidal_shell_music_box', 'star_orbit_mini_observatory'] as const;
export type HandcraftId = typeof handcraftIds[number];
export const handcraftMaterialIds = ['egg_shell', 'clean_shell'] as const;
export type HandcraftMaterialId = typeof handcraftMaterialIds[number];
export const handcraftMaterialBonusPercent = 30;
export const handcraftProfitPercent = 60;
export const handcraftMaterials = {
  egg_shell: { name: '蛋壳', value: 1, source: '每实际消耗 3 个生鸡蛋制作料理，回收 1 份蛋壳。' },
  clean_shell: { name: '净贝壳', value: 2, source: '每实际消耗 2 份蛤蜊制作料理，回收 1 份净贝壳。' },
} as const;
export const cookingByproducts = [
  { input: 'egg', output: 'egg_shell', required: 3 },
  { input: 'clam', output: 'clean_shell', required: 2 },
] as const;
export interface HandcraftRecipe {
  id: HandcraftId; name: string; description: string; inputs: Inventory;
  regions: readonly RegionId[]; collector: boolean; rarity: FoodRarity;
}
export const handcraftRecipes: readonly HandcraftRecipe[] = [
  { id: 'eggshell_sticker_roly_poly', name: '蛋壳贴纸不倒翁', description: '把星星与笑脸贴在蛋壳上，轻轻一推，又摇晃着站稳。', inputs: { egg_shell: 3, shiny_sticker: 1, flour: 1 }, regions: [], collector: false, rarity: 'common' },
  { id: 'shell_hand_rattle', name: '贝壳手摇铃', description: '贝壳围着小木环，环中的铃铛随着手腕轻轻响。', inputs: { clean_shell: 1, ribbon_bell: 1, community_wood: 1 }, regions: [], collector: false, rarity: 'common' },
  { id: 'sticker_pinwheel', name: '贴纸小风车', description: '用彩色贴纸折出风车叶，装在一根圆润的小木柄上。', inputs: { shiny_sticker: 1, community_wood: 1, flour: 1 }, regions: [], collector: false, rarity: 'common' },
  { id: 'flower_bell_wand', name: '花铃手摇棒', description: '花束围住缎带，侧边的小铃铛把摇动变成清脆的声音。', inputs: { small_bouquet: 1, ribbon_bell: 1, community_wood: 1 }, regions: [], collector: false, rarity: 'fine' },
  { id: 'creek_shell_wind_chime', name: '溪光贝壳风铃', description: '海蓝宝与贝壳垂在一起，像留住了溪水的清亮光芒。', inputs: { clean_shell: 2, sea_glass: 2, pine_resin: 1, creek_aquamarine: 1 }, regions: ['valley'], collector: true, rarity: 'rare' },
  { id: 'sunstone_clockwork_bird', name: '日光发条小鸟', description: '木制小鸟舒展蛋壳翅片，胸前的日光石泛着蜂蜜般的暖光。', inputs: { observatory_part: 3, community_wood: 2, egg_shell: 2, pine_resin: 1, hill_sunstone: 1 }, regions: ['hills', 'station'], collector: true, rarity: 'rare' },
  { id: 'mistpine_resin_ornament', name: '雾松树脂摆件', description: '清透树脂中封着蛋壳碎片与绿宝石，把林间的一点光放上木座。', inputs: { pine_resin: 4, egg_shell: 2, community_wood: 2, forest_emerald: 1 }, regions: ['forest'], collector: true, rarity: 'epic' },
  { id: 'tidal_shell_music_box', name: '潮汐贝壳音乐盒', description: '打开贝壳外盖，海玻璃波纹围着一颗会转动的小珍珠。', inputs: { observatory_part: 4, clean_shell: 2, sea_glass: 2, pine_resin: 1, tidal_pearl: 1 }, regions: ['coast', 'station'], collector: true, rarity: 'epic' },
  { id: 'star_orbit_mini_observatory', name: '星轨迷你观测仪', description: '小小星环围绕蓝宝石转动，桌面也能收藏一片夜空。', inputs: { observatory_part: 6, sea_glass: 3, pine_resin: 2, star_sapphire: 1 }, regions: ['station'], collector: true, rarity: 'legendary' },
];
export const getHandcraftRecipe = (id: string) => handcraftRecipes.find(recipe => recipe.id === id);

export interface KitchenHandcraftState {
  revision: number;
  made: Partial<Record<HandcraftId, number>>;
  remainders: Record<HandcraftMaterialId, number>;
  pending: Partial<Record<HandcraftMaterialId, number>>;
}
