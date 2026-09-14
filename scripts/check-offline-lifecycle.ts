import assert from 'node:assert/strict';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { advancePet } from '../src/core/petLifecycle';
import { partnerScheduleDefinitions } from '../src/core/partnerSchedule';
import { createDefaultPet } from '../src/core/petState';
import { getEnergyRecoveryIntervalMs, getPetStatCap } from '../src/core/petStats';
import type { PetState } from '../src/core/petTypes';
import { getWeatherForDate } from '../src/core/weather';

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const localTime = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
const closeTo = (actual: number, expected: number, tolerance: number, message: string) =>
  assert(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
const basePet = (start: number, overrides: Partial<PetState> = {}): PetState => ({
  ...createDefaultPet(start),
  lastUpdatedAt: start,
  lastInteractionAt: start,
  lastEnergyRecoveryAt: start,
  weatherDate: getDailyResetDateKey(start),
  weather: getWeatherForDate(start),
  ...overrides,
});
const advanceByMinutes = (pet: PetState, start: number, end: number) => {
  let next = pet;
  for (let time = start + minuteMs; time < end; time += minuteMs) {
    next = advancePet(next, time);
  }
  return advancePet(next, end);
};
const assertCoreStatsClose = (left: PetState, right: PetState, message: string) => {
  closeTo(left.hunger, right.hunger, 1e-6, `${message} hunger`);
  closeTo(left.mood, right.mood, 1e-6, `${message} mood`);
  closeTo(left.cleanliness, right.cleanliness, 1e-6, `${message} cleanliness`);
  closeTo(left.health, right.health, 1e-6, `${message} health`);
  assert.equal(left.energy, right.energy, `${message} energy`);
};

const originalRandom = Math.random;
Math.random = () => 0.123456789;

try {
  const pressureStart = localTime(2026, 7, 23, 12);
  const pressureEnd = pressureStart + 20 * minuteMs;
  const pressurePet = basePet(pressureStart, {
    hunger: 19,
    cleanliness: 23,
    mood: 19,
    health: 50,
    energy: getPetStatCap(1),
  });
  const pressureOneShot = advancePet(pressurePet, pressureEnd);
  const pressureStepped = advanceByMinutes(pressurePet, pressureStart, pressureEnd);
  assertCoreStatsClose(pressureOneShot, pressureStepped, 'pressure threshold slicing');
  assert(pressureOneShot.health < 50.5, 'health must switch from recovery to pressure decay during the interval');

  const resetStart = localTime(2026, 7, 24, 4, 50);
  const resetEnd = localTime(2026, 7, 24, 5, 19);
  const resetPet = basePet(resetStart, { energy: 0 });
  const resetOneShot = advancePet(resetPet, resetEnd);
  const resetStepped = advanceByMinutes(resetPet, resetStart, resetEnd);
  assertCoreStatsClose(resetOneShot, resetStepped, '05:00 reset slicing');
  assert.equal(resetOneShot.weatherDate, getDailyResetDateKey(resetEnd));
  assert.equal(resetOneShot.weather, getWeatherForDate(resetEnd));

  const midnightStart = localTime(2026, 5, 31, 23, 50);
  const midnightEnd = localTime(2026, 6, 1, 0, 10);
  const midnightPet = basePet(midnightStart, { energy: 0 });
  const midnightOneShot = advancePet(midnightPet, midnightEnd);
  const midnightStepped = advanceByMinutes(midnightPet, midnightStart, midnightEnd);
  assertCoreStatsClose(midnightOneShot, midnightStepped, 'midnight and season slicing');

  const sleepStart = localTime(2026, 7, 24, 21, 40);
  const sleepEnd = localTime(2026, 7, 25, 7, 30);
  const sleepPet = basePet(sleepStart, {
    energy: 90,
    lastInteractionAt: localTime(2026, 7, 24, 21),
  });
  const naturalWakeCountBefore = sleepPet.achievements.counters.naturalWakeCount;
  const slept = advancePet(sleepPet, sleepEnd);
  assert.equal(slept.isSleeping, false, 'pet must wake after the 07:00 boundary');
  assert.equal(slept.sleepStartedAt, 0, 'waking clears the sleep snapshot');
  assert.equal(slept.achievements.counters.naturalWakeCount, naturalWakeCountBefore + 1);
  closeTo(slept.ageSeconds, (sleepEnd - sleepStart) / 1000, 1e-6, 'wall-clock age includes the full interval');

  const pomodoroStart = localTime(2026, 7, 25, 21, 30);
  const pomodoroFocusEnd = pomodoroStart + 30 * minuteMs;
  const pomodoroEnd = localTime(2026, 7, 25, 22, 40);
  const pomodoroBase = basePet(pomodoroStart, { energy: 50 });
  const pomodoroPet: PetState = {
    ...pomodoroBase,
    pomodoro: {
      ...pomodoroBase.pomodoro,
      isRunning: true,
      phase: 'focus',
      phaseStartedAt: pomodoroStart,
      phaseEndsAt: pomodoroFocusEnd,
      pausedRemainingMs: 0,
      focusRewardCheckpointAt: pomodoroStart,
      settings: { focusMinutes: 30, shortBreakMinutes: 5, targetRounds: 1 },
    },
  };
  const pomodoroAdvanced = advancePet(pomodoroPet, pomodoroEnd);
  assert.equal(pomodoroAdvanced.pomodoro.isRunning, false, 'completed target rounds must auto-stop');
  assert.equal(pomodoroAdvanced.pomodoro.completedFocusCount, 1);
  assert.equal(pomodoroAdvanced.isSleeping, true, 'pet must auto-sleep 30 minutes after Pomodoro stops at night');
  assert.equal(pomodoroAdvanced.sleepStartedAt, localTime(2026, 7, 25, 22, 35));
  assert(pomodoroAdvanced.coins > pomodoroPet.coins, 'offline focus time must still grant rewards');

  const makeResetBoundaryPomodoro = (start: number) => {
    const base = basePet(start, { energy: getPetStatCap(1) });
    return {
      ...base,
      pomodoro: {
        ...base.pomodoro,
        isRunning: true,
        phase: 'focus' as const,
        phaseStartedAt: start,
        phaseEndsAt: start + 5 * minuteMs,
        pausedRemainingMs: 0,
        focusRewardCheckpointAt: start,
        settings: { focusMinutes: 5, shortBreakMinutes: 1, targetRounds: 2 },
      },
    };
  };

  const dailyBoundaryStart = localTime(2026, 7, 26, 4, 53);
  const dailyBoundaryEnd = localTime(2026, 7, 26, 5, 6);
  const dailyBoundaryAdvanced = advancePet(makeResetBoundaryPomodoro(dailyBoundaryStart), dailyBoundaryEnd);
  assert.equal(dailyBoundaryAdvanced.pomodoro.completedFocusCount, 2);
  assert.equal(dailyBoundaryAdvanced.pomodoro.dailyFocusDate, getDailyResetDateKey(dailyBoundaryEnd));
  assert.equal(
    dailyBoundaryAdvanced.pomodoro.dailyCompletedFocusCount,
    1,
    'focus phases on opposite sides of 05:00 belong to different logical days',
  );
  assert.equal(
    dailyBoundaryAdvanced.achievements.counters.bestDailyPomodoroFocusCount,
    1,
    '05:00 offline settlement must not collapse both focus phases into the final day',
  );

  const yearlyBoundaryStart = localTime(2026, 1, 1, 4, 53);
  const yearlyBoundaryEnd = localTime(2026, 1, 1, 5, 6);
  const yearlyBoundaryAdvanced = advancePet(makeResetBoundaryPomodoro(yearlyBoundaryStart), yearlyBoundaryEnd);
  assert.equal(yearlyBoundaryAdvanced.pendingYearReview?.year, 2025);
  assert.equal(
    yearlyBoundaryAdvanced.pendingYearReview?.pomodoroFocusCount,
    1,
    'the pre-05:00 focus phase belongs to the previous yearly review',
  );
  assert.equal(yearlyBoundaryAdvanced.yearlyStats.year, 2026);
  assert.equal(
    yearlyBoundaryAdvanced.yearlyStats.pomodoroFocusCount,
    1,
    'the post-05:00 focus phase belongs to the new year',
  );

  const scheduleStart = localTime(2026, 7, 27, 12);
  const scheduleEnd = scheduleStart + 80 * minuteMs;
  const scheduleDefinition = partnerScheduleDefinitions.find((definition) => definition.size === 'short');
  assert(scheduleDefinition);
  const scheduleBase = basePet(scheduleStart, {
    level: 3,
    hunger: 100,
    mood: 100,
    cleanliness: 100,
    health: 100,
    energy: 0,
  });
  const protectedStart = scheduleStart + 10 * minuteMs;
  const protectedEnd = protectedStart + scheduleDefinition.durationMinutes * minuteMs;
  const scheduled: PetState = {
    ...scheduleBase,
    partnerSchedule: {
      ...scheduleBase.partnerSchedule,
      active: {
        offerId: 'offline-lifecycle-check',
        templateId: scheduleDefinition.id,
        category: scheduleDefinition.category,
        size: scheduleDefinition.size,
        startedAt: protectedStart,
        endsAt: protectedEnd,
        coinReward: 30,
        skillXp: 2,
        trophyRewardMultiplier: 1,
        grantsMasterCompletion: false,
        legacyPrepaid: true, // Isolate natural decay from the already paid service costs.
      },
    },
  };
  const scheduleAdvanced = advancePet(scheduled, scheduleEnd);
  const unprotectedMinutes = (scheduleEnd - scheduleStart - (protectedEnd - protectedStart)) / minuteMs;
  const expectedHunger = 100 - 7 * (getPetStatCap(3) / 100) * (unprotectedMinutes / 60);
  closeTo(scheduleAdvanced.hunger, expectedHunger, 1e-6, 'schedule protects lifecycle stat decay');
  const recoveryInterval = getEnergyRecoveryIntervalMs(scheduleBase, false, scheduleStart);
  assert.equal(
    scheduleAdvanced.energy,
    Math.floor((unprotectedMinutes * minuteMs) / recoveryInterval),
    'schedule pauses energy recovery without discarding partial progress',
  );
  assert.equal(scheduleAdvanced.partnerSchedule.active, undefined);
  assert(scheduleAdvanced.partnerSchedule.pendingResult, 'schedule completion must settle at its exact end');

  const multiNightStart = localTime(2026, 7, 28, 12);
  const multiNightEnd = localTime(2026, 7, 31, 23);
  const multiNightPet = basePet(multiNightStart, {
    energy: 0,
    lastInteractionAt: multiNightStart - hourMs,
  });
  const multiNightWakeCount = multiNightPet.achievements.counters.naturalWakeCount;
  const multiNightAdvanced = advancePet(multiNightPet, multiNightEnd);
  assert.equal(multiNightAdvanced.isSleeping, true);
  assert.equal(multiNightAdvanced.sleepStartedAt, localTime(2026, 7, 31, 22));
  assert.equal(
    multiNightAdvanced.achievements.counters.naturalWakeCount,
    multiNightWakeCount + 1,
    'one advancePet call may settle natural-wake side effects only once',
  );

  const longStart = localTime(2016, 1, 1, 12);
  const longEnd = localTime(2026, 1, 1, 12);
  const longPet = basePet(longStart, { energy: 0, lastInteractionAt: longStart - hourMs });
  const longAdvanced = advancePet(longPet, longEnd);
  assert.equal(longAdvanced.lastUpdatedAt, longEnd);
  assert(Number.isFinite(longAdvanced.hunger) && Number.isFinite(longAdvanced.health));
  closeTo(longAdvanced.ageSeconds, (longEnd - longStart) / 1000, 1e-6, 'ten-year age settlement');

  console.log('offline lifecycle checks passed');
} finally {
  Math.random = originalRandom;
}
