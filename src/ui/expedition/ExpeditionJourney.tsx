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
import { wildIngredientIds, wildIngredients } from '../../core/foodCatalog';
import { regionalTreasureIds, regionalTreasures } from '../../core/regionalTreasures';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { getExpeditionCampStep, isValleyExpedition } from '../../core/valleyExpedition';
import { valleyPatrolNodes, valleyGatherNames } from '../../core/valleyExplorationData';
import { getExplorationBagCapacity } from '../../core/explorationBackpack';
import { getExpeditionEvent } from '../../core/explorationTravelData';
import { ExplorationSupport } from './ExplorationSupport';
import { useAdventureAction } from '../useAdventureAction';
import { getExpeditionChoicePreview } from '../../core/expedition';
import { ExplorationChoiceDetails, ExplorationCheckSummary, ExplorationCheckBuffs } from '../ExplorationCheck';

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
      <p>目标：{valley ? valleyGatherNames[t.target ?? 'valley_mushroom'] : itemName(r.product)}。已得 {t.coins} 金币、{t.hearts} 小心心；采集机会仍预留 {t.reservedHarvests ?? 0} 次。每满一小时结算，饱食和体力按实际时长消耗，全部材料运回。</p>
      <p>{t.rationPlan ? '提前召回时退回未使用的采集机会，剩余料理按吃撑规则提前吃掉，吃饱后分给路过的邻居。料理和补给费不返还。' : t.rulesVersion >= 2 ? '这趟行程沿用原配餐规则，召回时退回未用机会及未开始时段的配餐与补给费。' : '这趟旧行程仍按出发时的规则结算。'}</p>
      <div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => <p key={id}>{itemName(id)} ×{n}</p>)}</div></> : <>
      <ol className="exp-path">{pathLabels.map((label, i) => <li key={i} aria-current={i === t.step ? 'step' : undefined} data-done={i < t.step}><span>{i < t.step ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
      <ExplorationSupport pet={pet} system="expedition" update={update} move={move} busy={busy} />
      <ExplorationCheckBuffs state={t.checkState} />
      <ExplorationCheckSummary result={t.checkState?.last} />
      <details className="exp-bag"><summary>本地食材与调查 · 采集机会 {getExpeditionHarvestLeft(pet, region)}/24</summary><p>{valley ? `本趟目标：${valleyGatherNames[t.target ?? 'valley_mushroom']}。完整巡路最多使用 2 次机会；短途普通采集 1 次，手镐勘探可用 2 次。` : '所有地区共用采集机会，每 3 小时恢复 1 次，最多存 24 次。调查进度跨日保留。'}</p>{!valley && wildIngredientIds.filter(id => wildIngredients[id].region === region).map(id => { const d = wildIngredients[id], count = pet.community.forageResearch[id] ?? 0; return <p key={id}><b>{d.name}</b> · {d.investigations > 1 ? `调查 ${count % d.investigations}/${d.investigations}` : `每次获得 ${d.yield} 份`}</p>; })}</details>
      <details className="exp-bag"><summary>本地珍宝 · 勘探进度与随身工具</summary><p>{valley ? t.rulesVersion >= 4 ? '海蓝宝勘探推荐学习 3 级。徒手消耗 1 次机会、标准进度 1 点；手镐消耗 2 次机会、标准进度 2 点，耐久 −1。表现会改变进度与野菇数量；累计 6 点获得海蓝宝 ×1。' : '徒手使用 1 次采集机会推进 1 点；手镐使用 2 次机会推进 2 点、耐久 −1。每点另得野菇 ×1，累计 6 点获得海蓝宝 ×1。' : '珍宝与食材共用采集机会，消耗与发现会在选项中显示。'}进度跨天保留。</p>{regionalTreasureIds.filter(id => regionalTreasures[id].region === region).map(id => { const d = regionalTreasures[id]; return <p key={id}><b>{d.glyph} {d.name}</b> · 进度 {(pet.community.treasureResearch[id] ?? 0) % d.investigations}/{d.investigations} · 回收 {d.base} 金币 · {d.use}</p>; })}<p>手镐：{toolDurabilityLabel(pet, 'prospector_pick')} · 放大镜：{toolDurabilityLabel(pet, 'survey_lens')} · 营具：{toolDurabilityLabel(pet, 'camp_kit')}</p><small>选择对应操作才扣耐久。</small></details>
      {t.step < campStep ? <div className="exp-choices">{choices.map(c => {
        const after = pet.health + c.health, force = after < getPetStatCap(pet) * .2;
        const preview = getExpeditionChoicePreview(pet, c);
        if (preview && c.check) return <button key={c.id} disabled={busy || Boolean(preview.reason)} onClick={() => move(p => chooseExpeditionStep(p, t.id, p.community.expedition.active!.revision, c.id))}><b>{c.title}<span>→</span></b><span>{c.description}</span><ExplorationChoiceDetails pet={pet} preview={preview} definition={c.check} hunger={c.hunger} research={Boolean(c.research)} /></button>;
        return <button key={c.id} disabled={busy || pet.hunger < c.hunger || pet.energy < c.energy} onClick={() => move(p => chooseExpeditionStep(p, t.id, p.community.expedition.active!.revision, c.id))}><b>{c.title}<span>→</span></b><span>{c.description}</span><small>饱食 −{c.hunger} · 体力 −{c.energy}{c.health ? ` · 健康 ${c.health}` : ' · 健康无损'}{c.mood ? ` · 心情 ${c.mood > 0 ? '+' : ''}${c.mood}` : ''}</small>{Object.keys(c.finds).length > 0 && <em>{Object.entries(c.finds).map(([id, n]) => `${itemName(id)} ×${n}`).join(' · ')}</em>}{force && <strong className="exp-warning">完成这一步后健康不足，将安全返回</strong>}</button>;
      })}</div> : <div className="exp-camp"><Tent size={30} /><h3>{t.paused ? '行程已存下，慢慢来。' : '在屋檐下，为下一段留点力气。'}</h3><p>{r.storyText}</p>{progress.base === 0 ? <><p>{upgrade.name}：{upgrade.coins} 金币 · 木料 {upgrade.wood} · 石料 {upgrade.stone}</p><button className="exp-secondary" onClick={() => update(p => upgradeExpeditionBase(p, region, 0))}>投入材料，修好基地</button></> : <><button className="exp-secondary" disabled={busy || t.paused || t.rested.includes(region)} onClick={() => move(p => restExpedition(p, t.id, p.community.expedition.active!.revision))}>{t.rested.includes(region) ? '本趟已休整过' : '休整 · 最多补回本趟损失的体力 6、健康 3'}</button>{t.leg < t.route.length - 1 && <button className="exp-secondary" disabled={t.paused} onClick={() => update(p => pauseExpedition(p, t.id, t.revision))}>在基地暂停，下次继续</button>}</>}
        {t.leg < t.route.length - 1 ? <><button className="exp-primary" disabled={busy || Boolean(continueBlocked)} onClick={() => move(p => continueExpedition(p, t.id, p.community.expedition.active!.revision))}>继续前往{regions[t.route[t.leg + 1]].name}</button>{continueBlocked && <small>先结束其他活动，醒来并照顾好伙伴的健康。</small>}</> : <button className="exp-primary" disabled={busy} onClick={() => move(p => returnExpedition(p, t.id))}>完成这趟旅途，整理返程</button>}
      </div>}
      <details className="exp-bag" open><summary><Backpack size={16} />行囊 {expeditionBagCount(t.bag)}/{capacity} · {t.tool ? `探路绳 ${toolDurabilityLabel(pet, 'trail_rope', true)}` : '未带探路绳'}{expeditionBagCount(t.ground) ? ` · 待整理 ${expeditionBagCount(t.ground)} 份` : ''}</summary><div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => {
        const item = getInventoryItem(id as ItemId), preview = item ? getItemRecoveryPreview(pet, item, 1, []) : undefined;
        const usable = !t.paused && isExpeditionSupply(id) && Object.values(preview?.actual ?? {}).some(n => n > 0);
        return <div key={id}><span>{itemName(id)} ×{n}</span>{isExpeditionSupply(id) && <button disabled={!usable} onClick={() => update(p => useExpeditionSupply(p, t.id, t.revision, id))}>使用一份</button>}</div>;
      })}{!Object.keys(t.bag).length && <small>行囊空着，发现的物资可以直接放进来。</small>}</div><small>护理不受吃撑影响。多出的发现留到返程统一整理，带回总量为 {capacity} 份。</small></details>
    </>}
    {t.mode === 'idle' && t.rationPlan && <details className="exp-bag"><summary>全程补给与珍宝发现</summary><p>出发携带 {expeditionBagCount(t.rationPlan.food)} 份，剩余 {expeditionBagCount(getRemainingRations(t, Date.now()))} 份。自动补给 {t.rationPlan.purchased} 份，共 {t.rationPlan.coins} 金币。</p><p>珍宝概率 {t.rationPlan.chance.toFixed(1)}%{t.rationPlan.version === 2 && `（配餐 ${t.rationPlan.baseChance?.toFixed(1)}%＋装饰 ${t.rationPlan.decorationBonus} 个百分点）`} · 已寻找 {t.rationPlan.discoveries.filter(d => d.settled).length}/{t.rationPlan.discoveries.length} 次 · 找到 {t.rationPlan.discoveries.filter(d => d.won).length} 件</p></details>}
    {t.mode === 'idle' && !t.rationPlan && t.rationSegments && <details className="exp-bag"><summary>查看原行程餐包与珍宝发现</summary>{t.rationSegments.map((segment, i) => <p key={i}>第 {i + 1} 段 · {segment.settled ? segment.won ? '已完成，找到珍宝 ×1' : '已完成，本段未找到珍宝' : segment.started ? '正在使用' : '尚未开始，可退款'} · 珍宝概率 {segment.chance.toFixed(1)}% · 配餐 {segment.count} 份 · 购买费 {segment.price} 金币</p>)}</details>}
    <div className="exp-journey-footer"><button disabled={busy} onClick={() => move(p => returnExpedition(p, t.id))}><CornerDownLeft size={16} />{t.mode === 'idle' ? '提前召回伙伴' : '结束行程，保留发现返回'}</button>{t.paused && <button onClick={onCommunity}>回社区照顾伙伴</button>}<button onClick={onShop}>查看商店</button></div>
  </section>;
};
