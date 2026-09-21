import { useEffect, useState } from 'react';
import { fish, fishIds, waterIds, waters, isWaterOpen } from '../../core/communityData';
import { actCommunityFishing, cancelCommunityFishing, claimCommunityFish, startCommunityFishing, buildWaterBoardwalk, getFishingWaitMs } from '../../core/communityFishing';
import { rarityNames } from '../../core/foodCatalog';
import type { WaterId } from '../../core/communityTypes';
import { canSpendCompanionTime } from '../../core/kitchen';
import { communityItemIcons } from '../../communityAssets';
import type { CommunityPanelProps } from './types';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { getFishingLevelEffects } from '../../core/communityUpgradeData';
import { getFishingClicks } from '../../core/fishingRules';
import { getInventoryItem } from '../../core/items';
import type { ItemId } from '../../core/petTypes';
import { CommunityUpgradeDialog } from './CommunityUpgradeTask';

export const CommunityFishing = ({ pet, update, onShop, onKitchen, onAdventure, registry, itemIconMap, initialWater = 'pond', view = 'all' }: CommunityPanelProps & { initialWater?: WaterId; view?: 'all' | 'controls' | 'journal' | 'recipes' }) => {
  const [water, setWater] = useState<WaterId>(initialWater), [bait, setBait] = useState<'fishing_bait' | 'river_bait'>('fishing_bait'), [strong, setStrong] = useState(false);
  const [useNet, setUseNet] = useState(false), [constructionOpen, setConstructionOpen] = useState(false);
  const [, tick] = useState(0), f = pet.community.fishing, active = f.active, pending = f.pending, c = pet.community;
  const session = active?.mode === 'manual' ? active : undefined;
  useEffect(() => { if (!active) return; const timer = setInterval(() => tick(n => n + 1), 250); return () => clearInterval(timer); }, [active?.id]);
  const now = Date.now(), biting = Boolean(session && now >= session.biteAt), free = canSpendCompanionTime(pet) && !pet.timePause;
  const level = c.upgrades.fishing_hut, effects = getFishingLevelEffects(level);
  const act = (action: 'hook' | 'reel') => session && update(p => actCommunityFishing(p, session.id, session.revision, action));
  return <>
    {(view === 'all' || view === 'controls') && <section className="community-card"><div className="community-section-heading"><h3>{waters[active?.water ?? water].name}</h3><span className="community-tag">小屋直通 · 手动垂钓</span></div>
      {!c.facilities.fishing_hut.built ? <p>先修好钓鱼小屋，建成会赠送普通钓竿。</p> : pending ? <div className="community-catch"><h4>鱼获已装进收获篮</h4>{pending.catches.map((caught, index) => <p key={index}><img src={communityItemIcons[caught.fish]} alt="" />{fish[caught.fish].name} · {caught.size} 厘米{caught.newCrown ? ' · 金冠' : caught.newRecord ? ' · 新纪录' : ''}</p>)}<p>待领取：{Object.entries(pending.items).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n}`).join('、')}。仓库满时继续保留。</p><button className="primary-button" disabled={!free} onClick={() => update(p => claimCommunityFish(p, pending.id))}>收进共用仓库</button></div> : session ? <>
        {session.phase === 'waiting' ? <><h4>{biting ? '浮漂动了，可以提竿了' : `等待咬钩 · 约 ${Math.max(0, Math.ceil((session.biteAt - now) / 1000))} 秒`}</h4><button className="primary-button" disabled={pet.timePause !== undefined || !biting} onClick={() => act('hook')}>提竿</button></> : <><label className="community-fishing-meter">收线 {session.clicks}/{session.requiredClicks}<progress aria-label="收线进度" max={session.requiredClicks} value={session.clicks} /></label><button className="primary-button" disabled={pet.timePause !== undefined || now - session.lastActionAt < 600} onClick={() => act('reel')}>收线 · 还需 {session.requiredClicks - session.clicks} 次</button></>}
        <p>当前一竿按抛竿时的小屋与装饰效果结算。关闭窗口会保留进度。</p><button className="text-button" disabled={Boolean(pet.timePause)} onClick={() => update(p => cancelCommunityFishing(p, session.id))}>收竿离开（鱼饵和耐久不返还）</button>
      </> : active?.mode === 'idle' ? <><p>已完成 {active.settledCasts}/{active.plannedCasts} 竿，已记录 {active.catches.length} 条鱼。</p><button className="secondary-button" disabled={Boolean(pet.timePause)} onClick={() => update(p => cancelCommunityFishing(p, active.id))}>收竿并整理已有鱼获</button></> : <>
        <div className="community-form-row"><label>水域<select value={water} onChange={e => setWater(e.target.value as WaterId)}>{waterIds.map(id => <option key={id} value={id} disabled={!isWaterOpen(pet, id)}>{waters[id].name}{!isWaterOpen(pet, id) ? '（待开放）' : ''}</option>)}</select></label><label>鱼饵<select value={bait} onChange={e => setBait(e.target.value as typeof bait)}><option value="fishing_bait">普通鱼饵（{pet.inventory.fishing_bait ?? 0}）</option><option value="river_bait" disabled={!c.facilities.upstream.built}>溪流鱼饵（{pet.inventory.river_bait ?? 0}）</option></select></label><label>钓竿<select value={strong ? 'strong' : 'plain'} onChange={e => setStrong(e.target.value === 'strong')}><option value="plain">普通钓竿（{toolDurabilityLabel(pet, 'fishing_rod')}）</option><option value="strong">柔韧钓竿（{toolDurabilityLabel(pet, 'reinforced_rod')}）</option></select></label></div>
        <label><input type="checkbox" checked={useNet} onChange={e => setUseNet(e.target.checked)} />轻便抄网 · 减少一次收线 · {toolDurabilityLabel(pet, 'landing_net')}</label>
        <p>每竿：鱼饵 ×1、所选钓具耐久各 −1、饱食 −{effects.hunger}、体力 −{effects.energy}。等待约 {getFishingWaitMs(pet) / 1000} 秒，提竿后收线 {getFishingClicks(strong, useNet)} 次。</p>
        <div className="community-actions"><button className="primary-button" disabled={!free || !isWaterOpen(pet, water) || pet.hunger < effects.hunger || pet.energy < effects.energy || !(pet.inventory[bait] ?? 0) || !(pet.inventory[strong ? 'reinforced_rod' : 'fishing_rod'] ?? 0) || useNet && !(pet.inventory.landing_net ?? 0)} onClick={() => update(p => startCommunityFishing(p, water, bait, strong, Date.now(), { net: useNet }))}>准备好了，抛竿</button><button className="secondary-button" onClick={onShop}>补充钓具与鱼饵</button></div>
      </>}
      <p className="community-muted">钓鱼小屋 Lv.{level}，所有已开放水域通用。普通鱼饵每三竿至少一竿遇到本水域的基础料理鱼；手动垂钓在离线时不会自动产鱼。</p>
      {c.facilities.fishing_hut.built && <button type="button" className="secondary-button" aria-haspopup="dialog" onClick={() => setConstructionOpen(true)}>小屋建设与扩建</button>}
      <h4>水域与栈道</h4><p>探险发现水域，修好栈道后可在小屋直接前往。</p>
      {(['forest_pool', 'coast_pier'] as const).map(id => { const access = c.waterAccess[id], cost = waters[id]; return <article className="community-card" key={id}><b>{cost.name} · {access.built ? '已永久直通' : access.found ? '已发现，待修建' : '尚未发现'}</b><p>{cost.discovery}</p>{access.found && !access.built && <><p>{cost.coins} 金币 · 木料 {cost.wood}（持有 {pet.inventory.community_wood ?? 0}）· 石料 {cost.stone}（持有 {pet.inventory.community_stone ?? 0}）</p><button className="secondary-button" disabled={!free || pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone} onClick={() => update(p => buildWaterBoardwalk(p, id))}>提交材料，修好栈道</button></>}{access.built && <button className="secondary-button" disabled={Boolean(active)} onClick={() => setWater(id)}>选择{cost.name}</button>}</article>; })}
      {onAdventure && <button className="text-button" disabled={!free} onClick={onAdventure}>去前哨探索新水域</button>}
    </section>}
    {(view === 'all' || view === 'recipes') && <section className="community-card"><h3>水边的料理</h3><p>鱼获可以自用、交单，或做成料理。</p><div className="community-actions"><button className="secondary-button" disabled={!free || !c.facilities.fishing_hut.built || !c.herbDiscovered} onClick={() => onKitchen('creek_fish_soup')}>鲫鱼＋香草 → 鲜鱼汤</button><button className="secondary-button" disabled={!free || !c.facilities.fishing_hut.built} onClick={() => onKitchen('carp_rice')}>鲤鱼＋大米 → 焖饭</button><button className="secondary-button" disabled={!free || !c.facilities.upstream.built} onClick={() => onKitchen('river_grill')}>鳟鱼＋胡萝卜 → 烤鱼</button></div></section>}
    {(view === 'all' || view === 'journal') && <section className="community-card"><h3>鱼类手账 · {Object.keys(f.journal).length}/{fishIds.length}</h3><p>首次钓获、累计数量和最大记录永久保留，交付／料理／出售只消耗实物。</p><div className="community-fish-book">{fishIds.map(id => { const record = f.journal[id]; return <article key={id} data-known={Boolean(record)}><img src={communityItemIcons[id]} alt="" /><b>{record ? fish[id].name : '尚未遇见'}{record?.goldCrown ? ' · 金冠' : ''}</b><small>{waters[fish[id].water].name} · {rarityNames[fish[id].rarity]} · {fish[id].rare ? '观赏收藏' : '料理食材'}</small><span>{record ? `累计 ${record.count} 条 · 最大 ${record.largest} cm` : '在这个水域试着抛竿吧'}</span>{record && <small>初见 {new Date(record.firstAt).toLocaleDateString('zh-CN')}</small>}</article>; })}</div></section>}
    {constructionOpen && <CommunityUpgradeDialog pet={pet} update={update} id="fishing_hut" registry={registry} itemIconMap={itemIconMap} onClose={() => setConstructionOpen(false)} />}
  </>;
};
