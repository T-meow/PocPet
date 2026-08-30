import { useState } from 'react';
import { Heart } from 'lucide-react';
import {
  batchActionUnlockLevel,
  getDailyBiscuitClaimInfo,
  getDailyHeartExchangeInfo,
  getDailyShopDiscountInfo,
  getItemPurchaseQuote,
  maxBatchQuantity,
  shopCategories,
  type InventoryItemDefinition,
  type ItemId,
  type PetState,
  type ShopCategory,
} from '../core/pet';
import { currencyIcon, unknownItemIcon } from '../assets';
import { t } from '../i18n';
import { getItemEffectBadges } from './itemEffectBadges';
import { formatCompactNumber } from './numberFormat';
import { DialogShell } from './DialogShell';
import { QuantityStepper } from './QuantityStepper';

interface ShopModalProps {
  pet: PetState;
  visibleItems: readonly InventoryItemDefinition[];
  activeCategory: ShopCategory;
  itemIconMap: Partial<Record<string, string>>;
  onClose: () => void;
  onSelectCategory: (category: ShopCategory) => void;
  onBuyItem: (itemId: ItemId, quantity: number) => void;
  onExchangeHeart: () => void;
  isHeartExchangeCoolingDown: boolean;
}

export const ShopModal = ({
  pet,
  visibleItems,
  activeCategory,
  itemIconMap,
  onClose,
  onSelectCategory,
  onBuyItem,
  onExchangeHeart,
  isHeartExchangeCoolingDown,
}: ShopModalProps) => {
  const [quantityByItem, setQuantityByItem] = useState<Record<string, number>>({});
  const now = Date.now();
  const discountInfo = getDailyShopDiscountInfo(pet, now);
  const heartExchangeInfo = getDailyHeartExchangeInfo(pet, now);
  const canExchangeHeart = pet.hearts > 0 && heartExchangeInfo.canExchange && !isHeartExchangeCoolingDown;
  const fullCoinText = t('ui.shop.wallet', { coins: pet.coins });
  const fullHeartText = t('ui.top.heartsAria', { hearts: pet.hearts });
  const fullExchangeRateText = t('ui.shop.exchange.rate', { coins: heartExchangeInfo.coins });
  const fullExchangeButtonText = t('ui.shop.exchange.button', { coins: heartExchangeInfo.coins });
  const exchangeCoinsText = formatCompactNumber(heartExchangeInfo.coins);

  return (
    <DialogShell className="shop-modal" labelId="shop-title" onClose={onClose}>
        <header>
          <div className="shop-title-row">
            <div className="shop-title-copy">
              <h2 id="shop-title">{t('ui.shop.title')}</h2>
            </div>
            <div className="shop-resource-row">
              <span className="coin-pill shop-resource-pill shop-resource-pill--coins" aria-label={fullCoinText} title={fullCoinText}>
                <img src={currencyIcon} alt="" aria-hidden="true" />
                <strong>{pet.coins}</strong>
              </span>
              <span className="shop-resource-pill shop-resource-pill--hearts" aria-label={fullHeartText} title={fullHeartText}>
                <Heart size={15} aria-hidden="true" />
                <strong>{pet.hearts}</strong>
              </span>
            </div>
          </div>
          <button type="button" className="text-button" onClick={onClose}>{t('ui.shop.close')}</button>
        </header>

        <div className="shop-exchange" aria-label={t('ui.shop.exchange.aria')}>
          <div className="shop-exchange__copy">
            <span className="shop-exchange__rate" title={fullExchangeRateText}>
              <Heart size={16} aria-hidden="true" />
              {t('ui.shop.exchange.rate', { coins: exchangeCoinsText })}
            </span>
            <small>{t('ui.shop.exchange.progress', { count: heartExchangeInfo.count, limit: heartExchangeInfo.limit })}</small>
          </div>
          <button type="button" disabled={!canExchangeHeart} title={fullExchangeButtonText} onClick={onExchangeHeart}>
            {t('ui.shop.exchange.button', { coins: exchangeCoinsText })}
          </button>
        </div>

        <div className="shop-tabs" role="tablist" aria-label={t('ui.shop.tabsAria')}>
          {shopCategories.map((category) => (
            <button
              type="button"
              key={category.id}
              role="tab"
              aria-selected={activeCategory === category.id}
              className={activeCategory === category.id ? 'shop-tab shop-tab--active' : 'shop-tab'}
              onClick={() => onSelectCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="shop-grid">
          {visibleItems.map((item) => {
            const discountEntry = discountInfo?.items.find((discountItem) => discountItem.itemId === item.id);
            const isDiscountItem = Boolean(discountEntry);
            const isDiscountAvailable = Boolean(discountEntry && !discountEntry.used);
            const effectBadges = getItemEffectBadges(item.effect);
            const icon = itemIconMap[item.id] ?? item.imageUrl ?? unknownItemIcon;
            const biscuitClaimInfo = item.id === 'emergency_biscuit' ? getDailyBiscuitClaimInfo(pet, now) : undefined;
            const remainingBiscuitClaims = biscuitClaimInfo ? Math.max(0, biscuitClaimInfo.limit - biscuitClaimInfo.claimed) : undefined;
            const storedQuantity = quantityByItem[item.id] ?? 1;
            const quantity = remainingBiscuitClaims === undefined
              ? storedQuantity
              : Math.min(storedQuantity, Math.max(1, remainingBiscuitClaims));
            const quote = getItemPurchaseQuote(pet, item.id, quantity, now, item);
            const displayPrice = quote.totalPrice;
            const displayPriceText = formatCompactNumber(displayPrice);
            const priceTitle = t('ui.shop.price', { price: displayPrice });
            const originalPriceText = discountEntry?.originalPrice === undefined ? '' : formatCompactNumber(discountEntry.originalPrice);
            const originalPriceTitle = discountEntry?.originalPrice === undefined
              ? ''
              : t('ui.shop.priceNote', { originalPrice: discountEntry.originalPrice, label: discountInfo?.label });
            const canAfford = quote.canPurchase;
            const isClaimedOut = quote.reason === 'daily_limit';
            const buttonLabel = biscuitClaimInfo
              ? isClaimedOut
                ? t('ui.shop.claimedOut')
                : quantity > 1
                  ? t('ui.shop.freeClaimBatch', { count: quantity })
                  : t('ui.shop.freeClaim', { claimed: biscuitClaimInfo.claimed, limit: biscuitClaimInfo.limit })
              : t('ui.shop.price', { price: displayPriceText });

            return (
              <article className="shop-item" key={item.id} data-item-id={item.id}>
                <img className="shop-item__icon" src={icon} alt="" aria-hidden="true" />
                <div>
                  <div className="shop-item__title-row">
                    <strong>
                      {item.displayName}
                      {isDiscountItem && <em className={isDiscountAvailable ? 'shop-badge' : 'shop-badge shop-badge--used'}>{isDiscountAvailable ? t('ui.shop.discountToday') : t('ui.shop.discountUsed')}</em>}
                    </strong>
                    {effectBadges.length > 0 && (
                      <div className="shop-effect-badges" aria-label={effectBadges.map((badge) => badge.label).join(', ')}>
                        {effectBadges.map((badge) => (
                          <span className="shop-effect-badge" key={badge.key}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shop-item__summary">{item.displaySummary}</span>
                  {isDiscountAvailable && <small className="shop-price-note" title={originalPriceTitle}>{t(quantity > 1 ? 'ui.shop.priceNoteBatch' : 'ui.shop.priceNote', { originalPrice: originalPriceText, label: discountInfo?.label })}</small>}
                </div>
                <div className="shop-item__actions">
                  {pet.level >= batchActionUnlockLevel && (
                    <QuantityStepper
                      value={quantity}
                      max={remainingBiscuitClaims === undefined ? maxBatchQuantity : Math.max(1, remainingBiscuitClaims)}
                      disabled={remainingBiscuitClaims === 0}
                      onChange={(next) => setQuantityByItem((current) => ({ ...current, [item.id]: next }))}
                    />
                  )}
                  <button type="button" data-buy-item={item.id} disabled={isClaimedOut || !canAfford} title={biscuitClaimInfo ? undefined : priceTitle} onClick={() => onBuyItem(item.id, quantity)}>{buttonLabel}</button>
                </div>
              </article>
            );
          })}
        </div>
    </DialogShell>
  );
};
