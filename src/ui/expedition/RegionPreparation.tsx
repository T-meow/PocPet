import { useState } from 'react';
import { Compass } from 'lucide-react';
import { expeditionBagCount, expeditionRoutes, regions } from '../../core/expeditionData';
import { getExpeditionStartReason, isExpeditionSupply, startExpedition } from '../../core/expedition';
import { explorationTravel } from '../../core/explorationTravelData';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { getInventoryItem } from '../../core/items';
import { toolDurabilityLabel } from '../../core/toolDurability';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { RegionId } from '../../core/expeditionTypes';
import type { RationSelection } from '../../core/explorationRations';
import type { ExpeditionProps } from './types';
import { ExpeditionRations } from './ExpeditionRations';
import { ExplorationBackpackUpgrade } from './ExplorationBackpackUpgrade';
import { useAdventureAction } from '../useAdventureAction';

export const RegionPreparation = ({ selected, pet, update, actorId, actorName, onShop }: ExpeditionProps & { selected: RegionId }) => {
  const [mode, setMode] = useState<'manual' | 'idle'>('manual'), [hours, setHours] = useState(2), [routeId, setRouteId] = useState('single');
  const [bag, setBag] = useState<Inventory>({}), [tool, setTool] = useState(false), [rations, setRations] = useState<RationSelection>({ meals: [], autoFill: true });
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet);
  const route = mode === 'idle' || routeId === 'single' ? [selected] : expeditionRoutes.find(r => r.id === routeId)!.regions;
  const reason = getExpeditionStartReason(pet, route, mode, hours, Date.now(), 'patrol', rations), count = expeditionBagCount(bag);
  const invalidBag = count > capacity || Object.entries(bag).some(([id, n]) => n > (pet.inventory[id] ?? 0)) || tool && !(pet.inventory.trail_rope ?? 0);
  const total = route.reduce((sum, id) => ({ hunger: sum.hunger + explorationTravel[id].hunger, energy: sum.energy + explorationTravel[id].energy }), { hunger: 0, energy: 0 });
  return <section className="exp-card exp-preparation"><h3>准备这一趟</h3><ExplorationBackpackUpgrade pet={pet} update={update} />
    <div className="exp-theme"><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>亲自探索</button><button aria-pressed={mode === 'idle'} onClick={() => setMode('idle')}>挂机远行</button></div>
    {mode === 'idle' ? <ExpeditionRations pet={pet} region={selected} hours={hours} setHours={setHours} selection={rations} onChange={setRations} /> : <>
      <label className="exp-select-label">行程<select aria-label="选择远征行程" value={routeId} onChange={e => setRouteId(e.target.value)}><option value="single">只去{regions[selected].name} · {explorationTravel[selected].actions} 次行动</option>{expeditionRoutes.map(r => <option key={r.id} value={r.id}>{r.name} · 3 个地区</option>)}</select></label>
      <p className="exp-route-plan">{route.map(id => regions[id].name).join(' → ')}<small>普通路线饱食 {total.hunger}、体力 {total.energy}；各次行动分摊，途中随时补餐。高级调查多消耗 20%；绳索或二级基地降低通路体力 20%。</small></p>
      <details className="exp-bag" open><summary>补给 {count}/{capacity} 份 · 工具另计</summary><div className="exp-stock-list">{Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isExpeditionSupply(id)).map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name ?? id}<small>仓库 {n}</small></span><input aria-label={`携带${getInventoryItem(id as ItemId)?.name ?? id}`} type="number" min={0} max={Math.min(capacity, n)} value={bag[id] ?? 0} onChange={e => { const amount = Math.max(0, Math.min(n, capacity, Math.floor(Number(e.target.value)) || 0)); setBag(old => { const next = { ...old }; if (amount) next[id] = amount; else delete next[id]; return next; }); }} /></label>)}</div></details>
      <label className="exp-rope"><input type="checkbox" checked={tool} disabled={!(pet.inventory.trail_rope ?? 0)} onChange={e => setTool(e.target.checked)} />携带探路绳 · {toolDurabilityLabel(pet, 'trail_rope')}</label>
      <p>工具独立携带：手镐 {toolDurabilityLabel(pet, 'prospector_pick')} · 放大镜 {toolDurabilityLabel(pet, 'survey_lens')} · 营具 {toolDurabilityLabel(pet, 'camp_kit')}。</p>
    </>}
    {reason && <p className="exp-warning">{reason}</p>}{mode === 'manual' && invalidBag && <p className="exp-warning">请调整补给至 {capacity} 份以内，且不超过实际库存。</p>}
    <button className="exp-primary exp-start" data-action-phase={action.phase} disabled={action.phase !== 'idle' || Boolean(reason) || mode === 'manual' && invalidBag} onClick={() => action.run(() => update(p => startExpedition(p, route, mode === 'manual' ? bag : {}, mode === 'manual' && tool, actorId, actorName, mode, hours, Date.now(), { rations })), 'walk')}><Compass size={18} />{action.phase !== 'idle' ? '正在出发…' : mode === 'idle' ? `开始 ${hours} 小时探索` : '和伙伴一起出发'}</button>
    <small className="exp-muted">健康需 ≥40% 才能出发；途中低于 20% 会安全返程。</small><button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与工具</button>
  </section>;
};
