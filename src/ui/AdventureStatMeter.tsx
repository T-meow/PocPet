import type { ReactNode } from 'react';

export const AdventureStatMeter = ({ kind, label, value, max, icon }: { kind: string; label: string; value: number; max: number; icon: ReactNode }) => {
  const amount = Math.max(0, value), filled = Math.min(max, amount);
  return <div className={'adventure-stat-meter adventure-stat-meter--' + kind}>
    <div className="adventure-stat-label"><span>{icon}{label}</span><b>{Math.floor(amount)}/{max}</b></div>
    <div className="adventure-stat-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={filled} aria-valuetext={`${Math.floor(amount)}/${max}`}><span style={{ width: `${max > 0 ? filled / max * 100 : 0}%` }} /></div>
  </div>;
};
