import type { Inventory } from './petTypes';

export type RegionId = 'valley' | 'hills' | 'forest' | 'coast' | 'station';
export type ExpeditionItemId = 'valley_mushroom' | 'hill_honey' | 'forest_berry' | 'forest_berry_seed' | 'pine_resin' | 'coast_kelp' | 'sea_glass' | 'observatory_part' | import('./foodCatalog').WildIngredientId | import('./regionalTreasures').RegionalTreasureId;
export type ProjectId = 'riverside' | 'exhibition' | 'observatory';
export interface RegionProgress {
  surveyed: boolean; base: number; harvestDay: string; harvestUsed: number;
  storyAt?: number; actorId?: string; actorName?: string;
}
export interface ExpeditionTrip {
  rulesVersion: 1 | 2 | 3 | 4 | 5; id: string; revision: number; mode: 'manual' | 'idle';
  actorId: string; actorName: string; route: RegionId[]; leg: number; step: number;
  bag: Inventory; ground: Inventory; tool: boolean; rested: RegionId[]; paused: boolean;
  startedAt: number; endsAt: number; settledParts: number; parts: number;
  coins: number; hearts: number; journal: string[];
  target?: import('./valleyExplorationData').ValleyGatherTarget;
  harvestSpent?: number; energySpent?: number; healthLost?: number;
  reservedHarvests?: number; rationsRemaining?: number;
  paidActions?: number;
  rationSegments?: import('./explorationRations').RationSegment[];
  rationPlan?: import('./explorationRations').RationPlan;
  refundCoins?: number;
  checkState?: import('./explorationChecks').ExplorationCheckState;
  rewardsVersion?: 1;
  gatherBonus?: number;
  treasureFinds?: RegionalTreasureFind[];
  treasureChance?: number;
}
export interface ExpeditionReceipt {
  id: string; mode: 'manual' | 'idle'; route: RegionId[]; items: Inventory; overflow: Inventory; tool: boolean;
  selected: boolean; coins: number; hearts: number; at: number; reason: 'complete' | 'return' | 'health'; journal: string[];
  rulesVersion?: 1 | 2 | 3 | 4 | 5;
  refundCoins?: number;
  rationReturn?: import('./explorationRations').RationReturn;
  lastCheck?: import('./explorationChecks').ExplorationCheckResult;
  treasureFinds?: RegionalTreasureFind[];
  treasureChance?: number;
}
export interface RegionalTreasureFind { region: RegionId; item: import('./regionalTreasures').RegionalTreasureId; at: number; guaranteed: boolean }
export interface CommunityProject {
  completed: number; stage: number; theme?: 'garden' | 'journey';
  lastDay: string; firstAt?: number; actorId?: string; actorName?: string;
  invitationId?: string;
  reward?: import('./communityProjectData').CommunityProjectReward;
}
export interface ExpeditionState {
  schemaVersion: 5; nextId: number;
  treasurePity: Record<RegionId, number>;
  regions: Record<RegionId, RegionProgress>;
  projects: Record<ProjectId, CommunityProject>;
  collection: Partial<Record<ExpeditionItemId | import('./adventureTypes').AdventureTreasureId, number>>;
  loop?: import('./explorationBudget').ExplorationBudget;
  active?: ExpeditionTrip; pending?: ExpeditionReceipt;
  lastReceipt?: Pick<ExpeditionReceipt, 'id' | 'reason' | 'at' | 'route' | 'journal' | 'lastCheck' | 'rationReturn' | 'treasureFinds' | 'treasureChance'>;
}
