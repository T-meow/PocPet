import { getDecorationIdleTimeReduction, getDecorationLevel } from './decorationEffects';
import type { ExpeditionTrip } from './expeditionTypes';
import type { PetState } from './petTypes';

export const idleExplorationBaseIntervalMs = 30 * 60 * 1000;
export const idleExplorationMinIntervalMs = 15 * 60 * 1000;

export const getIdleExplorationTiming = (pet: PetState, hours: number) => {
  const skillReduction = Math.max(0, Math.min(9, pet.partnerSchedule.skills.exercise.level - 1)) * 2;
  const decorationReduction = getDecorationIdleTimeReduction(getDecorationLevel(pet, 'star_dome'));
  const intervalMs = Math.max(idleExplorationMinIntervalMs, Math.round(idleExplorationBaseIntervalMs * (1 - skillReduction / 100) * (1 - decorationReduction / 100)));
  return { intervalMs, checks: Math.floor(hours * 3600000 / intervalMs), skillReduction, decorationReduction };
};

// A trip keeps its departure timing across upgrades, offline settlement and reloads.
export const getExpeditionCheckIntervalMs = (trip: Pick<ExpeditionTrip, 'rulesVersion' | 'checkIntervalMs'>) =>
  trip.rulesVersion >= 7 ? trip.checkIntervalMs ?? idleExplorationBaseIntervalMs : 3600000;
export const getExpeditionCheckCount = (trip: Pick<ExpeditionTrip, 'rulesVersion' | 'checkIntervalMs' | 'parts'>) =>
  Math.floor(trip.parts * 3600000 / getExpeditionCheckIntervalMs(trip));
export const formatExpeditionInterval = (intervalMs: number) => {
  const seconds = Math.ceil(intervalMs / 1000), remainder = seconds % 60;
  return `${Math.floor(seconds / 60)} 分钟${remainder ? ` ${remainder} 秒` : ''}`;
};
