import type { Inventory } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { getLandmarkSteps, landmarkTargetName } from './landmarkData';
import { landmarkId, mapRegionForExpedition } from './landmarkProgress';
import { communityCrops, getExplorationFoodYield } from './foodCatalog';

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
