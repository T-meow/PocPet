import type { RecipeId } from './companionActivityTypes';
import type { ExpeditionItemId, ProjectId, RegionId } from './expeditionTypes';
import type { PetState } from './petTypes';
import { wildIngredients } from './foodCatalog';
import { regionalTreasures } from './regionalTreasures';
import { getRegionUnlockReason, mapRegionForExpedition } from './landmarkProgress';

export const regionIds: RegionId[] = ['valley', 'hills', 'forest', 'coast', 'station'];
export const projectIds: ProjectId[] = ['riverside', 'exhibition', 'observatory'];
export const expeditionCapacity = 24;
export const expeditionHarvestLimit = 3;
export const expeditionProducts: Record<ExpeditionItemId, { name: string; glyph: string; base: number; use: string }> = {
  ...wildIngredients,
  ...regionalTreasures,
  valley_mushroom: { name: '溪谷野菇', glyph: '🍄', base: 10, use: '野菇焖饭、鸡舍与小摊扩建；只在溪谷采集' },
  hill_honey: { name: '花丘蜂蜜', glyph: '🍯', base: 14, use: '蜂蜜暖饮、社区聚餐、鸡舍与牛棚扩建' },
  forest_berry: { name: '雾松林莓', glyph: '🫐', base: 12, use: '林莓奶饮与料理；种子在林地定向寻找，每次 2 份' },
  forest_berry_seed: { name: '林莓种子', glyph: '🌱', base: 0, use: '林地定向寻找每次 2 份，消耗探索机会；每次播种消耗 1 份' },
  pine_resin: { name: '松香树脂', glyph: '🌲', base: 12, use: '主题展览、观测站项目与牛棚扩建' },
  coast_kelp: { name: '潮池海藻', glyph: '🌊', base: 12, use: '海藻饭团；只在海岸采集' },
  sea_glass: { name: '潮汐海玻璃', glyph: '💠', base: 18, use: '主题展览、观测站灯饰与小摊扩建；收藏买家收购' },
  observatory_part: { name: '观测零件', glyph: '🔭', base: 18, use: '观测站远征准备项目' },
};
export const regions: Record<RegionId, { name: string; subtitle: string; color: string; glyph: string; base: string; story: string; storyText: string; gather: string; crossing: string; product: ExpeditionItemId; alternative: ExpeditionItemId; recipe?: RecipeId; unlockHint: string }> = {
  valley: { name: '溪谷', subtitle: '水渠尽头，温室还在等一场春天', color: '#547b62', glyph: '🌿', base: '温室休息间', story: '让旧温室重新亮起来', storyText: '顺着水痕转开阀门，第一道清水流进旧温室。伙伴把新路标挂在了门口。', gather: '水渠边的野菇丛', crossing: '青苔木桥', product: 'valley_mushroom', alternative: 'valley_mushroom', recipe: 'mushroom_rice', unlockHint: '完成踩点教学' },
  hills: { name: '风车山丘', subtitle: '追着风，去花田的另一头', color: '#98783f', glyph: '🌾', base: '避风小营地', story: '让老风车再转一圈', storyText: '取出卡住叶轮的小枝条，风车重新转动。山路分向雾松林地与潮汐海岸。', gather: '背风花田的蜂巢', crossing: '风车栈道', product: 'hill_honey', alternative: 'hill_honey', recipe: 'honey_drink', unlockHint: '完成溪谷全部 8 个地标' },
  forest: { name: '雾松林地', subtitle: '放轻脚步，听森林说话', color: '#4c736c', glyph: '🌲', base: '林间守望小屋', story: '跟着足迹找到古树', storyText: '足迹通向古树背后的林莓丛。把种植方法记下，小小的森林也能在菜地里生长。', gather: '古树下的林莓丛', crossing: '盘根坡道', product: 'forest_berry', alternative: 'pine_resin', recipe: 'berry_milk', unlockHint: '完成风车山丘全部 8 个地标' },
  coast: { name: '潮汐海岸', subtitle: '把海风和浪花装进行囊', color: '#417f93', glyph: '🐚', base: '海边旧船屋', story: '寻找潮水留下的信', storyText: '信里画着山顶的穹顶与三颗星。把玻璃碎片磨成灯片，留给下一次启程。', gather: '浅滩潮池', crossing: '潮汐栈桥', product: 'coast_kelp', alternative: 'sea_glass', recipe: 'kelp_rice', unlockHint: '完成风车山丘全部 8 个地标' },
  station: { name: '旧观测站', subtitle: '今晚，让星星做我们的路标', color: '#737298', glyph: '✦', base: '观测站值班室', story: '为夜空重新打开穹顶', storyText: '林地的方位记号与海岸星图终于对齐。穹顶缓缓打开，这次的星空属于所有人。', gather: '旧仪器工作台', crossing: '山脊连桥', product: 'observatory_part', alternative: 'observatory_part', unlockHint: '完成雾松林地与潮汐海岸全部地标' },
};
export const getRegionUnlocked = (pet: PetState, id: RegionId) => {
  return !getRegionUnlockReason(pet.adventure, mapRegionForExpedition[id]);
};
export const isExpeditionAway = (pet: Pick<PetState, 'community'>) => Boolean(pet.community?.expedition?.active && !pet.community.expedition.active.paused);
export const expeditionBagCount = (bag: Record<string, number>) => Object.values(bag).reduce((sum, n) => sum + n, 0);
export const getExpeditionMilestones = (pet: Partial<Pick<PetState, 'community'>>) => [
  ...regionIds.map(id => ({ id: `region_${id}`, name: `${regions[id].name}地区故事`, energy: 2, achieved: pet.community?.expedition?.regions[id]?.surveyed === true })),
  ...projectIds.map(id => ({ id: `project_${id}`, name: ({ riverside: '河岸长桌聚餐', exhibition: '溪畔主题展览', observatory: '星空之夜' })[id], energy: 3, achieved: (pet.community?.expedition?.projects[id]?.completed ?? 0) > 0 })),
];
