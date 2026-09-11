export type CookingMethod = 'mix' | 'pan' | 'blender' | 'oven';
export type RecipeId = 'plain_rice' | 'biscuit_layer_cake' | 'fruit_salad' | 'banana_shake' | 'watermelon_juice' | 'biscuit_cup' | 'egg_rice' | 'carrot_rice' | 'fruit_pancake' | 'milk_cookies' | 'carrot_omelet' | 'rice_pancake' | 'fruit_pudding' | 'apple_pie';
export type DishId = `dish_${RecipeId}` | 'dish_fruit_pancake_banana' | 'dish_fruit_pudding_banana';
export type KitchenMaterialId = 'rice' | 'egg' | 'flour' | 'carrot';
export interface KitchenState {
  schemaVersion: 1;
  starterClaimed: boolean;
  equipment: CookingMethod[];
  made: Partial<Record<RecipeId, number>>;
  firstMadeAt: Partial<Record<RecipeId, number>>;
  tasted: Record<string, Partial<Record<DishId, number>>>;
  recentOperationIds: string[];
  plating: 'plain' | 'flower' | 'stars';
  lastCraft?: { id: string; dishId: DishId; quantity: number; hearts: number; baseHearts?: number; skillHearts?: number; skillLevel?: number; at: number };
}
export type MiniGameId = 'matching' | 'catch' | 'bubbles';
export type PlayMode = 'normal' | 'gentle';
export interface PlayRecord { completed: number; best: number; bestMs: number; }
export interface PlayBubble { id: number; size: number; shape: 'round' | 'heart' | 'star'; popped: boolean; }
export interface MiniGameSession {
  id: string;
  game: MiniGameId;
  actorId: string;
  mode: PlayMode;
  paused: boolean;
  startedAt: number;
  lastTickAt: number;
  elapsedMs: number;
  rewardLevel: number;
  baseHearts: number;
  deck: number[];
  matched: number[];
  flipped: number[];
  moves: number;
  rounds: number;
  streak: number;
  bestStreak: number;
  throwAt: number;
  throwTargetX: number;
  throwPetX: number;
  throwResult?: 'caught' | 'missed';
  bubbles: PlayBubble[];
  blowingAt: number;
  participationMs: number;
}
export interface MiniGameResult {
  id: string;
  game: MiniGameId;
  actorId: string;
  mode: PlayMode;
  hearts: number;
  baseHearts?: number;
  rewardLevel?: number;
  mood?: number;
  score: number;
  elapsedMs: number;
  at: number;
  pending: boolean;
}
export interface MiniGameState {
  schemaVersion: 1;
  unlocked: MiniGameId[];
  records: Record<string, PlayRecord>;
  active?: MiniGameSession;
  lastResult?: MiniGameResult;
  style: 'garden' | 'fruit' | 'night';
}
export type MemoryKind = 'first_taste' | 'catch_record' | 'menu_page' | 'fruit_comparison' | 'practice_photo';
export interface CompanionMemory {
  id: string;
  actorId: string;
  kind: MemoryKind;
  subject: string;
  at: number;
  mentionedAt: number;
}
export interface CompanionMemoryState { schemaVersion: 1; entries: CompanionMemory[]; }
