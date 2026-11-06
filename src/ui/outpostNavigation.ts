import type { RegionId } from '../core/expeditionTypes';
import type { PetState } from '../core/petTypes';
import type { LandmarkNode } from '../core/landmarkProgress';

export type OutpostRequest =
  | { view: 'manual' | 'camp'; region: RegionId; target?: string; node?: LandmarkNode; museumVisit?: import('../core/museumData').MuseumVisitId }
  | { view: 'journal' }
  | { view: 'commissions' }
  | { view: 'tasks'; kind?: import('../core/explorationCampaignData').CampaignKind };

export { expeditionRegionForMap, mapRegionForExpedition } from '../core/landmarkProgress';

export const currentExpeditionRequest = (pet: PetState): OutpostRequest | undefined => {
  if (pet.adventure.commissions.some(commission => commission.status === 'ready')) return { view: 'commissions' };
};

export const initialOutpostRequest = (pet: PetState, requested?: OutpostRequest) =>
  requested ?? (!pet.adventure.active && !pet.adventure.pending ? currentExpeditionRequest(pet) : undefined);
