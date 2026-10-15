import type { Inventory } from './petTypes';
import type { ProjectId } from './expeditionTypes';
import type { AdventureRegionId } from './adventureTypes';
import { communityProjects, type ProjectTheme } from './communityProjectData';
import { gatheringSeasons, seasonalGatherings, type GatheringSeason } from './gatheringSeasons';

export interface CommunityThemeMemory { completed: number; firstAt: number; actorId: string; actorName: string }
export interface CommunityProjectTheme {
  id: ProjectTheme; name: string; description: string; memory: string; ending: string;
  artwork: string; supplies: Inventory; meals: Inventory; region?: AdventureRegionId; season?: GatheringSeason;
}
const theme = (id: ProjectTheme, name: string, supplies: Inventory, meals: Inventory, memory: string, ending: string, artwork: string, region?: AdventureRegionId): CommunityProjectTheme => ({ id, name, supplies, meals, memory, ending, artwork, region, description: '准备好物资和料理，和邻居一起赴「' + name + '」的约。' });
const seasonalMenus: Record<GatheringSeason, { supplies: Inventory; meals: Inventory }> = {
  spring: { supplies: { carrot: 3, egg: 2 }, meals: { dish_fruit_salad: 1, dish_fruit_pancake: 1, dish_carrot_omelet: 1, dish_egg_rice: 1, dish_apple_orange_juice: 1 } },
  summer: { supplies: { watermelon: 3, apple: 2 }, meals: { dish_watermelon_juice: 1, dish_milk_cookies: 1, dish_rice_pancake: 1, dish_fruit_pudding: 1, dish_fruit_salad: 1 } },
  autumn: { supplies: { forest_berry: 3, valley_mushroom: 2 }, meals: { dish_mushroom_rice: 1, dish_apple_pie: 1, dish_bamboo_mushroom_soup: 1, dish_carrot_omelet: 1, dish_fruit_pancake: 1 } },
  winter: { supplies: { shiitake: 3, cabbage: 2 }, meals: { dish_herb_porridge: 1, dish_dumplings_vegetable: 1, dish_dumplings_pork_cabbage: 1, dish_carrot_omelet: 1, dish_fruit_pancake: 1 } },
};
export const communityProjectThemes: Record<ProjectId, CommunityProjectTheme[]> = {
  riverside: [
    theme('garden', '田园家常', { carrot: 3, egg: 2 }, { dish_herb_porridge: 1, dish_egg_rice: 1, dish_carrot_omelet: 1, dish_fruit_salad: 1, dish_fruit_pancake: 1 }, communityProjects.riverside.memory, communityProjects.riverside.ending, 'community-riverside'),
    theme('journey', '溪谷家常', { valley_mushroom: 2, bamboo_shoot: 3 }, { dish_mushroom_rice: 1, dish_bamboo_mushroom_soup: 1, dish_carrot_omelet: 1, dish_rice_pancake: 1, dish_fruit_salad: 1 }, '桥边的饭，趁热一起吃', '温室的玻璃映着天光，桥下的溪水一直往前流。大家把野菇饭分好，边吃边说起沿岸的新发现。离开前，把长凳推回桌边，也把下一次碰面的约定留在这里。', 'gathering-valley', 'valley'),
    theme('windmill', '风车蜜香野餐', { hill_honey: 3, creek_herb: 2 }, { dish_honey_drink: 1, dish_fruit_pancake: 1, dish_honey_pumpkin_pie: 1, dish_corn_chowder: 1, dish_rice_pancake: 1 }, '风车转过一圈，蜜香还在', '蜂蜜慢慢淋过松饼，风车的影子在山坡上挪了一点。大家轮流按住被风掀起的桌布，笑着把最后一块分开。杯子空了，山风仍旧很轻。', 'gathering-windmill', 'windmill'),
    theme('forest', '雾松林间宴', { forest_berry: 3, pine_resin: 2 }, { dish_berry_milk: 1, dish_mushroom_rice: 1, dish_wood_ear_dumplings: 1, dish_milk_custard: 1, dish_apple_pie: 1 }, '松林里，留一张安静的桌', '林间薄雾慢慢散开，小屋的窗里亮起了灯。野菇饭和林莓奶饮摆在一起，大家压低声音聊着天，偶尔停下来听松枝响。收拾完餐桌，也没有谁急着先走。', 'gathering-forest', 'forest'),
    theme('coast', '潮汐海风宴', { coast_kelp: 3, sea_glass: 2 }, { dish_kelp_rice: 1, dish_clam_kelp_soup: 1, dish_shrimp_eggs: 1, dish_fruit_salad: 1, dish_watermelon_juice: 1 }, '潮声替我们记住这一晚', '饭团递到每个人手里，海风吹过已经清空的盘子。大家在栈桥旁坐到天色变柔，再沿约好的高处通路回家。回头时，海面还留着一点晚霞。', 'gathering-coast', 'coast'),
    theme('station', '观测站暖灯宴', { observatory_part: 3, hill_honey: 2 }, { dish_herb_porridge: 1, dish_dumplings_pork_cabbage: 1, dish_carrot_omelet: 1, dish_apple_pie: 1, dish_banana_shake: 1 }, '小灯下，一桌饭都还热', '值班室的小灯亮稳了，窗外的山一点点沉进暮色。大家把暖粥和热菜摆好，替晚到的人盖住碗口。饭后分着吃完苹果派，把桌面擦干净，灯留到最后一个人出门才关。', 'gathering-station', 'observatory'),
    ...gatheringSeasons.map(season => ({ ...theme(season, seasonalGatherings[season].name, seasonalMenus[season].supplies, seasonalMenus[season].meals, seasonalGatherings[season].memory, seasonalGatherings[season].ending, 'gathering-' + season), season, description: seasonalGatherings[season].intro })),
  ],
  exhibition: [theme('garden', '水边生活', { pond_crucian: 2, pond_carp: 2 }, { dish_carp_rice: 1 }, communityProjects.exhibition.memory, communityProjects.exhibition.ending, 'community-exhibition'), theme('journey', '森林与海风', { pine_resin: 2, sea_glass: 2 }, { dish_kelp_rice: 1 }, communityProjects.exhibition.memory, communityProjects.exhibition.ending, 'community-exhibition')],
  observatory: [theme('garden', '暖粥守夜', { observatory_part: 3, pine_resin: 1, sea_glass: 1 }, { dish_herb_porridge: 2 }, communityProjects.observatory.memory, communityProjects.observatory.ending, 'community-observatory'), theme('journey', '海风便当', { observatory_part: 3, pine_resin: 1, sea_glass: 1 }, { dish_kelp_rice: 2 }, communityProjects.observatory.memory, communityProjects.observatory.ending, 'community-observatory')],
};
export const getProjectThemes = (id: ProjectId) => communityProjectThemes[id];
export const isProjectTheme = (id: ProjectId, value: unknown): value is ProjectTheme => getProjectThemes(id).some(theme => theme.id === value);
export const getProjectTheme = (id: ProjectId, value?: ProjectTheme) => getProjectThemes(id).find(theme => theme.id === value) ?? getProjectThemes(id)[0];
