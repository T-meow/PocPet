import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Gift, Package, X } from 'lucide-react';
import type { ItemRegistry, PetState } from '../core/petTypes';
import type { RegionId } from '../core/expeditionTypes';
import { getRegionUnlocked, regionIds, regions } from '../core/expeditionData';
import { claimAdventureCommission, commissionLimit, getCommissionQuote, getCommissionStartReason, startAdventureCommission } from '../core/adventureCommissions';
import { regionalTreasureIds, regionalTreasures } from '../core/regionalTreasures';
import { resolveCompanionPortrait, type CompanionPortrait } from './companionRoster';
import { DialogShell } from './DialogShell';
import { HelpButton } from './help/HelpButton';
import { commissionHelp } from './help/explorationHelp';
import { formatInteger, formatProbabilityPercent } from './numberFormat';

const durationText = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return `${hours ? `${hours}小时` : ''}${minutes ? `${minutes}分` : ''}${rest || !hours && !minutes ? `${rest}秒` : ''}`;
};

interface CommissionProps {
  pet: PetState; selected?: CompanionPortrait; canStart: boolean; roster: readonly CompanionPortrait[];
  registry: ItemRegistry; icons: Record<string, string>; update: (fn: (pet: PetState) => PetState) => void;
  onSelect: (id: string) => void; onClose: () => void;
}

export const AdventureCommissions = (props: CommissionProps) => {
  const { pet, roster, selected, onSelect } = props;
  const now = pet.timePause ? pet.timePause.pausedAt : Math.max(pet.lastUpdatedAt, Date.now());
  return <>
    {pet.adventure.commissions.length > 0 && <section className="adventure-commission-statuses" aria-label="伙伴委托进度">
      <div className="adventure-commission-status-heading"><strong>伙伴委托</strong><small>{pet.adventure.commissions.length}/{commissionLimit}</small></div>
      {pet.adventure.commissions.map(task => {
        const companion = resolveCompanionPortrait(roster, task.actorId, task.actorName);
        const ready = task.status === 'ready' || !pet.timePause && now >= task.endsAt;
        return <button type="button" className="adventure-commission-status" key={task.id} data-ready={ready} aria-haspopup="dialog" aria-label={`${task.actorName}的委托：${ready ? '物资待领取' : '查看进度'}`} onClick={() => onSelect(task.actorId)}>
          <img src={companion.portrait} alt="" /><span><strong>{task.actorName} · {regions[task.region].name}</strong><small>{ready ? '物资待领取' : `${pet.timePause ? '已暂停 · ' : ''}剩余 ${durationText(task.endsAt - now)}`}</small></span><ArrowRight size={18} />
        </button>;
      })}
    </section>}
    {selected && <AdventureCommissionDialog key={selected.id} {...props} selected={selected} />}
  </>;
};

const AdventureCommissionDialog = ({ pet, selected, canStart, registry, icons, update, onClose }: CommissionProps & { selected: CompanionPortrait }) => {
  const [region, setRegion] = useState<RegionId>(() => regionIds.find(id => getRegionUnlocked(pet, id)) ?? 'valley');
  const task = pet.adventure.commissions.find(value => value.actorId === selected.id);
  const previousTaskId = useRef(task?.id);
  useEffect(() => {
    if (previousTaskId.current && !task) onClose();
    previousTaskId.current = task?.id;
  }, [task?.id, onClose]);
  const quote = getCommissionQuote(pet, region), snapshot = task ?? quote;
  const destination = task?.region ?? region;
  const reason = !canStart ? '这位伙伴现在不在大厅，等下次相遇再委托吧。' : getCommissionStartReason(pet, selected.id, region);
  const treasure = regionalTreasureIds.find(id => regionalTreasures[id].region === destination)!;
  const now = pet.timePause ? pet.timePause.pausedAt : Math.max(pet.lastUpdatedAt, Date.now());
  const ready = Boolean(task && (task.status === 'ready' || !pet.timePause && now >= task.endsAt));
  const items = (contents: Record<string, number>) => Object.entries(contents).filter(([, count]) => count > 0).map(([id, count]) => <li key={id}>{icons[id] ? <img src={icons[id]} alt="" /> : <Package size={24} />}<span>{registry.get(id)?.name ?? id}<b>×{formatInteger(count)}</b></span></li>);
  return <DialogShell className="exploration-sheet adventure-commission-dialog" labelId="adventure-commission-title" onClose={onClose} closeOnBackdrop>
    <header className="adventure-commission-header"><h3 id="adventure-commission-title">伙伴委托</h3><HelpButton {...commissionHelp} details={<>{commissionHelp.details}<p>本单营地缩时 {formatInteger(snapshot.campReduction)}%，星辉穹顶缩时 {formatInteger(snapshot.decorationReduction)}%，两项相乘。</p></>} /><button type="button" className="icon-button" aria-label="关闭伙伴委托" onClick={onClose}><X /></button></header>
    <div className="exploration-sheet-body adventure-commission-body">
      <div className="adventure-commission-dialogue"><img src={selected.portrait} alt="" /><div><strong>{selected.name}</strong><p>给我一个金苹果，我就去帮你搜一些素材！</p></div></div>
      <p className="adventure-commission-balance">金苹果余额 <strong>{formatInteger(pet.inventory.golden_apple ?? 0)}</strong></p>
      {task ? <p className="adventure-commission-destination">前往地区 <strong>{regions[task.region].name}</strong></p> : <label className="adventure-commission-region"><span>前往地区</span><select value={region} onChange={event => setRegion(event.target.value as RegionId)}>{regionIds.map(id => <option key={id} value={id} disabled={!getRegionUnlocked(pet, id)}>{regions[id].name}{!getRegionUnlocked(pet, id) ? ' · 尚未解锁' : ''}</option>)}</select></label>}
      <div className="adventure-commission-quote"><p><Clock size={17} />实际耗时 <strong>{durationText(snapshot.durationMs)}</strong></p><p><Gift size={17} />额外 {regionalTreasures[treasure].name} ×1 <strong>{formatProbabilityPercent(snapshot.bonusChance)}</strong></p></div>
      {task && <section className="adventure-commission-task" aria-label="本次委托状态"><p className="adventure-commission-task-status">{ready ? '已返回 · 物资待领取' : `${pet.timePause ? '计时已暂停' : '外出搜集'} · 剩余 ${durationText(task.endsAt - now)}`}</p>
        {!ready && <progress aria-label={`${task.actorName}委托进度`} value={Math.max(0, Math.min(task.durationMs, now - task.startedAt))} max={task.durationMs} />}
        {ready && <><ul className="adventure-commission-items">{items(task.items)}</ul>{task.bonusItem && <div className="adventure-commission-bonus"><strong><Gift size={18} />额外发现</strong><ul className="adventure-commission-items">{items({ [task.bonusItem]: 1 })}</ul>{!task.bonusRemaining && <small>额外珍宝已领取</small>}</div>}</>}
      </section>}
      {!task && reason && <p className="exp-warning" role="status">{reason}</p>}
    </div>
    <footer className="adventure-commission-footer"><button type="button" className="secondary-button" onClick={onClose}>关闭</button>{task ? ready && <button type="button" className="primary-button" disabled={Boolean(pet.timePause)} onClick={() => update(current => claimAdventureCommission(current, task.id))}>领取物资</button> : <button type="button" className="primary-button" disabled={Boolean(reason)} onClick={() => { if (!reason && canStart) update(current => startAdventureCommission(current, selected.id, selected.name, region)); }}>交付 1 个金苹果</button>}</footer>
  </DialogShell>;
};
