import type { CourtyardReceipt, CourtyardState, NeighborRelationship } from './courtyardTypes';
import { courtyardActions } from './courtyardData';
import { isBuiltinItemId } from './items';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const text = (value: unknown, length: number) => typeof value === 'string' ? value.slice(0, length) : '';
export const isCourtyardNeighborId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(value);
const dayKey = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : '';

export const defaultCourtyardState = (): CourtyardState => ({ schemaVersion: 1, rotationId: '', rotationStartedAt: 0, nextRefreshAt: 0,
  visitorIds: [], day: '', dailyInteractions: {}, interactionsCount: 0, pendingGifts: {} });

export const normalizeNeighborRelationships = (raw: unknown): Record<string, NeighborRelationship> => Object.fromEntries(
  Object.entries(object(raw)).flatMap(([id, value]) => isCourtyardNeighborId(id) && count(object(value).points) > 0 ? [[id, { points: count(object(value).points) }]] : []));

export const normalizeCourtyardReceipt = (raw: unknown): CourtyardReceipt | undefined => {
  const value = object(raw), action = value.action as CourtyardReceipt['action'];
  if (!text(value.id, 256) || !count(value.sequence) || !count(value.at, 8.64e15) || !isCourtyardNeighborId(value.neighborId) || !courtyardActions.includes(action)) return undefined;
  return { id: text(value.id, 256), sequence: count(value.sequence), at: count(value.at, 8.64e15), neighborId: value.neighborId,
    neighborName: text(value.neighborName, 64), action, title: text(value.title, 64), text: text(value.text, 1200),
    points: count(value.points, 12), energy: count(value.energy, 10), mood: count(value.mood, 10), hearts: count(value.hearts, 10),
    ...(typeof value.foodId === 'string' && isBuiltinItemId(value.foodId) ? { foodId: value.foodId } : {}), ...(typeof value.rewardId === 'string' && isBuiltinItemId(value.rewardId) ? { rewardId: value.rewardId } : {}),
    ...(value.premium === true ? { premium: true } : {}), ...(value.pending === true ? { pending: true } : {}) };
};

export const normalizeCourtyardState = (raw: unknown): CourtyardState => {
  const value = object(raw), nextRefreshAt = count(value.nextRefreshAt, 8.64e15), rotationStartedAt = count(value.rotationStartedAt, 8.64e15);
  const rotationId = nextRefreshAt > rotationStartedAt ? text(value.rotationId, 128) : '';
  const day = dayKey(value.day), interactionsCount = count(value.interactionsCount);
  const receipt = normalizeCourtyardReceipt(value.lastInteraction);
  return { schemaVersion: 1, rotationId, rotationStartedAt: rotationId ? rotationStartedAt : 0, nextRefreshAt: rotationId ? nextRefreshAt : 0,
    visitorIds: rotationId && Array.isArray(value.visitorIds) ? [...new Set(value.visitorIds.filter(isCourtyardNeighborId))].slice(0, 3) : [],
    day, dailyInteractions: day ? Object.fromEntries(Object.entries(object(value.dailyInteractions)).flatMap(([id, mask]) =>
      isCourtyardNeighborId(id) && count(mask, 15) ? [[id, count(mask, 15)]] : [])) : {},
    interactionsCount, pendingGifts: Object.fromEntries(Object.entries(object(value.pendingGifts)).flatMap(([id, amount]) =>
      isBuiltinItemId(id) && count(amount) ? [[id, count(amount)]] : [])),
    ...(receipt && receipt.sequence <= interactionsCount ? { lastInteraction: receipt } : {}) };
};
