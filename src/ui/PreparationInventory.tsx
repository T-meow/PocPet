import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Backpack, PackageOpen } from 'lucide-react';
import { unknownItemIcon } from '../assets';
import { getAdventureBagCount, isAdventureSupply } from '../core/adventureState';
import { getInventoryDefinitions } from '../core/items';
import { getEffectiveBatchQuantity } from '../core/petActions';
import { getItemRecoveryPreview, getItemUsePlan, overfedMessage } from '../core/itemEffects';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { isTravelFood } from '../core/explorationRations';
import { isExpeditionAway } from '../core/expeditionData';
import { allDishes, activityText as L } from '../core/kitchenRecipes';
import { toolDurabilityLabel } from '../core/toolDurability';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { QuantityStepper } from './QuantityStepper';
import { QuantityPresets } from './QuantityPresets';
import { ItemRecoveryPreview } from './ItemRecoveryPreview';
import { getItemBrowseCategories, filterBrowseItems, type ItemBrowseCategory } from './itemBrowse';

const dishIds = new Set<string>(allDishes.map(dish => dish.id));
export interface PreparationResources {
  registry: ItemRegistry; icons: Record<string, string>; onUseHomeItem: (id: ItemId, quantity: number) => void;
}
interface Props extends PreparationResources {
  pet: PetState; bag: Inventory; capacity: number; onPack: (id: ItemId, delta: number) => void;
  perform: (action: () => void) => void; foodOnly?: boolean; automaticFood?: Inventory;
  tool?: { equipped: boolean; onChange: (equipped: boolean) => void }; bagExtra?: ReactNode;
}

export const PreparationInventory = ({ pet, registry, icons, bag, capacity, onPack, onUseHomeItem, perform, foodOnly = false, automaticFood = {}, tool, bagExtra }: Props) => {
  const [category, setCategory] = useState<ItemBrowseCategory | 'dishes' | 'rations'>('all');
  const [selection, setSelection] = useState<{ id: ItemId; source: 'warehouse' | 'bag' }>();
  const [quantity, setQuantity] = useState(1);
  const [transfer, setTransfer] = useState<{ id: ItemId; quantity: number; intoBag: boolean; key: number }>();
  const carried: Inventory = { ...bag, ...(tool?.equipped ? { trail_rope: 1 } : {}) };
  const warehouse = Object.fromEntries(Object.entries(pet.inventory).map(([id, count]) => [id, Math.max(0, count - (carried[id] ?? 0))]));
  const catalogueStock = { ...pet.inventory };
  for (const [id, n] of Object.entries(carried)) catalogueStock[id] = Math.max(catalogueStock[id] ?? 0, n);
  const items = getInventoryDefinitions(registry, catalogueStock).filter(item => (carried[item.id] ?? 0) > 0 || (foodOnly ? isTravelFood(item.id) : isAdventureSupply(item.id) || item.id === 'trail_rope' || item.usable && item.kind !== 'garden'));
  const visible = category === 'dishes' || category === 'rations' ? items.filter(item => dishIds.has(item.id) === (category === 'dishes')) : filterBrowseItems(items, category);
  const packedItems = Object.entries(bag).filter(([id, n]) => n > 0 && visible.some(item => item.id === id));
  const automaticItems = Object.entries(automaticFood).filter(([id, n]) => n > 0 && (category === 'all' || category === 'dishes' && dishIds.has(id) || category === 'rations' && !dishIds.has(id)));
  const manualCount = getAdventureBagCount(bag), packed = manualCount + getAdventureBagCount(automaticFood);
  const selected = items.find(item => item.id === selection?.id);
  const amount = selected ? (selection?.source === 'bag' ? carried : warehouse)[selected.id] ?? 0 : 0;
  const selectedTool = Boolean(tool && selected?.id === 'trail_rope');
  const max = selectedTool ? Math.min(1, amount) : selection?.source === 'bag' ? amount : Math.min(capacity, amount);
  const count = Math.max(1, Math.min(quantity, max));
  const canPack = selected && (foodOnly ? isTravelFood(selected.id) : isAdventureSupply(selected.id) || selectedTool);
  const requestedUseCount = selected?.id === 'golden_apple' || selected?.id === 'birthday_cake' ? 1 : getEffectiveBatchQuantity(pet, count);
  const usePlan = selected ? getItemUsePlan(pet, selected, requestedUseCount) : undefined;
  const useCount = usePlan?.quantity ?? 0;
  const canUse = selected?.usable && useCount > 0 && selection?.source === 'warehouse' && amount >= useCount && !pet.timePause && !pet.adventure.active && !isExpeditionAway(pet) && !pet.partnerSchedule.active
    && (isAdventureTreasure(selected.id) || Object.values(getItemRecoveryPreview(pet, selected, useCount, []).actual).some(value => value > 0));
  const transferItem = () => {
    if (!selected || !selection || amount < count) return;
    const intoBag = selection.source === 'warehouse';
    if (intoBag && (!canPack || !selectedTool && manualCount + count > capacity)) return;
    perform(() => {
      if (selectedTool) tool!.onChange(intoBag); else onPack(selected.id, intoBag ? count : -count);
      setTransfer(current => ({ id: selected.id, quantity: count, intoBag, key: (current?.key ?? 0) + 1 }));
    });
  };
  const tile = (id: ItemId, source: 'warehouse' | 'bag', n: number) => {
    const name = registry.get(id)?.name ?? id;
    return <button className="storage-item-tile" key={id} data-item-id={id} aria-label={`${name} ×${n}`} aria-pressed={selection?.id === id && selection.source === source} onClick={() => perform(() => { setSelection({ id, source }); setQuantity(1); })}>
      <span className="storage-tile-count">×{n}</span><span className="storage-tile-picture"><img src={icons[id] ?? unknownItemIcon} alt="" /></span><strong className="storage-tile-name">{name}</strong>
    </button>;
  };
  const categories = foodOnly ? [{ id: 'all' as const, label: '全部' }, { id: 'dishes' as const, label: '料理' }, { id: 'rations' as const, label: '其他食物' }] : getItemBrowseCategories().filter(value => ['all', 'food', 'ingredients', 'care', 'item'].includes(value.id));
  return <div className="preparation-inventory">
    <div className="storage-tabs adventure-pack-tabs" role="group" aria-label="物品分类">{categories.map(value => <button key={value.id} aria-pressed={category === value.id} onClick={() => perform(() => setCategory(value.id))}>{value.label}</button>)}</div>
    <div className="adventure-pack-columns">
      <section className="adventure-pack-pane adventure-pack-pane--bag" aria-label={L('本次携带的背包', 'Packed travel bag')}><h3><Backpack size={18} />{L('背包', 'Travel bag')}<small>{packed}/{capacity}{foodOnly ? ' 份' : ''}</small></h3>
        <progress className="adventure-pack-slots" value={packed} max={capacity} aria-label={L('已占用容量', 'Occupied slots')} />
        <div className="storage-grid-scroll" tabIndex={0} aria-label="浏览背包物品">
          <div className="storage-item-grid">{packedItems.map(([id, n]) => tile(id as ItemId, 'bag', n))}{automaticItems.map(([id, n]) => <div className="storage-item-tile preparation-automatic" key={`automatic:${id}`} aria-label={`自动补给：${registry.get(id)?.name ?? id} ×${n}，出发时购买`}><span className="storage-tile-count">×{n}</span><span className="storage-tile-picture"><img src={icons[id] ?? unknownItemIcon} alt="" /></span><strong className="storage-tile-name">自动补给</strong></div>)}</div>
          {!packedItems.length && !automaticItems.length && <p className="adventure-pack-empty">{packed ? L('背包中没有这类物品。', 'No packed supplies in this category.') : L('从仓库选择物品装入。', 'Choose supplies from home inventory to pack.')}</p>}
          {tool && <div className="adventure-pack-tool"><strong>{L('独立工具位', 'Tool slot')} · {tool.equipped ? 1 : 0}/1</strong>{tool.equipped ? tile('trail_rope', 'bag', 1) : <span>{L('未装备探路绳', 'No trail rope equipped')}</span>}<small>{toolDurabilityLabel(pet, 'trail_rope')} · 过绳索通路才扣耐久</small></div>}
          {bagExtra}
        </div>
      </section>
      <section className="adventure-pack-pane adventure-pack-pane--warehouse" aria-label={L('仓库未装入物资', 'Unpacked home supplies')}><h3><PackageOpen size={18} />{L('仓库', 'Home inventory')}<small>{L('尚未装入', 'Unpacked')}</small></h3><div className="storage-grid-scroll" tabIndex={0} aria-label="浏览仓库物品"><div className="storage-item-grid">{visible.map(item => tile(item.id, 'warehouse', warehouse[item.id] ?? 0))}</div>{!visible.length && <p className="adventure-pack-empty">{L('仓库里还没有这类补给。', 'No supplies in this category yet.')}</p>}</div></section>
    </div>
    <footer className="adventure-pack-footer">
      <div className="adventure-transfer-status" role="status">{transfer && <span key={transfer.key} data-direction={transfer.intoBag ? 'in' : 'out'}><img src={icons[transfer.id] ?? unknownItemIcon} alt="" />{registry.get(transfer.id)?.name} ×{transfer.quantity} {transfer.intoBag ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}{transfer.intoBag ? L('背包', 'Bag') : L('仓库', 'Home')}</span>}</div>
      {selected && selection ? <div className="adventure-pack-selection"><div><strong>{selected.displayName}</strong><small>{L('仓库', 'Home')} {warehouse[selected.id] ?? 0} · {L('背包', 'Bag')} {carried[selected.id] ?? 0}</small></div>
        <QuantityStepper value={count} max={Math.max(1, max)} disabled={!max} onChange={value => perform(() => setQuantity(value))} onInputChange={setQuantity} />
        {(canPack || selection.source === 'bag') && <button className="storage-primary" disabled={!max || selection.source === 'warehouse' && !selectedTool && manualCount + count > capacity} onClick={transferItem}>{selection.source === 'warehouse' ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}{selection.source === 'warehouse' ? L('装入', 'Pack') : L('移回仓库', 'Unpack')} ×{count}</button>}
        {selection.source === 'warehouse' && selected.usable && <button className="storage-secondary" disabled={!canUse} title={usePlan?.blocked ? overfedMessage : undefined} onClick={() => perform(() => { if (canUse) onUseHomeItem(selected.id, useCount); })}>{usePlan?.blocked ? '吃撑了，先消化一下' : isAdventureTreasure(selected.id) ? L(`兑换 ×${useCount} · ${getAdventureTreasureValue(selected.id) * useCount} 金币`, `Exchange ×${useCount} · ${getAdventureTreasureValue(selected.id) * useCount} coins`) : L(`现在${selected.kind === 'food' ? '食用' : '使用'} ×${useCount}`, `Use now ×${useCount}`)}</button>}
        {max > 1 && <QuantityPresets value={count} max={max} onChange={value => perform(() => setQuantity(value))} />}
      </div> : <p>{foodOnly ? '点选料理装入背包；出发时才扣库存和补给费。' : L('点选物品可装包、使用或兑换；每件占一份，出发时才扣库存。', 'Select items to pack. Use home supplies here or exchange treasure for coins. Each item uses one slot. Supplies leave home when you set out.')}</p>}
      {selected && <ItemRecoveryPreview pet={pet} item={selected} quantity={requestedUseCount} favoriteFoodIds={[]} />}
    </footer>
  </div>;
};
