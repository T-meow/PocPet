import { getCommunitySale, type CommunitySale } from './communityEconomy';
import { getInventoryItem, getShopItem } from './items';
import type { ItemId, ItemRegistry } from './petTypes';

export const isMarketItemAllowed = (id: string) => typeof id === 'string' && id.length > 0 && id !== 'golden_apple' && id !== 'map_handbook';
const giftPrices: Record<string, number> = { birthday_cake: 30, creek_herb_seed: 5, forest_berry_seed: 8, egg_shell: 1, clean_shell: 2 };

/** Stall resale prices are independent of recipe ingredient valuations. */
export const getMarketSale = (id: string, registry?: ItemRegistry): (CommunitySale & { priceCap?: number }) | undefined => {
  if (!isMarketItemAllowed(id)) return undefined;
  const definition = registry?.get(id) ?? getInventoryItem(id as ItemId);
  const shopPrice = getShopItem(id as ItemId)?.price ?? (definition && 'shop' in definition && definition.shop ? definition.price : undefined);
  const box = getShopItem('soda_biscuit_box')!;
  const biscuitPrice = box.price / box.purchaseContents!.find(item => item.itemId === 'emergency_biscuit')!.amount;
  const priceCap = id === 'emergency_biscuit' ? biscuitPrice : shopPrice && shopPrice > 0 ? shopPrice : undefined;
  const existing = getCommunitySale(id);
  const giftPrice = Object.prototype.hasOwnProperty.call(giftPrices, id) ? giftPrices[id] : undefined;
  const base = id === 'emergency_biscuit' ? biscuitPrice : existing?.base ?? giftPrice ?? Math.max(1, Math.floor((definition?.price ?? 0) * .4));
  return { ...existing, base, priceCap, collector: existing?.collector ?? false, exchangeOnly: false, demand: existing?.demand ?? 'basic' };
};
