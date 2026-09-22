import { useState } from 'react';
import { Clock, CornerDownLeft } from 'lucide-react';
import { expeditionLandmarkIcons } from '../../adventureLandmarkAssets';
import { claimExpedition, returnExpedition, selectExpeditionReturn } from '../../core/expedition';
import { expeditionBagCount, regions } from '../../core/expeditionData';
import { getInventoryItem } from '../../core/items';
import { getRemainingRations, rationReturnLines } from '../../core/expeditionRationReturn';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { valleyGatherNames } from '../../core/valleyExplorationData';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { useAdventureAction } from '../useAdventureAction';
import { ExplorationCheckSummary } from '../ExplorationCheck';
import { HelpButton } from '../help/HelpButton';
import { getJourneyHelp } from '../help/explorationHelp';

const itemName = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
export const ExpeditionJourney = ({ pet, update, onCommunity: community, onShop: shop }: ExpeditionProps) => {
  const s = pet.community.expedition, t = s.active, pending = s.pending;
  const [selection, setSelection] = useState<Inventory | undefined>();
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet), busy = action.phase !== 'idle';
  const onCommunity = () => { action.cancel(); community(); }, onShop = () => { action.cancel(); shop(); };
  const move = (fn: (p: typeof pet) => typeof pet) => action.run(() => update(current => {
    const live = current.community.expedition.active;
    if (current.timePause || !live || live.id !== t?.id || live.leg !== t.leg || live.step !== t.step || live.paused !== t.paused) return current;
    if (live.rulesVersion >= 4 && live.revision !== t.revision) return current;
    return fn(current);
  }), 'walk');
  if (pending) {
    const selected = selection ?? pending.items, all = { ...pending.items };
    for (const [id, n] of Object.entries(pending.overflow)) all[id] = (all[id] ?? 0) + n;
    return <section className="exp-card exp-receipt"><span className="exp-eyebrow">{pending.route.map(id => regions[id].name).join(' → ')} · {pending.mode === 'idle' ? '挂机探索' : '旧探索返程'}</span><h2>{pending.reason === 'health' ? '健康不足，已安全返程' : pending.reason === 'complete' ? '旅途完成，收好物资' : '已返回前哨基地'}</h2><p>地区故事和发现已经记下。{pending.tool ? '探路绳另行归还，不占物资容量。' : ''}</p>
      <ExplorationCheckSummary result={pending.lastCheck} />
      {pending.treasureChance !== undefined && <p>本次每两小时随机概率 {pending.treasureChance}%。</p>}
      {pending.treasureFinds?.map(find => <p key={find.at + find.item}>{itemName(find.item)} ×1 · {find.guaranteed ? '第 10 次保底获得' : '随机发现'}</p>)}
      {(pending.rulesVersion ?? 1) >= 5 && <p>当前地区保底进度：{s.treasurePity[pending.route[0]]}/9 次未获得。</p>}
      {pending.rationReturn && rationReturnLines(pending.rationReturn).length > 0 && <div className="outpost-ration-return" aria-label="返程料理结算">{rationReturnLines(pending.rationReturn).map(line => <p key={line}>{line}</p>)}</div>}
      {!pending.selected && <p className="exp-warning">物资超过行囊容量，请一次选定最多 {capacity} 份。确认后未选物资会留在原地。</p>}
      <div className="exp-stock-list">{Object.entries(pending.selected ? pending.items : all).map(([id, n]) => <label key={id}><span>{itemName(id)} ×{n}</span>{!pending.selected && <input type="number" aria-label={`带回${itemName(id)}`} min={0} max={n} value={selected[id] ?? 0} onChange={e => { const count = Math.max(0, Math.min(n, Math.floor(Number(e.target.value)) || 0)); const next = { ...selected }; if (count) next[id] = count; else delete next[id]; setSelection(next); }} />}</label>)}</div>
      <p>{pending.coins} 金币 · {pending.hearts} 心心{pending.refundCoins ? ` · 退回补给费 ${pending.refundCoins} 金币` : ''}{!pending.selected ? ` · 已选 ${expeditionBagCount(selected)}/${capacity} 份` : ''}</p>
      <button className="exp-primary" disabled={!pending.selected && expeditionBagCount(selected) > capacity} onClick={() => update(p => pending.selected ? claimExpedition(p, pending.id) : selectExpeditionReturn(p, pending.id, selected))}>{pending.selected ? '收好这一趟的物资' : '确认带回组合，留下未选物资'}</button><button className="exp-secondary" onClick={onCommunity}>回农场整理物资</button>
    </section>;
  }
  if (!t) return null;
  const region = t.route[0], r = regions[region];
  const leftMinutes = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000));
  return <section className="exp-card exp-journey"><div className="exp-card-heading"><span className="exp-icon"><img src={expeditionLandmarkIcons[region].story} alt="" /></span><h2>{r.name} · 伙伴正在路上</h2></div>
    <div className="exp-timed"><Clock size={28} /><strong>还需 {Math.floor(leftMinutes / 60)} 小时 {leftMinutes % 60} 分</strong><span>已完成 {t.settledParts}/{t.parts} 次采集</span></div>
    <progress aria-label="挂机探索进度" max={t.parts * 3600000} value={Math.max(0, Math.min(t.parts * 3600000, Date.now() - t.startedAt))} />
    <div className="help-heading"><span>目标：{region === 'valley' ? valleyGatherNames[t.target ?? 'valley_mushroom'] : itemName(r.product)}</span><HelpButton {...getJourneyHelp(t)} /></div>
    <p>已得 {t.coins} 金币 · {t.hearts} 心心 · 预留机会 {t.reservedHarvests ?? 0} 次</p>
    {t.rulesVersion >= 5 && <p>随机概率 {t.rationPlan?.chance}% · 地区连续未获得 {s.treasurePity[region]}/9 次；第 10 次必得珍宝。</p>}
    <div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => <p key={id}>{itemName(id)} ×{n}</p>)}</div>
    {t.mode === 'idle' && t.rationPlan && <section className="exp-bag"><p>食物剩余 {expeditionBagCount(getRemainingRations(t, Date.now()))}/{expeditionBagCount(t.rationPlan.food)} 份 · 珍宝 {t.rationPlan.discoveries.filter(d => d.won).length} 件</p><small>提前返回不退食物和补给费。</small></section>}
    {t.mode === 'idle' && !t.rationPlan && t.rationSegments && <p>已寻找珍宝 {t.rationSegments.filter(segment => segment.settled).length}/{t.rationSegments.length} 次 · 找到 {t.rationSegments.filter(segment => segment.won).length} 件</p>}
    <div className="exp-journey-footer"><button disabled={busy} onClick={() => move(p => returnExpedition(p, t.id))}><CornerDownLeft size={16} />{t.mode === 'idle' ? '提前召回伙伴' : '结束行程，保留发现返回'}</button>{t.paused && <button onClick={onCommunity}>回社区照顾伙伴</button>}<button onClick={onShop}>查看商店</button></div>
  </section>;
};
