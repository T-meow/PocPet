import type { CommunityState, CommissionTemplate, FishId, MarketListing } from './communityTypes';
import { commissionTemplates, facilityIds, fishIds } from './communityData';
import { getCommunitySale } from './communityEconomy';
import { defaultExpeditionState, normalizeExpeditionState } from './expeditionState';

export const defaultCommunityState = (): CommunityState => ({ schemaVersion: 3, expedition: defaultExpeditionState(), irrigationFound: false, herbDiscovered: false, repairStep: 0, gardenBuilt: false, firstOrderDelivered: false, seedForageDay: '', boardDay: '', acceptedToday: [], candidates: [], tasks: [],
  facilities: { coop: { found: false, work: 0, built: false }, barn: { found: false, work: 0, built: false }, fishing_hut: { found: false, work: 0, built: false }, upstream: { found: false, work: 0, built: false }, stall: { found: false, work: 0, built: false } },
  animals: { coop: { feed: 0, stock: 0, cycleMs: 21600000, cared: false, revision: 0 }, barn: { feed: 0, stock: 0, cycleMs: 28800000, cared: false, revision: 0 } },
  fishing: { casts: 0, journal: {} },
  market: { level: 0, open: false, lastVisitAt: 0, visitors: 0, nextListingId: 1, listings: [], reserve: {}, revenue: 0, premium: 0, sold: 0, log: [] },
});
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const taskId = (v: unknown): v is string => typeof v === 'string' && /^[a-z_]+:\d{4}-\d{2}-\d{2}$/.test(v) && commissionTemplates.includes(v.split(':')[0] as CommissionTemplate);
export const normalizeCommunityState = (raw: unknown): CommunityState => {
  const v = raw && typeof raw === 'object' ? raw as Partial<CommunityState> : {};
  const built = v.gardenBuilt === true;
  const state: CommunityState = { ...defaultCommunityState(), irrigationFound: built || v.irrigationFound === true,
    herbDiscovered: v.herbDiscovered === true, repairStep: built ? 2 : Number.isFinite(v.repairStep) ? Math.max(0, Math.min(2, Math.floor(v.repairStep!))) : 0,
    gardenBuilt: built, firstOrderDelivered: built && v.firstOrderDelivered === true, seedForageDay: day(v.seedForageDay), boardDay: day(v.boardDay),
    acceptedToday: Array.isArray(v.acceptedToday) ? [...new Set(v.acceptedToday.filter(taskId))].slice(0, 2) : [] };
  state.expedition = normalizeExpeditionState(v.expedition);
  const c = v.crop;
  if (built && c && (c.id === 'herb' || c.id === 'carrot' || c.id === 'berry') && Number.isFinite(c.plantedAt) && c.plantedAt >= 0 && Number.isFinite(c.readyAt) && c.readyAt >= c.plantedAt) state.crop = { id: c.id, plantedAt: c.plantedAt, readyAt: c.readyAt };
  const q = v.commission;
  if (q && typeof q.id === 'string' && /^search:\d{4}-\d{2}-\d{2}$/.test(q.id) && Number.isFinite(q.acceptedAt) && q.acceptedAt >= 0) state.commission = { id: q.id, acceptedAt: q.acceptedAt, found: q.found === true };
  state.candidates = Array.isArray(v.candidates) ? [...new Set(v.candidates.filter(id => commissionTemplates.includes(id)))].slice(0, 3) : [];
  const seen = new Set<string>();
  state.tasks = (Array.isArray(v.tasks) ? v.tasks : []).flatMap(task => {
    if (!task || !taskId(task.id) || task.template === 'search' || task.id.split(':')[0] !== task.template || !stamp(task.acceptedAt) || seen.has(task.id)) return [];
    seen.add(task.id);
    return [{ id: task.id, template: task.template, acceptedAt: task.acceptedAt, found: task.found === true }];
  }).slice(0, state.commission ? 1 : 2);
  for (const id of facilityIds) {
    const facility = object(object(v.facilities)[id]), built = facility.built === true;
    state.facilities[id] = { found: built || facility.found === true, work: built ? 2 : n(facility.work, 2), built };
  }
  for (const id of ['coop', 'barn'] as const) {
    if (!state.facilities[id].built) continue;
    const a = object(object(v.animals)[id]);
    state.animals[id] = { feed: n(a.feed, 3), stock: n(a.stock, 6), cycleMs: Math.max(id === 'coop' ? 19872000 : 26496000, n(a.cycleMs, id === 'coop' ? 21600000 : 28800000)), cared: a.cared === true, revision: n(a.revision) };
    if (stamp(a.nextAt) && a.feed > 0 && a.stock < 6) state.animals[id].nextAt = a.nextAt;
  }
  const f = object(v.fishing);
  state.fishing.casts = n(f.casts);
  for (const id of fishIds) {
    const entry = object(object(f.journal)[id]);
    if (n(entry.count) > 0 && stamp(entry.firstAt)) state.fishing.journal[id] = { count: n(entry.count), firstAt: entry.firstAt, largest: n(entry.largest, 200) };
  }
  const pending = object(f.pending);
  if (state.facilities.fishing_hut.built && typeof pending.id === 'string' && pending.id.length <= 128 && fishIds.includes(pending.fish)) state.fishing.pending = { id: pending.id, fish: pending.fish as FishId, size: n(pending.size, 200) };
  const active = object(f.active);
  if (!state.fishing.pending && state.facilities.fishing_hut.built && typeof active.id === 'string' && active.id.length <= 128 && fishIds.includes(active.fish) && (active.water === 'pond' || active.water === 'upstream' && state.facilities.upstream.built) && (active.phase === 'waiting' || active.phase === 'reeling') && stamp(active.biteAt) && stamp(active.expiresAt) && active.expiresAt > active.biteAt && stamp(active.lastActionAt)) {
    state.fishing.active = { id: active.id, water: active.water, fish: active.fish, size: n(active.size, 200), phase: active.phase, biteAt: active.biteAt, expiresAt: active.expiresAt, lastActionAt: active.lastActionAt, tension: n(active.tension, 100), progress: n(active.progress, 100), revision: n(active.revision), strongRod: active.strongRod === true };
  }
  const m = object(v.market), market = state.market;
  market.level = state.facilities.stall.built ? Math.max(1, n(m.level, 3)) : 0;
  market.open = market.level > 0 && m.open === true;
  market.lastVisitAt = n(m.lastVisitAt); market.visitors = n(m.visitors); market.revenue = n(m.revenue); market.premium = n(m.premium, market.revenue); market.sold = n(m.sold);
  market.reserve = Object.fromEntries(Object.entries(object(m.reserve)).filter(([id]) => getCommunitySale(id)).map(([id, value]) => [id, n(value, 9999)]));
  const listingIds = new Set<number>(); let space = market.level ? 3 + market.level * 3 : 0;
  market.listings = (Array.isArray(m.listings) ? m.listings : []).slice(0, 12).flatMap((listing: MarketListing) => {
    const sale = getCommunitySale(listing?.itemId), id = n(listing?.id), quantity = Math.min(space, n(listing?.quantity, 12));
    if (!sale || sale.exchangeOnly || !quantity || !id || listingIds.has(id)) return [];
    listingIds.add(id); space -= quantity;
    const bonus = Math.max(20, n(listing.bonus, 40));
    const basePrice = Math.max(1, n(listing.basePrice, 10000) || sale.base);
    return [{ id, itemId: listing.itemId, quantity, basePrice, bonus, unitPrice: Math.floor(basePrice * (100 + bonus) / 100), collector: sale.collector }];
  });
  market.nextListingId = Math.max(1, n(m.nextListingId), ...market.listings.map(listing => listing.id + 1));
  market.log = (Array.isArray(m.log) ? m.log : []).slice(0, 8).flatMap((entry: Record<string, unknown>) => typeof entry?.itemId === 'string' && getCommunitySale(entry.itemId) && stamp(entry.at) ? [{ itemId: entry.itemId, quantity: n(entry.quantity, 12), coins: n(entry.coins), at: entry.at }] : []);
  return state;
};
