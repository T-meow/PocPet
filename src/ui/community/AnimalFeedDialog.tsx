import { useState } from 'react';
import { getCommunityPurchaseReason } from '../../core/communityData';
import { getEffectiveBatchQuantity, getItemPurchaseQuote, buyItem } from '../../core/petActions';
import { getShopItem } from '../../core/items';
import { getProcessingLimit, getProcessingUnlockReason, processFood, processingRecipes } from '../../core/foodProcessing';
import { canSpendCompanionTime } from '../../core/kitchen';
import { inventoryItemLimit } from '../../core/saveMetadata';
import { HelpButton } from '../help/HelpButton';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import type { CommunityPanelProps } from './types';

const recipes = processingRecipes.filter(recipe => recipe.output === 'animal_feed');

export const AnimalFeedDialog = ({ pet, update, registry, onClose }: Pick<CommunityPanelProps, 'pet' | 'update' | 'registry'> & { onClose: () => void }) => {
  const [mode, setMode] = useState<'buy' | 'process'>('buy');
  const [recipeId, setRecipeId] = useState(recipes[0].id);
  const [quantity, setQuantity] = useState(1);
  const recipe = recipes.find(entry => entry.id === recipeId)!;
  const stock = pet.inventory.animal_feed ?? 0, space = Math.max(0, inventoryItemLimit - stock);
  const item = registry?.get('animal_feed');
  const price = item?.price ?? getShopItem('animal_feed')!.price;
  const limit = mode === 'buy' ? Math.min(getEffectiveBatchQuantity(pet, 99), space) : getProcessingLimit(pet, recipeId);
  const amount = Math.min(quantity, Math.max(1, limit));
  const quote = getItemPurchaseQuote(pet, 'animal_feed', amount, Date.now(), item);
  const reason = pet.timePause ? '时间已冻结' : mode === 'buy'
    ? !space ? '饲料仓库已满' : quote.canPurchase ? '' : quote.reason === 'coins' ? '金币不足' : getCommunityPurchaseReason(pet, 'animal_feed') || '暂时无法购买'
    : !canSpendCompanionTime(pet) ? '伙伴空闲后才能加工' : getProcessingUnlockReason(pet, recipeId) || (space < recipe.quantity ? '饲料仓库空间不足' : !limit ? '加工材料不足' : '');
  const name = (id: string) => registry?.get(id)?.name ?? (id === 'wheat' ? '小麦' : '甜玉米');
  const submit = () => {
    if (reason || !limit) return;
    const revision = pet.community.processing.revision;
    update(current => mode === 'buy'
      ? buyItem(current, 'animal_feed', Date.now(), { quantity: amount, item })
      : processFood(current, recipeId, amount, revision));
    onClose();
  };
  return <CommunityDetailDialog className="community-feed-dialog" title="补充饲料" eyebrow={`库存 ${stock} 份 · 金币 ${Math.floor(pet.coins)}`} onClose={onClose}>
    <HelpButton title="补充饲料" overview={<p>购买或加工的饲料进入共用库存，返回照料窗口后添入食槽。加工需伙伴空闲，每份小麦或甜玉米可免费制成 4 份饲料。</p>} />
    <div className="community-feed-methods" role="group" aria-label="补充饲料方式">
      <button type="button" className="secondary-button" aria-pressed={mode === 'buy'} onClick={() => { setMode('buy'); setQuantity(1); }}>购买饲料</button>
      <button type="button" className="secondary-button" aria-pressed={mode === 'process'} onClick={() => { setMode('process'); setQuantity(1); }}>加工饲料</button>
    </div>
    {mode === 'buy' ? <p>饲料 {price} 金币／份{quote.discountApplied ? ' · 首份享今日优惠' : ''}</p> : <>
      <div className="community-feed-methods" role="group" aria-label="加工材料">{recipes.map(entry => <button key={entry.id} type="button" className="secondary-button" aria-pressed={recipeId === entry.id} onClick={() => { setRecipeId(entry.id); setQuantity(1); }}>{entry.name}</button>)}</div>
      <p>{Object.entries(recipe.inputs).map(([id, count]) => `${name(id)} ×${count * amount}（库存 ${pet.inventory[id] ?? 0}）`).join('、')} → 饲料 ×{recipe.quantity * amount}</p>
      <p>加工费用：0 金币</p>
    </>}
    <label className="community-feed-quantity"><span>{mode === 'buy' ? '购买份数' : '加工批次'}</span><input type="number" min={1} max={Math.max(1, limit)} value={amount} disabled={!limit} onChange={event => setQuantity(Math.max(1, Math.min(Math.max(1, limit), Math.floor(Number(event.target.value)) || 1)))} /></label>
    <div className="community-actions">{[1, 5, 10].map(count => <button key={count} type="button" className="secondary-button" disabled={count > limit} onClick={() => setQuantity(count)}>{count}{mode === 'buy' ? ' 份' : ' 批'}</button>)}</div>
    {reason && <p className="community-note">{reason}</p>}
    <button type="button" className="primary-button community-feed-submit" disabled={Boolean(reason) || !limit} onClick={submit}>{mode === 'buy' ? `购买 ${quote.quantity} 份 · ${quote.totalPrice} 金币` : `加工 ${amount} 批 · 获得 ${recipe.quantity * amount} 份`}</button>
  </CommunityDetailDialog>;
};
