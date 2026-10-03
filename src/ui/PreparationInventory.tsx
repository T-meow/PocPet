import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Backpack, PackageOpen, X } from 'lucide-react';
import { unknownItemIcon } from '../assets';
import { getAdventureBagCount, isAdventureSupply } from '../core/adventureState';
import { getInventoryDefinitions } from '../core/items';
import { getEffectiveBatchQuantity } from '../core/petActions';
import { getItemRecoveryPreview, getItemUsePlan, overfedMessage } from '../core/itemEffects';
import { isTravelFood } from '../core/explorationRations';
import { isExpeditionAway } from '../core/expeditionData';
import { allDishes, activityText as L } from '../core/kitchenRecipes';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { QuantityStepper } from './QuantityStepper';
import { QuantityPresets } from './QuantityPresets';
import { ItemRecoveryPreview } from './ItemRecoveryPreview';
import { getItemBrowseCategories, filterBrowseItems, matchesItemBrowseCategory, isKitchenMaterial, type ItemBrowseCategory } from './itemBrowse';
import { DialogShell } from './DialogShell';
import { useExplorationWideLayout } from './useExplorationWideLayout';
import { favoritesFirst } from '../core/favorites';
import { FavoriteButton, FavoriteMark } from './Favorite';

const dishIds = new Set<string>(allDishes.map(dish => dish.id));
export interface PreparationResources {
  registry: ItemRegistry; icons: Record<string, string>; onUseHomeItem: (id: ItemId, quantity: number) => void;
  onToggleItemFavorite: (id: ItemId) => void;
}
interface Props extends PreparationResources {
  pet: PetState; bag: Inventory; capacity: number; onPack: (id: ItemId, delta: number) => void;
  perform: (action: () => void) => void; foodOnly?: boolean; automaticFood?: Inventory;
  bagHeadingExtra?: ReactNode; bagExtra?: ReactNode;
}

export const PreparationInventory = ({ pet, registry, icons, bag, capacity, onPack, onUseHomeItem, onToggleItemFavorite, perform, foodOnly = false, automaticFood = {}, bagHeadingExtra, bagExtra }: Props) => {
  const [open, setOpen] = useState(false);
  const [operationOpen, setOperationOpen] = useState(false);
  const wide = useExplorationWideLayout();
  const [source, setSource] = useState<'warehouse' | 'bag'>('warehouse');
  const [category, setCategory] = useState<ItemBrowseCategory | 'dishes' | 'rations'>(foodOnly ? 'all' : 'food');
  const [selection, setSelection] = useState<{ id: ItemId; source: 'warehouse' | 'bag' }>();
  const [quantity, setQuantity] = useState(1);
  const [transfer, setTransfer] = useState<{ id: ItemId; quantity: number; intoBag: boolean; key: number }>();
  const carried = bag;
  const warehouse = Object.fromEntries(Object.entries(pet.inventory).map(([id, count]) => [id, Math.max(0, count - (carried[id] ?? 0))]));
  const catalogueStock = { ...pet.inventory };
  for (const [id, n] of Object.entries(carried)) catalogueStock[id] = Math.max(catalogueStock[id] ?? 0, n);
  const items = getInventoryDefinitions(registry, catalogueStock).filter(item => foodOnly ? isTravelFood(item.id)
    : (matchesItemBrowseCategory(item, 'food') || item.kind === 'care') && ((carried[item.id] ?? 0) > 0 || isAdventureSupply(item.id) || item.usable));
  const activeCategory = foodOnly ? category === 'dishes' || category === 'rations' ? category : 'all' : category === 'care' ? 'care' : 'food';
  const visible = activeCategory === 'dishes' || activeCategory === 'rations' ? items.filter(item => dishIds.has(item.id) === (activeCategory === 'dishes')) : filterBrowseItems(items, activeCategory);
  const warehouseItems = favoritesFirst(visible.filter(item => !isKitchenMaterial(item)), pet.favorites.itemIds, item => item.id);
  const packedItems = favoritesFirst(Object.entries(bag).filter(([id, n]) => n > 0 && visible.some(item => item.id === id)), pet.favorites.itemIds, ([id]) => id);
  const automaticItems = Object.entries(automaticFood).filter(([id, n]) => n > 0 && (activeCategory === 'all' || activeCategory === 'food' || activeCategory === 'dishes' && dishIds.has(id) || activeCategory === 'rations' && !dishIds.has(id)));
  const manualCount = getAdventureBagCount(bag), packed = manualCount + getAdventureBagCount(automaticFood);
  const selected = visible.find(item => item.id === selection?.id);
  useEffect(() => { if (wide || !selected) setOperationOpen(false); }, [wide, selected?.id]);
  const closePack = () => { setOperationOpen(false); setOpen(false); };
  const closeOperation = () => setOperationOpen(false);
  const amount = selected ? (selection?.source === 'bag' ? carried : warehouse)[selected.id] ?? 0 : 0;
  const max = selection?.source === 'bag' ? amount : Math.min(capacity, amount);
  const count = Math.max(1, Math.min(quantity, max));
  const canPack = selected && !isKitchenMaterial(selected) && (foodOnly ? isTravelFood(selected.id) : isAdventureSupply(selected.id));
  const requestedUseCount = selected?.id === 'golden_apple' || selected?.id === 'birthday_cake' ? 1 : getEffectiveBatchQuantity(pet, count);
  const usePlan = selected ? getItemUsePlan(pet, selected, requestedUseCount) : undefined;
  const useCount = usePlan?.quantity ?? 0;
  const canUse = selected?.usable && useCount > 0 && selection?.source === 'warehouse' && amount >= useCount && !pet.timePause && !pet.adventure.active && !isExpeditionAway(pet) && !pet.partnerSchedule.active
    && Object.values(getItemRecoveryPreview(pet, selected, useCount, []).actual).some(value => value > 0);
  const transferItem = () => {
    if (!selected || !selection || amount < count) return;
    const intoBag = selection.source === 'warehouse';
    if (intoBag && (!canPack || manualCount + count > capacity)) return;
    perform(() => {
      onPack(selected.id, intoBag ? count : -count);
      setTransfer(current => ({ id: selected.id, quantity: count, intoBag, key: (current?.key ?? 0) + 1 }));
    });
  };
  const tile = (id: ItemId, source: 'warehouse' | 'bag', n: number) => {
    const name = registry.get(id)?.name ?? id;
    return <button className="storage-item-tile" key={id} data-item-id={id} aria-label={`${name} ×${n}${pet.favorites.itemIds.includes(id) ? '，已收藏' : ''}`} aria-pressed={selection?.id === id && selection.source === source} aria-haspopup={wide ? undefined : 'dialog'} aria-expanded={wide ? undefined : operationOpen && selection?.id === id && selection.source === source} onClick={() => perform(() => { setSelection({ id, source }); setQuantity(1); setOperationOpen(!wide); })}>
      <span className="storage-tile-count">×{n}</span><span className="storage-tile-picture"><img src={icons[id] ?? unknownItemIcon} alt="" /></span><strong className="storage-tile-name">{pet.favorites.itemIds.includes(id) && <FavoriteMark />}{name}</strong>
    </button>;
  };
  const categories = foodOnly ? [{ id: 'all' as const, label: '全部' }, { id: 'dishes' as const, label: '料理' }, { id: 'rations' as const, label: '其他食物' }] : getItemBrowseCategories().filter(value => value.id === 'food' || value.id === 'care');
  const summaryItems = Object.entries({ ...bag, ...Object.fromEntries(Object.entries(automaticFood).map(([id, n]) => [id, n + (bag[id] ?? 0)])) }).filter(([, n]) => n > 0);
  const operationDetails = selected && selection && <>
    <div className="exploration-pack-item-heading"><img src={icons[selected.id] ?? unknownItemIcon} alt="" /><div><small>{selection.source === 'warehouse' ? '从仓库选择' : '已装入行囊'}</small><h4>{selected.displayName}</h4><p>{L('仓库', 'Home')} {warehouse[selected.id] ?? 0} · {L('背包', 'Bag')} {carried[selected.id] ?? 0}</p><FavoriteButton active={pet.favorites.itemIds.includes(selected.id)} name={selected.displayName} onToggle={() => onToggleItemFavorite(selected.id)} /></div></div>
    <div className="exploration-pack-quantity"><strong>操作数量</strong><QuantityStepper value={count} max={Math.max(1, max)} disabled={!max} onChange={value => perform(() => setQuantity(value))} onInputChange={setQuantity} /></div>
    {max > 1 && <QuantityPresets value={count} max={max} onChange={value => perform(() => setQuantity(value))} />}
    <p className="exploration-pack-capacity">{foodOnly ? '全程食物' : '行囊容量'} {packed} / {capacity} 份{selection.source === 'warehouse' && canPack && ` · 还可装入 ${Math.max(0, capacity-manualCount)} 份`}</p>
    {selection.source === 'warehouse' && <ItemRecoveryPreview pet={pet} item={selected} quantity={requestedUseCount} favoriteFoodIds={[]} />}
    <div className="exploration-pack-transfer" role="status">{transfer ? `${registry.get(transfer.id)?.name ?? transfer.id} ×${transfer.quantity} ${transfer.intoBag ? '已装入行囊' : '已移回仓库'}` : selection.source === 'warehouse' ? '装入行囊留给旅途中使用；现在使用会立即消耗物品。' : '移回仓库不会消耗物品。'}</div>
  </>;
  const operationActions = selected && selection && <>
    {(canPack || selection.source === 'bag') && <button className="storage-primary" disabled={!max || selection.source === 'warehouse' && manualCount + count > capacity} onClick={transferItem}>{selection.source === 'warehouse' ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}{selection.source === 'warehouse' ? L('装入', 'Pack') : L('移回仓库', 'Unpack')} ×{count}</button>}
    {selection.source === 'warehouse' && selected.usable && <button className="storage-secondary" disabled={!canUse} title={usePlan?.blocked ? overfedMessage : undefined} onClick={() => perform(() => { if (canUse) onUseHomeItem(selected.id, useCount); })}>{usePlan?.blocked ? '吃撑了，先消化一下' : L(`现在${selected.kind === 'food' ? '食用' : '使用'} ×${useCount}`, `Use now ×${useCount}`)}</button>}
  </>;
  return <><section className="exploration-pack-summary"><div className="exploration-section-heading"><h3>{foodOnly ? '全程食物' : '本次行囊'}</h3><strong>{packed} / {capacity} 份</strong>{bagHeadingExtra}</div><p>{foodOnly ? '带上喜欢的料理，为整段旅途补充饱食。' : `随身补给与沿途发现共用行囊，还可装入 ${Math.max(0,capacity-packed)} 份。`}</p><div className="exploration-packed-items">{summaryItems.map(([id,n]) => <div key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><strong>{registry.get(id)?.name ?? id}</strong><span>×{n}</span>{automaticFood[id] > 0 && <small>含自动补给</small>}</div>)}{!summaryItems.length && <div className="exploration-pack-placeholder"><Backpack size={35} /><strong>整理好小小行囊</strong><small>从仓库选择料理，或先恢复伙伴状态。</small></div>}</div><button className="secondary-button" onClick={() => setOpen(true)}><Backpack size={18} />{foodOnly ? '选择食物／现在食用' : '整理行囊／现在使用'}</button></section>{bagExtra}{open && <DialogShell className="exploration-pack-sheet" labelId="exploration-pack-sheet-title" onClose={closePack} closeOnBackdrop><header><h3 id="exploration-pack-sheet-title">{foodOnly ? '选择全程食物' : '整理随身行囊'}</h3><button className="icon-button" aria-label="关闭装包面板，保留选择" onClick={closePack}><X /></button></header><div className={`preparation-inventory preparation-inventory--${wide ? 'inline' : 'dialog'}`}>
    <div className="exploration-pack-source" role="group" aria-label="物品来源"><button aria-pressed={source === 'warehouse'} onClick={() => { setSource('warehouse'); setSelection(undefined); }}><PackageOpen size={18} />仓库</button><button aria-pressed={source === 'bag'} onClick={() => { setSource('bag'); setSelection(undefined); }}><Backpack size={18} />已装入 {packed}/{capacity}</button></div>
    <div className="storage-tabs adventure-pack-tabs" role="group" aria-label="物品分类">{categories.map(value => <button key={value.id} aria-pressed={activeCategory === value.id} onClick={() => perform(() => { setCategory(value.id); setSelection(undefined); setQuantity(1); })}>{value.label}</button>)}</div>
    <div className="adventure-pack-columns">
      <section hidden={source !== 'bag'} className="adventure-pack-pane adventure-pack-pane--bag" aria-label={L('本次携带的背包', 'Packed travel bag')}><div className="adventure-pack-heading"><h3><Backpack size={18} />{L('背包', 'Travel bag')}<small>{packed}/{capacity}{foodOnly ? ' 份' : ''}</small></h3></div>
        <progress className="adventure-pack-slots" value={packed} max={capacity} aria-label={L('已占用容量', 'Occupied slots')} />
        <div className="storage-grid-scroll" tabIndex={0} aria-label="浏览背包物品">
          <div className="storage-item-grid">{packedItems.map(([id, n]) => tile(id as ItemId, 'bag', n))}{automaticItems.map(([id, n]) => <div className="storage-item-tile preparation-automatic" key={`automatic:${id}`} aria-label={`自动补给：${registry.get(id)?.name ?? id} ×${n}，出发时购买`}><span className="storage-tile-count">×{n}</span><span className="storage-tile-picture"><img src={icons[id] ?? unknownItemIcon} alt="" /></span><strong className="storage-tile-name">自动补给</strong></div>)}</div>
          {!packedItems.length && !automaticItems.length && <p className="adventure-pack-empty">{packed ? L('背包中没有这类物品。', 'No packed supplies in this category.') : L('从仓库选择物品装入。', 'Choose supplies from home inventory to pack.')}</p>}
        </div>
      </section>
      <section hidden={source !== 'warehouse'} className="adventure-pack-pane adventure-pack-pane--warehouse" aria-label={L('仓库未装入物资', 'Unpacked home supplies')}><div className="storage-grid-scroll" tabIndex={0} aria-label="浏览仓库物品"><div className="storage-item-grid">{warehouseItems.map(item => tile(item.id, 'warehouse', warehouse[item.id] ?? 0))}</div>{!warehouseItems.length && <p className="adventure-pack-empty">{L('仓库里还没有这类补给。', 'No supplies in this category yet.')}</p>}</div></section>
    </div>
    {wide && <aside className="adventure-pack-footer">{selected && selection ? <>{operationDetails}<div className="exploration-pack-item-actions">{operationActions}</div></> : <div className="exploration-pack-operation-empty"><PackageOpen size={38} /><p>选择物品，整理行囊。</p><small>在这里调整数量，装入行囊或现在使用。</small></div>}</aside>}
  </div><footer><button className="primary-button" onClick={closePack}>完成整理，保留选择</button></footer>
  {!wide && operationOpen && selected && selection && <DialogShell className="exploration-pack-item-sheet" labelId="exploration-pack-item-title" onClose={closeOperation} closeOnBackdrop>
    <header><button className="icon-button" aria-label="返回物品列表" onClick={closeOperation}><ArrowLeft /></button><h3 id="exploration-pack-item-title">物品操作</h3><button className="icon-button" aria-label="关闭装包面板，保留选择" onClick={closePack}><X /></button></header>
    <div className="exploration-sheet-body exploration-pack-operation-body">{operationDetails}</div>
    <footer className="exploration-pack-item-actions">{operationActions}</footer>
  </DialogShell>}
  </DialogShell>}</>;
};
