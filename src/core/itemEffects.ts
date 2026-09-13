import { getAchievementEffects } from './achievements';
import { getClassicTrophyEffects } from './classicTrophies';
import { favoriteFoodIdSet } from './items';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import { addSkillXp, partnerScheduleMaxSkillLevel } from './partnerSchedule';
import { clampPetEnergy, clampPetHealth, clampPetStat, getPetEnergyCap, getPetStatCap } from './petStats';
import type { ItemDefinition, ItemEffect, ItemId, PartnerScheduleSkill, PetState } from './petTypes';

export const itemStatKeys = ['hunger', 'mood', 'cleanliness', 'energy', 'health'] as const;
type EffectItem = Pick<ItemDefinition, 'id' | 'kind' | 'effect'>;

export const getPictureBookReward = (initialSkill: PartnerScheduleSkill, quantity: number) => {
  let skill = initialSkill;
  let xp = 0;
  let heartServings = 0;
  for (let index = 0; index < quantity; index += 1) {
    if (skill.level < partnerScheduleMaxSkillLevel) { skill = addSkillXp(skill, 3); xp += 3; }
    else heartServings += 1;
  }
  return { skill, xp, heartServings };
};

export const getItemStatEffect = (pet: PetState, item: EffectItem): ItemEffect => {
  const multiplier = item.kind === 'food'
    ? getPartnerScheduleCrossSystemEffects(pet).foodEffectMultiplier * getClassicTrophyEffects(pet).foodEffectMultiplier
    : 1;
  const effect: ItemEffect = {};
  for (const key of itemStatKeys) {
    const amount = item.effect[key] ?? 0;
    effect[key] = amount > 0 && multiplier !== 1 ? Math.max(1, Math.round(amount * multiplier)) : amount;
  }
  if (item.kind === 'food') effect.hunger = (effect.hunger ?? 0) + getAchievementEffects(pet).careStatBonus;
  return effect;
};

// Preview only the item's recovery; wake-up and repeated-action reactions are separate.
export const getItemRecoveryPreview = (pet: PetState, item: EffectItem, quantity = 1, favoriteFoodIds?: readonly ItemId[]) => {
  const isSpecial = item.id === 'birthday_cake' || item.id === 'golden_apple';
  const count = isSpecial ? 1 : Math.max(1, Math.floor(quantity));
  const effect = isSpecial ? item.effect : getItemStatEffect(pet, item);
  const favorite = !isSpecial && (favoriteFoodIds ? favoriteFoodIds.includes(item.id) : favoriteFoodIdSet.has(item.id));
  const actual: ItemEffect = {};
  const overflow: ItemEffect = {};
  for (const key of itemStatKeys) {
    const cap = key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet);
    const amount = item.id === 'birthday_cake' ? cap - pet[key] : (effect[key] ?? 0) * count + (key === 'mood' && favorite ? 4 * count : 0);
    const clamp = key === 'energy' ? clampPetEnergy : key === 'health' ? clampPetHealth : clampPetStat;
    actual[key] = clamp(pet, pet[key] + amount) - pet[key];
    overflow[key] = Math.max(0, amount - actual[key]!);
  }
  return { actual, overflow };
};
