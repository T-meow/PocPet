import { getEnergyRecoverySeasonModifier } from './season';
import { getClassicTrophyEffects } from './classicTrophies';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import type { PetState } from './petTypes';

export const lowEnergyThreshold = 10;

export const criticalHungerActionThreshold = 10;

export const lowCleanlinessSleepWarningThreshold = 25;

export const lowCleanlinessSleepConfirmClicks = 3;

export const lowCleanlinessSleepMoodPenalty = 12;

export const defaultPetName = 'Furo';

export const maxPetLevel = 99;

export const linearUpgradeHeartStartLevel = 20;

export const linearUpgradeHeartBaseCost = 6900;

export const linearUpgradeHeartCostPerLevel = 22;

export const baseStatCap = 100;

export const statCapPerLevel = 5;

export const awakeEnergyRecoveryMs = 5 * 60 * 1000;

export const breezyEnergyRecoveryMs = 4 * 60 * 1000;

export const sleepEnergyRecoveryMs = 3 * 60 * 1000;

export type ScaledPetStatKey = 'hunger' | 'mood' | 'cleanliness' | 'health';

export const clampStat = (value: number, max = baseStatCap) => Math.max(0, Math.min(max, value));

export const clampHealth = (value: number, max = baseStatCap) => Math.max(1, clampStat(value, max));

export const clampCoins = (value: number) => Math.max(0, Math.round(value));

export const clampCount = (value: number) => Math.max(0, Math.floor(value));

export const clampLevel = (value: number) => Math.max(1, Math.min(maxPetLevel, clampCount(value)));

export const getPetStatCap = (petOrLevel: Pick<PetState, 'level'> | number) => {
  const level = typeof petOrLevel === 'number' ? petOrLevel : petOrLevel.level;
  return baseStatCap + (clampLevel(level) - 1) * statCapPerLevel;
};

export const getPetStatScale = (petOrLevel: Pick<PetState, 'level'> | number) =>
  getPetStatCap(petOrLevel) / baseStatCap;

export const scalePetStatDelta = (petOrLevel: Pick<PetState, 'level'> | number, amount: number) =>
  amount * getPetStatScale(petOrLevel);

export const roundPetStatDisplayAmount = (amount: number) => Math.round(amount);

export const getPetStatThreshold = (petOrLevel: Pick<PetState, 'level'> | number, baseThreshold: number) =>
  scalePetStatDelta(petOrLevel, baseThreshold);

export const getPetStatRatio = (pet: PetState, key: ScaledPetStatKey) => {
  const statCap = getPetStatCap(pet);
  return statCap > 0 ? Math.max(0, Math.min(1, pet[key] / statCap)) : 0;
};

export const overfedReleaseRatio = 0.95;

export const isPetOverfed = (pet: Pick<PetState, 'level' | 'hunger'> & { isOverfed?: boolean }) => {
  const cap = getPetStatCap(pet);
  return pet.hunger >= cap || (pet.isOverfed === true && pet.hunger > cap * overfedReleaseRatio);
};

export const updatePetSatiety = (pet: PetState): PetState => {
  const isOverfed = isPetOverfed(pet);
  return pet.isOverfed === isOverfed ? pet : { ...pet, isOverfed };
};

export const clampPetStat = (pet: PetState, value: number) => clampStat(value, getPetStatCap(pet));

export const clampPetHealth = (pet: PetState, value: number) => clampHealth(value, getPetStatCap(pet));

export const getPetEnergyCap = (pet: Pick<PetState, 'level' | 'classicEndgame'>) =>
  getPetStatCap(pet) + getClassicTrophyEffects(pet).energyCapBonus;

export const clampPetEnergy = (pet: Pick<PetState, 'level' | 'classicEndgame'>, value: number) =>
  Math.round(clampStat(value, getPetEnergyCap(pet)));

export const getUpgradeHeartCost = (targetLevel: number) => {
  const level = clampLevel(targetLevel);
  return level < linearUpgradeHeartStartLevel
    ? level ** 3
    : linearUpgradeHeartBaseCost + linearUpgradeHeartCostPerLevel * (level - linearUpgradeHeartStartLevel);
};

export const getNextUpgradeHeartCost = (pet: PetState) =>
  pet.level >= maxPetLevel ? 0 : getUpgradeHeartCost(pet.level + 1);

export const getEnergyRecoveryIntervalMs = (pet: PetState, isSleeping = pet.isSleeping, now = Date.now()) => {
  const baseIntervalMs = isSleeping ? sleepEnergyRecoveryMs : pet.weather === 'breezy' ? breezyEnergyRecoveryMs : awakeEnergyRecoveryMs;
  const masteryMultiplier = isSleeping
    ? 1
    : getPartnerScheduleCrossSystemEffects(pet).awakeEnergyRecoveryMultiplier;
  return Math.max(1, Math.round(baseIntervalMs * getEnergyRecoverySeasonModifier(now, isSleeping) * masteryMultiplier));
};
