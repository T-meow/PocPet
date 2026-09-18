import type { Inventory } from './petTypes';

export type AdventureRegionId = 'valley' | 'windmill' | 'forest' | 'coast' | 'observatory';
export type AdventureDestinationId = AdventureRegionId | 'tutorial';
export type AdventureTreasureId = 'coin_hoard' | 'valley_amber' | 'ancient_gold_bar';
export type AdventureItemId = 'trail_mix' | 'berry_bait' | 'trail_rope' | 'map_handbook' | AdventureTreasureId;
export type AdventureRulesVersion = 1 | 2 | 3 | 4;

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
  completedDay?: string;
}

export interface AdventureState {
  schemaVersion: 3;
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
