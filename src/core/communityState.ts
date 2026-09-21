import type { CommunityState, CommissionTemplate, FishId, MarketReceipt } from './communityTypes';
import { commissionTemplates, facilityIds, fishIds } from './communityData';
import { getCommunitySale } from './communityEconomy';
import { defaultExpeditionState, normalizeExpeditionState } from './expeditionState';
import { marketMaxVisitMs, marketSlotCount, marketStackLimit } from './communityMarketRules';
import { cropIds, wildIngredientIds } from './foodCatalog';
import { durableToolIds, toolDefinitions } from './fieldEquipmentData';
import { communityDecorationIds, regionalTreasureIds } from './regionalTreasures';
import { specialtyGoods, type SpecialtyItem } from './communitySpecialtyOrders';
import { getAnimalCapacity } from './communityUpgradeData';

export const defaultCommunityState = (): CommunityState => ({ schemaVersion: 8, expedition: defaultExpeditionState(), irrigationFound: false, herbDiscovered: false, repairStep: 0, gardenBuilt: false, firstOrderDelivered: false, seedForageDay: '', boardDay: '', acceptedToday: [], candidates: [], tasks: [],
  plots: [{ id: 1 }], upgrades: { garden: 1, coop: 1, barn: 1, fishing_hut: 1 },
  toolWear: {}, treasureResearch: {}, decorations: [], commissionsCompleted: 0, specialtyOrders: { acceptedDay: '', completed: 0 },
  discoveredCrops: [], waterAccess: { forest_pool: { found: false, built: false }, coast_pier: { found: false, built: false } }, forageResearch: {}, processing: { revision: 0 }, ranchDay: { day: '', cared: false, collected: false, claimed: false },
  facilities: { coop: { found: false, work: 0, built: false }, barn: { found: false, work: 0, built: false }, fishing_hut: { found: false, work: 0, built: false }, upstream: { found: false, work: 0, built: false }, stall: { found: false, work: 0, built: false } },
  animals: { coop: { feed: 0, stock: 0, cycleMs: 21600000, cared: false, revision: 0 }, barn: { feed: 0, stock: 0, cycleMs: 28800000, cared: false, revision: 0 } },
  fishing: { casts: 0, journal: {} },
  market: { level: 0, open: false, lastVisitAt: 0, visitors: 0, nextListingId: 1, seed: 0, nextVisitAt: undefined, remainingVisitMs: undefined, listings: [], reserve: {}, revenue: 0, premium: 0, sold: 0, log: [] },
});
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const taskId = (v: unknown): v is string => typeof v === 'string' && /^[a-z_]+:\d{4}-\d{2}-\d{2}$/.test(v) && commissionTemplates.includes(v.split(':')[0] as CommissionTemplate);
export const normalizeCommunityState = (raw: unknown, backpackCapacity = 24): CommunityState => {
  const v = raw && typeof raw === 'object' ? raw as Partial<CommunityState> : {};
  const built = v.gardenBuilt === true;
  const state: CommunityState = { ...defaultCommunityState(), irrigationFound: built || v.irrigationFound === true,
    herbDiscovered: v.herbDiscovered === true, repairStep: built ? 2 : Number.isFinite(v.repairStep) ? Math.max(0, Math.min(2, Math.floor(v.repairStep!))) : 0,
    gardenBuilt: built, firstOrderDelivered: built && v.firstOrderDelivered === true, seedForageDay: day(v.seedForageDay), boardDay: day(v.boardDay),
    acceptedToday: Array.isArray(v.acceptedToday) ? [...new Set(v.acceptedToday.filter(taskId))].slice(0, 2) : [] };
  state.expedition = normalizeExpeditionState(v.expedition, backpackCapacity);
  state.commissionsCompleted = n(v.commissionsCompleted);
  const specialty = object(v.specialtyOrders), order = object(specialty.active), item = order.item as SpecialtyItem;
  state.specialtyOrders = { acceptedDay: day(specialty.acceptedDay), completed: n(specialty.completed) };
  if (Object.prototype.hasOwnProperty.call(specialtyGoods, item) && day(order.day) && order.id === `specialty:${order.day}:${item}` && stamp(order.acceptedAt) && [3, 5].includes(order.multiplier) && order.quantity === specialtyGoods[item].quantity && order.unitPrice === specialtyGoods[item].base * order.multiplier) {
    state.specialtyOrders.active = { id: order.id, day: order.day, item, quantity: order.quantity, unitPrice: order.unitPrice, multiplier: order.multiplier, acceptedAt: order.acceptedAt };
    if (!state.specialtyOrders.acceptedDay) state.specialtyOrders.acceptedDay = order.day;
  }
  for (const id of ['garden', 'coop', 'barn', 'fishing_hut'] as const) state.upgrades[id] = Math.max(1, n(object(v.upgrades)[id], id === 'fishing_hut' ? 5 : 3));
  const legacyCrop = object(raw).crop;
  state.plots = Array.from({ length: state.upgrades.garden }, (_, index) => {
    const id = index + 1, saved = Array.isArray(v.plots) ? v.plots.find(plot => plot?.id === id) : undefined;
    const c = object(saved?.crop ?? (index === 0 && !Array.isArray(v.plots) ? legacyCrop : undefined));
    const crop = built && cropIds.includes(c.id) && stamp(c.plantedAt) && stamp(c.readyAt) && c.readyAt >= c.plantedAt
      ? { id: c.id, plantedAt: c.plantedAt, readyAt: c.readyAt, ...(c.watered === true ? { watered: true } : {}), ...(c.fertilized === true ? { fertilized: true } : {}) } : undefined;
    return { id, ...(crop ? { crop } : {}) };
  });
  for (const id of durableToolIds) { const wear = n(object(v.toolWear)[id], toolDefinitions[id].uses - 1); if (wear) state.toolWear[id] = wear; }
  for (const id of regionalTreasureIds) { const progress = n(object(v.treasureResearch)[id]); if (progress) state.treasureResearch[id] = progress; }
  state.decorations = communityDecorationIds.filter(id => Array.isArray(v.decorations) && v.decorations.includes(id));
  state.discoveredCrops = cropIds.filter(id => Array.isArray(v.discoveredCrops) && v.discoveredCrops.includes(id));
  for (const id of ['forest_pool', 'coast_pier'] as const) {
    const access = object(object(v.waterAccess)[id]);
    state.waterAccess[id] = { found: access.found === true || access.built === true, built: access.built === true };
  }
  for (const id of wildIngredientIds) if (object(v.forageResearch)[id]) state.forageResearch[id] = n(object(v.forageResearch)[id]);
  state.processing.revision = n(object(v.processing).revision);
  const ranch = object(v.ranchDay);
  state.ranchDay = { day: day(ranch.day), cared: ranch.cared === true, collected: ranch.collected === true, claimed: ranch.claimed === true };
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
    const capacity = getAnimalCapacity(state, id);
    state.animals[id] = { feed: n(a.feed, capacity.feed), stock: n(a.stock, capacity.stock), cycleMs: Math.max(id === 'coop' ? 19872000 : 26496000, n(a.cycleMs, id === 'coop' ? 21600000 : 28800000)), cared: a.cared === true, revision: n(a.revision) };
    if (stamp(a.nextAt) && a.feed > 0 && a.stock + 2 <= capacity.stock) state.animals[id].nextAt = a.nextAt;
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
  if (!state.fishing.pending && state.facilities.fishing_hut.built && typeof active.id === 'string' && active.id.length <= 128 && fishIds.includes(active.fish) && (active.water === 'pond' || active.water === 'upstream' && state.facilities.upstream.built || (active.water === 'forest_pool' || active.water === 'coast_pier') && state.waterAccess[active.water as 'forest_pool' | 'coast_pier'].built) && (active.phase === 'waiting' || active.phase === 'reeling') && stamp(active.biteAt) && stamp(active.expiresAt) && active.expiresAt > active.biteAt && stamp(active.lastActionAt)) {
    state.fishing.active = { id: active.id, water: active.water, fish: active.fish, size: n(active.size, 200), phase: active.phase, biteAt: active.biteAt, expiresAt: active.expiresAt, lastActionAt: active.lastActionAt, tension: n(active.tension, 100), progress: n(active.progress, 100), revision: n(active.revision), strongRod: active.strongRod === true, hutLevel: Math.max(1, n(active.hutLevel, 5)), ...(active.landingNet === true ? { landingNet: true } : {}) };
  }
  const m = object(v.market), market = state.market;
  market.level = state.facilities.stall.built ? Math.max(1, n(m.level, 3)) : 0;
  market.open = market.level > 0 && m.open === true;
  market.lastVisitAt = n(m.lastVisitAt); market.visitors = n(m.visitors); market.revenue = n(m.revenue); market.premium = n(m.premium, market.revenue); market.sold = n(m.sold);
  market.seed = n(m.seed, 0xffffffff);
  if (market.seed && stamp(m.nextVisitAt) && market.open) market.nextVisitAt = n(m.nextVisitAt);
  if (market.seed && market.nextVisitAt === undefined && stamp(m.remainingVisitMs)) market.remainingVisitMs = n(m.remainingVisitMs, marketMaxVisitMs);
  market.reserve = Object.fromEntries(Object.entries(object(m.reserve)).filter(([id]) => getCommunitySale(id)).map(([id, value]) => [id, n(value, 9999)]));
  const listingIds = new Set<number>(), slots = new Set<number>(), capacity = marketSlotCount(market.level);
  market.listings = (Array.isArray(m.listings) ? m.listings : []).slice(0, 12).flatMap((rawListing: unknown) => {
    const listing = object(rawListing), sale = getCommunitySale(listing.itemId), id = n(listing.id), quantity = n(listing.quantity, marketStackLimit);
    if (!sale || sale.exchangeOnly || !quantity || !id || listingIds.has(id) || slots.size >= capacity) return [];
    const savedSlot = listing.slotIndex;
    const slotIndex = Number.isInteger(savedSlot) && savedSlot >= 0 && savedSlot < capacity && !slots.has(savedSlot) ? savedSlot
      : Array.from({ length: capacity }, (_, index) => index).find(index => !slots.has(index))!;
    listingIds.add(id); slots.add(slotIndex);
    const bonus = Math.max(20, n(listing.bonus, 40));
    const basePrice = Math.max(1, n(listing.basePrice, 10000) || sale.base);
    // A slot keeps its exact historical quote, including after replenishment.
    const unitPrice = n(listing.unitPrice, 14000) || Math.floor(basePrice * (100 + bonus) / 100);
    return [{ id, slotIndex, itemId: listing.itemId, quantity, basePrice, bonus, unitPrice, collector: sale.collector }];
  }).sort((a, b) => a.slotIndex - b.slotIndex);
  market.nextListingId = Math.max(1, n(m.nextListingId), ...market.listings.map(listing => listing.id + 1));
  market.log = (Array.isArray(m.log) ? m.log : []).slice(0, 8).flatMap((rawEntry: unknown): MarketReceipt[] => {
    const entry = object(rawEntry);
    if (!stamp(entry.at)) return [];
    const legacy = !Array.isArray(entry.items);
    const items = (legacy ? [entry] : entry.items).slice(0, 12).flatMap((rawItem: unknown): MarketReceipt['items'] => {
      const item = object(rawItem), quantity = n(item.quantity, 12 * marketStackLimit);
      return typeof item.itemId === 'string' && getCommunitySale(item.itemId) && quantity ? [{ itemId: item.itemId, quantity, coins: n(item.coins) }] : [];
    });
    if (!items.length) return [];
    const customer = !legacy && ['ordinary', 'foodie', 'collector', 'generous'].includes(entry.customer) ? entry.customer : 'legacy';
    return [{ visit: legacy ? 0 : n(entry.visit), customer, buyout: customer === 'generous' && entry.buyout === true, at: n(entry.at), coins: n(entry.coins), items }];
  });
  return state;
};
