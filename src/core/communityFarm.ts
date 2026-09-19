import { animals } from './communityData';
import type { AnimalId } from './communityTypes';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';

export const advanceCommunityAnimals = (pet: PetState, now: number): PetState => {
  let states = pet.community.animals;
  for (const id of ['coop', 'barn'] as const) {
    const old = states[id];
    if (!pet.community.facilities[id].built || old.nextAt === undefined || old.nextAt > now || old.feed <= 0 || old.stock >= 6) continue;
    const cycles = Math.min(old.feed, Math.floor((6 - old.stock) / 2), 1 + Math.floor((now - old.nextAt) / old.cycleMs));
    if (!cycles) continue;
    const feed = old.feed - cycles, stock = old.stock + 2 * cycles;
    states = { ...states, [id]: { ...old, feed, stock, nextAt: feed > 0 && stock < 6 ? old.nextAt + cycles * old.cycleMs : undefined, cared: false, revision: old.revision + cycles } };
  }
  return states === pet.community.animals ? pet : { ...pet, community: { ...pet.community, animals: states } };
};
export const feedCommunityAnimal = (pet: PetState, id: AnimalId, expectedRevision: number, quantity = 1, now = Date.now()): PetState => {
  pet = advanceCommunityAnimals(pet, now);
  const state = pet.community.animals[id];
  if (!state || !pet.community.facilities[id].built || !canSpendCompanionTime(pet) || state.revision !== expectedRevision || !Number.isInteger(quantity) || quantity < 1 || quantity > 3 - state.feed || (pet.inventory.animal_feed ?? 0) < quantity) return pet;
  const cycleMs = state.nextAt === undefined ? animals[id].hours * 3600000 * (pet.partnerSchedule.skills.garden.level >= 10 ? .92 : 1) : state.cycleMs;
  return { ...pet, inventory: removeInventoryItem(pet.inventory, 'animal_feed', quantity), community: { ...pet.community, animals: { ...pet.community.animals,
    [id]: { ...state, feed: state.feed + quantity, cycleMs, revision: state.revision + 1, nextAt: state.nextAt ?? (state.stock < 6 ? Math.max(now, pet.lastUpdatedAt) + cycleMs : undefined) } } }, recentEvent: `放入饲料 ×${quantity}。只消耗已投入的饲料，缺料或存满 6 份产物时暂停。` };
};
export const collectCommunityAnimal = (pet: PetState, id: AnimalId, expectedRevision: number, now = Date.now()): PetState => {
  pet = advanceCommunityAnimals(pet, now);
  const state = pet.community.animals[id], item = animals[id]?.item;
  if (!state || !item || !canSpendCompanionTime(pet) || !state.stock || state.revision !== expectedRevision) return pet;
  if ((pet.inventory[item] ?? 0) + state.stock > inventoryItemLimit) return { ...pet, recentEvent: '仓库放不下整批产物，它们会留在设施里。' };
  return { ...pet, inventory: addInventoryItem(pet.inventory, item, state.stock), community: { ...pet.community, animals: { ...pet.community.animals,
    [id]: { ...state, stock: 0, revision: state.revision + 1, nextAt: state.nextAt ?? (state.feed ? Math.max(now, pet.lastUpdatedAt) + state.cycleMs : undefined) } } }, recentEvent: `收好${animals[id].name} ×${state.stock}。有余粮时继续下一轮生产。` };
};
export const careCommunityAnimal = (pet: PetState, id: AnimalId, expectedRevision: number, now = Date.now()): PetState => {
  pet = advanceCommunityAnimals(pet, now);
  const state = pet.community.animals[id];
  if (!state || !canSpendCompanionTime(pet) || state.revision !== expectedRevision || state.nextAt === undefined || state.cared || pet.energy < 2) return pet;
  const nextAt = Math.max(now + 60000, state.nextAt - state.cycleMs * .1);
  if (nextAt >= state.nextAt) return pet;
  return { ...pet, energy: pet.energy - 2, lastInteractionAt: now, community: { ...pet.community, animals: { ...pet.community.animals, [id]: { ...state, nextAt, cared: true, revision: state.revision + 1 } } }, recentEvent: '添水、梳理垫草，体力 −2，本轮提前 10% 周期；每轮可照料一次。' };
};
