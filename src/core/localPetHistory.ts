import type { PetState } from './petTypes';
import { normalizeAdventureState } from './adventureState';
import { normalizeCommunityState } from './communityState';
import { normalizeCourtyardReceipt } from './courtyardState';
import { courtyardHistoryLimit } from './courtyardData';
import type { CourtyardReceipt } from './courtyardTypes';

interface LocalPetHistory {
  tripsStarted: number;
  adventure: PetState['adventure']['journal'];
  market: PetState['community']['market']['log'];
  courtyard: CourtyardReceipt[];
}

const emptyHistory = (): LocalPetHistory => ({ tripsStarted: 0, adventure: [], market: [], courtyard: [] });
const keyFor = (pet: PetState) => `pocpet.pet-history.v1.${pet.saveMetadata.id}`;
let cachedKey = '', cachedRaw: string | null = null, cachedHistory = emptyHistory();

const readHistory = (pet: PetState): LocalPetHistory => {
  try {
    const key = keyFor(pet), raw = window.localStorage.getItem(key);
    if (key === cachedKey && raw === cachedRaw) return cachedHistory;
    const value = JSON.parse(raw ?? 'null');
    const history = !value || typeof value !== 'object' || Array.isArray(value) ? emptyHistory() : {
      tripsStarted: Number.isSafeInteger(value.tripsStarted) && value.tripsStarted >= 0 ? value.tripsStarted : 0,
      adventure: normalizeAdventureState({ journal: value.adventure }).journal,
      market: normalizeCommunityState({ market: { log: value.market } }).market.log,
      courtyard: (Array.isArray(value.courtyard) ? value.courtyard : []).slice(0, courtyardHistoryLimit).map(normalizeCourtyardReceipt)
        .filter((entry: CourtyardReceipt | undefined): entry is CourtyardReceipt => Boolean(entry)),
    };
    cachedKey = key; cachedRaw = raw; cachedHistory = history;
    return history;
  } catch { return emptyHistory(); }
};

const latest = <T>(entries: readonly T[], key: (entry: T) => string, time: (entry: T) => number): T[] => {
  const unique = new Map<string, T>();
  for (const entry of entries) if (!unique.has(key(entry))) unique.set(key(entry), entry);
  return [...unique.values()].sort((a, b) => time(b) - time(a)).slice(0, 8);
};

// Display only. Never hydrate these records into PetState or use them for rewards,
// daily limits, completed chapters, or any other authoritative game progress.
export const getLocalAdventureJournal = (pet: PetState): PetState['adventure']['journal'] => {
  const history = readHistory(pet);
  const saved = history.tripsStarted <= pet.adventure.tripsStarted ? history.adventure.filter(entry =>
    entry.endedAt <= pet.lastUpdatedAt && entry.id !== pet.adventure.active?.id) : [];
  return latest([...pet.adventure.journal, ...saved], entry => entry.id, entry => entry.endedAt);
};

export const getLocalMarketLog = (pet: PetState): PetState['community']['market']['log'] => {
  const saved = readHistory(pet).market.filter(entry => entry.visit <= pet.community.market.visitors && entry.at <= pet.lastUpdatedAt);
  return latest([...pet.community.market.log, ...saved], entry => `${entry.visit}:${entry.at}`, entry => entry.at);
};

export const getLocalCourtyardHistory = (pet: PetState): CourtyardReceipt[] => {
  const { lastInteraction, interactionsCount } = pet.community.courtyard;
  const unique = new Map<string, CourtyardReceipt>();
  for (const entry of [...(lastInteraction ? [lastInteraction] : []), ...readHistory(pet).courtyard]) {
    if (entry.sequence <= interactionsCount && !unique.has(entry.id)) unique.set(entry.id, entry);
  }
  return [...unique.values()].sort((a, b) => b.sequence - a.sequence).slice(0, courtyardHistoryLimit);
};

export const persistLocalPetHistory = (pet: PetState) => {
  try {
    const history: LocalPetHistory = { tripsStarted: pet.adventure.tripsStarted, adventure: getLocalAdventureJournal(pet), market: getLocalMarketLog(pet), courtyard: getLocalCourtyardHistory(pet) };
    const key = keyFor(pet), raw = JSON.stringify(history);
    if (!history.adventure.length && !history.market.length && !history.courtyard.length && window.localStorage.getItem(key) === null) return;
    if (window.localStorage.getItem(key) !== raw) window.localStorage.setItem(key, raw);
  } catch { /* Local reading history must never block saving actual progress. */ }
};
