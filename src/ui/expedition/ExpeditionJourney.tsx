import { useState } from 'react';
import { Backpack, Check, Clock, Tent, CornerDownLeft } from 'lucide-react';
import { chooseExpeditionStep, claimExpedition, continueExpedition, getBaseUpgrade, getExpeditionChoices, getExpeditionHarvestLeft, isExpeditionSupply, pauseExpedition, restExpedition, returnExpedition, selectExpeditionReturn, upgradeExpeditionBase, useExpeditionSupply } from '../../core/expedition';
import { expeditionBagCount, regions } from '../../core/expeditionData';
import { getInventoryItem } from '../../core/items';
import { getItemRecoveryPreview } from '../../core/itemEffects';
import { getRemainingRations, rationReturnLines } from '../../core/expeditionRationReturn';
import { getPetStatCap } from '../../core/petStats';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { getExpeditionCampStep, isValleyExpedition } from '../../core/valleyExpedition';
import { valleyPatrolNodes, valleyGatherNames } from '../../core/valleyExplorationData';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { getExpeditionEvent } from '../../core/explorationTravelData';
import { ExplorationSupport } from './ExplorationSupport';
import { useAdventureAction } from '../useAdventureAction';
import { getExpeditionChoicePreview } from '../../core/expedition';
import { ExplorationChoiceDetails, ExplorationChoiceHelp, ExplorationCheckSummary, ExplorationCheckBuffs } from '../ExplorationCheck';
import { HelpButton } from '../help/HelpButton';
import { backpackHelp, getJourneyHelp, getGatheringHelp, expeditionChoiceSummary, getExpeditionActionHelp } from '../help/explorationHelp';

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
    return <section className="exp-card exp-receipt"><span className="exp-eyebrow">{pending.route.map(id => regions[id].name).join(' → ')} · {pending.mode === 'idle' ? '挂机探索' : '手动巡路'}</span><h2>{pending.reason === 'health' ? '健康不足，已安全返程' : pending.reason === 'complete' ? '旅途完成，收好物资' : '已返回前哨基地'}</h2><p>地区故事和发现已经记下。{pending.tool ? '探路绳另行归还，不占物资容量。' : ''}</p>
      <ExplorationCheckSummary result={pending.lastCheck} />
      {pending.rationReturn && rationReturnLines(pending.rationReturn).length > 0 && <div className="outpost-ration-return" aria-label="返程料理结算">{rationReturnLines(pending.rationReturn).map(line => <p key={line}>{line}</p>)}</div>}
      {!pending.selected && <p className="exp-warning">物资超过行囊容量，请一次选定最多 {capacity} 份。确认后未选物资会留在原地。</p>}
      <div className="exp-stock-list">{Object.entries(pending.selected ? pending.items : all).map(([id, n]) => <label key={id}><span>{itemName(id)} ×{n}</span>{!pending.selected && <input type="number" aria-label={`带回${itemName(id)}`} min={0} max={n} value={selected[id] ?? 0} onChange={e => { const count = Math.max(0, Math.min(n, Math.floor(Number(e.target.value)) || 0)); const next = { ...selected }; if (count) next[id] = count; else delete next[id]; setSelection(next); }} />}</label>)}</div>
      <p>{pending.coins} 金币 · {pending.hearts} 心心{pending.refundCoins ? ` · 退回补给费 ${pending.refundCoins} 金币` : ''}{!pending.selected ? ` · 已选 ${expeditionBagCount(selected)}/${capacity} 份` : ''}</p>
      <button className="exp-primary" disabled={!pending.selected && expeditionBagCount(selected) > capacity} onClick={() => update(p => pending.selected ? claimExpedition(p, pending.id) : selectExpeditionReturn(p, pending.id, selected))}>{pending.selected ? '收好这一趟的物资' : '确认带回组合，留下未选物资'}</button><button className="exp-secondary" onClick={onCommunity}>回农场整理物资</button>
    </section>;
  }
  if (!t) return null;
  const region = t.route[t.leg], r = regions[region], progress = s.regions[region], choices = getExpeditionChoices(pet), upgrade = getBaseUpgrade(progress.base, region);
  const campStep = getExpeditionCampStep(t), valley = isValleyExpedition(t);
  const pathLabels = valley ? t.style === 'short' ? ['定向采集', '带着发现返回', '基地休整'] : [...valleyPatrolNodes.map(n => n[0]), '基地休整'] : [...Array.from({ length: campStep }, (_, step) => ({ travel: '沿路前进', gather: '采集与发现', crossing: '选择通路', story: '地区故事' })[getExpeditionEvent({ ...t, step })]), '基地休整'];
  const leftMinutes = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000));
  const continueBlocked = t.paused && (pet.isSleeping || Boolean(pet.partnerSchedule.active || pet.community.fishing.active || pet.pomodoro.isRunning || pet.miniGames.active && !pet.miniGames.active.paused) || pet.health < getPetStatCap(pet) * .4);
  return <section className="exp-card exp-journey" data-action-phase={action.phase}><div className="exp-card-heading"><span className="exp-icon">{r.glyph}</span><div><small>{t.mode === 'idle' ? '已勘测路线 · 挂机远行' : `第 ${t.leg + 1}/${t.route.length} 段 · ${t.paused ? '已在基地暂停' : '与你一起走'}`}</small><h2>{r.name} · {t.mode === 'idle' ? '伙伴正在路上' : t.step === campStep ? r.base : pathLabels[t.step]}</h2></div><span role="status">{busy ? '行动中…' : ''}</span></div>
    {t.mode === 'idle' ? <><div className="exp-timed"><Clock size={28} /><strong>还需 {Math.floor(leftMinutes / 60)} 小时 {leftMinutes % 60} 分</strong><span>已完成 {t.settledParts}/{t.parts} 次采集</span></div><progress aria-label="挂机远行进度" max={t.parts * 3600000} value={Math.max(0, Math.min(t.parts * 3600000, Date.now() - t.startedAt))} />
      <div className="help-heading"><span>目标：{valley ? valleyGatherNames[t.target ?? 'valley_mushroom'] : itemName(r.product)}</span><HelpButton {...getJourneyHelp(t)} /></div>
      <p>已得 {t.coins} 金币 · {t.hearts} 心心 · 预留机会 {t.reservedHarvests ?? 0} 次</p>
      <div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => <p key={id}>{itemName(id)} ×{n}</p>)}</div></> : <>
      <ol className="exp-path">{pathLabels.map((label, i) => <li key={i} aria-current={i === t.step ? 'step' : undefined} data-done={i < t.step}><span>{i < t.step ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
      <ExplorationSupport pet={pet} system="expedition" update={update} move={move} busy={busy} />
      <ExplorationCheckBuffs state={t.checkState} />
      <ExplorationCheckSummary result={t.checkState?.last} />
      <div className="help-heading"><span>采集机会 {getExpeditionHarvestLeft(pet, region)}/24</span><HelpButton {...getGatheringHelp(pet, t)} /></div>
      {t.step < campStep ? <div className="exp-choices">{choices.map(c => {
        const after = pet.health + c.health, force = after < getPetStatCap(pet) * .2;
        const preview = getExpeditionChoicePreview(pet, c);
        if (preview && c.check) return <div className="exploration-choice-card" key={c.id}><button className="exploration-choice-action" disabled={busy || Boolean(preview.reason)} onClick={() => move(p => chooseExpeditionStep(p, t.id, p.community.expedition.active!.revision, c.id))}><b>{c.title}<span>→</span></b><span>{c.description}</span><ExplorationChoiceDetails pet={pet} preview={preview} definition={c.check} hunger={c.hunger} research={Boolean(c.research)} harvest={c.harvest} mealItem={c.mealItem} /></button><ExplorationChoiceHelp title={c.title} preview={preview} definition={c.check} /></div>;
        return <div className="exploration-choice-card" key={c.id}><button className="exploration-choice-action" disabled={busy || pet.hunger < c.hunger || pet.energy < c.energy} onClick={() => move(p => chooseExpeditionStep(p, t.id, p.community.expedition.active!.revision, c.id))}><b>{c.title}<span>→</span></b><span>{expeditionChoiceSummary(c)}</span><small>饱食 −{c.hunger} · 体力 −{c.energy}{c.health ? ` · 健康 ${c.health}` : ''}{c.mood ? ` · 心情 ${c.mood > 0 ? '+' : ''}${c.mood}` : ''}</small>{(c.harvest || !valley && getExpeditionEvent(t) === 'gather' && Object.keys(c.finds).length > 0) && <small>采集机会 −{c.harvest ?? 1}</small>}{c.equipment && <small>{itemName(c.equipment)} · 耐久 −1</small>}{c.research && <small>调查进度 +{c.research.points}</small>}{Object.keys(c.finds).length > 0 && <em>{Object.entries(c.finds).map(([id, n]) => `${itemName(id)} ×${n}`).join(' · ')}</em>}{force && <strong className="exp-warning">完成这一步后健康不足，将安全返回</strong>}</button><HelpButton {...getExpeditionActionHelp(c)} /></div>;
      })}</div> : <div className="exp-camp"><Tent size={30} /><h3>{t.paused ? '行程已存下，慢慢来。' : '在屋檐下，为下一段留点力气。'}</h3><p>{r.storyText}</p>{progress.base === 0 ? <><p>{upgrade.name}：{upgrade.coins} 金币 · 木料 {upgrade.wood} · 石料 {upgrade.stone}</p><button className="exp-secondary" onClick={() => update(p => upgradeExpeditionBase(p, region, 0))}>投入材料，修好基地</button></> : <><button className="exp-secondary" disabled={busy || t.paused || t.rested.includes(region)} onClick={() => move(p => restExpedition(p, t.id, p.community.expedition.active!.revision))}>{t.rested.includes(region) ? '本趟已休整过' : '休整 · 最多补回本趟损失的体力 6、健康 3'}</button>{t.leg < t.route.length - 1 && <button className="exp-secondary" disabled={t.paused} onClick={() => update(p => pauseExpedition(p, t.id, t.revision))}>在基地暂停，下次继续</button>}</>}
        {t.leg < t.route.length - 1 ? <><button className="exp-primary" disabled={busy || Boolean(continueBlocked)} onClick={() => move(p => continueExpedition(p, t.id, p.community.expedition.active!.revision))}>继续前往{regions[t.route[t.leg + 1]].name}</button>{continueBlocked && <small>先结束其他活动，醒来并照顾好伙伴的健康。</small>}</> : <button className="exp-primary" disabled={busy} onClick={() => move(p => returnExpedition(p, t.id))}>完成这趟旅途，整理返程</button>}
      </div>}
      <details className="exp-bag" open><summary><Backpack size={16} />行囊 {expeditionBagCount(t.bag)}/{capacity} · {t.tool ? `探路绳 ${toolDurabilityLabel(pet, 'trail_rope', true)}` : '未带探路绳'}{expeditionBagCount(t.ground) ? ` · 待整理 ${expeditionBagCount(t.ground)} 份` : ''}</summary><div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => {
        const item = getInventoryItem(id as ItemId), preview = item ? getItemRecoveryPreview(pet, item, 1, []) : undefined;
        const usable = !t.paused && isExpeditionSupply(id) && Object.values(preview?.actual ?? {}).some(n => n > 0);
        return <div key={id}><span>{itemName(id)} ×{n}</span>{isExpeditionSupply(id) && <button disabled={!usable} onClick={() => update(p => useExpeditionSupply(p, t.id, t.revision, id))}>使用一份</button>}</div>;
      })}{!Object.keys(t.bag).length && <small>行囊空着</small>}</div><HelpButton {...backpackHelp} /></details>
    </>}
    {t.mode === 'idle' && t.rationPlan && <section className="exp-bag"><p>食物剩余 {expeditionBagCount(getRemainingRations(t, Date.now()))}/{expeditionBagCount(t.rationPlan.food)} 份 · 珍宝 {t.rationPlan.discoveries.filter(d => d.won).length} 件</p><small>提前返回不退食物和补给费。</small></section>}
    {t.mode === 'idle' && !t.rationPlan && t.rationSegments && <p>已寻找珍宝 {t.rationSegments.filter(segment => segment.settled).length}/{t.rationSegments.length} 次 · 找到 {t.rationSegments.filter(segment => segment.won).length} 件</p>}
    <div className="exp-journey-footer"><button disabled={busy} onClick={() => move(p => returnExpedition(p, t.id))}><CornerDownLeft size={16} />{t.mode === 'idle' ? '提前召回伙伴' : '结束行程，保留发现返回'}</button>{t.paused && <button onClick={onCommunity}>回社区照顾伙伴</button>}<button onClick={onShop}>查看商店</button></div>
  </section>;
};
