import { getEffectiveDailyDateKey } from './gameClock';
import { canSpendCompanionTime } from './kitchen';
import { resolveNeighborName, selectNeighborReference } from './neighbors';
import type { NeighborIdentity, PetState } from './petTypes';
import { farmNeighborCost, farmNeighborDays, farmNeighborDayDifference, shiftFarmNeighborDay } from './farmNeighborState';

export { farmNeighborCost, farmNeighborDays } from './farmNeighborState';
// null suppresses a nested receipt: batch plots and automatic compost are
// covered by their parent operation's single helper selection.
export type FarmNeighborCandidates = readonly NeighborIdentity[] | null;

export const getFarmNeighborStatus = (pet: PetState, now = Date.now()) => {
  const help = pet.community.farmNeighbor;
  const day = Number.isFinite(now) ? getEffectiveDailyDateKey(pet, now) : '';
  const remainingDays = help && day >= help.hiredDay && day < help.expiresDay
    ? Math.max(0, Math.min(farmNeighborDays, farmNeighborDayDifference(help.expiresDay, day))) : 0;
  return { active: remainingDays > 0, remainingDays, expiresDay: help?.expiresDay };
};
export const isFarmCompanionBusy = (pet: PetState) => !canSpendCompanionTime(pet) || pet.pomodoro.isRunning;
export const canDoFarmWork = (pet: PetState, now = Date.now()) =>
  Number.isFinite(now) && !pet.timePause && (canSpendCompanionTime(pet) || getFarmNeighborStatus(pet, now).active);
export const getFarmAnimalCareEnergy = (pet: PetState, now = Date.now()) => getFarmNeighborStatus(pet, now).active ? 0 : 2;

export const hireFarmNeighbor = (pet: PetState, neighbors: readonly NeighborIdentity[] = [], now = Date.now()): PetState => {
  if (!Number.isFinite(now) || pet.timePause || pet.hearts < farmNeighborCost || getFarmNeighborStatus(pet, now).active) return pet;
  const hiredDay = getEffectiveDailyDateKey(pet, now), expiresDay = shiftFarmNeighborDay(hiredDay, farmNeighborDays);
  const neighbor = selectNeighborReference(`farm:${pet.createdAt}:${hiredDay}:0`, neighbors);
  const name = resolveNeighborName(neighbor, neighbors) ?? '热心邻居';
  return { ...pet, hearts: pet.hearts - farmNeighborCost,
    community: { ...pet.community, farmNeighbor: { hiredDay, expiresDay, sequence: 0, neighbor } },
    recentEvent: `花费 ${farmNeighborCost} 心心，请邻居帮忙 ${farmNeighborDays} 个游戏日。${name}先来帮忙，服务至 ${expiresDay} 05:00；每天凌晨 5 点换日。` };
};

/** Call only after the action has actually consumed resources or collected its result. */
export const finishFarmNeighborAction = (pet: PetState, action: string, now: number, neighbors: FarmNeighborCandidates = []): PetState => {
  const help = pet.community.farmNeighbor;
  if (neighbors === null || !help || pet.timePause || !getFarmNeighborStatus(pet, now).active) return pet;
  const sequence = Math.min(Number.MAX_SAFE_INTEGER, help.sequence + 1);
  const neighbor = selectNeighborReference(`farm:${pet.createdAt}:${help.hiredDay}:${sequence}`, neighbors);
  const name = resolveNeighborName(neighbor, neighbors) ?? '热心邻居';
  return { ...pet, community: { ...pet.community, farmNeighbor: { ...help, sequence, neighbor } }, recentEvent: `${name}帮忙${action}。${pet.recentEvent}` };
};
