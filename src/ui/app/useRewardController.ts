import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  claimAvailableDateRewards,
  clampCoins,
  gardenCompensationCoins,
  gardenCompensationRewardId,
  recordEarnedCoins,
  type ClaimedDateReward,
  type PetState,
} from '../../core/pet';
import { playSfx } from '../../core/audio';
import { claimCommunityWorkGift, communityWorkGiftRewardId, communityWorkGiftTickets, isCommunityWorkGiftAvailable } from '../../core/communityWorkGift';
import { acknowledgementsGiftRewardId, claimAcknowledgementsGift } from '../../core/acknowledgementsGift';
import { t } from '../../i18n';

export type FloatingRewardConfig = { id: string; coins?: number; gachaTickets?: number; eventKey: string };
export type RewardPopupData = Pick<ClaimedDateReward, 'id' | 'title' | 'message' | 'coins' | 'hearts' | 'gachaTickets' | 'items'>;

const communityWorkFloatingReward: FloatingRewardConfig =
  { id: communityWorkGiftRewardId, gachaTickets: communityWorkGiftTickets, eventKey: 'ui.rewards.communityWorkGiftReceived' };

export const getAvailableFloatingReward = (pet: PetState) =>
  isCommunityWorkGiftAvailable(pet) ? communityWorkFloatingReward : undefined;

interface RewardControllerOptions {
  pet: PetState;
  setPet: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState) => PetState;
  hasLoadedModRef: MutableRefObject<boolean>;
  playAfterUnlock: (id: 'coin' | 'notification') => void;
}

export const useRewardController = ({ pet, setPet, commitPet, hasLoadedModRef, playAfterUnlock }: RewardControllerOptions) => {
  const [queue, setQueue] = useState<RewardPopupData[]>([]);

  const enqueueReward = (reward: RewardPopupData) => {
    setQueue((current) => current.some((queued) => queued.id === reward.id) ? current : [...current, reward]);
  };

  const claimDateRewards = () => {
    if (!hasLoadedModRef.current) return;
    setPet((current) => {
      const result = claimAvailableDateRewards(current);
      if (result.rewards.length > 0) {
        setQueue((currentQueue) => [
          ...currentQueue,
          ...result.rewards.filter((reward) => !currentQueue.some((queued) => queued.id === reward.id)),
        ]);
        playSfx('notification');
      }
      return commitPet(result.pet);
    });
  };

  const claimFloatingReward = (reward: FloatingRewardConfig) => {
    if (!hasLoadedModRef.current || reward.id !== communityWorkGiftRewardId) return;
    playAfterUnlock('coin');
    setPet((current) => {
      const result = claimCommunityWorkGift(current);
      if (result.claimed) enqueueReward({
        id: communityWorkGiftRewardId,
        title: t('ui.rewards.communityWorkGiftTitle'),
        message: t('ui.rewards.communityWorkGiftMessage', { count: communityWorkGiftTickets }),
        gachaTickets: communityWorkGiftTickets,
        items: [],
      });
      return commitPet(result.pet);
    });
  };

  const claimAcknowledgementsReward = () => {
    if (!hasLoadedModRef.current) return;
    playAfterUnlock('coin');
    setPet((current) => {
      const next = claimAcknowledgementsGift(current);
      return next === current ? current : commitPet(next);
    });
  };

  const claimGardenCompensation = () => {
    playAfterUnlock('coin');
    setPet((current) => {
      if (current.claimedRewardIds.includes(gardenCompensationRewardId)) return current;
      return recordEarnedCoins({
        ...current,
        coins: clampCoins(current.coins + gardenCompensationCoins),
        claimedRewardIds: [...current.claimedRewardIds, gardenCompensationRewardId],
        recentEvent: t('pet.reward.gardenCompensation', { coins: gardenCompensationCoins }),
      }, gardenCompensationCoins);
    });
  };

  return {
    activeReward: queue[0],
    closeActiveReward: () => setQueue((current) => current.slice(1)),
    enqueueReward,
    availableFloatingReward: getAvailableFloatingReward(pet),
    hasClaimedAcknowledgementsGift: pet.claimedRewardIds.includes(acknowledgementsGiftRewardId),
    hasClaimedGardenCompensation: pet.claimedRewardIds.includes(gardenCompensationRewardId),
    claimDateRewards,
    claimFloatingReward,
    claimAcknowledgementsGift: claimAcknowledgementsReward,
    claimGardenCompensation,
  };
};
