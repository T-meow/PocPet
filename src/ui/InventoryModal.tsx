import { useState } from 'react';
import { PackageOpen, ShoppingBag, Sprout, X } from 'lucide-react';
import {
  batchActionUnlockLevel,
  getPetEnergyCap,
  getPetStatCap,
  maxBatchQuantity,
  shopCategories,
  type Inventory,
  type InventoryItemDefinition,
  type ItemId,
  type PetState,
  type ShopCategory,
} from '../core/pet';
import { unknownItemIcon } from '../assets';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';
import { getItemEffectBadges, getItemEffectTitle } from './itemEffectBadges';
import { getValidQuantityPreset, QuantityPresets } from './QuantityPresets';

interface InventoryModalProps {
  items: readonly InventoryItemDefinition[];
  inventory: Inventory;
  pet: Pick<PetState, 'level' | 'hunger' | 'mood' | 'cleanliness' | 'energy' | 'health' | 'classicEndgame'>;
  itemIconMap: Partial<Record<string, string>>;
  activeCategory: ShopCategory;
  isPetBusy: boolean;
  onCategoryChange: (category: ShopCategory) => void;
  onClose: () => void;
  onOpenShop: (category: ShopCategory) => void;
  onOpenGarden: () => void;
  onUseItem: (itemId: ItemId, quantity: number) => void;
}

export const InventoryModal = ({
  items,
  inventory,
  pet,
  itemIconMap,
  activeCategory,
  isPetBusy,
  onCategoryChange,
  onClose,
  onOpenShop,
  onOpenGarden,
  onUseItem,
}: InventoryModalProps) => {
  const [quantityByItem, setQuantityByItem] = useState<Record<string, number>>({});
  const visibleItems = items.filter((item) => item.kind === activeCategory);
  const statCap = getPetStatCap(pet);
  const stats = [
    { key: 'hunger', label: t('ui.inventory.statLabels.hunger'), value: pet.hunger, max: statCap },
    { key: 'mood', label: t('ui.inventory.statLabels.mood'), value: pet.mood, max: statCap },
    { key: 'cleanliness', label: t('ui.inventory.statLabels.cleanliness'), value: pet.cleanliness, max: statCap },
    { key: 'energy', label: t('ui.inventory.statLabels.energy'), value: pet.energy, max: getPetEnergyCap(pet) },
    { key: 'health', label: t('ui.inventory.statLabels.health'), value: pet.health, max: statCap },
  ] as const;

  return (
    <DialogShell
      className="inventory-modal"
      backdropClassName="inventory-backdrop"
      labelId="inventory-title"
      onClose={onClose}
    >
      <header className="dialog-header inventory-modal__header">
        <div className="dialog-title-group">
          <span className="dialog-title-icon" aria-hidden="true"><PackageOpen size={22} /></span>
          <div>
            <h2 id="inventory-title">{t('ui.inventory.modalTitle')}</h2>
          </div>
        </div>
        <div className="dialog-header__actions">
          <button type="button" className="secondary-button" onClick={() => onOpenShop(activeCategory)}>
            <ShoppingBag size={17} aria-hidden="true" />
            {t('ui.inventory.shop')}
          </button>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('ui.inventory.close')} title={t('ui.inventory.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="inventory-modal__stats" role="group" aria-label={t('ui.inventory.currentStats')}>
        {stats.map((stat) => {
          const max = Math.max(1, Math.round(stat.max));
          const value = Math.max(0, Math.min(max, Math.round(stat.value)));
          const percent = value / max * 100;
          return (
            <div className={`inventory-modal__stat inventory-modal__stat--${stat.key}`} key={stat.key}>
              <span>{stat.label}</span>
              <strong>{value}/{max}</strong>
              <span
                className="inventory-modal__stat-track"
                role="progressbar"
                aria-label={`${stat.label} ${value}/${max}`}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={value}
              >
                <i style={{ width: `${percent}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="inventory-tabs" role="tablist" aria-label={t('ui.inventory.tabsAria')}>
        {shopCategories.map((category) => {
          const count = items.filter((item) => item.kind === category.id).length;
          return (
            <button
              type="button"
              role="tab"
              key={category.id}
              aria-selected={activeCategory === category.id}
              className="inventory-tab"
              onClick={() => onCategoryChange(category.id)}
            >
              <span>{category.label}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      {visibleItems.length > 0 ? (
        <div className="inventory-modal__list">
          {visibleItems.map((item) => {
            const icon = itemIconMap[item.id] ?? item.imageUrl ?? unknownItemIcon;
            const isGardenItem = item.kind === 'garden';
            const canBatch = pet.level >= batchActionUnlockLevel
              && !isGardenItem
              && item.usable
              && item.id !== 'golden_apple'
              && item.id !== 'birthday_cake';
            const ownedCount = inventory[item.id] ?? 0;
            const maxQuantity = Math.min(maxBatchQuantity, ownedCount);
            const quantity = canBatch
              ? getValidQuantityPreset(quantityByItem[item.id] ?? 1, maxQuantity)
              : 1;
            const effectBadges = getItemEffectBadges(item.effect, quantity);
            return (
              <article className="inventory-modal__item" key={item.id} title={getItemEffectTitle(item.displaySummary, item.effect, quantity)}>
                <span className="inventory-item__icon-wrap">
                  <img src={icon} alt="" aria-hidden="true" />
                  <strong className="inventory-item__count">x{ownedCount}</strong>
                </span>
                <div className="inventory-item__copy">
                  <div className="inventory-item__title-row">
                    <strong className="inventory-item__name">{item.displayName}</strong>
                    {effectBadges.length > 0 && (
                      <span className="inventory-effect-badges" aria-label={effectBadges.map((badge) => badge.label).join(', ')}>
                        {effectBadges.map((badge) => <span className="inventory-effect-badge" key={badge.key}>{badge.label}</span>)}
                      </span>
                    )}
                  </div>
                  <small className="inventory-item__summary">{item.displaySummary}</small>
                </div>
                <div className="inventory-modal__actions">
                  {canBatch && (
                    <QuantityPresets
                      value={quantity}
                      max={maxQuantity}
                      disabled={isPetBusy}
                      onChange={(next) => setQuantityByItem((current) => ({ ...current, [item.id]: next }))}
                    />
                  )}
                  <button
                    type="button"
                    className={isGardenItem ? 'secondary-button inventory-modal__action' : 'primary-button inventory-modal__action'}
                    disabled={!isGardenItem && (isPetBusy || !item.usable || ownedCount < quantity)}
                    title={!isGardenItem && isPetBusy ? t('ui.inventory.partnerScheduleBusy') : undefined}
                    onClick={() => isGardenItem ? onOpenGarden() : onUseItem(item.id, quantity)}
                  >
                    {isGardenItem && <Sprout size={17} aria-hidden="true" />}
                    {isGardenItem
                      ? t('ui.inventory.goGarden')
                      : isPetBusy
                        ? t('ui.inventory.partnerScheduleBusyShort')
                        : item.usable
                          ? t('ui.inventory.use')
                          : t('ui.inventory.unavailable')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="inventory-modal__empty">
          <PackageOpen size={34} aria-hidden="true" />
          <p>{t('ui.inventory.emptyCategory')}</p>
          <button type="button" className="primary-button" onClick={() => onOpenShop(activeCategory)}>
            <ShoppingBag size={17} aria-hidden="true" />
            {t('ui.inventory.openCategoryShop')}
          </button>
        </div>
      )}
    </DialogShell>
  );
};
