import type { CropId, ProductionItemId, WildIngredientId } from './foodCatalog';
import type { DurableToolId, FieldEquipmentId } from './fieldEquipmentData';
import type { RegionalTreasureId, CommunityDecorationId } from './regionalTreasures';
export type FishId = 'pond_crucian' | 'pond_carp' | 'golden_koi' | 'stream_trout' | 'river_perch' | 'silver_grayling'
  | 'wheat_fish' | 'stream_grouper' | 'redtail_barbel' | 'striped_catfish' | 'moss_bream' | 'glass_eel' | 'moon_carp'
  | 'silver_sardine' | 'blue_mackerel' | 'bluefin_bream' | 'sunset_butterflyfish' | 'star_ray';
export type CommunityItemId = 'field_dressing' | 'comfort_charm' | 'carrot_seed' | 'creek_herb_seed' | 'creek_herb' | 'community_wood' | 'community_stone'
  | 'animal_feed' | 'farm_milk' | 'fishing_bait' | 'river_bait' | 'fishing_rod' | 'reinforced_rod' | FishId | ExpeditionItemId | ProductionItemId | FieldEquipmentId;
export type FacilityId = 'coop' | 'barn' | 'fishing_hut' | 'upstream' | 'stall';
export type CommunityRoute = 'irrigation' | 'seeds' | 'commission' | FacilityId | import('./valleyQuests').ValleyQuestId | import('./landmarkProgress').LandmarkId;
export type AnimalId = 'coop' | 'barn';
export type WaterId = 'pond' | 'upstream' | 'forest_pool' | 'coast_pier';
export type CommissionTemplate = 'search' | 'forage' | 'vegetables' | 'eggs' | 'milk' | 'fish_pond' | 'fish_upstream' | 'fish_forest_pool' | 'fish_coast_pier' | 'soup' | 'fresh_porridge' | 'delivery' | 'forest_delicacy' | 'tea_order' | 'valley_basket' | 'valley_rice' | `${import('./expeditionTypes').RegionId}_${'survey' | 'supplies' | 'search' | 'delivery'}`;
export interface CommunityTask { id: string; template: CommissionTemplate; acceptedAt: number; found: boolean; rewardCoins?: number; region?: import('./expeditionTypes').RegionId; node?: import('./landmarkProgress').LandmarkNode }
export interface AnimalProduction { feed: number; stock: number; nextAt?: number; cycleMs: number; cared: boolean; revision: number }
export interface CommunityCrop { id: CropId; plantedAt: number; readyAt: number; watered?: boolean; fertilized?: boolean }
export interface CommunityPlot { id: number; crop?: CommunityCrop }
export interface ManualFishingSession {
  mode: 'manual'; id: string; water: WaterId; fish: FishId; size: number; phase: 'waiting' | 'reeling';
  biteAt: number; lastActionAt: number; clicks: number; requiredClicks: number; revision: number;
  strongRod: boolean; landingNet?: boolean; hutLevel: number;
}
export interface FishingCatch { fish: FishId; size: number; newRecord: boolean; newCrown: boolean }
export interface IdleFishingSession {
  mode: 'idle'; id: string; water: WaterId; revision: number; actorId: string; actorName: string;
  bait: 'fishing_bait' | 'river_bait'; strongRod: boolean; hutLevel: number;
  startedAt: number; endsAt: number; settledCasts: number; plannedCasts: number; reservedBait: number;
  rationPlan: { food: import('./petTypes').Inventory; purchased: number; coins: number };
  catches: FishingCatch[];
}
export type FishingSession = ManualFishingSession | IdleFishingSession;
export interface FishingReceipt {
  id: string; mode: 'manual' | 'idle'; catches: FishingCatch[]; items: import('./petTypes').Inventory;
  water: WaterId; at: number; reason: 'complete' | 'return' | 'health' | 'supplies';
  rationReturn?: import('./explorationRations').RationReturn;
}
export interface FishingJournalEntry { count: number; firstAt: number; largest: number; goldCrown?: boolean }
export interface MarketListing { id: number; slotIndex: number; itemId: string; quantity: number; unitPrice: number; basePrice: number; bonus: number; collector: boolean }
export type MarketCustomer = 'ordinary' | 'foodie' | 'collector' | 'generous';
export interface MarketReceipt {
  visit: number; customer: MarketCustomer | 'legacy'; buyout: boolean; at: number; coins: number;
  items: { itemId: string; quantity: number; coins: number }[];
}
export interface CommunityMarket {
  pricingVersion: number;
  level: number; open: boolean; lastVisitAt: number; visitors: number; nextListingId: number;
  seed: number; nextVisitAt?: number; remainingVisitMs?: number;
  listings: MarketListing[]; reserve: Record<string, number>; revenue: number; premium: number; sold: number;
  log: MarketReceipt[];
}
export interface CommunityActivityBoard {
  week: string; sequence: number; accepted: boolean;
  project?: import('./expeditionTypes').ProjectId;
  previousProject?: import('./expeditionTypes').ProjectId;
  invitationId?: string;
}
export interface CommunityState {
  schemaVersion: 13;
  activityBoard: CommunityActivityBoard;
  boardRegion?: import('./expeditionTypes').RegionId;
  expedition: ExpeditionState;
  irrigationFound: boolean;
  herbDiscovered: boolean;
  repairStep: number;
  gardenBuilt: boolean;
  firstOrderDelivered: boolean;
  seedForageDay: string;
  plots: CommunityPlot[];
  upgrades: Record<'garden' | 'coop' | 'barn' | 'fishing_hut', number>;
  toolWear: Partial<Record<DurableToolId, number>>;
  treasureResearch: Partial<Record<RegionalTreasureId, number>>;
  decorations: CommunityDecorationId[];
  decorationLevels: Partial<Record<CommunityDecorationId, number>>;
  discoveredCrops: CropId[];
  waterAccess: Record<'forest_pool' | 'coast_pier', { found: boolean; built: boolean }>;
  forageResearch: Partial<Record<WildIngredientId, number>>;
  processing: { revision: number };
  ranchDay: { day: string; cared: boolean; collected: boolean; claimed: boolean };
  boardDay: string;
  acceptedToday: string[];
  commission?: { id: string; acceptedAt: number; found: boolean; rewardCoins?: number };
  candidates: CommissionTemplate[];
  tasks: CommunityTask[];
  commissionsCompleted: number;
  specialtyOrders: import('./communitySpecialtyOrders').SpecialtyOrderState;
  facilities: Record<FacilityId, { found: boolean; work: number; built: boolean }>;
  animals: Record<AnimalId, AnimalProduction>;
  fishing: { casts: number; nextIdleId: number; active?: FishingSession; pending?: FishingReceipt; journal: Partial<Record<FishId, FishingJournalEntry>> };
  market: CommunityMarket;
}
import type { ExpeditionItemId, ExpeditionState } from './expeditionTypes';
