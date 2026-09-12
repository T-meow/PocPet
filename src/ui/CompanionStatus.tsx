import { useState, type CSSProperties } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { getEnergyRecoveryInfo, getPetEnergyCap, getPetStatCap, type PetState } from '../core/pet';
import { t } from '../i18n';
import { activityText as L } from '../core/kitchenRecipes';
import { DialogShell } from './DialogShell';

export const CompanionStatus = ({ pet }: { pet: PetState }) => {
  const [details, setDetails] = useState(false);
  const energy = getEnergyRecoveryInfo(pet);
  const hint = energy.isFull ? L('体力已充足', 'Energy is full') : energy.isPaused ? L('体力恢复暂停中', 'Energy recovery paused') : L(`下次恢复 ${Math.ceil(energy.remainingMs / 1000)} 秒`, `Next recovery in ${Math.ceil(energy.remainingMs / 1000)}s`);
  const stats = [ ['hunger', '#ff9658'], ['mood', '#f6c63e'], ['cleanliness', '#18b9dc'], ['energy', '#947de5'], ['health', '#19b98e'] ] as const;
  return <><div className="companion-status"><button className="stat-overview" onClick={() => setDetails(true)}><strong>{L('伙伴状态', 'Companion status')}</strong><span>{hint}</span><ChevronRight size={16} /></button><div className="stat-rings">{stats.map(([key, color]) => {
    const max = key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet);
    const value = Math.round(pet[key]);
    return <button key={key} className="stat-ring-button" onClick={() => setDetails(true)} aria-label={`${t(`ui.stats.${key}`)} ${value} / ${max}`} style={{ '--stat-color': color } as CSSProperties}><span className="stat-ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle className="ring-track" cx="36" cy="36" r="29" /><circle className="ring-value" cx="36" cy="36" r="29" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, pet[key] / max * 100))} 100`} /></svg><strong>{value}</strong></span><span>{t(`ui.stats.${key}`)}</span></button>;
  })}</div></div>{details && <DialogShell className="status-details-modal" labelId="status-details-title" onClose={() => setDetails(false)}><header className="dialog-header"><h2 id="status-details-title">{L('伙伴状态', 'Companion status')}</h2><button className="icon-button" onClick={() => setDetails(false)} aria-label={L('关闭', 'Close')}><X /></button></header><div className="status-details-list">{stats.map(([key, color]) => <div key={key}><span><i style={{ background: color }} />{t(`ui.stats.${key}`)}</span><strong>{Math.round(pet[key])} / {Math.round(key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet))}</strong></div>)}</div><p className="v2-muted">{hint}</p><p className="v2-muted">{energy.isPaused ? L('伙伴日程进行中，体力自然恢复暂时暂停。', 'Natural energy recovery pauses during a companion activity.') : L(`按当前状态，每 ${Math.round(energy.intervalMs / 1000)} 秒恢复 1 点体力。`, `At the current rate, recover 1 energy every ${Math.round(energy.intervalMs / 1000)} seconds.`)}</p><p className="v2-muted">{L('属性上限随等级成长，体力还会计入奖杯加成。', 'Stat limits grow with level. The energy limit also includes trophy bonuses.')}</p><p className="v2-muted">{L('状态会随着陪伴自然变化，慢慢照顾就好。', 'Your companion’s needs change naturally. Take care at your own pace.')}</p></DialogShell>}</>;
};
