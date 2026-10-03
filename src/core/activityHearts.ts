import { recordEarnedHearts } from './achievements';
import type { PetState } from './petTypes';

export const pomodoroFocusHearts = 20;
export const dailyWishHearts = 40;
export const communityTaskHearts = 150;
export const specialtyOrderHearts = 300;
export const fishingCatchHearts = 3;

// Use the natural cycle so care, skills and decorations never reduce the reward.
export const getProductionHeartReward = (hours: number) => Math.max(3, Math.min(10, Math.ceil(hours)));

// Fixed activity rewards stay identical when time or harvests settle in batches.
export const grantActivityHearts = (pet: PetState, amount: number): PetState => {
  if (pet.timePause || !Number.isFinite(amount) || amount < 1) return pet;
  const hearts = Math.floor(amount);
  return recordEarnedHearts({ ...pet, hearts: pet.hearts + hearts }, hearts);
};
