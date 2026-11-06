import { recordEarnedCoins } from './achievements';
import { marketPricingVersion } from './communityEconomy';
import { getMarketSale } from './marketValuation';
import { getDecorationEffects, getDecorationLevel, getDecorationMarketTrafficBonus } from './decorationEffects';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { clampCoins } from './petStats';
import type { ItemRegistry, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import type { CommunityMarket, MarketReceipt } from './communityTypes';
import { createMarketSeed, getMarketBuyoutBonusForLevels, getMarketVisit, getMarketVarietyMultiplier, marketMaxLevel, marketRandom, marketRestockIntervalMs, marketSlotCount, marketStackLimit } from './communityMarketRules';
import { getCommunityUpgradeQuote } from './communityUpgradeData';
import { getDailyResetDateKey } from './dailyReset';
import { canDoFarmWork, getFarmNeighborStatus } from './farmNeighbor';
import { toolDefinitions } from './fieldEquipmentData';

export const getMarketCapacity = (pet: PetState) => marketSlotCount(pet.community.market.level);
export const getMarketBuyoutBonus = (pet: Pick<PetState, 'community' | 'partnerSchedule'>) =>
  getMarketBuyoutBonusForLevels(pet.partnerSchedule.skills.cooking.level, getDecorationLevel(pet, 'golden_sign'));
export const getMarketTrafficBonus = (pet: Pick<PetState, 'community'>) => {
  const sign = getDecorationMarketTrafficBonus('golden_sign', getDecorationLevel(pet, 'golden_sign'));
  const lantern = getDecorationMarketTrafficBonus('amber_lantern', getDecorationLevel(pet, 'amber_lantern'));
  const fountain = getDecorationMarketTrafficBonus('creek_fountain', getDecorationLevel(pet, 'creek_fountain'));
  return { sign, lantern, fountain, total: sign + lantern + fountain };
};
export const getMarketVariety = (market: CommunityMarket) => {
  const count = new Set(market.listings.filter(listing => listing.quantity > 0).map(listing => listing.itemId)).size;
  return { count, multiplier: count ? getMarketVarietyMultiplier(count) : 0 };
};
export const getMarketQuote = (pet: PetState, id: string, registry?: ItemRegistry) => {
  const sale = getMarketSale(id, registry);
  const knowledge = Math.min(10, Math.floor(pet.partnerSchedule.skills.study.level / 2) * 2), building = Math.max(0, Math.min(marketMaxLevel, pet.community.market.level) - 1) * 5;
  const bonus = 20 + knowledge + building;
  if (!sale) return undefined;
  const original = Math.floor(sale.base * (100 + bonus) / 100);
  const decoration = getDecorationEffects(pet).golden_sign;
  const price = Math.max(1, Math.floor(Math.min(sale.priceCap ?? Number.MAX_SAFE_INTEGER, original * (1000 + Math.round(decoration * 10)) / 1000)));
  return { ...sale, knowledge, building, bonus: Math.round((price / sale.base - 1) * 100), decoration, decorationCoins: Math.max(0, price - Math.min(original, sale.priceCap ?? original)), price };
};
// Bait/rations and expedition tools are already removed when reserved. Fishing
// rods stay in the warehouse, so keep the uses needed by the active session.
export const getCommunitySaleable = (pet: PetState, id: string) => {
  const fishing = pet.community.fishing.active;
  let reserved = 0;
  if (fishing) {
    const rod = fishing.strongRod ? 'reinforced_rod' : 'fishing_rod';
    if (id === rod) reserved = fishing.mode === 'idle'
      ? Math.ceil((fishing.plannedCasts - fishing.settledCasts + (pet.community.toolWear[rod] ?? 0)) / toolDefinitions[rod].uses) : 1;
    if (fishing.mode === 'manual' && (id === 'fishing_float' || id === 'landing_net' && fishing.landingNet)) reserved = 1;
  }
  return Math.max(0, (pet.inventory[id] ?? 0) - reserved);
};

/** One manual transaction fills one slot, retaining that slot's tagged price. */
export const getMarketListingOffer = (pet: PetState, itemId: string, selectedSlot?: number, registry?: ItemRegistry) => {
  const quote = getMarketQuote(pet, itemId, registry), market = pet.community.market;
  if (!market.level || !quote) return undefined;
  const existing = selectedSlot === undefined ? market.listings.filter(listing => listing.itemId === itemId && listing.quantity < marketStackLimit)
    .sort((a, b) => a.slotIndex - b.slotIndex)[0]
    : market.listings.find(listing => listing.slotIndex === selectedSlot);
  if (existing && existing.itemId !== itemId) return undefined;
  const slotIndex = selectedSlot ?? existing?.slotIndex ?? Array.from({ length: getMarketCapacity(pet) }, (_, index) => index)
    .find(index => !market.listings.some(listing => listing.slotIndex === index));
  if (slotIndex === undefined || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= getMarketCapacity(pet)) return undefined;
  return {
    slotIndex, listingId: existing?.id,
    unitPrice: existing?.unitPrice ?? quote.price, basePrice: existing?.basePrice ?? quote.base,
    bonus: existing?.bonus ?? quote.bonus, collector: existing?.collector ?? quote.collector,
    quantityLimit: Math.min(getCommunitySaleable(pet, itemId), marketStackLimit - (existing?.quantity ?? 0)),
  };
};

// Coins have no gameplay cap; keep all monetary arithmetic within exact integers.
const walletRoom = (coins: number) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, clampCoins(Number.MAX_SAFE_INTEGER)) - coins);
const refundRemovedMarketSlots = (pet: PetState): PetState => {
  const market = pet.community.market;
  if (pet.timePause || !(market.slotRefundCoins > 0)) return pet;
  const coins = Math.min(market.slotRefundCoins, walletRoom(pet.coins));
  if (!coins) return pet;
  return { ...pet, coins: pet.coins + coins, community: { ...pet.community, market: { ...market, slotRefundCoins: market.slotRefundCoins - coins } },
    recentEvent: `小摊已调整为最多 9 栏、每栏 ${marketStackLimit} 件，双倍金币补偿到账 ${coins} 金币。${market.slotRefundCoins > coins ? '剩余补偿保留，金币空间足够后继续入账。' : '容量内的货品继续保留。'}` };
};
const syncMarketClock = (pet: PetState, market: CommunityMarket, coins: number, now: number, anchor = now): CommunityMarket => {
  const seed = market.seed || createMarketSeed(`market:${pet.saveMetadata.id}:${pet.createdAt}`);
  const running = market.open && market.listings.some(listing => listing.quantity > 0 && listing.unitPrice <= walletRoom(coins));
  const duration = Math.round(getMarketVisit(seed, market.visitors, getMarketTrafficBonus(pet).total).delayMs / getMarketVarietyMultiplier(getMarketVariety(market).count));
  const oldDuration = market.visitDurationMs ?? duration;
  let remaining = market.nextVisitAt === undefined ? market.remainingVisitMs ?? duration : market.nextVisitAt - now;
  if (oldDuration !== duration) remaining = Math.round(Math.max(0, remaining) * duration / oldDuration);
  // An overdue visitor keeps its actual event time, including across midnight.
  const nextVisitAt = running ? (market.nextVisitAt !== undefined && (oldDuration === duration || market.nextVisitAt <= now) ? market.nextVisitAt : anchor + remaining) : undefined;
  const remainingVisitMs = running ? undefined : Math.max(0, remaining);
  if (market.seed === seed && market.nextVisitAt === nextVisitAt && market.remainingVisitMs === remainingVisitMs && market.visitDurationMs === duration) return market;
  return { ...market, seed, lastVisitAt: market.lastVisitAt || anchor, nextVisitAt, remainingVisitMs, visitDurationMs: duration };
};

// Historical settlement must use the event's day, not today's anti-replay
// watermark: a hire can expire while the game is offline.
const helpActiveAt = (pet: PetState, at: number) => {
  const help = pet.community.farmNeighbor, day = getDailyResetDateKey(at);
  return Boolean(help && day >= help.hiredDay && day < help.expiresDay);
};
const syncRestockClock = (pet: PetState, market: CommunityMarket, now: number): CommunityMarket => {
  const active = !pet.timePause && market.open && getFarmNeighborStatus(pet, now).active && market.listings.some(slot => slot.autoRestock);
  const nextRestockAt = active ? market.nextRestockAt ?? now + marketRestockIntervalMs : undefined;
  return nextRestockAt === market.nextRestockAt ? market : { ...market, nextRestockAt };
};

const settleCommunityMarket = (pet: PetState, now: number): PetState => {
  const original = pet.community.market;
  if (pet.timePause || !original.open || !original.level || !Number.isFinite(now) || now < original.lastVisitAt) return pet;
  // Legacy saves begin from their last settled checkpoint. A paused/new shop
  // resumes from now, so today's newly listed stock can never sell yesterday.
  const anchor = !original.seed && original.lastVisitAt > 0 ? original.lastVisitAt : now;
  const buyoutBonus = getMarketBuyoutBonus(pet).total;
  const trafficBonus = getMarketTrafficBonus(pet).total;
  let market = syncMarketClock(pet, original, pet.coins, now, anchor), coins = pet.coins, inventory = pet.inventory;
  while (Math.min(market.nextVisitAt ?? Infinity, market.nextRestockAt ?? Infinity) <= now) {
    const at = Math.min(market.nextVisitAt ?? Infinity, market.nextRestockAt ?? Infinity);
    if (market.nextRestockAt === at) {
      if (!helpActiveAt(pet, at) || !market.listings.some(slot => slot.autoRestock)) {
        market = { ...market, nextRestockAt: undefined };
        continue;
      }
      let added = 0;
      const listings = [...market.listings].sort((a, b) => a.slotIndex - b.slotIndex).map(slot => {
        const quantity = slot.autoRestock ? Math.min(marketStackLimit - slot.quantity, getCommunitySaleable({ ...pet, inventory }, slot.itemId)) : 0;
        if (!quantity) return slot;
        inventory = removeInventoryItem(inventory, slot.itemId, quantity);
        added += quantity;
        return { ...slot, quantity: slot.quantity + quantity };
      });
      market = syncMarketClock(pet, { ...market, listings, nextListingId: market.nextListingId + (added ? 1 : 0), nextRestockAt: at + marketRestockIntervalMs }, coins, at);
      continue;
    }
    const visit = getMarketVisit(market.seed, market.visitors, trafficBonus, buyoutBonus);
    const visitDay = getDailyResetDateKey(at);
    const buyout = visit.buyout && visitDay > market.lastBuyoutDay;
    let listings = market.listings.map(listing => ({ ...listing })).sort((a, b) => a.slotIndex - b.slotIndex);
    const items: MarketReceipt['items'] = [];
    const basket: { listing: typeof listings[number]; quantity: number; amount: number }[] = [];
    let basketCoins = 0, basketQuantity = 0;
    let revenue = 0, premium = 0, sold = 0;
    const select = (listing: typeof listings[number], requested: number) => {
      const quantity = Math.min(listing.quantity, requested, Math.floor(walletRoom(coins + basketCoins) / listing.unitPrice));
      if (quantity <= 0) return;
      const amount = quantity * listing.unitPrice;
      basket.push({ listing, quantity, amount });
      basketCoins += amount; basketQuantity += quantity;
    };
    if (visit.customer === 'generous') {
      const shelves = listings.filter(listing => listing.quantity > 0);
      if (!buyout) {
        for (let index = shelves.length - 1; index > 0; index--) {
          const other = Math.floor(marketRandom(market.seed, market.visitors, 4 + index) * (index + 1));
          [shelves[index], shelves[other]] = [shelves[other], shelves[index]];
        }
      }
      for (const listing of shelves) select(listing, buyout ? listing.quantity : Math.max(0, visit.quantity - basketQuantity));
    } else {
      const affordable = listings.filter(listing => listing.quantity > 0 && listing.unitPrice <= walletRoom(coins));
      const rare = affordable.filter(listing => listing.collector);
      const candidates = visit.customer === 'collector' && rare.length ? rare : affordable;
      if (candidates.length) {
        const listing = candidates[Math.floor(marketRandom(market.seed, market.visitors, 4) * candidates.length)];
        select(listing, visit.quantity);
      }
    }
    // Visitor frequency and basket sizes control turnover, independent of price.
    for (const { listing, quantity, amount } of basket) {
      const item = items.find(item => item.itemId === listing.itemId);
      if (item) { item.quantity += quantity; item.coins += amount; }
      else items.push({ itemId: listing.itemId, quantity, coins: amount });
      listing.quantity -= quantity;
      revenue += amount; premium += quantity * Math.max(0, listing.unitPrice - listing.basePrice); sold += quantity;
    }
    const visitors = market.visitors + 1;
    const receipt: MarketReceipt = { visit: visitors, customer: visit.customer, buyout: buyout && listings.every(slot => slot.quantity === 0), at, coins: revenue, items };
    coins += revenue;
    market = { ...market, listings, visitors, lastVisitAt: at, nextVisitAt: undefined, remainingVisitMs: undefined, visitDurationMs: undefined,
      lastBuyoutDay: buyout && sold > 0 ? visitDay : market.lastBuyoutDay,
      // This counter also invalidates stale manual-listing quotes after a sale.
      nextListingId: market.nextListingId + (sold ? 1 : 0),
      revenue: market.revenue + revenue, sessionRevenue: market.sessionRevenue + revenue, premium: market.premium + premium, sold: market.sold + sold,
      log: sold ? [receipt, ...market.log].slice(0, 8) : market.log };
    // Stop at the actual sale time when stock/wallet space runs out, retaining
    // the next wait in full. This is identical for split and lumped offline time.
    market = syncMarketClock(pet, market, coins, at);
  }
  market = syncRestockClock(pet, market, now);
  if (market === original) return pet;
  const next = { ...pet, coins, inventory, community: { ...pet.community, market } };
  return coins > pet.coins ? recordEarnedCoins(next, coins - pet.coins) : next;
};
/** Called only after old-price catch-up, or without advancing a paused save. */
export const migrateCommunityMarketPricing = (pet: PetState): PetState => {
  const market = pet.community.market;
  if (market.pricingVersion >= marketPricingVersion) return pet;
  const listings = market.listings.map(listing => {
    const quote = getMarketQuote(pet, listing.itemId);
    return quote ? { ...listing, basePrice: quote.base, unitPrice: quote.price, bonus: quote.bonus, collector: quote.collector } : listing;
  });
  return { ...pet, community: { ...pet.community, market: { ...market, listings, pricingVersion: marketPricingVersion,
    nextListingId: market.nextListingId + (listings.length ? 1 : 0) } } };
};
export const advanceCommunityMarket = (pet: PetState, now: number): PetState => {
  if (!Number.isFinite(now)) return pet;
  pet = refundRemovedMarketSlots(pet);
  if (pet.timePause) return migrateCommunityMarketPricing({ ...pet, community: { ...pet.community, market: { ...pet.community.market, nextRestockAt: undefined } } });
  if (now < pet.community.market.lastVisitAt) return pet;
  return migrateCommunityMarketPricing(settleCommunityMarket(pet, now));
};
export const listCommunityGoods = (pet: PetState, id: string, quantity: number, expectedListingId: number, now = Date.now(), slotIndex?: number, registry?: ItemRegistry): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, offer = getMarketListingOffer(pet, id, slotIndex, registry);
  if (!canDoFarmWork(pet, now) || !offer || m.nextListingId !== expectedListingId || !Number.isInteger(quantity) || quantity < 1 || quantity > offer.quantityLimit) return pet;
  const listings = offer.listingId !== undefined
    ? m.listings.map(listing => listing.id === offer.listingId ? { ...listing, quantity: listing.quantity + quantity } : listing)
    : [...m.listings, { id: m.nextListingId, slotIndex: offer.slotIndex, itemId: id, quantity, unitPrice: offer.unitPrice, basePrice: offer.basePrice, bonus: offer.bonus, collector: offer.collector, autoRestock: false }].sort((a, b) => a.slotIndex - b.slotIndex);
  const market = syncMarketClock(pet, { ...m, listings, nextListingId: m.nextListingId + 1 }, pet.coins, now);
  return { ...pet, inventory: removeInventoryItem(pet.inventory, id, quantity), community: { ...pet.community, market },
    recentEvent: `${offer.listingId === undefined ? '上架' : '补货'} ${quantity} 份至第 ${offer.slotIndex + 1} 格，固定每份 ${offer.unitPrice} 金币。售出后自动结算。` };
};
export const unlistCommunityGoods = (pet: PetState, id: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, listing = m.listings.find(entry => entry.id === id);
  if (!listing || !canDoFarmWork(pet, now)) return pet;
  if ((pet.inventory[listing.itemId] ?? 0) + listing.quantity > inventoryItemLimit) return { ...pet, recentEvent: '仓库空间不足，货品继续保留在货架；可以先闭店。' };
  const market = syncRestockClock(pet, syncMarketClock(pet, { ...m, nextListingId: m.nextListingId + 1, listings: m.listings.filter(entry => entry.id !== id) }, pet.coins, now), now);
  return { ...pet, inventory: addInventoryItem(pet.inventory, listing.itemId, listing.quantity), community: { ...pet.community, market }, recentEvent: '未售出的货品已退回共用仓库。' };
};
export const configureMarketSlot = (pet: PetState, slotIndex: number, itemId: string, registry?: ItemRegistry, now = Date.now()): PetState => {
  if (!canDoFarmWork(pet, now) || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, quote = getMarketQuote(pet, itemId, registry);
  if (!quote || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= getMarketCapacity(pet)) return pet;
  const previous = m.listings.find(slot => slot.slotIndex === slotIndex);
  if (previous && (pet.inventory[previous.itemId] ?? 0) + previous.quantity > inventoryItemLimit) return { ...pet, recentEvent: '仓库放不下剩余商品，请先腾出空间再修改槽位。' };
  const inventory = previous ? addInventoryItem(pet.inventory, previous.itemId, previous.quantity) : pet.inventory;
  const listings = [...m.listings.filter(slot => slot.slotIndex !== slotIndex), { id: m.nextListingId, slotIndex, itemId, quantity: 0, unitPrice: quote.price, basePrice: quote.base, bonus: quote.bonus, collector: quote.collector, autoRestock: previous?.autoRestock ?? false }].sort((a, b) => a.slotIndex - b.slotIndex);
  const market = syncRestockClock(pet, syncMarketClock(pet, { ...m, listings, nextListingId: m.nextListingId + 1 }, pet.coins, now), now);
  return { ...pet, inventory, community: { ...pet.community, market }, recentEvent: `第 ${slotIndex + 1} 格已选定商品，售罄后也会保留选品。` };
};
export const setMarketAutoRestock = (pet: PetState, slotIndex: number, enabled: boolean, now = Date.now()): PetState => {
  if (!canDoFarmWork(pet, now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, slot = m.listings.find(entry => entry.slotIndex === slotIndex);
  if (!slot || enabled && !getFarmNeighborStatus(pet, now).active) return pet;
  const listings = m.listings.map(entry => entry === slot ? { ...entry, autoRestock: enabled } : entry);
  return { ...pet, community: { ...pet.community, market: syncRestockClock(pet, { ...m, listings }, now) }, recentEvent: enabled ? `第 ${slotIndex + 1} 格已开启自动补货，每 5 分钟补至 ${marketStackLimit} 件。` : `第 ${slotIndex + 1} 格已关闭自动补货。` };
};
export const setCommunityMarketOpen = (pet: PetState, open: boolean, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market;
  if (!m.level || m.open === open) return pet;
  return { ...pet, community: { ...pet.community, market: syncRestockClock(pet, syncMarketClock(pet, { ...m, open, sessionRevenue: open ? 0 : m.sessionRevenue }, pet.coins, now), now) }, recentEvent: open ? '小摊营业中，摆满 6 种有货商品可恢复正常客流，装饰还能增加客流。离线也会继续营业。' : '小摊已经闭店，选品、货品和剩余等待时间都已保留，自动补货暂停。' };
};
export const upgradeCommunityMarket = (pet: PetState, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt || now < pet.community.market.lastVisitAt || !canSpendCompanionTime(pet)) return pet;
  const quote = getCommunityUpgradeQuote(pet, 'stall', expectedLevel);
  if (!quote.ready || !quote.task) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, { coins, items } = quote.task;
  const market = syncMarketClock(pet, { ...m, level: m.level + 1, nextListingId: m.nextListingId + 1 }, pet.coins - coins, now);
  return { ...pet, coins: pet.coins - coins, inventory: Object.entries(items).reduce((inventory, [item, quantity]) => removeInventoryItem(inventory, item, quantity), pet.inventory), community: { ...pet.community, market }, recentEvent: `小摊扩建了：增加 3 个栏位，每格最多 ${marketStackLimit} 件；新上架增值 +5 个百分点，已有栏位保持原价。` };
};
