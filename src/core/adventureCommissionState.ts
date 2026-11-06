import type { AdventureCommission } from './adventureTypes';
import type { Inventory, PetState } from './petTypes';
import { isBuiltinItemId } from './items';
import { regionIds } from './expeditionData';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';
import { inventoryItemLimit } from './saveMetadata';

export const commissionLimit = 3;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';

export const normalizeAdventureCommissions = (raw: unknown): AdventureCommission[] => {
  const result: AdventureCommission[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (result.length >= commissionLimit) break;
    const value = object(entry), id = text(value.id, 128), actorId = text(value.actorId, 128);
    const region = regionIds.find(region => region === value.region);
    const startedAt = number(value.startedAt), endsAt = number(value.endsAt);
    if (!id || !actorId || !region || endsAt < startedAt || !endsAt || result.some(task => task.id === id || task.actorId === actorId)) continue;
    const items: Inventory = {};
    for (const [item, amount] of Object.entries(object(value.items))) {
      if (!isBuiltinItemId(item)) continue;
      const count = Math.floor(number(amount, inventoryItemLimit));
      if (count) items[item] = count;
    }
    const bonusItem = regionalTreasureIds.find(item => item === value.bonusItem && regionalTreasures[item].region === region);
    result.push({ id, actorId, actorName: text(value.actorName, 32) || '旅途伙伴', region, startedAt, endsAt,
      status: value.status === 'ready' ? 'ready' : 'active', items, bonusItem,
      bonusRemaining: Boolean(bonusItem && value.bonusRemaining === true), baseValue: number(value.baseValue),
      bonusChance: number(value.bonusChance, 100), durationMs: number(value.durationMs) || endsAt - startedAt,
      campReduction: number(value.campReduction, 20), decorationReduction: number(value.decorationReduction, 20) });
  }
  return result;
};

export const advanceAdventureCommissions = (pet: PetState, now: number): PetState => {
  if (pet.timePause || !pet.adventure.commissions.some(task => task.status === 'active' && task.endsAt <= now)) return pet;
  return { ...pet, adventure: { ...pet.adventure, commissions: pet.adventure.commissions.map(task =>
    task.status === 'active' && task.endsAt <= now ? { ...task, status: 'ready' as const } : task) } };
};
