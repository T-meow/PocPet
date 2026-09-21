import { useState } from 'react';
import { Compass } from 'lucide-react';
import { getExpeditionStartReason, isExpeditionSupply, startExpedition } from '../../core/expedition';
import { getExplorationBudget, getExplorationTier, getPatrolFace, explorationRefillMs } from '../../core/explorationBudget';
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

export const ExplorationBudgetCard = ({ pet }: Pick<ExpeditionProps, 'pet'>) => {
  const loop = getExplorationBudget(pet), tier = getExplorationTier(pet), reserved = pet.community.expedition.active?.reservedHarvests ?? 0;
  const minutes = loop ? Math.max(0, Math.ceil((loop.refillAt + explorationRefillMs - Date.now()) / 60000)) : 180;
  return <section className="community-card valley-budget"><h3>探索机会与酬谢</h3><div className="valley-budget-values"><span><b>{loop?.available ?? 0}<small> / 24</small></b>可用采集机会</span><span><b>{getPatrolFace(pet) * 4}</b>溪谷每日基础酬谢</span><span><b>{loop?.vouchers.reduce((sum, v) => sum + (v.quote ?? v.face) - Math.floor((v.quote ?? v.face) * v.paid / 100), 0) ?? 0}</b>积存待领金币</span></div>
    <details><summary>查看恢复时间与成长条件</summary><p>每 3 小时恢复 1 次采集机会；{reserved ? `${reserved} 次已为挂机预留；` : ''}{(loop?.available ?? 0) + reserved >= 24 ? '机会已满' : `约 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后恢复下一次`}。手动与挂机共用。</p><p>每日 5 点新增 4 份酬谢，最多积存 3 天；手动完整巡路领取一份，挂机每 2 小时领取一份的 80%。每日 22 基础小心心也共用。</p><small>当前阶段 {tier}/3：{tier === 1 ? '完成七段故事并修好基地后，溪谷每日酬谢升至 1200 金币。' : tier === 2 ? `基地升至 2 级、累计使用采集机会 ${loop?.used ?? 0}/80、制作溪光水景后，溪谷每日酬谢升至 2400 金币。` : '溪谷经营成熟。'} 已发出的酬谢保留原面额。</small></details>
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
      <p>{style === 'walk' ? '不额外消耗饱食或体力，不采集、不领取酬谢；自然状态变化照常。' : style === 'short' ? '定向采集一次，不领取完整巡路酬谢。勘探时可使用手镐，具体消耗在行动前展示。' : `普通巡路饱食基准 ${explorationTravel.valley.hunger}、体力基准 ${explorationTravel.valley.energy}，最多采集 2 次；实际消耗受路线、心情和判定结果影响。`}</p>
      {style !== 'walk' && <><ExplorationCheckPreparation pet={pet} /><label><input type="checkbox" checked={tool} disabled={!(pet.inventory.trail_rope > 0)} onChange={e => setTool(e.target.checked)} />携带探路绳 · {toolDurabilityLabel(pet, 'trail_rope')}</label><small>工具辅助选项会消耗一次耐久。放大镜、手镐与采集镰直接使用已有工具。</small></>}
    </section>
    {style !== 'walk' && <section className="outpost-section"><h3>携带补给 <small>{count}/{capacity} 份</small></h3><div className="exp-stock-list">{Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isExpeditionSupply(id)).map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name ?? id}<small>仓库 {n}</small></span><input type="number" aria-label={`携带${getInventoryItem(id as ItemId)?.name ?? id}`} min={0} max={Math.min(capacity, n)} value={bag[id] ?? 0} onChange={e => { const value = Math.max(0, Math.min(n, capacity, Math.floor(Number(e.target.value)) || 0)); setBag(old => { const next = { ...old }; if (value) next[id] = value; else delete next[id]; return next; }); }} /></label>)}</div><ExplorationBackpackUpgrade pet={pet} update={update} /></section>}
    <button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与护理用品</button></div>
    <footer className="outpost-action-bar"><div><strong>溪谷 · {style === 'walk' ? '轻装散步' : valleyGatherNames[target]}</strong>{reason && <p className="exp-warning" role="status">{reason}</p>}{style !== 'walk' && invalidBag && <p className="exp-warning">请将补给调整至 {capacity} 份以内，且不超过仓库库存。</p>}</div><button className="exp-primary exp-start" data-action-phase={action.phase} disabled={action.phase !== 'idle' || Boolean(reason) || style !== 'walk' && invalidBag} onClick={() => action.run(() => update(p => startExpedition(p, ['valley'], style !== 'walk' ? bag : {}, style !== 'walk' && tool, actorId, actorName, 'manual', 1, Date.now(), { style, target })), 'walk')}><Compass size={18} />{action.phase !== 'idle' ? '正在出发…' : '出发'}</button></footer>
  </>;
};
