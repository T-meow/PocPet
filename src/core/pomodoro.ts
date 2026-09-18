import { t } from '../i18n';
import { getDailyResetDateKey, normalizeLegacyDailyDateKey } from './dailyReset';
import type { PetState, PomodoroActivity, PomodoroDurations, PomodoroPhase, PomodoroState } from './petTypes';
import { clampCount, getPetStatCap } from './petStats';
import { isNumber, pickRandom, randomInt } from './utils';

export const pomodoroPhaseLabels: Record<PomodoroPhase, string> = {
  focus: t('pet.pomodoro.phase.focus'),
  short_break: t('pet.pomodoro.phase.short_break'),
};

export const pomodoroMinHealthThreshold = 35;
export const pomodoroRewardBlockMs = 5 * 60 * 1000;
export const pomodoroMoodRewardBlockMs = 30 * 60 * 1000;
export const pomodoroBonusRewardHourMs = 60 * 60 * 1000;
export const pomodoroResetEventMinFocusMs = 60 * 60 * 1000;
export const pomodoroCoinRewardMultiplier = 1;

export const defaultPomodoroDurations: PomodoroDurations = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  targetRounds: 2,
};

export const pomodoroActivities: readonly PomodoroActivity[] = ['reading_books', 'workout', 'work_food', 'work_plants'];

export const isPomodoroPhase = (value: unknown): value is PomodoroPhase =>
  value === 'focus' || value === 'short_break';

export const normalizePomodoroPhase = (value: unknown): PomodoroPhase =>
  value === 'short_break' || value === 'long_break' ? 'short_break' : 'focus';

export const isPomodoroActivity = (value: unknown): value is PomodoroActivity =>
  typeof value === 'string' && pomodoroActivities.includes(value as PomodoroActivity);

export const clampPomodoroInteger = (value: unknown, fallback: number, min: number, max: number) => {
  if (!isNumber(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
};

export const normalizePomodoroSettings = (value: unknown): PomodoroDurations => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    focusMinutes: clampPomodoroInteger(raw.focusMinutes, defaultPomodoroDurations.focusMinutes, 1, 180),
    shortBreakMinutes: clampPomodoroInteger(raw.shortBreakMinutes, defaultPomodoroDurations.shortBreakMinutes, 1, 60),
    targetRounds: clampPomodoroInteger(raw.targetRounds, defaultPomodoroDurations.targetRounds, 1, 8),
  };
};

export const getPomodoroPhaseDurationMs = (phase: PomodoroPhase, settings: PomodoroDurations) => {
  const minutes = phase === 'focus' ? settings.focusMinutes : settings.shortBreakMinutes;
  return minutes * 60 * 1000;
};

export const getPomodoroPhaseId = (pomodoro: PomodoroState) =>
  [pomodoro.phase, pomodoro.phaseStartedAt, pomodoro.phaseEndsAt, pomodoro.completedFocusCount].join(':');

export const getDefaultPomodoroRemainingMs = (phase: PomodoroPhase, settings: PomodoroDurations) =>
  getPomodoroPhaseDurationMs(phase, settings);

export const defaultPomodoroState = (now: number): PomodoroState => ({
  isRunning: false,
  phase: 'focus',
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  round: 1,
  completedFocusCount: 0,
  dailyFocusDate: getDailyResetDateKey(now),
  dailyCompletedFocusCount: 0,
  settings: { ...defaultPomodoroDurations },
  currentActivity: 'reading_books',
  lastSettledPhaseId: '',
  pausedRemainingMs: getPomodoroPhaseDurationMs('focus', defaultPomodoroDurations),
  focusRewardCheckpointAt: 0,
  sessionFocusMs: 0,
  baseRewardCoinsPaid: 0,
  bonusRewardedHours: 0,
  moodRewardedBlocks: 0,
  hasTriggeredSessionResetEvent: false,
});

export const normalizePomodoroState = (
  value: unknown,
  now: number,
  effectiveDateKey = getDailyResetDateKey(now),
): PomodoroState => {
  const fallback = defaultPomodoroState(now);
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Record<string, unknown>;
  const settings = normalizePomodoroSettings(raw.settings);
  const phase = normalizePomodoroPhase(raw.phase);
  const isRunning = Boolean(raw.isRunning);
  const phaseStartedAt = isNumber(raw.phaseStartedAt) && raw.phaseStartedAt > 0 ? raw.phaseStartedAt : 0;
  const defaultRemainingMs = getDefaultPomodoroRemainingMs(phase, settings);
  const rawPausedRemainingMs = isNumber(raw.pausedRemainingMs) ? Math.max(0, Math.round(raw.pausedRemainingMs)) : 0;
  const phaseEndsAt =
    isRunning && isNumber(raw.phaseEndsAt) && raw.phaseEndsAt > 0
      ? raw.phaseEndsAt
      : isRunning
        ? now + (rawPausedRemainingMs > 0 ? rawPausedRemainingMs : defaultRemainingMs)
        : 0;
  const currentDailyDateKey = effectiveDateKey;
  const dailyFocusDate = normalizeLegacyDailyDateKey(raw.dailyFocusDate, now) || currentDailyDateKey;
  const round = clampPomodoroInteger(raw.round, fallback.round, 1, settings.targetRounds);

  return {
    isRunning,
    phase,
    phaseStartedAt: isRunning && phaseStartedAt > 0 ? phaseStartedAt : 0,
    phaseEndsAt,
    round,
    completedFocusCount: clampCount(isNumber(raw.completedFocusCount) ? raw.completedFocusCount : 0),
    dailyFocusDate: currentDailyDateKey,
    dailyCompletedFocusCount:
      dailyFocusDate === currentDailyDateKey
        ? clampCount(isNumber(raw.dailyCompletedFocusCount) ? raw.dailyCompletedFocusCount : 0)
        : 0,
    settings,
    currentActivity: isPomodoroActivity(raw.currentActivity) ? raw.currentActivity : fallback.currentActivity,
    lastSettledPhaseId: typeof raw.lastSettledPhaseId === 'string' ? raw.lastSettledPhaseId.slice(0, 128) : '',
    pausedRemainingMs: isRunning ? 0 : rawPausedRemainingMs > 0 ? rawPausedRemainingMs : defaultRemainingMs,
    focusRewardCheckpointAt: isNumber(raw.focusRewardCheckpointAt) ? Math.max(0, Math.round(raw.focusRewardCheckpointAt)) : 0,
    sessionFocusMs: isNumber(raw.sessionFocusMs) ? Math.max(0, Math.round(raw.sessionFocusMs)) : 0,
    baseRewardCoinsPaid: clampCount(isNumber(raw.baseRewardCoinsPaid) ? raw.baseRewardCoinsPaid : 0),
    bonusRewardedHours: clampCount(isNumber(raw.bonusRewardedHours) ? raw.bonusRewardedHours : 0),
    moodRewardedBlocks: clampCount(isNumber(raw.moodRewardedBlocks) ? raw.moodRewardedBlocks : 0),
    hasTriggeredSessionResetEvent: Boolean(raw.hasTriggeredSessionResetEvent),
  };
};

export const pickPomodoroActivity = () => pickRandom(pomodoroActivities);

export const getPomodoroHourlyBaseCoins = (level: number) => {
  const normalizedLevel = Math.max(1, Math.round(level));
  if (normalizedLevel >= 21) return 8;
  if (normalizedLevel >= 11) return 7;
  return 6;
};

export const applyPomodoroCoinRewardMultiplier = (coins: number) => {
  const baseCoins = Math.max(0, Math.floor(coins));
  if (baseCoins <= 0) return 0;
  return Math.max(baseCoins, Math.floor(baseCoins * pomodoroCoinRewardMultiplier));
};

export const getPomodoroTargetBaseCoins = (sessionFocusMs: number, level: number) => {
  const rewardableMs = Math.floor(Math.max(0, sessionFocusMs) / pomodoroRewardBlockMs) * pomodoroRewardBlockMs;
  const baseCoins = Math.floor((rewardableMs / pomodoroBonusRewardHourMs) * getPomodoroHourlyBaseCoins(level));
  return applyPomodoroCoinRewardMultiplier(baseCoins);
};

export const getPomodoroMoodRewardBlocks = (sessionFocusMs: number) =>
  Math.floor(Math.max(0, sessionFocusMs) / pomodoroMoodRewardBlockMs);

export const getPomodoroBonusReward = (pet: PetState, hourlyBaseCoins = getPomodoroHourlyBaseCoins(pet.level)) => {
  const statCap = getPetStatCap(pet);
  const moodRatio = statCap > 0 ? Math.max(0, Math.min(1, pet.mood / statCap)) : 0;
  const bonusChance = 0.05 + moodRatio * 0.4;
  if (Math.random() >= bonusChance) return 0;
  return applyPomodoroCoinRewardMultiplier(Math.max(1, Math.floor(hourlyBaseCoins * (randomInt(5, 15) / 100))));
};
