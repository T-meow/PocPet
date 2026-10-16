import { useState } from 'react';
import type { ItemRegistry, PetState } from '../../core/petTypes';
import { getProcessingLimit, getProcessingUnlockReason, processFood, processingRecipes, type ProcessingId } from '../../core/foodProcessing';
import { canSpendCompanionTime, kitchenBatchLimit } from '../../core/kitchen';
import { getCommunitySale, getCuisineSaleNote } from '../../core/communityEconomy';
import { getMarketQuote } from '../../core/communityMarket';
import { demandNames } from '../../core/foodCatalog';
import { HelpButton } from '../help/HelpButton';
import { processingHelp } from '../help/productionHelp';
import { QuantityStepper } from '../QuantityStepper';

export const FoodProcessingPanel = ({ pet, update, registry, icons }: { pet: PetState; update: (action: (p: PetState) => PetState) => void; registry: ItemRegistry; icons: Record<string, string> }) => {
  const [selected, setSelected] = useState<ProcessingId>('mill_flour'), [batches, setBatches] = useState(1);
  const r = processingRecipes.find(r => r.id === selected)!, limit = getProcessingLimit(pet, selected), reason = getProcessingUnlockReason(pet, selected);
  const name = (id: string) => registry.get(id)?.name ?? id;
  const quote = getMarketQuote(pet, r.output), sale = getCommunitySale(r.output);
  return <section className="food-processing"><div className="help-heading"><h3>加工台</h3><HelpButton {...processingHelp} details={<>{processingHelp.details}<p>{getCuisineSaleNote(r.output)}</p></>} /></div>
    <div className="recipe-grid">{processingRecipes.map(entry => <button key={entry.id} className={`recipe-card${selected === entry.id ? ' selected' : ''}`} aria-pressed={selected === entry.id} onClick={() => { setSelected(entry.id); setBatches(1); }}><img src={icons[entry.output]} alt="" /><strong>{entry.name}</strong><small>每批 {entry.quantity} 份</small></button>)}</div>
    <h4>{r.name} · {name(r.output)} ×{r.quantity * batches}</h4>
    <div className="recipe-ingredients">{Object.entries(r.inputs).map(([id, count]) => <div key={id} className={(pet.inventory[id] ?? 0) < count * batches ? 'ingredient missing' : 'ingredient'}><img src={icons[id]} alt="" /><span>{name(id)}<small>消耗 {count * batches} · 持有 {pet.inventory[id] ?? 0}</small></span></div>)}</div>
    <p>{r.fee ? `营养调制费：${r.fee * batches} 金币` : '加工费用：0 金币'} · 成品已有 {pet.inventory[r.output] ?? 0} 份</p>
    {quote && sale && <p>每份基础售价 {sale.base} · 摆摊 {quote.price} 金币 · {demandNames[sale.demand]}</p>}
    <div className="kitchen-quantity-control"><span>加工批次</span><QuantityStepper arrows label="加工批次" value={batches} max={kitchenBatchLimit} onChange={setBatches} /></div>
    <div className="activity-choice kitchen-quantity-presets">{[1, 5, 10, 100].map(n => <button key={n} disabled={n > limit} onClick={() => setBatches(n)}>{n} 批</button>)}<button disabled={!limit} onClick={() => setBatches(limit)}>最多 {limit} 批</button></div>
    <p>每次最多 {kitchenBatchLimit} 批 · 当前可加工 {limit} 批</p>
    <button className="activity-primary" disabled={Boolean(reason) || pet.timePause !== undefined || !canSpendCompanionTime(pet) || batches > limit} onClick={() => update(p => processFood(p, selected, batches, pet.community.processing.revision))}>{reason || `加工 ${batches} 批 · 获得 ${r.quantity * batches} 份`}</button>
    <p role="status">{pet.recentEvent}</p>
  </section>;
};
