import type { ItemId, PetState } from './petTypes';
import type { CourtyardContext } from './courtyardTypes';
import type { HomeVisitDaily } from './homeVisitState';
import { drawNeighborGift, getCourtyardShareInfo, getCourtyardTime, isCourtyardOpen } from './courtyard';
import { isCourtyardNeighborId } from './courtyardState';
import { canSpendCompanionTime } from './kitchen';
import { getDailyResetDate, getDailyResetDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { clampPetStat } from './petStats';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';

export const homeVisitChance = 20;
export const homeVisitInvitePoints = 60;
export const homeVisitDurationMs = 60 * 60_000;
export const homeVisitPlayEnergy = 10;
export interface HomeVisitRequest { visitId: number; neighborId: string; day: string }

export const getHomeVisitWindow = (now: number) => {
  const slot = Math.floor(((new Date(now).getHours() + 19) % 24) / 2), end = getDailyResetDate(now);
  end.setHours(5 + (slot + 1) * 2, 0, 0, 0);
  return { id: `${getDailyResetDateKey(now)}:${slot}`, endsAt: end.getTime() };
};
// Mix the hash before sampling: adjacent calendar keys must not produce adjacent rolls.
const random = (seed: string) => {
  let value = hashString(seed) + 0x6d2b79f5 | 0;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};
const availableNeighbors = (context: CourtyardContext) => [...new Map(context.neighbors.filter(neighbor =>
  isCourtyardNeighborId(neighbor.modId) && neighbor.modId !== context.actorId).map(neighbor => [neighbor.modId, neighbor])).values()]
  .sort((left, right) => left.modId.localeCompare(right.modId));
const prepareDay = (pet: PetState, now: number): PetState => {
  const state = pet.community.homeVisit, time = getCourtyardTime(pet, now), day = getEffectiveDailyDateKey(pet, time);
  const expired = state.active && time >= state.active.leavesAt;
  if (day === state.day && !expired) return pet;
  return { ...pet, community: { ...pet.community, homeVisit: { ...state, day,
    daily: state.day === day ? state.daily : {}, active: expired ? undefined : state.active } } };
};

export const advanceHomeVisit = (pet: PetState, context: CourtyardContext, now = Date.now()): PetState => {
  if (pet.timePause || !isCourtyardOpen(pet)) return pet;
  const current = prepareDay(pet, now), state = current.community.homeVisit, time = getCourtyardTime(current, now);
  if (state.active || time < state.nextCheckAt || !canSpendCompanionTime(current)) return current;
  const window = getHomeVisitWindow(time), seed = `${pet.saveMetadata.id}:home-visit:${window.id}`;
  const neighbors = availableNeighbors(context);
  const neighbor = random(`${seed}:chance`) * 100 < homeVisitChance && neighbors.length && state.sequence < Number.MAX_SAFE_INTEGER
    ? neighbors[Math.floor(random(`${seed}:neighbor`) * neighbors.length)] : undefined;
  const homeVisit = { ...state, nextCheckAt: window.endsAt, ...(neighbor ? {
    sequence: state.sequence + 1, active: { id: state.sequence + 1, neighborId: neighbor.modId, arrivedAt: time, leavesAt: time + homeVisitDurationMs },
  } : {}) };
  return { ...current, community: { ...current.community, homeVisit }, ...(neighbor ? { recentEvent: `${neighbor.name}来串门了，快招呼对方坐一会儿吧。` } : {}) };
};

export const getHomeInviteReason = (pet: PetState, context: CourtyardContext, neighborId: string, now = Date.now()) => {
  if (!isCourtyardOpen(pet)) return '完成第一次踩点后开放邻居来访。';
  if (pet.timePause) return '恢复时间后再邀请邻居。';
  if (!availableNeighbors(context).some(neighbor => neighbor.modId === neighborId)) return '这位邻居暂时不能来访。';
  if ((pet.community.relationships[neighborId]?.points ?? 0) < homeVisitInvitePoints) return `熟悉度达到 ${homeVisitInvitePoints} 后可邀请。`;
  const active = pet.community.homeVisit.active;
  if (active && getCourtyardTime(pet, now) < active.leavesAt) return '家里已经有客人，先和对方道别吧。';
  if (!canSpendCompanionTime(pet)) return '伙伴正在休息或忙碌，空闲后再邀请吧。';
  if (pet.community.homeVisit.sequence >= Number.MAX_SAFE_INTEGER) return '暂时无法安排新的来访。';
  return '';
};

export const inviteHomeNeighbor = (pet: PetState, context: CourtyardContext, neighborId: string, now = Date.now()): PetState => {
  if (getHomeInviteReason(pet, context, neighborId, now)) return pet;
  const current = prepareDay(pet, now), state = current.community.homeVisit, time = getCourtyardTime(current, now);
  const neighbor = context.neighbors.find(value => value.modId === neighborId)!;
  return { ...current, recentEvent: `${neighbor.name}应邀来家里玩，今天一起吃点好吃的吧。`, community: { ...current.community, homeVisit: {
    ...state, sequence: state.sequence + 1, nextCheckAt: Math.max(state.nextCheckAt, getHomeVisitWindow(time).endsAt),
    active: { id: state.sequence + 1, neighborId, arrivedAt: time, leavesAt: time + homeVisitDurationMs },
  } } };
};

export const getHomeVisitReason = (pet: PetState, context: CourtyardContext, request: HomeVisitRequest, now = Date.now()) => {
  if (pet.timePause) return '恢复时间后再招待邻居。';
  if (!isCourtyardOpen(pet)) return '完成第一次踩点后开放邻居来访。';
  const state = pet.community.homeVisit, time = getCourtyardTime(pet, now);
  if (!state.active || state.active.id !== request.visitId || state.active.neighborId !== request.neighborId || time >= state.active.leavesAt) return '这次来访已经结束。';
  if (request.day !== state.day || state.day !== getEffectiveDailyDateKey(pet, time)) return '新的一天到了，请重新打开招待窗口。';
  if (!availableNeighbors(context).some(neighbor => neighbor.modId === request.neighborId)) return '这位邻居暂时不能互动。';
  if (!canSpendCompanionTime(pet)) return '伙伴正在休息或忙碌，空闲后再一起玩吧。';
  return '';
};

export const hostHomeNeighbor = (pet: PetState, context: CourtyardContext, request: HomeVisitRequest, action: 'eat' | 'play', foodId?: ItemId, now = Date.now()): PetState => {
  if (getHomeVisitReason(pet, context, request, now) || !['eat', 'play'].includes(action)) return pet;
  const state = pet.community.homeVisit, previous = state.daily[request.neighborId] ?? {};
  if (previous.reward || action === 'eat' && previous.foodId || action === 'play' && previous.played) return pet;
  const neighbor = context.neighbors.find(value => value.modId === request.neighborId)!;
  const food = action === 'eat' && foodId ? getCourtyardShareInfo(foodId, neighbor) : undefined;
  if (action === 'eat' && (!food || !foodId || (pet.inventory[foodId] ?? 0) < 1)) return pet;
  if (action === 'play' && pet.energy < homeVisitPlayEnergy) return pet;
  const progress: HomeVisitDaily = action === 'eat' ? { ...previous, foodId, premiumChance: food!.premiumChance } : { ...previous, played: true };
  const pending = { ...state.pending };
  if (progress.foodId && progress.played) {
    const gift = drawNeighborGift(`${pet.saveMetadata.id}:home-visit-gift:${state.day}:${neighbor.modId}`, progress.premiumChance ?? 2);
    if (!gift) return pet;
    progress.reward = `${state.sequence}:${state.day}:${neighbor.modId}`;
    pending[progress.reward] = { neighborId: neighbor.modId, day: state.day, ...gift };
  }
  const events = ['在地毯上抛接软球，笑着接住了最后一球。', '一起猜了几个谜语，最后一题让彼此都笑出了声。', '轮流吹起泡泡，看着小小的彩虹飘向窗边。', '一起拼好了小拼图，把最后一块留给了对方。', '玩了一会儿翻牌，比起输赢更在意一起笑的时刻。', '用纸折了两只小船，给它们取了有趣的名字。'];
  const narrative = action === 'eat' ? `一起分享了${getInventoryItem(foodId!)?.name ?? '料理'}${food?.favorite ? '，正是对方喜欢的味道' : ''}。` : events[Math.floor(random(`${state.day}:${neighbor.modId}:play`) * events.length)];
  return { ...pet, inventory: action === 'eat' ? removeInventoryItem(pet.inventory, foodId!, 1) : pet.inventory,
    energy: pet.energy - (action === 'play' ? homeVisitPlayEnergy : 0), mood: action === 'play' ? clampPetStat(pet, pet.mood + 10, 'mood') : pet.mood,
    lastInteractionAt: getCourtyardTime(pet, now), recentEvent: `和${neighbor.name}${narrative}${progress.reward ? ' 邻居准备了一份回礼，记得收下。' : ''}`,
    community: { ...pet.community, homeVisit: { ...state, daily: { ...state.daily, [neighbor.modId]: progress }, pending } } };
};

export const dismissHomeNeighbor = (pet: PetState, visitId: number, now = Date.now()): PetState => {
  if (pet.timePause || pet.community.homeVisit.active?.id !== visitId) return pet;
  const state = pet.community.homeVisit;
  return { ...pet, recentEvent: '和邻居挥手道别，约好有空再来坐坐。', community: { ...pet.community, homeVisit: {
    ...state, active: undefined, nextCheckAt: Math.max(state.nextCheckAt, getHomeVisitWindow(getCourtyardTime(pet, now)).endsAt),
  } } };
};

export const claimHomeVisitGift = (pet: PetState, rewardId: string): PetState => {
  const state = pet.community.homeVisit;
  if (!Object.prototype.hasOwnProperty.call(state.pending, rewardId)) return pet;
  const gift = state.pending[rewardId];
  if (pet.timePause || !gift || (pet.inventory[gift.itemId] ?? 0) >= inventoryItemLimit) return pet;
  const pending = { ...state.pending }; delete pending[rewardId];
  return { ...pet, inventory: addInventoryItem(pet.inventory, gift.itemId, 1), recentEvent: `收下拜访回礼：${getInventoryItem(gift.itemId)?.name ?? gift.itemId} ×1。`,
    community: { ...pet.community, homeVisit: { ...state, pending } } };
};
