import { Heart } from 'lucide-react';
import { getDailyBiscuitClaimInfo, getDailyHeartExchangeInfo, getDailyShopDiscountInfo, getItemPurchaseQuote, type InventoryItemDefinition, type ItemId, type PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { currencyIcon } from '../assets';
import { t } from '../i18n';
import { formatCompactNumber } from './numberFormat';
import { ItemStorageModal } from './ItemStorageModal';
import type { ItemBrowseState } from './itemBrowse';

interface ShopModalProps {
  pet: PetState;
  items: readonly InventoryItemDefinition[];
  browse: ItemBrowseState;
  onBrowseChange: (state: ItemBrowseState) => void;
  itemIconMap: Partial<Record<string, string>>;
  onClose: () => void;
  onOpenInventory: () => void;
  onBuyItem: (itemId: ItemId, quantity: number) => void;
  onExchangeHeart: () => void;
  isHeartExchangeCoolingDown: boolean;
}

export const ShopModal = ({ pet, items, browse, onBrowseChange, itemIconMap, onClose, onOpenInventory, onBuyItem, onExchangeHeart, isHeartExchangeCoolingDown }: ShopModalProps) => {
  const now = Date.now();
  const discountInfo = getDailyShopDiscountInfo(pet, now);
  const exchange = getDailyHeartExchangeInfo(pet, now);
  return <ItemStorageModal mode="shop" pet={pet} items={items} browse={browse} onBrowseChange={onBrowseChange} itemIconMap={itemIconMap} onClose={onClose} onSwitch={onOpenInventory}
    tileInfo={(item) => {
      const quote = getItemPurchaseQuote(pet, item.id, 1, now, item);
      const discount = discountInfo?.items.find((entry) => entry.itemId === item.id);
      return {
        mark: discount ? t(discount.used ? 'ui.shop.discountUsed' : 'ui.shop.discountToday') : undefined,
        price: item.id === 'emergency_biscuit' ? L(`免费 · 剩 ${quote.remainingDailyLimit ?? 0}`, `Free · ${quote.remainingDailyLimit ?? 0} left`) : <><img src={currencyIcon} alt="" /><span title={String(quote.totalPrice)}>{formatCompactNumber(quote.totalPrice)}</span>{quote.discountApplied && <del>{formatCompactNumber(item.price)}</del>}</>,
      };
    }}
    footer={<div className="storage-exchange" aria-label={t('ui.shop.exchange.aria')}><div><span><Heart size={14} />{t('ui.shop.exchange.rate', { coins: formatCompactNumber(exchange.coins) })}</span><small>{t('ui.shop.exchange.progress', { count: exchange.count, limit: exchange.limit })}</small></div><button disabled={pet.hearts <= 0 || !exchange.canExchange || isHeartExchangeCoolingDown} onClick={onExchangeHeart}>{L('兑换', 'Exchange')}</button></div>}
    renderActions={(item, quantity) => {
      const quote = getItemPurchaseQuote(pet, item.id, quantity, now, item);
      const biscuit = item.id === 'emergency_biscuit' ? getDailyBiscuitClaimInfo(pet, now) : undefined;
      const label = quote.reason === 'daily_limit' ? t('ui.shop.claimedOut') : quote.reason === 'coins' ? L('金币不足', 'Not enough coins') : biscuit ? t('ui.shop.freeClaimBatch', { count: quantity }) : L(`购买 ${quantity} 件`, `Buy ${quantity}`);
      return <>
        <div className="storage-total"><span>{L('合计', 'Total')}</span><strong title={t('ui.shop.price', { price: quote.totalPrice })}><img src={currencyIcon} alt="" />{formatCompactNumber(quote.totalPrice)}</strong></div>
        {quote.discountApplied && <small className="storage-transaction-note">{L('首件享优惠，其余按原价。', 'First item discounted; the rest at regular price.')}</small>}
        {biscuit && <small className="storage-transaction-note">{L(`今日可免费领取 ${Math.max(0, biscuit.limit - biscuit.claimed)} 份`, `${Math.max(0, biscuit.limit - biscuit.claimed)} free claims left today`)}</small>}
        <button className="storage-primary" data-buy-item={item.id} disabled={!quote.canPurchase} onClick={() => onBuyItem(item.id, quantity)}>{label}</button>
      </>;
    }} />;
};
