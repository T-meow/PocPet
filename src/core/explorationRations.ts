import { getInventoryItem } from './items';
import type { Inventory, ItemId, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { explorationTravel } from './explorationTravelData';
import { hashString } from './utils';

export interface RationSelection { meals: Inventory[]; autoFill: boolean }
export interface RationQuoteSegment { food: Inventory; purchased: number; price: number; count: number; hunger: number; score: number; chance: number; reason: string }
export interface RationSegment extends RationQuoteSegment { roll: number; started: boolean; settled: boolean; won: boolean }
export const standardRationPrice = 28;
export const isTravelFood = (id: string) => {
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && item.usable !== false && item.kind === 'food' && !['golden_apple', 'birthday_cake'].includes(id) && (item.effect.hunger ?? 0) > 0);
};
export const getRationTreasureChance = (score: number, minimum: number) => Math.max(1, Math.min(15, 3 + 9 * (score / (54 * minimum) - 1)));
export const quoteExpeditionRations = (pet: PetState, region: RegionId, hours: number, selection?: RationSelection) => {
  const profile = explorationTravel[region], used: Inventory = {};
  const validDuration = [2, 4, 8].includes(hours);
  const segments: RationQuoteSegment[] = Array.from({ length: validDuration ? hours / 2 : 0 }, (_, index) => {
    const food = { ...(selection?.meals[index] ?? {}) };
    let count = 0, hunger = 0, score = 0, reason = '';
    for (const [id, n] of Object.entries(food)) {
      if (!Number.isInteger(n) || n < 0 || n > profile.meals * 2 || !isTravelFood(id)) { reason = '只能放入普通可食用补给'; continue; }
      const effect = getInventoryItem(id as ItemId)!.effect;
      used[id] = (used[id] ?? 0) + n;
      count += n; hunger += (effect.hunger ?? 0) * n;
      score += ['hunger', 'energy', 'mood', 'health', 'cleanliness'].reduce((sum, key) => sum + Math.max(0, effect[key as keyof typeof effect] ?? 0), 0) * n;
    }
    const purchased = selection?.autoFill === false ? 0 : Math.max(0, profile.meals - count, Math.ceil((profile.nutrition - hunger) / 36));
    count += purchased; hunger += purchased * 36; score += purchased * 54;
    if (count > profile.meals * 2) reason = `每段最多 ${profile.meals * 2} 份`;
    else if (count < profile.meals || hunger < profile.nutrition) reason = `每段需要至少 ${profile.meals} 份、${profile.nutrition} 基础饱食`;
    return { food, purchased, price: purchased * standardRationPrice, count, hunger, score, chance: getRationTreasureChance(score, profile.meals), reason };
  });
  const coins = segments.reduce((sum, s) => sum + s.price, 0);
  const reason = !validDuration ? '请选择 2、4、8 小时' : segments.find(s => s.reason)?.reason ?? (Object.entries(used).some(([id, n]) => (pet.inventory[id] ?? 0) < n) ? '库存料理不足，所有时段合计不能超过库存' : pet.coins < coins ? '标准补给所需金币不足' : '');
  return { segments, coins, used, reason };
};
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
