import type { AdventureRegionId } from './adventureTypes';
import type { ItemId, PetState } from './petTypes';
import { adventureTreasureIds } from './adventureItems';
import { getIdleExplorationTargets, idleExplorationFocusWeight } from './explorationResources';
import { commonLootPityLimit, getCommonLootChance, getExplorationBudget } from './explorationBudget';
import { formatProbabilityPercent } from './displayNumbers';
import { wildIngredients } from './foodCatalog';
import { getEffectiveDailyDateKey } from './gameClock';
import { landmarkFirstReward, landmarkTargets } from './landmarkData';
import { completedLandmark, expeditionRegionForMap, getLandmarkReason, landmarkId, landmarkNames, landmarkNodes, type LandmarkNode } from './landmarkProgress';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';
import { getToolUsesLeft } from './toolDurability';

export const getAdventureMapResources = (pet: PetState, region: AdventureRegionId, node: LandmarkNode | undefined, mode: 'manual' | 'idle', now = Date.now()) => {
  const result = new Map<ItemId, Set<string>>();
  const add = (id: string, hint: string) => {
    const item = id as ItemId;
    if (!result.has(item)) result.set(item, new Set());
    result.get(item)!.add(hint);
  };
  const r = expeditionRegionForMap[region], budget = getExplorationBudget(pet, now);
  const treasure = regionalTreasureIds.find(id => regionalTreasures[id].region === r)!;
  const chanceFinds = budget?.version === 2 || budget?.vouchers.some(v => v.rewardsVersion === 1 && (v.lootUsed ?? 0) < (mode === 'idle' ? 80 : 100) && (!v.lootRegion || v.lootRegion === r));
  if (mode === 'idle') {
    for (const target of getIdleExplorationTargets(r)) for (const [id, count] of Object.entries(target.idle ?? {})) add(id, `随机采集：抽中「${target.name}」获得 ${count} 份；设为偏好后，该组抽取权重为其他目标的 ${idleExplorationFocusWeight} 倍`);
    add(treasure, '挂机基础每 30 分钟判定，运动技能与星辉穹顶可加速；料理影响概率，第 10 次判定保底');
  } else {
    for (const target of landmarkTargets(region)) {
      if (target === 'materials') { add('community_wood', '沿途随机采集，放大镜可定向查找木料与石料'); add('community_stone', '沿途随机采集，放大镜可定向查找木料与石料'); }
      else if (target !== treasure) {
        const food = wildIngredients[target as keyof typeof wildIngredients];
        add(target, food && food.investigations > 1 ? `食材调查进度满 ${food.investigations} 点可得` : '沿途随机采集，放大镜可定向查找');
      }
    }
    const trip = pet.adventure.active;
    if (getToolUsesLeft(pet, 'prospector_pick') > 0 || trip?.region === region && trip.rulesVersion === 9) add(treasure, `珍宝调查进度满 ${regionalTreasures[treasure].investigations} 点可得`);
    if (chanceFinds) add(treasure, '采集时有概率发现');
    const nodes = node ? [node] : landmarkNodes.filter(id => !getLandmarkReason(pet.adventure, region, id));
    for (const id of nodes) {
      if (!completedLandmark(pet.adventure, region, id)) for (const [item, count] of Object.entries(landmarkFirstReward(landmarkId(region, id)).items)) {
        if (count > 0) add(item, `${landmarkNames[region][id]}首通奖励`);
      }
      if (region !== 'valley') continue;
      if (id === 'crossing' && getEffectiveDailyDateKey(pet, now) > pet.community.seedForageDay) add('creek_herb_seed', '旧桥交接时获得，每日一次');
      if (id === 'entrance') {
        if (!budget?.firstTreasure) add('coin_hoard', '首次完成入口探查');
        if (!budget?.milestones.includes(6)) add('valley_amber', '入口累计记录 6 种观察结果');
        if (!budget?.milestones.includes(12) && pet.adventure.valleyCompleted.includes('valley_camp')) add('ancient_gold_bar', '完成溪谷营地后，入口累计记录 12 种观察结果');
      }
    }
  }
  if (chanceFinds) for (const id of adventureTreasureIds) add(id, budget?.version === 2
    ? `每次采集有 ${formatProbabilityPercent(getCommonLootChance(pet, mode === 'idle' ? 'hour' : 'manual', r))} 概率发现一种通用宝物，三种等概率；连续未掉落 ${budget.commonLootMisses ?? 0}／${commonLootPityLimit - 1} 次，第 ${commonLootPityLimit} 次保底`
    : '采集时有概率发现');
  return [...result].map(([id, hints]) => ({ id, hint: [...hints].join('；') }));
};
