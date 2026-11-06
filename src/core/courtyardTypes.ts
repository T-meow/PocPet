import type { Inventory, ItemId, NeighborIdentity } from './petTypes';

export type CourtyardAction = 'chat' | 'play' | 'share' | 'help';
export interface CourtyardNeighbor extends NeighborIdentity { favoriteFoodIds?: readonly ItemId[] }
export interface CourtyardContext { actorId: string; neighbors: readonly CourtyardNeighbor[] }
export interface NeighborRelationship { points: number }

export interface CourtyardReceipt {
  id: string;
  sequence: number;
  at: number;
  neighborId: string;
  neighborName: string;
  action: CourtyardAction;
  title: string;
  text: string;
  points: number;
  energy: number;
  mood: number;
  hearts: number;
  foodId?: ItemId;
  rewardId?: ItemId;
  premium?: boolean;
  pending?: boolean;
}

export interface CourtyardState {
  schemaVersion: 1;
  rotationId: string;
  rotationStartedAt: number;
  nextRefreshAt: number;
  visitorIds: string[];
  day: string;
  dailyInteractions: Record<string, number>;
  interactionsCount: number;
  pendingGifts: Inventory;
  // Runtime presentation and local history only; omitted by the save codec.
  lastInteraction?: CourtyardReceipt;
}

export interface CourtyardRequest {
  rotationId: string;
  day: string;
  neighborId: string;
  action: CourtyardAction;
  foodId?: ItemId;
}
