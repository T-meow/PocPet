import { isHubGameId, type HubGameId } from '../minigames/catalog';
import type { MiniGamesSave } from '../minigames/types';

export type CookingMethod = 'mix' | 'pan' | 'blender' | 'oven';
export type RecipeId = 'plain_rice' | 'biscuit_layer_cake' | 'fruit_salad' | 'banana_shake' | 'watermelon_juice' | 'biscuit_cup' | 'egg_rice' | 'carrot_rice' | 'fruit_pancake' | 'milk_cookies' | 'carrot_omelet' | 'rice_pancake' | 'fruit_pudding' | 'apple_pie' | 'tomato_egg_bowl' | 'pork_rice_bowl'
  | 'dumplings_pork_cabbage' | 'dumplings_vegetable' | 'zongzi_braised_pork' | 'zongzi_red_bean' | 'mooncake_mixed_nuts' | 'mooncake_red_bean' | 'herb_porridge'
  | 'creek_fish_soup' | 'river_grill' | 'milk_custard' | 'carp_rice' | 'mushroom_rice' | 'honey_drink' | 'berry_milk' | 'kelp_rice' | NewRecipeId | GenericRecipeId;
export type NewRecipeId = 'mashed_potato' | 'corn_chowder' | 'pumpkin_rice' | 'pepper_pork_bowl' | 'bamboo_mushroom_soup' | 'lotus_pork_soup' | 'chestnut_rice' | 'cream_matsutake' | 'cheese_vegetables' | 'wood_ear_dumplings'
  | 'crispy_wheat_fish' | 'tomato_crucian' | 'lemon_trout' | 'pumpkin_perch_soup' | 'bamboo_grouper' | 'pepper_redtail' | 'herb_catfish' | 'corn_bream_soup' | 'honey_eel_rice' | 'sardine_rice_ball' | 'salt_mackerel' | 'lemon_bream_rice'
  | 'strawberry_cheese_cup' | 'berry_jam_biscuit' | 'honey_pumpkin_pie' | 'chestnut_milk_cake' | 'mint_lemon_drink' | 'lotus_milk_soup' | 'pine_honey_biscuit' | 'mountain_herb_tea' | 'seafood_rice' | 'valley_travel_bento'
  | 'highland_potato_stew' | 'snow_bean_rice' | 'rock_honey_milk' | 'highland_potato_gratin' | 'snow_bean_soup' | 'summit_travel_bento'
  | 'lotus_wood_ear' | 'lotus_pumpkin_porridge' | 'mint_watermelon_cup' | 'orange_nut_shake' | 'berry_jam_shake' | 'double_berry_cup'
  | 'lotus_trotter_soup' | 'matsutake_clear_soup' | 'rock_honey_milk_tea' | 'sunflower_nut_crisp'
  | 'ginger_carp' | 'wheat_fish_custard' | 'pan_seared_perch' | 'grouper_porridge' | 'redtail_rice' | 'catfish_rice'
  | 'ginger_bream' | 'eel_mushroom_soup' | 'tomato_sardine' | 'mackerel_rice' | 'steamed_bluefin' | 'clam_kelp_soup' | 'shrimp_eggs';
export type GenericRecipeId = 'mixed_juice' | 'fish_soup' | 'grilled_fish';
export type MilkChoice = 'farm_milk' | 'ad_milk';
export type DishId = `dish_${Exclude<RecipeId, GenericRecipeId>}` | `dish_${GenericRecipeId}__${string}` | 'dish_fruit_pancake_banana' | 'dish_fruit_pudding_banana';
export type KitchenMaterialId = 'rice' | 'egg' | 'flour' | 'carrot' | 'tomato' | 'greens'
  | 'pork' | 'cabbage' | 'shiitake' | 'glutinous_rice' | 'braised_pork' | 'red_bean_paste' | 'mixed_nuts';
export interface KitchenState {
  schemaVersion: 1;
  starterClaimed: boolean;
  equipment: CookingMethod[];
  made: Partial<Record<RecipeId, number>>;
  firstMadeAt: Partial<Record<RecipeId, number>>;
  tasted: Record<string, Partial<Record<DishId, number>>>;
  recentOperationIds: string[];
  plating: 'plain' | 'flower' | 'stars';
  lastCraft?: { id: string; dishId: DishId; quantity: number; hearts: number; baseHearts?: number; skillHearts?: number; skillLevel?: number; skillXp?: number; at: number; milk?: MilkChoice };
}
export type LegacyMiniGameId = 'matching' | 'catch' | 'bubbles';
export type MiniGameId = LegacyMiniGameId | HubGameId;
export type PlayMode = 'normal' | 'gentle';
export interface PlayRecord { completed: number; best: number; bestMs: number; }
export interface PlayBubble { id: number; size: number; shape: 'round' | 'heart' | 'star'; popped: boolean; }
interface MiniGameSessionBase {
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
}
export interface HostedMiniGameSession extends MiniGameSessionBase { game: HubGameId; }
export interface LegacyMiniGameSession extends MiniGameSessionBase {
  game: LegacyMiniGameId;
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
export type MiniGameSession = LegacyMiniGameSession | HostedMiniGameSession;
export const isHostedMiniGameSession = (session: MiniGameSession): session is HostedMiniGameSession => isHubGameId(session.game);
export interface MiniGameResult {
  id: string;
  game: MiniGameId;
  actorId: string;
  mode: PlayMode;
  hearts: number;
  baseHearts?: number;
  rewardLevel?: number;
  mood?: number;
  skillXp?: number;
  score: number;
  elapsedMs: number;
  at: number;
  pending: boolean;
}
export interface MiniGameState {
  schemaVersion: 1;
  lastSettledSessionId: string;
  unlocked: MiniGameId[];
  records: Record<string, PlayRecord>;
  active?: MiniGameSession;
  hub?: MiniGamesSave;
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
