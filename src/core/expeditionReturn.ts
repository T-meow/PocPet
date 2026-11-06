import type { PetState } from './petTypes';

// Shared by camp construction and community projects.
export const withExpedition = (pet: PetState, changes: Partial<PetState['community']['expedition']>): PetState => ({
  ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, ...changes } },
});
