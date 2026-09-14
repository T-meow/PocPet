import type { PartnerScheduleCategory, PartnerScheduleSkill, PartnerScheduleState, PetState } from './petTypes';

export const partnerScheduleCategories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];

export const partnerScheduleDailyContributionTargetMs = 60 * 60 * 1000;

export const partnerScheduleMasteryThresholds = [10, 30, 60] as const;

type PartnerScheduleSkills = PartnerScheduleState['skills'];

export const getPartnerScheduleMinimumSkillLevel = (skills: PartnerScheduleSkills) =>
  Math.min(...partnerScheduleCategories.map((category) => skills[category].level));

export const getPartnerScheduleUnlockedOfferCount = (skills: PartnerScheduleSkills) => {
  const minimumLevel = getPartnerScheduleMinimumSkillLevel(skills);
  if (minimumLevel >= 6) return 6;
  if (minimumLevel >= 3) return 5;
  return 4;
};

export const getPartnerScheduleGlobalCoinBonusPercent = (skills: PartnerScheduleSkills) => {
  const minimumLevel = getPartnerScheduleMinimumSkillLevel(skills);
  if (minimumLevel >= 6) return 15;
  if (minimumLevel >= 3) return 5;
  return 0;
};

export interface PartnerScheduleCategoryEffects {
  energyCostMultiplier: number;
  hungerMoodCostMultiplier: number;
  durationMultiplier: number;
  skillXpMultiplier: number;
  coinBonusPercent: number;
  grantsMasterCompletion: boolean;
}

export const getPartnerScheduleCategoryEffects = (skill: PartnerScheduleSkill): PartnerScheduleCategoryEffects => {
  const isMaster = skill.level >= 10;
  return {
    energyCostMultiplier: isMaster && skill.masterCompletions >= 10 ? 0.85 : skill.level >= 2 ? 0.9 : 1,
    hungerMoodCostMultiplier: skill.level >= 4 ? 0.9 : 1,
    durationMultiplier: skill.level >= 9 ? 0.9 : skill.level >= 5 ? 0.95 : 1,
    skillXpMultiplier: skill.level >= 7 && !isMaster ? 1.15 : 1,
    coinBonusPercent: isMaster && skill.masterCompletions >= 30 ? 10 : skill.level >= 8 ? 5 : 0,
    grantsMasterCompletion: isMaster,
  };
};

export const getPartnerScheduleMasteryNextThreshold = (masterCompletions: number) =>
  partnerScheduleMasteryThresholds.find((threshold) => masterCompletions < threshold);

export interface PartnerScheduleCrossSystemEffects {
  dailyWishCoinMultiplier: number;
  foodEffectMultiplier: number;
  gardenTimeMultiplier: number;
  awakeEnergyRecoveryMultiplier: number;
}

export const getPartnerScheduleCrossSystemEffects = (
  pet: Pick<PetState, 'partnerSchedule'>,
): PartnerScheduleCrossSystemEffects => {
  const study = pet.partnerSchedule.skills.study;
  const cooking = pet.partnerSchedule.skills.cooking;
  const garden = pet.partnerSchedule.skills.garden;
  const exercise = pet.partnerSchedule.skills.exercise;
  return {
    dailyWishCoinMultiplier: study.level >= 10 ? (study.masterCompletions >= 60 ? 1.2 : 1.1) : 1,
    foodEffectMultiplier: cooking.level >= 10 ? (cooking.masterCompletions >= 60 ? 1.15 : 1.1) : 1,
    gardenTimeMultiplier: garden.level >= 10 ? (garden.masterCompletions >= 60 ? 0.92 : 0.95) : 1,
    awakeEnergyRecoveryMultiplier: exercise.level >= 10 ? (exercise.masterCompletions >= 60 ? 0.88 : 0.92) : 1,
  };
};
