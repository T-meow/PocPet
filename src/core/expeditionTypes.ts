export type RegionId = 'valley' | 'hills' | 'forest' | 'coast' | 'station';
export type ExpeditionItemId = 'valley_mushroom' | 'hill_honey' | 'forest_berry' | 'forest_berry_seed' | 'pine_resin' | 'coast_kelp' | 'sea_glass' | 'observatory_part' | import('./foodCatalog').WildIngredientId | import('./regionalTreasures').RegionalTreasureId;
export type ProjectId = 'riverside' | 'exhibition' | 'observatory';
export interface RegionProgress {
  surveyed: boolean; base: number; harvestDay: string; harvestUsed: number;
  storyAt?: number; actorId?: string; actorName?: string;
}
export interface CommunityProject {
  completed: number; stage: number; theme?: import('./communityProjectData').ProjectTheme;
  lastTheme?: import('./communityProjectData').ProjectTheme;
  memories?: Partial<Record<import('./communityProjectData').ProjectTheme, import('./communityThemes').CommunityThemeMemory>>;
  lastDay: string; firstAt?: number; actorId?: string; actorName?: string;
  invitationId?: string;
  reward?: import('./communityProjectData').CommunityProjectReward;
}
export interface ExpeditionState {
  schemaVersion: 8; nextId: number;
  regions: Record<RegionId, RegionProgress>;
  projects: Record<ProjectId, CommunityProject>;
  collection: Partial<Record<ExpeditionItemId | import('./adventureTypes').AdventureTreasureId, number>>;
  loop?: import('./explorationBudget').ExplorationBudget;
}
