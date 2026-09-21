import { getAdventureStepCount } from './adventureData';
import { getAdventureBagCount } from './adventureState';
import { getExplorationBagCapacity } from './explorationBackpack';
import { getDailyResetDateKey } from './dailyReset';
import { getPetStatRatio, getPetStatScale } from './petStats';
import type { AdventureResult } from './adventureTypes';
import type { Inventory, PetState } from './petTypes';
import { isValleyQuest, valleyQuests } from './valleyQuests';
import { earnExplorationPay, recordLegacyPatrolPay } from './explorationBudget';

export const adventureHealthRules = { departure: 0.4, warning: 0.35, retreat: 0.2, lowMood: 0.3 } as const;
export const needsAdventureHealthReturn = (pet: PetState) => Boolean(pet.adventure.active) && getPetStatRatio(pet, 'health') < adventureHealthRules.retreat;
export const getAdventureRewardPreview = (pet: PetState, now = pet.lastUpdatedAt) => {
  const trip = pet.adventure.active;
  const steps = trip?.choices.length ?? 0;
  const complete = Boolean(trip && steps === getAdventureStepCount(trip.region, trip.purpose));
  const first = Boolean(complete && trip && !trip.purpose && !(pet.adventure.completed[trip.region] ?? 0));
  const legacy = trip?.rulesVersion === 1;
  if (isValleyQuest(trip?.purpose)) {
    const quest = valleyQuests[trip.purpose];
    return { steps, complete, first: complete, hearts: complete ? quest.hearts : 0, coins: complete ? quest.coins : 0 };
  }
  if (trip?.region === 'tutorial' || trip?.purpose) return { steps, complete, first, hearts: 0, coins: 0 };
  if (trip && trip.rulesVersion >= 7) {
    const earned = complete ? earnExplorationPay(pet, 'manual', now) : { coins: 0, hearts: 0 };
    return { steps, complete, first, hearts: earned.hearts, coins: earned.coins };
  }
  if (trip && trip.rulesVersion >= 3) return { steps, complete, first, hearts: complete ? Math.round(22 * getPetStatScale(pet)) : 0, coins: 0 };
  return { steps, complete, first, hearts: Math.round((steps + (complete ? 6 : 0) + (first ? 10 : 0)) * getPetStatScale(pet)),
    coins: steps * (legacy ? 4 : 20) + (complete ? legacy ? 24 : 180 : 0) + (first ? legacy ? 30 : 60 : 0) + (trip?.choices.includes('slope') ? legacy ? 8 : 30 : 0) };
};
export const finishAdventure = (pet: PetState, now: number, forced = false): PetState => {
  const trip = pet.adventure.active;
  if (!trip || pet.adventure.pending) return pet;
  const reward = getAdventureRewardPreview(pet, now);
  if (trip.rulesVersion >= 7 && trip.region === 'valley' && !trip.purpose && reward.complete) pet = earnExplorationPay(pet, 'manual', now).pet;
  if (trip.rulesVersion < 7 && trip.region === 'valley' && !trip.purpose && reward.complete) pet = recordLegacyPatrolPay(pet, trip.completedDay ?? getDailyResetDateKey(now), now);
  const items = { ...trip.bag };
  if (trip.tool) items.trail_rope = (items.trail_rope ?? 0) + 1;
  const salvage = forced && getAdventureBagCount(trip.loot) ? { ...trip.bag } : undefined;
  if (salvage) for (const [id, n] of Object.entries(trip.loot)) salvage[id] = (salvage[id] ?? 0) + n;
  const pending: AdventureResult = { ...reward, id: trip.id, region: trip.region, purpose: trip.purpose, actorId: trip.actorId, actorName: trip.actorName, endedAt: now,
    items: salvage ? {} : items, rewardsClaimed: false,
    ...(forced ? { returnReason: 'health' as const } : {}), ...(salvage ? { salvage, salvageTool: trip.tool } : {}),
    ...(reward.complete ? { completedDay: trip.completedDay ?? getDailyResetDateKey(now) } : {}) };
  return { ...pet, adventure: { ...pet.adventure, active: undefined, pending }, recentEvent: forced ? '健康低于 20%，已立即安全返程。已完成的发现保留，请收好本趟物资。' : '已经安全返回前哨基地，收好这一趟的行囊吧。' };
};
export const enforceAdventureHealth = (pet: PetState, now = pet.lastUpdatedAt): PetState => needsAdventureHealthReturn(pet) ? finishAdventure(pet, now, true) : pet;
export const chooseAdventureReturnItems = (pet: PetState, resultId: string, chosen: Inventory): PetState => {
  const result = pet.adventure.pending;
  if (!result || result.id !== resultId || !result.salvage || result.rewardsClaimed || getAdventureBagCount(chosen) > getExplorationBagCapacity(pet) ||
    Object.entries(chosen).some(([id, n]) => id === 'trail_rope' || !Number.isInteger(n) || n < 0 || n > (result.salvage?.[id] ?? 0))) return pet;
  const items = Object.fromEntries(Object.entries(chosen).filter(([, n]) => n > 0));
  if (result.salvageTool) items.trail_rope = 1;
  return { ...pet, adventure: { ...pet.adventure, pending: { ...result, items, salvage: undefined, salvageTool: undefined } }, recentEvent: '返程行囊已确认，未选物资已放弃。仓库放不下的所选物资会保留待领。' };
};
