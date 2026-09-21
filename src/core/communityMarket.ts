import { recordEarnedCoins } from './achievements';
import { getCommunitySale } from './communityEconomy';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { clampCoins } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import type { CommunityMarket, MarketReceipt } from './communityTypes';
import { createMarketSeed, getMarketVisit, marketRandom, marketSlotCount, marketStackLimit } from './communityMarketRules';
import { getCommunityUpgradeQuote } from './communityUpgradeData';

export const getMarketCapacity = (pet: PetState) => marketSlotCount(pet.community.market.level);
export const getMarketQuote = (pet: PetState, id: string) => {
  const sale = getCommunitySale(id);
  const knowledge = Math.min(10, Math.floor(pet.partnerSchedule.skills.study.level / 2) * 2), building = Math.max(0, pet.community.market.level - 1) * 5;
  const bonus = 20 + knowledge + building;
  return sale ? { ...sale, knowledge, building, bonus, price: sale.exchangeOnly ? sale.base : Math.floor(sale.base * (100 + bonus) / 100) } : undefined;
};
// Old saves may retain reserve entries; explicit listing and recycling use current stock.
export const getCommunitySaleable = (pet: PetState, id: string) => Math.max(0, pet.inventory[id] ?? 0);

/** One manual transaction fills one slot, retaining that slot's tagged price. */
export const getMarketListingOffer = (pet: PetState, itemId: string) => {
  const quote = getMarketQuote(pet, itemId), market = pet.community.market;
  if (!market.level || !quote || quote.exchangeOnly) return undefined;
  const existing = market.listings.filter(listing => listing.itemId === itemId && listing.quantity < marketStackLimit)
    .sort((a, b) => a.slotIndex - b.slotIndex)[0];
  const slotIndex = existing?.slotIndex ?? Array.from({ length: getMarketCapacity(pet) }, (_, index) => index)
    .find(index => !market.listings.some(listing => listing.slotIndex === index));
  if (slotIndex === undefined) return undefined;
  return {
    slotIndex, listingId: existing?.id,
    unitPrice: existing?.unitPrice ?? quote.price, basePrice: existing?.basePrice ?? quote.base,
    bonus: existing?.bonus ?? quote.bonus, collector: existing?.collector ?? quote.collector,
    quantityLimit: Math.min(getCommunitySaleable(pet, itemId), marketStackLimit - (existing?.quantity ?? 0)),
  };
};

// Coins have no gameplay cap; keep all monetary arithmetic within exact integers.
const walletRoom = (coins: number) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, clampCoins(Number.MAX_SAFE_INTEGER)) - coins);
const syncMarketClock = (pet: PetState, market: CommunityMarket, coins: number, now: number, anchor = now): CommunityMarket => {
  const seed = market.seed || createMarketSeed(`market:${pet.saveMetadata.id}:${pet.createdAt}`);
  const running = market.open && market.listings.some(listing => listing.unitPrice <= walletRoom(coins));
  if (market.nextVisitAt !== undefined) {
    if (running) return market.seed === seed ? market : { ...market, seed };
    return { ...market, seed, nextVisitAt: undefined, remainingVisitMs: Math.max(0, market.nextVisitAt - now) };
  }
  const delay = market.remainingVisitMs ?? getMarketVisit(seed, market.visitors).delayMs;
  if (!running && market.seed === seed && market.remainingVisitMs === delay) return market;
  return { ...market, seed, lastVisitAt: market.lastVisitAt || anchor,
    nextVisitAt: running ? anchor + delay : undefined, remainingVisitMs: running ? undefined : delay };
};

export const advanceCommunityMarket = (pet: PetState, now: number): PetState => {
  const original = pet.community.market;
  if (pet.timePause || !original.open || !original.level || !Number.isFinite(now) || now < original.lastVisitAt) return pet;
  // Legacy saves begin from their last settled checkpoint. A paused/new shop
  // resumes from now, so today's newly listed stock can never sell yesterday.
  const anchor = !original.seed && original.lastVisitAt > 0 ? original.lastVisitAt : now;
  let market = syncMarketClock(pet, original, pet.coins, now, anchor), coins = pet.coins;
  while (market.nextVisitAt !== undefined && market.nextVisitAt <= now) {
    const at = market.nextVisitAt, visit = getMarketVisit(market.seed, market.visitors);
    let listings = market.listings.map(listing => ({ ...listing })).sort((a, b) => a.slotIndex - b.slotIndex);
    const items: MarketReceipt['items'] = [];
    let revenue = 0, premium = 0, sold = 0;
    const purchase = (listing: typeof listings[number], requested: number) => {
      const quantity = Math.min(listing.quantity, requested, Math.floor(walletRoom(coins + revenue) / listing.unitPrice));
      if (quantity <= 0) return;
      const amount = quantity * listing.unitPrice, item = items.find(item => item.itemId === listing.itemId);
      if (item) { item.quantity += quantity; item.coins += amount; }
      else items.push({ itemId: listing.itemId, quantity, coins: amount });
      listing.quantity -= quantity;
      revenue += amount; premium += quantity * (listing.unitPrice - listing.basePrice); sold += quantity;
    };
    if (visit.customer === 'generous') {
      const shelves = [...listings];
      if (!visit.buyout) {
        for (let index = shelves.length - 1; index > 0; index--) {
          const other = Math.floor(marketRandom(market.seed, market.visitors, 4 + index) * (index + 1));
          [shelves[index], shelves[other]] = [shelves[other], shelves[index]];
        }
      }
      for (const listing of shelves) purchase(listing, visit.buyout ? listing.quantity : Math.max(0, visit.quantity - sold));
    } else {
      const affordable = listings.filter(listing => listing.unitPrice <= walletRoom(coins));
      const rare = affordable.filter(listing => listing.collector);
      const candidates = visit.customer === 'collector' && rare.length ? rare : affordable.filter(listing => !listing.collector && (getCommunitySale(listing.itemId)?.demand !== 'premium' || visit.customer === 'foodie'));
      if (candidates.length) {
        const listing = candidates[Math.floor(marketRandom(market.seed, market.visitors, 4) * candidates.length)];
        const demand = getCommunitySale(listing.itemId)?.demand;
        const draw = marketRandom(market.seed, market.visitors, 3);
        purchase(listing, demand === 'premium' ? 1 : demand === 'specialty' ? 1 + Math.floor(draw * 2) : demand === 'collector' ? visit.quantity : 2 + Math.floor(draw * 3));
      }
    }
    listings = listings.filter(listing => listing.quantity > 0);
    const visitors = market.visitors + 1;
    const receipt: MarketReceipt = { visit: visitors, customer: visit.customer, buyout: visit.buyout && !listings.length, at, coins: revenue, items };
    coins += revenue;
    market = { ...market, listings, visitors, lastVisitAt: at, nextVisitAt: at + getMarketVisit(market.seed, visitors).delayMs,
      // This counter also invalidates stale manual-listing quotes after a sale.
      nextListingId: market.nextListingId + (sold ? 1 : 0),
      revenue: market.revenue + revenue, premium: market.premium + premium, sold: market.sold + sold,
      log: sold ? [receipt, ...market.log].slice(0, 8) : market.log };
    // Stop at the actual sale time when stock/wallet space runs out, retaining
    // the next wait in full. This is identical for split and lumped offline time.
    market = syncMarketClock(pet, market, coins, at);
  }
  if (market === original) return pet;
  const next = { ...pet, coins, community: { ...pet.community, market } };
  return coins > pet.coins ? recordEarnedCoins(next, coins - pet.coins) : next;
};
export const listCommunityGoods = (pet: PetState, id: string, quantity: number, expectedListingId: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, offer = getMarketListingOffer(pet, id);
  if (!canSpendCompanionTime(pet) || !offer || m.nextListingId !== expectedListingId || !Number.isInteger(quantity) || quantity < 1 || quantity > offer.quantityLimit) return pet;
  const listings = offer.listingId !== undefined
    ? m.listings.map(listing => listing.id === offer.listingId ? { ...listing, quantity: listing.quantity + quantity } : listing)
    : [...m.listings, { id: m.nextListingId, slotIndex: offer.slotIndex, itemId: id, quantity, unitPrice: offer.unitPrice, basePrice: offer.basePrice, bonus: offer.bonus, collector: offer.collector }].sort((a, b) => a.slotIndex - b.slotIndex);
  const market = syncMarketClock(pet, { ...m, listings, nextListingId: m.nextListingId + 1 }, pet.coins, now);
  return { ...pet, inventory: removeInventoryItem(pet.inventory, id, quantity), community: { ...pet.community, market },
    recentEvent: `${offer.listingId === undefined ? '上架' : '补货'} ${quantity} 份至第 ${offer.slotIndex + 1} 格，固定每份 ${offer.unitPrice} 金币。售出后自动结算。` };
};
export const unlistCommunityGoods = (pet: PetState, id: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, listing = m.listings.find(entry => entry.id === id);
  if (!listing || !canSpendCompanionTime(pet)) return pet;
  if ((pet.inventory[listing.itemId] ?? 0) + listing.quantity > inventoryItemLimit) return { ...pet, recentEvent: '仓库空间不足，货品继续保留在货架；可以先闭店。' };
  const market = syncMarketClock(pet, { ...m, nextListingId: m.nextListingId + 1, listings: m.listings.filter(entry => entry.id !== id) }, pet.coins, now);
  return { ...pet, inventory: addInventoryItem(pet.inventory, listing.itemId, listing.quantity), community: { ...pet.community, market }, recentEvent: '未售出的货品已退回共用仓库。' };
};
export const setCommunityMarketOpen = (pet: PetState, open: boolean, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.community.market.lastVisitAt) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market;
  if (!m.level || m.open === open) return pet;
  return { ...pet, community: { ...pet.community, market: syncMarketClock(pet, { ...m, open }, pet.coins, now) }, recentEvent: open ? '小摊营业中，客人每隔 5–20 分钟随机到访，还有慷慨游客带来大单。离线也会继续营业。' : '小摊已经闭店，货品和剩余等待时间都已保留。' };
};
export const upgradeCommunityMarket = (pet: PetState, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt || now < pet.community.market.lastVisitAt || !canSpendCompanionTime(pet)) return pet;
  const quote = getCommunityUpgradeQuote(pet, 'stall', expectedLevel);
  if (!quote.ready || !quote.task) return pet;
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, { coins, items } = quote.task;
  const market = syncMarketClock(pet, { ...m, level: m.level + 1, nextListingId: m.nextListingId + 1 }, pet.coins - coins, now);
  return { ...pet, coins: pet.coins - coins, inventory: Object.entries(items).reduce((inventory, [item, quantity]) => removeInventoryItem(inventory, item, quantity), pet.inventory), community: { ...pet.community, market }, recentEvent: '小摊扩建了：增加 3 个栏位，每格最多 20 份；新上架增值 +5 个百分点，已有栏位保持原价。' };
};
export const recycleCommunityGoods = (pet: PetState, id: string, quantity: number, expectedStock: number): PetState => {
  const sale = getCommunitySale(id);
  if (!canSpendCompanionTime(pet) || !sale || (pet.inventory[id] ?? 0) !== expectedStock || !Number.isInteger(quantity) || quantity < 1 || quantity > getCommunitySaleable(pet, id)) return pet;
  const coins = sale.base * quantity;
  if (clampCoins(pet.coins + coins) !== pet.coins + coins) return { ...pet, recentEvent: '金币已达到上限，请稍后再回收，物品会保留。' };
  return recordEarnedCoins({ ...pet, inventory: removeInventoryItem(pet.inventory, id, quantity), coins: pet.coins + coins, recentEvent: `社区回收了 ${quantity} 份物品，收到 ${coins} 金币。` }, coins);
};
