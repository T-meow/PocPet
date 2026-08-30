import { t } from '../i18n';
import { getDailyResetDateKey } from './dailyReset';
import { incrementDailyWishClaim, incrementReturnWelcomeClaim, recordEarnedCoins } from './achievements';
import { addInventoryItem, allItemIds } from './items';
import { resolveDailyGachaTicket } from './goldenAppleGacha';
import { getEffectiveDailyDateKey } from './gameClock';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import { clampCoins, clampCount, getPetStatThreshold } from './petStats';
import type {
  DailyWishActionKey,
  DailyWishId,
  DailyWishState,
  ItemId,
  PetState,
  ReturnWelcomeActionKey,
  ReturnWelcomeState,
  ReturnWelcomeTaskId,
} from './petTypes';
import { hashString, isNumber } from './utils';

type DailyWishSnapshot = Pick<PetState, 'level' | 'createdAt' | 'name' | 'energy' | 'health' | 'isSleeping'>;

type DailyWishConfig = {
  id: DailyWishId;
  action: DailyWishActionKey;
  target: number;
  rewardCoins: number;
};

type ReturnWelcomeTaskConfig = {
  taskId: ReturnWelcomeTaskId;
  action: ReturnWelcomeActionKey;
  target: number;
};

export type WishProgressActionKey = DailyWishActionKey | ReturnWelcomeActionKey;

export interface WishTaskView {
  title: string;
  progressText: string;
  rewardText: string;
  buttonLabel: string;
  canClaim: boolean;
  claimed: boolean;
}

export const returnWelcomeMinAwayMs = 36 * 60 * 60 * 1000;

const dayMs = 24 * 60 * 60 * 1000;

const dailyWishConfigs: readonly DailyWishConfig[] = [
  { id: 'feed_once', action: 'feed', target: 1, rewardCoins: 36 },
  { id: 'clean_once', action: 'clean', target: 1, rewardCoins: 36 },
  { id: 'play_once', action: 'play', target: 1, rewardCoins: 36 },
  { id: 'touch_once', action: 'touch', target: 1, rewardCoins: 32 },
  { id: 'work_once', action: 'work', target: 1, rewardCoins: 48 },
];

const dailyWishIds = new Set<DailyWishId>(dailyWishConfigs.map((config) => config.id));
const returnWelcomeTaskIds = new Set<ReturnWelcomeTaskId>(['feed_once', 'clean_once', 'touch_once', 'sleep_once']);

const isDailyWishId = (value: unknown): value is DailyWishId =>
  typeof value === 'string' && dailyWishIds.has(value as DailyWishId);

const isReturnWelcomeTaskId = (value: unknown): value is ReturnWelcomeTaskId =>
  typeof value === 'string' && returnWelcomeTaskIds.has(value as ReturnWelcomeTaskId);

const getDailyWishConfig = (id: DailyWishId) => dailyWishConfigs.find((config) => config.id === id) ?? dailyWishConfigs[0];

const getAvailableDailyWishConfigs = (pet: DailyWishSnapshot) => {
  const canSpendEnergy = !pet.isSleeping && pet.energy >= 34 && pet.health > getPetStatThreshold(pet, 35);
  const configs = dailyWishConfigs.filter((config) => {
    if (config.action === 'play' || config.action === 'work') return canSpendEnergy;
    return true;
  });
  return configs.length > 0 ? configs : dailyWishConfigs.slice(0, 3);
};

export const createDailyWish = (
  pet: DailyWishSnapshot,
  now = Date.now(),
  dateKey = getDailyResetDateKey(now),
): DailyWishState => {
  const configs = getAvailableDailyWishConfigs(pet);
  const index = hashString(dateKey + ':' + Math.floor(pet.createdAt) + ':' + pet.name) % configs.length;
  const config = configs[index];

  return {
    dateKey,
    id: config.id,
    action: config.action,
    progress: 0,
    target: config.target,
    rewardCoins: config.rewardCoins,
  };
};

export const normalizeDailyWishState = (
  value: unknown,
  pet: DailyWishSnapshot,
  now = Date.now(),
  effectiveDateKey = getDailyResetDateKey(now),
): DailyWishState => {
  const fallback = createDailyWish(pet, now, effectiveDateKey);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const raw = value as Record<string, unknown>;
  if (!isDailyWishId(raw.id)) return fallback;
  const config = getDailyWishConfig(raw.id);
  const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : '';
  if (dateKey !== effectiveDateKey) return fallback;

  const progress = Math.min(config.target, clampCount(isNumber(raw.progress) ? raw.progress : 0));
  const completedAt = isNumber(raw.completedAt) && progress >= config.target
    ? Math.floor(raw.completedAt)
    : progress >= config.target
      ? now
      : undefined;
  const claimedAt = isNumber(raw.claimedAt) && completedAt ? Math.floor(raw.claimedAt) : undefined;

  return {
    dateKey,
    id: config.id,
    action: config.action,
    progress,
    target: config.target,
    rewardCoins: config.rewardCoins,
    completedAt,
    claimedAt,
  };
};

const getReturnWelcomeTaskConfig = (taskId: ReturnWelcomeTaskId): ReturnWelcomeTaskConfig => {
  if (taskId === 'feed_once') return { taskId, action: 'feed', target: 1 };
  if (taskId === 'clean_once') return { taskId, action: 'clean', target: 1 };
  if (taskId === 'sleep_once') return { taskId, action: 'sleep', target: 1 };
  return { taskId: 'touch_once', action: 'touch', target: 1 };
};

const chooseReturnWelcomeTask = (pet: PetState): ReturnWelcomeTaskConfig => {
  if (pet.hunger <= getPetStatThreshold(pet, 48)) return getReturnWelcomeTaskConfig('feed_once');
  if (pet.cleanliness <= getPetStatThreshold(pet, 48)) return getReturnWelcomeTaskConfig('clean_once');
  if (!pet.isSleeping && pet.energy <= 34) return getReturnWelcomeTaskConfig('sleep_once');
  return getReturnWelcomeTaskConfig('touch_once');
};

const getReturnWelcomeRewardItems = (awayDays: number): ItemId[] =>
  awayDays >= 3 ? ['emergency_biscuit', 'wet_wipes'] : ['emergency_biscuit'];

export const normalizeReturnWelcomeState = (value: unknown): ReturnWelcomeState | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const raw = value as Record<string, unknown>;
  if (!isReturnWelcomeTaskId(raw.taskId)) return undefined;
  const config = getReturnWelcomeTaskConfig(raw.taskId);
  const startedAt = isNumber(raw.startedAt) ? Math.floor(raw.startedAt) : 0;
  if (startedAt <= 0) return undefined;

  const awayDays = Math.max(1, Math.min(30, Math.floor(isNumber(raw.awayDays) ? raw.awayDays : 1)));
  const progress = Math.min(config.target, clampCount(isNumber(raw.progress) ? raw.progress : 0));
  const completedAt = isNumber(raw.completedAt) && progress >= config.target
    ? Math.floor(raw.completedAt)
    : progress >= config.target
      ? startedAt
      : undefined;
  const claimedAt = isNumber(raw.claimedAt) && completedAt ? Math.floor(raw.claimedAt) : undefined;
  const rawItemIds = Array.isArray(raw.rewardItemIds) ? raw.rewardItemIds : [];
  const rewardItemIds = rawItemIds.filter((itemId): itemId is ItemId => typeof itemId === 'string' && allItemIds.has(itemId));

  return {
    startedAt,
    awayDays,
    taskId: config.taskId,
    action: config.action,
    progress,
    target: config.target,
    rewardCoins: Math.max(30, Math.min(90, Math.floor(isNumber(raw.rewardCoins) ? raw.rewardCoins : 30 + awayDays * 10))),
    rewardItemIds: rewardItemIds.length > 0 ? rewardItemIds : getReturnWelcomeRewardItems(awayDays),
    completedAt,
    claimedAt,
  };
};

export const ensureDailyWishForDate = (pet: PetState, now = Date.now()): PetState => {
  const dailyWish = normalizeDailyWishState(pet.dailyWish, pet, now, getEffectiveDailyDateKey(pet, now));
  return dailyWish === pet.dailyWish ? pet : { ...pet, dailyWish };
};

export const maybeCreateReturnWelcome = (pet: PetState, awayMs: number, now = Date.now()): PetState => {
  if (awayMs < returnWelcomeMinAwayMs) return pet;
  if (pet.returnWelcome && !pet.returnWelcome.claimedAt) return pet;

  const awayDays = Math.max(1, Math.min(14, Math.ceil(awayMs / dayMs)));
  const task = chooseReturnWelcomeTask(pet);
  const returnWelcome: ReturnWelcomeState = {
    startedAt: now,
    awayDays,
    taskId: task.taskId,
    action: task.action,
    progress: 0,
    target: task.target,
    rewardCoins: Math.min(90, 30 + awayDays * 10),
    rewardItemIds: getReturnWelcomeRewardItems(awayDays),
  };

  return {
    ...pet,
    returnWelcome,
    recentEvent: t('pet.returnWelcome.started', { name: pet.name, days: awayDays }),
  };
};

const recordDailyWishProgress = (pet: PetState, action: WishProgressActionKey, now: number): PetState => {
  const current = ensureDailyWishForDate(pet, now);
  const wish = current.dailyWish;
  if (wish.claimedAt || wish.completedAt || wish.action !== action) return current;

  const progress = Math.min(wish.target, wish.progress + 1);
  return {
    ...current,
    dailyWish: {
      ...wish,
      progress,
      completedAt: progress >= wish.target ? now : undefined,
    },
  };
};

const recordReturnWelcomeProgress = (pet: PetState, action: WishProgressActionKey, now: number): PetState => {
  const welcome = pet.returnWelcome;
  if (!welcome || welcome.claimedAt || welcome.completedAt || welcome.action !== action) return pet;

  const progress = Math.min(welcome.target, welcome.progress + 1);
  return {
    ...pet,
    returnWelcome: {
      ...welcome,
      progress,
      completedAt: progress >= welcome.target ? now : undefined,
    },
  };
};

export const recordWishProgress = (pet: PetState, action: WishProgressActionKey, now = Date.now()): PetState =>
  recordReturnWelcomeProgress(recordDailyWishProgress(pet, action, now), action, now);

export const claimDailyWishReward = (pet: PetState, now = Date.now()): PetState => {
  const current = ensureDailyWishForDate(pet, now);
  const wish = current.dailyWish;
  if (wish.claimedAt) return { ...current, recentEvent: t('pet.dailyWish.alreadyClaimed') };
  if (!wish.completedAt) return { ...current, recentEvent: t('pet.dailyWish.notReady') };

  const rewardCoins = Math.max(1, Math.round(
    wish.rewardCoins * getPartnerScheduleCrossSystemEffects(current).dailyWishCoinMultiplier,
  ));
  const rewarded = recordEarnedCoins(incrementDailyWishClaim({
    ...current,
    coins: clampCoins(current.coins + rewardCoins),
    dailyWish: { ...wish, claimedAt: now },
    recentEvent: t('pet.dailyWish.claimed', { coins: rewardCoins }),
  }), rewardCoins);
  return resolveDailyGachaTicket(rewarded, 'daily_wish', 20, now).pet;
};

export const claimReturnWelcomeReward = (pet: PetState, now = Date.now()): PetState => {
  const welcome = normalizeReturnWelcomeState(pet.returnWelcome);
  if (!welcome) return pet;
  if (welcome.claimedAt) return { ...pet, returnWelcome: welcome, recentEvent: t('pet.returnWelcome.alreadyClaimed') };
  if (!welcome.completedAt) return { ...pet, returnWelcome: welcome, recentEvent: t('pet.returnWelcome.notReady') };

  const inventory = welcome.rewardItemIds.reduce((next, itemId) => addInventoryItem(next, itemId, 1), pet.inventory);
  return recordEarnedCoins(incrementReturnWelcomeClaim({
    ...pet,
    coins: clampCoins(pet.coins + welcome.rewardCoins),
    inventory,
    returnWelcome: { ...welcome, claimedAt: now },
    recentEvent: t('pet.returnWelcome.claimed', { coins: welcome.rewardCoins }),
  }), welcome.rewardCoins);
};

const getButtonLabel = (canClaim: boolean, claimed: boolean) => {
  if (claimed) return t('ui.wishes.claimed');
  if (canClaim) return t('ui.wishes.claim');
  return t('ui.wishes.inProgress');
};

export const getDailyWishView = (pet: PetState): WishTaskView => {
  const wish = pet.dailyWish;
  const rewardCoins = Math.max(1, Math.round(
    wish.rewardCoins * getPartnerScheduleCrossSystemEffects(pet).dailyWishCoinMultiplier,
  ));
  const canClaim = Boolean(wish.completedAt && !wish.claimedAt);
  const claimed = Boolean(wish.claimedAt);
  return {
    title: t('ui.dailyWish.wishes.' + wish.id + '.title'),
    progressText: t('ui.wishes.progress', { progress: wish.progress, target: wish.target }),
    rewardText: t('ui.wishes.rewardCoins', { coins: rewardCoins }),
    buttonLabel: getButtonLabel(canClaim, claimed),
    canClaim,
    claimed,
  };
};

export const getReturnWelcomeView = (pet: PetState): WishTaskView | undefined => {
  const welcome = normalizeReturnWelcomeState(pet.returnWelcome);
  if (!welcome || welcome.claimedAt) return undefined;

  const canClaim = Boolean(welcome.completedAt);
  return {
    title: t('ui.returnWelcome.tasks.' + welcome.taskId + '.title'),
    progressText: t('ui.wishes.progress', { progress: welcome.progress, target: welcome.target }),
    rewardText: t('ui.returnWelcome.reward', { coins: welcome.rewardCoins, count: welcome.rewardItemIds.length }),
    buttonLabel: getButtonLabel(canClaim, false),
    canClaim,
    claimed: false,
  };
};
