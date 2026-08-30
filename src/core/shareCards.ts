import {
  achievementDefinitions,
  getClassicGoalProgress,
  getPetEnergyCap,
  getPetStatCap,
  type GachaResult,
  type PetState,
  type YearlyCareActionKey,
} from './pet';
import { t } from '../i18n';

export interface PetProfileCardData {
  name: string;
  level: number;
  companionDays: number;
  statuses: Array<{ key: string; label: string; value: number; max: number }>;
  assets: Array<{ key: string; label: string; value: number }>;
  activity: Array<{ key: string; label: string; value: string }>;
  tags: string[];
}

export interface GachaCardData {
  machine: 'apple' | 'heart';
  count: number;
  jackpotCount: number;
  guaranteedCount: number;
  drawnAt: number;
  results: readonly GachaResult[];
}

export const createGachaCardData = (
  machine: 'apple' | 'heart',
  results: readonly GachaResult[],
): GachaCardData => {
  if (results.length < 1 || results.length > 10) throw new Error('A gacha card needs one to ten results.');
  return {
    machine,
    count: results.length,
    jackpotCount: results.filter((result) => result.rarity === 'jackpot').length,
    guaranteedCount: results.filter((result) => result.guaranteed || result.pityGuaranteed).length,
    drawnAt: results[0].drawnAt,
    results,
  };
};

const careKeys: readonly YearlyCareActionKey[] = ['play', 'clean', 'work', 'feed', 'gift', 'touch'];

const topEntry = <T extends string>(entries: Array<[T, number]>) =>
  entries.reduce<{ key?: T; value: number }>((best, [key, value]) =>
    value > best.value ? { key, value } : best, { value: 0 });

const getCareTag = (pet: PetState) => {
  const top = topEntry(careKeys.map((key) => [key, pet.achievements.counters.careActionCounts[key] ?? 0]));
  return top.key
    ? t('ui.share.tags.care', { action: t(`ui.yearReview.actions.${top.key}`), count: top.value })
    : t('ui.share.tags.growing');
};

const getGameplayTag = (pet: PetState) => {
  const gachaDraws = pet.goldenAppleGacha.totalDraws + pet.goldenAppleGacha.heartGachaTotalDraws;
  const candidates = [
    ['gacha', gachaDraws],
    ['garden', pet.garden.lifetimeHarvestCount],
    ['focus', pet.pomodoro.completedFocusCount],
    ['schedule', pet.achievements.counters.partnerScheduleClaimCount],
  ] as const;
  const top = topEntry(candidates.map(([key, value]) => [key, value]));
  return top.key
    ? t('ui.share.tags.gameplay', { activity: t(`ui.share.activities.${top.key}`), count: top.value })
    : t('ui.share.tags.growing');
};

const getCollectionTag = (pet: PetState) => {
  const inventoryKinds = Object.values(pet.inventory).filter((count) => count > 0).length;
  const goldenApples = pet.inventory.golden_apple ?? 0;
  if (pet.goldenAppleGacha.jackpotCount > 0) return t('ui.share.tags.jackpot', { count: pet.goldenAppleGacha.jackpotCount });
  if (goldenApples >= 10) return t('ui.share.tags.goldenApple', { count: goldenApples });
  if (inventoryKinds >= 12) return t('ui.share.tags.collector', { count: inventoryKinds });
  if (pet.coins >= 50000) return t('ui.share.tags.wealth', { coins: pet.coins });
  return t('ui.share.tags.growing');
};

export const createPetProfileCardData = (pet: PetState, now = Date.now()): PetProfileCardData => {
  const statCap = getPetStatCap(pet);
  const achievementCount = Object.keys(pet.achievements.unlockedAtById).length;
  const gachaDraws = pet.goldenAppleGacha.totalDraws + pet.goldenAppleGacha.heartGachaTotalDraws;
  const activeDays = new Set(
    Object.values(pet.achievements.counters.companionYearActiveDateKeysByYear).flat(),
  ).size;
  const careActions = careKeys.reduce(
    (sum, key) => sum + (pet.achievements.counters.careActionCounts[key] ?? 0),
    0,
  );
  const dreamProgress = getClassicGoalProgress(pet);
  return {
    name: pet.name,
    level: pet.level,
    companionDays: Math.max(1, Math.floor(Math.max(0, now - pet.createdAt) / 86400000) + 1),
    statuses: [
      { key: 'hunger', label: t('ui.share.stats.hunger'), value: pet.hunger, max: statCap },
      { key: 'mood', label: t('ui.share.stats.mood'), value: pet.mood, max: statCap },
      { key: 'cleanliness', label: t('ui.share.stats.cleanliness'), value: pet.cleanliness, max: statCap },
      { key: 'energy', label: t('ui.share.stats.energy'), value: pet.energy, max: getPetEnergyCap(pet) },
      { key: 'health', label: t('ui.share.stats.health'), value: pet.health, max: statCap },
    ],
    assets: [
      { key: 'coins', label: t('ui.share.assets.coins'), value: pet.coins },
      { key: 'hearts', label: t('ui.share.assets.hearts'), value: pet.hearts },
      { key: 'goldenApples', label: t('ui.share.assets.goldenApples'), value: pet.inventory.golden_apple ?? 0 },
      { key: 'tickets', label: t('ui.share.assets.tickets'), value: pet.goldenAppleGacha.tickets },
    ],
    activity: [
      { key: 'activeDays', label: t('ui.share.stats.activeDays'), value: String(activeDays) },
      { key: 'careActions', label: t('ui.share.stats.careActions'), value: String(careActions) },
      { key: 'heartsEarned', label: t('ui.share.stats.heartsEarned'), value: String(pet.achievements.counters.heartEarnedTotal) },
      { key: 'dailyWishes', label: t('ui.share.stats.dailyWishes'), value: String(pet.achievements.counters.dailyWishClaimCount) },
      { key: 'sleepCount', label: t('ui.share.stats.sleepCount'), value: String(pet.achievements.counters.sleepStartCount) },
      { key: 'itemUseCount', label: t('ui.share.stats.itemUseCount'), value: String(pet.achievements.counters.totalItemUseCount) },
      { key: 'achievements', label: t('ui.share.stats.achievements'), value: `${achievementCount}/${achievementDefinitions.length}` },
      { key: 'schedule', label: t('ui.share.stats.schedule'), value: String(pet.achievements.counters.partnerScheduleClaimCount) },
      { key: 'garden', label: t('ui.share.stats.garden'), value: String(pet.garden.lifetimeHarvestCount) },
      { key: 'focus', label: t('ui.share.stats.focus'), value: String(pet.pomodoro.completedFocusCount) },
      { key: 'gacha', label: t('ui.share.stats.gacha'), value: String(gachaDraws) },
      { key: 'dreams', label: t('ui.share.stats.dreams'), value: `${dreamProgress.completedStages}/${dreamProgress.totalStages}` },
    ],
    tags: [getCareTag(pet), getGameplayTag(pet), getCollectionTag(pet)],
  };
};
