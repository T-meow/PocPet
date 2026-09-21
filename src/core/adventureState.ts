import { adventureActorIds, adventureBagCapacity, adventureDestinationIds, adventureStepCount, adventureTutorialStepCount, adventureTransportLimit, createAdventureShopStock, getAdventureStepCount, getAdventureSteps } from './adventureData';
import type { AdventureDestinationId, AdventureResult, AdventureState, AdventureTrip } from './adventureTypes';
import { getInventoryItem, isBuiltinItemId } from './items';
import type { Inventory, ItemId, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getAdventureTripTreasure, isAdventureTreasure } from './adventureItems';
import { getDailyResetDateKey } from './dailyReset';
import { facilityIds } from './communityData';
import type { CommunityRoute } from './communityTypes';
import { isValleyQuest, valleyQuestIds } from './valleyQuests';
import { explorationBackpackCapacities, normalizeBackpackLevel } from './explorationTravelData';

const object = (raw: unknown): Record<string, unknown> => raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
const count = (raw: unknown, max = Number.MAX_SAFE_INTEGER) => typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.floor(raw))) : 0;
const text = (raw: unknown, max = 128) => typeof raw === 'string' ? raw.slice(0, max) : '';
export const isAdventureSupply = (id: string): id is ItemId => {
  if (id === 'berry_bait' || id === 'golden_apple') return true;
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && item.usable !== false && id !== 'birthday_cake' && ((item.effect.hunger ?? 0) > 0 || (item.effect.energy ?? 0) > 0 || item.kind === 'care' && ((item.effect.health ?? 0) > 0 || (item.effect.mood ?? 0) > 0)));
};
export const getAdventureBagCount = (bag: Inventory) => Object.values(bag).reduce((sum, n) => sum + n, 0);
import { durableToolIds, type DurableToolId } from './fieldEquipmentData';
export const isAdventureCarryItem = (id: string) => isAdventureSupply(id) || isAdventureTreasure(id) || ['map_handbook', 'creek_herb_seed', 'creek_herb', 'community_wood', 'community_stone', 'carrot_seed', 'rice', 'valley_mushroom', 'bamboo_shoot', 'lotus_seed'].includes(id);
// Keep room for returned adventure gear, which cannot be consumed to clear a full warehouse.
export const getAdventureItemPurchaseCapacity = (pet: PetState, id: string) => {
  if (!['trail_mix', 'berry_bait', 'nutrient_compost'].includes(id) && !durableToolIds.includes(id as DurableToolId)) return Infinity;
  const trip = pet.adventure.active;
  const pending = pet.adventure.pending;
  const expedition = pet.community.expedition;
  const reserved = (trip?.bag[id] ?? 0) + (trip?.loot[id] ?? 0) + (id === 'trail_rope' && trip?.tool ? 1 : 0) + (pending?.items[id] ?? 0)
    + (pending?.salvage?.[id] ?? 0) + (id === 'trail_rope' && pending?.salvageTool ? 1 : 0)
    + (expedition.active?.bag[id] ?? 0) + (expedition.active?.ground[id] ?? 0) + (expedition.pending?.items[id] ?? 0) + (expedition.pending?.overflow[id] ?? 0)
    + (id === 'trail_rope' ? Number(Boolean(expedition.active?.tool)) + Number(Boolean(expedition.pending?.tool)) : 0);
  return Math.max(0, inventoryItemLimit - (pet.inventory[id] ?? 0) - reserved);
};
export const defaultAdventureState = (): AdventureState => ({ schemaVersion: 6, backpackLevel: 0, valleyCompleted: [], starterClaimed: false, starterMealsClaimed: false, tripsStarted: 0, completed: {}, lastCompletedDay: {}, discoveries: [], active: undefined, pending: undefined, journal: [] });
export const isAdventureMapUnlocked = (state: AdventureState) => (state.completed.tutorial ?? 0) > 0;
const dayKey = (raw: unknown) => typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
const route = (raw: unknown) => typeof raw === 'string' && ['irrigation', 'seeds', 'commission', ...facilityIds, ...valleyQuestIds].includes(raw) ? raw as CommunityRoute : undefined;
export const getAdventureLastCompletedDay = (state: AdventureState, region: AdventureDestinationId) => state.journal
  .filter(entry => entry.region === region && entry.complete && !entry.purpose)
  .reduce((latest, entry) => { const day = entry.completedDay ?? getDailyResetDateKey(entry.endedAt); return day > latest ? day : latest; }, state.lastCompletedDay?.[region] ?? '');
export const isAdventureEntranceCompleteForDay = (state: AdventureState, region: AdventureDestinationId, _today = getDailyResetDateKey(Date.now())) => region === 'valley'
  ? false : (state.completed[region] ?? 0) > 0;

const inventory = (raw: unknown, bag = false, capacity: number = adventureBagCapacity): Inventory => {
  const result: Inventory = {};
  let remaining = bag ? capacity : Number.MAX_SAFE_INTEGER;
  for (const [id, amount] of Object.entries(object(raw))) {
    if (bag ? !isAdventureCarryItem(id) : !isBuiltinItemId(id)) continue;
    const quantity = Math.min(remaining, count(amount, inventoryItemLimit));
    if (quantity) { result[id] = quantity; remaining -= quantity; }
  }
  return result;
};
const normalizeTrip = (raw: unknown, legacy: boolean, capacity: number): AdventureTrip | undefined => {
  const value = object(raw);
  if (!text(value.id) || (value.region !== 'valley' && value.region !== 'tutorial') || !text(value.actorId)) return undefined;
  const tutorial = value.region === 'tutorial';
  const purpose = !legacy && !tutorial && [5, 6, 7, 8].includes(Number(value.rulesVersion)) ? route(value.purpose) : undefined;
  const rulesVersion = legacy && !tutorial ? 1 : value.rulesVersion === 8 ? 8 : value.rulesVersion === 7 ? 7 : value.rulesVersion === 6 ? 6 : value.rulesVersion === 5 ? 5 : tutorial ? 4 : value.rulesVersion === 1 ? 1 : value.rulesVersion === 4 ? 4 : value.rulesVersion === 3 ? 3 : 2;
  const options = getAdventureSteps(rulesVersion, value.region, purpose);
  const choices: string[] = [];
  for (const choice of Array.isArray(value.choices) ? value.choices.slice(0, options.length) : []) {
    if (!options[choices.length]?.choices.some(option => option.id === choice)) break;
    choices.push(String(choice));
  }
  const bag = inventory(value.bag, true, capacity);
  const loot = inventory(value.loot);
  if (legacy && !tutorial) {
    const found = choices.includes('bank') ? { id: 'apple', amount: 2 } : choices.includes('slope') ? { id: 'orange', amount: 1 } : undefined;
    if (found) {
      const fitting = Math.max(0, Math.min(found.amount, capacity - getAdventureBagCount(bag)));
      if (fitting) bag[found.id] = (bag[found.id] ?? 0) + fitting;
      if (fitting < found.amount) loot[found.id] = (loot[found.id] ?? 0) + found.amount - fitting;
    }
  }
  const initialStock = tutorial ? {} : createAdventureShopStock(rulesVersion);
  const savedStock = object(value.shopStock);
  const shopStock = Object.fromEntries(Object.entries(initialStock).map(([id, amount]): [string, number] => [id, legacy ? value.bought === true ? 0 : amount : count(savedStock[id], amount)]).filter(([, amount]) => amount > 0));
  return { id: text(value.id), region: value.region, actorId: text(value.actorId), actorName: text(value.actorName, 32), startedAt: count(value.startedAt), choices,
    rulesVersion, purpose, revision: count(value.revision), bag, loot, tool: value.tool === true,
    energySpent: count(value.energySpent, 10000), healthLost: typeof value.healthLost === 'number' && Number.isFinite(value.healthLost) ? Math.max(0, Math.min(10000, value.healthLost)) : 0, paidActions: value.paidActions === undefined && rulesVersion < 8 ? choices.length : count(value.paidActions, choices.length), rested: value.rested === true,
    neighborId: !tutorial && adventureActorIds.some(id => id === value.neighborId && id !== value.actorId) ? String(value.neighborId) : undefined,
    shopStock, purchases: legacy ? value.bought === true ? 1 : 0 : count(value.purchases),
    transportedCount: legacy ? value.transported === true ? 1 : 0 : count(value.transportedCount, rulesVersion === 1 ? 1 : adventureTransportLimit),
    ...(!tutorial && !purpose && rulesVersion >= 4 ? { treasure: isAdventureTreasure(String(value.treasure)) ? value.treasure as AdventureTrip['treasure'] : getAdventureTripTreasure(text(value.id)) } : {}),
    ...(choices.length === options.length && dayKey(value.completedDay) ? { completedDay: dayKey(value.completedDay) } : {}) };
};
const normalizeResult = (raw: unknown): AdventureResult | undefined => {
  const value = object(raw);
  if (!text(value.id) || (value.region !== 'valley' && value.region !== 'tutorial')) return undefined;
  const purpose = route(value.purpose);
  const steps = count(value.steps, getAdventureStepCount(value.region, purpose));
  const complete = value.complete === true && steps === getAdventureStepCount(value.region, purpose);
  return { id: text(value.id), region: value.region, actorId: text(value.actorId), actorName: text(value.actorName, 32), endedAt: count(value.endedAt), steps, complete,
    purpose, first: complete && value.first === true, hearts: purpose && !isValleyQuest(purpose) ? 0 : count(value.hearts, 10000), coins: purpose && !isValleyQuest(purpose) ? 0 : count(value.coins, 10000), items: inventory(value.items), rewardsClaimed: value.rewardsClaimed === true,
    ...(value.returnReason === 'health' ? { returnReason: 'health' as const, ...(value.salvage && value.rewardsClaimed !== true ? { salvage: inventory(value.salvage), salvageTool: value.salvageTool === true } : {}) } : {}),
    ...(complete ? { completedDay: dayKey(value.completedDay) ?? getDailyResetDateKey(count(value.endedAt)) } : {}) };
};
export const normalizeAdventureState = (raw: unknown): AdventureState => {
  const value = object(raw);
  const completed = object(value.completed);
  const pending = normalizeResult(value.pending);
  const journal = (Array.isArray(value.journal) ? value.journal : []).slice(0, 8).map(normalizeResult).filter((entry): entry is AdventureResult => Boolean(entry));
  const lastCompletedDay = Object.fromEntries(adventureDestinationIds.flatMap(region => {
    const days = [dayKey(object(value.lastCompletedDay)[region]), ...journal.filter(entry => entry.region === region && entry.complete && !entry.purpose).map(entry => entry.completedDay)];
    const latest = days.reduce<string>((previous, day) => day && day > previous ? day : previous, '');
    return latest ? [[region, latest]] : [];
  }));
  return {
    schemaVersion: 6, backpackLevel: normalizeBackpackLevel(value.backpackLevel), valleyCompleted: Array.isArray(value.valleyCompleted) ? [...new Set(value.valleyCompleted.filter(isValleyQuest))] : [], starterClaimed: value.starterClaimed === true, starterMealsClaimed: value.starterMealsClaimed === true, tripsStarted: count(value.tripsStarted),
    completed: Object.fromEntries(adventureDestinationIds.filter(id => count(completed[id]) > 0).map(id => [id, count(completed[id])])),
    discoveries: Array.isArray(value.discoveries) ? [...new Set(value.discoveries.filter((id): id is string => typeof id === 'string' && /^(valley:[0-5]|tutorial:[0-3])$/.test(id)))].slice(0, adventureStepCount + adventureTutorialStepCount) : [],
    lastCompletedDay,
    active: pending ? undefined : normalizeTrip(value.active, ![2, 3, 4, 5, 6].includes(Number(value.schemaVersion)), explorationBackpackCapacities[normalizeBackpackLevel(value.backpackLevel)]), pending,
    journal,
  };
};
