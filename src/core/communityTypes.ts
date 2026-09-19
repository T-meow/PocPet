export type FishId = 'pond_crucian' | 'pond_carp' | 'golden_koi' | 'stream_trout' | 'river_perch' | 'silver_grayling';
export type CommunityItemId = 'field_dressing' | 'comfort_charm' | 'carrot_seed' | 'creek_herb_seed' | 'creek_herb' | 'community_wood' | 'community_stone'
  | 'animal_feed' | 'farm_milk' | 'fishing_bait' | 'river_bait' | 'fishing_rod' | 'reinforced_rod' | FishId | ExpeditionItemId;
export type FacilityId = 'coop' | 'barn' | 'fishing_hut' | 'upstream' | 'stall';
export type CommunityRoute = 'irrigation' | 'seeds' | 'commission' | FacilityId | import('./valleyQuests').ValleyQuestId;
export type AnimalId = 'coop' | 'barn';
export type WaterId = 'pond' | 'upstream';
export type CommissionTemplate = 'search' | 'forage' | 'vegetables' | 'eggs' | 'milk' | 'fish_pond' | 'fish_upstream' | 'soup' | 'fresh_porridge' | 'delivery';
export interface CommunityTask { id: string; template: CommissionTemplate; acceptedAt: number; found: boolean }
export interface AnimalProduction { feed: number; stock: number; nextAt?: number; cycleMs: number; cared: boolean; revision: number }
export interface FishingSession {
  id: string; water: WaterId; fish: FishId; size: number; phase: 'waiting' | 'reeling';
  biteAt: number; expiresAt: number; lastActionAt: number; tension: number; progress: number; revision: number; strongRod: boolean;
}
export interface MarketListing { id: number; itemId: string; quantity: number; unitPrice: number; basePrice: number; bonus: number; collector: boolean }
export interface CommunityMarket {
  level: number; open: boolean; lastVisitAt: number; visitors: number; nextListingId: number;
  listings: MarketListing[]; reserve: Record<string, number>; revenue: number; premium: number; sold: number;
  log: { itemId: string; quantity: number; coins: number; at: number }[];
}
export interface CommunityState {
  schemaVersion: 3;
  expedition: ExpeditionState;
  irrigationFound: boolean;
  herbDiscovered: boolean;
  repairStep: number;
  gardenBuilt: boolean;
  firstOrderDelivered: boolean;
  seedForageDay: string;
  crop?: { id: 'herb' | 'carrot' | 'berry'; plantedAt: number; readyAt: number };
  boardDay: string;
  acceptedToday: string[];
  commission?: { id: string; acceptedAt: number; found: boolean };
  candidates: CommissionTemplate[];
  tasks: CommunityTask[];
  facilities: Record<FacilityId, { found: boolean; work: number; built: boolean }>;
  animals: Record<AnimalId, AnimalProduction>;
  fishing: { casts: number; active?: FishingSession; pending?: { id: string; fish: FishId; size: number }; journal: Partial<Record<FishId, { count: number; firstAt: number; largest: number }>> };
  market: CommunityMarket;
}
import type { ExpeditionItemId, ExpeditionState } from './expeditionTypes';
