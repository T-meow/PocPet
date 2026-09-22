import { acceptSpecialtyOrder, cancelSpecialtyOrder, canClaimSpecialtyOrder, claimSpecialtyOrder, getSpecialtyCandidates, specialtyDay, specialtyGoods } from '../../core/communitySpecialtyOrders';
import { newItemIcons } from '../../newItemIconAssets';
import { CommunityBoardNote } from './CommunityBoardNote';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import type { CommunityPanelProps } from './types';

export const CommunitySpecialtyOrders = ({ pet, update, onOpenOutpost, itemIconMap, selected, onSelect, onClose }: CommunityPanelProps & {
  selected: string | null; onSelect: (id: string) => void; onClose: () => void;
}) => {
  const state = pet.community.specialtyOrders, active = state.active, used = state.acceptedDay >= specialtyDay(pet);
  const candidates = getSpecialtyCandidates(pet);
  const orders = active ? [active, ...candidates.filter(order => order.id !== active.id)] : candidates;
  const order = orders.find(value => value.id === selected);
  const busy = Boolean(pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active);
  const frozen = pet.timePause !== undefined;
  const accepted = Boolean(order && order.id === active?.id);
  const have = order ? pet.inventory[order.item] ?? 0 : 0;
  const missing = order ? Math.max(0, order.quantity - have) : 0;
  const icon = (item: keyof typeof specialtyGoods) => itemIconMap?.[item] ?? newItemIcons[item];
  return <>
    {orders.map(value => {
      const inProgress = value.id === active?.id, ready = inProgress && canClaimSpecialtyOrder(pet);
      const kind = value.multiplier === 5 ? '急单' : '收购';
      return <CommunityBoardNote key={value.id} summary={`收购${specialtyGoods[value.item].name} ×${value.quantity}`}
        label={`${kind} · ${ready ? '可交付' : inProgress ? '已锁价' : used ? '今日已接' : '待接取'}`}
        art={<img src={icon(value.item)} alt="" />} tone={value.multiplier === 5 ? 'peach' : 'cream'}
        active={inProgress} ready={ready} onClick={() => onSelect(value.id)} />;
    })}
    {order && <CommunityDetailDialog title={`收购${specialtyGoods[order.item].name} ×${order.quantity}`}
      eyebrow={`${order.multiplier} 倍${order.multiplier === 5 ? '急单' : '收购'} · ${accepted ? '已锁价 · 不过期' : used ? '今日已接过收购单' : '今日候选'}`} onClose={onClose}>
      <div className="community-letter">
        <img className="community-letter-item" src={icon(order.item)} alt="" />
        <p>邻居想收一份溪谷特产，可用库存交货；交付时扣除材料，收购价不叠加小摊加价。</p>
        <p className="community-letter-reward">酬谢：{order.rewardCoins ?? order.unitPrice * order.quantity} 金币</p>
      </div>
      <p>持有 {have} · {missing ? `还差 ${missing} 份` : '材料已齐'}</p>
      <div className="community-actions">{accepted ? <>
        <button className="primary-button" disabled={busy || frozen || !canClaimSpecialtyOrder(pet)} onClick={() => { update(p => claimSpecialtyOrder(p, order.id)); onClose(); }}>交付并领取酬谢</button>
        {onOpenOutpost && <button className="secondary-button" onClick={() => onOpenOutpost({ view: 'idle', region: 'valley', target: order.item })}>安排采集{specialtyGoods[order.item].name}</button>}
      </> : <button className="primary-button" disabled={used || Boolean(active) || frozen} onClick={() => { update(p => acceptSpecialtyOrder(p, order.id)); onClose(); }}>{used ? '今天已接过收购单' : active ? '先完成手中的收购单' : '接下这份收购单'}</button>}</div>
      {accepted && <details className="community-abandon"><summary>放弃收购单</summary><p>放弃后不会返还今天的接单次数。</p><button className="text-button" disabled={frozen} onClick={() => { update(p => cancelSpecialtyOrder(p, order.id)); onClose(); }}>确认放弃</button></details>}
    </CommunityDetailDialog>}
  </>;
};
