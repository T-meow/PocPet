import { recordEarnedCoins } from './achievements';
import { getCommunitySale } from './communityEconomy';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { clampCoins } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';

export const marketVisitMs = 30 * 60000;
export const getMarketCapacity = (pet: PetState) => pet.community.market.level ? 3 + pet.community.market.level * 3 : 0;
export const getMarketQuote = (pet: PetState, id: string) => {
  const sale = getCommunitySale(id);
  const knowledge = Math.min(10, Math.floor(pet.partnerSchedule.skills.study.level / 2) * 2), building = Math.max(0, pet.community.market.level - 1) * 5;
  const bonus = 20 + knowledge + building;
  return sale ? { ...sale, knowledge, building, bonus, price: sale.exchangeOnly ? sale.base : Math.floor(sale.base * (100 + bonus) / 100) } : undefined;
};
export const getCommunitySaleable = (pet: PetState, id: string) => Math.max(0, (pet.inventory[id] ?? 0) - (pet.community.market.reserve[id] ?? 0));
export const advanceCommunityMarket = (pet: PetState, now: number): PetState => {
  const m = pet.community.market;
  if (!m.open || !m.level || !Number.isFinite(now) || now < m.lastVisitAt + marketVisitMs) return pet;
  const visits = Math.floor((now - m.lastVisitAt) / marketVisitMs);
  let listings = m.listings.map(listing => ({ ...listing })), revenue = 0, premium = 0, sold = 0, log = m.log;
  // At most twelve stocked units and five waits per collector: bounded even for years offline.
  for (let i = 1; i <= Math.min(visits, 72) && listings.length; i++) {
    const collector = (m.visitors + i) % 6 === 0;
    const index = listings.findIndex(listing => !listing.collector || collector);
    if (index < 0) continue;
    const listing = listings[index], actual = clampCoins(pet.coins + revenue + listing.unitPrice) - pet.coins - revenue;
    if (actual < listing.unitPrice) break; // Full wallet keeps the goods on the shelf.
    revenue += actual; premium += actual - listing.basePrice; sold++;
    log = [{ itemId: listing.itemId, quantity: 1, coins: actual, at: m.lastVisitAt + i * marketVisitMs }, ...log].slice(0, 8);
    listing.quantity--;
    listings = listings.filter(listing => listing.quantity > 0);
  }
  const next = { ...pet, coins: pet.coins + revenue, community: { ...pet.community, market: { ...m, listings, lastVisitAt: m.lastVisitAt + visits * marketVisitMs, visitors: m.visitors + visits, revenue: m.revenue + revenue, premium: m.premium + premium, sold: m.sold + sold, log } } };
  return revenue ? recordEarnedCoins(next, revenue) : next;
};
export const setCommunityReserve = (pet: PetState, id: string, quantity: number): PetState => {
  if (!getCommunitySale(id) || !Number.isInteger(quantity) || quantity < 0 || quantity > inventoryItemLimit) return pet;
  return { ...pet, community: { ...pet.community, market: { ...pet.community.market, reserve: { ...pet.community.market.reserve, [id]: quantity } } }, recentEvent: '已更新自用保留量。料理与明确交付仍可使用；已上架货品如需自用，请先下架。' };
};
export const listCommunityGoods = (pet: PetState, id: string, quantity: number, expectedListingId: number, now = Date.now()): PetState => {
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, quote = getMarketQuote(pet, id);
  if (!canSpendCompanionTime(pet) || !m.level || !quote || quote.exchangeOnly || m.nextListingId !== expectedListingId || !Number.isInteger(quantity) || quantity < 1 || quantity > getCommunitySaleable(pet, id) || m.listings.reduce((n, listing) => n + listing.quantity, 0) + quantity > getMarketCapacity(pet)) return pet;
  return { ...pet, inventory: removeInventoryItem(pet.inventory, id, quantity), community: { ...pet.community, market: { ...m, nextListingId: m.nextListingId + 1,
    listings: [...m.listings, { id: m.nextListingId, itemId: id, quantity, unitPrice: quote.price, basePrice: quote.base, bonus: quote.bonus, collector: quote.collector }] } }, recentEvent: `上架 ${quantity} 份，固定每份 ${quote.price} 金币（增值 ${quote.bonus}%）。售出才结算，不另发料理心心。` };
};
export const unlistCommunityGoods = (pet: PetState, id: number, now = Date.now()): PetState => {
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, listing = m.listings.find(entry => entry.id === id);
  if (!listing || !canSpendCompanionTime(pet)) return pet;
  if ((pet.inventory[listing.itemId] ?? 0) + listing.quantity > inventoryItemLimit) return { ...pet, recentEvent: '仓库空间不足，货品继续保留在货架；可以先闭店。' };
  return { ...pet, inventory: addInventoryItem(pet.inventory, listing.itemId, listing.quantity), community: { ...pet.community, market: { ...m, listings: m.listings.filter(entry => entry.id !== id) } }, recentEvent: '未售出的货品已退回共用仓库。' };
};
export const setCommunityMarketOpen = (pet: PetState, open: boolean, now = Date.now()): PetState => {
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market;
  if (!m.level || m.open === open) return pet;
  return { ...pet, community: { ...pet.community, market: { ...m, open, lastVisitAt: now } }, recentEvent: open ? '小摊营业中，每 30 分钟一位客人；每第 6 位有珍品收藏需求，离线也按货架余量结算。' : '小摊已经闭店，货品留在货架。闭店期间不累计客流。' };
};
export const upgradeCommunityMarket = (pet: PetState, expectedLevel: number, now = Date.now()): PetState => {
  pet = advanceCommunityMarket(pet, now);
  const m = pet.community.market, coins = m.level === 1 ? 300 : 500;
  if (!canSpendCompanionTime(pet) || m.level !== expectedLevel || m.level < 1 || m.level >= 3 || pet.coins < coins || (pet.inventory.community_wood ?? 0) < 4 || (pet.inventory.community_stone ?? 0) < 2) return pet;
  return { ...pet, coins: pet.coins - coins, inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', 4), 'community_stone', 2), community: { ...pet.community, market: { ...m, level: m.level + 1 } }, recentEvent: '小摊扩建了：容量 +3、新上架增值 +5 个百分点。已有批次保持原报价，客流速度不变。' };
};
export const sellCommunityGuild = (pet: PetState, id: string, quantity: number, expectedStock: number): PetState => {
  const sale = getCommunitySale(id);
  if (!canSpendCompanionTime(pet) || !sale || (pet.inventory[id] ?? 0) !== expectedStock || !Number.isInteger(quantity) || quantity < 1 || quantity > getCommunitySaleable(pet, id)) return pet;
  const coins = sale.base * quantity;
  if (clampCoins(pet.coins + coins) !== pet.coins + coins) return { ...pet, recentEvent: '金币已达到上限，请稍后再回收，物品会保留。' };
  return recordEarnedCoins({ ...pet, inventory: removeInventoryItem(pet.inventory, id, quantity), coins: pet.coins + coins, recentEvent: `工会按基价回收 ${quantity} 份，收到 ${coins} 金币；不重复发制作奖励。` }, coins);
};
