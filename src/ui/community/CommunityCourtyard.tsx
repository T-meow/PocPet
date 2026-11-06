import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clock3, Gamepad2, Gift, HandHeart, Heart, History, MessageCircle, Sparkles, Utensils, Zap } from 'lucide-react';
import type { ItemId, ItemRegistry, PetState } from '../../core/petTypes';
import type { InstalledPetModSummary } from '../../core/mod';
import type { CourtyardAction, CourtyardContext, CourtyardRequest } from '../../core/courtyardTypes';
import { advanceCourtyard, claimCourtyardGifts, getCourtyardGreeting, getCourtyardInteractionReason, getCourtyardShareInfo, getCourtyardTime,
  interactCourtyard, isCourtyardOpen } from '../../core/courtyard';
import { courtyardActionBits, courtyardActionNames, courtyardActions, courtyardEnergyCosts, courtyardPremiumGifts } from '../../core/courtyardData';
import { getEffectiveDailyDateKey } from '../../core/gameClock';
import { getLocalCourtyardHistory } from '../../core/localPetHistory';
import { getInventoryItem, isBuiltinItemId } from '../../core/items';
import { getDish } from '../../core/kitchenRecipes';
import { rarityNames, rarityOrder } from '../../core/foodCatalog';
import { inventoryItemLimit } from '../../core/saveMetadata';
import { getPetEnergyCap } from '../../core/petStats';
import { itemIcons, unknownItemIcon } from '../../assets';
import { courtyardArtwork } from '../../courtyardAssets';
import { formatInteger, formatProbabilityPercent } from '../numberFormat';
import { getCompanionRoster } from '../companionRoster';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import '../../styles/courtyard.css';

const positions = [{ x: 25, y: 64 }, { x: 50, y: 77 }, { x: 76, y: 62 }];
const actionIcons = { chat: MessageCircle, play: Gamepad2, share: Utensils, help: HandHeart };
const actionDescriptions = { chat: '说说今天的小事 · 熟悉度 +2', play: '一起轻松玩一会儿 · 心情 +10 · 熟悉度 +5', share: '送出一份料理 · 收到一件回礼', help: '搭把手做点小事 · 心心 +10 · 熟悉度 +4' };
const remainingLabel = (ms: number) => {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60}分` : `${minutes}分钟`;
};

interface Props {
  pet: PetState;
  actorId: string;
  installedMods: readonly InstalledPetModSummary[];
  update: (action: (pet: PetState) => PetState) => void;
  onBack: () => void;
  registry?: ItemRegistry;
  itemIconMap?: Partial<Record<string, string>>;
}

export const CommunityCourtyard = ({ pet, actorId, installedMods, update, onBack, registry, itemIconMap }: Props) => {
  const [clock, setClock] = useState(Date.now);
  const [selected, setSelected] = useState<{ id: string; rotationId: string }>();
  const [view, setView] = useState<'actions' | 'food' | 'history'>('actions');
  const [notice, setNotice] = useState('');
  const [foodSearch, setFoodSearch] = useState('');
  const submitted = useRef<{ neighborId: string; action: CourtyardAction; after: number }>();
  const neighborRoster = useMemo(() => getCompanionRoster(installedMods).filter(neighbor => neighbor.id !== actorId), [installedMods, actorId]);
  const context = useMemo<CourtyardContext>(() => ({ actorId, neighbors: neighborRoster.map(neighbor =>
    ({ modId: neighbor.id, name: neighbor.name, favoriteFoodIds: neighbor.favoriteFoodIds })) }), [actorId, neighborRoster]);
  const state = pet.community.courtyard, time = getCourtyardTime(pet, clock), day = getEffectiveDailyDateKey(pet, time);
  const unlocked = isCourtyardOpen(pet);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (unlocked && !pet.timePause && (!state.rotationId || time >= state.nextRefreshAt || state.day !== day)) {
      update(current => advanceCourtyard(current, context, Date.now()));
    }
  }, [unlocked, Boolean(pet.timePause), time, day, state.rotationId, state.nextRefreshAt, state.day, context, update]);
  const visitors = state.visitorIds.flatMap((id, slot) => {
    const actor = neighborRoster.find(neighbor => neighbor.id === id && id !== actorId);
    return actor ? [{ actor, slot }] : [];
  });
  const neighbor = visitors.find(visitor => visitor.actor.id === selected?.id)?.actor;
  useEffect(() => {
    if (selected && (!neighbor || selected.rotationId !== state.rotationId || time >= state.nextRefreshAt)) {
      setSelected(undefined); setView('actions'); submitted.current = undefined;
      setNotice('这一轮邻居已经离开，新的来访正在小院里等你。');
    }
  }, [selected, neighbor, state.rotationId, state.nextRefreshAt, time]);
  const last = state.lastInteraction;
  useEffect(() => {
    if (last && submitted.current && last.sequence > submitted.current.after && last.neighborId === submitted.current.neighborId && last.action === submitted.current.action) {
      setView('actions'); setFoodSearch(''); submitted.current = undefined;
    }
  }, [last]);
  const name = (id: string) => registry?.get(id)?.name ?? getInventoryItem(id as ItemId)?.name ?? id;
  const icon = (id: string) => itemIconMap?.[id] ?? registry?.get(id)?.imageUrl ?? itemIcons[id as keyof typeof itemIcons] ?? unknownItemIcon;
  const requestFor = (action: CourtyardAction, foodId?: ItemId): CourtyardRequest => ({ neighborId: selected?.id ?? '', rotationId: selected?.rotationId ?? '', day: state.day, action, ...(foodId ? { foodId } : {}) });
  const execute = (action: CourtyardAction, foodId?: ItemId) => {
    const request = requestFor(action, foodId);
    submitted.current = { neighborId: request.neighborId, action, after: state.interactionsCount };
    update(current => interactCourtyard(current, context, request, Date.now()));
  };
  const openNeighbor = (id: string) => { setSelected({ id, rotationId: state.rotationId }); setView('actions'); setFoodSearch(''); setNotice(''); submitted.current = undefined; };
  const closeNeighbor = () => { setSelected(undefined); setView('actions'); submitted.current = undefined; };
  const mask = neighbor && state.day === day ? state.dailyInteractions[neighbor.id] ?? 0 : 0;
  const points = neighbor ? pet.community.relationships[neighbor.id]?.points ?? 0 : 0;
  const pending = Object.entries(state.pendingGifts);
  const canClaim = !pet.timePause && pending.some(([id]) => (pet.inventory[id] ?? 0) < inventoryItemLimit);
  const neighborContext = neighbor ? context.neighbors.find(value => value.modId === neighbor.id) : undefined;
  const foods = neighborContext && view === 'food' ? Object.entries(pet.inventory).flatMap(([id, quantity]) => {
    if (quantity <= 0 || !isBuiltinItemId(id)) return [];
    const info = getCourtyardShareInfo(id, neighborContext);
    return info && (!foodSearch.trim() || name(id).includes(foodSearch.trim())) ? [{ id, quantity, info }] : [];
  }).sort((a, b) => Number(b.info.favorite) - Number(a.info.favorite) || rarityOrder.indexOf(b.info.rarity) - rarityOrder.indexOf(a.info.rarity) || name(a.id).localeCompare(name(b.id))) : [];
  const history = neighbor && view === 'history' ? getLocalCourtyardHistory(pet).filter(entry => entry.neighborId === neighbor.id) : [];
  const result = neighbor && last?.neighborId === neighbor.id ? last : undefined;

  return <section className="community-page courtyard-page">
    <header className="community-header"><button type="button" className="icon-button" onClick={onBack} aria-label="返回小窝"><ArrowLeft /></button><div><small>让相遇成为日常</small><h2>社区小院</h2></div><span className="community-energy" aria-label={`体力 ${formatInteger(pet.energy)}/${getPetEnergyCap(pet)}`}><Zap size={16} />{formatInteger(pet.energy)}/{getPetEnergyCap(pet)}</span></header>
    <div className="courtyard-intro"><div><small>树荫、花香，还有刚好遇见的邻居</small><h1>来小院，坐一会儿吧。</h1></div><span><Clock3 size={16} />{pet.timePause ? '时间已暂停' : state.rotationId ? `${remainingLabel(state.nextRefreshAt - time)}后换一轮来访` : '邻居正在路上'}</span></div>
    <div className="courtyard-scene-card"><div className="courtyard-scene" aria-label="社区小院场景">
      <img className="courtyard-background" src={courtyardArtwork.background} alt="树荫、长椅和茶桌围绕着一片宁静的小院草地" />
      {visitors.map(({ actor, slot }) => {
        const done = state.day === day ? courtyardActions.filter(action => (state.dailyInteractions[actor.id] ?? 0) & courtyardActionBits[action]).length : 0;
        return <button type="button" key={actor.id} className="courtyard-neighbor" style={{ left: `${positions[slot].x}%`, top: `${positions[slot].y}%` }} onClick={() => openNeighbor(actor.id)} aria-haspopup="dialog" aria-label={`${actor.name}，打开邻居互动，今日已完成${done}项`}>
          <span className="courtyard-neighbor-portrait"><img src={actor.portrait} alt="" /></span><strong>{actor.name}</strong><small>{done === 4 ? <><Check size={12} />今天相处过啦</> : <><MessageCircle size={12} />点一下聊聊 · {done}/4</>}</small>
        </button>;
      })}
    </div><footer><MessageCircle size={16} /><span>点击邻居开始互动。每位邻居的四项互动每天各一次，凌晨 5 点重置。</span></footer></div>
    {notice && <p className="courtyard-notice" role="status">{notice}</p>}
    {!unlocked && <p className="courtyard-notice">完成第一次踩点后，小院会免费开放。</p>}
    {unlocked && state.rotationId && !visitors.length && <p className="courtyard-notice">这一轮暂时没有可见的邻居，下一轮再来看看吧。新加入的角色会从下一轮开始参与来访。</p>}
    <div className="courtyard-about"><span><Heart size={17} />熟悉度会让问候和回应慢慢变化</span><span><Clock3 size={17} />每 4 小时随机来访，最多 3 位</span></div>
    {pending.length > 0 && <section className="courtyard-pending"><header><div><small>心意会一直等你</small><h3><Gift size={20} />待领取的回礼</h3></div><button type="button" className="primary-button" disabled={!canClaim} onClick={() => update(claimCourtyardGifts)}>领取可收下的回礼</button></header><div className="courtyard-pending-items">{pending.map(([id, amount]) => <span key={id}><img src={icon(id)} alt="" /><span>{name(id)} ×{formatInteger(amount)}</span></span>)}</div><p>单种物品存满时，回礼会留在这里；邻居离开或跨日也不会丢失。</p></section>}
    {neighbor && selected && <CommunityDetailDialog title={neighbor.name} eyebrow="社区小院 · 邻里相处" onClose={closeNeighbor} className="courtyard-dialog">
      <div className="courtyard-profile"><img src={neighbor.portrait} alt="" /><div><span className="courtyard-familiarity"><Heart size={16} />熟悉度 {formatInteger(points)}</span><p>{getCourtyardGreeting(pet, neighbor.id)}</p><small>今日互动 {courtyardActions.filter(action => mask & courtyardActionBits[action]).length}/4 · 凌晨 5 点重置</small></div></div>
      {view !== 'actions' && <button type="button" className="courtyard-back" onClick={() => { setView('actions'); setFoodSearch(''); }}><ArrowLeft size={16} />返回互动</button>}
      {view === 'actions' && <>
        <div className="courtyard-actions">{courtyardActions.map(action => {
          const Icon = actionIcons[action], used = Boolean(mask & courtyardActionBits[action]);
          const reason = getCourtyardInteractionReason(pet, context, requestFor(action), time);
          return <button type="button" key={action} disabled={Boolean(reason)} title={reason || actionDescriptions[action]} onClick={() => action === 'share' ? setView('food') : execute(action)}>
            <span className="courtyard-action-heading"><Icon size={22} /><b>{courtyardActionNames[action]}</b>{used && <Check size={16} />}</span><span>{used ? '今天已经进行过' : actionDescriptions[action]}</span><small>{used ? '明天再来' : courtyardEnergyCosts[action] ? `消耗 ${courtyardEnergyCosts[action]} 体力` : action === 'share' ? '消耗 1 份成品料理' : '不消耗体力'}</small>
          </button>;
        })}</div>
        {(() => { const reason = courtyardActions.map(action => getCourtyardInteractionReason(pet, context, requestFor(action), time)).find(reason => reason && !reason.startsWith('今天已经')); return reason ? <p className="courtyard-notice">{reason}</p> : null; })()}
        {result && <section className="courtyard-result" role="status"><h3><Sparkles size={18} />{result.title}</h3><p>{result.text}</p><div className="courtyard-result-stats"><span>熟悉度 +{result.points}</span>{result.energy > 0 && <span>体力 −{result.energy}</span>}{result.mood > 0 && <span>心情 +{formatInteger(result.mood)}</span>}{result.hearts > 0 && <span>小心心 +{result.hearts}</span>}</div>{result.rewardId && <div className="courtyard-reward" data-premium={result.premium}><img src={icon(result.rewardId)} alt="" /><div><small>{result.premium ? '珍贵的心意' : '邻居的回礼'}</small><strong>{name(result.rewardId)} ×1</strong><span>{result.pending && (state.pendingGifts[result.rewardId] ?? 0) > 0 ? '已保留在待领取回礼中' : '已收入仓库'}</span></div></div>}</section>}
        <details className="courtyard-preferences"><summary>食物喜好{neighbor.favoriteFoodIds?.length ? ` · ${neighbor.favoriteFoodIds.length} 种` : ''}</summary><p>小院只分享厨房成品料理；其中喜欢的料理按传说档计算回礼。</p><div>{neighbor.favoriteFoodIds?.length ? neighbor.favoriteFoodIds.map(id => <span key={id} data-dish={Boolean(getDish(id))}><img src={icon(id)} alt="" />{name(id)}</span>) : <p>这位邻居还没有登记特别喜欢的食物，按料理本身的稀有度计算。</p>}</div></details>
        <button type="button" className="courtyard-history-button" onClick={() => setView('history')}><History size={17} />看看相处记录<ChevronRight size={16} /></button>
      </>}
      {view === 'food' && <section className="courtyard-food-picker"><h3>分享一份料理</h3><p>每次送出 1 份，收到 1 件回礼。喜欢的料理按传说档计算，高级池概率为 35%。</p><label className="courtyard-search">搜索仓库料理<input type="search" value={foodSearch} onChange={event => setFoodSearch(event.target.value)} placeholder="料理名称" /></label>
        <div className="courtyard-food-list">{foods.length ? foods.map(food => <article key={food.id}><img src={icon(food.id)} alt="" /><div><strong>{name(food.id)}</strong><small>持有 {formatInteger(food.quantity)} 份{food.info.favorite ? ' · 喜欢的料理' : ` · ${rarityNames[food.info.rarity]}`}</small><span>高级回礼 {formatProbabilityPercent(food.info.premiumChance)} · 熟悉度 +{food.info.points}</span></div><button type="button" className="secondary-button" disabled={Boolean(getCourtyardInteractionReason(pet, context, requestFor('share', food.id), time))} onClick={() => execute('share', food.id)}>分享 1 份</button></article>) : <p className="courtyard-empty">{foodSearch ? '没有找到这道料理。' : '仓库里还没有成品料理，去厨房做一份再来吧。'}</p>}</div>
        <details className="courtyard-gift-rules"><summary>看看回礼规则</summary><p>普通、优良、稀有、珍奇、传说料理进入高级池的概率依次为 2%、5%、10%、20%、35%。喜欢的料理按传说档计算。</p><p>普通池的料理和道具各占一半，每件基础价值 50～500 金币。</p><p>高级池：{courtyardPremiumGifts.map(name).join('、')}，六种等概率，不受地区解锁限制。</p></details>
      </section>}
      {view === 'history' && <section className="courtyard-history"><h3>和{neighbor.name}的相处记录</h3><p>记录保存在这台设备，小院最多保留最近 200 条；熟悉度随存档保留。</p>{history.length ? <ol>{history.map(entry => <li key={entry.id}><div><strong>{entry.title}</strong><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><p>{entry.text}</p><small>熟悉度 +{entry.points}{entry.rewardId ? ` · 回礼：${name(entry.rewardId)}` : ''}</small></li>)}</ol> : <p className="courtyard-empty">相处之后，留下一点今天的记忆吧。</p>}</section>}
    </CommunityDetailDialog>}
  </section>;
};
