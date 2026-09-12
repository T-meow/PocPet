import { getDailyBiscuitClaimInfo, getDailyShopDiscountInfo, getItemPurchaseQuote, type InventoryItemDefinition, type ItemId, type PetState } from '../core/pet';
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

export const ShopModal = ({ pet, items, browse, onBrowseChange, itemIconMap, onClose, onOpenInventory, onBuyItem }: ShopModalProps) => {
  const now = Date.now();
  const discountInfo = getDailyShopDiscountInfo(pet, now);
  return <ItemStorageModal mode="shop" pet={pet} items={items} browse={browse} onBrowseChange={onBrowseChange} itemIconMap={itemIconMap} onClose={onClose} onSwitch={onOpenInventory}
    tileInfo={(item) => {
      const quote = getItemPurchaseQuote(pet, item.id, 1, now, item);
      const discount = discountInfo?.items.find((entry) => entry.itemId === item.id);
      return {
        mark: discount ? t(discount.used ? 'ui.shop.discountUsed' : 'ui.shop.discountToday') : undefined,
        price: item.id === 'emergency_biscuit' ? L(`免费 · 剩 ${quote.remainingDailyLimit ?? 0}`, `Free · ${quote.remainingDailyLimit ?? 0} left`) : <><img src={currencyIcon} alt="" /><span title={String(quote.totalPrice)}>{formatCompactNumber(quote.totalPrice)}</span>{quote.discountApplied && <del>{formatCompactNumber(item.price)}</del>}</>,
      };
    }}
    renderActions={(item, quantity) => {
      const quote = getItemPurchaseQuote(pet, item.id, quantity, now, item);
      const biscuit = item.id === 'emergency_biscuit' ? getDailyBiscuitClaimInfo(pet, now) : undefined;
      const label = quote.reason === 'inventory_full' ? L('饼干库存空间不足', 'Not enough biscuit space') : quote.reason === 'daily_limit' ? t('ui.shop.claimedOut') : quote.reason === 'coins' ? L('金币不足', 'Not enough coins') : biscuit ? t('ui.shop.freeClaimBatch', { count: quantity }) : item.purchaseContents ? L(`购买 ${quantity} 箱`, `Buy ${quantity} boxes`) : L(`购买 ${quantity} 件`, `Buy ${quantity}`);
      return <>
        <div className="storage-total"><span>{L('合计', 'Total')}</span><strong title={t('ui.shop.price', { price: quote.totalPrice })}><img src={currencyIcon} alt="" />{formatCompactNumber(quote.totalPrice)}</strong></div>
        {quote.discountApplied && <small className="storage-transaction-note">{L('首件享优惠，其余按原价。', 'First item discounted; the rest at regular price.')}</small>}
        {biscuit && <small className="storage-transaction-note">{L(`今日可免费领取 ${Math.max(0, biscuit.limit - biscuit.claimed)} 份`, `${Math.max(0, biscuit.limit - biscuit.claimed)} free claims left today`)}</small>}
        {item.purchaseContents && <small className="storage-transaction-note">{L(`购买后到账 ${quantity * 40} 块苏打饼干，可喂食或用于做饭。`, `Receive ${quantity * 40} soda biscuits for feeding or cooking.`)}</small>}
        <button className="storage-primary" data-buy-item={item.id} disabled={!quote.canPurchase} onClick={() => onBuyItem(item.id, quantity)}>{label}</button>
      </>;
    }} />;
};
