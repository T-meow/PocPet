import type { NeighborEventContext, PetState } from './petTypes';
import { advancePet } from './petLifecycle';
import { normalizePet } from './petState';
import { shiftPetRuntimeTimestamps } from './gameClock';

// This is only a candidate until an external backup has been verified and the
// local save has committed. The UI must never publish it before those succeed.
export const prepareTimePause = (pet: PetState, now = Date.now(), context?: NeighborEventContext): PetState => {
  if (pet.timePause) return pet;
  return { ...advancePet(pet, now, context), timePause: { schemaVersion: 1, pausedAt: now } };
};

export const resumePetTime = (pet: PetState, now = Date.now()): PetState => {
  if (!pet.timePause) return pet;
  const frozen = normalizePet(pet, now, { preserveExpiredPartnerSchedule: true, preserveMiniGameSession: true });
  const shifted = shiftPetRuntimeTimestamps(frozen, now - frozen.timePause!.pausedAt, true);
  const { timePause: _pause, ...resumed } = shifted;
  // Rebase the runtime, including when the device clock moved backwards. Keep
  // calendar history and the daily anti-replay watermark on their real dates.
  return normalizePet({ ...resumed, lastUpdatedAt: now, timeGuard: { ...resumed.timeGuard, lastObservedAt: now } }, now,
    { preserveExpiredPartnerSchedule: true, preserveMiniGameSession: true });
};
