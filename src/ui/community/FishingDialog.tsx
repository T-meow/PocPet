import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Crown, Fish, Settings2, Utensils, X, Zap } from 'lucide-react';
import { DialogShell } from '../DialogShell';
import { HelpButton } from '../help/HelpButton';
import { getFishingHelp } from '../help/fishingHelp';
import { FishingSceneArt, type FishingScenePhase } from './FishingSceneArt';
import type { CommunityPanelProps } from './types';
import type { ItemId } from '../../core/petTypes';
import type { FishId, WaterId } from '../../core/communityTypes';
import { fish, fishIds, isWaterOpen, waterIds, waters } from '../../core/communityData';
import { actCommunityFishing, cancelCommunityFishing, claimCommunityFish, getFishingWaitMs, getManualFishingReason, quoteIdleFishing, startCommunityFishing, startIdleFishing } from '../../core/communityFishing';
import { getFishingLevelEffects } from '../../core/communityUpgradeData';
import { getFishCrownThreshold, getFishingClicks } from '../../core/fishingRules';
import { getInventoryItem } from '../../core/items';
import { isTravelFood, standardRationPrice, type RationSelection } from '../../core/explorationRations';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { canSpendCompanionTime } from '../../core/kitchen';
import { communityItemIcons } from '../../communityAssets';
import { rationReturnLines } from '../../core/expeditionRationReturn';
import { inventoryItemLimit } from '../../core/saveMetadata';
import '../../styles/fishing.css';

export const FishingDialog = ({ pet, update, portrait, actorId, actorName, onClose, onShop, onManage, initialWater = 'pond', itemIconMap }: CommunityPanelProps & {
  portrait: string; actorId: string; actorName: string; onClose: () => void; onManage: () => void; initialWater?: WaterId;
}) => {
  const [water, setWater] = useState(initialWater), [bait, setBait] = useState<'fishing_bait' | 'river_bait'>('fishing_bait');
  const [strong, setStrong] = useState(pet.community.fishing.active?.strongRod ?? !(pet.inventory.fishing_rod ?? 0));
  const [float, setFloat] = useState(false), [net, setNet] = useState(false);
  const [mode, setMode] = useState<'manual' | 'idle'>('manual'), [hours, setHours] = useState(2);
  const [view, setView] = useState<'scene' | 'gear' | 'food'>('scene');
  const [rations, setRations] = useState<RationSelection>({ food: {}, autoFill: true });
  const [, tick] = useState(0), { active, pending } = pet.community.fishing;
  useEffect(() => { if (!active || pet.timePause) return; const timer = setInterval(() => tick(n => n + 1), 250); return () => clearInterval(timer); }, [active?.id, pet.timePause]);
  const now = pet.timePause ? pet.lastUpdatedAt : Date.now(), manual = active?.mode === 'manual' ? active : undefined, idle = active?.mode === 'idle' ? active : undefined;
  const selectedWater = active?.water ?? pending?.water ?? water, biting = Boolean(manual && now >= manual.biteAt);
  const gear = { float, net }, effects = getFishingLevelEffects(pet.community.upgrades.fishing_hut);
  const quote = quoteIdleFishing(pet, water, bait, strong, hours, rations);
  const reason = mode === 'manual' ? getManualFishingReason(pet, water, bait, strong, gear) : quote.reason;
  const frozen = Boolean(pet.timePause), preparing = !active && !pending;
  const settingsOpen = preparing && view !== 'scene';
  const selectedRod = (active?.strongRod ?? strong) ? 'reinforced_rod' : 'fishing_rod';
  const phase: FishingScenePhase = pending ? 'caught' : idle ? 'idle' : manual ? biting ? manual.clicks ? 'reeling' : 'biting' : 'waiting' : 'ready';
  const icon = (id: string) => itemIconMap?.[id] ?? communityItemIcons[id as keyof typeof communityItemIcons];
  const foodIds = Object.keys(pet.inventory).filter(id => pet.inventory[id] > 0 && isTravelFood(id)).sort((a, b) => (getInventoryItem(a as ItemId)?.name ?? a).localeCompare(getInventoryItem(b as ItemId)?.name ?? b, 'zh-CN'));
  const changeFood = (id: string, delta: number) => setRations(current => {
    const food = { ...current.food }, count = (food[id] ?? 0) + delta;
    if (count < 0 || count > (pet.inventory[id] ?? 0) || delta > 0 && Object.values(food).reduce((n, value) => n + value, 0) >= quote.food.maximum) return current;
    if (count) food[id] = count; else delete food[id];
    return { ...current, food };
  });
  const catches = pending ? fishIds.filter(id => pending.catches.some(c => c.fish === id)).map(id => {
    const all = pending.catches.filter(c => c.fish === id);
    return { fish: id, count: pending.items[id] ?? 0, size: Math.max(...all.map(c => c.size)), crown: all.some(c => c.newCrown), record: all.some(c => c.newRecord) };
  }) : [];
  const start = () => update(p => mode === 'manual' ? startCommunityFishing(p, water, bait, strong, Date.now(), gear) : startIdleFishing(p, water, bait, strong, hours, actorId, actorName, rations));
  const action = pending ? () => update(p => claimCommunityFish(p, pending.id)) : idle ? () => update(p => cancelCommunityFishing(p, idle.id)) : manual ? () => update(p => actCommunityFishing(p, manual.id, manual.revision, 'reel')) : start;
  const button = pending ? '收下鱼获' : idle ? '提前返回' : manual ? biting ? `收线 · 还需 ${manual.requiredClicks - manual.clicks} 次` : '等鱼上钩' : mode === 'idle' ? '去钓鱼' : '抛竿';
  const disabled = frozen || (pending ? !canSpendCompanionTime(pet) : idle ? false : manual ? !biting : Boolean(reason));
  const minutes = idle ? Math.max(0, Math.ceil((idle.endsAt - now) / 60000)) : 0;
  const status = pending ? pending.reason === 'health' ? '伙伴已安全返回，先照顾一下再出发吧' : pending.catches.length ? '今天的收获，已经写进鱼类手账' : '这一趟还没钓到鱼，补给已整理好' : idle ? `剩余 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分 · 已钓 ${idle.settledCasts}/${idle.plannedCasts} 条` : manual ? biting ? '鱼儿上钩了，轻点收线就好' : '听听水声，等鱼儿靠近' : reason || (mode === 'manual' ? `鱼饵 1 · 钓具耐久各 1 · 饱食 ${effects.hunger} · 体力 ${effects.energy}` : `预计 ${quote.plannedCasts} 条 · 鱼饵 ${quote.plannedCasts} · 耐久 ${quote.plannedCasts}`);
  return <DialogShell className="fishing-dialog" backdropClassName="fishing-modal-backdrop" labelId="fishing-dialog-title" onClose={onClose}>
    <header className="fishing-dialog-header"><h2 id="fishing-dialog-title">{waters[selectedWater].name}</h2><HelpButton {...getFishingHelp(preparing && mode === 'idle' ? quote.food : undefined)} /><button type="button" className="fishing-close" aria-label="关闭钓鱼窗口，保留当前进度" onClick={onClose}><X size={22} /></button></header>
    {settingsOpen ? <div key={view} className="fishing-settings">
      <button className="fishing-back" onClick={() => setView('scene')}><ArrowLeft size={18} />回到水边</button>
      {view === 'gear' ? <>
        <h3>今天去哪里</h3><div className="fishing-choice-grid">{waterIds.map(id => <button key={id} disabled={!isWaterOpen(pet, id)} aria-pressed={water === id} onClick={() => setWater(id)}><Fish size={21} /><strong>{waters[id].name}</strong><small>{isWaterOpen(pet, id) ? `${fishIds.filter(f => fish[f].water === id).length} 种鱼` : '待开放'}</small></button>)}</div>
        <h3>鱼饵与钓竿</h3><div className="fishing-choice-grid">{(['fishing_bait', 'river_bait'] as const).map(id => <button key={id} disabled={id === 'river_bait' && !pet.community.facilities.upstream.built} aria-pressed={bait === id} onClick={() => setBait(id)}><img src={icon(id)} alt="" /><strong>{getInventoryItem(id)?.name}</strong><small>持有 {pet.inventory[id] ?? 0}</small></button>)}{(['fishing_rod', 'reinforced_rod'] as const).map(id => <button key={id} aria-pressed={strong === (id === 'reinforced_rod')} onClick={() => setStrong(id === 'reinforced_rod')}><img src={icon(id)} alt="" /><strong>{getInventoryItem(id)?.name}</strong><small>{toolDurabilityLabel(pet, id)}</small></button>)}</div>
        {mode === 'manual' && <><h3>可选附件</h3><div className="fishing-choice-grid"><button aria-pressed={float} onClick={() => setFloat(!float)}><img src={icon('fishing_float')} alt="" /><strong>醒目浮漂</strong><small>等待缩短 2 秒 · {toolDurabilityLabel(pet, 'fishing_float')}</small></button><button aria-pressed={net} onClick={() => setNet(!net)}><img src={icon('landing_net')} alt="" /><strong>轻便抄网</strong><small>收线少点一次 · {toolDurabilityLabel(pet, 'landing_net')}</small></button></div><p className="fishing-note">当前等待约 {getFishingWaitMs(pet, float) / 1000} 秒，收线 {getFishingClicks(strong, net)} 次。</p></>}
        <div className="fishing-settings-links"><button onClick={onShop}>补充钓具和鱼饵</button><button onClick={onManage}>小屋建设与水域开放</button></div>
      </> : <>
        <h3>带一点好吃的</h3><p className="fishing-note">{hours} 小时 · {quote.food.reason || '食物已备齐'} · {quote.food.count}/{quote.food.maximum} 份</p>
        <label className="fishing-autofill"><input type="checkbox" checked={rations.autoFill} onChange={e => setRations({ ...rations, autoFill: e.target.checked })} /><span>自动补给 · {standardRationPrice} 金币／份</span></label><p className="fishing-note">自动补足 {quote.food.purchased} 份，共 {quote.food.coins} 金币。</p>
        <div className="fishing-food-list">{foodIds.map(id => <div key={id}>{icon(id) && <img src={icon(id)} alt="" />}<span><strong>{getInventoryItem(id as ItemId)?.name}</strong><small>饱食 {getInventoryItem(id as ItemId)?.effect.hunger} · 持有 {pet.inventory[id]}</small></span><button aria-label={`少带一份${getInventoryItem(id as ItemId)?.name}`} disabled={!rations.food[id]} onClick={() => changeFood(id, -1)}>−</button><output>{rations.food[id] ?? 0}</output><button aria-label={`多带一份${getInventoryItem(id as ItemId)?.name}`} disabled={(rations.food[id] ?? 0) >= pet.inventory[id] || Object.values(rations.food).reduce((n, v) => n + v, 0) >= quote.food.maximum} onClick={() => changeFood(id, 1)}>＋</button></div>)}</div>
        {!foodIds.length && <p className="fishing-note">仓库还没有适用食物，可以自动补给或去商店补充。</p>}
        <p className="fishing-note">提前返回不退食物和补给费。</p>
        <button className="fishing-text-button" onClick={onShop}>去商店补充食物</button>
      </>}
    </div> : <div key="scene" className="fishing-play">
      {preparing && <div className="fishing-toolbar"><div className="fishing-mode" role="group" aria-label="钓鱼方式"><button aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>手动</button><button aria-pressed={mode === 'idle'} onClick={() => setMode('idle')}>挂机</button></div><button className="fishing-text-button" onClick={() => setView('gear')}><Settings2 size={16} />换水域／钓具</button></div>}
      <div className="fishing-picture"><FishingSceneArt water={selectedWater} portrait={portrait} name={actorName} phase={phase} rodIcon={icon(selectedRod)} reelTick={manual?.clicks} />{pending?.mode === 'manual' && catches[0] && <div className="fishing-catch-hero"><img src={icon(catches[0].fish)} alt={fish[catches[0].fish].name} />{catches[0].crown && <span><Crown size={16} />首次金冠</span>}</div>}</div>
      {pending && <div className="fishing-catch-list">{catches.map(c => <div key={c.fish}>{pending.mode === 'idle' && <img src={icon(c.fish)} alt="" />}<span><strong>{fish[c.fish].name}{pending.mode === 'idle' && ` ×${c.count}`}</strong><small>{c.size} 厘米{!c.count ? ' · 已收好' : ''}</small></span>{c.crown ? <b className="fishing-gold"><Crown size={16} />新金冠</b> : c.record ? <b className="fishing-record">新纪录</b> : c.size > getFishCrownThreshold(c.fish as FishId) ? <Crown className="fishing-gold" size={19} aria-label="金冠尺寸" /> : null}</div>)}{(['fishing_bait', 'river_bait'] as const).map(id => pending.items[id] ? <p key={id} className="fishing-note">退回{getInventoryItem(id)?.name} ×{pending.items[id]}</p> : null)}{pending.rationReturn && <details className="fishing-note"><summary>剩余食物的去向</summary>{rationReturnLines(pending.rationReturn).map(line => <p key={line}>{line}</p>)}</details>}</div>}
      {preparing && mode === 'idle' && <div className="fishing-idle-setup"><div className="fishing-durations" role="group" aria-label="挂机时长">{[2, 4, 8].map(n => <button aria-pressed={hours === n} key={n} onClick={() => setHours(n)}>{n} 小时</button>)}</div><button className="fishing-food-summary" onClick={() => setView('food')}><Utensils size={18} /><span><strong>准备食物 · {quote.food.count} 份</strong><small>自动补给 {quote.food.coins} 金币</small></span><ChevronRight size={16} /></button><label className="fishing-autofill"><input type="checkbox" checked={rations.autoFill} onChange={e => setRations({ ...rations, autoFill: e.target.checked })} /><span>自动补足食物 · {standardRationPrice} 金币／份</span></label></div>}
    </div>}
    <footer className="fishing-action">
      {settingsOpen ? <button className="fishing-primary" onClick={() => setView('scene')}>准备好了</button> : <>
        <div className="fishing-action-status"><p role="status">{frozen ? '时间已冻结，恢复后继续' : preparing && mode === 'manual' && !reason ? <span className="fishing-cost">
          <span title="每竿消耗鱼饵"><img src={icon(bait)} alt="鱼饵" />1</span>
          <span title="所选钓具各消耗 1 次耐久"><img src={icon(strong ? 'reinforced_rod' : 'fishing_rod')} alt="钓具耐久" />各 1</span>
          <span title="饱食消耗"><Utensils size={15} aria-label="饱食" />{effects.hunger}</span>
          <span title="体力消耗"><Zap size={15} aria-label="体力" />{effects.energy}</span>
        </span> : status}</p>{preparing && reason && /鱼饵|钓竿|钓具|金币|食物|附件|耐久/.test(reason) && <button className="fishing-text-button" onClick={onShop}>补充物资<ChevronRight size={14} /></button>}</div>
        <button className="fishing-primary" disabled={disabled} onClick={action}>{button}</button>
        {manual && <button className="fishing-text-button fishing-cancel" disabled={frozen} onClick={() => update(p => cancelCommunityFishing(p, manual.id))}>收竿 · 已用鱼饵和耐久不返还</button>}
        {pending && Object.entries(pending.items).some(([id, n]) => n && (pet.inventory[id] ?? 0) >= inventoryItemLimit) && <small>仓库已满的物品会留在收获篮。</small>}
      </>}
    </footer>
  </DialogShell>;
};
