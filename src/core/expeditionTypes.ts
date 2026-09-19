import type { Inventory } from './petTypes';

export type RegionId = 'valley' | 'hills' | 'forest' | 'coast' | 'station';
export type ExpeditionItemId = 'valley_mushroom' | 'hill_honey' | 'forest_berry' | 'forest_berry_seed' | 'pine_resin' | 'coast_kelp' | 'sea_glass' | 'observatory_part';
export type ProjectId = 'riverside' | 'exhibition' | 'observatory';
export interface RegionProgress {
  surveyed: boolean; base: number; harvestDay: string; harvestUsed: number;
  storyAt?: number; actorId?: string; actorName?: string;
}
export interface ExpeditionTrip {
  rulesVersion: 1; id: string; revision: number; mode: 'manual' | 'idle';
  actorId: string; actorName: string; route: RegionId[]; leg: number; step: number;
  bag: Inventory; ground: Inventory; tool: boolean; rested: RegionId[]; paused: boolean;
  startedAt: number; endsAt: number; settledParts: number; parts: number;
  coins: number; hearts: number; journal: string[];
}
export interface ExpeditionReceipt {
  id: string; mode: 'manual' | 'idle'; route: RegionId[]; items: Inventory; overflow: Inventory; tool: boolean;
  selected: boolean; coins: number; hearts: number; at: number; reason: 'complete' | 'return' | 'health'; journal: string[];
}
export interface CommunityProject {
  completed: number; stage: number; theme?: 'garden' | 'journey';
  lastDay: string; firstAt?: number; actorId?: string; actorName?: string;
}
export interface ExpeditionState {
  schemaVersion: 1; nextId: number;
  regions: Record<RegionId, RegionProgress>;
  projects: Record<ProjectId, CommunityProject>;
  collection: Partial<Record<ExpeditionItemId, number>>;
  active?: ExpeditionTrip; pending?: ExpeditionReceipt;
  lastReceipt?: Pick<ExpeditionReceipt, 'id' | 'reason' | 'at' | 'route' | 'journal'>;
}
