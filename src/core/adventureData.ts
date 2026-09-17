import { activityText as L } from './kitchenRecipes';
import type { AdventureRegionId, AdventureRulesVersion } from './adventureTypes';
import type { ItemId } from './petTypes';
import { adventureTreasureValues } from './adventureItems';

export const adventureBagCapacity = 12;
export const adventureTransportCost = 2;
export const adventureTransportLimit = 3;
export const adventureShopPrices: Record<string, number> = { dish_egg_rice: 54, trail_mix: 48, berry_bait: 18 };
const legacyShopPrices: Record<string, number> = { dish_egg_rice: 36, trail_mix: 34, berry_bait: 12 };
export const getAdventureShopPrice = (id: string, version: AdventureRulesVersion = 4) => (version < 3 ? legacyShopPrices : adventureShopPrices)[id] ?? 0;
export const createAdventureShopStock = (version: AdventureRulesVersion = 4): Record<string, number> => version === 1 ? { trail_mix: 1, berry_bait: 1 } : { dish_egg_rice: 2, trail_mix: 2, berry_bait: 1 };
export const adventureStepCount = 6;
export const adventureBusyMessage = () => L('伙伴正在探查途中，请先返回前哨基地。', 'Your companion is exploring. Return to the outpost first.');
export const adventureActorIds = ['official.furo', 'official.doro', 'official.mint'] as const;
export const adventureRegionIds: readonly AdventureRegionId[] = ['valley', 'windmill', 'forest', 'coast', 'observatory'];
export const getAdventureRegions = () => [
  { id: 'valley' as const, name: L('溪谷', 'Creek Valley'), description: L('沿着溪水，认清第一段回家的路。', 'Follow the creek and learn the first path home.'), open: true },
  { id: 'windmill' as const, name: L('风车山丘', 'Windmill Hills'), description: L('风车、花田与避风的小营地。', 'Windmills, flower fields and a sheltered camp.'), open: false },
  { id: 'forest' as const, name: L('雾松林地', 'Misty Pine Woods'), description: L('跟随林间足迹，寻找守望小屋。', 'Follow woodland tracks to a lookout cabin.'), open: false },
  { id: 'coast' as const, name: L('潮汐海岸', 'Tidal Coast'), description: L('沿海拾取漂流物，探访旧船屋。', 'Beachcomb along the shore near an old boathouse.'), open: false },
  { id: 'observatory' as const, name: L('旧观测站', 'Old Observatory'), description: L('远处的星图与观测遗迹仍在等待。', 'Star charts and old instruments await discovery.'), open: false },
];
export const adventureTaskName = () => L('入口附近探查', 'Scout the entrance');
export const adventureTreasureRewardText = (version: AdventureRulesVersion = 4) => version >= 4
  ? L(`通关：22 基础小心心＋随机战利品 ×1（${Math.min(...Object.values(adventureTreasureValues))}～${Math.max(...Object.values(adventureTreasureValues))} 金币）`, `Completion: 22 base hearts + 1 random treasure (${Math.min(...Object.values(adventureTreasureValues))}–${Math.max(...Object.values(adventureTreasureValues))} coins)`)
  : L(`通关：22 基础小心心＋金币堆 ×1（${adventureTreasureValues.coin_hoard} 金币）`, `Completion: 22 base hearts + 1 coin hoard (${adventureTreasureValues.coin_hoard} coins)`);
export const adventureDiscoveryNames = () => [L('溪谷入口', 'Valley entrance'), L('分岔小径', 'Forked path'), L('溪边足迹', 'Creekside tracks'), L('旧木桥', 'Old footbridge'), L('路边歇脚处', 'Wayside clearing'), L('温室远望点', 'Greenhouse overlook')];

export interface AdventureChoice {
  id: string;
  label: string;
  detail: string;
  energy: number;
  hunger: number;
  item?: ItemId;
  tool?: boolean;
}
const legacyAdventureSteps = (): { title: string; story: string; choices: AdventureChoice[] }[] => [
  { title: L('认清入口', 'Find your bearings'), story: L('大厅就在身后。先看看溪水的方向，把回来的路记在心里。', 'The hall is just behind you. Follow the water and remember your way back.'),
    choices: [{ id: 'entrance', label: L('沿入口小径探查', 'Survey the entrance path'), detail: L('记下第一个地标。', 'Record your first landmark.'), energy: 4, hunger: 3 }] },
  { title: L('小路分岔', 'A fork in the path'), story: L('溪边长着野果，坡上可以看见更远的路。今天先往哪里走？', 'Fruit grows by the creek; the slope offers a longer view. Which way today?'),
    choices: [
      { id: 'bank', label: L('沿溪采集', 'Gather by the creek'), detail: L('发现苹果 ×2。', 'Find 2 apples.'), energy: 5, hunger: 4 },
      { id: 'slope', label: L('登上缓坡', 'Climb the gentle slope'), detail: L('发现橙子 ×1，额外获得 8 金币。', 'Find an orange and 8 extra coins.'), energy: 7, hunger: 5 },
    ] },
  { title: L('谁在小路上', 'A visitor on the path'), story: L('一只小动物正忙着翻找草丛，挡住了窄窄的小路。', 'A small animal is rummaging in the grass, blocking the narrow path.'),
    choices: [
      { id: 'lure', label: L('用野果诱饵引开', 'Offer a berry lure'), detail: L('消耗野果诱饵包 ×1。', 'Uses 1 berry lure.'), energy: 3, hunger: 2, item: 'berry_bait' },
      { id: 'apple', label: L('放下一颗苹果', 'Leave an apple'), detail: L('消耗行囊中的苹果 ×1。', 'Uses 1 apple from your travel bag.'), energy: 4, hunger: 3, item: 'apple' },
      { id: 'detour', label: L('从草坡绕过去', 'Take a grassy detour'), detail: L('多走一段，保留物资。', 'Walk a little farther and keep your supplies.'), energy: 7, hunger: 5 },
    ] },
  { title: L('旧木桥旁', 'By the old footbridge'), story: L('桥边有一段湿滑的浅滩。借助绳索，或沿着平缓处慢慢绕行。', 'A slippery bank lies beside the bridge. Use a rope or walk around the gentle bank.'),
    choices: [
      { id: 'rope', label: L('借助探路绳通过', 'Use the trail rope'), detail: L('需要携带探路绳，不消耗工具。', 'Requires an equipped rope; the tool is kept.'), energy: 3, hunger: 2, tool: true },
      { id: 'ford', label: L('沿平缓处绕行', 'Walk around the bank'), detail: L('不用工具也能安全通过。', 'A safe route without a tool.'), energy: 6, hunger: 4 },
    ] },
  { title: L('路边歇脚处', 'Wayside clearing'), story: L('树荫下有一处适合整理行囊的空地。先看看补给，再决定是否继续。', 'A shaded clearing is a good place to check your bag before continuing.'),
    choices: [{ id: 'clearing', label: L('整理好行囊，继续探查', 'Continue after checking your bag'), detail: L('前往最后一个观察点。', 'Head toward the final lookout.'), energy: 4, hunger: 3 }] },
  { title: L('看见远处的温室', 'A glimpse of the greenhouse'), story: L('隔着溪谷，可以看见旧温室的屋顶。今天先记下方向，入口附近已经熟悉了。', 'Across the valley, you can see the greenhouse roof. Mark its direction: the entrance is now familiar.'),
    choices: [{ id: 'overlook', label: L('记录地标，完成探查', 'Record the landmark and finish scouting'), detail: L('完成后可带着本趟收获返回大厅。', 'Return to the hall with your discoveries.'), energy: 4, hunger: 3 }] },
];

const costs: Record<string, [number, number]> = {
  entrance: [45, 12], bank: [55, 14], slope: [65, 18], lure: [45, 10], apple: [50, 12], detour: [65, 22],
  rope: [45, 10], ford: [60, 18], clearing: [50, 12], overlook: [60, 16],
};
export const getAdventureSteps = (version: AdventureRulesVersion = 4) => legacyAdventureSteps().map(step => ({ ...step, choices: step.choices.map(choice => version === 1 ? choice : {
  ...choice, hunger: costs[choice.id][0], energy: costs[choice.id][1],
  detail: choice.id === 'slope' ? version === 2 ? L('发现橙子 ×1，额外获得 30 金币。', 'Find an orange and 30 extra coins.') : L('发现橙子 ×1，观察更远处的路。', 'Find an orange and survey the distant path.') : choice.id === 'overlook' && version >= 3 ? version >= 4 ? L('随机发现金币堆、溪谷琥珀或古老金条 ×1，可兑换金币。', 'Find one random coin hoard, valley amber or ancient gold bar to exchange for coins.') : L('固定发现金币堆 ×1，可兑换 360 金币。', 'Find a coin hoard worth 360 coins.') : choice.detail,
}) }));
