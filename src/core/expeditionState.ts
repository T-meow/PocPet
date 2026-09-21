import { expeditionCapacity, expeditionProducts, projectIds, regionIds } from './expeditionData';
import type { ExpeditionState, ExpeditionTrip, RegionId } from './expeditionTypes';
import type { Inventory } from './petTypes';
import { valleyGatherTargets } from './valleyExplorationData';
import { explorationTravel } from './explorationTravelData';
import { normalizeRationSegments } from './explorationRations';

const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const amount = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
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
export const defaultExpeditionState = (): ExpeditionState => ({ schemaVersion: 3, nextId: 1,
  regions: Object.fromEntries(regionIds.map(id => [id, { surveyed: false, base: 0, harvestDay: '', harvestUsed: 0 }])) as ExpeditionState['regions'],
  projects: Object.fromEntries(projectIds.map(id => [id, { completed: 0, stage: 0, lastDay: '' }])) as ExpeditionState['projects'], collection: {},
});
export const normalizeExpeditionState = (raw: unknown, capacity = 24): ExpeditionState => {
  const v = obj(raw), state = defaultExpeditionState();
  state.nextId = Math.max(1, n(v.nextId));
  const loop = obj(v.loop);
  if (stamp(loop.refillAt) && day(loop.day)) {
    const voucherIds = new Set<string>(), heartIds = new Set<string>();
    state.loop = { refillAt: loop.refillAt, available: n(loop.available, 24), used: n(loop.used), day: day(loop.day),
      vouchers: (Array.isArray(loop.vouchers) ? loop.vouchers : []).slice(0, 12).flatMap((entry: unknown) => {
        const q = obj(entry), key = `${q.day}:${q.slot}`;
        if (!day(q.day) || ![0, 1, 2, 3].includes(q.slot) || ![150, 300, 600].includes(q.face) || voucherIds.has(key)) return [];
        const paid = [0, 40, 80, 100].includes(q.paid) ? q.paid : 100;
        const region: RegionId | undefined = regionIds.includes(q.region) ? q.region : paid ? 'valley' : undefined;
        voucherIds.add(key); return [{ day: q.day, slot: q.slot, face: q.face, paid, ...(region ? { region, quote: q.quote > 0 ? n(q.quote, 1320) : Math.floor(q.face * explorationTravel[region].payPercent / 100) } : {}) }];
      }),
      heartDays: (Array.isArray(loop.heartDays) ? loop.heartDays : []).slice(0, 3).flatMap((entry: unknown) => {
        const q = obj(entry); if (!day(q.day) || heartIds.has(q.day)) return [];
        heartIds.add(q.day); return [{ day: q.day, hours: n(q.hours, 4), claimed: q.claimed === true }];
      }), observations: Array.isArray(loop.observations) ? [...new Set<string>(loop.observations.filter((x: unknown) => typeof x === 'string' && /^[0-5]:[ab]$/.test(x)))] : [],
      milestones: [6, 12].filter(x => Array.isArray(loop.milestones) && loop.milestones.includes(x)), idleCompleted: n(loop.idleCompleted), firstTreasure: loop.firstTreasure === true };
  }
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
    id: label(p.id), rulesVersion: p.rulesVersion === 3 ? 3 : p.rulesVersion === 2 ? 2 : 1, mode: p.mode, route: pr, items: bag(p.items, p.mode === 'idle' && p.rulesVersion >= 2 ? 512 : capacity), overflow: p.selected ? {} : bag(p.overflow, 512), tool: p.tool === true,
    selected: p.selected === true, coins: n(p.coins, p.rulesVersion >= 2 ? 30000 : 300), hearts: n(p.hearts, p.rulesVersion >= 2 ? 10000 : 30), refundCoins: n(p.refundCoins, 1568), at: p.at,
    reason: p.reason === 'complete' || p.reason === 'health' ? p.reason : 'return', journal: journal(p.journal),
  };
  const a = obj(v.active), ar = route(a.route);
  if (!state.pending && label(a.id) && [1, 2, 3].includes(a.rulesVersion) && ar.length && (a.mode === 'manual' || a.mode === 'idle') && stamp(a.startedAt) && stamp(a.endsAt)) {
    const modern = a.rulesVersion >= 2, style = ['patrol', 'short', 'walk'].includes(a.style) ? a.style : 'patrol';
    const parts = a.mode === 'idle' ? modern ? [2, 4, 8].includes(a.parts) ? a.parts : 2 : a.parts === 3 ? 3 : 1 : 1;
    const region = ar[n(a.leg, ar.length - 1)], campStep = modern && region === 'valley' ? style === 'short' ? 2 : 6 : a.rulesVersion === 3 ? explorationTravel[region].actions : 3;
    const trip: ExpeditionTrip = { rulesVersion: a.rulesVersion, id: label(a.id), revision: n(a.revision), mode: a.mode, actorId: label(a.actorId), actorName: label(a.actorName),
      route: ar, leg: n(a.leg, ar.length - 1), step: n(a.step, campStep), bag: bag(a.bag, modern && a.mode === 'idle' ? 512 : capacity), ground: bag(a.ground, 512), tool: a.tool === true,
      rested: Array.isArray(a.rested) ? regionIds.filter(id => a.rested.includes(id)) : [], paused: a.mode === 'manual' && a.step === campStep && a.paused === true,
      startedAt: a.startedAt, endsAt: a.endsAt, parts, settledParts: n(a.settledParts, parts),
      coins: n(a.coins, modern ? 30000 : 300), hearts: n(a.hearts, modern ? 10000 : 30), journal: journal(a.journal),
      energySpent: n(a.energySpent, 10000), healthLost: amount(a.healthLost, 10000),
      paidActions: a.paidActions === undefined && a.rulesVersion < 3 ? style === 'walk' ? 0 : n(a.step, campStep) : n(a.paidActions, campStep),
      ...(modern ? { style, target: valleyGatherTargets.includes(a.target) ? a.target : 'valley_mushroom', harvestSpent: n(a.harvestSpent, 2), reservedHarvests: n(a.reservedHarvests, parts - n(a.settledParts, parts)), rationsRemaining: n(a.rationsRemaining, Math.max(0, Math.ceil(parts / 2) - 1)) } : {}),
      ...(a.rulesVersion === 3 && a.mode === 'idle' ? { rationSegments: normalizeRationSegments(a.rationSegments, parts) } : {}) };
    if (trip.mode === 'manual' || ar.length === 1 && trip.endsAt - trip.startedAt === trip.parts * 3600000) state.active = trip;
  }
  if (state.loop) state.loop.available = Math.min(state.loop.available, 24 - (state.active?.reservedHarvests ?? 0));
  const last = obj(v.lastReceipt), lr = route(last.route);
  if (label(last.id) && stamp(last.at) && lr.length) state.lastReceipt = { id: label(last.id), at: last.at, route: lr, reason: last.reason === 'complete' || last.reason === 'health' ? last.reason : 'return', journal: journal(last.journal) };
  for (const record of [state.active, state.pending, state.lastReceipt]) {
    if (record && /^expedition:\d+$/.test(record.id)) state.nextId = Math.max(state.nextId, Math.min(Number.MAX_SAFE_INTEGER, Number(record.id.split(':')[1]) + 1));
  }
  return state;
};
