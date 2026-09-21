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
import type { ExpeditionProps } from './types';
import { ExplorationBackpackUpgrade } from './ExplorationBackpackUpgrade';
import { useAdventureAction } from '../useAdventureAction';

export const RegionPreparation = ({ selected, pet, update, actorId, actorName, onShop }: ExpeditionProps & { selected: RegionId }) => {
  const [routeId, setRouteId] = useState('single');
  const [bag, setBag] = useState<Inventory>({}), [tool, setTool] = useState(false);
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet);
  const route = routeId === 'single' ? [selected] : expeditionRoutes.find(r => r.id === routeId)!.regions;
  const reason = getExpeditionStartReason(pet, route, 'manual'), count = expeditionBagCount(bag);
  const invalidBag = count > capacity || Object.entries(bag).some(([id, n]) => n > (pet.inventory[id] ?? 0)) || tool && !(pet.inventory.trail_rope ?? 0);
  const total = route.reduce((sum, id) => ({ hunger: sum.hunger + explorationTravel[id].hunger, energy: sum.energy + explorationTravel[id].energy }), { hunger: 0, energy: 0 });
  return <><div className="outpost-form-content"><section className="outpost-section"><h3>{regions[selected].name} · 巡路整备</h3>
      <label className="exp-select-label">行程<select aria-label="选择远征行程" value={routeId} onChange={e => setRouteId(e.target.value)}><option value="single">只去{regions[selected].name} · {explorationTravel[selected].actions} 次行动</option>{expeditionRoutes.map(r => <option key={r.id} value={r.id}>{r.name} · 3 个地区</option>)}</select></label>
      <p className="exp-route-plan">{route.map(id => regions[id].name).join(' → ')}<small>普通路线饱食 {total.hunger}、体力 {total.energy}；各次行动分摊，途中随时补餐。高级调查多消耗 20%；绳索或二级基地降低通路体力 20%。</small></p>
      <details className="exp-bag" open><summary>补给 {count}/{capacity} 份 · 工具另计</summary><div className="exp-stock-list">{Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isExpeditionSupply(id)).map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name ?? id}<small>仓库 {n}</small></span><input aria-label={`携带${getInventoryItem(id as ItemId)?.name ?? id}`} type="number" min={0} max={Math.min(capacity, n)} value={bag[id] ?? 0} onChange={e => { const amount = Math.max(0, Math.min(n, capacity, Math.floor(Number(e.target.value)) || 0)); setBag(old => { const next = { ...old }; if (amount) next[id] = amount; else delete next[id]; return next; }); }} /></label>)}</div></details>
      <label className="exp-rope"><input type="checkbox" checked={tool} disabled={!(pet.inventory.trail_rope ?? 0)} onChange={e => setTool(e.target.checked)} />携带探路绳 · {toolDurabilityLabel(pet, 'trail_rope')}</label>
      <p>工具独立携带：手镐 {toolDurabilityLabel(pet, 'prospector_pick')} · 放大镜 {toolDurabilityLabel(pet, 'survey_lens')} · 营具 {toolDurabilityLabel(pet, 'camp_kit')}。</p>
      <ExplorationBackpackUpgrade pet={pet} update={update} />
    </section>
    <button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与工具</button>
    </div><footer className="outpost-action-bar"><div><strong>{route.map(id => regions[id].name).join(' → ')}</strong>{reason && <p className="exp-warning" role="status">{reason}</p>}{invalidBag && <p className="exp-warning">请调整补给至 {capacity} 份以内，且不超过实际库存。</p>}</div><button className="exp-primary exp-start" data-action-phase={action.phase} disabled={action.phase !== 'idle' || Boolean(reason) || invalidBag} onClick={() => action.run(() => update(p => startExpedition(p, route, bag, tool, actorId, actorName, 'manual')), 'walk')}><Compass size={18} />{action.phase !== 'idle' ? '正在出发…' : '出发'}</button></footer></>;
};
