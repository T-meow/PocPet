import { museumQuestIds, museumQuests } from './museumData';
import type { Inventory, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';

// Call only inside an already guarded domain transaction, never on inventory transfers or readback.
export const recordMuseumEvent = (pet: PetState, key: string, quantity: number, at: number): PetState => {
  if (!pet.museum || pet.timePause || !Number.isFinite(quantity) || quantity <= 0) return pet;
  let quests = pet.museum.quests;
  for (const id of museumQuestIds) {
    const state = quests[id], def = museumQuests[id], objective = def.objectives.find(g => g.key === key);
    if (!state || state.completedAt || !objective || at < state.acceptedAt || (state.progress[key] ?? 0) >= objective.amount) continue;
    // Cooking and the final record follow the preparation objectives in the same commission.
    const index = def.objectives.indexOf(objective);
    if ((key.startsWith('cook:') || key.startsWith('visit:')) && def.objectives.slice(0, index).some(g => !g.key.startsWith('cook:') && !g.key.startsWith('visit:') && (state.progress[g.key] ?? 0) < g.amount)) continue;
    const progress = { ...state.progress, [key]: Math.min(objective.amount, (state.progress[key] ?? 0) + Math.floor(quantity)) };
    quests = { ...quests, [id]: { ...state, progress, ...(def.objectives.every(g => (progress[g.key] ?? 0) >= g.amount) ? { completedAt: at } : {}) } };
  }
  return quests === pet.museum.quests ? pet : { ...pet, museum: { ...pet.museum, quests } };
};
export const recordMuseumGather = (pet: PetState, region: RegionId, items: Inventory, at: number) => Object.entries(items).reduce((next, [id, quantity]) => recordMuseumEvent(next, `gather:${region}:${id}`, quantity, at), pet);
