import hallBackground from '../assets/adventure/outpost-hall.webp';
import valleyEntrance from '../assets/adventure/valley.webp';
import type { AdventureNodeId } from '../core/adventureMap';
import type { AdventureRegionId } from '../core/adventureTypes';
import { valleySceneAssets } from '../valleySceneAssets';

interface AdventureRegionArt {
  nodes: Partial<Record<AdventureNodeId, string>>;
}
export const adventureHallScene = hallBackground;
export const adventureRegionArt: Record<AdventureRegionId, AdventureRegionArt> = {
  valley: { nodes: { entrance: valleyEntrance, ...valleySceneAssets } },
  windmill: { nodes: {} },
  forest: { nodes: {} },
  coast: { nodes: {} },
  observatory: { nodes: {} },
};
export const getAdventureNodeScene = (region: AdventureRegionId, node: AdventureNodeId) => adventureRegionArt[region].nodes[node];
