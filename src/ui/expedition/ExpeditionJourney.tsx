import { useState } from 'react';
import { Backpack, Check, Clock, Tent, CornerDownLeft } from 'lucide-react';
import { chooseExpeditionStep, claimExpedition, continueExpedition, getBaseUpgrade, getExpeditionChoices, isExpeditionSupply, pauseExpedition, restExpedition, returnExpedition, selectExpeditionReturn, upgradeExpeditionBase, useExpeditionSupply } from '../../core/expedition';
import { expeditionBagCount, expeditionCapacity, regions } from '../../core/expeditionData';
import { getInventoryItem } from '../../core/items';
import { getItemRecoveryPreview } from '../../core/itemEffects';
import { getPetStatCap } from '../../core/petStats';
import type { Inventory, ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';

const itemName = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
export const ExpeditionJourney = ({ pet, update, onCommunity, onShop }: ExpeditionProps) => {
  const s = pet.community.expedition, t = s.active, pending = s.pending;
  const [selection, setSelection] = useState<Inventory | undefined>();
  if (pending) {
    const selected = selection ?? pending.items, all = { ...pending.items };
    for (const [id, n] of Object.entries(pending.overflow)) all[id] = (all[id] ?? 0) + n;
    return <section className="exp-card exp-receipt"><span className="exp-eyebrow">这一趟，平安回来了</span><h2>{pending.reason === 'health' ? '先照顾好伙伴，再收好见闻。' : '把远方，带回日常。'}</h2><p>地区故事和发现已经永久记下。{pending.tool ? '探路绳另行归还，不占物资容量。' : ''}</p>
      {!pending.selected && <p className="exp-warning">物资超过行囊容量，请一次选定最多 12 份。确认后未选物资会留在原地。</p>}
      <div className="exp-stock-list">{Object.entries(pending.selected ? pending.items : all).map(([id, n]) => <label key={id}><span>{itemName(id)} ×{n}</span>{!pending.selected && <input type="number" aria-label={`带回${itemName(id)}`} min={0} max={n} value={selected[id] ?? 0} onChange={e => { const count = Math.max(0, Math.min(n, Math.floor(Number(e.target.value)) || 0)); const next = { ...selected }; if (count) next[id] = count; else delete next[id]; setSelection(next); }} />}</label>)}</div>
      <p>{pending.coins} 金币 · {pending.hearts} 心心{!pending.selected ? ` · 已选 ${expeditionBagCount(selected)}/12 份` : ''}</p>
      <button className="exp-primary" disabled={!pending.selected && expeditionBagCount(selected) > expeditionCapacity} onClick={() => update(p => pending.selected ? claimExpedition(p, pending.id) : selectExpeditionReturn(p, pending.id, selected))}>{pending.selected ? '收好这一趟的物资' : '确认带回组合，留下未选物资'}</button><button className="exp-secondary" onClick={onCommunity}>回社区整理仓库</button>
    </section>;
  }
  if (!t) return null;
  const region = t.route[t.leg], r = regions[region], progress = s.regions[region], choices = getExpeditionChoices(pet), upgrade = getBaseUpgrade(progress.base);
  const leftMinutes = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 60000));
  const continueBlocked = t.paused && (pet.isSleeping || Boolean(pet.partnerSchedule.active || pet.community.fishing.active || pet.pomodoro.isRunning || pet.miniGames.active && !pet.miniGames.active.paused) || pet.health < getPetStatCap(pet) * .4);
  return <section className="exp-card exp-journey"><div className="exp-card-heading"><span className="exp-icon">{r.glyph}</span><div><small>{t.mode === 'idle' ? '已勘测路线 · 挂机远行' : `第 ${t.leg + 1}/${t.route.length} 段 · ${t.paused ? '已在基地暂停' : '与你一起走'}`}</small><h2>{r.name} · {t.mode === 'idle' ? '伙伴正在路上' : t.step === 3 ? r.base : [r.gather, r.crossing, r.story][t.step]}</h2></div></div>
    {t.mode === 'idle' ? <><div className="exp-timed"><Clock size={28} /><strong>还需 {Math.floor(leftMinutes / 60)} 小时 {leftMinutes % 60} 分</strong><span>已完成 {t.settledParts}/{t.parts} 次采集</span></div><progress aria-label="挂机远行进度" max={t.parts * 3600000} value={Math.max(0, Math.min(t.parts * 3600000, Date.now() - t.startedAt))} /><p>每满一小时带回一份当地常见产物。可以提前召回，未满一小时的部分没有收获；口粮、体力与今日额度不返还。健康低于 20% 会自动返回。</p></> : <>
      <ol className="exp-path">{['采集与发现', '选择通路', '地区故事', '基地休整'].map((label, i) => <li key={label} aria-current={i === t.step ? 'step' : undefined} data-done={i < t.step}><span>{i < t.step ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
      {t.step < 3 ? <div className="exp-choices">{choices.map(c => {
        const after = pet.health + c.health, force = after < getPetStatCap(pet) * .2;
        return <button key={c.id} disabled={pet.hunger < c.hunger || pet.energy < c.energy} onClick={() => update(p => chooseExpeditionStep(p, t.id, t.revision, c.id))}><b>{c.title}<span>→</span></b><span>{c.description}</span><small>饱食 −{c.hunger} · 体力 −{c.energy}{c.health ? ` · 健康 ${c.health}` : ' · 健康无损'}{c.mood ? ` · 心情 ${c.mood > 0 ? '+' : ''}${c.mood}` : ''}</small>{Object.keys(c.finds).length > 0 && <em>{Object.entries(c.finds).map(([id, n]) => `${itemName(id)} ×${n}`).join(' · ')}</em>}{force && <strong className="exp-warning">完成这一步后健康低于 20%，将自动返回</strong>}</button>;
      })}</div> : <div className="exp-camp"><Tent size={30} /><h3>{t.paused ? '行程已存下，慢慢来。' : '在屋檐下，为下一段留点力气。'}</h3><p>{r.storyText}</p>{progress.base === 0 ? <><p>{upgrade.name}：{upgrade.coins} 金币 · 木料 {upgrade.wood} · 石料 {upgrade.stone}</p><button className="exp-secondary" onClick={() => update(p => upgradeExpeditionBase(p, region, 0))}>投入材料，修好基地</button></> : <><button className="exp-secondary" disabled={t.paused || t.rested.includes(region)} onClick={() => update(p => restExpedition(p, t.id, t.revision))}>{t.rested.includes(region) ? '本趟已休整过' : '休整 · 体力 +12 / 健康 +6 / 心情 +8'}</button>{t.leg < t.route.length - 1 && <button className="exp-secondary" disabled={t.paused} onClick={() => update(p => pauseExpedition(p, t.id, t.revision))}>在基地暂停，下次继续</button>}</>}
        {t.leg < t.route.length - 1 ? <><button className="exp-primary" disabled={Boolean(continueBlocked)} onClick={() => update(p => continueExpedition(p, t.id, t.revision))}>继续前往{regions[t.route[t.leg + 1]].name}</button>{continueBlocked && <small>先结束其他活动，醒来并恢复到 40% 健康。</small>}</> : <button className="exp-primary" onClick={() => update(p => returnExpedition(p, t.id))}>完成这趟旅途，整理返程</button>}
      </div>}
      <details className="exp-bag" open><summary><Backpack size={16} />行囊 {expeditionBagCount(t.bag)}/12 · {t.tool ? '已带探路绳' : '未带工具'}{expeditionBagCount(t.ground) ? ` · 待整理 ${expeditionBagCount(t.ground)} 份` : ''}</summary><div className="exp-stock-list">{Object.entries(t.bag).map(([id, n]) => {
        const item = getInventoryItem(id as ItemId), preview = item ? getItemRecoveryPreview(pet, item, 1, []) : undefined;
        const usable = !t.paused && isExpeditionSupply(id) && Object.values(preview?.actual ?? {}).some(n => n > 0);
        return <div key={id}><span>{itemName(id)} ×{n}</span>{isExpeditionSupply(id) && <button disabled={!usable} onClick={() => update(p => useExpeditionSupply(p, t.id, t.revision, id))}>使用一份</button>}</div>;
      })}{!Object.keys(t.bag).length && <small>行囊空着，发现的物资可以直接放进来。</small>}</div><small>护理不受吃撑影响。多出的发现留到返程统一整理，带回总量仍为 12 份。</small></details>
    </>}
    <div className="exp-journey-footer"><button onClick={() => update(p => returnExpedition(p, t.id))}><CornerDownLeft size={16} />{t.mode === 'idle' ? '提前召回伙伴' : '结束行程，保留发现返回'}</button>{t.paused && <button onClick={onCommunity}>回社区照顾伙伴</button>}<button onClick={onShop}>查看商店</button></div>
  </section>;
};
