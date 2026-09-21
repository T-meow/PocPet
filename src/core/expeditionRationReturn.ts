import { getInventoryItem } from './items';
import { getItemRecoveryPreview, itemStatKeys } from './itemEffects';
import { updatePetSatiety } from './petStats';
import type { Inventory, ItemId, PetState } from './petTypes';
import type { ExpeditionTrip } from './expeditionTypes';
import type { RationReturn } from './explorationRations';

const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const getRemainingRations = (trip: ExpeditionTrip, now: number): Inventory => {
  if (!trip.rationPlan) return {};
  const duration = trip.endsAt - trip.startedAt;
  const remaining = Math.max(0, Math.min(duration, trip.endsAt - now));
  if (duration <= 0 || !remaining) return {};
  const entries = Object.entries(trip.rationPlan.food).filter(([, n]) => n > 0).map(([id, n]) => {
    const numerator = n * remaining;
    return { id, count: Math.floor(numerator / duration), remainder: numerator % duration };
  });
  const target = Math.floor(Object.values(trip.rationPlan.food).reduce((sum, n) => sum + n, 0) * remaining / duration);
  let extra = target - entries.reduce((sum, entry) => sum + entry.count, 0);
  entries.sort((a, b) => b.remainder - a.remainder || compareId(a.id, b.id));
  for (const entry of entries) if (extra > 0) { entry.count++; extra--; }
  return Object.fromEntries(entries.sort((a, b) => compareId(a.id, b.id)).filter(entry => entry.count > 0).map(entry => [entry.id, entry.count]));
};

// The food was deducted at departure. Apply only normal eating recovery here;
// calling the public inventory action would advance the lifecycle recursively.
export const eatReturningRations = (pet: PetState, trip: ExpeditionTrip, now: number) => {
  const summary: RationReturn = { eaten: {}, shared: {}, neighbor: trip.actorId === 'official.mint' ? 'official.furo' : 'official.mint' };
  for (const [id, count] of Object.entries(getRemainingRations(trip, now))) {
    const item = getInventoryItem(id as ItemId);
    let eaten = 0;
    if (item) for (; eaten < count; eaten++) {
      const preview = getItemRecoveryPreview(pet, item, 1);
      if (!preview.quantity) break;
      const recovered = { ...pet };
      for (const key of itemStatKeys) recovered[key] += preview.actual[key] ?? 0;
      pet = updatePetSatiety(recovered);
    }
    if (eaten) summary.eaten[id] = eaten;
    if (eaten < count) summary.shared[id] = count - eaten;
  }
  return { pet, summary };
};

export const rationReturnLines = (summary: RationReturn) => {
  const list = (items: Inventory) => Object.entries(items).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n}`).join('、');
  const lines: string[] = [];
  if (Object.keys(summary.eaten).length) lines.push(`提前吃掉了：${list(summary.eaten)}。`);
  if (Object.keys(summary.shared).length) lines.push(`吃饱后，把剩余料理分给了路过的邻居 ${summary.neighbor === 'official.mint' ? 'mint' : 'Furo'}：${list(summary.shared)}。`);
  return lines;
};
