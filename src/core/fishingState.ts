import { fish, fishIds, waterIds } from './communityData';
import type { CommunityState, FishingCatch, WaterId } from './communityTypes';
import { getFishingClicks, isGoldCrownFish } from './fishingRules';
import { isTravelFood, normalizeRationReturn } from './explorationRations';
import type { Inventory } from './petTypes';

const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const text = (v: unknown) => typeof v === 'string' ? v.slice(0, 128) : '';
const catches = (raw: unknown): FishingCatch[] => (Array.isArray(raw) ? raw : []).slice(0, 32).flatMap(v => {
  const c = obj(v);
  return fishIds.includes(c.fish) ? [{ fish: c.fish, size: n(c.size, 200), newRecord: c.newRecord === true, newCrown: c.newCrown === true }] : [];
});
export const normalizeFishingState = (raw: unknown, community: CommunityState): CommunityState['fishing'] => {
  const f = obj(raw), state: CommunityState['fishing'] = { casts: n(f.casts), nextIdleId: Math.max(1, n(f.nextIdleId)), journal: {} };
  for (const id of fishIds) {
    const entry = obj(obj(f.journal)[id]);
    if (n(entry.count) && stamp(entry.firstAt)) state.journal[id] = { count: n(entry.count), firstAt: entry.firstAt, largest: n(entry.largest, 200), ...(entry.goldCrown === true || isGoldCrownFish(id, n(entry.largest, 200)) ? { goldCrown: true } : typeof entry.goldCrown === 'boolean' ? { goldCrown: false } : {}) };
  }
  if (!community.facilities.fishing_hut.built) return state;
  const open = (water: unknown): water is WaterId => water === 'pond' || water === 'upstream' && community.facilities.upstream.built || (water === 'forest_pool' || water === 'coast_pier') && community.waterAccess[water].built;
  const p = obj(f.pending);
  if (text(p.id)) {
    // Convert the old basket once; subsequent claims use only the remaining items.
    const legacy = fishIds.includes(p.fish) && !p.items;
    const found: FishingCatch[] = legacy ? [{ fish: p.fish, size: n(p.size, 200), newRecord: false, newCrown: false }] : catches(p.catches);
    const items: Inventory = legacy ? { [p.fish]: 1 } : Object.fromEntries(Object.entries(obj(p.items)).filter(([id, count]) => (fishIds.includes(id as typeof fishIds[number]) || id === 'fishing_bait' || id === 'river_bait') && n(count)).map(([id, count]) => [id, n(count, 9999)]));
    if (Object.keys(items).length || p.mode === 'idle' && stamp(p.at)) state.pending = { id: text(p.id), mode: p.mode === 'idle' ? 'idle' : 'manual', catches: found, items, water: waterIds.includes(p.water) ? p.water : found[0] ? fish[found[0].fish].water : 'pond', at: n(p.at), reason: ['return', 'health', 'supplies'].includes(p.reason) ? p.reason : 'complete', ...(normalizeRationReturn(p.rationReturn) ? { rationReturn: normalizeRationReturn(p.rationReturn) } : {}) };
  }
  if (state.pending) return state;
  const a = obj(f.active);
  if (!text(a.id) || !open(a.water)) return state;
  const common = { id: text(a.id), water: a.water, revision: n(a.revision), strongRod: a.strongRod === true, hutLevel: Math.max(1, n(a.hutLevel, 5)) };
  if (a.mode === 'idle') {
    if (!stamp(a.startedAt) || !stamp(a.endsAt) || ![2, 4, 8].includes((a.endsAt - a.startedAt) / 3600000)) return state;
    const plannedCasts = (a.endsAt - a.startedAt) / 900000, settledCasts = n(a.settledCasts, plannedCasts), ration = obj(a.rationPlan);
    state.active = { ...common, mode: 'idle', actorId: text(a.actorId), actorName: text(a.actorName), bait: a.bait === 'river_bait' ? 'river_bait' : 'fishing_bait', startedAt: a.startedAt, endsAt: a.endsAt, plannedCasts, settledCasts, reservedBait: n(a.reservedBait, plannedCasts - settledCasts), catches: catches(a.catches), rationPlan: { food: Object.fromEntries(Object.entries(obj(ration.food)).filter(([id, count]) => isTravelFood(id) && n(count)).map(([id, count]) => [id, n(count, 8)])), coins: n(ration.coins, 10000), purchased: n(ration.purchased, 8) } };
  } else if (fishIds.includes(a.fish) && (a.phase === 'waiting' || a.phase === 'reeling') && stamp(a.biteAt) && stamp(a.lastActionAt)) {
    const requiredClicks = a.mode === 'manual' ? Math.max(2, n(a.requiredClicks, 4)) : getFishingClicks(common.strongRod, a.landingNet === true);
    state.active = { ...common, mode: 'manual', fish: a.fish, size: n(a.size, 200), phase: a.phase, biteAt: a.biteAt, lastActionAt: a.lastActionAt, requiredClicks, clicks: a.mode === 'manual' ? n(a.clicks, requiredClicks - 1) : Math.min(requiredClicks - 1, Math.floor(n(a.progress, 100) * requiredClicks / 100)), ...(a.landingNet === true ? { landingNet: true } : {}) };
  }
  return state;
};
