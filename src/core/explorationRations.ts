import { getInventoryItem } from './items';
import type { Inventory, ItemId } from './petTypes';

// Fishing still uses travel food and returns its unused rations.
export interface RationSelection { food: Inventory; autoFill: boolean }
export interface RationReturn {
  eaten: Inventory; shared: Inventory; neighbor: 'official.mint' | 'official.furo';
}
export const standardRationPrice = 10;
export const isTravelFood = (id: string) => {
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && item.usable !== false && item.kind === 'food' && !['golden_apple', 'birthday_cake'].includes(id) && (item.effect.hunger ?? 0) > 0);
};

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const normalizeFood = (raw: unknown, limit = 56): Inventory => {
  const food: Inventory = {};
  for (const [id, n] of Object.entries(record(raw)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!isTravelFood(id) || typeof n !== 'number' || !Number.isFinite(n)) continue;
    const count = Math.min(limit, Math.max(0, Math.min(56, Math.floor(n))));
    if (count) { food[id] = count; limit -= count; }
  }
  return food;
};
export const normalizeRationReturn = (raw: unknown): RationReturn | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = record(raw), eaten = normalizeFood(s.eaten), shared = normalizeFood(s.shared, 56 - Object.values(eaten).reduce((sum, n) => sum + n, 0));
  return { eaten, shared, neighbor: s.neighbor === 'official.furo' ? 'official.furo' : 'official.mint' };
};
