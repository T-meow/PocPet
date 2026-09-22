import type { FacilityId } from './core/communityTypes';
import field from './assets/facilities/community_field.webp';
import orchard from './assets/facilities/community_orchard.webp';
import coop from './assets/facilities/community_coop.webp';
import barn from './assets/facilities/community_barn.webp';
import fishingHut from './assets/facilities/community_fishing_hut.webp';
import upstream from './assets/facilities/community_upstream.webp';
import stall from './assets/facilities/community_stall.webp';
import board from './assets/facilities/community_board.webp';

export const communityFacilityIcons = {
  field, orchard, coop, barn, fishing_hut: fishingHut, upstream, stall, board,
} satisfies Record<FacilityId | 'field' | 'orchard' | 'board', string>;

export type CommunityFacilityArtId = keyof typeof communityFacilityIcons;
