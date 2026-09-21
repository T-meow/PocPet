import { acceptSpecialtyOrder, cancelSpecialtyOrder, canClaimSpecialtyOrder, claimSpecialtyOrder, getSpecialtyCandidates, specialtyDay, specialtyGoods } from '../../core/communitySpecialtyOrders';
import type { CommunityPanelProps } from './types';

export const CommunitySpecialtyOrders = ({ pet, update, onOpenOutpost, itemIconMap }: CommunityPanelProps) => {
  const state = pet.community.specialtyOrders, active = state.active, used = state.acceptedDay >= specialtyDay(pet);
  const candidates = getSpecialtyCandidates(pet);
  const busy = Boolean(pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active);
  return <section className="community-card specialty-board" aria-label="溪谷特产高价收购"><header><div><small>把远方的收获带给邻居</small><h3>今日特产收购</h3></div><b>{used ? '今日已接 1/1' : '今日可接 1 单'}</b></header>
    <p>每天 5 点公布 2 份收购单，任选 1 份；每 3 天有一份 5 倍急单。接取后价格锁定、不过期，可用库存交货，不叠加小摊加价。</p>
    <div className="specialty-order-grid">{(active ? [active, ...candidates.filter(q => q.id !== active.id)] : candidates).map(order => {
      const accepted = order.id === active?.id, have = pet.inventory[order.item] ?? 0, missing = Math.max(0, order.quantity - have);
      return <article key={order.id} className="specialty-order" data-urgent={order.multiplier === 5}><span className="specialty-rate">{order.multiplier} 倍{order.multiplier === 5 ? '急单' : '收购'}{accepted ? ' · 已锁价' : ''}</span>
        {itemIconMap?.[order.item] && <img src={itemIconMap[order.item]} alt="" />}<h4>{specialtyGoods[order.item].name} ×{order.quantity}</h4><strong>{order.unitPrice * order.quantity} 金币</strong><p>持有 {have} · {missing ? `还差 ${missing} 份` : '材料已齐'}</p>
        <div className="community-actions">{accepted ? <><button className="primary-button" disabled={busy || pet.timePause !== undefined || !canClaimSpecialtyOrder(pet)} onClick={() => update(p => claimSpecialtyOrder(p, order.id))}>交付并领取酬谢</button>{onOpenOutpost && <button className="secondary-button" onClick={() => onOpenOutpost({ view: 'idle', region: 'valley', target: order.item })}>安排采集{specialtyGoods[order.item].name}</button>}</> : <button className="secondary-button" disabled={used || Boolean(active) || Boolean(pet.timePause)} onClick={() => update(p => acceptSpecialtyOrder(p, order.id))}>{used ? '今天已接过收购单' : active ? '先完成手中的收购单' : '接下这份收购单'}</button>}</div>
        {accepted && <details className="community-abandon"><summary>放弃收购单</summary><p>放弃后不会返还今天的接单次数。</p><button className="text-button" onClick={() => update(p => cancelSpecialtyOrder(p, order.id))}>确认放弃</button></details>}
      </article>;
    })}</div>{!candidates.length && <p>完成踩点教学后开放；溪谷野菇、嫩笋和莲子可通过手动采集或挂机取得。</p>}
    <small>独立于邻里委托的每日 2 单；同时保留 1 份特产收购，交付后实际扣除材料。</small>
  </section>;
};
