import { useState } from 'react';
import { Compass, Backpack } from 'lucide-react';
import { getExpeditionStartReason, isExpeditionSupply, startExpedition } from '../../core/expedition';
import { getExplorationBudget, getExplorationTier, getPatrolFace, explorationRefillMs } from '../../core/explorationBudget';
import { valleyGatherFinds, valleyGatherNames, valleyGatherTargets, valleyPatrolNodes, type ValleyGatherTarget, type ValleyTravelStyle } from '../../core/valleyExplorationData';
import { getInventoryItem } from '../../core/items';
import { getValleyQuestReason, valleyQuestIds, valleyQuests } from '../../core/valleyQuests';
import { expeditionBagCount } from '../../core/expeditionData';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import type { RationSelection } from '../../core/explorationRations';
import { ExpeditionRations } from './ExpeditionRations';
import { ExplorationBackpackUpgrade } from './ExplorationBackpackUpgrade';
import { useAdventureAction } from '../useAdventureAction';

export const ExplorationBudgetCard = ({ pet }: Pick<ExpeditionProps, 'pet'>) => {
  const loop = getExplorationBudget(pet), tier = getExplorationTier(pet), reserved = pet.community.expedition.active?.reservedHarvests ?? 0;
  const minutes = loop ? Math.max(0, Math.ceil((loop.refillAt + explorationRefillMs - Date.now()) / 60000)) : 180;
  return <section className="exp-card valley-budget"><h3>溪谷日常收益</h3><div className="valley-budget-values"><span><b>{loop?.available ?? 0}<small> / 24</small></b>可用采集机会</span><span><b>{getPatrolFace(pet) * 4}</b>每日巡路酬谢</span><span><b>{loop?.vouchers.reduce((sum, v) => sum + (v.quote ?? v.face) - Math.floor((v.quote ?? v.face) * v.paid / 100), 0) ?? 0}</b>积存待领金币</span></div><p>每 3 小时恢复 1 次采集机会；{reserved ? `${reserved} 次已为挂机预留；` : ''}{(loop?.available ?? 0) + reserved >= 24 ? '机会已满' : `约 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分后恢复下一次`}。手动与挂机共用，次数用完仍可巡路或散步。</p><p>每日 5 点新增 4 份酬谢，最多积存 3 天；手动完整巡路领取一份，挂机每 2 小时领取一份的 80%。每日 22 基础小心心也共用。</p><small>当前阶段 {tier}/3：{tier === 1 ? '完成七段故事并修好基地后，每日酬谢升至 1200 金币。' : tier === 2 ? `基地升至 2 级、累计使用采集机会 ${loop?.used ?? 0}/80、制作溪光水景后，每日酬谢升至 2400 金币。` : '溪谷经营成熟。'} 已发出的酬谢保留原面额。</small></section>;
};

export const ValleyPreparation = (props: ExpeditionProps & { onProjects?: () => void }) => {
  const { pet, update, actorId, actorName, onShop, onStory } = props;
  const [mode, setMode] = useState<'manual' | 'idle'>('manual'), [hours, setHours] = useState(2);
  const [style, setStyle] = useState<ValleyTravelStyle>('patrol'), [target, setTarget] = useState<ValleyGatherTarget>(props.initialTarget ?? 'valley_mushroom');
  const [bag, setBag] = useState<Inventory>({});
  const [rations, setRations] = useState<RationSelection>({ meals: [], autoFill: true });
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet);
  const reason = getExpeditionStartReason(pet, ['valley'], mode, hours, Date.now(), style, rations);
  const nextQuest = valleyQuestIds.find(id => !getValleyQuestReason(pet.adventure, id));
  const count = expeditionBagCount(bag), invalidBag = count > capacity || Object.entries(bag).some(([id, n]) => n > (pet.inventory[id] ?? 0));
  const finds = valleyGatherFinds(target, true);
  return <>
    <ExplorationBudgetCard pet={pet} />
    <section className="exp-card"><h3>溪谷见闻 · {pet.community.expedition.loop?.observations.length ?? 0}/12</h3><p>亲自走完整巡路，试试各处不同的路线与观察方式。记下 6 种见闻获得琥珀 ×1；12 种见闻并完成七段故事后获得古老金条 ×1，各领取一次。</p><details className="exp-bag"><summary>翻开见闻清单</summary>{valleyPatrolNodes.map((node, index) => <p key={node[0]}><b>{node[0]}</b> · {['a', 'b'].map((branch, i) => `${pet.community.expedition.loop?.observations.includes(`${index}:${branch}`) ? '✓' : '○'} ${node[i + 1]}`).join(' / ')}</p>)}</details>{props.onProjects && <button className="exp-secondary" onClick={props.onProjects}>制作珍宝装饰 · 准备溪谷聚餐</button>}</section>
    <section className="exp-card"><h3>溪谷故事 · {pet.adventure.valleyCompleted.length}/7</h3><p>{pet.adventure.valleyCompleted.includes('valley_camp') ? '第一盏灯已经亮起。用溪谷收获做饭、交单、修营地，再把珍宝变成收藏。' : nextQuest ? `下一段：${valleyQuests[nextQuest].name}。${valleyQuests[nextQuest].summary}` : '先完成踩点教学和一次溪谷入口探查，再沿地图走完七段故事。'}</p>{onStory && <button className="exp-secondary" onClick={() => onStory(nextQuest)}>{nextQuest ? '继续这段故事' : '打开溪谷故事地图'}</button>}</section>
    <section className="exp-card exp-preparation"><div className="exp-card-heading"><Backpack size={21} /><h3>安排一次溪谷探索</h3></div>
      <div className="exp-theme"><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>亲自探索</button><button aria-pressed={mode === 'idle'} onClick={() => { setMode('idle'); if (target === 'aquamarine') setTarget('valley_mushroom'); }}>挂机探索</button></div>
      <ExplorationBackpackUpgrade pet={pet} update={update} />
      {mode === 'manual' && <div className="valley-mode-options">{([['patrol', '完整巡路', '6 节点 · 饱食 90 / 体力 50'], ['short', '定向短途', '2 节点 · 饱食 42 / 体力 24'], ['walk', '轻装散步', '6 节点 · 无额外状态消耗']] as const).map(([id, name, hint]) => <button key={id} aria-pressed={style === id} onClick={() => setStyle(id)}><b>{name}</b><small>{hint}</small></button>)}</div>}
      {(mode === 'idle' || style !== 'walk') && <label className="exp-select-label">本趟目标<select aria-label="溪谷采集目标" value={target} onChange={e => setTarget(e.target.value as ValleyGatherTarget)}>{valleyGatherTargets.filter(id => mode === 'manual' || id !== 'aquamarine').map(id => <option key={id} value={id}>{valleyGatherNames[id]}</option>)}</select></label>}
      {mode === 'idle' ? <><ExpeditionRations pet={pet} region="valley" hours={hours} setHours={setHours} selection={rations} onChange={setRations} />
        <div className="exp-quote"><b>目标物资</b><span>{Object.entries(finds).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n * hours}`).join(' · ')}</span></div>
      </> : <><p>{style === 'walk' ? '轻装看看沿途，不采集、不领取酬谢；自然状态变化照常。' : style === 'short' ? '集中采集一次，不领取完整巡路酬谢；手镐可消耗 2 次机会推进 2 点勘探。' : '途中最多使用 2 次采集机会，走完全程领取一份剩余酬谢。营地最多补回本趟损失的 6 体力、3 健康。'}</p>
        {style !== 'walk' && <details className="exp-bag"><summary>整理补给 · {count}/{capacity} 份</summary><div className="exp-stock-list">{Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isExpeditionSupply(id)).map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name ?? id}<small>仓库 {n}</small></span><input type="number" aria-label={`携带${getInventoryItem(id as ItemId)?.name ?? id}`} min={0} max={Math.min(capacity, n)} value={bag[id] ?? 0} onChange={e => { const value = Math.max(0, Math.min(n, capacity, Math.floor(Number(e.target.value)) || 0)); setBag(old => { const next = { ...old }; if (value) next[id] = value; else delete next[id]; return next; }); }} /></label>)}</div></details>}
      </>}
      {reason && <p className="exp-warning">{reason}</p>}{mode === 'manual' && style !== 'walk' && invalidBag && <p className="exp-warning">请将补给调整至 {capacity} 份以内，且不超过仓库库存。</p>}
      <button className="exp-primary exp-start" data-action-phase={action.phase} disabled={action.phase !== 'idle' || Boolean(reason) || mode === 'manual' && style !== 'walk' && invalidBag} onClick={() => action.run(() => update(p => startExpedition(p, ['valley'], mode === 'manual' && style !== 'walk' ? bag : {}, false, actorId, actorName, mode, hours, Date.now(), { style: mode === 'idle' ? 'patrol' : style, target, rations })), 'walk')}><Compass size={18} />{action.phase !== 'idle' ? '正在出发…' : mode === 'idle' ? `开始 ${hours} 小时探索` : '和伙伴一起出发'}</button>
      <button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与护理用品 →</button>
    </section>
  </>;
};
