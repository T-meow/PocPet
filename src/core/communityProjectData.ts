import type { Inventory } from './petTypes';
import type { ProjectId } from './expeditionTypes';

export const projectThemes = ['garden', 'journey'] as const;
export type ProjectTheme = typeof projectThemes[number];
export type CommunityGiftKind = 'apples' | 'garden' | 'surprise';
export interface CommunityProjectReward {
  version: 1;
  id: string; hearts: number; gift: CommunityGiftKind; items: Inventory;
  first: boolean; at: number; actorName: string;
}
export const communityProjects: Record<ProjectId, {
  name: string; description: string; memory: string; ending: string; hearts: number; tier: number;
  themes: [string, string]; supplies: [Inventory, Inventory]; meals: [Inventory, Inventory];
}> = {
  riverside: { name: '河岸长桌聚餐', description: '把菜地和溪谷的收获摆上长桌，邀邻居们一起吃顿家常饭。', memory: '晚风里的第一张长桌', ending: '灯串亮起来时，河岸边已经摆好了餐具。邻居们带着回礼赴约，热腾腾的家常饭和晚风一起，留在了这一晚。', hearts: 200, tier: 1, themes: ['田园家常', '溪谷家常'], supplies: [{ carrot: 3, egg: 2 }, { valley_mushroom: 2, bamboo_shoot: 3 }], meals: [{ dish_herb_porridge: 2 }, { dish_mushroom_rice: 2 }] },
  exhibition: { name: '溪畔主题展览', description: '用鱼类与地区见闻布置一场小展览。交付实物不会清除手账和收藏记录。', memory: '大家停在同一页手账前', ending: '手账在溪风里翻开，树脂和海玻璃映着柔和的光。大家围着小小的展台，分享各自记得的风景，也留下了一份感谢。', hearts: 350, tier: 2, themes: ['水边生活', '森林与海风'], supplies: [{ pond_crucian: 2, pond_carp: 2 }, { pine_resin: 2, sea_glass: 2 }], meals: [{ dish_carp_rice: 1 }, { dish_kelp_rice: 1 }] },
  observatory: { name: '星空之夜', description: '备好照明与守夜餐，邀社区伙伴到穹顶下一起看星星。', memory: '穹顶下，我们都有一颗星', ending: '暖灯照着展开的星图，望远镜已经对准夜空。守夜餐还冒着热气，大家把今夜的星光与回礼，一起留给了你们。', hearts: 600, tier: 3, themes: ['暖粥守夜', '海风便当'], supplies: [{ observatory_part: 3, pine_resin: 1, sea_glass: 1 }, { observatory_part: 3, pine_resin: 1, sea_glass: 1 }], meals: [{ dish_herb_porridge: 2 }, { dish_kelp_rice: 2 }] },
};
export const communityGiftPool: readonly { kind: CommunityGiftKind; name: string; chance: number }[] = [
  { kind: 'apples', name: '果园邻居的金苹果', chance: 50 },
  { kind: 'garden', name: '园丁的心意', chance: 35 },
  { kind: 'surprise', name: '邻居们的惊喜回礼', chance: 15 },
];
export const getCommunityGiftItems = (id: ProjectId, gift: CommunityGiftKind): Inventory => {
  const n = communityProjects[id].tier;
  return gift === 'apples' ? { golden_apple: n } : gift === 'garden'
    ? { gift_tree_sapling: 2 * n, heart_fertilizer: 8 * n }
    : { golden_apple: 2 * n, harvest_nutrient: n };
};
