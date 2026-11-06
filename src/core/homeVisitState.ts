import type { ItemId } from './petTypes';
import { isCourtyardNeighborId } from './courtyardState';
import { isBuiltinItemId } from './items';
import { getDish } from './kitchenRecipes';

export interface HomeVisitDaily {
  foodId?: ItemId;
  premiumChance?: number;
  played?: true;
  reward?: string;
}
export interface HomeVisitGift { neighborId: string; day: string; itemId: ItemId; premium: boolean }
export interface HomeVisitState {
  schemaVersion: 1;
  sequence: number;
  nextCheckAt: number;
  day: string;
  daily: Record<string, HomeVisitDaily>;
  active?: { id: number; neighborId: string; arrivedAt: number; leavesAt: number };
  pending: Record<string, HomeVisitGift>;
}

export const defaultHomeVisitState = (): HomeVisitState => ({ schemaVersion: 1, sequence: 0, nextCheckAt: 0, day: '', daily: {}, pending: {} });
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;
const dayKey = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : '';
const key = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200 && /^[a-z0-9:._-]+$/.test(value);

export const normalizeHomeVisitState = (raw: unknown): HomeVisitState => {
  const value = object(raw), active = object(value.active), day = dayKey(value.day);
  const state: HomeVisitState = { ...defaultHomeVisitState(), day, sequence: count(value.sequence), nextCheckAt: count(value.nextCheckAt, 8.64e15) };
  if (count(active.id) && isCourtyardNeighborId(active.neighborId) && count(active.leavesAt, 8.64e15) > count(active.arrivedAt, 8.64e15)) {
    state.active = { id: count(active.id), neighborId: active.neighborId, arrivedAt: count(active.arrivedAt, 8.64e15), leavesAt: count(active.leavesAt, 8.64e15) };
    state.sequence = Math.max(state.sequence, state.active.id);
  }
  state.daily = day ? Object.fromEntries(Object.entries(object(value.daily)).flatMap(([id, rawEntry]) => {
    if (!isCourtyardNeighborId(id)) return [];
    const entry = object(rawEntry), progress: HomeVisitDaily = {};
    if (typeof entry.foodId === 'string' && isBuiltinItemId(entry.foodId) && getDish(entry.foodId)) {
      progress.foodId = entry.foodId;
      progress.premiumChance = [2, 5, 10, 20, 35].includes(entry.premiumChance as number) ? entry.premiumChance as number : 2;
    }
    if (entry.played === true) progress.played = true;
    if (progress.foodId && progress.played && key(entry.reward)) progress.reward = entry.reward;
    return Object.keys(progress).length ? [[id, progress]] : [];
  })) : {};
  state.pending = Object.fromEntries(Object.entries(object(value.pending)).flatMap(([id, rawGift]) => {
    const gift = object(rawGift), giftDay = dayKey(gift.day);
    return key(id) && isCourtyardNeighborId(gift.neighborId) && giftDay && typeof gift.itemId === 'string' && isBuiltinItemId(gift.itemId)
      ? [[id, { neighborId: gift.neighborId, day: giftDay, itemId: gift.itemId, premium: gift.premium === true }]] : [];
  }));
  return state;
};
