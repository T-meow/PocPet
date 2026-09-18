import { recordEarnedCoins } from './achievements';
import { clampCoins } from './petStats';
import type { PetState } from './petTypes';
import { t } from '../i18n';

// Separate from both retired help gifts so their recipients can claim this gift too.
export const acknowledgementsGiftRewardId = 'acknowledgements_gift_v1';
export const acknowledgementsGiftCoins = 1000;

export const claimAcknowledgementsGift = (pet: PetState): PetState => {
  if (pet.claimedRewardIds.includes(acknowledgementsGiftRewardId)) return pet;
  return recordEarnedCoins({
    ...pet,
    coins: clampCoins(pet.coins + acknowledgementsGiftCoins),
    claimedRewardIds: [...pet.claimedRewardIds, acknowledgementsGiftRewardId],
    recentEvent: t('pet.reward.acknowledgementsGift', { coins: acknowledgementsGiftCoins }),
  }, acknowledgementsGiftCoins);
};
