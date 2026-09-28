import { useEffect, useState } from 'react';
import { Heart, Tent, X } from 'lucide-react';
import { getExplorationCampQuote, getExplorationRescueQuote, rescueExploration, restExplorationWithKit, type ExplorationSystem } from '../../core/explorationSupport';
import { toolDurabilityLabel } from '../../core/toolDurability';
import type { PetState } from '../../core/petTypes';
import { DialogShell } from '../DialogShell';
import { formatInteger } from '../numberFormat';
import '../../styles/exploration-logistics.css';

export const ExplorationSupport = ({ pet, system, update, move, busy }: { pet: PetState; system: ExplorationSystem; update: (fn: (p: PetState) => PetState) => void; move: (fn: (p: PetState) => PetState) => void; busy: boolean }) => {
  const [panel, setPanel] = useState<'rescue' | 'camp' | null>(null);
  const trip = pet.adventure.active;
  const rescue = getExplorationRescueQuote(pet, system), camp = getExplorationCampQuote(pet, system);
  const canCamp = !camp.reason;
  useEffect(() => {
    if (panel === 'rescue' && !rescue.visible || panel === 'camp' && !canCamp) setPanel(null);
  }, [panel, rescue.visible, canCamp]);
  if (!trip || !rescue.visible && !canCamp) return null;
  return <div className="exploration-support">
    {rescue.visible && <div className="exploration-support-rescue"><button className="exp-primary" disabled={busy} onClick={() => setPanel('rescue')} aria-haspopup="dialog"><Heart size={18} aria-hidden="true" />邻居救援 · 100 心心</button>{rescue.reason && <small className="exploration-check-warning">{rescue.reason}</small>}</div>}
    {canCamp && <button className="exp-secondary" disabled={busy} onClick={() => setPanel('camp')} aria-haspopup="dialog"><Tent size={18} aria-hidden="true" />营具休整 · 耐久 −1</button>}
    {panel === 'rescue' && rescue.visible && <DialogShell className="exploration-support-sheet" labelId="exploration-rescue-title" onClose={() => setPanel(null)}>
      <header><h3 id="exploration-rescue-title">邻居救援 · 应急补给</h3><button className="icon-button" aria-label="关闭救援面板" onClick={() => setPanel(null)}><X /></button></header>
      <div className="exploration-sheet-body"><p>补给直接恢复状态，不占背包，也不会推进当前阶段。</p><p className="exploration-recovery"><strong>饱食 +{formatInteger(rescue.hunger)}</strong><strong>体力 +{formatInteger(rescue.energy)}</strong><strong>心情 +{formatInteger(rescue.mood)}</strong></p><p>花费 <strong>100 心心</strong> · 持有 {formatInteger(pet.hearts)} 心心</p>{rescue.reason && <p className="exploration-check-warning" role="status">{rescue.reason}</p>}</div>
      <footer><button data-dialog-autofocus onClick={() => setPanel(null)}>取消</button><button className="primary-button" disabled={busy || Boolean(rescue.reason)} onClick={() => { update(p => rescueExploration(p, system, trip.id, trip.revision)); setPanel(null); }}>支付 100 心心 · 接收补给</button></footer>
    </DialogShell>}
    {panel === 'camp' && canCamp && <DialogShell className="exploration-support-sheet" labelId="exploration-camp-title" onClose={() => setPanel(null)}>
      <header><h3 id="exploration-camp-title">中途休整点</h3><button className="icon-button" aria-label="关闭休整面板" onClick={() => setPanel(null)}><X /></button></header>
      <div className="exploration-sheet-body"><p>已完成第 {camp.checkpoint} 阶段。本趟可休整一次，继续前进后将错过休整点。</p><p className="exploration-recovery"><strong>体力 +{formatInteger(camp.energy)}</strong><strong>心情 +{formatInteger(camp.mood)}</strong><strong>健康 +{formatInteger(camp.health)}</strong></p><p>仓库营具 · {toolDurabilityLabel(pet, 'camp_kit')} · 本次耐久 −1</p></div>
      <footer><button data-dialog-autofocus onClick={() => setPanel(null)}>取消</button><button className="primary-button" disabled={busy} onClick={() => { move(p => restExplorationWithKit(p, system, trip.id, trip.revision)); setPanel(null); }}>使用营具 · 耐久 −1</button></footer>
    </DialogShell>}
  </div>;
};
