import { expeditionCapacity, expeditionProducts, projectIds, regionIds } from './expeditionData';
import type { ExpeditionState, ExpeditionTrip, RegionId } from './expeditionTypes';
import type { Inventory } from './petTypes';

const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const label = (v: unknown) => typeof v === 'string' ? v.slice(0, 128) : '';
const bag = (v: unknown, max = expeditionCapacity): Inventory => {
  let remaining = max;
  return Object.fromEntries(Object.entries(obj(v)).slice(0, 100).flatMap(([id, amount]) => {
    const count = Math.min(remaining, n(amount, max));
    if (!count || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id)) return [];
    remaining -= count; return [[id, count]];
  }));
};
const route = (v: unknown): RegionId[] => Array.isArray(v) && v.length >= 1 && v.length <= 3 && new Set(v).size === v.length && v.every(id => regionIds.includes(id)) ? v : [];
const journal = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-12).map(x => x.slice(0, 240)) : [];
export const defaultExpeditionState = (): ExpeditionState => ({ schemaVersion: 1, nextId: 1,
  regions: Object.fromEntries(regionIds.map(id => [id, { surveyed: false, base: 0, harvestDay: '', harvestUsed: 0 }])) as ExpeditionState['regions'],
  projects: Object.fromEntries(projectIds.map(id => [id, { completed: 0, stage: 0, lastDay: '' }])) as ExpeditionState['projects'], collection: {},
});
export const normalizeExpeditionState = (raw: unknown): ExpeditionState => {
  const v = obj(raw), state = defaultExpeditionState();
  state.nextId = Math.max(1, n(v.nextId));
  for (const id of regionIds) {
    const r = obj(obj(v.regions)[id]);
    state.regions[id] = { surveyed: r.surveyed === true, base: r.surveyed === true ? n(r.base, 2) : 0, harvestDay: day(r.harvestDay), harvestUsed: n(r.harvestUsed, 3),
      ...(r.surveyed === true && stamp(r.storyAt) ? { storyAt: r.storyAt, actorId: label(r.actorId), actorName: label(r.actorName) } : {}) };
  }
  for (const id of projectIds) {
    const p = obj(obj(v.projects)[id]), theme = p.theme === 'garden' || p.theme === 'journey' ? p.theme : undefined;
    state.projects[id] = { completed: n(p.completed), stage: theme ? n(p.stage, 2) : 0, theme, lastDay: day(p.lastDay),
      ...(n(p.completed) > 0 && stamp(p.firstAt) ? { firstAt: p.firstAt, actorId: label(p.actorId), actorName: label(p.actorName) } : {}) };
  }
  for (const id of Object.keys(expeditionProducts) as (keyof typeof expeditionProducts)[]) {
    const count = n(obj(v.collection)[id]); if (count) state.collection[id] = count;
  }
  const p = obj(v.pending), pr = route(p.route);
  if (label(p.id) && pr.length && (p.mode === 'manual' || p.mode === 'idle') && stamp(p.at)) state.pending = {
    id: label(p.id), mode: p.mode, route: pr, items: bag(p.items), overflow: p.selected ? {} : bag(p.overflow, 24), tool: p.tool === true,
    selected: p.selected === true, coins: n(p.coins, 300), hearts: n(p.hearts, 30), at: p.at,
    reason: p.reason === 'complete' || p.reason === 'health' ? p.reason : 'return', journal: journal(p.journal),
  };
  const a = obj(v.active), ar = route(a.route);
  if (!state.pending && label(a.id) && a.rulesVersion === 1 && ar.length && (a.mode === 'manual' || a.mode === 'idle') && stamp(a.startedAt) && stamp(a.endsAt)) {
    const trip: ExpeditionTrip = { rulesVersion: 1, id: label(a.id), revision: n(a.revision), mode: a.mode, actorId: label(a.actorId), actorName: label(a.actorName),
      route: ar, leg: n(a.leg, ar.length - 1), step: n(a.step, 3), bag: bag(a.bag), ground: bag(a.ground, 24), tool: a.tool === true,
      rested: Array.isArray(a.rested) ? regionIds.filter(id => a.rested.includes(id)) : [], paused: a.mode === 'manual' && a.step === 3 && a.paused === true,
      startedAt: a.startedAt, endsAt: a.endsAt, parts: a.mode === 'idle' && a.parts === 3 ? 3 : 1, settledParts: n(a.settledParts, a.parts === 3 ? 3 : 1),
      coins: n(a.coins, 300), hearts: n(a.hearts, 30), journal: journal(a.journal) };
    if (trip.mode === 'manual' || ar.length === 1 && trip.endsAt - trip.startedAt === trip.parts * 3600000) state.active = trip;
  }
  const last = obj(v.lastReceipt), lr = route(last.route);
  if (label(last.id) && stamp(last.at) && lr.length) state.lastReceipt = { id: label(last.id), at: last.at, route: lr, reason: last.reason === 'complete' || last.reason === 'health' ? last.reason : 'return', journal: journal(last.journal) };
  for (const record of [state.active, state.pending, state.lastReceipt]) {
    if (record && /^expedition:\d+$/.test(record.id)) state.nextId = Math.max(state.nextId, Math.min(Number.MAX_SAFE_INTEGER, Number(record.id.split(':')[1]) + 1));
  }
  return state;
};
