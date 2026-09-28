import { useState } from 'react';
import { Compass } from 'lucide-react';
import { expeditionLandmarkIcons } from '../../adventureLandmarkAssets';
import { getExpeditionStartReason, startExpedition } from '../../core/expedition';
import { getRegionUnlocked, regionIds, regions } from '../../core/expeditionData';
import { getExplorationBudget } from '../../core/explorationBudget';
import { getInventoryItem } from '../../core/items';
import { getIdleExplorationTargets, getIdleExplorationFinds } from '../../core/explorationResources';
import { quoteExpeditionRations, standardRationPrice, type RationSelection } from '../../core/explorationRations';
import type { RegionId } from '../../core/expeditionTypes';
import type { ItemId } from '../../core/petTypes';
import type { ExpeditionProps } from './types';
import { ExpeditionRations } from './ExpeditionRations';
import { formatProbabilityPercent } from '../numberFormat';
import { useAdventureAction } from '../useAdventureAction';
import { PreparationInventory, type PreparationResources } from '../PreparationInventory';
import { ExplorationHelp } from '../help/ExplorationGuide';

export const IdleExpeditionPreparation = ({ pet, actorId, actorName, update, registry, icons, onUseHomeItem, onShop, initialRegion, initialTarget, onMap, onCamp, onRoute, embedded }: ExpeditionProps & PreparationResources & {
  embedded?: boolean; initialRegion: RegionId; onMap: (region: RegionId) => void; onCamp: (region: RegionId) => void; onRoute: (region: RegionId, target: string) => void;
}) => {
  const [region, setRegion] = useState(initialRegion);
  const [chosenTarget, setTarget] = useState(initialTarget);
  const targets = getIdleExplorationTargets(region), target = targets.find(value => value.id === chosenTarget)?.id ?? targets[0].id;
  const [hours, setHours] = useState(2);
  const [rations, setRations] = useState<RationSelection>({ food: {}, autoFill: true });
  const action = useAdventureAction(), busy = action.phase !== 'idle';
  const q = quoteExpeditionRations(pet, region, hours, rations);
  const reason = getExpeditionStartReason(pet, [region], 'idle', hours, Date.now(), rations);
  const progress = pet.community.expedition.regions[region];
  const unlocked = getRegionUnlocked(pet, region), ready = unlocked && progress.surveyed && progress.base > 0;
  const finds = getIdleExplorationFinds(region, target);
  const perform = (fn: () => void) => { if (!busy) fn(); };
  const changeFood = (id: ItemId, delta: number) => setRations(current => {
    const food = { ...current.food }, count = Math.max(0, (food[id] ?? 0) + delta);
    if (delta > 0 && (count > (pet.inventory[id] ?? 0) || Object.values(food).reduce((sum, n) => sum + n, 0) + delta > q.maximum)) return current;
    if (count) food[id] = count; else delete food[id];
    return { ...current, food };
  });
  return <>
    {!embedded && <div className="idle-preparation-help"><ExplorationHelp pet={pet} mode="idle" rations={q} /></div>}
    <div className="idle-preparation-controls">
      <div className="idle-preparation-route">
        {!embedded && <label className="idle-preparation-field"><span><img className="outpost-destination-icon" src={expeditionLandmarkIcons[region].story} alt="" />目的地</span><select disabled={busy} aria-label="挂机目的地" value={region} onChange={e => setRegion(e.target.value as RegionId)}>{regionIds.map(id => <option key={id} value={id}>{regions[id].name}{!getRegionUnlocked(pet, id) ? ' · 未解锁' : !pet.community.expedition.regions[id].surveyed ? ' · 需完成故事' : !pet.community.expedition.regions[id].base ? ' · 需建设营地' : ''}</option>)}</select></label>}
        <label className="idle-preparation-field"><span>采集目标</span><select disabled={busy} aria-label="挂机采集目标" value={target} onChange={e => setTarget(e.target.value)}>{targets.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      </div>
      <div className="outpost-duration" role="group" aria-label="挂机时长">{[2, 4, 8].map(n => <button key={n} disabled={busy} aria-pressed={hours === n} onClick={() => setHours(n)}>{n} 小时</button>)}</div>
      <div className="idle-preparation-autofill"><label><input disabled={busy} type="checkbox" checked={rations.autoFill} onChange={e => setRations(current => ({ ...current, autoFill: e.target.checked }))} />自动补给 · {standardRationPrice} 金币/份</label><strong role="status">购买 {q.purchased} 份 · {q.coins} 金币</strong></div>
      <button className="secondary-button" onClick={() => setRations({ food: {}, autoFill: true })}>一键标准补给</button><p>烹饪 Lv.{pet.partnerSchedule.skills.cooking.level}：费用 {q.undiscountedCoins} → {q.coins} 金币（−{q.cookingDiscount}%）。出发时才扣除。</p>
    </div>
    <PreparationInventory pet={pet} registry={registry} icons={icons} bag={rations.food} capacity={q.maximum} automaticFood={q.purchased ? { trail_mix: q.purchased } : {}} foodOnly onPack={changeFood} onUseHomeItem={onUseHomeItem} perform={perform} bagExtra={<>
      {!ready && <div className="outpost-unlock-note"><p>{!unlocked ? regions[region].unlockHint : !progress.surveyed ? '完成当地全部 8 个地标后，就能修好营地并安排挂机。' : '修好当地营地后开放挂机探索。'}</p><button className="exp-secondary" onClick={() => { action.cancel(); progress.surveyed && unlocked ? onCamp(region) : onMap(region); }}>{progress.surveyed && unlocked ? '去建设营地' : '去地图查看'}</button></div>}
      <p>每满两小时随机概率 {formatProbabilityPercent(q.chance)} · 本地区连续未获得 {pet.community.expedition.treasurePity[region]}/9 次。第 10 次必得当地珍宝；随机获得后清零。手动勘探独立计数。</p>
      <ExpeditionRations pet={pet} region={region} hours={hours} selection={rations} finds={finds} showHelp={false} />
      <div className="outpost-inline-actions"><button className="exp-link-button" onClick={() => { action.cancel(); onRoute(region, target); }}>改为亲自采集</button><button className="exp-link-button" onClick={() => { action.cancel(); onShop(); }}>补充口粮与护理用品</button></div>
    </>} />
    <p>全程食物上限 {q.maximum} 份，与返程物资容量分别计算。提前返程时未使用的采集次数退还；剩余料理会由伙伴食用或分享，不退食物和补给费。</p>
    <footer className="outpost-action-bar adventure-pack-depart"><div><strong>{regions[region].name} · {hours} 小时 · 预留 {hours} 次／可用 {getExplorationBudget(pet)?.available ?? 0} 次</strong><small>必得：{Object.entries(finds).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n * hours}`).join('、')}</small>{reason && <p className="exp-warning" role="status">{reason}</p>}</div><button className="exp-primary" disabled={busy || Boolean(reason)} onClick={() => action.run(() => update(p => startExpedition(p, [region], {}, false, actorId, actorName, 'idle', hours, Date.now(), { target, rations })), 'walk')}><Compass size={20} />{busy ? '正在出发…' : '挂机出发'}</button></footer>
  </>;
};
