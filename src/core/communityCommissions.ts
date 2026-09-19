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

export const commissionDefinitions: Record<CommissionTemplate, { name: string; detail: string; coins: number; take?: Inventory; reward?: Inventory; event?: string }> = {
  search: { name: '旧桥边的工具包', detail: '接取后在溪谷旧桥搜寻；短途第三节点必定找到，不消耗库存。', coins: 40, reward: { community_wood: 1, community_stone: 1 }, event: 'search' },
  forage: { name: '一束新鲜野香草', detail: '接取后实地采集，溪谷旧桥得到香草 ×1；带回后交付。已有库存不能替代采集事实。', coins: 45, take: { creek_herb: 1 }, event: 'forage' },
  vegetables: { name: '邻里晚餐的配菜', detail: '交付胡萝卜 ×2，可以使用已有库存；商店或社区菜地获得。', coins: 28, take: { carrot: 2 } },
  eggs: { name: '烘焙屋的鸡蛋', detail: '交付鸡蛋 ×2，可以使用已有库存；鸡舍或商店获得。', coins: 32, take: { egg: 2 } },
  milk: { name: '邻居的鲜奶早餐', detail: '交付牧场鲜奶 ×2，可以使用已有库存；牛棚生产。', coins: 40, take: { farm_milk: 2 } },
  fish_pond: { name: '池塘水域调查', detail: '接取后在池塘成功钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 30, event: 'fish_pond' },
  fish_upstream: { name: '上游水域调查', detail: '接取后在上游成功钓起一条普通鱼。只记录调查，不扣鱼获。', coins: 40, event: 'fish_upstream' },
  soup: { name: '邻里的一碗鲜鱼汤', detail: '交付香草鲜鱼汤 ×1，可以使用已有料理。', coins: 42, take: { dish_creek_fish_soup: 1 } },
  fresh_porridge: { name: '今天新煮的暖粥', detail: '接取后新制作香草暖粥，再交付 ×1；旧料理不能替代新制作事实。', coins: 38, take: { dish_herb_porridge: 1 }, event: 'cook_porridge' },
  delivery: { name: '给旧桥守望者送餐', detail: '将便当 ×1 装进行囊，在溪谷旧桥点击送达。实际扣除行囊便当，不触发喂食。', coins: 55, event: 'delivery' },
};
export const getCommunityDay = (pet: PetState, now = Date.now()) => [pet.community.boardDay, getEffectiveDailyDateKey(pet, now)].sort()[1];
export const getCommunityTasks = (pet: PetState): CommunityTask[] => [...(pet.community.commission ? [{ ...pet.community.commission, template: 'search' as const }] : []), ...pet.community.tasks];
const unlocked = (pet: PetState, template: CommissionTemplate) => {
  const c = pet.community;
  if (template === 'forage') return c.herbDiscovered;
  if (template === 'fresh_porridge') return c.herbDiscovered && c.gardenBuilt;
  if (template === 'eggs') return c.facilities.coop.built;
  if (template === 'milk') return c.facilities.barn.built;
  if (template === 'fish_pond') return c.facilities.fishing_hut.built;
  if (template === 'fish_upstream') return c.facilities.upstream.built;
  if (template === 'soup') return c.facilities.fishing_hut.built && c.herbDiscovered && c.gardenBuilt;
  return true;
};
export const getCommunityCandidates = (pet: PetState, now = Date.now()): CommunityTask[] => {
  if (!(pet.adventure.completed.tutorial ?? 0)) return [];
  const day = getCommunityDay(pet, now), c = pet.community;
  const production: CommissionTemplate[] = ['vegetables', 'eggs', 'milk', 'soup'];
  const activity: CommissionTemplate[] = ['delivery', 'forage', 'fish_pond', 'fish_upstream', 'fresh_porridge'];
  const pick = (list: CommissionTemplate[], salt: string) => { const choices = list.filter(id => unlocked(pet, id)); return choices[hashString(day + salt) % choices.length]; };
  const templates = c.boardDay === day && c.candidates.length === 3 ? c.candidates : ['search', pick(production, 'produce'), pick(activity, 'activity')] as CommissionTemplate[];
  return templates.map(template => ({ id: `${template}:${day}`, template, acceptedAt: 0, found: false }));
};
export const advanceCommunityBoard = (pet: PetState, now: number): PetState => {
  const c = pet.community, day = getCommunityDay(pet, now);
  if (c.boardDay === day && c.candidates.length === 3 || !(pet.adventure.completed.tutorial ?? 0)) return pet;
  const candidates = getCommunityCandidates(pet, now).map(task => task.template);
  return { ...pet, community: { ...c, boardDay: day, candidates, acceptedToday: c.boardDay === day ? c.acceptedToday : [] } };
};
export const acceptCommunityTask = (pet: PetState, id: string, now = Date.now()): PetState => {
  const c = pet.community, day = getCommunityDay(pet, now), candidates = getCommunityCandidates(pet, now), candidate = candidates.find(task => task.id === id);
  const accepted = day === c.boardDay ? c.acceptedToday : [], active = getCommunityTasks(pet);
  if (!candidate || accepted.includes(id) || accepted.length >= 2 || active.length >= 2 || active.some(task => task.template === candidate.template)) return pet;
  const task = { ...candidate, acceptedAt: now };
  return { ...pet, community: { ...c, boardDay: day, candidates: candidates.map(task => task.template), acceptedToday: [...accepted, id],
    ...(task.template === 'search' ? { commission: { id, acceptedAt: now, found: false } } : { tasks: [...c.tasks, task] }) }, recentEvent: `接下「${commissionDefinitions[task.template].name}」，跨日仍可完成；每日最多接 2 单。` };
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
  if (!task || pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active || !canClaimCommunityTask(pet, task)) return pet;
  const def = commissionDefinitions[task.template];
  let inventory = Object.entries(def.take ?? {}).reduce((stock, [id, quantity]) => removeInventoryItem(stock, id, quantity), pet.inventory);
  if (Object.entries(def.reward ?? {}).some(([id, quantity]) => (inventory[id] ?? 0) + quantity > inventoryItemLimit)) return { ...pet, recentEvent: '奖励物资的仓库已满，委托与奖励会继续保留。' };
  inventory = Object.entries(def.reward ?? {}).reduce((stock, [id, quantity]) => addInventoryItem(stock, id, quantity), inventory);
  const coins = clampCoins(pet.coins + def.coins) - pet.coins;
  return recordEarnedCoins({ ...pet, inventory, coins: pet.coins + coins, community: { ...pet.community, commission: pet.community.commission?.id === id ? undefined : pet.community.commission, tasks: pet.community.tasks.filter(task => task.id !== id) }, recentEvent: `完成「${def.name}」，收到 ${coins} 金币${def.reward ? '、木料和石料各 1 份' : ''}。` }, coins);
};
export const recordCommunityTaskEvent = (pet: PetState, event: string, now: number): PetState => {
  const tasks = pet.community.tasks.map(task => !task.found && now >= task.acceptedAt && commissionDefinitions[task.template].event === event ? { ...task, found: true } : task);
  const q = pet.community.commission;
  return { ...pet, community: { ...pet.community, tasks, commission: event === 'search' && q && !q.found && now >= q.acceptedAt ? { ...q, found: true } : q } };
};
export const recordCommunityCatch = (pet: PetState, water: WaterId, rare: boolean, now: number) => rare ? pet : recordCommunityTaskEvent(pet, `fish_${water}`, now);
export const deliverCommunityParcel = (pet: PetState, taskId: string, tripId: string, revision: number, now = Date.now()): PetState => {
  pet = enforceAdventureHealth(pet, now);
  const trip = pet.adventure.active, task = pet.community.tasks.find(task => task.id === taskId && task.template === 'delivery');
  if (!trip || trip.id !== tripId || trip.revision !== revision || !isAtCommunityBridge(trip) || !task || task.found || now < task.acceptedAt || (trip.bag.bento ?? 0) < 1) return pet;
  const next = { ...pet, adventure: { ...pet.adventure, active: { ...trip, bag: removeInventoryItem(trip.bag, 'bento'), revision: revision + 1 } }, recentEvent: '便当已送到旧桥守望者手中，行囊便当 −1；回社区公告板领酬谢。' };
  return recordCommunityTaskEvent(next, 'delivery', now);
};
