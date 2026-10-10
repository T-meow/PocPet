import { getDish } from './kitchenRecipes';
import { getMuseumStageCost, isMuseumVisitId, museumExhibits, museumQuestIds, museumQuests, museumRegions, museumScales, museumThemeIds, museumVisits, museumVisitIds, type MuseumRegion, type MuseumTheme } from './museumData';
import type { MuseumAppearance, MuseumDraft, MuseumRecord, MuseumState, MuseumTripContext } from './museumTypes';
import type { PetState } from './petTypes';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const text = (value: unknown, max = 128) => typeof value === 'string' ? value.slice(0, max) : '';
const dateKey = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? text(value) : '';
const theme = (value: unknown): value is MuseumTheme => museumThemeIds.includes(value as MuseumTheme);
const selected = (raw: unknown, kind: 'exhibits' | 'dishes', limit: number) => Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && (kind === 'exhibits' ? museumExhibits.some(e => e.id === id) : Boolean(getDish(id)))))].slice(0, limit) : [];
export const defaultMuseumAppearance = (level = 0): MuseumAppearance => ({ base: level >= 20 ? 'prestige' : level >= 1 ? 'common' : 'none', plate: level >= 100 ? 100 : level >= 50 ? 50 : level >= 30 ? 30 : level >= 3 ? 3 : 0, filigree: level >= 6, ribbon: level >= 9, crown: level >= 12, frame: 'none', badge: 'common', title: level >= 100 ? 'century' : level >= 50 ? 'keeper' : level >= 30 ? 'companion' : 'default' });
export const defaultMuseumState = (): MuseumState => ({ schemaVersion: 1, halls: Object.fromEntries(museumRegions.map(id => [id, { stage: 0, invested: 0 }])) as MuseumState['halls'], quests: {}, board: { week: '', themes: [] }, nextDraftId: 1, stars: 0, hosted: 0, coinsSpent: 0, applesSpent: 0, lastHostedWeek: '', weeklyPages: 0, best: {}, records: [], appearance: defaultMuseumAppearance() });
export const normalizeMuseumDraft = (raw: unknown): MuseumDraft | undefined => {
  const value = object(raw), id = count(value.id);
  return id && theme(value.theme) && Object.prototype.hasOwnProperty.call(museumScales, String(value.scale)) ? { id, revision: count(value.revision), theme: value.theme, scale: value.scale as MuseumDraft['scale'], exhibits: selected(value.exhibits, 'exhibits', 3), dishes: selected(value.dishes, 'dishes', 2) } : undefined;
};
export const normalizeMuseumState = (raw: unknown, legacyLevel = 0): MuseumState => {
  const value = object(raw), state = defaultMuseumState();
  for (const id of museumRegions) {
    const hall = object(object(value.halls)[id]), stage = count(hall.stage, 3), openedAt = count(hall.openedAt, 8640000000000000);
    state.halls[id] = { stage, invested: stage === 3 ? 0 : count(hall.invested, getMuseumStageCost(id, stage).coins), ...(stage === 3 && openedAt ? { openedAt } : {}) };
  }
  for (const id of museumQuestIds) {
    const quest = object(object(value.quests)[id]), acceptedAt = count(quest.acceptedAt, 8640000000000000), def = museumQuests[id];
    if (!acceptedAt || state.halls[def.region].stage < 1) continue;
    const progress = Object.fromEntries(def.objectives.map(g => [g.key, count(object(quest.progress)[g.key], g.amount)]));
    const completedAt = count(quest.completedAt, 8640000000000000);
    const visits = Object.fromEntries(museumVisitIds.filter(v => museumVisits[v].quest === id).map(v => [v, count(object(quest.visits)[v], museumVisits[v].steps.length)]));
    const delivery = Object.fromEntries(Object.entries(object(quest.delivery)).filter(([item, amount]) => Boolean(getDish(item)) && amount === 1).slice(0, 3).map(([item]) => [item, 1]));
    state.quests[id] = { acceptedAt, progress, visits, ...(Object.keys(delivery).length ? { delivery } : {}), ...(completedAt && def.objectives.every(g => progress[g.key] >= g.amount) ? { completedAt: Math.max(acceptedAt, completedAt) } : {}) };
  }
  const board = object(value.board);
  state.board = { week: dateKey(board.week), themes: Array.isArray(board.themes) ? [...new Set(board.themes.filter(theme))].slice(0, 3) : [] };
  state.draft = normalizeMuseumDraft(value.draft);
  state.nextDraftId = Math.max(1, count(value.nextDraftId), (state.draft?.id ?? 0) + 1);
  for (const key of ['stars', 'hosted', 'coinsSpent', 'applesSpent', 'weeklyPages'] as const) state[key] = count(value[key]);
  state.lastHostedWeek = dateKey(value.lastHostedWeek);
  const recordIds = new Set<number>();
  for (const entry of (Array.isArray(value.records) ? value.records : []).slice(-200)) {
    const record = object(entry), draft = normalizeMuseumDraft(record), rating = count(record.rating, 3);
    if (!draft || !rating || draft.exhibits.length !== 3 || draft.dishes.length !== 2 || recordIds.has(draft.id)) continue;
    recordIds.add(draft.id);
    state.records.push({ id: draft.id, theme: draft.theme, scale: draft.scale, exhibits: draft.exhibits, dishes: draft.dishes, at: count(record.at, 8640000000000000), week: dateKey(record.week), weekly: record.weekly === true, rating,
      stars: count(record.stars, 18), coins: count(record.coins), apples: count(record.apples), portions: count(record.portions, 6),
      actorId: text(record.actorId), actorName: text(record.actorName, 32) || '伙伴', guestId: text(record.guestId) || undefined, guestName: text(record.guestName, 32) || '社区邻居', message: count(record.message, 3) } as MuseumRecord);
  }
  for (const id of museumThemeIds) {
    const best = object(object(value.best)[id]), rating = count(best.rating, 3);
    if (rating) state.best[id] = { rating, exhibits: selected(best.exhibits, 'exhibits', 3), dishes: selected(best.dishes, 'dishes', 2) };
  }
  state.nextDraftId = Math.min(Number.MAX_SAFE_INTEGER, Math.max(state.nextDraftId, ...state.records.map(r => r.id + 1)));
  const a = object(value.appearance), fallback = defaultMuseumAppearance(legacyLevel);
  state.appearance = {
    base: ['none', 'common', 'prestige'].includes(String(a.base)) ? a.base as MuseumAppearance['base'] : fallback.base,
    plate: [0, 3, 30, 50, 100].includes(Number(a.plate)) ? Number(a.plate) as MuseumAppearance['plate'] : fallback.plate,
    filigree: typeof a.filigree === 'boolean' ? a.filigree : fallback.filigree,
    ribbon: typeof a.ribbon === 'boolean' ? a.ribbon : fallback.ribbon,
    crown: typeof a.crown === 'boolean' ? a.crown : fallback.crown,
    frame: ['none', 'common', 'prestige'].includes(String(a.frame)) ? a.frame as MuseumAppearance['frame'] : state.stars >= 90 ? 'prestige' : state.hosted ? 'common' : 'none',
    badge: a.badge === 'prestige' && state.stars >= 300 ? 'prestige' : 'common',
    title: ['default', 'companion', 'keeper', 'century', 'curator'].includes(String(a.title)) ? a.title as MuseumAppearance['title'] : state.stars >= 900 ? 'curator' : fallback.title,
  };
  state.appearance = getMuseumAppearance({ classicEndgame: { legacyLevel }, museum: state });
  return state;
};
export const getMuseumExhibits = (state: MuseumState) => museumExhibits.filter(e => e.quest ? Boolean(state.quests[e.quest]?.completedAt) : state.halls[e.region].stage >= (e.stage ?? 1));
export const getMuseumOpenHalls = (state: MuseumState): MuseumRegion[] => museumRegions.filter(id => state.halls[id].stage === 3);
export const getMuseumAppearance = (pet: { classicEndgame: { legacyLevel: number }; museum: MuseumState }): MuseumAppearance => {
  const a = pet.museum.appearance, level = pet.classicEndgame.legacyLevel;
  return { ...a, base: a.base === 'prestige' && level < 20 ? level ? 'common' : 'none' : a.base === 'common' && level < 1 ? 'none' : a.base,
    plate: a.plate <= level ? a.plate : 0, filigree: a.filigree && level >= 6, ribbon: a.ribbon && level >= 9, crown: a.crown && level >= 12,
    frame: a.frame === 'prestige' && pet.museum.stars < 90 ? pet.museum.hosted ? 'common' : 'none' : !pet.museum.hosted ? 'none' : a.frame,
    badge: a.badge === 'prestige' && pet.museum.stars >= 300 ? 'prestige' : 'common',
    title: a.title === 'curator' ? pet.museum.stars >= 900 ? 'curator' : 'default' : level >= ({ default: 0, companion: 30, keeper: 50, century: 100 }[a.title] ?? Infinity) ? a.title : 'default' };
};
export const normalizeMuseumTrip = (raw: unknown, purpose: unknown): MuseumTripContext | undefined => {
  const value = object(raw);
  if (!isMuseumVisitId(value.visitId) || museumVisits[value.visitId].destination !== purpose || !count(value.acceptedAt)) return undefined;
  const step = count(value.step, museumVisits[value.visitId].steps.length);
  return { visitId: value.visitId, acceptedAt: count(value.acceptedAt), step, startStep: count(value.startStep, step) };
};
export const museumTitle = (pet: Pick<PetState, 'museum' | 'classicEndgame'>) => ({ default: '我们的纪念馆', companion: '同行纪念人', keeper: '珍藏守望者', century: '百阶同行', curator: '长伴策展家' }[getMuseumAppearance(pet).title]);
