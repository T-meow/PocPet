import type { Inventory } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { getLandmarkSteps, landmarkTargetName } from './landmarkData';
import { landmarkId, mapRegionForExpedition } from './landmarkProgress';
import { communityCrops, getExplorationFoodYield } from './foodCatalog';
import { getExplorationRoll } from './explorationChecks';

export interface ExplorationResource {
  id: string; name: string; manual: Inventory; idle?: Inventory;
  research?: { kind: 'food' | 'treasure'; id: string; points: number };
}
// The authored manual reward table is also the source of truth for target selectors and idle yields.
export const getExplorationResources = (region: RegionId): ExplorationResource[] =>
  getLandmarkSteps(landmarkId(mapRegionForExpedition[region], 'gather'), 11)[2].choices
    .filter(choice => choice.id.startsWith('gather:')).map(choice => {
      const id = choice.id.slice(7);
      const manual = choice.finds ?? {};
      // Edible lotus_seed is food; only actual crop seeds are manual-only.
      const idle = choice.research || Object.values(communityCrops).some(crop => crop.seed === id) ? undefined
        : id === 'materials' ? { community_wood: 3, community_stone: 2 }
        : { [id]: getExplorationFoodYield(id, true) ?? 2 };
      return { id, name: landmarkTargetName(id), manual, ...(idle ? { idle } : {}), ...(choice.research ? { research: choice.research } : {}) };
    });
export const getIdleExplorationTargets = (region: RegionId) => getExplorationResources(region).filter(resource => resource.idle);
export const getIdleExplorationFinds = (region: RegionId, target?: string): Inventory => getIdleExplorationTargets(region).find(resource => resource.id === target)?.idle ?? {};

export const idleExplorationRandomTarget = 'random';
export const idleExplorationFocusWeight = 3;
export const getIdleExplorationDrops = (region: RegionId, target = idleExplorationRandomTarget) => {
  const entries = getIdleExplorationTargets(region).map(resource => ({ ...resource, weight: resource.id === target ? idleExplorationFocusWeight : 1 }));
  const total = entries.reduce((sum, resource) => sum + resource.weight, 0);
  return entries.map(resource => ({ ...resource, chance: resource.weight / total * 100 }));
};

// A saved seed survives clock rebasing on import and pause/resume. The completed
// check number keeps offline catch-up independent of previews and treasure rolls.
export const rollIdleExplorationFinds = (region: RegionId, target: string | undefined, seed: number, check: number): Inventory => {
  const drops = getIdleExplorationDrops(region, target);
  let roll = getExplorationRoll(seed, String(check), 'idle-materials') * drops.reduce((sum, resource) => sum + resource.weight, 0);
  for (const resource of drops) {
    roll -= resource.weight;
    if (roll < 0) return { ...resource.idle };
  }
  return {};
};
