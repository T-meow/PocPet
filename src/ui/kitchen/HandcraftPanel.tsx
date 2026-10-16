import type { Dispatch, SetStateAction } from 'react';
import { Hammer, X } from 'lucide-react';
import type { ItemId, ItemRegistry, PetState } from '../../core/petTypes';
import { handcraftMaterialIds, handcraftMaterials, handcraftRecipes, cookingByproducts, type HandcraftId } from '../../core/handcraftData';
import { craftHandcraft, getHandcraftLimit, getHandcraftReason, getHandcraftUnlockReason } from '../../core/handcraft';
import { claimHandcraftMaterials } from '../../core/handcraftState';
import { getCommunitySale, getCuisineSaleNote } from '../../core/communityEconomy';
import { getMarketQuote } from '../../core/communityMarket';
import { kitchenBatchLimit } from '../../core/kitchen';
import { inventoryItemLimit } from '../../core/saveMetadata';
import { marketStackLimit } from '../../core/communityMarketRules';
import { rarityNames } from '../../core/foodCatalog';
import { DialogShell } from '../DialogShell';
import { DishValueBadge } from '../DishValueBadge';
import { QuantityStepper } from '../QuantityStepper';
import { getItemSourceLabel } from '../itemSourceLabel';
import { HelpButton } from '../help/HelpButton';

export interface HandcraftView { selected: HandcraftId; quantity: number; open: boolean }
interface Props { pet: PetState; update: (action: (pet: PetState) => PetState) => void; registry: ItemRegistry; icons: Record<string, string>; onShop: () => void; view: HandcraftView; onViewChange: Dispatch<SetStateAction<HandcraftView>> }
export const HandcraftPanel = ({ pet, update, registry, icons, onShop, view, onViewChange }: Props) => {
  const { selected, quantity, open } = view;
  const setQuantity = (quantity: number) => onViewChange(current => ({ ...current, quantity }));
  const setOpen = (open: boolean) => onViewChange(current => ({ ...current, open }));
  const state = pet.kitchen.handcraft, recipe = handcraftRecipes.find(entry => entry.id === selected)!;
  const sale = getCommunitySale(selected)!, quote = getMarketQuote(pet, selected);
  const limit = getHandcraftLimit(pet, selected), reason = getHandcraftReason(pet, selected, quantity);
  const pending = handcraftMaterialIds.filter(id => (state.pending[id] ?? 0) > 0);
  const canClaim = pending.some(id => (pet.inventory[id] ?? 0) < inventoryItemLimit);
  const name = (id: string) => registry.get(id as ItemId)?.name ?? id;
  return <section className="handcraft-panel">
    <div className="help-heading"><h3><Hammer size={19} />手工台</h3><HelpButton title="手工制作" overview={<><p>把副产物、商店礼物和旅途材料做成玩具，在小摊出售。每批最多 {kitchenBatchLimit} 件，制作只消耗材料，不另扣金币或发心心。</p><p>原料中的采集物、地区珍宝、蛋壳／贝壳和商店心情类商品，制作计价提高30%；再增加60%工艺收益，计算成品基础售价。小摊加价另计。</p></>} details={<><p>每实耗3个生鸡蛋回收1份蛋壳，每实耗2份蛤蜊回收1份净贝壳；不足一份的进度累计保存。使用前序成品料理不重复回收。</p><p>满仓的副产物暂存在手工台，腾出仓库后可领取；成品仓库放不下整批时，不扣制作材料。</p></>} /></div>
    <p>做一件小玩具，把旅途的收获变成小摊里的好东西。</p>
    <div className="handcraft-materials">{cookingByproducts.map(source => <div key={source.output}><img src={icons[source.output]} alt="" /><span><strong>{handcraftMaterials[source.output].name} ×{pet.inventory[source.output] ?? 0}</strong><small>{source.input === 'egg' ? '鸡蛋' : '蛤蜊'}回收进度 {state.remainders[source.output]}/{source.required}</small></span></div>)}</div>
    {pending.length > 0 && <div className="handcraft-pending"><p>待领：{pending.map(id => `${handcraftMaterials[id].name} ×${state.pending[id]}`).join('、')}</p><button type="button" className="activity-secondary" disabled={Boolean(pet.timePause) || !canClaim} onClick={() => update(claimHandcraftMaterials)}>{canClaim ? '领回副产物' : '仓库已满，副产物继续保留'}</button></div>}
    <div className="recipe-grid handcraft-grid">{handcraftRecipes.map(entry => {
      const unlock = getHandcraftUnlockReason(pet, entry.id), price = getCommunitySale(entry.id)!.base;
      return <button key={entry.id} type="button" className="recipe-card handcraft-card" aria-haspopup="dialog" onClick={() => onViewChange({ selected: entry.id, quantity: 1, open: true })}>
        <img src={icons[entry.id]} alt="" draggable={false} /><strong>{entry.name}</strong><DishValueBadge itemId={entry.id} />
        <small>{rarityNames[entry.rarity]} · 基础售价 {price} 金币</small><small>{unlock || `已制作 ${state.made[entry.id] ?? 0} 件`}</small>
      </button>;
    })}</div>
    {open && <DialogShell className="activity-modal kitchen-recipe-modal handcraft-detail-modal" backdropClassName="activity-backdrop" labelId="handcraft-title" onClose={() => setOpen(false)}>
      <header className="activity-header"><div className="activity-heading"><span className="activity-icon"><Hammer /></span><h2 id="handcraft-title">制作手工品</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="关闭并返回手工台"><X /></button></header>
      <div className="activity-body recipe-detail"><img className="handcraft-preview" src={icons[selected]} alt="" /><h3>{recipe.name}</h3><DishValueBadge itemId={selected} /><p>{recipe.description}</p>
        <p>基础售价 {sale.base} 金币／件{pet.community.market.level > 0 && quote ? ` · 当前小摊售价 ${quote.price} 金币／件` : ''}</p>
        <p className="activity-muted">每栏最多 {marketStackLimit} 件，制作后到社区小摊手动上架。成品没有食用或永久装饰加成。</p>
        <div className="recipe-ingredients">{Object.entries(recipe.inputs).map(([id, amount]) => <div key={id} className={(pet.inventory[id] ?? 0) < amount * quantity ? 'ingredient missing' : 'ingredient'}><img src={icons[id]} alt="" /><span>{name(id)}<small>需要 {amount * quantity} · 持有 {pet.inventory[id] ?? 0}</small><small>来源：{getItemSourceLabel(id)}</small></span></div>)}</div>
        <div className="kitchen-quantity-control"><span>制作件数</span><QuantityStepper arrows label="手工品制作件数" value={quantity} max={kitchenBatchLimit} onChange={setQuantity} /></div>
        <div className="activity-choice kitchen-quantity-presets">{[1, 5, 10, 100].map(amount => <button key={amount} type="button" disabled={amount > limit} onClick={() => setQuantity(amount)}>{amount}</button>)}<button type="button" disabled={!limit} onClick={() => setQuantity(limit)}>最多 {limit} 件</button></div>
        <p>成品库存 {pet.inventory[selected] ?? 0} 件 · 累计制作 {state.made[selected] ?? 0} 件</p>
        <details className="handcraft-pricing"><summary>查看售价计算</summary><p>{getCuisineSaleNote(selected)}</p></details>
        {reason && <p className="activity-info">{reason}</p>}
        <button type="button" className="activity-primary" disabled={Boolean(reason)} onClick={() => update(current => craftHandcraft(current, selected, quantity, state.revision))}>制作 {quantity} 件</button>
        <button type="button" className="activity-link" onClick={onShop}>去商店补充材料</button>
      </div>
    </DialogShell>}
  </section>;
};
