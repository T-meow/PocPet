import { activityText as L } from './kitchenRecipes';
import type { AdventureDestinationId, AdventureRegionId, AdventureRulesVersion } from './adventureTypes';
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
export const adventureTutorialStepCount = 4;
export const getAdventureStepCount = (destination: AdventureDestinationId = 'valley') => destination === 'tutorial' ? adventureTutorialStepCount : adventureStepCount;
export const adventureBusyMessage = () => L('伙伴正在探查途中，请先返回前哨基地。', 'Your companion is exploring. Return to the outpost first.');
export const adventureActorIds = ['official.furo', 'official.doro', 'official.mint'] as const;
export const adventureRegionIds: readonly AdventureRegionId[] = ['valley', 'windmill', 'forest', 'coast', 'observatory'];
export const adventureDestinationIds: readonly AdventureDestinationId[] = ['tutorial', ...adventureRegionIds];
export const getAdventureRegions = () => [
  { id: 'valley' as const, name: L('溪谷', 'Creek Valley'), description: L('沿着溪水，认清第一段回家的路。', 'Follow the creek and learn the first path home.'), open: true },
  { id: 'windmill' as const, name: L('风车山丘', 'Windmill Hills'), description: L('风车、花田与避风的小营地。', 'Windmills, flower fields and a sheltered camp.'), open: false },
  { id: 'forest' as const, name: L('雾松林地', 'Misty Pine Woods'), description: L('跟随林间足迹，寻找守望小屋。', 'Follow woodland tracks to a lookout cabin.'), open: false },
  { id: 'coast' as const, name: L('潮汐海岸', 'Tidal Coast'), description: L('沿海拾取漂流物，探访旧船屋。', 'Beachcomb along the shore near an old boathouse.'), open: false },
  { id: 'observatory' as const, name: L('旧观测站', 'Old Observatory'), description: L('远处的星图与观测遗迹仍在等待。', 'Star charts and old instruments await discovery.'), open: false },
];
export const adventureTaskName = (destination: AdventureDestinationId = 'valley') => destination === 'tutorial' ? L('踩点探索', 'First scouting trip') : L('入口附近探查', 'Scout the entrance');
export const adventureTutorialRewardText = () => L(`固定发现：地图手册 ×1＋一堆金币 ×1（${adventureTreasureValues.coin_hoard} 金币）；通关后解锁大地图。`, `Guaranteed finds: 1 map handbook + 1 coin hoard (${adventureTreasureValues.coin_hoard} coins). Complete the tutorial to unlock the world map.`);
export const adventureTreasureRewardText = (version: AdventureRulesVersion = 4) => version >= 4
  ? L(`通关：22 基础小心心＋随机战利品 ×1（${Math.min(...Object.values(adventureTreasureValues))}～${Math.max(...Object.values(adventureTreasureValues))} 金币）`, `Completion: 22 base hearts + 1 random treasure (${Math.min(...Object.values(adventureTreasureValues))}–${Math.max(...Object.values(adventureTreasureValues))} coins)`)
  : L(`通关：22 基础小心心＋金币堆 ×1（${adventureTreasureValues.coin_hoard} 金币）`, `Completion: 22 base hearts + 1 coin hoard (${adventureTreasureValues.coin_hoard} coins)`);
export const adventureDiscoveryNames = (destination: AdventureDestinationId = 'valley') => destination === 'tutorial'
  ? [L('前哨门口', 'Outpost doorstep'), L('路标岔口', 'Signposted fork'), L('林边歇脚处', 'Woodland resting spot'), L('旧路标下的发现', 'Finds beneath the old signpost')]
  : [L('溪谷入口', 'Valley entrance'), L('分岔小径', 'Forked path'), L('溪边足迹', 'Creekside tracks'), L('旧木桥', 'Old footbridge'), L('路边歇脚处', 'Wayside clearing'), L('温室远望点', 'Greenhouse overlook')];

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
const tutorialSteps = (): ReturnType<typeof legacyAdventureSteps> => [
  { title: L('前哨门口', 'Outpost doorstep'), story: L('第一次远行不用走得太远。先绕着前哨看看，记住大厅与回家的方向。', 'Your first trip stays close to home. Walk around the outpost and remember the way back.'),
    choices: [{ id: 'tutorial_entrance', label: L('记住回大厅的路', 'Remember the way back'), detail: L('新手关共四个节点，随时可以安全返程。', 'There are four tutorial stops. You can return safely at any time.'), hunger: 8, energy: 2 }] },
  { title: L('路标岔口', 'Signposted fork'), story: L('岔口的木牌指向溪谷，另一条小路绕回前哨。先沿近处的小路踩点。', 'A wooden sign points toward the valley. A shorter path loops back to the outpost; follow it first.'),
    choices: [{ id: 'tutorial_signpost', label: L('沿近处的小路前进', 'Follow the nearby path'), detail: L('观察路标，熟悉探索时的路线选择。', 'Read the signs and learn how to choose a route.'), hunger: 8, energy: 2 }] },
  { title: L('林边歇脚处', 'Woodland resting spot'), story: L('林边有一块平整的石头，可以停下来整理行囊。更远的旅程需要提前准备补给。', 'A flat stone beside the woods makes a good resting spot. Longer trips will need supplies.'),
    choices: [{ id: 'tutorial_rest', label: L('检查行囊后继续', 'Check the bag and continue'), detail: L('途中可打开旅行背包使用补给；本次无需额外道具。', 'Open the travel bag to use supplies along the way. No extra items are needed for this trip.'), hunger: 8, energy: 2 }] },
  { title: L('旧路标下的发现', 'Finds beneath the old signpost'), story: L('回程的旧路标下放着一只旅行包。里面是一册地图手册，还有一堆亮闪闪的金币！', 'A travel pouch rests beneath an old signpost on the way back. Inside are a map handbook and a glittering coin hoard!'),
    choices: [{ id: 'tutorial_finish', label: L('收下发现，完成踩点', 'Collect the finds and finish scouting'), detail: adventureTutorialRewardText(), hunger: 8, energy: 2 }] },
];
export const getAdventureSteps = (version: AdventureRulesVersion = 4, destination: AdventureDestinationId = 'valley') => destination === 'tutorial' ? tutorialSteps() : legacyAdventureSteps().map(step => ({ ...step, choices: step.choices.map(choice => version === 1 ? choice : {
  ...choice, hunger: costs[choice.id][0], energy: costs[choice.id][1],
  detail: choice.id === 'slope' ? version === 2 ? L('发现橙子 ×1，额外获得 30 金币。', 'Find an orange and 30 extra coins.') : L('发现橙子 ×1，观察更远处的路。', 'Find an orange and survey the distant path.') : choice.id === 'overlook' && version >= 3 ? version >= 4 ? L('随机发现金币堆、溪谷琥珀或古老金条 ×1，可兑换金币。', 'Find one random coin hoard, valley amber or ancient gold bar to exchange for coins.') : L('固定发现金币堆 ×1，可兑换 360 金币。', 'Find a coin hoard worth 360 coins.') : choice.detail,
}) }));
