import { getEnergyRecoverySeasonModifier } from './season';
import { getClassicTrophyEffects } from './classicTrophies';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import type { PetState } from './petTypes';
import { getAdventureEnergyBonus } from './adventureGrowth';

export const lowEnergyThreshold = 10;

export const criticalHungerActionThreshold = 10;

export const lowCleanlinessSleepWarningThreshold = 25;

export const lowCleanlinessSleepConfirmClicks = 3;

export const lowCleanlinessSleepMoodPenalty = 12;

export const defaultPetName = 'Furo';

export const maxPetLevel = 99;

export const linearUpgradeHeartStartLevel = 20;

export const linearUpgradeHeartBaseCost = 6000;

export const linearUpgradeHeartCostPerLevel = 320;

export const quadraticUpgradeHeartCostPerLevel = 3;

// Ease the steep late-teen costs into the growing cost of later levels.
const earlyUpgradeHeartCosts = [1, 8, 27, 64, 125, 216, 343, 512, 729, 1000, 1300, 1660, 2100, 2600, 3200, 3850, 4500, 5100, 5600] as const;

export const baseStatCap = 100;

export const statCapPerLevel = 5;

export const awakeEnergyRecoveryMs = 5 * 60 * 1000;

export const breezyEnergyRecoveryMs = 4 * 60 * 1000;

export const sleepEnergyRecoveryMs = 3 * 60 * 1000;

export type ScaledPetStatKey = 'hunger' | 'mood' | 'cleanliness' | 'health';

export const clampStat = (value: number, max = baseStatCap) => Math.max(0, Math.min(max, value));

export const clampHealth = (value: number, max = baseStatCap) => Math.max(1, clampStat(value, max));

export const clampCoins = (value: number) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(value)));

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

// Non-food changes keep any stored fullness above the cap without adding more.
export const clampPetHunger = (pet: Pick<PetState, 'level' | 'hunger'>, value: number) =>
  clampStat(value, Math.max(getPetStatCap(pet), pet.hunger));

export const clampPetHealth = (pet: PetState, value: number) => clampHealth(value, getPetStatCap(pet));

export const getPetEnergyCap = (pet: Pick<PetState, 'level' | 'classicEndgame'> & Partial<Pick<PetState, 'adventure' | 'community'>>) =>
  getPetStatCap(pet) + getClassicTrophyEffects(pet).energyCapBonus + getAdventureEnergyBonus(pet);

export const clampPetEnergy = (pet: Parameters<typeof getPetEnergyCap>[0], value: number) =>
  Math.round(clampStat(value, getPetEnergyCap(pet)));

export const getUpgradeHeartCost = (targetLevel: number) => {
  const level = clampLevel(targetLevel);
  const laterLevels = level - linearUpgradeHeartStartLevel;
  return level < linearUpgradeHeartStartLevel
    ? earlyUpgradeHeartCosts[level - 1]
    : linearUpgradeHeartBaseCost + linearUpgradeHeartCostPerLevel * laterLevels + quadraticUpgradeHeartCostPerLevel * laterLevels ** 2;
};

export const getUpgradeHeartCurveRefund = (currentLevel: number) => {
  let refund = 0;
  for (let level = 2; level <= clampLevel(currentLevel); level++) {
    const previousCost = level < 20 ? level ** 3 : 6900 + 22 * (level - 20);
    // Refund discounted completed levels without charging for later increases.
    refund += Math.max(0, previousCost - getUpgradeHeartCost(level));
  }
  return refund;
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
