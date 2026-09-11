import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import type { PetState, TimeGuardState } from './petTypes';

export const timeGuardSchemaVersion = 1 as const;
export const severeClockRollbackThresholdMs = 36 * 60 * 60 * 1000;

const dailyDateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isDailyDateKey = (value: unknown): value is string =>
  typeof value === 'string' && dailyDateKeyPattern.test(value) && (() => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return year >= 1970
      && year <= 9999
      && date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  })();

const laterDailyDateKey = (left: string, right: string) => left >= right ? left : right;

const findLatestStoredDailyDateKey = (value: unknown, fallback: string, now: number) => {
  let latest = fallback;
  const pet = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const record = (entry: unknown) => {
    const normalized = normalizeLegacyDailyDateKey(entry, now);
    if (isDailyDateKey(normalized)) latest = laterDailyDateKey(latest, normalized);
  };
  const object = (entry: unknown) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? entry as Record<string, unknown>
    : {};
  const recordArray = (entry: unknown) => {
    if (Array.isArray(entry)) entry.slice(0, 400).forEach(record);
  };

  [
    pet.dailyEncounterDateKey,
    pet.neighborGiftDateKey,
    pet.dailyBiscuitClaimDate,
    pet.dailyDiscountDate,
    pet.dailyHeartExchangeDate,
    pet.dailyLoginRewardDateKey,
  ].forEach(record);

  const dailyWish = object(pet.dailyWish);
  const achievements = object(pet.achievements);
  const achievementCounters = object(achievements.counters);
  const companionYears = object(achievementCounters.companionYearActiveDateKeysByYear);
  const garden = object(pet.garden);
  const boostCards = object(pet.boostCards);
  const partnerSchedule = object(pet.partnerSchedule);
  const gacha = object(pet.goldenAppleGacha);
  const pomodoro = object(pet.pomodoro);
  const yearlyStats = object(pet.yearlyStats);

  [
    dailyWish.dateKey,
    achievements.dailyStipendClaimDateKey,
    garden.dailyCareDateKey,
    garden.dailyHarvestDateKey,
    boostCards.dailyDateKey,
    partnerSchedule.boardDateKey,
    gacha.dailyDateKey,
    pomodoro.dailyFocusDate,
  ].forEach(record);
  recordArray(yearlyStats.activeDateKeys);
  Object.values(companionYears).slice(0, 100).forEach(recordArray);
  if (Array.isArray(garden.slots)) {
    garden.slots.slice(0, 20).forEach((slot) => {
      const gardenSlot = object(slot);
      [
        gardenSlot.dailyHarvestDateKey,
        gardenSlot.lastWateredDateKey,
        gardenSlot.lastFertilizedDateKey,
        gardenSlot.lastBoostedDateKey,
      ].forEach(record);
    });
  }
  if (Array.isArray(partnerSchedule.offers)) {
    partnerSchedule.offers.slice(0, 20).forEach((offer) => record(object(offer).dateKey));
  }
  return latest;
};

export const getDailyDateKeyTime = (dateKey: string, fallback = Date.now()) => {
  if (!isDailyDateKey(dateKey)) return fallback;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12).getTime();
};

export const normalizeTimeGuardState = (
  value: unknown,
  petValue: unknown,
  now = Date.now(),
): TimeGuardState => {
  const currentDateKey = getDailyResetDateKey(now);
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawPet = petValue && typeof petValue === 'object' && !Array.isArray(petValue)
    ? petValue as Record<string, unknown>
    : {};
  const storedDateKey = isDailyDateKey(raw.maxDailyDateKey) ? raw.maxDailyDateKey : currentDateKey;
  const maxDailyDateKey = findLatestStoredDailyDateKey(rawPet, laterDailyDateKey(currentDateKey, storedDateKey), now);
  const lastObservedAt = isFiniteTimestamp(raw.lastObservedAt)
    ? raw.lastObservedAt
    : isFiniteTimestamp(rawPet.lastUpdatedAt)
      ? rawPet.lastUpdatedAt
      : now;

  return {
    schemaVersion: timeGuardSchemaVersion,
    lastObservedAt,
    maxDailyDateKey,
  };
};

export const getEffectiveDailyDateKey = (pet: Pick<PetState, 'timeGuard'>, now = Date.now()) => {
  const currentDateKey = getDailyResetDateKey(now);
  const storedDateKey = pet.timeGuard && isDailyDateKey(pet.timeGuard.maxDailyDateKey)
    ? pet.timeGuard.maxDailyDateKey
    : currentDateKey;
  return laterDailyDateKey(currentDateKey, storedDateKey);
};

const shiftTimestamp = (value: number, offsetMs: number) =>
  isFiniteTimestamp(value) && value > 0 ? Math.max(1, value + offsetMs) : 0;

export const shiftPetRuntimeTimestamps = (pet: PetState, offsetMs: number): PetState => {
  const actionStreak = pet.actionStreak
    ? {
        ...pet.actionStreak,
        windowStartedAt: shiftTimestamp(pet.actionStreak.windowStartedAt, offsetMs),
        lastAt: shiftTimestamp(pet.actionStreak.lastAt, offsetMs),
      }
    : pet.actionStreak;
  const pomodoro = pet.pomodoro
    ? {
        ...pet.pomodoro,
        phaseStartedAt: shiftTimestamp(pet.pomodoro.phaseStartedAt, offsetMs),
        phaseEndsAt: shiftTimestamp(pet.pomodoro.phaseEndsAt, offsetMs),
        focusRewardCheckpointAt: shiftTimestamp(pet.pomodoro.focusRewardCheckpointAt, offsetMs),
      }
    : pet.pomodoro;
  const garden = pet.garden
    ? {
        ...pet.garden,
        slots: Array.isArray(pet.garden.slots)
          ? pet.garden.slots.map((slot) => ({
              ...slot,
              plantedAt: shiftTimestamp(slot.plantedAt, offsetMs),
              naturalReadyAt: shiftTimestamp(slot.naturalReadyAt, offsetMs),
              nextReadyAt: shiftTimestamp(slot.nextReadyAt, offsetMs),
            }))
          : pet.garden.slots,
      }
    : pet.garden;
  const boostCards = pet.boostCards
    ? {
        ...pet.boostCards,
        friendPassExpiresAt: shiftTimestamp(pet.boostCards.friendPassExpiresAt, offsetMs),
        bestFriendPassExpiresAt: shiftTimestamp(pet.boostCards.bestFriendPassExpiresAt, offsetMs),
      }
    : pet.boostCards;
  const partnerSchedule = pet.partnerSchedule
    ? {
        ...pet.partnerSchedule,
        active: pet.partnerSchedule.active
          ? {
              ...pet.partnerSchedule.active,
              startedAt: shiftTimestamp(pet.partnerSchedule.active.startedAt, offsetMs),
              endsAt: shiftTimestamp(pet.partnerSchedule.active.endsAt, offsetMs),
            }
          : undefined,
      }
    : pet.partnerSchedule;

  return {
    ...pet,
    lastUpdatedAt: shiftTimestamp(pet.lastUpdatedAt, offsetMs),
    miniGames: pet.miniGames?.active ? { ...pet.miniGames, active: { ...pet.miniGames.active, paused: true, lastTickAt: 0, throwAt: 0, blowingAt: 0 } } : pet.miniGames,
    recentActivityUntil: shiftTimestamp(pet.recentActivityUntil, offsetMs),
    lastEnergyRecoveryAt: shiftTimestamp(pet.lastEnergyRecoveryAt, offsetMs),
    sleepStartedAt: shiftTimestamp(pet.sleepStartedAt, offsetMs),
    lastDreamTalkAt: shiftTimestamp(pet.lastDreamTalkAt, offsetMs),
    lastInteractionAt: shiftTimestamp(pet.lastInteractionAt, offsetMs),
    lastPetInteractionAt: shiftTimestamp(pet.lastPetInteractionAt, offsetMs),
    lastCleanActionAt: shiftTimestamp(pet.lastCleanActionAt, offsetMs),
    actionStreak,
    pomodoro,
    garden,
    boostCards,
    partnerSchedule,
  };
};

const rebaseFutureDateKey = (value: unknown, currentDateKey: string) =>
  isDailyDateKey(value) && value > currentDateKey ? currentDateKey : typeof value === 'string' ? value : '';

const getLocalCalendarDate = (time: number): PetState['metDate'] => {
  const date = new Date(time);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
};

const getCalendarDateKey = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const date = value as Partial<PetState['metDate']>;
  if (![date.year, date.month, date.day].every((part) => typeof part === 'number' && Number.isInteger(part))) return '';
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
};

export const rebasePetFutureCalendarState = (pet: PetState, now = Date.now()): PetState => {
  const currentDateKey = getDailyResetDateKey(now);
  const currentYear = Number.parseInt(currentDateKey.slice(0, 4), 10);
  const currentCalendarDateKey = getCalendarDateKey(getLocalCalendarDate(now));
  const hasFutureCreatedAt = isFiniteTimestamp(pet.createdAt) && pet.createdAt > now;
  const ageMs = Number.isFinite(pet.ageSeconds) ? Math.max(0, pet.ageSeconds) * 1000 : 0;
  const createdAt = hasFutureCreatedAt ? Math.max(0, now - ageMs) : pet.createdAt;
  const calendarAnchor = isFiniteTimestamp(createdAt) ? createdAt : now;
  const metDate = hasFutureCreatedAt || getCalendarDateKey(pet.metDate) > currentCalendarDateKey
    ? getLocalCalendarDate(calendarAnchor)
    : pet.metDate;
  const dailyWish = pet.dailyWish
    ? { ...pet.dailyWish, dateKey: rebaseFutureDateKey(pet.dailyWish.dateKey, currentDateKey) }
    : pet.dailyWish;
  const achievements = pet.achievements
    ? {
        ...pet.achievements,
        dailyStipendClaimDateKey: rebaseFutureDateKey(pet.achievements.dailyStipendClaimDateKey, currentDateKey),
        counters: pet.achievements.counters
          ? {
              ...pet.achievements.counters,
              companionYearActiveDateKeysByYear: Object.fromEntries(
                Object.entries(pet.achievements.counters.companionYearActiveDateKeysByYear ?? {}).map(([year, keys]) => [
                  year,
                  Array.from(new Set(keys.map((key) => rebaseFutureDateKey(key, currentDateKey)))),
                ]),
              ),
            }
          : pet.achievements.counters,
      }
    : pet.achievements;
  const garden = pet.garden
    ? {
        ...pet.garden,
        dailyCareDateKey: rebaseFutureDateKey(pet.garden.dailyCareDateKey, currentDateKey),
        dailyHarvestDateKey: rebaseFutureDateKey(pet.garden.dailyHarvestDateKey, currentDateKey),
        slots: Array.isArray(pet.garden.slots)
          ? pet.garden.slots.map((slot) => ({
              ...slot,
              lastWateredDateKey: rebaseFutureDateKey(slot.lastWateredDateKey, currentDateKey),
              lastFertilizedDateKey: rebaseFutureDateKey(slot.lastFertilizedDateKey, currentDateKey),
              lastBoostedDateKey: rebaseFutureDateKey(slot.lastBoostedDateKey, currentDateKey),
              dailyHarvestDateKey: rebaseFutureDateKey(slot.dailyHarvestDateKey, currentDateKey),
            }))
          : pet.garden.slots,
      }
    : pet.garden;
  const boostCards = pet.boostCards
    ? { ...pet.boostCards, dailyDateKey: rebaseFutureDateKey(pet.boostCards.dailyDateKey, currentDateKey) }
    : pet.boostCards;
  const partnerSchedule = pet.partnerSchedule
    ? {
        ...pet.partnerSchedule,
        boardDateKey: rebaseFutureDateKey(pet.partnerSchedule.boardDateKey, currentDateKey),
        offers: Array.isArray(pet.partnerSchedule.offers)
          ? pet.partnerSchedule.offers.map((offer) => ({
              ...offer,
              dateKey: rebaseFutureDateKey(offer.dateKey, currentDateKey),
            }))
          : pet.partnerSchedule.offers,
      }
    : pet.partnerSchedule;
  const goldenAppleGacha = pet.goldenAppleGacha
    ? { ...pet.goldenAppleGacha, dailyDateKey: rebaseFutureDateKey(pet.goldenAppleGacha.dailyDateKey, currentDateKey) }
    : pet.goldenAppleGacha;
  const pomodoro = pet.pomodoro
    ? { ...pet.pomodoro, dailyFocusDate: rebaseFutureDateKey(pet.pomodoro.dailyFocusDate, currentDateKey) }
    : pet.pomodoro;
  const yearlyStats = pet.yearlyStats
    ? {
        ...pet.yearlyStats,
        year: pet.yearlyStats.year > currentYear ? currentYear : pet.yearlyStats.year,
        activeDateKeys: Array.from(new Set(
          pet.yearlyStats.activeDateKeys.map((key) => rebaseFutureDateKey(key, currentDateKey)),
        )),
      }
    : pet.yearlyStats;

  return {
    ...pet,
    createdAt,
    metDate,
    dailyEncounterDateKey: rebaseFutureDateKey(pet.dailyEncounterDateKey, currentDateKey),
    neighborGiftDateKey: rebaseFutureDateKey(pet.neighborGiftDateKey, currentDateKey),
    dailyBiscuitClaimDate: rebaseFutureDateKey(pet.dailyBiscuitClaimDate, currentDateKey),
    dailyDiscountDate: rebaseFutureDateKey(pet.dailyDiscountDate, currentDateKey),
    dailyHeartExchangeDate: rebaseFutureDateKey(pet.dailyHeartExchangeDate, currentDateKey),
    dailyLoginRewardDateKey: rebaseFutureDateKey(pet.dailyLoginRewardDateKey, currentDateKey),
    dailyWish,
    achievements,
    garden,
    boostCards,
    partnerSchedule,
    goldenAppleGacha,
    pomodoro,
    yearlyStats,
    timeGuard: pet.timeGuard
      ? { ...pet.timeGuard, maxDailyDateKey: currentDateKey }
      : pet.timeGuard,
  };
};

export interface ReconciledPetClock {
  pet: PetState;
  rolledBackByMs: number;
  dailyDateRebased: boolean;
}

export const reconcilePetClock = (pet: PetState, now = Date.now()): ReconciledPetClock => {
  const guard = normalizeTimeGuardState(pet.timeGuard, pet, now);
  const offsetMs = now < guard.lastObservedAt ? now - guard.lastObservedAt : 0;
  const shifted = offsetMs < 0 ? shiftPetRuntimeTimestamps(pet, offsetMs) : pet;
  const currentDateKey = getDailyResetDateKey(now);
  const futureDailyLeadMs = Math.max(
    0,
    getDailyDateKeyTime(guard.maxDailyDateKey, now) - getDailyDateKeyTime(currentDateKey, now),
  );
  const dailyDateRebased = Math.max(-offsetMs, futureDailyLeadMs) > severeClockRollbackThresholdMs;
  const dateRebased = dailyDateRebased ? rebasePetFutureCalendarState(shifted, now) : shifted;
  return {
    pet: {
      ...dateRebased,
      timeGuard: {
        ...guard,
        lastObservedAt: now,
        maxDailyDateKey: dailyDateRebased
          ? currentDateKey
          : laterDailyDateKey(guard.maxDailyDateKey, currentDateKey),
      },
    },
    rolledBackByMs: Math.max(0, -offsetMs),
    dailyDateRebased,
  };
};
