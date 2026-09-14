import type { PetState } from './petTypes';
import { t } from '../i18n';

export const communityWorkGiftRewardId = 'community_work_gift_v1';
export const communityWorkGiftTickets = 10;

export const isCommunityWorkGiftAvailable = (pet: PetState) =>
  pet.saveMetadata.communityWorkGift === 'pending'
  && !pet.claimedRewardIds.includes(communityWorkGiftRewardId);

export const claimCommunityWorkGift = (pet: PetState): { pet: PetState; claimed: boolean } => {
  if (!isCommunityWorkGiftAvailable(pet)) return { pet, claimed: false };
  // Keep the entire gift claimable until all ten tickets fit.
  if (pet.goldenAppleGacha.tickets + communityWorkGiftTickets > 9999) {
    return { pet: { ...pet, recentEvent: t('ui.rewards.communityWorkGiftFull', { count: communityWorkGiftTickets }) }, claimed: false };
  }
  return {
    claimed: true,
    pet: {
      ...pet,
      saveMetadata: { ...pet.saveMetadata, communityWorkGift: 'claimed' },
      claimedRewardIds: [...pet.claimedRewardIds, communityWorkGiftRewardId],
      goldenAppleGacha: { ...pet.goldenAppleGacha, tickets: pet.goldenAppleGacha.tickets + communityWorkGiftTickets },
      recentEvent: t('ui.rewards.communityWorkGiftReceived', { count: communityWorkGiftTickets }),
    },
  };
};
