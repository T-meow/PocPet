import hallBackground from '../assets/adventure/outpost-hall.webp';
import { adventureLandmarkIcons } from '../adventureLandmarkAssets';
import type { AdventureNodeId } from '../core/adventureMap';
import type { AdventureRegionId } from '../core/adventureTypes';
export const adventureHallScene = hallBackground;
export const getAdventureNodeScene = (region: AdventureRegionId, node: AdventureNodeId) => adventureLandmarkIcons[region][node];
