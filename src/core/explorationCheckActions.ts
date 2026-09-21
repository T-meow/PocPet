import { incrementAchievementItemUse } from './achievements';
import { getInventoryItem } from './items';
import { getDish } from './kitchenRecipes';
import { applyItemHungerEffect, getItemStatEffect, getItemUsePlan, overfedMessage } from './itemEffects';
import { addSkillXp } from './partnerSchedule';
import { clampPetEnergy, clampPetHealth, clampPetHunger, clampPetStat, updatePetSatiety } from './petStats';
import { getToolUsesLeft, spendToolUse } from './toolDurability';
import type { Inventory, ItemId, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { advanceExplorationCheckState, createExplorationCheckState, explorationOutcomeNames, explorationSkillNames, getExplorationCheckPreview, resolveExplorationCheck, type ExplorationCheckAction, type ExplorationCheckContext, type ExplorationCheckState } from './explorationChecks';

interface CheckTrip { id: string; tool: boolean; bag: Inventory; checkState?: ExplorationCheckState }
export const getExplorationActionContext = (pet: PetState, trip: CheckTrip, action: ExplorationCheckAction, node: string, region: RegionId = 'valley'): ExplorationCheckContext => {
  const tool = action.check.tool, item = action.mealItem ? getInventoryItem(action.mealItem as ItemId) : undefined;
  const blockedReason = action.check.prepare !== 'meal' ? '' : !item || !getDish(item.id) || !(trip.bag[item.id] > 0) ? '行囊中需要一份料理，可先补充料理或选择其他路线。' : getItemUsePlan(pet, item, 1).blocked ? overfedMessage : '';
  const toolAvailable = tool ? (tool !== 'trail_rope' || trip.tool) && getToolUsesLeft(pet, tool, tool === 'trail_rope') > 0 : false;
  return { region, node, state: trip.checkState ?? createExplorationCheckState(trip.id), toolAvailable, blockedReason };
};
export const previewExplorationAction = (pet: PetState, trip: CheckTrip, action: ExplorationCheckAction, node: string, region: RegionId = 'valley') =>
  getExplorationCheckPreview(pet, action, getExplorationActionContext(pet, trip, action, node, region));

// One pure transaction; the owning trip consumes the meal from its bag and commits this result once.
export const applyExplorationCheck = (pet: PetState, trip: CheckTrip, action: ExplorationCheckAction, node: string, region: RegionId = 'valley') => {
  const context = getExplorationActionContext(pet, trip, action, node, region);
  const result = resolveExplorationCheck(pet, action, context);
  if (!result) return undefined;
  const use = action.check.tool ? spendToolUse(pet, action.check.tool, action.check.tool === 'trail_rope') : undefined;
  if (action.check.tool && !use) return undefined;
  if (use) result.toolBroken = use.broken;
  let next = use?.pet ?? pet;
  const health = clampPetHealth(next, pet.health - result.healthLoss), mood = clampPetStat(next, pet.mood + result.moodChange);
  result.healthLoss = Math.round((pet.health - health) * 10) / 10;
  result.moodChange = mood - pet.mood;
  next = updatePetSatiety({ ...next, hunger: clampPetHunger(next, pet.hunger - result.hunger), energy: clampPetEnergy(next, pet.energy - result.energy), health, mood });
  if (result.skill && result.xp) next = { ...next, partnerSchedule: { ...next.partnerSchedule, skills: { ...next.partnerSchedule.skills, [result.skill]: addSkillXp(next.partnerSchedule.skills[result.skill], result.xp) } } };
  if (action.mealItem) {
    const item = getInventoryItem(action.mealItem as ItemId)!;
    const effect = getItemStatEffect(next, item);
    const recovery = { hunger: applyItemHungerEffect(next, item, effect.hunger ?? 0), energy: clampPetEnergy(next, next.energy + (effect.energy ?? 0)), health: clampPetHealth(next, next.health + (effect.health ?? 0)), mood: clampPetStat(next, next.mood + (effect.mood ?? 0)), cleanliness: clampPetStat(next, next.cleanliness + (effect.cleanliness ?? 0)) };
    result.recovery = { hunger: recovery.hunger - next.hunger, energy: recovery.energy - next.energy, health: recovery.health - next.health, mood: recovery.mood - next.mood, cleanliness: recovery.cleanliness - next.cleanliness };
    next = updatePetSatiety(incrementAchievementItemUse({ ...next, ...recovery }, item.id));
  }
  const state = advanceExplorationCheckState(context.state, action, result);
  const recentEvent = `${action.title}：${explorationOutcomeNames[result.outcome]}。饱食 −${result.hunger}，体力 −${result.energy}${result.healthLoss ? `，健康 −${result.healthLoss}` : '，健康无损'}。${result.xp && result.skill ? `${explorationSkillNames[result.skill]}经验 +${result.xp}。` : ''}${use ? `工具耐久 −1${use.broken ? '，已用尽' : ''}。` : ''}`;
  return { pet: { ...next, recentEvent }, result, state, toolBroken: Boolean(use?.broken),
    energySpent: result.energy - (result.recovery?.energy ?? 0), healthLost: result.healthLoss - (result.recovery?.health ?? 0) };
};
