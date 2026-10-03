import { useState } from 'react';
import { Backpack, Clock, CornerDownLeft, Home, Sparkles, X } from 'lucide-react';
import { claimExpedition, returnExpedition, selectExpeditionReturn } from '../../core/expedition';
import { expeditionBagCount, regions } from '../../core/expeditionData';
import { formatExpeditionInterval, getExpeditionCheckCount, getExpeditionCheckIntervalMs } from '../../core/expeditionTiming';
import { idleExplorationRandomTarget } from '../../core/explorationResources';
import { getInventoryItem } from '../../core/items';
import { getRemainingRations, rationReturnLines } from '../../core/expeditionRationReturn';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { landmarkTargetName } from '../../core/landmarkData';
import { DialogShell } from '../DialogShell';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { useAdventureAction } from '../useAdventureAction';
import { ExplorationCheckSummary } from '../ExplorationCheck';
import { HelpButton } from '../help/HelpButton';
import { getJourneyHelp } from '../help/explorationHelp';
import { formatProbabilityPercent } from '../numberFormat';
import { AdventureLandscape } from '../AdventurePresentation';
import { mapRegionForExpedition } from '../../core/landmarkProgress';
import { unknownItemIcon } from '../../assets';

const itemName = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
export const ExpeditionJourney = ({ pet, portrait, update, onCommunity: community, onShop: shop, onHall, icons = {} }: ExpeditionProps & { onHall?: () => void; icons?: Record<string,string> }) => {
  const s = pet.community.expedition, t = s.active, pending = s.pending;
  const [selection, setSelection] = useState<Inventory | undefined>();
  const [recall, setRecall] = useState(false);
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
    return <section className="exp-card exp-receipt"><AdventureLandscape region={mapRegionForExpedition[pending.route[0]]} node="camp" portrait={portrait} label="平安归来 · 收好这一趟的发现" /><span className="exp-eyebrow">{pending.route.map(id => regions[id].name).join(' → ')} · {pending.mode === 'idle' ? '挂机探索' : '旧探索返程'}</span><h2>{pending.reason === 'health' ? '健康不足，已安全返程' : pending.reason === 'complete' ? '旅途完成，收好物资' : '已返回前哨基地'}</h2><p>地区故事和发现已经记下。{pending.tool ? '探路绳另行归还，不占物资容量。' : ''}</p>
      <ExplorationCheckSummary result={pending.lastCheck} />
      {pending.treasureChance !== undefined && <p>每次珍宝判定的随机概率 {formatProbabilityPercent(pending.treasureChance)}。</p>}
      {pending.treasureFinds?.map(find => <p key={find.at + find.item}>{itemName(find.item)} ×1 · {find.guaranteed ? '第 10 次保底获得' : '随机发现'}</p>)}
      {(pending.rulesVersion ?? 1) >= 5 && <p>当前地区保底进度：{s.treasurePity[pending.route[0]]}/9 次未获得。</p>}
      {pending.rationReturn && rationReturnLines(pending.rationReturn).length > 0 && <div className="outpost-ration-return" aria-label="返程料理结算">{rationReturnLines(pending.rationReturn).map(line => <p key={line}>{line}</p>)}</div>}
      {!pending.selected && <p className="exp-warning">物资超过行囊容量，请一次选定最多 {capacity} 份。确认后未选物资会留在原地。</p>}
      <div className="exp-stock-list">{Object.entries(pending.selected ? pending.items : all).map(([id, n]) => <label key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span>{itemName(id)} ×{n}</span>{!pending.selected && <input type="number" aria-label={`带回${itemName(id)}`} min={0} max={n} value={selected[id] ?? 0} onChange={e => { const count = Math.max(0, Math.min(n, Math.floor(Number(e.target.value)) || 0)); const next = { ...selected }; if (count) next[id] = count; else delete next[id]; setSelection(next); }} />}</label>)}</div>
      <p>{pending.coins} 金币 · {pending.hearts} 心心{pending.refundCoins ? ` · 退回补给费 ${pending.refundCoins} 金币` : ''}{!pending.selected ? ` · 已选 ${expeditionBagCount(selected)}/${capacity} 份` : ''}</p>
      <button className="exp-primary" disabled={!pending.selected && expeditionBagCount(selected) > capacity} onClick={() => update(p => pending.selected ? claimExpedition(p, pending.id) : selectExpeditionReturn(p, pending.id, selected))}>{pending.selected ? '收好这一趟的物资' : '确认带回组合，留下未选物资'}</button><button className="exp-secondary" onClick={onCommunity}>回农场整理物资</button>
    </section>;
  }
  if (!t) return null;
  const region = t.route[0], r = regions[region];
  const intervalMs = getExpeditionCheckIntervalMs(t), checks = getExpeditionCheckCount(t);
  const treasureInterval = formatExpeditionInterval(t.rulesVersion >= 7 ? intervalMs : 7200000);
  const leftMinutes = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000));
  return <div className="exploration-idle-layout"><div className="exploration-prep-main"><section className="exploration-panel exploration-idle-destination"><AdventureLandscape region={mapRegionForExpedition[region]} node="camp" portrait={portrait} label="伙伴正在路上" /><div className="help-heading"><h3>{t.actorName} 正在{r.name}采集</h3><HelpButton {...getJourneyHelp(t)} /></div><p>{t.rulesVersion >= 8 ? t.target === idleExplorationRandomTarget || !t.target ? '随机采集当地物产' : `采集偏好：${landmarkTargetName(t.target)}（随机掉落）` : `目标：${landmarkTargetName(t.target ?? r.product)}`} · 营地 Lv.{s.regions[region].base}</p></section>
    <section className="exploration-panel"><div className="exploration-section-heading"><h3>这一趟的小小收获</h3><small>已完成 {t.settledParts} / {checks} 次采集</small></div><div className="exploration-idle-finds">{Object.entries(t.bag).map(([id,n]) => <div key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span>{itemName(id)}<strong>×{n}</strong></span></div>)}{!Object.keys(t.bag).length && <div className="exploration-waiting-find"><Backpack size={32} /><span>伙伴正在寻找物产<small>每完成 {formatExpeditionInterval(intervalMs)}，记录一次采集收获。</small></span></div>}</div><div className="exploration-idle-budget"><Backpack size={23} /><strong>返程物资 {expeditionBagCount(t.bag)} 份</strong><span>{t.coins} 金币 · {t.hearts} 心心</span></div><p>采集进度会自动保存，离开游戏后旅途仍会继续。</p></section>
    </div><aside className="exploration-panel exploration-idle-status"><div className="exploration-section-heading"><h3>距离归来</h3><span className="exploration-tag">进行中</span></div><div className="exp-timed"><Clock size={72} strokeWidth={1.2} /><strong>{Math.floor(leftMinutes/60)} 小时 {leftMinutes%60} 分</strong><span>{t.parts} 小时行程 · 已完成 {t.settledParts} 次采集</span></div><progress aria-label="挂机探索进度" max={t.parts*3600000} value={Math.max(0,Math.min(t.parts*3600000,Date.now()-t.startedAt))} /><div className="exploration-idle-stat-lines"><p><span>下次采集</span><strong>{t.settledParts >= checks ? '采集完成，正在返程' : `${Math.max(1,Math.ceil((t.startedAt+(t.settledParts+1)*intervalMs-Date.now())/60000))} 分钟后`}</strong></p><p><span>待使用采集机会</span><strong>{t.reservedHarvests ?? 0} 次</strong></p>{t.mode === 'idle' && t.rationPlan && <p><span>剩余口粮</span><strong>{expeditionBagCount(getRemainingRations(t,Date.now()))} / {expeditionBagCount(t.rationPlan.food)} 份</strong></p>}</div>
    {t.rulesVersion >= 5 && t.rationPlan && <section className="exploration-treasure-note"><h4><Sparkles size={21} />珍宝机会</h4><p>每 {treasureInterval} {formatProbabilityPercent(t.rationPlan.chance)} · 连续未获得 {s.treasurePity[region]} / 9 次</p><small>第 10 次必得当地珍宝。</small></section>}
    {t.mode === 'idle' && !t.rationPlan && t.rationSegments && <p>已寻找珍宝 {t.rationSegments.filter(segment => segment.settled).length}/{t.rationSegments.length} 次 · 找到 {t.rationSegments.filter(segment => segment.won).length} 件</p>}
    <p>提前返回保留已得物资，不退食物和补给费。</p><div className="exp-journey-footer">{onHall && <button className="primary-button" onClick={onHall}><Home size={19} />回前哨等伙伴</button>}<button className="secondary-button" disabled={busy} onClick={() => setRecall(true)}><CornerDownLeft size={17} />{t.mode === 'idle' ? '提前召回伙伴' : '结束行程，保留发现返回'}</button>{t.paused && <button className="secondary-button" onClick={onCommunity}>回社区照顾伙伴</button>}<button className="exp-link-button" onClick={onShop}>查看基地补给</button></div>
    {recall && <DialogShell role="alertdialog" className="exploration-confirm-sheet" labelId="expedition-recall-title" onClose={() => setRecall(false)}><header><h3 id="expedition-recall-title">提前召回伙伴</h3><button className="icon-button" aria-label="取消召回" onClick={() => setRecall(false)}><X /></button></header><div className="exploration-sheet-body"><p>保留已获得的物品、{t.coins} 金币与 {t.hearts} 心心。预计退还未使用的 {t.reservedHarvests ?? 0} 次采集机会，召回时按最新进度结算。</p><p>未完成本轮 {formatExpeditionInterval(intervalMs)} 的采集不发奖励。剩余料理由伙伴食用或分享，不退食物与补给费。</p></div><footer><button data-dialog-autofocus onClick={() => setRecall(false)}>继续挂机</button><button className="primary-button" disabled={busy} onClick={() => { move(p => returnExpedition(p, t.id)); setRecall(false); }}>确认召回</button></footer></DialogShell>}
  </aside></div>;
};
