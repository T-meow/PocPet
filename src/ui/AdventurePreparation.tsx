import { useState } from 'react';
import { ArrowLeft, ArrowRight, Backpack, Compass, PackageOpen, X } from 'lucide-react';
import { unknownItemIcon } from '../assets';
import { adventureBagCapacity, adventureTaskName } from '../core/adventureData';
import type { AdventureDestinationId } from '../core/adventureTypes';
import { getAdventureStartReason } from '../core/adventure';
import { getAdventureBagCount, isAdventureSupply } from '../core/adventureState';
import { getInventoryDefinitions } from '../core/items';
import { getEffectiveBatchQuantity } from '../core/petActions';
import { getItemRecoveryPreview, getItemUsePlan, overfedMessage } from '../core/itemEffects';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { activityText as L } from '../core/kitchenRecipes';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { DialogShell } from './DialogShell';
import { QuantityStepper } from './QuantityStepper';
import { QuantityPresets } from './QuantityPresets';
import { ItemRecoveryPreview } from './ItemRecoveryPreview';
import { getItemBrowseCategories, filterBrowseItems, type ItemBrowseCategory } from './itemBrowse';

interface Props {
  pet: PetState; registry: ItemRegistry; icons: Record<string, string>; bag: Inventory; tool: boolean;
  destination?: AdventureDestinationId;
  onPack: (id: ItemId, delta: number) => void; onTool: (value: boolean) => void;
  onDepart: () => void; onClose: () => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
  perform: (action: () => void) => void;
}
export const AdventurePreparation = ({ pet, registry, icons, bag, tool, destination, onPack, onTool, onDepart, onClose, onUseHomeItem, perform }: Props) => {
  const [category, setCategory] = useState<ItemBrowseCategory>('all');
  const [selection, setSelection] = useState<{ id: ItemId; source: 'warehouse' | 'bag' }>();
  const [quantity, setQuantity] = useState(1);
  const [transfer, setTransfer] = useState<{ id: ItemId; quantity: number; intoBag: boolean; key: number }>();
  const carried: Inventory = { ...bag, ...(tool ? { trail_rope: 1 } : {}) };
  const warehouse = Object.fromEntries(Object.entries(pet.inventory).map(([id, count]) => [id, Math.max(0, count - (carried[id] ?? 0))]));
  const catalogueStock = { ...pet.inventory };
  for (const [id, n] of Object.entries(carried)) catalogueStock[id] = Math.max(catalogueStock[id] ?? 0, n);
  const items = getInventoryDefinitions(registry, catalogueStock).filter(item => isAdventureSupply(item.id) || item.id === 'trail_rope' || item.usable && item.kind !== 'garden');
  const visible = filterBrowseItems(items, category);
  const packed = getAdventureBagCount(bag);
  const selected = items.find(item => item.id === selection?.id);
  const amount = selected ? (selection?.source === 'bag' ? carried : warehouse)[selected.id] ?? 0 : 0;
  const max = selected?.id === 'trail_rope' ? Math.min(1, amount) : Math.min(adventureBagCapacity, amount);
  const count = Math.max(1, Math.min(quantity, max));
  const canPack = selected && (isAdventureSupply(selected.id) || selected.id === 'trail_rope');
  const requestedUseCount = selected?.id === 'golden_apple' || selected?.id === 'birthday_cake' ? 1 : getEffectiveBatchQuantity(pet, count);
  const usePlan = selected ? getItemUsePlan(pet, selected, requestedUseCount) : undefined;
  const useCount = usePlan?.quantity ?? 0;
  const canUse = selected?.usable && useCount > 0 && selection?.source === 'warehouse' && amount >= useCount && !pet.adventure.active && !pet.partnerSchedule.active
    && (isAdventureTreasure(selected.id) || Object.values(getItemRecoveryPreview(pet, selected, useCount, []).actual).some(value => value > 0));
  const reason = getAdventureStartReason(pet, destination);
  const valid = packed <= adventureBagCapacity && Object.entries(carried).every(([id, n]) => n <= (pet.inventory[id] ?? 0));
  const transferItem = () => {
    if (!selected || !selection || amount < count) return;
    const intoBag = selection.source === 'warehouse';
    if (intoBag && !canPack) return;
    if (intoBag && selected.id !== 'trail_rope' && packed + count > adventureBagCapacity) return;
    perform(() => {
      if (selected.id === 'trail_rope') onTool(intoBag); else onPack(selected.id, intoBag ? count : -count);
      setTransfer(current => ({ id: selected.id, quantity: count, intoBag, key: (current?.key ?? 0) + 1 }));
    });
  };
  const tile = (id: ItemId, source: 'warehouse' | 'bag', n: number) => {
    const item = registry.get(id);
    return <button className="storage-item-tile" key={id} data-item-id={id} aria-pressed={selection?.id === id && selection.source === source} onClick={() => perform(() => { setSelection({ id, source }); setQuantity(1); })}>
      <span className="storage-tile-count">×{n}</span><span className="storage-tile-picture"><img src={icons[id] ?? unknownItemIcon} alt="" /></span><strong className="storage-tile-name">{item?.name ?? id}</strong>
    </button>;
  };
  return <DialogShell className="storage-modal adventure-preparation" backdropClassName="storage-backdrop adventure-modal-backdrop" labelId="adventure-pack-title" onClose={() => perform(onClose)}>
    <header className="storage-header"><div className="storage-title"><span className="storage-title-icon"><Backpack /></span><h2 id="adventure-pack-title">{L('出发整备', 'Pack for the trip')}</h2></div><button className="icon-button" onClick={() => perform(onClose)} aria-label={L('关闭整备', 'Close preparation')}><X size={20} /></button></header>
    <div className="storage-tabs adventure-pack-tabs">{getItemBrowseCategories().filter(value => ['all', 'food', 'ingredients', 'care', 'item'].includes(value.id)).map(value => <button key={value.id} aria-pressed={category === value.id} onClick={() => perform(() => setCategory(value.id))}>{value.label}</button>)}</div>
    <div className="adventure-pack-columns">
      <section className="adventure-pack-pane" aria-label={L('仓库未装入物资', 'Unpacked home supplies')}><h3><PackageOpen size={18} />{L('仓库', 'Home inventory')}<small>{L('尚未装入', 'Unpacked')}</small></h3><div className="storage-grid-scroll"><div className="storage-item-grid">{visible.map(item => tile(item.id, 'warehouse', warehouse[item.id] ?? 0))}</div>{!visible.length && <p className="adventure-pack-empty">{L('仓库里还没有这类补给。', 'No supplies in this category yet.')}</p>}</div></section>
      <section className="adventure-pack-pane adventure-pack-pane--bag" aria-label={L('本次携带的背包', 'Packed travel bag')}><h3><Backpack size={18} />{L('背包', 'Travel bag')}<small>{packed}/12</small></h3>
        <div className="adventure-pack-slots" aria-label={L('已占用容量', 'Occupied slots')}>{Array.from({ length: 12 }, (_, i) => <i key={i} data-filled={i < packed} />)}</div>
        <div className="storage-grid-scroll"><div className="storage-item-grid">{Object.entries(bag).filter(([id, n]) => n > 0 && visible.some(item => item.id === id)).map(([id, n]) => tile(id as ItemId, 'bag', n))}</div>{!packed && <p className="adventure-pack-empty">{L('选择左侧物品，装入几份料理。', 'Choose supplies on the left to pack a few dishes.')}</p>}</div>
        <div className="adventure-pack-tool"><strong>{L('独立工具位', 'Tool slot')} · {tool ? 1 : 0}/1</strong>{tool ? tile('trail_rope', 'bag', 1) : <span>{L('未装备探路绳', 'No trail rope equipped')}</span>}</div>
      </section>
    </div>
    <div className="adventure-transfer-status" role="status">{transfer ? <span key={transfer.key} data-direction={transfer.intoBag ? 'in' : 'out'}><img src={icons[transfer.id] ?? unknownItemIcon} alt="" />{registry.get(transfer.id)?.name} ×{transfer.quantity} {transfer.intoBag ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}{transfer.intoBag ? L('背包', 'Bag') : L('仓库', 'Home')}</span> : L('同类物品合并显示，每件占一份；出发时才扣除仓库库存。', 'Each item uses one slot. Supplies leave home when you set out.')}</div>
    <footer className="adventure-pack-footer">
      {selected && selection ? <div className="adventure-pack-selection"><div><strong>{selected.displayName}</strong><small>{L('仓库', 'Home')} {warehouse[selected.id] ?? 0} · {L('背包', 'Bag')} {carried[selected.id] ?? 0}</small></div>
        <QuantityStepper value={count} max={Math.max(1, max)} disabled={!max} onChange={value => perform(() => setQuantity(value))} onInputChange={setQuantity} />
        {(canPack || selection.source === 'bag') && <button className="storage-primary" disabled={!max || selection.source === 'warehouse' && selected.id !== 'trail_rope' && packed + count > adventureBagCapacity} onClick={transferItem}>{selection.source === 'warehouse' ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}{selection.source === 'warehouse' ? L('装入', 'Pack') : L('移回仓库', 'Unpack')} ×{count}</button>}
        {selection.source === 'warehouse' && selected.usable && <button className="storage-secondary" disabled={!canUse} title={usePlan?.blocked ? overfedMessage : undefined} onClick={() => perform(() => { if (canUse) onUseHomeItem(selected.id, useCount); })}>{usePlan?.blocked ? '吃撑了，先消化一下' : isAdventureTreasure(selected.id) ? L(`兑换 ×${useCount} · ${getAdventureTreasureValue(selected.id) * useCount} 金币`, `Exchange ×${useCount} · ${getAdventureTreasureValue(selected.id) * useCount} coins`) : L(`现在${selected.kind === 'food' ? '食用' : '使用'} ×${useCount}`, `Use now ×${useCount}`)}</button>}
        {max > 1 && <QuantityPresets value={count} max={max} onChange={value => perform(() => setQuantity(value))} />}
      </div> : <p>{L('点选物品后装入背包；仓库中的补给可以直接使用，战利品可以兑换金币。', 'Select items to pack. Use home supplies here or exchange treasure for coins.')}</p>}
      {selected && selection?.source === 'warehouse' && <ItemRecoveryPreview pet={pet} item={selected} quantity={requestedUseCount} favoriteFoodIds={[]} />}
    </footer>
    <div className="adventure-pack-depart"><div><strong>{destination ? (destination === 'tutorial' ? '' : L('溪谷 · ', 'Creek Valley · ')) + adventureTaskName(destination) : L('尚未选择目的地', 'No destination selected')}</strong>{destination && <small>{destination === 'tutorial' ? L('4 个节点 · 全程饱食 32、体力 8 · 无需额外道具', '4 stops · 32 hunger, 8 energy in total · No extra items needed') : L('全程饱食 300～345 · 体力 74～98 · 返程免费', '300–345 hunger · 74–98 energy · Free return')}</small>}{(reason || !valid) && <small className="adventure-blocked">{reason || L('库存已变化，请调整携带选择。', 'Inventory changed. Adjust the selection.')}</small>}</div><button className="adventure-depart-button" disabled={Boolean(reason) || !valid} onClick={() => perform(onDepart)}><Compass size={22} />{L('出发', 'Set out')}</button></div>
  </DialogShell>;
};
