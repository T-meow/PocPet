import { useMemo, useState } from 'react';
import { currencyIcon } from '../assets';
import { getCommunitySale, getCuisineSaleNote } from '../core/communityEconomy';
import { getCommunitySaleable, getMarketQuote } from '../core/communityMarket';
import { demandNames } from '../core/foodCatalog';
import { canSpendCompanionTime } from '../core/kitchen';
import { clampCoins } from '../core/petStats';
import type { InventoryItemDefinition, ItemId, PetState } from '../core/petTypes';
import { ItemStorageModal } from './ItemStorageModal';
import { createItemBrowseState } from './itemBrowse';
import { formatCompactNumber } from './numberFormat';

interface Props {
  pet: PetState; items: readonly InventoryItemDefinition[]; itemIconMap: Partial<Record<string, string>>;
  onClose: () => void; onBack: () => void;
  onRecycle: (itemId: ItemId, quantity: number, expectedStock: number) => void;
}

const RecycleActions = ({ pet, item, quantity, onRecycle }: Pick<Props, 'pet' | 'onRecycle'> & { item: InventoryItemDefinition; quantity: number }) => {
  const [review, setReview] = useState<{ quantity: number; stock: number }>();
  const sale = getCommunitySale(item.id), stock = pet.inventory[item.id] ?? 0;
  const coins = (sale?.base ?? 0) * quantity;
  const free = canSpendCompanionTime(pet), walletFull = clampCoins(pet.coins + coins) !== pet.coins + coins;
  const disabled = !sale || !free || quantity < 1 || quantity > stock || walletFull;
  const reviewing = review?.quantity === quantity && review.stock === stock;
  return <>
    <div className="storage-total"><span>出售所得</span><strong title={`${coins} 金币`}><img src={currencyIcon} alt="" />{formatCompactNumber(coins)}</strong></div>
    <small className="storage-transaction-note">回收单价 {sale?.base ?? 0} 金币／份 · 售出后剩余 {Math.max(0, stock - quantity)} 份</small>
    {sale && !sale.exchangeOnly && <small className="storage-transaction-note">当前摆摊报价 {getMarketQuote(pet, item.id)?.price} 金币／份 · {demandNames[sale.demand]}</small>}
    {getCuisineSaleNote(item.id) && <small className="storage-transaction-note">{getCuisineSaleNote(item.id)}</small>}
    {!free && <small className="storage-transaction-note">伙伴正在休息或忙碌，空闲后可以出售。</small>}
    {walletFull && <small className="storage-transaction-note">金币空间不足，请减少出售数量。</small>}
    {review && !reviewing && <small className="storage-transaction-note">数量或库存已变化，请重新确认出售内容。</small>}
    {reviewing ? <>
      <p className="storage-transaction-note">确认出售「{item.displayName}」×{quantity}，获得 {coins} 金币。</p>
      <button className="storage-primary" disabled={disabled} onClick={() => { onRecycle(item.id, review.quantity, review.stock); setReview(undefined); }}>确认出售</button>
      <button className="storage-secondary" onClick={() => setReview(undefined)}>取消</button>
    </> : <button className="storage-primary" data-recycle-item={item.id} disabled={disabled} onClick={() => setReview({ quantity, stock })}>出售 ×{quantity}</button>}
  </>;
};

export const CommunityRecycleModal = ({ pet, items, itemIconMap, onClose, onBack, onRecycle }: Props) => {
  const [browse, setBrowse] = useState(createItemBrowseState);
  const goods = useMemo(() => items.filter(item => Boolean(getCommunitySale(item.id))), [items]);
  return <ItemStorageModal mode="bag" pet={pet} items={goods} itemIconMap={itemIconMap} browse={browse} onBrowseChange={setBrowse} onClose={onClose} onSwitch={onBack}
    quantityDisabled={!canSpendCompanionTime(pet)}
    context={{ title: '社区回收', inventory: pet.inventory, quantityLimit: item => getCommunitySaleable(pet, item.id), switchLabel: '返回商店', countLabel: '持有', showRecovery: false, showStats: false, note: '选择要出售的数量，确认后金币直接进入钱包。已上架的货品需要先在小摊下架。' }}
    footer={<span>选择道具，按数量出售</span>}
    tileInfo={item => ({ price: <><img src={currencyIcon} alt="" /><span>{formatCompactNumber(getCommunitySale(item.id)!.base)}／份</span></> })}
    renderActions={(item, quantity) => <RecycleActions key={item.id} pet={pet} item={item} quantity={quantity} onRecycle={onRecycle} />} />;
};
