import { normalizePet } from './petState';
import type { PetState } from './petTypes';

export const persistentPetKeys = [
  'saveMetadata', 'name', 'level', 'hunger', 'mood', 'cleanliness', 'energy', 'health', 'createdAt', 'metDate', 'ageSeconds',
  'lastUpdatedAt', 'isSleeping', 'coins', 'hearts', 'inventory', 'lastDailyRewardAt', 'lastDailyEncounterAt',
  'dailyEncounterDateKey', 'neighborGiftDateKey', 'neighborGiftCount', 'dailyBiscuitClaimDate', 'dailyBiscuitClaims',
  'dailyDiscountDate', 'dailyDiscountItemIds', 'dailyDiscountUsedItemIds', 'dailyDiscountUsed',
  'dailyHeartExchangeDate', 'dailyHeartExchangeCount', 'weatherDate', 'weather', 'lastEnergyRecoveryAt',
  'sleepStartedAt', 'sleepStartMood', 'sleepStartHunger', 'sleepStartCleanliness', 'lastDreamTalkAt', 'actionStreak',
  'lastInteractionAt', 'lastPetInteractionAt', 'pomodoro', 'claimedRewardIds', 'birthday', 'claimedDateRewardKeys',
  'dailyLoginRewardDateKey', 'yearlyStats', 'pendingYearReview', 'latestYearReview', 'lastYearReviewYear',
  'dailyWish', 'returnWelcome', 'achievements', 'lastCleanActionAt', 'garden', 'boostCards', 'partnerSchedule',
  'goldenAppleGacha', 'classicEndgame', 'timeGuard', 'kitchen', 'miniGames', 'companionMemories',
] as const satisfies readonly (keyof PetState)[];

type PersistentBase = Pick<PetState, typeof persistentPetKeys[number]>;
export type PersistedPetStateV2 = Omit<PersistentBase, 'garden' | 'goldenAppleGacha' | 'kitchen' | 'miniGames' | 'achievements'> & {
  garden: Omit<PetState['garden'], 'activeSlotIndex' | 'slots'> & { slots: Array<PetState['garden']['slots'][number] | { unlocked: boolean }> };
  goldenAppleGacha: Omit<PetState['goldenAppleGacha'], 'recentResults' | 'recentHeartResults'>;
  kitchen: Omit<PetState['kitchen'], 'plating' | 'lastCraft'>;
  miniGames: Omit<PetState['miniGames'], 'style'>;
  achievements: Omit<PetState['achievements'], 'pendingReviewNotice'>;
};

export const toPersistedPet = (pet: PetState, now: number): PersistedPetStateV2 => {
  const current = normalizePet(pet, now);
  const base = Object.fromEntries(persistentPetKeys.map((key) => [key, current[key]])) as PersistentBase;
  const { activeSlotIndex: _slot, ...garden } = current.garden;
  const { recentResults: _gold, recentHeartResults: _heart, ...goldenAppleGacha } = current.goldenAppleGacha;
  const { plating: _plating, lastCraft: _craft, ...kitchen } = current.kitchen;
  const { style: _style, lastResult, ...miniGames } = current.miniGames;
  const { pendingReviewNotice: _notice, ...achievements } = current.achievements;
  return {
    ...base,
    garden: { ...garden, slots: garden.slots.map((slot) => slot.state === 'empty' ? { unlocked: slot.unlocked } : slot) },
    goldenAppleGacha, kitchen, achievements,
    miniGames: { ...miniGames, lastSettledSessionId: miniGames.lastSettledSessionId || lastResult?.id || '', lastResult: lastResult?.pending ? lastResult : undefined },
  };
};

export const hydratePersistedPet = (raw: Record<string, unknown>): Record<string, unknown> => ({
  ...raw,
  recentEvent: '', recentActivity: 'idle', recentActivityUntil: 0, lowCleanlinessSleepConfirmCount: 0,
  goldenAppleGacha: { ...(raw.goldenAppleGacha as object), recentResults: [], recentHeartResults: [] },
});
