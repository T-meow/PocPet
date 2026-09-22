import type { RegionId } from './expeditionTypes';

export const explorationTravel = {
  valley: { hunger: 90, energy: 50, actions: 6, idleHunger: 18, idleEnergy: 14, meals: 3, nutrition: 100, payPercent: 100 },
  hills: { hunger: 180, energy: 100, actions: 6, idleHunger: 20, idleEnergy: 16, meals: 4, nutrition: 130, payPercent: 125 },
  forest: { hunger: 360, energy: 200, actions: 8, idleHunger: 22, idleEnergy: 18, meals: 5, nutrition: 160, payPercent: 150 },
  coast: { hunger: 600, energy: 320, actions: 10, idleHunger: 24, idleEnergy: 20, meals: 6, nutrition: 190, payPercent: 175 },
  station: { hunger: 900, energy: 480, actions: 12, idleHunger: 26, idleEnergy: 22, meals: 7, nutrition: 225, payPercent: 220 },
} as const;
export const splitTravelCost = (total: number, actions: number, step: number) => Math.floor(total / actions) + Number(step < total % actions);
export const getRegionActionCost = (region: RegionId, step: number) => {
  const p = explorationTravel[region];
  return { hunger: splitTravelCost(p.hunger, p.actions, step), energy: splitTravelCost(p.energy, p.actions, step) };
};
export const explorationBackpackCapacities = [24, 36, 48, 72] as const;
export const normalizeBackpackLevel = (level: unknown) => typeof level === 'number' && Number.isInteger(level) ? Math.max(0, Math.min(3, level)) : 0;
