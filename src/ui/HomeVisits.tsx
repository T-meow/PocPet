import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, ChevronRight, Clock3, DoorOpen, Gamepad2, Gift, Heart, House, UserPlus, Utensils, Zap } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import type { InstalledPetModSummary } from '../core/mod';
import type { CourtyardContext } from '../core/courtyardTypes';
import type { HomeVisitGift } from '../core/homeVisitState';
import { advanceHomeVisit, claimHomeVisitGift, dismissHomeNeighbor, getHomeInviteReason, getHomeVisitReason, homeVisitInvitePoints,
  homeVisitPlayEnergy, hostHomeNeighbor, inviteHomeNeighbor, type HomeVisitRequest } from '../core/homeVisit';
import { getCourtyardShareInfo, getCourtyardTime, isCourtyardOpen } from '../core/courtyard';
import { canSpendCompanionTime } from '../core/kitchen';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { getInventoryItem, isBuiltinItemId } from '../core/items';
import { inventoryItemLimit } from '../core/saveMetadata';
import { itemIcons, unknownItemIcon } from '../assets';
import { getCompanionRoster } from './companionRoster';
import { formatProbabilityPercent } from './numberFormat';
import { CommunityDetailDialog } from './community/CommunityDetailDialog';
import type { RoomVisitor } from './PetDisplay';
import '../styles/home-visits.css';

interface Props {
  pet: PetState;
  actorId: string;
  installedMods: readonly InstalledPetModSummary[];
  update: (action: (pet: PetState) => PetState) => void;
  children: (visitor?: RoomVisitor) => ReactNode;
}
type VisitDialog = { view: 'guest' | 'food'; request: HomeVisitRequest } | { view: 'invite' | 'gifts' };
const itemName = (id: string) => isBuiltinItemId(id) ? getInventoryItem(id)?.name ?? id : id;
const itemIcon = (id: string) => itemIcons[id as keyof typeof itemIcons] ?? unknownItemIcon;
const minutesLeft = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 60_000));

export const HomeVisits = ({ pet, actorId, installedMods, update, children }: Props) => {
  const [clock, setClock] = useState(Date.now);
  const [dialog, setDialog] = useState<VisitDialog>();
  const [query, setQuery] = useState('');
  const [received, setReceived] = useState<HomeVisitGift>();
  const invited = useRef<string>();
  const collecting = useRef<{ id: string; gift: HomeVisitGift }>();
  const roster = useMemo(() => getCompanionRoster(installedMods), [installedMods]);
  const context = useMemo<CourtyardContext>(() => ({ actorId, neighbors: roster.map(neighbor =>
    ({ modId: neighbor.id, name: neighbor.name, favoriteFoodIds: neighbor.favoriteFoodIds })) }), [actorId, roster]);
  const state = pet.community.homeVisit, unlocked = isCourtyardOpen(pet), time = getCourtyardTime(pet, clock);
  const day = getEffectiveDailyDateKey(pet, time), active = state.active;
  const guest = active && time < active.leavesAt && active.neighborId !== actorId ? roster.find(neighbor => neighbor.id === active.neighborId) : undefined;
  const request = dialog && 'request' in dialog ? dialog.request : undefined;
  const progress = guest && state.day === day ? state.daily[guest.id] ?? {} : {};
  const pending = Object.entries(state.pending);
  const currentReward = progress.reward ? state.pending[progress.reward] : undefined;
  const busy = !canSpendCompanionTime(pet);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  useEffect(() => {
    if (!unlocked || pet.timePause || document.visibilityState !== 'visible') return;
    if (state.day !== day || active && time >= active.leavesAt || !active && !busy && time >= state.nextCheckAt) {
      update(current => advanceHomeVisit(current, context, Date.now()));
    }
  }, [unlocked, Boolean(pet.timePause), state.day, day, active, time, busy, state.nextCheckAt, context, update]);
  useEffect(() => {
    if (request && (!guest || request.visitId !== active?.id || request.day !== day)) setDialog(undefined);
  }, [request, guest, active?.id, day]);
  useEffect(() => {
    if (invited.current && active?.neighborId === invited.current) { invited.current = undefined; setDialog(undefined); }
    if (dialog?.view === 'food' && progress.foodId) setDialog({ view: 'guest', request: dialog.request });
    if (collecting.current && !state.pending[collecting.current.id]) {
      setReceived(collecting.current.gift); collecting.current = undefined;
    }
  }, [active, dialog, progress.foodId, state.pending]);
  const openGuest = () => {
    if (!active || !guest) return;
    setReceived(undefined); setQuery(''); setDialog({ view: 'guest', request: { visitId: active.id, neighborId: guest.id, day: state.day } });
  };
  const open = (view: 'invite' | 'gifts') => { setReceived(undefined); setQuery(''); setDialog({ view }); };
  const close = () => { setDialog(undefined); setQuery(''); invited.current = undefined; collecting.current = undefined; };
  const collect = (id: string) => {
    const gift = state.pending[id]; if (!gift) return;
    collecting.current = { id, gift };
    update(current => claimHomeVisitGift(current, id));
  };
  const reason = request ? getHomeVisitReason(pet, context, request, time) : '';
  const neighborContext = context.neighbors.find(neighbor => neighbor.modId === guest?.id);
  const foods = dialog?.view === 'food' && neighborContext ? Object.entries(pet.inventory).flatMap(([id, quantity]) => {
    if (quantity < 1 || !isBuiltinItemId(id)) return [];
    const info = getCourtyardShareInfo(id, neighborContext);
    return info && (!query.trim() || itemName(id).includes(query.trim())) ? [{ id, quantity, info }] : [];
  }).sort((left, right) => Number(right.info.favorite) - Number(left.info.favorite) || right.info.premiumChance - left.info.premiumChance || itemName(left.id).localeCompare(itemName(right.id))) : [];
  const candidates = roster.filter(neighbor => neighbor.id !== actorId).sort((left, right) =>
    (pet.community.relationships[right.id]?.points ?? 0) - (pet.community.relationships[left.id]?.points ?? 0) || left.name.localeCompare(right.name));
  const reveal = received && <div className="home-visit-received" role="status"><img src={itemIcon(received.itemId)} alt="" /><div><small>{received.premium ? '收到了珍贵回礼' : '谢谢今天的招待'}</small><strong>{itemName(received.itemId)} ×1</strong><span>已经放进仓库啦。</span></div></div>;

  return <>{children(guest ? { name: guest.name, portrait: guest.portrait, onOpen: openGuest } : undefined)}
    {unlocked && <div className="home-visit-strip">
      {guest && active ? <button type="button" className="home-visit-presence" onClick={openGuest}><House size={17} /><span><strong>{guest.name}来做客</strong><small>还会坐 {minutesLeft(active.leavesAt, time)} 分钟 · 点击招待</small></span><ChevronRight size={16} /></button>
        : <span className="home-visit-quiet"><House size={17} />留一张椅子，等朋友来坐坐</span>}
      <div className="home-visit-tools"><button type="button" onClick={() => open('invite')}><UserPlus size={15} />邀请邻居</button>
        {pending.length > 0 && <button type="button" onClick={() => open('gifts')} className="home-visit-gift-notice"><Gift size={15} />回礼 {pending.length}</button>}</div>
    </div>}
    {dialog && createPortal(<CommunityDetailDialog className="home-visit-dialog" title={dialog.view === 'invite' ? '邀请邻居来坐坐' : dialog.view === 'gifts' ? '邻居留下的回礼' : dialog.view === 'food' ? '今天一起吃什么' : `${guest?.name ?? '邻居'}来做客`} eyebrow="小窝里的相聚时光" onClose={close}>
      {dialog.view === 'invite' ? <>
        <p className="home-visit-intro">熟悉度达到 {homeVisitInvitePoints}，就可以邀请邻居到家里玩。每次来访停留 1 小时。</p>
        {active && time < active.leavesAt && <div className="home-visit-existing"><p>家里已经有客人，先和对方道别后再邀请吧。</p><button type="button" className="secondary-button" disabled={Boolean(pet.timePause)} onClick={() => update(current => dismissHomeNeighbor(current, active.id))}><DoorOpen size={16} />送客</button></div>}
        <div className="home-invite-list">{candidates.map(neighbor => {
          const points = pet.community.relationships[neighbor.id]?.points ?? 0, blocked = getHomeInviteReason(pet, context, neighbor.id, time);
          const completed = state.day === day && state.daily[neighbor.id]?.reward;
          return <article key={neighbor.id}><img src={neighbor.portrait} alt="" /><div><strong>{neighbor.name}</strong><span><Heart size={13} />熟悉度 {points}</span><small>{points < homeVisitInvitePoints ? `还差 ${homeVisitInvitePoints - points} 点，去小院相处吧` : completed ? '今日招待已完成，仍可邀请来坐坐' : '今天可以一起吃饭、玩耍'}</small></div><button type="button" className="primary-button" disabled={Boolean(blocked)} title={blocked} onClick={() => { invited.current = neighbor.id; update(current => inviteHomeNeighbor(current, context, neighbor.id)); }}>邀请</button></article>;
        })}</div>
        {!candidates.length && <p className="home-visit-empty">角色库里暂时没有其他邻居。</p>}
        {pet.timePause || busy ? <p className="home-visit-hint">{pet.timePause ? '恢复时间后再邀请邻居。' : '伙伴正在休息或忙碌，空闲后再邀请吧。'}</p> : null}
      </> : dialog.view === 'gifts' ? <>
        <p className="home-visit-intro">吃饭和玩耍都完成后，邻居会留下一份回礼。离开、跨日后也能领取。</p>{reveal}
        <div className="home-visit-gifts">{pending.map(([id, gift]) => {
          const full = (pet.inventory[gift.itemId] ?? 0) >= inventoryItemLimit;
          return <article key={id}><Gift size={28} /><div><strong>{roster.find(neighbor => neighbor.id === gift.neighborId)?.name ?? '邻居'}的回礼</strong><small>{gift.day} · 一份相聚的心意</small>{full && <small>仓库放不下，整理后再领取</small>}</div><button type="button" className="primary-button" disabled={Boolean(pet.timePause) || full} onClick={() => collect(id)}>领取</button></article>;
        })}</div>{!pending.length && !received && <p className="home-visit-empty">暂时没有待领取的拜访回礼。</p>}
      </> : guest && request && active ? <>
        {dialog.view === 'food' && <button type="button" className="home-visit-back" onClick={() => setDialog({ view: 'guest', request })}><ArrowLeft size={16} />返回招待</button>}
        <div className="home-visit-profile"><img src={guest.portrait} alt="" /><div><strong>{guest.name}</strong><span><Heart size={14} />熟悉度 {pet.community.relationships[guest.id]?.points ?? 0}</span><small><Clock3 size={13} />还会坐 {minutesLeft(active.leavesAt, time)} 分钟</small></div><span className="home-visit-tag">来做客</span></div>
        {dialog.view === 'food' ? <>
          <p className="home-visit-intro">选一份厨房成品料理一起分享，消耗 1 份。喜欢的料理按传说档计算回礼概率。</p>
          <label className="home-visit-search">找一道料理<input value={query} onChange={event => setQuery(event.target.value)} placeholder="输入料理名称" /></label>
          <div className="home-visit-foods">{foods.map(food => <article key={food.id}><img src={itemIcon(food.id)} alt="" /><div><strong>{itemName(food.id)}</strong><span>{food.info.favorite ? '♥ 喜欢的料理 · ' : ''}高级回礼 {formatProbabilityPercent(food.info.premiumChance)}</span><small>库存 {food.quantity} 份</small></div><button type="button" className="primary-button" disabled={Boolean(reason)} onClick={() => update(current => hostHomeNeighbor(current, context, request, 'eat', food.id))}>一起吃 ×1</button></article>)}</div>
          {!foods.length && <p className="home-visit-empty">{query ? '没有找到这道料理。' : '还没有厨房成品料理，先去做一道好吃的吧。'}</p>}
        </> : <>
          <p className="home-visit-greeting">“来你的小窝坐一会儿，今天想一起做点什么？”</p>
          <div className="home-host-actions"><button type="button" disabled={Boolean(reason) || Boolean(progress.foodId)} onClick={() => { setQuery(''); setDialog({ view: 'food', request }); }}><span><Utensils size={22} /><strong>一起吃</strong>{progress.foodId && <Check size={18} />}</span><small>{progress.foodId ? `已分享${itemName(progress.foodId)}` : '消耗一份料理，一起尝尝好味道'}</small></button>
            <button type="button" disabled={Boolean(reason) || Boolean(progress.played) || pet.energy < homeVisitPlayEnergy} onClick={() => update(current => hostHomeNeighbor(current, context, request, 'play'))}><span><Gamepad2 size={22} /><strong>一起玩</strong>{progress.played && <Check size={18} />}</span><small>{progress.played ? '今天已经一起开心玩过啦' : `体力 −${homeVisitPlayEnergy} · 心情 +10`}</small>{!progress.played && pet.energy < homeVisitPlayEnergy && <small><Zap size={12} />体力不足</small>}</button></div>
          <div className="home-host-reward"><div><Gift size={22} /><strong>{progress.reward ? currentReward ? '一份回礼，感谢今天的招待' : '今日拜访回礼已领取' : `今日招待 ${Number(Boolean(progress.foodId)) + Number(Boolean(progress.played))}/2`}</strong></div><p>{progress.reward ? '每位邻居每天一份回礼，明天再一起玩吧。' : '一起吃、一起玩都完成后，就能收下邻居的回礼。'}</p>
            {currentReward && progress.reward && <button type="button" className="primary-button" disabled={Boolean(pet.timePause) || (pet.inventory[currentReward.itemId] ?? 0) >= inventoryItemLimit} onClick={() => collect(progress.reward!)}>{(pet.inventory[currentReward.itemId] ?? 0) >= inventoryItemLimit ? '仓库已满 · 回礼已保留' : '领取拜访回礼'}</button>}
          </div>{reveal}
          <button type="button" className="home-visit-farewell" disabled={Boolean(pet.timePause)} onClick={() => update(current => dismissHomeNeighbor(current, request.visitId))}><DoorOpen size={16} />送客，下次再来</button>
        </>}
        {reason && <p className="home-visit-hint" role="status">{reason}</p>}
      </> : null}
    </CommunityDetailDialog>, document.querySelector('.ui-v2-app') ?? document.body)}
  </>;
};
