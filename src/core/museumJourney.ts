import { museumQuests, museumVisits, type MuseumVisitId } from './museumData';
import { recordMuseumEvent } from './museumEvents';
import { getDish } from './kitchenRecipes';
import { getLandmarkReason, parseLandmarkId, expeditionRegionForMap } from './landmarkProgress';
import { applyExplorationCheck, previewExplorationAction } from './explorationCheckActions';
import type { ExplorationCheckAction } from './explorationChecks';
import { enforceAdventureHealth } from './adventureReturn';
import { advancePet } from './petLifecycle';
import { removeInventoryItem } from './items';
import type { Inventory, PetState } from './petTypes';

export const museumVisitStep = (pet: PetState, id: MuseumVisitId) => pet.museum.quests[museumVisits[id].quest]?.visits?.[id] ?? 0;
export const getMuseumVisitReason = (pet: PetState, id: MuseumVisitId) => {
  const visit = museumVisits[id], quest = pet.museum.quests[visit.quest], def = museumQuests[visit.quest];
  if (!quest) return '先到纪念馆接取这项委托。';
  if (quest.completedAt || (quest.progress[`visit:${id}`] ?? 0) >= 1) return '这段记录已经完成。';
  const missing = def.objectives.find(g => !g.key.startsWith('visit:') && (quest.progress[g.key] ?? 0) < g.amount);
  if (missing) return `先完成「${missing.label}」。`;
  const location = parseLandmarkId(visit.destination);
  return getLandmarkReason(pet.adventure, location.region, location.node);
};
export const museumCheckAction = (id: MuseumVisitId): ExplorationCheckAction => ({ id: 'record', title: museumVisits[id].title, hunger: 4, energy: 2, check: { mode: 'story', skill: 'study' } });
export const getMuseumStepPreview = (pet: PetState, id: MuseumVisitId) => previewExplorationAction(pet, pet.adventure.active ?? { id: 'museum', bag: {}, tool: false, rulesVersion: 12 }, museumCheckAction(id), `museum:${id}:${museumVisitStep(pet, id)}`, museumQuests[museumVisits[id].quest].region);
export const isMuseumMealDelivery = (delivery: Inventory, bag: Inventory) => {
  const entries = Object.entries(delivery).filter(([, n]) => n !== 0), categories = entries.map(([id]) => getDish(id)?.recipe.category);
  return entries.length === 3 && entries.every(([id, n]) => n === 1 && (bag[id] ?? 0) >= n) && ['main', 'soup', 'drink'].every(category => categories.includes(category as never));
};
export const advanceMuseumVisit = (pet: PetState, tripId: string, revision: number, expectedStep: number, delivery: Inventory = {}, now = Date.now()): PetState => {
  const before = pet.adventure.active;
  if (pet.timePause || !before?.museum || before.id !== tripId || before.revision !== revision || before.museum.step !== expectedStep) return pet;
  pet = advancePet(pet, now);
  const trip = pet.adventure.active, context = trip?.museum;
  if (!trip || trip.id !== tripId || !context || pet.isSleeping || pet.partnerSchedule.active) return pet;
  const id = context.visitId, visit = museumVisits[id], quest = pet.museum.quests[visit.quest];
  if (!quest || quest.acceptedAt !== context.acceptedAt || museumVisitStep(pet, id) !== expectedStep || getMuseumVisitReason(pet, id) || expectedStep >= visit.steps.length) return pet;
  const delivered = id === 'station_dinner' && expectedStep === visit.steps.length - 1;
  if (delivered ? !isMuseumMealDelivery(delivery, trip.bag) : Object.values(delivery).some(n => n !== 0)) return pet;
  const checked = applyExplorationCheck(pet, trip, museumCheckAction(id), `museum:${id}:${expectedStep}`, expeditionRegionForMap[parseLandmarkId(visit.destination).region]);
  if (!checked) return pet;
  const step = expectedStep + 1;
  let next: PetState = { ...checked.pet, lastInteractionAt: now, museum: { ...checked.pet.museum, quests: { ...checked.pet.museum.quests, [visit.quest]: { ...quest, visits: { ...quest.visits, [id]: step }, ...(delivered ? { delivery: { ...delivery } } : {}) } } },
    adventure: { ...checked.pet.adventure, active: { ...trip, museum: { ...context, step }, revision: revision + 1,
      bag: Object.entries(delivery).reduce((bag, [item, amount]) => amount ? removeInventoryItem(bag, item, amount) : bag, trip.bag), checkState: checked.state,
      energySpent: (trip.energySpent ?? 0) + checked.energySpent, healthLost: (trip.healthLost ?? 0) + checked.healthLost, paidActions: (trip.paidActions ?? 0) + 1 } },
    recentEvent: step === visit.steps.length ? '这段纪念已记下，可以收好行囊回家了。' : '记录已保存，继续和伙伴把这段故事写完。' };
  if (step === visit.steps.length) next = recordMuseumEvent(next, `visit:${id}`, 1, now);
  return enforceAdventureHealth(next, now);
};
