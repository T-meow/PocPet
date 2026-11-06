import type { ItemId, PetState } from './petTypes';
import type { CourtyardContext, CourtyardNeighbor, CourtyardReceipt, CourtyardRequest } from './courtyardTypes';
import { courtyardActionBits, courtyardActions, courtyardEnergyCosts, courtyardEvents, courtyardFamiliarityTier, courtyardGiftChances,
  courtyardGreetings, courtyardOrdinaryItems, courtyardPremiumGifts, courtyardRefreshHours, courtyardResponses, courtyardSharePoints, courtyardVisitorLimit } from './courtyardData';
import { isCourtyardNeighborId } from './courtyardState';
import { getDailyResetDate, getDailyResetDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { canSpendCompanionTime } from './kitchen';
import { getDish } from './kitchenRecipes';
import { createBuiltinItemRegistry, addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { getMarketSale } from './marketValuation';
import { inventoryItemLimit } from './saveMetadata';
import { grantActivityHearts } from './activityHearts';
import { clampStat, getPetStatCap } from './petStats';
import { hashString } from './utils';

export const getCourtyardTime = (pet: PetState, now = Date.now()) => pet.timePause?.pausedAt ?? Math.max(now, pet.lastUpdatedAt);
export const isCourtyardOpen = (pet: PetState) => (pet.adventure.completed.tutorial ?? 0) > 0;

export const getCourtyardWindow = (now: number) => {
  const slot = Math.floor(((new Date(now).getHours() + 19) % 24) / courtyardRefreshHours);
  const start = getDailyResetDate(now);
  start.setHours(5 + slot * courtyardRefreshHours, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + courtyardRefreshHours);
  return { id: `${getDailyResetDateKey(now)}:${slot}`, startedAt: start.getTime(), endsAt: end.getTime() };
};

const randomFor = (seed: string) => {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
};

const candidatesFor = (context: CourtyardContext) => [...new Map(context.neighbors.filter(neighbor =>
  isCourtyardNeighborId(neighbor.modId) && neighbor.modId !== context.actorId).map(neighbor => [neighbor.modId, neighbor])).values()]
  .sort((a, b) => a.modId.localeCompare(b.modId));

export const advanceCourtyard = (pet: PetState, context: CourtyardContext, now = Date.now()): PetState => {
  if (!isCourtyardOpen(pet) || pet.timePause) return pet;
  const time = getCourtyardTime(pet, now), day = getEffectiveDailyDateKey(pet, time), previous = pet.community.courtyard;
  const refresh = !previous.rotationId || time >= previous.nextRefreshAt;
  if (!refresh && previous.day === day) return pet;
  const courtyard = { ...previous, day, dailyInteractions: previous.day === day ? previous.dailyInteractions : {} };
  if (refresh) {
    const window = getCourtyardWindow(time), candidates = candidatesFor(context), random = randomFor(`${pet.saveMetadata.id}:courtyard:${window.id}`);
    for (let index = candidates.length - 1; index > 0; index--) {
      const selected = Math.floor(random() * (index + 1));
      [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
    }
    courtyard.rotationId = window.id;
    courtyard.rotationStartedAt = window.startedAt;
    courtyard.nextRefreshAt = window.endsAt;
    courtyard.visitorIds = candidates.slice(0, courtyardVisitorLimit).map(neighbor => neighbor.modId);
  }
  return { ...pet, community: { ...pet.community, courtyard } };
};

export const getCourtyardShareInfo = (foodId: string, neighbor: CourtyardNeighbor) => {
  const dish = getDish(foodId);
  if (!dish) return undefined;
  const favorite = neighbor.favoriteFoodIds?.some(id => id === foodId) === true;
  const rarity = favorite ? 'legendary' : dish.recipe.rarity;
  return { rarity, favorite, premiumChance: courtyardGiftChances[rarity], points: courtyardSharePoints[rarity] };
};

export const getCourtyardGiftValue = (id: string) => id === 'golden_apple' ? getInventoryItem(id)?.price ?? 888 : getMarketSale(id)?.base ?? 0;
let ordinaryPools: { dishes: ItemId[]; items: ItemId[] } | undefined;
export const getCourtyardOrdinaryGiftPools = (): { dishes: ItemId[]; items: ItemId[] } => {
  if (!ordinaryPools) {
    const inRange = (id: string) => { const value = getCourtyardGiftValue(id); return value >= 50 && value <= 500; };
    ordinaryPools = {
      dishes: [...createBuiltinItemRegistry().values()].map(item => item.id).filter(id => Boolean(getDish(id)) && inRange(id)),
      items: courtyardOrdinaryItems.filter(inRange),
    };
  }
  return ordinaryPools;
};

export const getCourtyardGift = (pet: PetState, neighbor: CourtyardNeighbor, foodId: string, day: string) => {
  const info = getCourtyardShareInfo(foodId, neighbor);
  if (!info) return undefined;
  const random = randomFor(`${pet.saveMetadata.id}:courtyard-gift:${day}:${neighbor.modId}`);
  const premium = random() * 100 < info.premiumChance;
  const ordinary = getCourtyardOrdinaryGiftPools();
  const pool = premium ? courtyardPremiumGifts : random() < .5 ? ordinary.dishes : ordinary.items;
  if (!pool.length) return undefined;
  return { itemId: pool[Math.floor(random() * pool.length)], premium };
};

export const getCourtyardInteractionReason = (pet: PetState, context: CourtyardContext, request: CourtyardRequest, now = Date.now()) => {
  if (!isCourtyardOpen(pet)) return '完成第一次踩点后，就能来小院走走。';
  if (pet.timePause) return '恢复时间后再和邻居相处。';
  const state = pet.community.courtyard, time = getCourtyardTime(pet, now);
  if (!state.rotationId || state.rotationId !== request.rotationId || time >= state.nextRefreshAt) return '这一轮邻居已经离开，看看新来访的邻居吧。';
  if (request.day !== state.day || state.day !== getEffectiveDailyDateKey(pet, time)) return '新的一天到了，请重新打开邻居的互动窗口。';
  if (!courtyardActions.includes(request.action) || request.neighborId === context.actorId || !state.visitorIds.includes(request.neighborId)
    || !context.neighbors.some(neighbor => neighbor.modId === request.neighborId)) return '这位邻居现在不在小院。';
  if ((state.dailyInteractions[request.neighborId] ?? 0) & courtyardActionBits[request.action]) return '今天已经和这位邻居进行过这项互动了。';
  if (!canSpendCompanionTime(pet)) return '伙伴正在休息或忙碌，空闲后再来相处吧。';
  if (pet.energy < courtyardEnergyCosts[request.action]) return `需要 ${courtyardEnergyCosts[request.action]} 点体力。`;
  if (request.action === 'help' && pet.hearts > Number.MAX_SAFE_INTEGER - 10) return '小心心已满，腾出空间后再来帮忙吧。';
  if (request.action === 'share' && request.foodId && (!getDish(request.foodId) || (pet.inventory[request.foodId] ?? 0) < 1)) return '仓库里没有这份成品料理。';
  return '';
};

export const getCourtyardGreeting = (pet: PetState, neighborId: string) => {
  const tier = courtyardFamiliarityTier(pet.community.relationships[neighborId]?.points ?? 0);
  const greetings = courtyardGreetings[tier];
  return greetings[Math.floor(randomFor(`${pet.saveMetadata.id}:greeting:${pet.community.courtyard.rotationId}:${neighborId}`)() * greetings.length)];
};

export const interactCourtyard = (pet: PetState, context: CourtyardContext, request: CourtyardRequest, now = Date.now()): PetState => {
  if (getCourtyardInteractionReason(pet, context, request, now)) return pet;
  const neighbor = context.neighbors.find(value => value.modId === request.neighborId)!;
  const share = request.action === 'share' && request.foodId ? getCourtyardShareInfo(request.foodId, neighbor) : undefined;
  const gift = share ? getCourtyardGift(pet, neighbor, request.foodId!, request.day) : undefined;
  if (request.action === 'share' && (!share || !gift)) return pet;
  const state = pet.community.courtyard;
  if (state.interactionsCount >= Number.MAX_SAFE_INTEGER || gift && (state.pendingGifts[gift.itemId] ?? 0) >= Number.MAX_SAFE_INTEGER) return pet;
  const points = share?.points ?? ({ chat: 2, play: 5, help: 4, share: 0 }[request.action]);
  const energy = courtyardEnergyCosts[request.action], mood = request.action === 'play' ? clampStat(pet.mood + 10, getPetStatCap(pet, 'mood')) - pet.mood : 0;
  let inventory = share ? removeInventoryItem(pet.inventory, request.foodId!, 1) : pet.inventory;
  const pendingGifts = { ...state.pendingGifts };
  const pending = Boolean(gift && (inventory[gift.itemId] ?? 0) >= inventoryItemLimit);
  if (gift) {
    if (pending) pendingGifts[gift.itemId] = (pendingGifts[gift.itemId] ?? 0) + 1;
    else inventory = addInventoryItem(inventory, gift.itemId, 1);
  }
  const sequence = state.interactionsCount + 1, random = randomFor(`${pet.saveMetadata.id}:courtyard-event:${request.day}:${neighbor.modId}:${request.action}`);
  const events = courtyardEvents[request.action], event = events[Math.floor(random() * events.length)];
  const previousPoints = pet.community.relationships[neighbor.modId]?.points ?? 0;
  const responses = courtyardResponses[courtyardFamiliarityTier(previousPoints)];
  const narrative = event.text.replace(/\{neighbor\}/g, () => neighbor.name).replace(/\{food\}/g, () => getInventoryItem(request.foodId!)?.name ?? '这份料理');
  const receipt: CourtyardReceipt = { id: `${request.day}:${neighbor.modId}:${request.action}`, sequence, at: getCourtyardTime(pet, now),
    neighborId: neighbor.modId, neighborName: neighbor.name, action: request.action, title: event.title,
    text: `${narrative}${share?.favorite ? '这正是对方喜欢的料理，收到时格外开心。' : ''}${responses[Math.floor(random() * responses.length)]}`,
    points, energy, mood, hearts: request.action === 'help' ? 10 : 0,
    ...(share ? { foodId: request.foodId } : {}), ...(gift ? { rewardId: gift.itemId, premium: gift.premium, pending } : {}) };
  const next: PetState = { ...pet, inventory, energy: pet.energy - energy, mood: pet.mood + mood, lastInteractionAt: getCourtyardTime(pet, now),
    recentEvent: `${event.title} · 熟悉度 +${points}${gift ? ` · 收到${getInventoryItem(gift.itemId)?.name ?? gift.itemId}${pending ? '（待领取）' : ''}` : ''}`,
    community: { ...pet.community, relationships: { ...pet.community.relationships, [neighbor.modId]: { points: Math.min(Number.MAX_SAFE_INTEGER, previousPoints + points) } },
      courtyard: { ...state, dailyInteractions: { ...state.dailyInteractions, [neighbor.modId]: (state.dailyInteractions[neighbor.modId] ?? 0) | courtyardActionBits[request.action] },
        interactionsCount: sequence, pendingGifts, lastInteraction: receipt } } };
  return request.action === 'help' ? grantActivityHearts(next, 10) : next;
};

export const claimCourtyardGifts = (pet: PetState): PetState => {
  if (pet.timePause) return pet;
  let inventory = pet.inventory, received = 0;
  const pendingGifts = { ...pet.community.courtyard.pendingGifts };
  for (const [id, remaining] of Object.entries(pendingGifts)) {
    const amount = Math.min(remaining, Math.max(0, inventoryItemLimit - (inventory[id] ?? 0)));
    if (!amount) continue;
    inventory = addInventoryItem(inventory, id, amount);
    received += amount;
    if (amount === remaining) delete pendingGifts[id]; else pendingGifts[id] = remaining - amount;
  }
  if (!received) return pet;
  return { ...pet, inventory, recentEvent: `收下小院回礼 ${received} 件。`,
    community: { ...pet.community, courtyard: { ...pet.community.courtyard, pendingGifts } } };
};
