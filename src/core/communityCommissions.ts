import { recordEarnedCoins } from './achievements';
import type { CommissionTemplate, CommunityTask, WaterId } from './communityTypes';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, removeInventoryItem } from './items';
import type { Inventory, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { clampCoins } from './petStats';
import { hashString } from './utils';
import { enforceAdventureHealth } from './adventureReturn';
import { isAtCommunityBridge } from './valleyQuests';
import { decoratedOrderCoins } from './decorationEffects';
import { getRecipeUnlockReason } from './kitchenRecipes';
import { getRegionUnlocked, regionIds, regions, expeditionProducts } from './expeditionData';
import type { RegionId } from './expeditionTypes';
import type { RecipeId } from './companionActivityTypes';
import { isWaterOpen, commissionTemplates } from './communityData';
import { getLandmarkReason, isLandmarkId, landmarkNames, mapRegionForExpedition, parseLandmarkId, type LandmarkNode } from './landmarkProgress';
import { explorationTravel } from './explorationTravelData';

export interface CommissionDefinition { name: string; detail: string; coins: number; take?: Inventory; reward?: Inventory; event?: string; region?: RegionId; node?: LandmarkNode; recipe?: RecipeId; water?: WaterId; deliveryItem?: string }
export const commissionDefinitions = {
  valley_basket: { name: '晚饭前的一篮野菇', detail: '交付溪谷野菇 ×3，可使用库存；在溪边采集地手动采集可备齐。', coins: 55, take: { valley_mushroom: 3 } },
  valley_rice: { name: '邻居想尝尝野菇焖饭', detail: '交付野菇焖饭 ×1，可使用已有料理；读完温室手账后记下配方。', coins: 65, take: { dish_mushroom_rice: 1 } },
  forest_delicacy: { name: '美食家的林间珍味', detail: '交付松茸 ×1；在雾松林地的林莓丛调查累计 3 点获得，可以使用库存。', coins: 85, take: { matsutake: 1 } },
  tea_order: { name: '观星茶会的邀请', detail: '交付高山茶叶 ×1；在旧观测站的碎片采集地调查累计 3 点获得，可以使用库存。', coins: 80, take: { mountain_tea: 1 } },
  search: { name: '旧桥边的工具包', detail: '接取后前往溪谷旧木桥，在“整理发现与交接”阶段找到工具包，不消耗库存。', coins: 40, reward: { community_wood: 1, community_stone: 1 }, event: 'search' },
  forage: { name: '一束新鲜野香草', detail: '接取后实地采集，溪谷旧桥得到香草 ×1；带回后交付。已有库存不能替代采集事实。', coins: 45, take: { creek_herb: 1 }, event: 'forage' },
  vegetables: { name: '邻里晚餐的配菜', detail: '交付胡萝卜 ×2，可以使用已有库存；商店或社区菜地获得。', coins: 28, take: { carrot: 2 } },
  eggs: { name: '烘焙屋的鸡蛋', detail: '交付鸡蛋 ×2，可以使用已有库存；鸡舍或商店获得。', coins: 32, take: { egg: 2 } },
  milk: { name: '邻居的鲜奶早餐', detail: '交付牧场鲜奶 ×2，可以使用已有库存；牛棚或初始商店获得。', coins: 40, take: { farm_milk: 2 } },
  fish_pond: { name: '池塘水域调查', detail: '接取后在池塘成功钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 30, event: 'fish_pond' },
  fish_upstream: { name: '上游水域调查', detail: '接取后在上游成功钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 40, event: 'fish_upstream' },
  soup: { name: '邻里的一碗鲜鱼汤', detail: '交付香草鲜鱼汤 ×1，可以使用已有料理。', coins: 42, take: { dish_creek_fish_soup: 1 } },
  fresh_porridge: { name: '今天新煮的暖粥', detail: '接取后新制作香草暖粥，再交付 ×1；旧料理不能替代新制作事实。', coins: 38, take: { dish_herb_porridge: 1 }, event: 'cook_porridge' },
  delivery: { name: '给旧桥守望者送餐', detail: '将便当 ×1 装进行囊，在溪谷旧桥点击送达。实际扣除行囊便当，不触发喂食。', coins: 55, event: 'delivery' },
} as unknown as Record<CommissionTemplate, CommissionDefinition>;
for (const region of regionIds) {
  const r = regions[region], names = landmarkNames[mapRegionForExpedition[region]], factor = explorationTravel[region].payPercent / 100;
  commissionDefinitions[`${region}_survey`] = { name: `${r.name}入口的平安消息`, detail: `接取后完成「${names.entrance}」的一次手动探索。只记录现场调查，不扣库存。`, coins: Math.round(40 * factor), region, node: 'entrance', event: 'landmark:survey' };
  commissionDefinitions[`${region}_supplies`] = { name: `邻居想尝尝${expeditionProducts[r.product].name}`, detail: `交付${expeditionProducts[r.product].name} ×${region === 'valley' ? 3 : 4}，接受已有库存；在「${names.gather}」手动采集，或当地营地开放后挂机获得。`, coins: Math.round(55 * factor), take: { [r.product]: region === 'valley' ? 3 : 4 }, region, node: 'gather' };
  commissionDefinitions[`${region}_search`] = { name: `${names.crossing}遗落的记录袋`, detail: `接取后在「${names.crossing}」完成“整理发现与交接”阶段。不扣库存，找到后回公告板领取酬谢。`, coins: Math.round(45 * factor), region, node: 'crossing', event: 'landmark:search' };
  commissionDefinitions[`${region}_delivery`] = { name: `给${names.crossing}的邻居送餐`, detail: `携带便当 ×1，在「${names.crossing}」完成“整理发现与交接”后点击送达。扣除行囊便当，不作为喂食；回公告板领取酬谢。`, coins: Math.round(55 * factor), region, node: 'crossing', event: 'landmark:delivery', deliveryItem: 'bento' };
}
Object.assign(commissionDefinitions, {
  fish_forest_pool: { name: '林间水池调查', detail: '接取后在林间水池钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 60, region: 'forest', water: 'forest_pool', event: 'fish_forest_pool' },
  fish_coast_pier: { name: '海岸码头调查', detail: '接取后在海岸码头钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 70, region: 'coast', water: 'coast_pier', event: 'fish_coast_pier' },
});
for (const [template, metadata] of Object.entries({
  search: { region: 'valley', node: 'crossing' }, forage: { region: 'valley', node: 'crossing' }, delivery: { region: 'valley', node: 'crossing', deliveryItem: 'bento' },
  valley_basket: { region: 'valley', node: 'gather' }, valley_rice: { region: 'valley', node: 'story', recipe: 'mushroom_rice' }, forest_delicacy: { region: 'forest', node: 'gather' }, tea_order: { region: 'station', node: 'gather' },
  soup: { recipe: 'creek_fish_soup' }, fresh_porridge: { recipe: 'herb_porridge' }, fish_pond: { water: 'pond' }, fish_upstream: { water: 'upstream' },
})) Object.assign(commissionDefinitions[template as CommissionTemplate], metadata);
export const getCommunityDay = (pet: PetState, now = Date.now()) => [pet.community.boardDay, getEffectiveDailyDateKey(pet, now)].sort()[1];
export const getCommunityTasks = (pet: PetState): CommunityTask[] => [...(pet.community.commission ? [{ ...pet.community.commission, template: 'search' as const }] : []), ...pet.community.tasks];
const unlocked = (pet: PetState, template: CommissionTemplate) => {
  const c = pet.community;
  const def = commissionDefinitions[template];
  if (def.region && (!getRegionUnlocked(pet, def.region) || def.node && getLandmarkReason(pet.adventure, mapRegionForExpedition[def.region], def.node))) return false;
  if (def.recipe && getRecipeUnlockReason(pet, def.recipe)) return false;
  if (def.water && !isWaterOpen(pet, def.water)) return false;
  if (template === 'valley_rice') return c.expedition.regions.valley.surveyed || pet.adventure.valleyCompleted.includes('valley_story');
  if (template === 'forage') return c.herbDiscovered;
  if (template === 'fresh_porridge') return c.herbDiscovered && c.gardenBuilt;
  if (template === 'eggs' || template === 'milk') return true; // Both are also available in the initial shop.
  if (template === 'fish_pond') return c.facilities.fishing_hut.built;
  if (template === 'fish_upstream') return c.facilities.upstream.built;
  if (template === 'soup') return c.facilities.fishing_hut.built && c.herbDiscovered && c.gardenBuilt;
  return true;
};
export const getCommunityCandidates = (pet: PetState, now = Date.now()): CommunityTask[] => {
  if (!(pet.adventure.completed.tutorial ?? 0)) return [];
  const day = getCommunityDay(pet, now), c = pet.community;
  const region = getCommunityFocusRegion(pet, day), eligible = commissionTemplates.filter(id => !['search', 'valley_supplies', 'valley_delivery'].includes(id) && unlocked(pet, id));
  const chosen: CommissionTemplate[] = [];
  const pick = (list: CommissionTemplate[], salt: string) => { const pool = list.filter(id => !chosen.includes(id)); const item = pool[hashString(day + salt) % pool.length]; if (item) chosen.push(item); };
  const current = eligible.filter(id => commissionDefinitions[id].region === region);
  pick(current, ':current');
  pick(eligible.filter(id => commissionDefinitions[id].region && commissionDefinitions[id].region !== region), ':earlier');
  pick(eligible.filter(id => !commissionDefinitions[id].region), ':home');
  while (chosen.length < 3 && eligible.some(id => !chosen.includes(id))) pick(eligible, `:fill:${chosen.length}`);
  let templates = chosen;
  if (c.boardDay === day && c.candidates.length === 3) {
    templates = [...c.candidates];
    // Keep the two older/home slots and any accepted current slot stable for the entire day.
    if (c.boardRegion !== region && !c.acceptedToday.includes(`${templates[0]}:${day}`)) {
      const replacement = current.filter(id => !templates.slice(1).includes(id))[hashString(day + ':unlock') % Math.max(1, current.filter(id => !templates.slice(1).includes(id)).length)];
      if (replacement) templates[0] = replacement;
    }
    for (let i = 0; i < templates.length; i++) if (!unlocked(pet, templates[i]) && !c.acceptedToday.includes(`${templates[i]}:${day}`)) templates[i] = chosen.find(id => !templates.includes(id)) ?? templates[i];
  }
  return templates.map(template => ({ id: `${template}:${day}`, template, acceptedAt: 0, found: false, rewardCoins: decoratedOrderCoins(pet, commissionDefinitions[template].coins), region: commissionDefinitions[template].region, node: commissionDefinitions[template].node }));
};
export const getCommunityFocusRegion = (pet: PetState, day = getCommunityDay(pet)): RegionId => {
  const depth: Record<RegionId, number> = { valley: 0, hills: 1, forest: 2, coast: 2, station: 3 }, available = regionIds.filter(id => getRegionUnlocked(pet, id));
  const deepest = available.filter(id => depth[id] === Math.max(...available.map(id => depth[id])));
  return deepest[hashString(day + ':focus') % deepest.length] ?? 'valley';
};
export const advanceCommunityBoard = (pet: PetState, now: number): PetState => {
  const c = pet.community, day = getCommunityDay(pet, now);
  if (!(pet.adventure.completed.tutorial ?? 0)) return pet;
  const candidates = getCommunityCandidates(pet, now).map(task => task.template);
  const boardRegion = getCommunityFocusRegion(pet, day);
  if (c.boardDay === day && c.boardRegion === boardRegion && candidates.every((id, i) => id === c.candidates[i])) return pet;
  return { ...pet, community: { ...c, boardDay: day, boardRegion, candidates, acceptedToday: c.boardDay === day ? c.acceptedToday : [] } };
};
export const acceptCommunityTask = (pet: PetState, id: string, now = Date.now()): PetState => {
  const c = pet.community, day = getCommunityDay(pet, now), candidates = getCommunityCandidates(pet, now), candidate = candidates.find(task => task.id === id);
  const accepted = day === c.boardDay ? c.acceptedToday : [], active = getCommunityTasks(pet);
  if (pet.timePause || !candidate || !unlocked(pet, candidate.template) || accepted.includes(id) || accepted.length >= 2 || active.length >= 2 || active.some(task => task.template === candidate.template)) return pet;
  const task = { ...candidate, acceptedAt: now };
  return { ...pet, community: { ...c, boardDay: day, boardRegion: getCommunityFocusRegion(pet, day), candidates: candidates.map(task => task.template), acceptedToday: [...accepted, id],
    ...(task.template === 'search' ? { commission: { id, acceptedAt: now, found: false, rewardCoins: task.rewardCoins } } : { tasks: [...c.tasks, task] }) }, recentEvent: `接下「${commissionDefinitions[task.template].name}」，跨日仍可完成；每日最多接 2 单。` };
};
export const cancelCommunityTask = (pet: PetState, id: string): PetState => {
  if (!getCommunityTasks(pet).some(task => task.id === id)) return pet;
  return { ...pet, community: { ...pet.community, commission: pet.community.commission?.id === id ? undefined : pet.community.commission, tasks: pet.community.tasks.filter(task => task.id !== id) }, recentEvent: '已放弃委托，接取当天的额度不会退还。' };
};
export const canClaimCommunityTask = (pet: PetState, task: CommunityTask) => {
  const def = commissionDefinitions[task.template];
  return (!def.event || task.found) && Object.entries(def.take ?? {}).every(([id, quantity]) => (pet.inventory[id] ?? 0) >= quantity);
};
export const claimCommunityTask = (pet: PetState, id: string): PetState => {
  const task = getCommunityTasks(pet).find(task => task.id === id);
  if (pet.timePause || !task || pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active || !canClaimCommunityTask(pet, task)) return pet;
  const def = commissionDefinitions[task.template];
  if (clampCoins(pet.coins + (task.rewardCoins ?? def.coins)) !== pet.coins + (task.rewardCoins ?? def.coins)) return { ...pet, recentEvent: '金币已满，委托和交付物品继续保留。' };
  let inventory = Object.entries(def.take ?? {}).reduce((stock, [id, quantity]) => removeInventoryItem(stock, id, quantity), pet.inventory);
  if (Object.entries(def.reward ?? {}).some(([id, quantity]) => (inventory[id] ?? 0) + quantity > inventoryItemLimit)) return { ...pet, recentEvent: '奖励物资的仓库已满，委托与奖励会继续保留。' };
  inventory = Object.entries(def.reward ?? {}).reduce((stock, [id, quantity]) => addInventoryItem(stock, id, quantity), inventory);
  const coins = clampCoins(pet.coins + (task.rewardCoins ?? def.coins)) - pet.coins;
  return recordEarnedCoins({ ...pet, inventory, coins: pet.coins + coins, community: { ...pet.community, commissionsCompleted: pet.community.commissionsCompleted + 1, commission: pet.community.commission?.id === id ? undefined : pet.community.commission, tasks: pet.community.tasks.filter(task => task.id !== id) }, recentEvent: `完成「${def.name}」，收到 ${coins} 金币${def.reward ? '、木料和石料各 1 份' : ''}。` }, coins);
};
export const recordCommunityTaskEvent = (pet: PetState, event: string, now: number): PetState => {
  const tasks = pet.community.tasks.map(task => !task.found && now >= task.acceptedAt && commissionDefinitions[task.template].event === event ? { ...task, found: true } : task);
  const q = pet.community.commission;
  return { ...pet, community: { ...pet.community, tasks, commission: event === 'search' && q && !q.found && now >= q.acceptedAt ? { ...q, found: true } : q } };
};
export const recordCommunityCatch = (pet: PetState, water: WaterId, rare: boolean, now: number) => rare ? pet : recordCommunityTaskEvent(pet, `fish_${water}`, now);
export const recordLandmarkTaskEvent = (pet: PetState, region: RegionId, node: LandmarkNode, event: 'survey' | 'search' | 'visit', now: number): PetState => ({ ...pet, community: { ...pet.community, tasks: pet.community.tasks.map(task => {
  const def = commissionDefinitions[task.template];
  return !task.found && now >= task.acceptedAt && def.region === region && def.node === node && def.event === `landmark:${event}` ? { ...task, found: true } : task;
}) } });
export const canDeliverCommunityParcel = (pet: PetState, task: CommunityTask) => {
  const trip = pet.adventure.active, def = commissionDefinitions[task.template];
  if (!trip || task.found || !def.deliveryItem || !(trip.bag[def.deliveryItem] > 0)) return false;
  if (!isLandmarkId(trip.purpose)) return task.template === 'delivery' && isAtCommunityBridge(trip);
  const location = parseLandmarkId(trip.purpose);
  return mapRegionForExpedition[def.region ?? 'valley'] === location.region && (def.node ?? 'crossing') === location.node && Boolean(trip.stageIds?.some(id => id.endsWith(':record')));
};
export const deliverCommunityParcel = (pet: PetState, taskId: string, tripId: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = enforceAdventureHealth(pet, now);
  const trip = pet.adventure.active, task = pet.community.tasks.find(task => task.id === taskId);
  if (!trip || trip.id !== tripId || trip.revision !== revision || !task || now < task.acceptedAt || !canDeliverCommunityParcel(pet, task)) return pet;
  const item = commissionDefinitions[task.template].deliveryItem!;
  return { ...pet, adventure: { ...pet.adventure, active: { ...trip, bag: removeInventoryItem(trip.bag, item), revision: revision + 1 } }, community: { ...pet.community, tasks: pet.community.tasks.map(t => t.id === taskId ? { ...t, found: true } : t) }, recentEvent: '便当已交到当地邻居手中，行囊便当 −1；回公告板领取酬谢。' };
};
