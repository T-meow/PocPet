import { useId, useState } from 'react';
import { ArrowRight, CalendarDays, Heart, Users, X } from 'lucide-react';
import { farmNeighborCost, farmNeighborDays, getFarmNeighborStatus, hireFarmNeighbor } from '../../core/farmNeighbor';
import { shiftFarmNeighborDay } from '../../core/farmNeighborState';
import { getEffectiveDailyDateKey } from '../../core/gameClock';
import type { NeighborIdentity, PetState } from '../../core/petTypes';
import { DialogShell } from '../DialogShell';

export const FarmNeighborHelp = ({ pet, neighbors, update }: {
  pet: PetState; neighbors: readonly NeighborIdentity[]; update: (action: (pet: PetState) => PetState) => void;
}) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const status = getFarmNeighborStatus(pet);
  const expiresDay = shiftFarmNeighborDay(getEffectiveDailyDateKey(pet), farmNeighborDays);
  const cannotHire = Boolean(pet.timePause) || pet.hearts < farmNeighborCost || status.active;
  const shortfall = Math.max(0, Math.ceil(farmNeighborCost - pet.hearts));
  return <>
    <button type="button" className="community-neighbor-entry" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <Users size={21} aria-hidden="true" /><strong>{status.active ? '邻居帮忙中' : '雇佣邻居'}</strong><span>{status.active ? `剩余 ${status.remainingDays} 天` : <><Heart size={14} aria-hidden="true" />{farmNeighborCost} / {farmNeighborDays} 天</>}</span><ArrowRight size={16} aria-hidden="true" />
    </button>
    {open && <DialogShell className="farm-neighbor-dialog" backdropClassName="farm-neighbor-backdrop" labelId={titleId} onClose={() => setOpen(false)} historyNavigation>
      <header className="farm-neighbor-heading"><Users size={22} /><h2 id={titleId}>{status.active ? '邻居帮忙中' : '雇佣邻居'}</h2><button type="button" className="icon-button" aria-label="关闭雇佣面板" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="farm-neighbor-body">
        <div className="farm-neighbor-price">{status.active ? <><CalendarDays size={20} /><strong>剩余 {status.remainingDays} 天</strong></> : <><Heart size={20} /><strong>{farmNeighborCost} 心心</strong><span>/ {farmNeighborDays} 个游戏日</span></>}</div>
        <p className="farm-neighbor-expiry">服务至 {status.active ? status.expiresDay : expiresDay} 05:00</p>
        <p>代办菜地、果园、鸡舍和牛棚的日常农务，伙伴忙碌时也能播种、照料和收获。</p>
        <ul><li>动物照料不扣伙伴体力，材料与耐久照常消耗。</li><li>建设升级、厨房、钓鱼及货架操作仍需伙伴空闲。</li></ul>
        <p className="farm-neighbor-note">购买当天计第 1 天，05:00 换日；离线与冻结期间照常计日，到期后可重新雇佣。</p>
        {!status.active && <div className="farm-neighbor-balance"><span>现有 <Heart size={13} />{Math.floor(pet.hearts)}</span><span role="status">{pet.timePause ? '恢复时间后可雇佣' : shortfall > 0 ? `还差 ${shortfall} 心心` : ''}</span></div>}
      </div>
      <footer className="farm-neighbor-footer">{status.active ? <button type="button" className="primary-button" onClick={() => setOpen(false)}>知道了</button> : <><button type="button" className="secondary-button" onClick={() => setOpen(false)}>再看看</button><button type="button" className="primary-button" disabled={cannotHire} onClick={() => { update(current => hireFarmNeighbor(current, neighbors)); setOpen(false); }}>雇佣 · {farmNeighborCost} 心心</button></>}</footer>
    </DialogShell>}
  </>;
};
