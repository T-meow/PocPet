import type { AnimalId, CommunityState } from './communityTypes';
import type { AdventureState } from './adventureTypes';
import type { RegionId } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';

export type CommunityUpgradeId = 'garden' | 'coop' | 'barn' | 'stall' | 'fishing_hut';
export interface CommunityUpgrade {
  name: string; effect: string; region: RegionId; coins: number; items: Inventory;
  water?: 'upstream' | 'forest_pool' | 'coast_pier';
}
const cost = (wood: number, stone: number, extra: Inventory): Inventory => ({ community_wood: wood, community_stone: stone, ...extra });
export const communityUpgrades: Record<CommunityUpgradeId, CommunityUpgrade[]> = {
  garden: [
    { name: '开垦第 2 块菜地', effect: '2 块菜地独立播种、照料与收获', region: 'valley', coins: 300, items: cost(6, 4, { bamboo_shoot: 4, creek_aquamarine: 1 }) },
    { name: '开垦第 3 块菜地', effect: '3 块菜地独立播种、照料与收获', region: 'hills', coins: 700, items: cost(10, 8, { wild_onion: 4, hill_sunstone: 1 }) },
  ],
  coop: [
    { name: '扩建鸡舍 · Lv.2', effect: '饲料容量 5 份，待收鸡蛋容量 10 份', region: 'valley', coins: 240, items: cost(6, 3, { valley_mushroom: 4, creek_aquamarine: 1 }) },
    { name: '扩建鸡舍 · Lv.3', effect: '饲料容量 8 份，待收鸡蛋容量 16 份', region: 'hills', coins: 500, items: cost(10, 6, { hill_honey: 3, hill_sunstone: 1 }) },
  ],
  barn: [
    { name: '扩建牛棚 · Lv.2', effect: '饲料容量 5 份，待收鲜奶容量 10 份', region: 'hills', coins: 420, items: cost(8, 4, { hill_honey: 3, hill_sunstone: 1 }) },
    { name: '扩建牛棚 · Lv.3', effect: '饲料容量 8 份，待收鲜奶容量 16 份', region: 'forest', coins: 800, items: cost(12, 8, { pine_resin: 3, forest_emerald: 1 }) },
  ],
  stall: [
    { name: '小摊扩建至 9 格', effect: '增加 3 格货架，新上架加价率 +5 个百分点；已有货品保持原价', region: 'valley', coins: 300, items: cost(4, 2, { valley_mushroom: 4, creek_aquamarine: 1 }) },
    { name: '小摊扩建至 12 格', effect: '增加 3 格货架，新上架加价率 +5 个百分点；已有货品保持原价', region: 'coast', coins: 500, items: cost(4, 2, { sea_glass: 3, tidal_pearl: 1 }) },
  ],
  fishing_hut: [
    { name: '钓鱼小屋 · Lv.2', effect: '每竿体力 3／饱食 1，提竿窗口 25 秒，收线张力 +30／+22', region: 'hills', water: 'upstream', coins: 300, items: cost(6, 4, { hill_sunstone: 1 }) },
    { name: '钓鱼小屋 · Lv.3', effect: '每竿体力 2／饱食 1，提竿窗口 30 秒，收线张力 +28／+20', region: 'forest', water: 'forest_pool', coins: 500, items: cost(8, 6, { forest_emerald: 1 }) },
    { name: '钓鱼小屋 · Lv.4', effect: '每竿体力 2／饱食 1，提竿窗口 35 秒，收线张力 +26／+18', region: 'coast', water: 'coast_pier', coins: 700, items: cost(10, 8, { tidal_pearl: 1 }) },
    { name: '钓鱼小屋 · Lv.5', effect: '每竿体力 1／饱食 1，提竿窗口 40 秒，收线张力 +24／+16', region: 'station', coins: 1000, items: cost(12, 10, { star_sapphire: 1 }) },
  ],
};
export const upgradeRegionNames: Record<RegionId, string> = { valley: '溪谷', hills: '风车山丘', forest: '雾松林地', coast: '潮汐海岸', station: '旧观测站' };
export const getCommunityUpgradeLevel = (pet: PetState, id: CommunityUpgradeId) => id === 'stall' ? pet.community.market.level : pet.community.upgrades[id];
export const getAnimalCapacity = (community: CommunityState, id: AnimalId) => {
  const level = Math.max(1, Math.min(3, community.upgrades[id]));
  return { feed: [3, 5, 8][level - 1], stock: [6, 10, 16][level - 1] };
};
export const getFishingLevelEffects = (level: number) => {
  const index = Math.max(1, Math.min(5, Math.floor(level) || 1)) - 1;
  return { energy: [3, 3, 2, 2, 1][index], hunger: index ? 1 : 2, waitSeconds: 8 - index };
};
export const openTutorialGarden = (community: CommunityState, adventure: AdventureState): CommunityState =>
  community.gardenBuilt || !((adventure.completed.tutorial ?? 0) > 0) ? community : { ...community, gardenBuilt: true, irrigationFound: true, repairStep: 2 };

// Shared by all upgrade entry points, including the older market API.
export const getCommunityUpgradeQuote = (pet: PetState, id: CommunityUpgradeId, expectedLevel = getCommunityUpgradeLevel(pet, id)) => {
  const level = getCommunityUpgradeLevel(pet, id), task = communityUpgrades[id]?.[level - 1];
  const built = id === 'garden' ? pet.community.gardenBuilt : pet.community.facilities[id].built;
  const reason = !built ? '先开放这座设施。' : level !== expectedLevel ? '设施等级已变化，请查看当前建设任务。' : !task ? '已完成全部扩建。'
    : !pet.community.expedition.regions[task.region].surveyed ? `先完成${upgradeRegionNames[task.region]}的地区故事。`
    : task.water && !(task.water === 'upstream' ? pet.community.facilities.upstream.built : pet.community.waterAccess[task.water].built) ? `先开放${task.water === 'upstream' ? '上游步道' : task.water === 'forest_pool' ? '林地深潭' : '海岸栈桥'}。`
    : pet.coins < task.coins || Object.entries(task.items).some(([item, quantity]) => (pet.inventory[item] ?? 0) < quantity) ? '金币或建设物资不足，备齐后一次交付。' : '';
  return { level, targetLevel: level + 1, task, reason, ready: !reason };
};
