import { getAchievementEffects } from './achievements';
import { getClassicTrophyEffects } from './classicTrophies';
import { favoriteFoodIdSet } from './items';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import { addSkillXp, partnerScheduleMaxSkillLevel } from './partnerSchedule';
import { clampPetEnergy, clampPetHealth, clampPetHunger, clampPetStat, getPetEnergyCap, getPetStatCap, isPetOverfed } from './petStats';
import type { ItemDefinition, ItemEffect, ItemId, PartnerScheduleSkill, PetState } from './petTypes';

export const itemStatKeys = ['hunger', 'mood', 'cleanliness', 'energy', 'health'] as const;
export const goldenAppleRecoveryPercent = 50;
export const foodHungerOverflowRatio = 0.6;
type EffectItem = Pick<ItemDefinition, 'id' | 'kind' | 'effect'>;

export const overfedMessage = '吃撑了，先消化一下。饱食降至上限的 95% 后可继续喂食。';

// Special recovery items keep their existing uses, including golden-apple hearts.
export const getItemUsePlan = (pet: PetState, item: EffectItem, quantity = 1) => {
  const special = item.id === 'birthday_cake' || item.id === 'golden_apple';
  const requestedQuantity = special || item.kind === 'garden' ? 1 : Math.max(1, Math.min(99, Number.isFinite(quantity) ? Math.floor(quantity) : 1));
  const food = item.kind === 'food' && !special;
  const blocked = food && isPetOverfed(pet);
  const hungerPerItem = food ? getItemStatEffect(pet, item).hunger ?? 0 : 0;
  const needed = hungerPerItem > 0 ? Math.ceil(Math.max(0, getPetStatCap(pet) - pet.hunger) / hungerPerItem) : requestedQuantity;
  return { requestedQuantity, quantity: blocked ? 0 : Math.min(requestedQuantity, needed), blocked };
};

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
  const effect: ItemEffect = {};
  if (item.id === 'golden_apple') {
    for (const key of itemStatKeys) {
      const cap = key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet);
      effect[key] = Math.round(cap * goldenAppleRecoveryPercent / 100);
    }
    return effect;
  }
  const multiplier = item.kind === 'food'
    ? getPartnerScheduleCrossSystemEffects(pet).foodEffectMultiplier * getClassicTrophyEffects(pet).foodEffectMultiplier
    : 1;
  for (const key of itemStatKeys) {
    const amount = item.effect[key] ?? 0;
    effect[key] = amount > 0 && multiplier !== 1 ? Math.max(1, Math.round(amount * multiplier)) : amount;
  }
  if (item.kind === 'food') effect.hunger = (effect.hunger ?? 0) + getAchievementEffects(pet).careStatBonus;
  return effect;
};

export const applyItemHungerEffect = (pet: PetState, item: EffectItem, amount: number) => {
  if (item.kind !== 'food' || amount <= 0) return clampPetHunger(pet, pet.hunger + amount);
  const normalRecovery = Math.min(amount, Math.max(0, getPetStatCap(pet) - pet.hunger));
  return pet.hunger + normalRecovery + (amount - normalRecovery) * foodHungerOverflowRatio;
};

// Preview only the item's recovery; wake-up and repeated-action reactions are separate.
export const getItemRecoveryPreview = (pet: PetState, item: EffectItem, quantity = 1, favoriteFoodIds?: readonly ItemId[]) => {
  const isSpecial = item.id === 'birthday_cake' || item.id === 'golden_apple';
  const plan = getItemUsePlan(pet, item, quantity);
  const count = plan.quantity;
  const effect = item.id === 'birthday_cake' ? item.effect : getItemStatEffect(pet, item);
  const favorite = !isSpecial && (favoriteFoodIds ? favoriteFoodIds.includes(item.id) : favoriteFoodIdSet.has(item.id));
  const actual: ItemEffect = {};
  const overflow: ItemEffect = {};
  for (const key of itemStatKeys) {
    const cap = key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet);
    const amount = item.id === 'birthday_cake' ? Math.max(0, cap - pet[key]) : (effect[key] ?? 0) * count + (key === 'mood' && favorite ? 4 * count : 0);
    const clamp = key === 'energy' ? clampPetEnergy : key === 'health' ? clampPetHealth : clampPetStat;
    actual[key] = (key === 'hunger' ? applyItemHungerEffect(pet, item, amount) : clamp(pet, pet[key] + amount)) - pet[key];
    overflow[key] = Math.max(0, amount - actual[key]!);
  }
  return { actual, overflow, ...plan };
};
