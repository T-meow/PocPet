import type { Inventory } from './petTypes';
import type { CommunityRoute } from './communityTypes';

export type AdventureRegionId = 'valley' | 'windmill' | 'forest' | 'coast' | 'observatory';
export type AdventureDestinationId = AdventureRegionId | 'tutorial';
export type AdventureTreasureId = 'coin_hoard' | 'valley_amber' | 'ancient_gold_bar';
export type AdventureItemId = 'trail_mix' | 'berry_bait' | 'trail_rope' | 'map_handbook' | AdventureTreasureId;
export type AdventureRulesVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface AdventureTrip {
  id: string;
  region: AdventureDestinationId;
  actorId: string;
  actorName: string;
  startedAt: number;
  rulesVersion: AdventureRulesVersion;
  revision: number;
  choices: string[];
  bag: Inventory;
  loot: Inventory;
  tool: boolean;
  neighborId?: string;
  shopStock: Inventory;
  purchases: number;
  transportedCount: number;
  treasure?: AdventureTreasureId;
  completedDay?: string;
  purpose?: CommunityRoute;
  energySpent?: number;
  healthLost?: number;
  paidActions?: number;
  rested?: boolean;
  checkState?: import('./explorationChecks').ExplorationCheckState;
  rewardsVersion?: 1;
  gatherBonus?: number;
  target?: string;
  nodeId?: import('./landmarkProgress').LandmarkNode;
  stageIds?: string[];
  firstCompletion?: boolean;
}

export interface AdventureResult {
  id: string;
  region: AdventureDestinationId;
  actorId: string;
  actorName: string;
  endedAt: number;
  steps: number;
  complete: boolean;
  first: boolean;
  hearts: number;
  coins: number;
  items: Inventory;
  rewardsClaimed: boolean;
  coinsRemaining?: number;
  completedDay?: string;
  purpose?: CommunityRoute;
  returnReason?: 'health';
  salvage?: Inventory;
  salvageTool?: boolean;
  lastCheck?: import('./explorationChecks').ExplorationCheckResult;
  rulesVersion?: AdventureRulesVersion;
}

export interface AdventureState {
  schemaVersion: 8;
  landmarks: import('./landmarkProgress').LandmarkId[];
  backpackLevel: number;
  valleyCompleted: import('./valleyQuests').ValleyQuestId[];
  starterClaimed: boolean;
  starterMealsClaimed: boolean;
  tripsStarted: number;
  completed: Partial<Record<AdventureDestinationId, number>>;
  lastCompletedDay: Partial<Record<AdventureDestinationId, string>>;
  discoveries: string[];
  active?: AdventureTrip;
  pending?: AdventureResult;
  journal: AdventureResult[];
}
