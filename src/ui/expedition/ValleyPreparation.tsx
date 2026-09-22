import { useState } from 'react';
import { Compass } from 'lucide-react';
import { getExpeditionStartReason, isExpeditionSupply, startExpedition } from '../../core/expedition';
import { getExplorationBudget, getPatrolFace } from '../../core/explorationBudget';
import { valleyGatherNames, valleyGatherTargets, type ValleyGatherTarget, type ValleyTravelStyle } from '../../core/valleyExplorationData';
import { explorationTravel } from '../../core/explorationTravelData';
import { getInventoryItem } from '../../core/items';
import { expeditionBagCount } from '../../core/expeditionData';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { ExplorationBackpackUpgrade } from './ExplorationBackpackUpgrade';
import { useAdventureAction } from '../useAdventureAction';
import { ExplorationCheckPreparation } from '../ExplorationCheck';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { HelpButton } from '../help/HelpButton';
import { getBudgetHelp } from '../help/explorationHelp';

export const ExplorationBudgetCard = ({ pet }: Pick<ExpeditionProps, 'pet'>) => {
  const loop = getExplorationBudget(pet);
  return <section className="community-card valley-budget"><h3>探索机会与酬谢</h3><div className="valley-budget-values"><span><b>{loop?.available ?? 0}<small> / 24</small></b>可用采集机会</span><span><b>{getPatrolFace(pet) * 3}</b>溪谷每日固定金币</span><span><b>{loop?.vouchers.reduce((sum, v) => { const full = (v.quote ?? v.face) * (v.rewardsVersion === 1 ? .75 : 1); return sum + Math.floor(full) - Math.floor(full * v.paid / 100); }, 0) ?? 0}</b>积存固定金币</span></div>
    <HelpButton {...getBudgetHelp(pet)} />
  </section>;
};

export const ValleyPreparation = ({ pet, update, actorId, actorName, onShop, initialTarget }: ExpeditionProps) => {
  const [style, setStyle] = useState<ValleyTravelStyle>(initialTarget ? 'short' : 'patrol');
  const [target, setTarget] = useState<ValleyGatherTarget>(initialTarget ?? 'valley_mushroom');
  const [bag, setBag] = useState<Inventory>({});
  const [tool, setTool] = useState(false);
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet);
  const reason = getExpeditionStartReason(pet, ['valley'], 'manual', 1, Date.now(), style);
  const count = expeditionBagCount(bag), invalidBag = count > capacity || Object.entries(bag).some(([id, n]) => n > (pet.inventory[id] ?? 0));
  return <>
    <div className="outpost-form-content"><section className="outpost-section"><h3>溪谷巡路与采集</h3>
      <div className="valley-mode-options" role="group" aria-label="溪谷行程类型">{([['patrol', '完整巡路', `${explorationTravel.valley.actions} 节点 · 领取巡路酬谢`], ['short', '定向短途', '2 节点 · 采集或勘探'], ['walk', '轻装散步', '记录见闻 · 不采集']] as const).map(([id, name, hint]) => <button key={id} aria-pressed={style === id} onClick={() => setStyle(id)}><b>{name}</b><small>{hint}</small></button>)}</div>
      {style !== 'walk' && <label className="exp-select-label">本趟目标<select aria-label="溪谷采集目标" value={target} onChange={e => setTarget(e.target.value as ValleyGatherTarget)}>{valleyGatherTargets.map(id => <option key={id} value={id}>{valleyGatherNames[id]}</option>)}</select></label>}
      <p>{style === 'walk' ? '轻松看看风景，不额外消耗，也不采集。' : style === 'short' ? '预计饱食 −42 · 体力 −24 · 采集后返回，无巡路酬谢' : `预计饱食 −${explorationTravel.valley.hunger} · 体力 −${explorationTravel.valley.energy} · 最多采集 2 次`}</p>
      {style !== 'walk' && <><ExplorationCheckPreparation pet={pet} /><label><input type="checkbox" checked={tool} disabled={!(pet.inventory.trail_rope > 0)} onChange={e => setTool(e.target.checked)} />携带探路绳 · {toolDurabilityLabel(pet, 'trail_rope')}</label></>}
    </section>
    {style !== 'walk' && <section className="outpost-section"><h3>携带补给 <small>{count}/{capacity} 份</small></h3><div className="exp-stock-list">{Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isExpeditionSupply(id)).map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name ?? id}<small>仓库 {n}</small></span><input type="number" aria-label={`携带${getInventoryItem(id as ItemId)?.name ?? id}`} min={0} max={Math.min(capacity, n)} value={bag[id] ?? 0} onChange={e => { const value = Math.max(0, Math.min(n, capacity, Math.floor(Number(e.target.value)) || 0)); setBag(old => { const next = { ...old }; if (value) next[id] = value; else delete next[id]; return next; }); }} /></label>)}</div><ExplorationBackpackUpgrade pet={pet} update={update} /></section>}
    <button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与护理用品</button></div>
    <footer className="outpost-action-bar"><div><strong>溪谷 · {style === 'walk' ? '轻装散步' : valleyGatherNames[target]}</strong>{reason && <p className="exp-warning" role="status">{reason}</p>}{style !== 'walk' && invalidBag && <p className="exp-warning">请将补给调整至 {capacity} 份以内，且不超过仓库库存。</p>}</div><button className="exp-primary exp-start" data-action-phase={action.phase} disabled={action.phase !== 'idle' || Boolean(reason) || style !== 'walk' && invalidBag} onClick={() => action.run(() => update(p => startExpedition(p, ['valley'], style !== 'walk' ? bag : {}, style !== 'walk' && tool, actorId, actorName, 'manual', 1, Date.now(), { style, target })), 'walk')}><Compass size={18} />{action.phase !== 'idle' ? '正在出发…' : '出发'}</button></footer>
  </>;
};
