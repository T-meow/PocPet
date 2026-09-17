import { adventureActorIds, adventureBagCapacity, adventureRegionIds, adventureStepCount, adventureTransportLimit, createAdventureShopStock, getAdventureSteps } from './adventureData';
import type { AdventureRegionId, AdventureResult, AdventureState, AdventureTrip } from './adventureTypes';
import { getInventoryItem, isBuiltinItemId } from './items';
import type { Inventory, ItemId, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getAdventureTripTreasure, isAdventureTreasure } from './adventureItems';
import { getDailyResetDateKey } from './dailyReset';

const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const count = (raw: unknown, max = Number.MAX_SAFE_INTEGER) => typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.floor(raw))) : 0;
const text = (raw: unknown, max = 128) => typeof raw === 'string' ? raw.slice(0, max) : '';
export const isAdventureSupply = (id: string): id is ItemId => {
  if (id === 'berry_bait' || id === 'golden_apple') return true;
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && item.usable !== false && id !== 'birthday_cake' && ((item.effect.hunger ?? 0) > 0 || (item.effect.energy ?? 0) > 0));
};
export const getAdventureBagCount = (bag: Inventory) => Object.values(bag).reduce((sum, n) => sum + n, 0);
export const isAdventureCarryItem = (id: string) => isAdventureSupply(id) || isAdventureTreasure(id);
// Keep room for returned adventure gear, which cannot be consumed to clear a full warehouse.
export const getAdventureItemPurchaseCapacity = (pet: PetState, id: string) => {
  if (!['trail_mix', 'berry_bait', 'trail_rope'].includes(id)) return Infinity;
  const trip = pet.adventure.active;
  const reserved = (trip?.bag[id] ?? 0) + (trip?.loot[id] ?? 0) + (id === 'trail_rope' && trip?.tool ? 1 : 0) + (pet.adventure.pending?.items[id] ?? 0);
  return Math.max(0, inventoryItemLimit - (pet.inventory[id] ?? 0) - reserved);
};
export const defaultAdventureState = (): AdventureState => ({ schemaVersion: 2, starterClaimed: false, starterMealsClaimed: false, tripsStarted: 0, completed: {}, lastCompletedDay: {}, discoveries: [], active: undefined, pending: undefined, journal: [] });
const dayKey = (raw: unknown) => typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
export const getAdventureLastCompletedDay = (state: AdventureState, region: AdventureRegionId) => state.journal
  .filter(entry => entry.region === region && entry.complete)
  .reduce((latest, entry) => { const day = entry.completedDay ?? getDailyResetDateKey(entry.endedAt); return day > latest ? day : latest; }, state.lastCompletedDay?.[region] ?? '');
export const isAdventureEntranceCompleteForDay = (state: AdventureState, region: AdventureRegionId, today = getDailyResetDateKey(Date.now())) => region === 'valley'
  ? getAdventureLastCompletedDay(state, region) >= today : (state.completed[region] ?? 0) > 0;

const inventory = (raw: unknown, bag = false): Inventory => {
  const result: Inventory = {};
  let remaining = bag ? adventureBagCapacity : Number.MAX_SAFE_INTEGER;
  for (const [id, amount] of Object.entries(object(raw))) {
    if (bag ? !isAdventureCarryItem(id) : !isBuiltinItemId(id)) continue;
    const quantity = Math.min(remaining, count(amount, inventoryItemLimit));
    if (quantity) { result[id] = quantity; remaining -= quantity; }
  }
  return result;
};
const normalizeTrip = (raw: unknown, legacy: boolean): AdventureTrip | undefined => {
  const value = object(raw);
  if (!text(value.id) || value.region !== 'valley' || !text(value.actorId)) return undefined;
  const rulesVersion = legacy || value.rulesVersion === 1 ? 1 : value.rulesVersion === 4 ? 4 : value.rulesVersion === 3 ? 3 : 2;
  const options = getAdventureSteps(rulesVersion);
  const choices: string[] = [];
  for (const choice of Array.isArray(value.choices) ? value.choices.slice(0, adventureStepCount) : []) {
    if (!options[choices.length]?.choices.some(option => option.id === choice)) break;
    choices.push(String(choice));
  }
  const bag = inventory(value.bag, true);
  const loot = inventory(value.loot);
  if (legacy) {
    const found = choices.includes('bank') ? { id: 'apple', amount: 2 } : choices.includes('slope') ? { id: 'orange', amount: 1 } : undefined;
    if (found) {
      const fitting = Math.min(found.amount, adventureBagCapacity - getAdventureBagCount(bag));
      if (fitting) bag[found.id] = (bag[found.id] ?? 0) + fitting;
      if (fitting < found.amount) loot[found.id] = (loot[found.id] ?? 0) + found.amount - fitting;
    }
  }
  const initialStock = createAdventureShopStock(rulesVersion);
  const savedStock = object(value.shopStock);
  const shopStock = Object.fromEntries(Object.entries(initialStock).map(([id, amount]): [string, number] => [id, legacy ? value.bought === true ? 0 : amount : count(savedStock[id], amount)]).filter(([, amount]) => amount > 0));
  return { id: text(value.id), region: 'valley', actorId: text(value.actorId), actorName: text(value.actorName, 32), startedAt: count(value.startedAt), choices,
    rulesVersion, revision: count(value.revision), bag, loot, tool: value.tool === true,
    neighborId: adventureActorIds.some(id => id === value.neighborId && id !== value.actorId) ? String(value.neighborId) : undefined,
    shopStock, purchases: legacy ? value.bought === true ? 1 : 0 : count(value.purchases),
    transportedCount: legacy ? value.transported === true ? 1 : 0 : count(value.transportedCount, rulesVersion === 1 ? 1 : adventureTransportLimit),
    ...(rulesVersion >= 4 ? { treasure: isAdventureTreasure(String(value.treasure)) ? value.treasure as AdventureTrip['treasure'] : getAdventureTripTreasure(text(value.id)) } : {}),
    ...(choices.length === adventureStepCount && dayKey(value.completedDay) ? { completedDay: dayKey(value.completedDay) } : {}) };
};
const normalizeResult = (raw: unknown): AdventureResult | undefined => {
  const value = object(raw);
  if (!text(value.id) || value.region !== 'valley') return undefined;
  const steps = count(value.steps, adventureStepCount);
  const complete = value.complete === true && steps === adventureStepCount;
  return { id: text(value.id), region: 'valley', actorId: text(value.actorId), actorName: text(value.actorName, 32), endedAt: count(value.endedAt), steps, complete,
    first: complete && value.first === true, hearts: count(value.hearts, 10000), coins: count(value.coins, 10000), items: inventory(value.items), rewardsClaimed: value.rewardsClaimed === true,
    ...(complete ? { completedDay: dayKey(value.completedDay) ?? getDailyResetDateKey(count(value.endedAt)) } : {}) };
};
export const normalizeAdventureState = (raw: unknown): AdventureState => {
  const value = object(raw);
  const completed = object(value.completed);
  const pending = normalizeResult(value.pending);
  const journal = (Array.isArray(value.journal) ? value.journal : []).slice(0, 8).map(normalizeResult).filter((entry): entry is AdventureResult => Boolean(entry));
  const lastCompletedDay = Object.fromEntries(adventureRegionIds.flatMap(region => {
    const days = [dayKey(object(value.lastCompletedDay)[region]), ...journal.filter(entry => entry.region === region && entry.complete).map(entry => entry.completedDay)];
    const latest = days.reduce<string>((previous, day) => day && day > previous ? day : previous, '');
    return latest ? [[region, latest]] : [];
  }));
  return {
    schemaVersion: 2, starterClaimed: value.starterClaimed === true, starterMealsClaimed: value.starterMealsClaimed === true, tripsStarted: count(value.tripsStarted),
    completed: Object.fromEntries(adventureRegionIds.filter(id => count(completed[id]) > 0).map(id => [id, count(completed[id])])),
    discoveries: Array.isArray(value.discoveries) ? [...new Set(value.discoveries.filter((id): id is string => typeof id === 'string' && /^valley:[0-5]$/.test(id)))].slice(0, adventureStepCount) : [],
    lastCompletedDay,
    active: pending ? undefined : normalizeTrip(value.active, value.schemaVersion !== 2), pending,
    journal,
  };
};
