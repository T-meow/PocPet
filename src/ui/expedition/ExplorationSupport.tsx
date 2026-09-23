import { useState } from 'react';
import { getExplorationCampQuote, getExplorationRescueQuote, rescueExploration, restExplorationWithKit, type ExplorationSystem } from '../../core/explorationSupport';
import { isTravelFood } from '../../core/explorationRations';
import { toolDurabilityLabel } from '../../core/toolDurability';
import type { PetState } from '../../core/petTypes';
import '../../styles/exploration-logistics.css';

export const ExplorationSupport = ({ pet, system, update, move, busy }: { pet: PetState; system: ExplorationSystem; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void; busy: boolean }) => {
  const [panel, setPanel] = useState<'rescue' | 'camp' | null>(null);
  const trip = pet.adventure.active;
  if (!trip) return null;
  const rescue = getExplorationRescueQuote(pet, system), camp = getExplorationCampQuote(pet, system);
  const noFood = !Object.entries(trip.bag).some(([id, n]) => n > 0 && isTravelFood(id));
  return <div className="exploration-support">
    {noFood && <p className="exp-warning">行囊中没有食物了。可以请邻居送来应急补给，继续当前行程。</p>}
    <button className={noFood ? 'exp-primary' : 'exp-secondary'} disabled={busy} onClick={() => setPanel(value => value === 'rescue' ? null : 'rescue')} aria-expanded={panel === 'rescue'}>邻居救援 · 100 心心</button>
    {camp.atCheckpoint && <button className="exp-secondary" disabled={busy || trip.rested} onClick={() => setPanel(value => value === 'camp' ? null : 'camp')} aria-expanded={panel === 'camp'}>{trip.rested ? '本趟已休整' : '营具休整 · 耐久 −1'}</button>}
    {panel === 'rescue' && <div className="exp-quote"><b>应急物资包</b><span>本次恢复：饱食 +{Number(rescue.hunger.toFixed(2))} · 体力 +{rescue.energy} · 心情 +{Number(rescue.mood.toFixed(2))}</span><button className="exp-primary" disabled={busy || Boolean(rescue.reason)} onClick={() => update(p => rescueExploration(p, system, trip.id, trip.revision))}>支付 100 心心 · 接收补给</button>{rescue.reason && <small>{rescue.reason}</small>}</div>}
    {panel === 'camp' && camp.atCheckpoint && !trip.rested && <div className="exp-quote"><strong>中途休整点 · 已完成第 {camp.checkpoint} 阶段</strong><small>仓库营具 · {toolDurabilityLabel(pet, 'camp_kit')}</small><span>恢复：体力 +{camp.energy} · 心情 +{Number(camp.mood.toFixed(2))} · 健康 +{Number(camp.health.toFixed(2))}</span><small>继续前进后，本趟无法再使用营具。</small>
      <button className="exp-secondary" disabled={busy || Boolean(camp.reason)} onClick={() => move(p => restExplorationWithKit(p, system, trip.id, trip.revision))}>使用营具 · 耐久 −1</button>{camp.reason && <small>{camp.reason}</small>}</div>}
  </div>;
};
