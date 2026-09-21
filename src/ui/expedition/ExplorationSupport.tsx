import { useState } from 'react';
import { getExplorationCampQuote, getExplorationRescueQuote, rescueExploration, restExplorationWithKit, type ExplorationSystem } from '../../core/explorationSupport';
import { isTravelFood } from '../../core/explorationRations';
import { toolDurabilityLabel } from '../../core/toolDurability';
import type { PetState } from '../../core/petTypes';
import '../../styles/exploration-logistics.css';

export const ExplorationSupport = ({ pet, system, update, move, busy }: { pet: PetState; system: ExplorationSystem; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void; busy: boolean }) => {
  const [rescueOpen, setRescueOpen] = useState(false);
  const trip = system === 'adventure' ? pet.adventure.active : pet.community.expedition.active;
  if (!trip || system === 'expedition' && pet.community.expedition.active?.mode !== 'manual') return null;
  const rescue = getExplorationRescueQuote(pet, system), camp = getExplorationCampQuote(pet, system);
  const noFood = !Object.entries(trip.bag).some(([id, n]) => n > 0 && isTravelFood(id));
  return <div className="exploration-support">
    {noFood && <p className="exp-warning">行囊中没有食物了。可以请邻居送来应急补给，继续当前行程。</p>}
    <button className={noFood ? 'exp-primary' : 'exp-secondary'} onClick={() => setRescueOpen(v => !v)} aria-expanded={rescueOpen}>邻居救援 · 100 心心</button>
    {rescueOpen && <div className="exp-quote"><b>邻居将送来应急物资包</b><span>本次恢复：饱食 +{Number(rescue.hunger.toFixed(2))} · 体力 +{rescue.energy} · 心情 +{Number(rescue.mood.toFixed(2))}</span><small>直接恢复，不占背包；保留当前节点和发现。可按需要再次呼叫。</small><button className="exp-primary" disabled={Boolean(rescue.reason)} onClick={() => update(p => rescueExploration(p, system, trip.id, trip.revision))}>支付 100 心心 · 接收补给</button>{rescue.reason && <small>{rescue.reason}</small>}</div>}
    <details className="exp-bag"><summary>便携营具 · {toolDurabilityLabel(pet, 'camp_kit')}</summary><p>本次可恢复：体力 +{camp.energy} · 心情 +{Number(camp.mood.toFixed(2))} · 健康 +{Number(camp.health.toFixed(2))}。</p><small>体力上限 25%、心情上限 20%。体力和健康只补回本地区尚未恢复的损耗；与基地共用每地区一次休整。</small>
      <button className="exp-secondary" disabled={busy || Boolean(camp.reason)} onClick={() => move(p => { const current = system === 'adventure' ? p.adventure.active : p.community.expedition.active; return current?.id === trip.id ? restExplorationWithKit(p, system, trip.id, current.revision) : p; })}>使用营具休整 · 耐久 −1</button>{camp.reason && <small>{camp.reason}</small>}</details>
  </div>;
};
