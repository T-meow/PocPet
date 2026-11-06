import { useId, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { getMasteryGrowthProgress, getMasteryStatBonus, masteryStatIncrease, masteryStatKeys, masteryStatNames, masteryUpgradeInterval } from '../core/masteryGrowth';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import type { ItemId, MasteryStatKey, PetState } from '../core/petTypes';
import { DialogShell } from './DialogShell';

interface Props {
  pet: PetState;
  icons: Partial<Record<ItemId, string>>;
  onUpgrade: (key: MasteryStatKey, expectedUsed: number) => void;
}

export const MasteryGrowthPanel = ({ pet, icons, onUpgrade }: Props) => {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MasteryStatKey>('hunger');
  const progress = getMasteryGrowthProgress(pet);
  const apples = pet.inventory.golden_apple ?? 0;
  const cap = (key: MasteryStatKey) => key === 'energy' ? getPetEnergyCap(pet) : getPetStatCap(pet, key);
  const reason = pet.timePause ? '时间冻结中' : progress.available <= 0 ? `再完成 ${progress.remaining} 次大师工作可提升` : apples < 1 ? '需要 1 个金苹果' : '';
  return <>
    <section className="community-contribution" aria-label="大师属性提升">
      <div className="community-sidebar-heading"><Sparkles size={18} /><h3>大师属性提升</h3></div>
      <strong>可提升 {progress.available} 次</strong>
      <p>四类大师工作每累计 {masteryUpgradeInterval} 次，可消耗 1 个金苹果，自选一项属性上限永久 +{masteryStatIncrease}。</p>
      <progress className="community-progress" value={progress.progress} max={masteryUpgradeInterval} aria-label="下次属性提升机会" />
      <p>累计 {progress.total} 次 · 已提升 {progress.used} 次<br />下次机会还需 {progress.remaining} 次</p>
      <button type="button" className="primary-button" onClick={() => setOpen(true)}>选择提升属性</button>
    </section>
    {open && <DialogShell className="community-work-dialog" backdropClassName="community-work-backdrop" labelId={titleId} onClose={() => setOpen(false)} historyNavigation>
      <header className="community-work-dialog-heading"><div><span className="community-eyebrow">大师成长 · 一次选择，一点进步</span><h2 id={titleId}>选择提升属性</h2></div><button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="关闭"><X size={20} /></button></header>
      <div className="community-work-dialog-body">
        <p>可提升 {progress.available} 次，每次消耗金苹果 ×1。机会可累积，可反复选择同一属性。</p>
        <div className="community-rewards"><span>{icons.golden_apple && <img src={icons.golden_apple} alt="" />}金苹果 ×{apples}</span></div>
        <div className="community-tabs" role="group" aria-label="选择属性">{masteryStatKeys.map(key => <button type="button" key={key} aria-pressed={selected === key} onClick={() => setSelected(key)}>{masteryStatNames[key]}</button>)}</div>
        <div className="community-category-alternative"><small>{masteryStatNames[selected]}上限</small><strong>{cap(selected)} → {cap(selected) + masteryStatIncrease}</strong><p>本项已通过大师提升 +{getMasteryStatBonus(pet, selected)}。此次上限与当前值同步 +{masteryStatIncrease}。</p></div>
        <p>大师次数会保留。属性提升独立累加，每次都固定增加 {masteryStatIncrease} 点。</p>
        {reason && <p className="community-work-blocked" role="status">{reason}</p>}
      </div>
      <footer className="community-work-dialog-footer"><button type="button" className="secondary-button" onClick={() => setOpen(false)}>关闭</button><button type="button" className="primary-button" disabled={Boolean(reason)} onClick={() => onUpgrade(selected, progress.used)}>金苹果 ×1 · 提升{masteryStatNames[selected]}</button></footer>
    </DialogShell>}
  </>;
};
