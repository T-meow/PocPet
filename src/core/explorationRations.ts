import { getInventoryItem } from './items';
import type { Inventory, ItemId, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { explorationTravel } from './explorationTravelData';
import { hashString } from './utils';

export interface RationSelection { food: Inventory; autoFill: boolean }
export interface RationQuote {
  food: Inventory; used: Inventory; purchased: number; coins: number; count: number;
  hunger: number; score: number; chance: number; minimum: number; maximum: number; nutrition: number; reason: string;
}
export interface RationDiscovery { roll: number; settled: boolean; won: boolean }
export interface RationPlan {
  version: 1; food: Inventory; purchased: number; coins: number; hunger: number; score: number; chance: number;
  discoveries: RationDiscovery[];
}
export interface RationReturn {
  eaten: Inventory; shared: Inventory; neighbor: 'official.mint' | 'official.furo';
}
export interface RationQuoteSegment { food: Inventory; purchased: number; price: number; count: number; hunger: number; score: number; chance: number; reason: string }
export interface RationSegment extends RationQuoteSegment { roll: number; started: boolean; settled: boolean; won: boolean }
export const standardRationPrice = 28;
export const isTravelFood = (id: string) => {
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && item.usable !== false && item.kind === 'food' && !['golden_apple', 'birthday_cake'].includes(id) && (item.effect.hunger ?? 0) > 0);
};
export const getRationTreasureChance = (score: number, minimum: number) => Math.max(1, Math.min(15, 3 + 9 * (score / (54 * minimum) - 1)));
export const quoteExpeditionRations = (pet: PetState, region: RegionId, hours: number, selection?: RationSelection): RationQuote => {
  const profile = explorationTravel[region], used: Inventory = {};
  const validDuration = [2, 4, 8].includes(hours);
  const minimum = validDuration ? profile.meals * hours / 2 : 0, maximum = minimum * 2, nutrition = validDuration ? profile.nutrition * hours / 2 : 0;
  let count = 0, hunger = 0, score = 0, reason = validDuration ? '' : '请选择 2、4、8 小时';
  for (const [id, n] of Object.entries(selection?.food ?? {})) {
    if (!Number.isSafeInteger(n) || n < 0 || !isTravelFood(id)) { reason ||= '只能放入普通可食用补给'; continue; }
    if (!n) continue;
    const effect = getInventoryItem(id as ItemId)!.effect;
    used[id] = n; count += n; hunger += (effect.hunger ?? 0) * n;
    score += ['hunger', 'energy', 'mood', 'health', 'cleanliness'].reduce((sum, key) => sum + Math.max(0, effect[key as keyof typeof effect] ?? 0), 0) * n;
  }
  const purchased = selection?.autoFill === false ? 0 : Math.max(0, minimum - count, Math.ceil((nutrition - hunger) / 36));
  count += purchased; hunger += purchased * 36; score += purchased * 54;
  const coins = purchased * standardRationPrice, food = { ...used };
  if (purchased) food.trail_mix = (food.trail_mix ?? 0) + purchased;
  if (count > maximum) reason ||= `全程最多 ${maximum} 份，请移回多余料理`;
  else if (count < minimum || hunger < nutrition) reason ||= `全程需要至少 ${minimum} 份、${nutrition} 基础饱食`;
  if (Object.entries(used).some(([id, n]) => (pet.inventory[id] ?? 0) < n)) reason ||= '库存料理不足，请调整携带数量';
  if (pet.coins < coins) reason ||= '标准补给所需金币不足';
  return { food, used, purchased, coins, count, hunger, score, chance: minimum ? getRationTreasureChance(score, minimum) : 0, minimum, maximum, nutrition, reason };
};
export const lockRationPlan = (quote: RationQuote, hours: number, tripId: string): RationPlan => ({
  version: 1, food: { ...quote.food }, purchased: quote.purchased, coins: quote.coins, hunger: quote.hunger, score: quote.score, chance: quote.chance,
  discoveries: Array.from({ length: hours / 2 }, (_, index) => ({ roll: hashString(`${tripId}:ration:${index}`) % 1000000 / 10000, settled: false, won: false })),
});

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const finite = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const normalizeFood = (raw: unknown, limit = 56): Inventory => {
  const food: Inventory = {};
  for (const [id, n] of Object.entries(record(raw)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!isTravelFood(id)) continue;
    const count = Math.min(limit, Math.floor(finite(n, 56)));
    if (count) { food[id] = count; limit -= count; }
  }
  return food;
};
export const normalizeRationPlan = (raw: unknown, hours: number): RationPlan => {
  const value = record(raw), s = value.version === 1 ? value : {}, food = normalizeFood(s.food);
  const purchased = Math.floor(finite(s.purchased, food.trail_mix ?? 0));
  const discoveries = Array.isArray(s.discoveries) ? s.discoveries : [];
  return { version: 1, food, purchased, coins: Math.floor(finite(s.coins, purchased * standardRationPrice)), hunger: finite(s.hunger, 100000), score: finite(s.score, 1000000), chance: finite(s.chance, 15),
    discoveries: Array.from({ length: hours / 2 }, (_, index) => {
      const d = record(discoveries[index]);
      return { roll: typeof d.roll === 'number' && d.roll >= 0 && d.roll < 100 ? d.roll : 100, settled: d.settled === true, won: d.settled === true && d.won === true };
    }) };
};
export const normalizeRationReturn = (raw: unknown): RationReturn | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = record(raw), eaten = normalizeFood(s.eaten), shared = normalizeFood(s.shared, 56 - Object.values(eaten).reduce((sum, n) => sum + n, 0));
  return { eaten, shared, neighbor: s.neighbor === 'official.furo' ? 'official.furo' : 'official.mint' };
};

// Legacy trips keep their already purchased segment snapshots and refund rules.
export const lockRationSegments = (segments: RationQuoteSegment[], tripId: string): RationSegment[] => segments.map((s, index) => ({ ...s, food: { ...s.food }, roll: hashString(`${tripId}:ration:${index}`) % 1000000 / 10000, started: index === 0, settled: false, won: false }));

// Saved scores and rolls belong to the purchased trip, not to the latest item balance.
export const normalizeRationSegments = (raw: unknown, parts: number): RationSegment[] => {
  const values = Array.isArray(raw) ? raw : [];
  const finite = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  return Array.from({ length: parts / 2 }, (_, index) => {
    const s = values[index] && typeof values[index] === 'object' ? values[index] : {};
    let room = 14;
    const food: Inventory = {};
    for (const [id, n] of Object.entries(s.food ?? {})) {
      if (!isTravelFood(id)) continue;
      const count = Math.min(room, Math.floor(finite(n, 14)));
      if (count) { food[id] = count; room -= count; }
    }
    const purchased = Math.min(room, Math.floor(finite(s.purchased, 14)));
    return { food, purchased, price: Math.floor(finite(s.price, purchased * standardRationPrice)), count: 14 - room + purchased, hunger: finite(s.hunger, 10000), score: finite(s.score, 100000), chance: finite(s.chance, 15), reason: '', roll: typeof s.roll === 'number' && s.roll >= 0 && s.roll < 100 ? s.roll : 100,
      started: index === 0 || s.started === true || s.settled === true, settled: s.settled === true, won: s.settled === true && s.won === true };
  });
};
