import { useState } from 'react';
import { Backpack, Trash2, X } from 'lucide-react';
import { buyAdventureSupply, discardAdventureItem, getAdventureServiceQuote, pickupAdventureLoot, redeemAdventureTreasure, transportAdventureSupply, useAdventureSupply } from '../core/adventure';
import { adventureBagCapacity, adventureTransportLimit, createAdventureShopStock, getAdventureShopPrice } from '../core/adventureData';
import { adventureItems, getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { getAdventureBagCount, getAdventureItemPurchaseCapacity, isAdventureSupply } from '../core/adventureState';
import { getInventoryDefinitions } from '../core/items';
import { getItemRecoveryPreview, getItemUsePlan, overfedMessage } from '../core/itemEffects';
import { getItemPurchaseQuote } from '../core/petActions';
import { activityText as L } from '../core/kitchenRecipes';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import type { AdventureDestinationId } from '../core/adventureTypes';
import type { CommunityRoute } from '../core/communityTypes';
import { communityShopItems } from '../core/communityItems';
import { AdventurePreparation } from './AdventurePreparation';
import { DialogShell } from './DialogShell';
import { ItemStorageModal } from './ItemStorageModal';
import { createItemBrowseState } from './itemBrowse';

export type AdventureStoragePanel = 'pack' | 'bag' | 'loot' | 'shop' | 'delivery' | 'supplies';
interface Props {
  panel: AdventureStoragePanel; pet: PetState; registry: ItemRegistry; icons: Record<string, string>;
  destination?: AdventureDestinationId;
  purpose?: CommunityRoute;
  bag: Inventory; tool: boolean; onPack: (id: ItemId, delta: number) => void; onTool: (value: boolean) => void;
  onDepart: () => void; onPanel: (panel: AdventureStoragePanel) => void; onClose: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
  update: (action: (pet: PetState) => PetState) => void;
  perform?: (action: () => void) => void;
}
export const AdventureStorage = ({ panel, pet, registry, icons, bag, tool, destination, purpose, onPack, onTool, onDepart, onPanel, onClose, onBuy, onUseHomeItem, update, perform = action => action() }: Props) => {
  const [browse, setBrowse] = useState(createItemBrowseState);
  const [discard, setDiscard] = useState<{ tripId: string; revision: number; id: ItemId; name: string; quantity: number; source: 'bag' | 'loot' | 'tool' }>();
  if (panel === 'pack') return <AdventurePreparation pet={pet} registry={registry} icons={icons} bag={bag} tool={tool} destination={destination} purpose={purpose} onPack={onPack} onTool={onTool} onDepart={onDepart} onClose={onClose} onUseHomeItem={onUseHomeItem} perform={perform} />;
  const trip = pet.adventure.active;
  const shopping = panel === 'shop' || panel === 'supplies';
  const stock: Inventory = panel === 'bag' ? { ...trip?.bag, ...(trip?.tool ? { trail_rope: 1 } : {}) }
    : panel === 'loot' ? trip?.loot ?? {} : panel === 'shop' ? trip?.shopStock ?? {} : pet.inventory;
  const definitions = getInventoryDefinitions(registry, shopping ? Object.fromEntries((panel === 'shop' ? Object.keys(createAdventureShopStock(trip?.rulesVersion)) : [...adventureItems, ...communityShopItems.filter(item => item.kind === 'care')].map(item => item.id)).map(id => [id, 1])) : stock)
    .filter(item => panel !== 'delivery' || isAdventureSupply(item.id));
  const titles = { pack: L('出发整备', 'Pack for the trip'), bag: L('旅行背包', 'Travel bag'), loot: L('待拾取物资', 'Pending finds'), shop: L('伙伴的随身补给', 'Neighbor supplies'), delivery: L('请伙伴从仓库送货', 'Delivery from home'), supplies: L('基地补给', 'Outpost supplies') };
  const canRecover = (id: ItemId, quantity: number) => {
    const item = registry.get(id);
    return item?.usable && (id !== 'golden_apple' || quantity === 1) && Object.values(getItemRecoveryPreview(pet, item, quantity, []).actual).some(value => value > 0);
  };
  const switchTarget = panel === 'shop' || panel === 'delivery' || panel === 'loot' ? 'bag' : panel === 'supplies' ? 'pack' : panel === 'bag' && getAdventureBagCount(trip?.loot ?? {}) ? 'loot' : panel === 'bag' && trip?.choices.length === 4 && trip.neighborId ? 'shop' : undefined;
  const quantityLimit = (id: ItemId) => {
    if (panel === 'shop' || panel === 'delivery') return getAdventureServiceQuote(pet, id, 1, panel === 'shop' ? 'buy' : 'transport').limit;
    if (panel === 'supplies') return Math.min(adventureBagCapacity, getAdventureItemPurchaseCapacity(pet, id), getItemPurchaseQuote(pet, id, adventureBagCapacity).quantity);
    return Math.min(adventureBagCapacity, stock[id] ?? 0);
  };
  const note = panel === 'loot' ? L('可以收进行囊、当场使用或放弃；所有操作都会保存。', 'Collect, use here or leave behind. Every choice is saved.')
    : panel === 'bag' ? L('这里只显示随身物资。战利品可直接兑换金币，腾出背包空间。', 'Only carried supplies are shown. Exchange treasure for coins to free bag space.')
      : panel === 'shop' ? trip && trip.rulesVersion < 3 ? L('本趟沿用出发时的补给报价，售完不再补货。', 'This trip keeps its original supply prices. Stock does not refresh.') : L('伙伴把补给带到了路上，同款物资售价高于基地商店；本趟售完不再补货。', 'Trail delivery costs extra. Matching supplies cost more than at home; stock does not refresh.') : undefined;
  return <><ItemStorageModal mode={shopping ? 'shop' : 'bag'} pet={pet} items={definitions} itemIconMap={icons} browse={browse} onBrowseChange={setBrowse} onClose={onClose}
    onSwitch={switchTarget ? () => onPanel(switchTarget) : undefined} favoriteFoodIds={[]}
    context={{ title: titles[panel], inventory: stock, quantityLimit: item => quantityLimit(item.id), backdropClassName: 'adventure-modal-backdrop', categories: ['all', 'food', 'ingredients', 'item', 'care'],
      showStats: false, showRecovery: true, note, perform,
      countLabel: panel === 'shop' ? L('剩余 ', 'Stock ') : panel === 'delivery' ? L('仓库 ', 'Home ') : L('数量 ', 'Count '),
      switchLabel: switchTarget ? titles[switchTarget] : undefined }}
    tileInfo={shopping ? item => ({ price: (panel === 'shop' ? getAdventureShopPrice(item.id, trip?.rulesVersion) : getItemPurchaseQuote(pet, item.id).totalPrice) + L(' 金币', ' coins'), mark: panel === 'shop' && !(stock[item.id] ?? 0) ? L('已售完', 'Sold out') : undefined }) : undefined}
    footer={<>
      {trip && <span>{L('行囊', 'Bag')} {getAdventureBagCount(trip.bag)}/12 · {L('工具', 'Tool')} {trip.tool ? 1 : 0}/1</span>}
      {panel === 'delivery' && <span>{L('每份 2 小心心；本趟还可送 ', '2 hearts per item; remaining allowance: ')}{Math.max(0, (trip?.rulesVersion === 1 ? 1 : adventureTransportLimit) - (trip?.transportedCount ?? 0))}</span>}
      {panel === 'shop' && <span>{note}</span>}
      {panel === 'loot' && <span>{L('背包满时可先吃掉补给、兑换战利品，或在旅行背包里整理空间。', 'If full, use supplies, exchange treasure, or make room in your travel bag.')}</span>}
    </>}
    renderActions={(item, quantity) => {
      const id = item.id;
      const exchange = L('兑换 · ', 'Exchange · ') + quantity * getAdventureTreasureValue(id) + L(' 金币', ' coins');
      if (panel === 'supplies') {
        const quote = getItemPurchaseQuote(pet, id, quantity);
        return <button className="storage-primary" disabled={!quote.canPurchase} onClick={() => perform(() => onBuy(id, quantity))}>{L('购买', 'Buy')} {quote.quantity} · {quote.totalPrice} {L('金币', 'coins')}</button>;
      }
      if (!trip) return null;
      if (panel === 'shop' || panel === 'delivery') {
        const quote = getAdventureServiceQuote(pet, id, quantity, panel === 'shop' ? 'buy' : 'transport');
        return <><span className="storage-total">{L('本次数量与费用', 'Quantity and price')}<strong>{quantity} × {quote.unitPrice} = {quote.total}</strong></span><button className="storage-primary" disabled={!quote.canTrade} onClick={() => perform(() => update(current => panel === 'shop' ? buyAdventureSupply(current, trip.id, trip.revision, id, quantity) : transportAdventureSupply(current, trip.id, trip.revision, id, quantity)))}>{panel === 'shop' ? L('购买 · ', 'Buy · ') + quote.total + L(' 金币', ' coins') : L('送来 · ', 'Deliver · ') + quote.total + L(' 小心心', ' hearts')}</button>
          {!quote.canTrade && <small>{L('请检查剩余库存、服务额度、余额与行囊空位。', 'Check stock, service allowance, balance and bag space.')}</small>}</>;
      }
      const source = panel === 'loot' ? 'loot' : id === 'trail_rope' ? 'tool' : 'bag';
      const usePlan = getItemUsePlan(pet, item, quantity);
      return <>
        {source === 'loot' && <button className="storage-primary" disabled={getAdventureBagCount(trip.bag) + quantity > adventureBagCapacity} onClick={() => perform(() => update(current => pickupAdventureLoot(current, trip.id, trip.revision, id, quantity)))}><Backpack size={16} />{L('收起 ×', 'Collect ×')}{quantity}</button>}
        {source !== 'tool' && (isAdventureTreasure(id) ? <button className="storage-primary" onClick={() => perform(() => update(current => redeemAdventureTreasure(current, trip.id, trip.revision, quantity, source, id)))}>{exchange}</button> : item.usable && <button className="storage-primary" disabled={!canRecover(id, quantity)} title={usePlan.blocked ? overfedMessage : undefined} onClick={() => perform(() => update(current => useAdventureSupply(current, trip.id, trip.revision, id, usePlan.quantity, source)))}>{usePlan.blocked ? '吃撑了，先消化一下' : `${source === 'loot' ? L('当场食用 ×', 'Eat here ×') : L('使用 ×', 'Use ×')}${usePlan.quantity}`}</button>)}
        <button className="storage-secondary adventure-discard" onClick={() => perform(() => setDiscard({ tripId: trip.id, revision: trip.revision, id, name: item.displayName, quantity, source }))}><Trash2 size={16} />{L('丢弃 ×', 'Discard ×')}{quantity}</button>
      </>;
    }} />
    {discard && <DialogShell className="adventure-dialog adventure-confirm" backdropClassName="adventure-modal-backdrop" labelId="adventure-discard-title" onClose={() => perform(() => setDiscard(undefined))}>
      <header><h3 id="adventure-discard-title">{L('确认放弃这些物资？', 'Leave these items behind?')}</h3><button className="icon-button" onClick={() => perform(() => setDiscard(undefined))} aria-label={L('取消丢弃', 'Cancel discard')}><X size={19} /></button></header>
      <p>{discard.name} ×{discard.quantity}</p><p>{L('丢弃后无法找回，不会获得金币。家中仓库不会被扣除。', 'Discarded items cannot be recovered and grant no coins. Home inventory is unaffected.')}</p>
      <div className="adventure-dialog-actions"><button className="secondary-button" onClick={() => perform(() => setDiscard(undefined))}>{L('保留', 'Keep')}</button><button className="primary-button" disabled={trip?.id !== discard.tripId || trip?.revision !== discard.revision} onClick={() => perform(() => { update(current => discardAdventureItem(current, discard.tripId, discard.revision, discard.id, discard.quantity, discard.source)); setDiscard(undefined); })}>{L('确认丢弃', 'Discard')}</button></div>
      {(trip?.id !== discard.tripId || trip?.revision !== discard.revision) && <p>{L('物资已变化，请关闭后重新选择。', 'Supplies changed. Close and select again.')}</p>}
    </DialogShell>}
  </>;
};
