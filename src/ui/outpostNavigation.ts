import type { AdventureRegionId } from '../core/adventureTypes';
import type { RegionId } from '../core/expeditionTypes';
import type { PetState } from '../core/petTypes';
import type { ValleyGatherTarget } from '../core/valleyExplorationData';

export type OutpostRequest =
  | { view: 'idle' | 'route' | 'camp'; region: RegionId; target?: ValleyGatherTarget }
  | { view: 'journal' };

export const expeditionRegionForMap: Record<AdventureRegionId, RegionId> = {
  valley: 'valley', windmill: 'hills', forest: 'forest', coast: 'coast', observatory: 'station',
};
export const mapRegionForExpedition: Record<RegionId, AdventureRegionId> = {
  valley: 'valley', hills: 'windmill', forest: 'forest', coast: 'coast', station: 'observatory',
};

export const currentExpeditionRequest = (pet: PetState): OutpostRequest | undefined => {
  const { active, pending } = pet.community.expedition;
  if (pending) return { view: pending.mode === 'idle' ? 'idle' : 'route', region: pending.route[0] };
  if (active) return { view: active.mode === 'idle' ? 'idle' : 'route', region: active.route[active.leg], target: active.target };
};

export const initialOutpostRequest = (pet: PetState, requested?: OutpostRequest) =>
  requested ?? (!pet.adventure.active && !pet.adventure.pending ? currentExpeditionRequest(pet) : undefined);
