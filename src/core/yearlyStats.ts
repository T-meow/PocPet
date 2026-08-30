import type { CareActionKey, PetState, YearReview, YearlyCareActionKey, YearlyStats } from './petTypes';
import { getDailyResetDate, getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';

const yearlyCareKeys: readonly YearlyCareActionKey[] = ['play', 'clean', 'work', 'feed', 'gift', 'touch'];

export const defaultYearlyCareActionCounts = (): Record<YearlyCareActionKey, number> => ({
  play: 0,
  clean: 0,
  work: 0,
  feed: 0,
  gift: 0,
  touch: 0,
});

export const defaultYearlyStats = (
  time = Date.now(),
  dateKey = getDailyResetDateKey(time),
): YearlyStats => ({
  year: Number.parseInt(dateKey.slice(0, 4), 10) || getDailyResetDate(time).getFullYear(),
  activeDateKeys: [dateKey],
  careActionCounts: defaultYearlyCareActionCounts(),
  itemUseCount: 0,
  pomodoroFocusCount: 0,
});

export const normalizeYearlyStats = (
  value: unknown,
  now = Date.now(),
  effectiveDateKey = getDailyResetDateKey(now),
): YearlyStats => {
  const fallback = defaultYearlyStats(now, effectiveDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const raw = value as Record<string, unknown>;
  const rawCounts = raw.careActionCounts && typeof raw.careActionCounts === 'object'
    ? (raw.careActionCounts as Record<string, unknown>)
    : {};
  const careActionCounts = defaultYearlyCareActionCounts();

  yearlyCareKeys.forEach((key) => {
    const count = rawCounts[key];
    careActionCounts[key] = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  });

  const activeDateKeys = Array.isArray(raw.activeDateKeys)
    ? Array.from(new Set(
        raw.activeDateKeys
          .filter((key): key is string => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key))
          .map((key) => normalizeLegacyDailyDateKey(key, now) || key),
      ))
    : fallback.activeDateKeys;

  return {
    year: typeof raw.year === 'number' && Number.isFinite(raw.year) ? Math.floor(raw.year) : fallback.year,
    activeDateKeys: activeDateKeys.slice(0, 370),
    careActionCounts,
    itemUseCount: typeof raw.itemUseCount === 'number' && Number.isFinite(raw.itemUseCount) ? Math.max(0, Math.floor(raw.itemUseCount)) : 0,
    pomodoroFocusCount: typeof raw.pomodoroFocusCount === 'number' && Number.isFinite(raw.pomodoroFocusCount) ? Math.max(0, Math.floor(raw.pomodoroFocusCount)) : 0,
  };
};

export const normalizeYearReview = (value: unknown): YearReview | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const year = typeof raw.year === 'number' && Number.isFinite(raw.year) ? Math.floor(raw.year) : 0;
  if (year < 1970) return undefined;
  const topCareAction = typeof raw.topCareAction === 'string' && yearlyCareKeys.includes(raw.topCareAction as YearlyCareActionKey)
    ? (raw.topCareAction as YearlyCareActionKey)
    : undefined;

  return {
    year,
    companionDays: typeof raw.companionDays === 'number' && Number.isFinite(raw.companionDays) ? Math.max(0, Math.floor(raw.companionDays)) : 0,
    activeDays: typeof raw.activeDays === 'number' && Number.isFinite(raw.activeDays) ? Math.max(0, Math.floor(raw.activeDays)) : 0,
    careActions: typeof raw.careActions === 'number' && Number.isFinite(raw.careActions) ? Math.max(0, Math.floor(raw.careActions)) : 0,
    itemUseCount: typeof raw.itemUseCount === 'number' && Number.isFinite(raw.itemUseCount) ? Math.max(0, Math.floor(raw.itemUseCount)) : 0,
    pomodoroFocusCount: typeof raw.pomodoroFocusCount === 'number' && Number.isFinite(raw.pomodoroFocusCount) ? Math.max(0, Math.floor(raw.pomodoroFocusCount)) : 0,
    topCareAction,
  };
};

const getTopCareAction = (counts: Record<YearlyCareActionKey, number>): YearlyCareActionKey | undefined => {
  let topAction: YearlyCareActionKey | undefined;
  let topCount = 0;
  yearlyCareKeys.forEach((key) => {
    if (counts[key] > topCount) {
      topAction = key;
      topCount = counts[key];
    }
  });
  return topAction;
};

export const createYearReview = (stats: YearlyStats, createdAt: number): YearReview => {
  const yearStart = new Date(stats.year, 0, 1).getTime();
  const yearEnd = new Date(stats.year + 1, 0, 1).getTime();
  const companionStart = Math.max(createdAt, yearStart);
  const companionDays = companionStart < yearEnd ? Math.max(1, Math.ceil((yearEnd - companionStart) / 86400000)) : 0;
  const careActions = Object.values(stats.careActionCounts).reduce((sum, count) => sum + count, 0);

  return {
    year: stats.year,
    companionDays,
    activeDays: stats.activeDateKeys.length,
    careActions,
    itemUseCount: stats.itemUseCount,
    pomodoroFocusCount: stats.pomodoroFocusCount,
    topCareAction: getTopCareAction(stats.careActionCounts),
  };
};

export const ensureYearlyStatsForDate = (
  pet: PetState,
  now = Date.now(),
  dateKeyOverride?: string,
): PetState => {
  const today = dateKeyOverride || getEffectiveDailyDateKey(pet, now);
  const currentYear = Number.parseInt(today.slice(0, 4), 10) || getDailyResetDate(now).getFullYear();
  let stats = normalizeYearlyStats(pet.yearlyStats, now, today);
  let pendingYearReview = pet.pendingYearReview;
  let latestYearReview = pet.latestYearReview ?? pendingYearReview;
  let lastYearReviewYear = pet.lastYearReviewYear;

  if (stats.year < currentYear) {
    const review = createYearReview(stats, pet.createdAt);
    if (pet.lastYearReviewYear !== review.year && pet.pendingYearReview?.year !== review.year) {
      pendingYearReview = review;
      latestYearReview = review;
    }
    stats = defaultYearlyStats(now, today);
  } else if (stats.year > currentYear) {
    return { ...pet, yearlyStats: stats, pendingYearReview, latestYearReview, lastYearReviewYear };
  }

  if (!stats.activeDateKeys.includes(today)) {
    stats = { ...stats, activeDateKeys: [...stats.activeDateKeys, today].slice(-370) };
  }

  return { ...pet, yearlyStats: stats, pendingYearReview, latestYearReview, lastYearReviewYear };
};

export const recordYearlyCareAction = (pet: PetState, action: CareActionKey, now = Date.now(), amount = 1): PetState => {
  if (!yearlyCareKeys.includes(action as YearlyCareActionKey)) return ensureYearlyStatsForDate(pet, now);
  const current = ensureYearlyStatsForDate(pet, now);
  const key = action as YearlyCareActionKey;
  return {
    ...current,
    yearlyStats: {
      ...current.yearlyStats,
      careActionCounts: {
        ...current.yearlyStats.careActionCounts,
        [key]: current.yearlyStats.careActionCounts[key] + Math.max(0, Math.floor(amount)),
      },
    },
  };
};

export const recordYearlyItemUse = (pet: PetState, now = Date.now(), amount = 1): PetState => {
  const current = ensureYearlyStatsForDate(pet, now);
  return {
    ...current,
    yearlyStats: {
      ...current.yearlyStats,
      itemUseCount: current.yearlyStats.itemUseCount + Math.max(0, Math.floor(amount)),
    },
  };
};

export const recordYearlyPomodoroFocus = (
  pet: PetState,
  count: number,
  now = Date.now(),
  dateKeyOverride?: string,
): PetState => {
  if (count <= 0) return ensureYearlyStatsForDate(pet, now, dateKeyOverride);
  const current = ensureYearlyStatsForDate(pet, now, dateKeyOverride);
  return {
    ...current,
    yearlyStats: {
      ...current.yearlyStats,
      pomodoroFocusCount: current.yearlyStats.pomodoroFocusCount + Math.floor(count),
    },
  };
};

export const dismissYearReview = (pet: PetState): PetState =>
  pet.pendingYearReview
    ? {
        ...pet,
        latestYearReview: pet.pendingYearReview,
        lastYearReviewYear: pet.pendingYearReview.year,
        pendingYearReview: undefined,
      }
    : pet;
