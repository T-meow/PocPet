import { Check, Tent } from 'lucide-react';
import { getBaseUpgrade, upgradeExpeditionBase } from '../../core/expedition';
import { getRegionUnlocked, regions } from '../../core/expeditionData';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { RegionId } from '../../core/expeditionTypes';
import type { ExpeditionProps } from './types';

export const ExpeditionCamp = ({ pet, update, region, onMap, onGather, onIdle }: Pick<ExpeditionProps, 'pet' | 'update'> & {
  region: RegionId; onMap: () => void; onGather: () => void; onIdle: () => void;
}) => {
  const progress = pet.community.expedition.regions[region], place = regions[region];
  const upgrade = getBaseUpgrade(progress.base, region);
  const ready = getRegionUnlocked(pet, region) && progress.surveyed;
  const enough = pet.coins >= upgrade.coins && (pet.inventory.community_wood ?? 0) >= upgrade.wood && (pet.inventory.community_stone ?? 0) >= upgrade.stone;
  const reason = !ready ? '先完成当地故事，再来建设营地。'
    : pet.timePause ? '时间已冻结，恢复时间后再建设。'
      : !canSpendCompanionTime(pet) ? '伙伴正在休息或忙碌，空闲后再建设。'
        : !enough ? '建材或金币不足，可以先去采集。' : '';
  return <section className="outpost-camp">
    <div className="outpost-section-heading"><span className="outpost-symbol" data-tone="peach"><Tent size={24} /></span><div><small>{place.name} · 营地 {progress.base}/2 级</small><h3>{place.base}</h3></div></div>
    <p>{progress.base >= 2 ? '营地与往返步道已建成，可以安排挂机探索。' : upgrade.benefit}</p>
    <ol className="outpost-camp-steps">{['完成地区故事', '修好休息基地', '修通往返步道'].map((name, i) => <li key={name} data-done={i === 0 ? progress.surveyed : progress.base >= i}><Check size={16} />{name}</li>)}</ol>
    {progress.base < 2 && <>
      <div className="outpost-costs"><span>金币 <b>{pet.coins}/{upgrade.coins}</b></span><span>木料 <b>{pet.inventory.community_wood ?? 0}/{upgrade.wood}</b></span><span>石料 <b>{pet.inventory.community_stone ?? 0}/{upgrade.stone}</b></span></div>
      {reason && <p className="exp-warning" role="status">{reason}</p>}
      <button className="exp-primary" disabled={Boolean(reason)} onClick={() => update(p => upgradeExpeditionBase(p, region, progress.base))}>{upgrade.name}</button>
    </>}
    <div className="outpost-inline-actions">{!ready ? <button className="exp-secondary" onClick={onMap}>去地图继续故事</button> : <button className="exp-secondary" onClick={onGather}>去采集建材</button>}{progress.base > 0 && <button className="exp-secondary" onClick={onIdle}>安排挂机探索</button>}</div>
  </section>;
};
