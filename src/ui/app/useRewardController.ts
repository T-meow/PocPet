import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  claimAvailableDateRewards,
  clampCoins,
  gardenCompensationCoins,
  gardenCompensationRewardId,
  helpPageGiftCoins,
  helpPageGiftRewardId,
  helpStarterGiftCoins,
  helpStarterGiftRewardId,
  recordEarnedCoins,
  type ClaimedDateReward,
  type PetState,
} from '../../core/pet';
import { playSfx } from '../../core/audio';
import { claimCommunityWorkGift, communityWorkGiftRewardId, communityWorkGiftTickets, isCommunityWorkGiftAvailable } from '../../core/communityWorkGift';
import { t } from '../../i18n';

export type FloatingRewardConfig = { id: string; coins?: number; gachaTickets?: number; eventKey: string };
export type RewardPopupData = Pick<ClaimedDateReward, 'id' | 'title' | 'message' | 'coins' | 'hearts' | 'gachaTickets' | 'items'>;

const floatingRewardConfigs: readonly FloatingRewardConfig[] = [
  { id: communityWorkGiftRewardId, gachaTickets: communityWorkGiftTickets, eventKey: 'ui.rewards.communityWorkGiftReceived' },
  { id: helpStarterGiftRewardId, coins: helpStarterGiftCoins, eventKey: 'pet.reward.helpStarterGift' },
];

export const getAvailableFloatingReward = (pet: PetState) => floatingRewardConfigs.find((reward) =>
  reward.id === communityWorkGiftRewardId ? isCommunityWorkGiftAvailable(pet) : !pet.claimedRewardIds.includes(reward.id));

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
    if (!hasLoadedModRef.current) return;
    playAfterUnlock('coin');
    setPet((current) => {
      if (reward.id === communityWorkGiftRewardId) {
        const result = claimCommunityWorkGift(current);
        if (result.claimed) enqueueReward({
          id: communityWorkGiftRewardId,
          title: t('ui.rewards.communityWorkGiftTitle'),
          message: t('ui.rewards.communityWorkGiftMessage', { count: communityWorkGiftTickets }),
          gachaTickets: communityWorkGiftTickets,
          items: [],
        });
        return commitPet(result.pet);
      }
      if (current.claimedRewardIds.includes(reward.id)) return current;
      const coins = reward.coins ?? 0;
      return recordEarnedCoins({
        ...current,
        coins: current.coins + coins,
        claimedRewardIds: [...current.claimedRewardIds, reward.id],
        recentEvent: t(reward.eventKey, { coins }),
      }, coins);
    });
  };

  const claimHelpGift = () => {
    playAfterUnlock('coin');
    setPet((current) => {
      if (current.claimedRewardIds.includes(helpPageGiftRewardId)) return current;
      return recordEarnedCoins({
        ...current,
        coins: current.coins + helpPageGiftCoins,
        claimedRewardIds: [...current.claimedRewardIds, helpPageGiftRewardId],
        recentEvent: t('pet.reward.helpPageGift', { coins: helpPageGiftCoins }),
      }, helpPageGiftCoins);
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
    hasClaimedHelpGift: pet.claimedRewardIds.includes(helpPageGiftRewardId),
    hasClaimedGardenCompensation: pet.claimedRewardIds.includes(gardenCompensationRewardId),
    claimDateRewards,
    claimFloatingReward,
    claimHelpGift,
    claimGardenCompensation,
  };
};
