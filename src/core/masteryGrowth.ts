import type { MasteryStatKey, MasteryStatUpgrades, PartnerScheduleState, PetState } from './petTypes';

export const masteryUpgradeInterval = 30;
export const masteryStatIncrease = 5;
export const masteryStatKeys: readonly MasteryStatKey[] = ['hunger', 'mood', 'cleanliness', 'energy', 'health'];
export const masteryStatNames: Record<MasteryStatKey, string> = { hunger: '饱腹', mood: '心情', cleanliness: '清洁', energy: '体力', health: '健康' };

export const defaultMasteryStatUpgrades = (): MasteryStatUpgrades => ({ hunger: 0, mood: 0, cleanliness: 0, energy: 0, health: 0 });
const totalMasterCompletions = (skills: PartnerScheduleState['skills']) => Object.values(skills)
  .reduce((total, skill) => total + (skill.level >= 10 ? skill.masterCompletions : 0), 0);

export const normalizeMasteryStatUpgrades = (value: unknown, skills: PartnerScheduleState['skills']): MasteryStatUpgrades => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const upgrades = defaultMasteryStatUpgrades();
  let remaining = Math.floor(totalMasterCompletions(skills) / masteryUpgradeInterval);
  for (const key of masteryStatKeys) {
    const count = raw[key];
    upgrades[key] = typeof count === 'number' && Number.isFinite(count) ? Math.min(remaining, Math.max(0, Math.floor(count))) : 0;
    remaining -= upgrades[key];
  }
  return upgrades;
};

export const getMasteryStatBonus = (pet: Partial<Pick<PetState, 'partnerSchedule'>>, key: MasteryStatKey) =>
  (pet.partnerSchedule?.statUpgrades?.[key] ?? 0) * masteryStatIncrease;

export const getMasteryGrowthProgress = (pet: Pick<PetState, 'partnerSchedule'>) => {
  const total = totalMasterCompletions(pet.partnerSchedule.skills);
  const earned = Math.floor(total / masteryUpgradeInterval);
  const used = masteryStatKeys.reduce((sum, key) => sum + (pet.partnerSchedule.statUpgrades?.[key] ?? 0), 0);
  return { total, earned, used, available: Math.max(0, earned - used), progress: total % masteryUpgradeInterval,
    remaining: masteryUpgradeInterval - total % masteryUpgradeInterval };
};
