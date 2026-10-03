import { useState } from 'react';
import { ArrowRight, Clock, Compass, Sparkles } from 'lucide-react';
import { expeditionLandmarkIcons } from '../../adventureLandmarkAssets';
import { getExpeditionStartReason, startExpedition } from '../../core/expedition';
import { getRegionUnlocked, regionIds, regions } from '../../core/expeditionData';
import { getExplorationBudget } from '../../core/explorationBudget';
import { formatExpeditionInterval, getIdleExplorationTiming } from '../../core/expeditionTiming';
import { getInventoryItem } from '../../core/items';
import { getIdleExplorationTargets, getIdleExplorationDrops, idleExplorationRandomTarget, idleExplorationFocusWeight } from '../../core/explorationResources';
import { quoteExpeditionRations, standardRationPrice, type RationSelection } from '../../core/explorationRations';
import type { RegionId } from '../../core/expeditionTypes';
import type { ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { ExpeditionRations } from './ExpeditionRations';
import { formatProbabilityPercent } from '../numberFormat';
import { useAdventureAction } from '../useAdventureAction';
import { PreparationInventory, type PreparationResources } from '../PreparationInventory';
import { ExplorationHelp } from '../help/ExplorationGuide';
import { AdventureLandscape } from '../AdventurePresentation';
import { mapRegionForExpedition } from '../../core/landmarkProgress';
import { unknownItemIcon } from '../../assets';

export const IdleExpeditionPreparation = ({ pet, actorId, actorName, portrait, update, registry, icons, onUseHomeItem, onToggleItemFavorite, onShop, initialRegion, initialTarget, onMap, onCamp, onRoute, embedded }: ExpeditionProps & PreparationResources & {
  embedded?: boolean; initialRegion: RegionId; onMap: (region: RegionId) => void; onCamp: (region: RegionId) => void; onRoute: (region: RegionId, target: string) => void;
}) => {
  const [region, setRegion] = useState(initialRegion);
  const [chosenTarget, setTarget] = useState(initialTarget);
  const targets = getIdleExplorationTargets(region), target = targets.find(value => value.id === chosenTarget)?.id ?? idleExplorationRandomTarget;
  const [hours, setHours] = useState(2);
  const [rations, setRations] = useState<RationSelection>({ food: {}, autoFill: true });
  const action = useAdventureAction(), busy = action.phase !== 'idle';
  const q = quoteExpeditionRations(pet, region, hours, rations);
  const timing = getIdleExplorationTiming(pet, hours);
  const reason = getExpeditionStartReason(pet, [region], 'idle', hours, Date.now(), rations);
  const progress = pet.community.expedition.regions[region];
  const unlocked = getRegionUnlocked(pet, region), ready = unlocked && progress.surveyed && progress.base > 0;
  const drops = getIdleExplorationDrops(region, target);
  const perform = (fn: () => void) => { if (!busy) fn(); };
  const changeFood = (id: ItemId, delta: number) => setRations(current => {
    const food = { ...current.food }, count = Math.max(0, (food[id] ?? 0) + delta);
    if (delta > 0 && (count > (pet.inventory[id] ?? 0) || Object.values(food).reduce((sum, n) => sum + n, 0) + delta > q.maximum)) return current;
    if (count) food[id] = count; else delete food[id];
    return { ...current, food };
  });
  return <div className="exploration-idle-layout"><div className="exploration-prep-main">
    <section className="exploration-panel exploration-idle-destination"><AdventureLandscape region={mapRegionForExpedition[region]} node="camp" portrait={portrait} label={`${regions[region].name} · ${regions[region].base}`} /><div className="exploration-section-heading"><h3>{regions[region].name} · 营地</h3><span className="exploration-tag">{progress.base > 0 ? `Lv.${progress.base}` : '等待修复'}</span></div><p>让伙伴带上补给，沿着熟悉的小路采集当地物产。</p></section>
    <section className="exploration-panel"><h3>采集什么，去多久</h3><div className="idle-preparation-controls"><div className="idle-preparation-route">
      {!embedded && <label className="idle-preparation-field"><span><img className="outpost-destination-icon" src={expeditionLandmarkIcons[region].story} alt="" />目的地</span><select disabled={busy} aria-label="挂机目的地" value={region} onChange={e => setRegion(e.target.value as RegionId)}>{regionIds.map(id => <option key={id} value={id}>{regions[id].name}{!getRegionUnlocked(pet,id) ? ' · 未解锁' : !pet.community.expedition.regions[id].surveyed ? ' · 需完成故事' : !pet.community.expedition.regions[id].base ? ' · 需建设营地' : ''}</option>)}</select></label>}
      <label className="idle-preparation-field"><span>采集偏好</span><select disabled={busy} aria-label="挂机采集偏好" value={target} onChange={e => setTarget(e.target.value)}><option value={idleExplorationRandomTarget}>随机采集 · 各目标等概率</option>{targets.map(value => <option key={value.id} value={value.id}>偏向{value.name}</option>)}</select></label>
    </div><div><p>挂机时长</p><div className="outpost-duration" role="group" aria-label="挂机时长">{[2,4,8].map(n => <button key={n} disabled={busy} aria-pressed={hours === n} onClick={() => setHours(n)}>{n} 小时</button>)}</div></div></div><div className="exploration-idle-budget"><Clock size={23} /><strong>{hours} 小时 · 预留 {timing.checks} 次采集机会</strong><span>可用 {getExplorationBudget(pet)?.available ?? 0} 次</span></div><p>每 {formatExpeditionInterval(timing.intervalMs)} 采集并寻找珍宝。运动技能缩时 {timing.skillReduction}% · 星辉穹顶缩时 {Math.round(timing.decorationReduction)}%。</p></section>
    <section className="exploration-panel"><h3>可能采集到的物产</h3><p>全程抽取 {timing.checks} 次，每次随机获得下列一组物资。定向目标的抽取权重为其他目标的 {idleExplorationFocusWeight} 倍，仍可能获得其他物产。</p><div className="exploration-idle-finds">{drops.map(resource => <div key={resource.id}><img src={icons[Object.keys(resource.idle!)[0]] ?? unknownItemIcon} alt="" /><span>{resource.name}<strong>{formatProbabilityPercent(resource.chance)}{resource.id === target ? ' · 偏好' : ''}</strong><small>{Object.entries(resource.idle!).map(([id,n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n}`).join('、')}</small></span></div>)}</div><p>概率为每次抽取的比例，实际数量以旅途收获为准。物资容量与全程食物分别计算，采集收获会随旅途进度保存。</p></section>
    {!ready && <div className="outpost-unlock-note"><p>{!unlocked ? regions[region].unlockHint : !progress.surveyed ? '完成当地全部 8 个地标后，就能修好营地并安排挂机。' : '修好当地营地后开放挂机探索。'}</p><button className="exp-secondary" onClick={() => { action.cancel(); progress.surveyed && unlocked ? onCamp(region) : onMap(region); }}>{progress.surveyed && unlocked ? '去建设营地' : '去地图查看'}</button></div>}
    <div className="outpost-inline-actions"><button className="exp-link-button" onClick={() => { action.cancel(); onRoute(region, target === idleExplorationRandomTarget ? targets[0].id : target); }}>改为亲自采集</button><button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与护理用品</button></div>
    </div><aside className="exploration-panel exploration-idle-supplies"><div className="exploration-section-heading"><h3>旅途补给</h3><ExplorationHelp pet={pet} mode="idle" rations={q} /></div>
    <PreparationInventory pet={pet} registry={registry} icons={icons} bag={rations.food} capacity={q.maximum} automaticFood={q.purchased ? {trail_mix:q.purchased} : {}} foodOnly onPack={changeFood} onUseHomeItem={onUseHomeItem} onToggleItemFavorite={onToggleItemFavorite} perform={perform} />
    <div className="idle-preparation-autofill"><label><input disabled={busy} type="checkbox" checked={rations.autoFill} onChange={e => setRations(current => ({...current,autoFill:e.target.checked}))} />自动补给 · {standardRationPrice} 金币 / 份</label><strong role="status">购买 {q.purchased} 份 · {q.coins} 金币</strong></div>
    <button className="secondary-button" disabled={busy} onClick={() => setRations({food:{},autoFill:true})}>一键标准补给</button>
    <p className="exploration-idle-discount">烹饪 Lv.{pet.partnerSchedule.skills.cooking.level} · 费用减免 {q.cookingDiscount}%<br />{q.undiscountedCoins} → {q.coins} 金币，出发时扣除。</p>
    <ExpeditionRations pet={pet} region={region} hours={hours} selection={rations} showHelp={false} />
    <section className="exploration-treasure-note"><h4><Sparkles size={21} />每次珍宝概率 {formatProbabilityPercent(q.chance)}</h4><p>每满 {formatExpeditionInterval(timing.intervalMs)} 判定一次。连续未获得 {pet.community.expedition.treasurePity[region]} / 9 次，第 10 次必得当地珍宝。</p></section>
    <p>提前返程会退还未使用的采集次数；食物和补给费不退。</p>
    <footer className="outpost-action-bar adventure-pack-depart">{reason && <p className="exp-warning" role="status">{reason}</p>}<button className="exp-primary" disabled={busy || Boolean(reason)} onClick={() => action.run(() => update(p => startExpedition(p,[region],{},false,actorId,actorName,'idle',hours,Date.now(),{target,rations})), 'walk')}><Compass size={21} /><span>{busy ? '正在出发…' : `挂机出发 · ${hours} 小时`}</span><ArrowRight size={18} /></button></footer>
    </aside></div>;
};
