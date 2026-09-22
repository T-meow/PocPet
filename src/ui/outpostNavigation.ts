import type { AdventureRegionId } from '../core/adventureTypes';
import type { RegionId } from '../core/expeditionTypes';
import type { PetState } from '../core/petTypes';
import type { LandmarkNode } from '../core/landmarkProgress';

export type OutpostRequest =
  | { view: 'idle' | 'manual' | 'camp'; region: RegionId; target?: string; node?: LandmarkNode }
  | { view: 'journal' };

export { expeditionRegionForMap, mapRegionForExpedition } from '../core/landmarkProgress';

export const currentExpeditionRequest = (pet: PetState): OutpostRequest | undefined => {
  const { active, pending } = pet.community.expedition;
  if (pending) return { view: 'idle', region: pending.route[0] };
  if (active) return { view: 'idle', region: active.route[0], target: active.target };
};

export const initialOutpostRequest = (pet: PetState, requested?: OutpostRequest) =>
  requested ?? (!pet.adventure.active && !pet.adventure.pending ? currentExpeditionRequest(pet) : undefined);
