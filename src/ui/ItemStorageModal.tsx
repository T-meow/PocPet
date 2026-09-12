import { useEffect, useMemo, type ReactNode } from 'react';
import { Heart, PackageOpen, ShoppingBag, X } from 'lucide-react';
import { batchActionUnlockLevel, getPetEnergyCap, getPetStatCap, type InventoryItemDefinition, type PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { currencyIcon, unknownItemIcon } from '../assets';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';
import { QuantityStepper } from './QuantityStepper';
import { QuantityPresets } from './QuantityPresets';
import { formatCompactNumber } from './numberFormat';
import { getItemEffectBadges } from './itemEffectBadges';
import { filterBrowseItems, getItemBrowseCategories, getItemBrowseLimit, getItemBrowseTone, getCategoryBrowseTone, isKitchenIngredient, resolveItemBrowseState, sortBagItems, type ItemBrowseState, type ItemStorageMode } from './itemBrowse';

interface Props {
  mode: ItemStorageMode;
  pet: PetState;
  items: readonly InventoryItemDefinition[];
  itemIconMap: Partial<Record<string, string>>;
  browse: ItemBrowseState;
  onBrowseChange: (state: ItemBrowseState) => void;
  onClose: () => void;
  onSwitch: () => void;
  quantityDisabled?: boolean;
  footer?: ReactNode;
  tileInfo?: (item: InventoryItemDefinition) => { price: ReactNode; mark?: string };
  renderActions: (item: InventoryItemDefinition, quantity: number) => ReactNode;
}

export const ItemStorageModal = ({ mode, pet, items, itemIconMap, browse, onBrowseChange, onClose, onSwitch, quantityDisabled, footer, tileInfo, renderActions }: Props) => {
  const now = Date.now();
  const availableItems = useMemo(() => items.filter((item) => mode === 'shop' ? item.shop : (pet.inventory[item.id] ?? 0) > 0), [items, mode, pet.inventory]);
  const visible = useMemo(() => {
    const filtered = filterBrowseItems(availableItems, browse.category);
    return mode === 'bag' ? sortBagItems(filtered, items) : filtered;
  }, [availableItems, browse.category, items, mode]);
  const resolved = resolveItemBrowseState(browse.query ? { ...browse, query: '' } : browse, visible, (item) => getItemBrowseLimit(pet, item, mode, now));
  const item = visible.find((entry) => entry.id === resolved.selectedId);
  // Selection and quantities also reconcile after purchases, consumption, and mode changes.
  useEffect(() => { if (resolved !== browse) onBrowseChange(resolved); }, [browse, resolved.selectedId, resolved.quantity, resolved.query, onBrowseChange]);
  const categories = getItemBrowseCategories();
  const iconFor = (entry: InventoryItemDefinition) => itemIconMap[entry.id] ?? entry.imageUrl ?? unknownItemIcon;
  const titleId = mode === 'shop' ? 'shop-title' : 'inventory-title';
  const maxQuantity = item ? getItemBrowseLimit(pet, item, mode, now) : 0;
  const effects = item ? getItemEffectBadges(item.effect) : [];
  const ownedCount = (entry: InventoryItemDefinition) => pet.inventory[entry.purchaseContents?.length === 1 ? entry.purchaseContents[0].itemId : entry.id] ?? 0;
  const stats = ['hunger', 'mood', 'cleanliness', 'energy', 'health'] as const;
  const canBatch = pet.level >= batchActionUnlockLevel && item && (mode === 'shop' || (item.usable && item.kind !== 'garden' && item.id !== 'golden_apple' && item.id !== 'birthday_cake'));
  return <DialogShell className={`storage-modal storage-modal--${mode}`} backdropClassName="storage-backdrop" labelId={titleId} onClose={onClose}>
    <header className="storage-header">
      <div className="storage-title"><span className="storage-title-icon">{mode === 'shop' ? <ShoppingBag /> : <PackageOpen />}</span><div><small>{mode === 'shop' ? 'LITTLE SHOP' : 'LITTLE TREASURES'}</small><h2 id={titleId}>{mode === 'shop' ? t('ui.shop.title') : t('ui.inventory.modalTitle')}</h2></div></div>
      <div className="storage-wallet"><span title={t('ui.shop.wallet', { coins: pet.coins })} aria-label={t('ui.shop.wallet', { coins: pet.coins })}><img src={currencyIcon} alt="" /><strong>{formatCompactNumber(pet.coins)}</strong></span><span title={t('ui.top.heartsAria', { hearts: pet.hearts })} aria-label={t('ui.top.heartsAria', { hearts: pet.hearts })}><Heart size={15} /><strong>{formatCompactNumber(pet.hearts)}</strong></span></div>
      <div className="storage-header-actions"><button className="storage-switch" onClick={onSwitch}>{mode === 'shop' ? <PackageOpen size={17} /> : <ShoppingBag size={17} />}{mode === 'shop' ? L('去背包', 'Bag') : L('去商店', 'Shop')}</button><button className="icon-button" onClick={onClose} aria-label={mode === 'shop' ? t('ui.shop.close') : t('ui.inventory.close')}><X size={20} /></button></div>
    </header>
    {mode === 'bag' && <div className="storage-stats" role="group" aria-label={t('ui.inventory.currentStats')}>{stats.map((key) => {
      const max = Math.round(key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet));
      const value = Math.max(0, Math.min(max, Math.round(pet[key])));
      return <div className={`storage-stat storage-stat--${key}`} key={key}><span>{t(`ui.stats.${key}`)}</span><strong>{value}<small>/{max}</small></strong><i role="progressbar" aria-label={t(`ui.stats.${key}`)} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><b style={{ width: `${value / max * 100}%` }} /></i></div>;
    })}</div>}
    <div className="storage-body">
      <section className="storage-catalogue" aria-label={L('物品目录', 'Item catalogue')}>
        <div className="storage-tools"><div className="storage-tabs" role="group" aria-label={t('ui.shop.tabsAria')}>{categories.map((category) => <button key={category.id} data-tone={getCategoryBrowseTone(category.id)} aria-pressed={browse.category === category.id} onClick={() => onBrowseChange({ ...browse, category: category.id, selectedId: undefined, quantity: 1 })}>{category.label}<small>{filterBrowseItems(availableItems, category.id).length}</small></button>)}</div>
        </div>
        <div className="storage-grid-scroll"><div className="storage-item-grid">{visible.map((entry) => {
          const info = tileInfo?.(entry);
          const owned = ownedCount(entry);
          return <button className="storage-item-tile" data-item-id={entry.id} data-tone={entry.id === item?.id ? getItemBrowseTone(entry) : undefined} key={entry.id} aria-pressed={entry.id === item?.id} aria-controls="storage-item-detail" onClick={() => onBrowseChange({ ...browse, selectedId: entry.id, quantity: 1 })} title={entry.displayName}>
            <span className="storage-tile-count" title={L(`持有 ${owned} 件`, `${owned} owned`)}>{mode === 'shop' ? L('有 ', 'Have ') : '×'}{formatCompactNumber(owned)}</span>
            {info?.mark && <span className="storage-tile-mark">{info.mark}</span>}
            <span className="storage-tile-picture"><img src={iconFor(entry)} alt="" draggable={false} /></span><strong className="storage-tile-name">{entry.displayName}</strong>{info && <span className="storage-tile-price">{info.price}</span>}
          </button>;
        })}</div>{!visible.length && <div className="storage-empty"><PackageOpen size={32} /><p>{t('ui.inventory.emptyCategory')}</p>{mode === 'bag' && <button className="storage-primary" onClick={onSwitch}>{t('ui.inventory.openCategoryShop')}</button>}</div>}</div>
        <footer className="storage-catalogue-footer"><span>{L(`${visible.length} 种物品`, `${visible.length} items`)}</span>{footer}</footer>
      </section>
      <section className="storage-detail" id="storage-item-detail" aria-label={L('物品详情', 'Item details')} data-tone={item ? getItemBrowseTone(item) : undefined}>
        {item ? <><div className="storage-detail-copy"><div className="storage-detail-hero"><div className="storage-detail-art"><img src={iconFor(item)} alt="" draggable={false} /></div><div><h3>{item.displayName}</h3><span className="storage-category-label">{isKitchenIngredient(item) ? L('厨房食材', 'Cooking ingredient') : categories.find((category) => category.id === item.kind)?.label}</span></div></div><p className="storage-detail-description">{item.displaySummary}</p>{effects.length > 0 && <><p className="storage-effects-title">{L('每份基础效果', 'Base effects per item')}</p><div className="storage-effects">{effects.map((effect) => <span key={effect.key}>{effect.label}</span>)}</div></>}{isKitchenIngredient(item) && <p className="storage-ingredient-note">{item.usable ? L('可以喂给伙伴，也可以留着做菜。两处显示的是同一份库存。', 'Feed your companion or save it for cooking. Both categories share this stock.') : L('留给厨房的原料，选一道菜就能派上用场。', 'An ingredient for the kitchen. Pick a recipe to use it.')}</p>}</div>
          <div className="storage-detail-actions"><div className="storage-quantity"><div className="storage-owned"><span>{item.purchaseContents ? L('饼干库存', 'Biscuits owned') : L('持有', 'Owned')}</span><strong>{ownedCount(item)}</strong></div>{canBatch && <><div className="storage-quantity-row"><span>{L('数量', 'Quantity')}</span><QuantityStepper value={resolved.quantity} max={Math.max(1, maxQuantity)} disabled={quantityDisabled || maxQuantity === 0} onChange={(quantity) => onBrowseChange({ ...resolved, quantity })} /></div><QuantityPresets value={resolved.quantity} max={maxQuantity} disabled={quantityDisabled || maxQuantity === 0} onChange={(quantity) => onBrowseChange({ ...resolved, quantity })} /></>}</div><div className="storage-transaction">{renderActions(item, resolved.quantity)}</div></div>
        </> : <div className="storage-detail-empty"><PackageOpen size={32} /><p>{L('选一件物品，看看它的小用处。', 'Select an item to see what it does.')}</p></div>}
      </section>
    </div>
  </DialogShell>;
};
