import type { Inventory } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { getLandmarkSteps, landmarkTargetName } from './landmarkData';
import { landmarkId, mapRegionForExpedition } from './landmarkProgress';

export interface ExplorationResource {
  id: string; name: string; manual: Inventory;
  research?: { kind: 'food' | 'treasure'; id: string; points: number };
}
// The authored manual reward table is also the source of truth for target selectors and commissions.
export const getExplorationResources = (region: RegionId): ExplorationResource[] =>
  getLandmarkSteps(landmarkId(mapRegionForExpedition[region], 'gather'), 11)[2].choices
    .filter(choice => choice.id.startsWith('gather:')).map(choice => {
      const id = choice.id.slice(7);
      const manual = choice.finds ?? {};
      return { id, name: landmarkTargetName(id), manual, ...(choice.research ? { research: choice.research } : {}) };
    });
