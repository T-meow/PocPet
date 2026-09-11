import { t } from '../i18n';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import { ensureDailyWishForDate, maybeCreateReturnWelcome, returnWelcomeMinAwayMs } from './dailyWishes';
import { getAchievementEffects, incrementAchievementPomodoroFocus, incrementNaturalWake, recordEarnedCoins } from './achievements';
import { canClaimBoostCardDailyReward } from './boostCards';
import { advanceGarden } from './garden';
import { goldenAppleGachaDailyTicketLimit, resolveDailyGachaTicket } from './goldenAppleGacha';
import { getEffectiveDailyDateKey, reconcilePetClock } from './gameClock';
import { dailyBiscuitClaimLimit } from './items';
import { applyTimedEvent, getRandomDailyEncounter, getRandomOfflineDiary, getRandomOfflineEvent, maybeApplyDreamTalk, resetSleepSnapshot, startSleepSnapshot, wakePet } from './petEvents';
import { neighborGiftDailyLimit } from './neighbors';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetStat, criticalHungerActionThreshold, getEnergyRecoveryIntervalMs, getPetEnergyCap, getPetStatCap, getPetStatThreshold, lowEnergyThreshold, roundPetStatDisplayAmount, scalePetStatDelta } from './petStats';
import type { NeighborEventContext, PetState } from './petTypes';
import {
  getDefaultPomodoroRemainingMs,
  getPomodoroBonusReward,
  getPomodoroHourlyBaseCoins,
  getPomodoroMoodRewardBlocks,
  getPomodoroPhaseDurationMs,
  getPomodoroPhaseId,
  getPomodoroTargetBaseCoins,
  normalizePomodoroState,
  pickPomodoroActivity,
  pomodoroBonusRewardHourMs,
  pomodoroMinHealthThreshold,
} from './pomodoro';
import { normalizePet } from './petState';
import { advancePartnerSchedule, isPartnerSchedulePetBusy } from './partnerSchedule';
import { getCleanlinessDecaySeasonModifier, getMoodDecaySeasonModifier } from './season';
import { ensureYearlyStatsForDate, recordYearlyPomodoroFocus } from './yearlyStats';
import { getWeatherForDate } from './weather';
import { isNightTime } from './utils';

export const getEnergyRecoveryInfo = (pet: PetState, now = Date.now()) => {
  const current = normalizePet(pet, now);
  const energyCap = getPetEnergyCap(current);
  const intervalMs = getEnergyRecoveryIntervalMs(current, current.isSleeping, now);
  if (current.energy >= energyCap) {
    return { intervalMs, remainingMs: 0, isFull: true, isPaused: false };
  }

  if (isPartnerSchedulePetBusy(current)) {
    return { intervalMs, remainingMs: intervalMs, isFull: false, isPaused: true };
  }

  const startedAt = Math.min(current.lastEnergyRecoveryAt, now);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = intervalMs - (elapsedMs % intervalMs);

  return {
    intervalMs,
    remainingMs: remainingMs === intervalMs && elapsedMs > 0 ? 0 : remainingMs,
    isFull: false,
    isPaused: false,
  };
};









export const getDailyBiscuitClaimInfo = (pet: PetState, now = Date.now()) => {
  const dateKey = getEffectiveDailyDateKey(pet, now);
  const claimed =
    pet.dailyBiscuitClaimDate === dateKey
      ? Math.min(dailyBiscuitClaimLimit, clampCount(pet.dailyBiscuitClaims))
      : 0;

  return {
    claimed,
    limit: dailyBiscuitClaimLimit,
    canClaim: claimed < dailyBiscuitClaimLimit,
  };
};


export const isPetLowEnergy = (pet: PetState) => pet.energy < lowEnergyThreshold;

export const isPetCriticallyHungry = (pet: PetState) => pet.hunger < getPetStatThreshold(pet, criticalHungerActionThreshold);

export const canStartPomodoro = (pet: PetState) =>
  !isPetLowEnergy(pet) && pet.health > getPetStatThreshold(pet, pomodoroMinHealthThreshold);

export const pausePomodoroForReason = (pet: PetState, now: number, recentEvent: string): PetState => {
  if (!pet.pomodoro.isRunning) {
    return { ...pet, recentEvent };
  }

  const pausedRemainingMs = Math.max(0, pet.pomodoro.phaseEndsAt - now);

  return {
    ...pet,
    recentEvent,
    pomodoro: {
      ...pet.pomodoro,
      isRunning: false,
      phaseStartedAt: 0,
      phaseEndsAt: 0,
      pausedRemainingMs:
        pausedRemainingMs > 0 ? pausedRemainingMs : getDefaultPomodoroRemainingMs(pet.pomodoro.phase, pet.pomodoro.settings),
    },
  };
};

interface AdvancePomodoroOptions {
  historicalDateKeys?: boolean;
}

export const advancePomodoro = (
  pet: PetState,
  now = Date.now(),
  options: AdvancePomodoroOptions = {},
): PetState => {
  const persistedDailyFocusDate = normalizeLegacyDailyDateKey(pet.pomodoro.dailyFocusDate, now);
  const persistedDailyFocusCount = clampCount(pet.pomodoro.dailyCompletedFocusCount);
  let next = normalizePet(pet, now, { preserveMiniGameSession: true });
  let pomodoro = next.pomodoro;
  if (!pomodoro.isRunning) return next;
  if (persistedDailyFocusDate) {
    pomodoro = {
      ...pomodoro,
      dailyFocusDate: persistedDailyFocusDate,
      dailyCompletedFocusCount: persistedDailyFocusCount,
    };
  }

  let settledPhaseCount = 0;
  let settledFocusCount = 0;
  let settledShortBreakCount = 0;
  const settledFocusRecords: Array<{ settledAt: number; dateKey: string }> = [];
  let maxSettledDailyFocusCount = pomodoro.dailyCompletedFocusCount;
  let earnedCoins = 0;
  let earnedMood = 0;
  let earnedBonusCoins = 0;
  let rewardChanged = false;
  let autoStopped = false;
  let activity = pomodoro.currentActivity;
  const getSettlementDateKey = (time: number) => options.historicalDateKeys
    ? getDailyResetDateKey(time)
    : getEffectiveDailyDateKey(pet, time);
  const today = getSettlementDateKey(now);
  const maxSettlements = 1000;

  const settleFocusRewardsUntil = (focusUntil: number) => {
    if (!pomodoro.isRunning || pomodoro.phase !== 'focus' || pomodoro.phaseStartedAt <= 0) return;

    const phaseEnd = pomodoro.phaseEndsAt > 0 ? Math.min(focusUntil, pomodoro.phaseEndsAt) : focusUntil;
    const checkpoint = pomodoro.focusRewardCheckpointAt > 0 ? pomodoro.focusRewardCheckpointAt : pomodoro.phaseStartedAt;
    const rewardStart = Math.max(pomodoro.phaseStartedAt, checkpoint);
    const rewardEnd = Math.max(rewardStart, phaseEnd);
    const addedFocusMs = Math.max(0, rewardEnd - rewardStart);
    const sessionFocusMs = pomodoro.sessionFocusMs + addedFocusMs;
    const targetBaseCoins = getPomodoroTargetBaseCoins(sessionFocusMs, next.level);
    const baseCoins = Math.max(0, targetBaseCoins - pomodoro.baseRewardCoinsPaid);
    const hourlyBaseCoins = getPomodoroHourlyBaseCoins(next.level);
    const completedBonusHours = Math.floor(sessionFocusMs / pomodoroBonusRewardHourMs);
    let bonusRewardedHours = pomodoro.bonusRewardedHours;
    let bonusCoins = 0;

    while (bonusRewardedHours < completedBonusHours) {
      bonusRewardedHours += 1;
      bonusCoins += getPomodoroBonusReward(next, hourlyBaseCoins);
    }

    const moodRewardedBlocks = getPomodoroMoodRewardBlocks(sessionFocusMs);
    const mood = Math.max(0, moodRewardedBlocks - pomodoro.moodRewardedBlocks);

    if (baseCoins > 0 || bonusCoins > 0 || mood > 0) {
      rewardChanged = true;
      earnedCoins += baseCoins + bonusCoins + (baseCoins + bonusCoins > 0 ? getAchievementEffects(next).pomodoroCoinBonus : 0);
      earnedBonusCoins += bonusCoins;
      earnedMood += mood;
    }

    pomodoro = {
      ...pomodoro,
      focusRewardCheckpointAt: rewardEnd,
      sessionFocusMs,
      baseRewardCoinsPaid: targetBaseCoins,
      bonusRewardedHours,
      moodRewardedBlocks,
    };
  };

  while (pomodoro.isRunning && pomodoro.phaseEndsAt > 0 && pomodoro.phaseEndsAt <= now && settledPhaseCount < maxSettlements) {
    if (pomodoro.phase === 'focus') {
      settleFocusRewardsUntil(pomodoro.phaseEndsAt);
    }

    const phaseId = getPomodoroPhaseId(pomodoro);
    const shouldSettlePhase = pomodoro.lastSettledPhaseId !== phaseId;
    const phaseDateKey = getSettlementDateKey(pomodoro.phaseEndsAt);
    const completedFocusCount = pomodoro.phase === 'focus' ? pomodoro.completedFocusCount + 1 : pomodoro.completedFocusCount;
    const dailyCompletedFocusCount =
      pomodoro.phase === 'focus'
        ? (pomodoro.dailyFocusDate === phaseDateKey ? pomodoro.dailyCompletedFocusCount : 0) + 1
        : pomodoro.dailyFocusDate === phaseDateKey
          ? pomodoro.dailyCompletedFocusCount
          : 0;
    const nextStartedAt = pomodoro.phaseEndsAt;

    if (shouldSettlePhase) {
      settledPhaseCount += 1;
      settledFocusCount += pomodoro.phase === 'focus' ? 1 : 0;
      settledShortBreakCount += pomodoro.phase === 'short_break' ? 1 : 0;
      if (pomodoro.phase === 'focus') {
        settledFocusRecords.push({ settledAt: pomodoro.phaseEndsAt, dateKey: phaseDateKey });
        maxSettledDailyFocusCount = Math.max(maxSettledDailyFocusCount, dailyCompletedFocusCount);
      }
    }

    if (pomodoro.phase === 'short_break' && pomodoro.round >= pomodoro.settings.targetRounds) {
      autoStopped = true;
      pomodoro = {
        ...pomodoro,
        isRunning: false,
        phase: 'focus',
        phaseStartedAt: 0,
        phaseEndsAt: 0,
        round: 1,
        completedFocusCount,
        dailyFocusDate: phaseDateKey,
        dailyCompletedFocusCount,
        currentActivity: 'reading_books',
        lastSettledPhaseId: phaseId,
        pausedRemainingMs: getDefaultPomodoroRemainingMs('focus', pomodoro.settings),
        focusRewardCheckpointAt: 0,
      };
      break;
    }

    const nextPhase = pomodoro.phase === 'focus' ? 'short_break' : 'focus';
    const nextRound = pomodoro.phase === 'focus' ? pomodoro.round : Math.min(pomodoro.settings.targetRounds, pomodoro.round + 1);
    if (!next.isSleeping) {
      activity = pickPomodoroActivity();
    }
    pomodoro = {
      ...pomodoro,
      phase: nextPhase,
      phaseStartedAt: nextStartedAt,
      phaseEndsAt: nextStartedAt + getPomodoroPhaseDurationMs(nextPhase, pomodoro.settings),
      round: nextRound,
      completedFocusCount,
      dailyFocusDate: phaseDateKey,
      dailyCompletedFocusCount,
      currentActivity: activity,
      lastSettledPhaseId: phaseId,
      pausedRemainingMs: 0,
      focusRewardCheckpointAt: nextPhase === 'focus' ? nextStartedAt : 0,
    };
  }

  if (pomodoro.isRunning && pomodoro.phase === 'focus') {
    settleFocusRewardsUntil(now);
  }

  if (pomodoro.dailyFocusDate !== today) {
    pomodoro = { ...pomodoro, dailyFocusDate: today, dailyCompletedFocusCount: 0 };
  }

  const scaledEarnedMood = scalePetStatDelta(next, earnedMood);
  next = {
    ...next,
    coins: clampCoins(next.coins + earnedCoins),
    mood: clampPetStat(next, next.mood + scaledEarnedMood),
    pomodoro,
    recentActivity: !pomodoro.isRunning ? 'idle' : next.isSleeping ? next.recentActivity : activity,
    recentActivityUntil: !pomodoro.isRunning ? 0 : next.isSleeping ? next.recentActivityUntil : pomodoro.phaseEndsAt > now ? pomodoro.phaseEndsAt : 0,
    lastInteractionAt: now,
  };

  settledFocusRecords.forEach(({ settledAt, dateKey }) => {
    next = recordYearlyPomodoroFocus(next, 1, settledAt, dateKey);
  });
  next = ensureYearlyStatsForDate(next, now, today);
  next = recordEarnedCoins(
    incrementAchievementPomodoroFocus(next, settledFocusCount, maxSettledDailyFocusCount),
    earnedCoins,
  );

  if (settledPhaseCount > 0) {
    const parts = [
      settledFocusCount > 0 ? t('pet.pomodoro.phaseCount.focus', { count: settledFocusCount }) : '',
      settledShortBreakCount > 0 ? t('pet.pomodoro.phaseCount.short_break', { count: settledShortBreakCount }) : '',
    ].filter(Boolean);
    const prefix = settledPhaseCount === 1 ? t('pet.pomodoro.completePrefix') : t('pet.pomodoro.offlineSettlePrefix');
    const bonusText = earnedBonusCoins > 0 ? t('pet.pomodoro.bonusEvent', { coins: earnedBonusCoins }) : '';
    const autoStopText = autoStopped ? t('pet.pomodoro.autoStopped', { rounds: pomodoro.settings.targetRounds }) : '';
    next = {
      ...next,
      recentEvent: t('pet.pomodoro.settlementEvent', { prefix, parts: parts.join(t('common.comma')), mood: roundPetStatDisplayAmount(scaledEarnedMood), coins: earnedCoins }) + bonusText + autoStopText,
    };
  } else if (rewardChanged) {
    const minutes = Math.floor(pomodoro.sessionFocusMs / 60000);
    const bonusText = earnedBonusCoins > 0 ? t('pet.pomodoro.bonusEvent', { coins: earnedBonusCoins }) : '';
    next = {
      ...next,
      recentEvent: t('pet.pomodoro.rewardTick', { minutes, mood: roundPetStatDisplayAmount(scaledEarnedMood), coins: earnedCoins }) + bonusText,
    };
  }

  if (next.pomodoro.isRunning && isPetLowEnergy(next)) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowEnergy', { name: next.name }));
  }

  if (next.pomodoro.isRunning && next.health <= getPetStatThreshold(next, pomodoroMinHealthThreshold)) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowHealth', { name: next.name }));
  }

  return next;
};

const applyDailyEncounter = (pet: PetState, now: number, eventContext?: NeighborEventContext): PetState => {
  const dateKey = getEffectiveDailyDateKey(pet, now);
  if (pet.dailyEncounterDateKey === dateKey) return pet;

  const giftCount = pet.neighborGiftDateKey === dateKey ? pet.neighborGiftCount : 0;
  const randomGiftLimit = canClaimBoostCardDailyReward(pet, now) ? neighborGiftDailyLimit - 1 : neighborGiftDailyLimit;
  const encounter = getRandomDailyEncounter(pet.name, eventContext, giftCount < randomGiftLimit);
  const settled = applyTimedEvent(pet, encounter, now, t('pet.prefix.dailyEncounter'));
  return resolveDailyGachaTicket(settled, 'daily_encounter', 20, now).pet;
};

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const autoSleepIdleMs = 30 * minuteMs;
const runningPomodoroSliceMs = 5 * minuteMs;
const maxLifecycleSlices = 60_000;

const getPressureCount = (pet: PetState) => [
  pet.hunger <= getPetStatThreshold(pet, 18),
  pet.cleanliness <= getPetStatThreshold(pet, 22),
  pet.mood <= getPetStatThreshold(pet, 18),
].filter(Boolean).length;

const withWeatherForTime = (pet: PetState, time: number): PetState => {
  const weatherDate = getDailyResetDateKey(time);
  const weather = getWeatherForDate(time);
  return pet.weatherDate === weatherDate && pet.weather === weather
    ? pet
    : { ...pet, weatherDate, weather };
};

const getNextLocalHour = (time: number, hour: number) => {
  const current = new Date(time);
  const next = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    hour,
    0,
    0,
    0,
  );
  if (next.getTime() <= time) next.setDate(next.getDate() + 1);
  return next.getTime();
};

const getNextCalendarBoundary = (time: number) => Math.min(
  getNextLocalHour(time, 0),
  getNextLocalHour(time, 5),
  getNextLocalHour(time, 7),
  getNextLocalHour(time, 22),
);

interface LifecycleRates {
  hunger: number;
  mood: number;
  cleanliness: number;
  health: number;
}

const getLifecycleRates = (pet: PetState, time: number): LifecycleRates => {
  const pressure = getPressureCount(pet);
  const weatherMoodModifier = pet.weather === 'sunny' ? 0.75 : 1;
  const weatherCleanlinessModifier = pet.weather === 'rainy' ? 1.3 : 1;
  return {
    hunger: scalePetStatDelta(pet, pet.isSleeping ? -2 : -7),
    mood: scalePetStatDelta(pet, pet.isSleeping
      ? 2
      : -(pressure > 0 ? 5 : 2) * weatherMoodModifier * getMoodDecaySeasonModifier(time)),
    cleanliness: scalePetStatDelta(pet, pet.isSleeping
      ? -1
      : -4 * weatherCleanlinessModifier * getCleanlinessDecaySeasonModifier(time)),
    health: scalePetStatDelta(pet,
      pressure >= 2
        ? -4
        : pressure === 0 && pet.health < getPetStatCap(pet)
          ? 1.5
          : 0),
  };
};

const getThresholdCrossingAt = (value: number, ratePerHour: number, threshold: number, time: number) => {
  if (ratePerHour < 0 && value > threshold) {
    return time + Math.max(1, Math.ceil(((value - threshold) / -ratePerHour) * hourMs));
  }
  if (ratePerHour > 0 && value <= threshold) {
    return time + Math.max(1, Math.floor(((threshold - value) / ratePerHour) * hourMs) + 1);
  }
  return Number.POSITIVE_INFINITY;
};

const getNextPressureBoundary = (pet: PetState, time: number, rates: LifecycleRates) => Math.min(
  getThresholdCrossingAt(pet.hunger, rates.hunger, getPetStatThreshold(pet, 18), time),
  getThresholdCrossingAt(pet.cleanliness, rates.cleanliness, getPetStatThreshold(pet, 22), time),
  getThresholdCrossingAt(pet.mood, rates.mood, getPetStatThreshold(pet, 18), time),
);

const recoverEnergyUntil = (pet: PetState, time: number, intervalTime = time): PetState => {
  const energyCap = getPetEnergyCap(pet);
  if (pet.energy >= energyCap) {
    return pet.lastEnergyRecoveryAt === time ? pet : { ...pet, lastEnergyRecoveryAt: time };
  }

  const intervalMs = getEnergyRecoveryIntervalMs(pet, pet.isSleeping, intervalTime);
  const recoveryStartedAt = Math.min(pet.lastEnergyRecoveryAt, time);
  const elapsedMs = Math.max(0, time - recoveryStartedAt);
  const recovered = Math.min(energyCap - pet.energy, Math.floor(elapsedMs / intervalMs));
  if (recovered <= 0) return pet;

  const energy = clampPetEnergy(pet, pet.energy + recovered);
  return {
    ...pet,
    energy,
    lastEnergyRecoveryAt: energy >= energyCap
      ? time
      : time - (elapsedMs % intervalMs),
  };
};

const getNextEnergyRecoveryAt = (pet: PetState, time: number) => {
  if (pet.energy >= getPetEnergyCap(pet)) return Number.POSITIVE_INFINITY;
  const intervalMs = getEnergyRecoveryIntervalMs(pet, pet.isSleeping, time);
  const recoveryStartedAt = Math.min(pet.lastEnergyRecoveryAt, time);
  const elapsedMs = Math.max(0, time - recoveryStartedAt);
  const remainderMs = elapsedMs % intervalMs;
  return time + (remainderMs === 0 ? intervalMs : intervalMs - remainderMs);
};

const advanceUnprotectedSlice = (
  pet: PetState,
  from: number,
  to: number,
  rates: LifecycleRates,
): PetState => {
  const elapsedHours = (to - from) / hourMs;
  const advanced: PetState = {
    ...pet,
    hunger: clampPetStat(pet, pet.hunger + rates.hunger * elapsedHours),
    mood: clampPetStat(pet, pet.mood + rates.mood * elapsedHours),
    cleanliness: clampPetStat(pet, pet.cleanliness + rates.cleanliness * elapsedHours),
    health: clampPetHealth(pet, pet.health + rates.health * elapsedHours),
    ageSeconds: pet.ageSeconds + (to - from) / 1000,
    lastUpdatedAt: to,
  };
  return recoverEnergyUntil(advanced, to, from);
};

const advanceProtectedSlice = (pet: PetState, from: number, to: number): PetState => {
  const elapsedMs = to - from;
  const energyCap = getPetEnergyCap(pet);
  return {
    ...pet,
    ageSeconds: pet.ageSeconds + elapsedMs / 1000,
    lastUpdatedAt: to,
    lastEnergyRecoveryAt: pet.energy >= energyCap
      ? to
      : Math.min(to, pet.lastEnergyRecoveryAt + elapsedMs),
  };
};

export const advancePet = (pet: PetState, now = Date.now(), eventContext?: NeighborEventContext): PetState => {
  const clockReconciled = reconcilePetClock(pet, now);
  const useHistoricalDateKeys = clockReconciled.rolledBackByMs === 0;
  const normalized = normalizePet(clockReconciled.pet, now, { preserveExpiredPartnerSchedule: true, preserveMiniGameSession: true });
  const simulationStartedAt = Math.min(normalized.lastUpdatedAt, now);
  const normalizedForSimulation = useHistoricalDateKeys && clockReconciled.pet.pomodoro?.isRunning
    ? {
        ...normalized,
        pomodoro: normalizePomodoroState(
          clockReconciled.pet.pomodoro,
          simulationStartedAt,
          getDailyResetDateKey(simulationStartedAt),
        ),
      }
    : normalized;
  const prepared = advanceGarden(ensureDailyWishForDate(normalizedForSimulation, now), now);
  const scheduleForInterval = prepared.partnerSchedule.active;
  const intervalStartedAt = Math.min(prepared.lastUpdatedAt, now);
  const deltaMs = Math.max(0, now - intervalStartedAt);
  const getProtectedScheduleMs = (from: number, to: number) => {
    if (!scheduleForInterval || to <= from) return 0;
    const overlapStart = Math.max(from, scheduleForInterval.startedAt);
    const overlapEnd = Math.min(to, scheduleForInterval.endsAt);
    return Math.max(0, overlapEnd - overlapStart);
  };
  const lifecycleDeltaMs = Math.max(0, deltaMs - getProtectedScheduleMs(intervalStartedAt, now));
  const pomodoroWasRunning = prepared.pomodoro.isRunning;
  const pomodoroAdvanceOptions: AdvancePomodoroOptions = { historicalDateKeys: useHistoricalDateKeys };

  if (deltaMs < 1000) {
    const current = withWeatherForTime(advancePartnerSchedule(prepared, now), now);
    return ensureYearlyStatsForDate(advancePomodoro(
      current.pomodoro.isRunning ? { ...current, lastInteractionAt: now } : current,
      now,
      pomodoroAdvanceOptions,
    ), now);
  }

  let next = prepared;
  let cursor = intervalStartedAt;
  let sliceCount = 0;
  let naturalWakeSettlementUsed = false;
  let didNaturalWake = false;
  let lastAutoSleepAt = 0;
  let lastNaturalWakeAt = 0;

  if (next.pomodoro.isRunning) next = advancePomodoro(next, cursor, pomodoroAdvanceOptions);

  const isScheduleProtectedAt = (time: number) => Boolean(
    scheduleForInterval
    && time >= scheduleForInterval.startedAt
    && time < scheduleForInterval.endsAt,
  );

  const applyImmediateStateChanges = (time: number) => {
    next = withWeatherForTime(next, time);
    if (next.partnerSchedule.active && time >= next.partnerSchedule.active.endsAt) {
      next = advancePartnerSchedule(next, time);
    }
    if (isScheduleProtectedAt(time)) return;

    next = recoverEnergyUntil(next, time);
    let transitionCount = 0;
    while (transitionCount < 3) {
      transitionCount += 1;
      const idleAtNight = isNightTime(time) && time - next.lastInteractionAt >= autoSleepIdleMs;
      if (!next.isSleeping && !next.pomodoro.isRunning && idleAtNight) {
        next = startSleepSnapshot({
          ...next,
          isSleeping: true,
          recentEvent: t('pet.advance.autoSleep', { name: next.name }),
        }, time);
        lastAutoSleepAt = time;
        next = recoverEnergyUntil(next, time);
        continue;
      }

      if (next.isSleeping && next.energy >= getPetEnergyCap(next) && !idleAtNight) {
        if (!naturalWakeSettlementUsed) {
          next = incrementNaturalWake(wakePet(next, time));
          naturalWakeSettlementUsed = true;
        } else {
          next = resetSleepSnapshot({
            ...next,
            isSleeping: false,
            recentEvent: t('pet.advance.wokeUp', { name: next.name }),
          });
        }
        didNaturalWake = true;
        lastNaturalWakeAt = time;
        continue;
      }
      break;
    }
  };

  while (cursor < now && sliceCount < maxLifecycleSlices) {
    applyImmediateStateChanges(cursor);
    const protectedBySchedule = isScheduleProtectedAt(cursor);
    const rates = protectedBySchedule ? undefined : getLifecycleRates(next, cursor);
    let sliceEndsAt = Math.min(now, getNextCalendarBoundary(cursor));

    if (scheduleForInterval) {
      if (cursor < scheduleForInterval.startedAt) {
        sliceEndsAt = Math.min(sliceEndsAt, scheduleForInterval.startedAt);
      } else if (cursor < scheduleForInterval.endsAt) {
        sliceEndsAt = Math.min(sliceEndsAt, scheduleForInterval.endsAt);
      }
    }

    if (!protectedBySchedule && rates) {
      sliceEndsAt = Math.min(
        sliceEndsAt,
        getNextPressureBoundary(next, cursor, rates),
        getNextEnergyRecoveryAt(next, cursor),
      );
      if (next.pomodoro.isRunning) {
        sliceEndsAt = Math.min(
          sliceEndsAt,
          getThresholdCrossingAt(
            next.health,
            rates.health,
            getPetStatThreshold(next, pomodoroMinHealthThreshold),
            cursor,
          ),
        );
      }
      if (!next.isSleeping && !next.pomodoro.isRunning && isNightTime(cursor)) {
        const idleThresholdAt = next.lastInteractionAt + autoSleepIdleMs;
        if (idleThresholdAt > cursor) sliceEndsAt = Math.min(sliceEndsAt, idleThresholdAt);
      }
    }
    if (next.pomodoro.isRunning) {
      sliceEndsAt = Math.min(sliceEndsAt, cursor + runningPomodoroSliceMs);
      if (next.pomodoro.phaseEndsAt > cursor) {
        sliceEndsAt = Math.min(sliceEndsAt, next.pomodoro.phaseEndsAt);
      }
    }

    if (!Number.isFinite(sliceEndsAt) || sliceEndsAt <= cursor) {
      sliceEndsAt = Math.min(now, cursor + 1);
    }

    next = protectedBySchedule
      ? advanceProtectedSlice(next, cursor, sliceEndsAt)
      : advanceUnprotectedSlice(next, cursor, sliceEndsAt, rates!);
    cursor = sliceEndsAt;
    sliceCount += 1;
    if (next.pomodoro.isRunning) {
      next = advancePomodoro(next, cursor, pomodoroAdvanceOptions);
    }
  }

  // Corrupt or centuries-old timestamps cannot keep the UI in an unbounded loop.
  // Normal saves, including a ten-year gap, remain below the exact-slice limit.
  if (cursor < now) {
    applyImmediateStateChanges(cursor);
    const protectedBySchedule = isScheduleProtectedAt(cursor);
    next = protectedBySchedule
      ? advanceProtectedSlice(next, cursor, now)
      : advanceUnprotectedSlice(next, cursor, now, getLifecycleRates(next, cursor));
    cursor = now;
    if (next.pomodoro.isRunning) next = advancePomodoro(next, now, pomodoroAdvanceOptions);
  }

  applyImmediateStateChanges(now);
  next = advancePartnerSchedule(withWeatherForTime(next, now), now);
  next = ensureYearlyStatsForDate(
    next,
    now,
    useHistoricalDateKeys ? getDailyResetDateKey(now) : undefined,
  );
  next = {
    ...next,
    lastUpdatedAt: now,
    recentActivity: next.recentActivityUntil > now ? next.recentActivity : 'idle',
    recentActivityUntil: next.recentActivityUntil > now ? next.recentActivityUntil : 0,
  };

  const pressure = getPressureCount(next);
  const offlineDiaryDue = !pomodoroWasRunning && lifecycleDeltaMs >= 30 * minuteMs;
  const offlineEventDue = !pomodoroWasRunning && lifecycleDeltaMs >= 2 * hourMs;
  if (!didNaturalWake && lastAutoSleepAt > lastNaturalWakeAt) {
    next = { ...next, recentEvent: t('pet.advance.autoSleep', { name: next.name }) };
  } else if (!didNaturalWake && offlineDiaryDue) {
    next = { ...next, recentEvent: t('pet.prefix.offlineDiary') + getRandomOfflineDiary(next.name, next.weather) };
  } else if (!didNaturalWake && next.hunger <= getPetStatThreshold(next, 10)) {
    next = { ...next, recentEvent: t('pet.advance.hungerCritical', { name: next.name }) };
  } else if (!didNaturalWake && pressure >= 2) {
    next = { ...next, recentEvent: t('pet.advance.needsCare', { name: next.name }) };
  }

  next = maybeApplyDreamTalk(next, now);

  if (!pomodoroWasRunning && deltaMs >= returnWelcomeMinAwayMs) {
    const withReturnWelcome = maybeCreateReturnWelcome(next, deltaMs, now);
    if (withReturnWelcome.returnWelcome && !withReturnWelcome.returnWelcome.claimedAt) {
      return withReturnWelcome;
    }
    next = withReturnWelcome;
  }

  if (next.partnerSchedule.active || didNaturalWake) {
    return next;
  }

  if (offlineEventDue) {
    const effectiveDateKey = getEffectiveDailyDateKey(next, now);
    const giftCount = next.neighborGiftDateKey === effectiveDateKey ? next.neighborGiftCount : 0;
    const randomGiftLimit = canClaimBoostCardDailyReward(next, now) ? neighborGiftDailyLimit - 1 : neighborGiftDailyLimit;
    return applyTimedEvent(
      next,
      getRandomOfflineEvent(next.name, next.weather, eventContext, {
        allowNeighborGift: giftCount < randomGiftLimit,
        allowGachaTicket: next.goldenAppleGacha.dailyTicketsGranted < goldenAppleGachaDailyTicketLimit
          && next.goldenAppleGacha.tickets < 9999,
      }),
      now,
      t('pet.prefix.offlineEvent'),
    );
  }

  if (offlineDiaryDue) {
    return next;
  }

  return applyDailyEncounter(next, now, eventContext);
};

