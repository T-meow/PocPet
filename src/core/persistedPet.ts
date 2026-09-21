import { normalizePet } from './petState';
import type { PetState } from './petTypes';
import { packDateKeys, unpackDateKeys, type PersistedDateKeys } from './persistedDates';

// Older V2 readers reject unknown envelope fields. Keep this marker on every
// compact save so they cannot silently discard packed dates or memory entries.
export const compactSaveEncoding = 'compact-v1' as const;

export const persistentPetKeys = [
  'saveMetadata', 'name', 'level', 'hunger', 'isOverfed', 'mood', 'cleanliness', 'energy', 'health', 'createdAt', 'metDate', 'ageSeconds',
  'lastUpdatedAt', 'isSleeping', 'coins', 'hearts', 'inventory', 'lastDailyRewardAt', 'lastDailyEncounterAt',
  'dailyEncounterDateKey', 'neighborGiftDateKey', 'neighborGiftCount', 'dailyBiscuitClaimDate', 'dailyBiscuitClaims',
  'dailyDiscountDate', 'dailyDiscountItemIds', 'dailyDiscountUsedItemIds', 'dailyDiscountUsed',
  'dailyHeartExchangeDate', 'dailyHeartExchangeCount', 'weatherDate', 'weather', 'lastEnergyRecoveryAt',
  'sleepStartedAt', 'sleepStartMood', 'sleepStartHunger', 'sleepStartCleanliness', 'lastDreamTalkAt', 'actionStreak',
  'lastInteractionAt', 'lastPetInteractionAt', 'pomodoro', 'claimedRewardIds', 'birthday', 'claimedDateRewardKeys',
  'dailyLoginRewardDateKey', 'yearlyStats', 'pendingYearReview', 'latestYearReview', 'lastYearReviewYear',
  'dailyWish', 'returnWelcome', 'achievements', 'lastCleanActionAt', 'garden', 'boostCards', 'partnerSchedule',
  'goldenAppleGacha', 'classicEndgame', 'timeGuard', 'timePause', 'kitchen', 'miniGames', 'companionMemories', 'festivalStories', 'adventure', 'community',
] as const satisfies readonly (keyof PetState)[];

type PersistentBase = Pick<PetState, typeof persistentPetKeys[number]>;
type Expedition = PetState['community']['expedition'];
type Memory = PetState['companionMemories']['entries'][number];
type PersistedExpedition = Omit<Expedition, 'active' | 'pending' | 'lastReceipt'> & {
  active?: Omit<NonNullable<Expedition['active']>, 'journal'>;
  pending?: Omit<NonNullable<Expedition['pending']>, 'journal'>;
  lastReceipt?: Omit<NonNullable<Expedition['lastReceipt']>, 'journal'>;
};
export type PersistedPetStateV2 = Omit<PersistentBase, 'garden' | 'goldenAppleGacha' | 'kitchen' | 'miniGames' | 'achievements' | 'yearlyStats' | 'companionMemories' | 'community'> & {
  garden: Omit<PetState['garden'], 'activeSlotIndex' | 'slots'> & { slots: Array<PetState['garden']['slots'][number] | { unlocked: boolean }> };
  goldenAppleGacha: Omit<PetState['goldenAppleGacha'], 'recentResults' | 'recentHeartResults'>;
  kitchen: Omit<PetState['kitchen'], 'plating' | 'lastCraft'>;
  miniGames: Omit<PetState['miniGames'], 'style'>;
  achievements: Omit<PetState['achievements'], 'pendingReviewNotice' | 'counters'> & {
    counters: Omit<PetState['achievements']['counters'], 'companionYearActiveDateKeysByYear'> & {
      companionYearActiveDateKeysByYear: Record<string, PersistedDateKeys>;
    };
  };
  yearlyStats: Omit<PetState['yearlyStats'], 'activeDateKeys'> & { activeDateKeys: PersistedDateKeys };
  companionMemories: { schemaVersion: 1; entries: Array<Omit<Memory, 'id' | 'mentionedAt'> & { id?: string }> };
  community: Omit<PetState['community'], 'expedition'> & { expedition: PersistedExpedition };
};

const memoryId = (entry: { actorId: string; kind: string; subject: string }) => `${entry.actorId}:${entry.kind}:${entry.subject}`.slice(0, 200);
const withoutJournal = <T extends { journal: string[] }>(record: T | undefined): Omit<T, 'journal'> | undefined => {
  if (!record) return undefined;
  const { journal: _journal, ...rest } = record;
  return rest;
};

export const toPersistedPet = (pet: PetState, now: number): PersistedPetStateV2 => {
  const current = normalizePet(pet, now);
  const base = Object.fromEntries(persistentPetKeys.map((key) => [key, current[key]])) as PersistentBase;
  const { activeSlotIndex: _slot, ...garden } = current.garden;
  const { recentResults: _gold, recentHeartResults: _heart, ...goldenAppleGacha } = current.goldenAppleGacha;
  const { plating: _plating, lastCraft: _craft, ...kitchen } = current.kitchen;
  const { style: _style, lastResult, ...miniGames } = current.miniGames;
  const { pendingReviewNotice: _notice, ...achievements } = current.achievements;
  const expedition = current.community.expedition;
  return {
    ...base,
    garden: { ...garden, slots: garden.slots.map((slot) => slot.state === 'empty' && slot.dailyAdvancedFertilizerReductionMs === 0 ? { unlocked: slot.unlocked } : slot) },
    goldenAppleGacha, kitchen,
    achievements: { ...achievements, counters: { ...achievements.counters,
      companionYearActiveDateKeysByYear: Object.fromEntries(Object.entries(achievements.counters.companionYearActiveDateKeysByYear).map(([year, keys]) => [year, packDateKeys(keys)])),
    } },
    yearlyStats: { ...current.yearlyStats, activeDateKeys: packDateKeys(current.yearlyStats.activeDateKeys) },
    companionMemories: { ...current.companionMemories, entries: current.companionMemories.entries.map(({ id, mentionedAt: _mentioned, ...entry }) =>
      id === memoryId(entry) ? entry : { ...entry, id }) },
    community: { ...current.community, expedition: { ...expedition,
      active: withoutJournal(expedition.active), pending: withoutJournal(expedition.pending), lastReceipt: withoutJournal(expedition.lastReceipt),
    } },
    miniGames: { ...miniGames, lastSettledSessionId: miniGames.lastSettledSessionId || lastResult?.id || '', lastResult: lastResult?.pending ? lastResult : undefined },
  };
};

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const withEmptyJournal = (record: unknown) => isObject(record) ? { ...record, journal: [] } : record;

export const hydratePersistedPet = (raw: Record<string, unknown>, compact = false): Record<string, unknown> => {
  const pet = { ...raw, recentEvent: '', recentActivity: 'idle', recentActivityUntil: 0, lowCleanlinessSleepConfirmCount: 0,
    goldenAppleGacha: { ...(raw.goldenAppleGacha as object), recentResults: [], recentHeartResults: [] },
  } as Record<string, unknown>;
  if (!compact) return pet;
  if (isObject(raw.yearlyStats)) pet.yearlyStats = { ...raw.yearlyStats, activeDateKeys: unpackDateKeys(raw.yearlyStats.activeDateKeys) };
  if (isObject(raw.achievements) && isObject(raw.achievements.counters)) {
    const counters = raw.achievements.counters;
    if (isObject(counters.companionYearActiveDateKeysByYear)) pet.achievements = { ...raw.achievements, counters: { ...counters,
      companionYearActiveDateKeysByYear: Object.fromEntries(Object.entries(counters.companionYearActiveDateKeysByYear).map(([year, keys]) => [year, unpackDateKeys(keys)])),
    } };
  }
  if (isObject(raw.companionMemories) && Array.isArray(raw.companionMemories.entries)) {
    pet.companionMemories = { ...raw.companionMemories, entries: raw.companionMemories.entries.map(entry => {
      if (!isObject(entry)) return entry;
      const id = entry.id === undefined && typeof entry.actorId === 'string' && typeof entry.kind === 'string' && typeof entry.subject === 'string'
        ? memoryId({ actorId: entry.actorId, kind: entry.kind, subject: entry.subject }) : entry.id;
      return { ...entry, id, mentionedAt: 0 };
    }) };
  }
  if (isObject(raw.community) && isObject(raw.community.expedition)) {
    const expedition = raw.community.expedition;
    pet.community = { ...raw.community, expedition: { ...expedition,
      active: withEmptyJournal(expedition.active), pending: withEmptyJournal(expedition.pending), lastReceipt: withEmptyJournal(expedition.lastReceipt),
    } };
  }
  return pet;
};
