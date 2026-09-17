import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Backpack, BookOpen, Check, Compass, Eye, Heart, Map, PackageOpen, RotateCw, ShoppingBag, Sparkles, Truck, Utensils, X, Zap } from 'lucide-react';
import { resolvePetStatusImages, unknownItemIcon } from '../assets';
import { adventureHallScene, getAdventureNodeScene } from './adventureScenes';
import { getBuiltinPetMod } from '../core/builtinPetMods';
import { advanceAdventure, canUseAdventureService, claimAdventureResult, claimAdventureStarter, getAdventureChoiceReason, getAdventureRewardPreview, returnFromAdventure, startAdventure } from '../core/adventure';
import { adventureActorIds, adventureBagCapacity, adventureDiscoveryNames, adventureStepCount, adventureTaskName, adventureTreasureRewardText, getAdventureSteps } from '../core/adventureData';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { getAdventureNodeStatus } from '../core/adventureMap';
import { getAdventureBagCount, isAdventureEntranceCompleteForDay } from '../core/adventureState';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { activityText as L } from '../core/kitchenRecipes';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { AdventureStorage, type AdventureStoragePanel } from './AdventureStorage';
import { DialogShell } from './DialogShell';
import { useAdventureAction } from './useAdventureAction';
import { AdventureMap, type AdventureMapSelection } from './AdventureMap';

interface Props {
  pet: PetState; actorId: string; actorName: string; portrait: string; happyPortrait?: string; registry: ItemRegistry; icons: Record<string, string>;
  update: (action: (pet: PetState) => PetState) => void;
  onBack: () => void; onKitchen: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
}
type Panel = AdventureStoragePanel | 'map' | 'journal' | 'result';
const actorNameFor = (id: string) => id === 'official.furo' ? 'Furo' : id === 'official.doro' ? 'Doro' : id === 'official.mint' ? 'mint' : L('伙伴', 'Companion');
const builtinPortrait = (id: string) => adventureActorIds.some(actor => actor === id) ? resolvePetStatusImages(getBuiltinPetMod(id)).content : undefined;

const AdventureStatMeter = ({ kind, label, value, max, icon, hint }: { kind: string; label: string; value: number; max: number; icon: ReactNode; hint?: string }) => {
  const amount = Math.max(0, Math.min(max, value));
  return <div className={'adventure-stat-meter adventure-stat-meter--' + kind}>
    <div className="adventure-stat-label"><span>{icon}{label}</span><b>{Math.floor(amount)}/{max}</b>{hint && <small>{hint}</small>}</div>
    <div className="adventure-stat-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={amount} aria-valuetext={`${Math.floor(amount)}/${max}`}><span style={{ width: `${max > 0 ? amount / max * 100 : 0}%` }} /></div>
  </div>;
};

export const AdventurePage = ({ pet, actorId, actorName, portrait, happyPortrait, registry, icons, update: commit, onBack: leave, onKitchen: kitchen, onBuy, onUseHomeItem }: Props) => {
  const trip = pet.adventure.active;
  const pending = pet.adventure.pending;
  const [panel, setPanelNow] = useState<Panel | undefined>(() => pending ? 'result' : getAdventureBagCount(trip?.loot ?? {}) ? 'loot' : undefined);
  const [landscape, setLandscape] = useState(false);
  const [panorama, setPanorama] = useState(false);
  const [mapSelection, setMapSelection] = useState<AdventureMapSelection>(() => ({ region: trip?.region ?? pending?.region ?? 'valley', node: 'entrance' }));
  const action = useAdventureAction();
  const animateActions = Boolean(trip) && panel !== 'map';
  const phase = animateActions ? action.phase : 'idle';
  const isBusy = () => animateActions && action.isBusy();
  const perform = (callback: () => void) => { action.run(callback, 'sway', animateActions); };
  const update = (callback: (pet: PetState) => PetState) => { action.run(() => commit(callback), 'walk', animateActions); };
  const setPanel = (value: Panel | undefined) => { action.run(() => setPanelNow(value), 'sway', animateActions && value !== 'map'); };
  const onBack = () => perform(leave);
  const onKitchen = () => perform(kitchen);
  const [bag, setBag] = useState<Inventory>({});
  const [tool, setTool] = useState(false);
  const [greeting, setGreeting] = useState('');
  const lootCount = getAdventureBagCount(trip?.loot ?? {});
  useEffect(() => { if (trip) { setBag({}); setTool(false); setMapSelection({ region: trip.region, node: 'entrance' }); setPanelNow(lootCount ? 'loot' : undefined); } }, [trip?.id]);
  // Open new finds once; switching panels never discards uncollected items.
  useEffect(() => { if (lootCount) setPanelNow('loot'); }, [trip?.id, trip?.choices.length]);
  useEffect(() => { if (pending) setPanelNow('result'); else setPanelNow(current => current === 'result' ? undefined : current); }, [pending?.id]);
  const steps = getAdventureSteps(trip?.rulesVersion);
  const step = trip ? steps[trip.choices.length] : undefined;
  const completed = trip?.choices.length ?? pending?.steps ?? 0;
  const carriedCount = trip ? getAdventureBagCount(trip.bag) : pending ? getAdventureBagCount(pending.items) - (pending.items.trail_rope ?? 0) : getAdventureBagCount(bag);
  const carriedTool = trip ? trip.tool : pending ? Boolean(pending.items.trail_rope) : tool;
  const neighbors = adventureActorIds.filter(id => id !== (trip?.actorId ?? actorId));
  const reward = getAdventureRewardPreview(pet);
  const services = canUseAdventureService(pet);
  const today = getEffectiveDailyDateKey(pet);
  const entranceComplete = isAdventureEntranceCompleteForDay(pet.adventure, 'valley', today);
  const changeBag = (id: ItemId, delta: number) => setBag(current => {
    const next = (current[id] ?? 0) + delta;
    if (next < 0 || delta > 0 && next > (pet.inventory[id] ?? 0) || getAdventureBagCount(current) + delta > adventureBagCapacity) return current;
    const result = { ...current, [id]: next };
    if (!next) delete result[id];
    return result;
  });
  const depart = () => update(current => startAdventure(current, 'valley', actorId, actorName, { ...bag }, tool));
  const returnHome = () => { if (lootCount) setPanel('loot'); else if (trip) update(current => returnFromAdventure(current, trip.id)); };
  const close = () => setPanel(undefined);
  const prepareSelectedNode = () => {
    if (!trip && !pending && mapSelection.region === 'valley' && getAdventureNodeStatus(pet.adventure, mapSelection.region, mapSelection.node, today) === 'available') setPanel('pack');
  };
  const dialog = (title: string, contents: ReactNode) => <DialogShell className="adventure-dialog" backdropClassName="adventure-modal-backdrop" labelId="adventure-dialog-title" onClose={close}>
    <header><h3 id="adventure-dialog-title">{title}</h3><button className="icon-button" onClick={close} aria-label={L('关闭，返回场景', 'Close and return to the scene')}><X size={20} /></button></header>
    <div className="adventure-dialog-body">{contents}</div>
  </DialogShell>;
  const storagePanel = panel && !['map', 'journal', 'result'].includes(panel) ? panel as AdventureStoragePanel : undefined;
  const travelingPortrait = !trip || trip.actorId === actorId ? portrait : builtinPortrait(trip.actorId);
  const shownPortrait = phase === 'settling' && (!trip || trip.actorId === actorId) ? happyPortrait ?? travelingPortrait : travelingPortrait;

  return <section className={'adventure-page' + (landscape ? ' adventure-page--landscape' : '') + (panorama ? ' adventure-page--panorama' : '')} data-action-phase={phase} data-motion={action.motion} aria-busy={phase !== 'idle'}
    onClickCapture={event => { if (isBusy()) { event.preventDefault(); event.stopPropagation(); } }}
    onChangeCapture={event => { if (isBusy()) { event.preventDefault(); event.stopPropagation(); } }}
    onKeyDownCapture={event => { if (isBusy() && ['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); } }}>
    <header className="adventure-hud">
      <div className="adventure-heading"><button className="icon-button" onClick={onBack} aria-label={L('返回小窝，保留探查进度', 'Back home; keep scouting progress')}><ArrowLeft size={21} /></button>
        {shownPortrait && <img className="adventure-buddy-image" src={shownPortrait} alt="" />}
        <h2>{trip || pending ? L('溪谷 · 入口附近探查', 'Creek Valley · Scout the entrance') : L('前哨基地 · 基地大厅', 'The outpost · Outpost hall')}</h2>
        <span className="adventure-wallet"><Heart size={15} />{pet.hearts} <span>{pet.coins} {L('金币', 'coins')}</span></span>
        {animateActions && <span className="adventure-action-status" role="status">{phase === 'acting' ? L('行动中…', 'In motion…') : phase === 'settling' ? L('准备好了', 'Ready') : ''}</span>}
      </div>
      <div className="adventure-hud-row">
        <div className="adventure-progress"><span>{L('已完成', 'Completed')} <b>{completed}/{adventureStepCount}</b></span><progress value={completed} max={adventureStepCount} aria-label={L('本次探查进度', 'Trip progress')} /></div>
        <div className="adventure-stats" aria-label={L('探索状态', 'Exploration status')}>
          <AdventureStatMeter kind="hunger" label={L('饱食', 'Hunger')} value={pet.hunger} max={getPetStatCap(pet)} icon={<Utensils size={14} />} />
          <AdventureStatMeter kind="energy" label={L('体力', 'Energy')} value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={14} />} />
          <AdventureStatMeter kind="bag" label={L('背包', 'Bag')} value={carriedCount} max={adventureBagCapacity} icon={<Backpack size={14} />} hint={`${L('工具', 'Tool')} ${Number(carriedTool)}/1`} />
        </div>
      </div>
    </header>
    <div className={trip ? 'adventure-stage adventure-scene--valley' : 'adventure-stage adventure-scene--hall'}>
      <img className="adventure-backdrop" src={trip ? getAdventureNodeScene(trip.region, 'entrance') : adventureHallScene} alt={trip ? L('溪谷入口的小溪、旧木桥与远处温室', 'The creek, old footbridge and distant greenhouse near the valley entrance') : L('有地图桌与补给架的木质大厅', 'A wooden hall with a map table and supply shelves')} />
      <nav className="adventure-toolbar" aria-label={L('冒险操作', 'Adventure actions')}>
        <button onClick={() => perform(() => setLandscape(value => !value))} aria-pressed={landscape}><RotateCw size={18} />{landscape ? L('自动方向', 'Auto orientation') : L('横屏查看', 'Landscape')}</button>
        <button onClick={() => perform(() => setPanorama(value => !value))} aria-pressed={panorama}><Eye size={18} />{panorama ? L('返回操作', 'Show actions') : L('看全景', 'Panorama')}</button>
        <button onClick={() => setPanel('map')}><Map size={18} />{L('总地图', 'Region map')}</button>
        <button onClick={() => setPanel('journal')}><BookOpen size={18} />{L('手账', 'Journal')}</button>
        {trip ? <><button onClick={() => setPanel('bag')}><Backpack size={18} />{L('背包', 'Bag')}</button>
          {lootCount > 0 && <button className="adventure-loot-alert" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('待拾取', 'Finds')} {lootCount}</button>}
          <button onClick={returnHome}><ArrowLeft size={18} />{L('免费返程', 'Return free')}</button></>
          : <>{pending && <button onClick={() => setPanel('result')}><PackageOpen size={18} />{L('领取行囊', 'Collect bag')}</button>}<button onClick={() => setPanel('pack')}><Backpack size={18} />{L('出发整备', 'Pack for the trip')}</button>{!pending && <><button onClick={() => setPanel('supplies')}><ShoppingBag size={18} />{L('补给', 'Supplies')}</button><button onClick={onKitchen}><Utensils size={18} />{L('厨房', 'Kitchen')}</button></>}</>}
      </nav>
      <div className="adventure-cast">
        <div className="adventure-actor adventure-actor--you">{shownPortrait && <img src={shownPortrait} alt={trip?.actorName ?? actorName} />}<span>{trip?.actorName ?? actorName}</span></div>
        {!trip && neighbors.map((id, index) => <button className={'adventure-actor adventure-neighbor adventure-neighbor--' + index} key={id} onClick={() => perform(() => setGreeting(actorNameFor(id) + L('：这趟要多带几份料理！途中遇见我，可以买补给，也可以请我从仓库送来物资。', ': Pack a few dishes! If we meet on the trail, I can sell supplies or deliver items from home.')))} aria-label={L('聊聊 · ', 'Talk with ') + actorNameFor(id)}><img src={builtinPortrait(id)} alt="" /><span>{actorNameFor(id)}</span></button>)}
        {trip?.neighborId && trip.choices.length === 4 && <div className="adventure-actor adventure-neighbor--encounter"><img src={builtinPortrait(trip.neighborId)} alt={actorNameFor(trip.neighborId)} /><span>{actorNameFor(trip.neighborId)}</span></div>}
      </div>
      <section className="adventure-dialogue" aria-label={L('当前事件与行动', 'Current event and actions')}>
        {trip ? <><div className="adventure-dialogue-heading"><h3>{services ? actorNameFor(trip.neighborId!) + ' · ' + L('路上遇见你', 'Good to see you') : step?.title ?? L('这一带的路已经记住了', 'You know these paths now')}</h3><small>{trip.rulesVersion >= 3 ? adventureTreasureRewardText(trip.rulesVersion) : <>{reward.hearts} {L('基础小心心', 'base hearts')} · {reward.coins} {L('金币', 'coins')}</>}</small></div>
          <p>{services ? L('我带了些补给，也能从家里送来物资，每份 2 小心心。先歇歇脚，再往前走吧。', 'I have supplies and can deliver items from home for 2 hearts each. Rest before moving on.') : step?.story ?? L('带着发现和未用完的补给，一起回到大厅吧。', 'Bring your discoveries and unused supplies back to the hall.')}</p>
          {services && <div className="adventure-service-actions"><button className="secondary-button" onClick={() => setPanel('shop')}><ShoppingBag size={17} />{L('看看随身补给', 'Browse supplies')}</button><button className="secondary-button" onClick={() => setPanel('delivery')}><Truck size={17} />{L('请伙伴运输', 'Request delivery')}</button></div>}
          {lootCount > 0 ? <button className="primary-button" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('先处理待拾取物资', 'Handle pending finds first')}</button> : <div className="adventure-choices">{step?.choices.map(choice => {
            const reason = getAdventureChoiceReason(pet, choice);
            return <button key={choice.id} disabled={Boolean(reason)} title={reason || choice.detail} onClick={() => update(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id))}><strong>{choice.label}<ArrowRight size={16} /></strong><small>{choice.detail}</small><span className="adventure-cost"><Utensils size={14} />−{choice.hunger}<Zap size={14} />−{choice.energy}</span>{reason && <small className="adventure-blocked">{reason}</small>}</button>;
          })}{!step && <button className="primary-button" onClick={returnHome}>{L('完成探查，返回大厅', 'Finish scouting and return')}</button>}</div>}
          {step && step.choices.every(choice => Boolean(getAdventureChoiceReason(pet, choice))) && !lootCount && <button className="text-button" onClick={() => setPanel('bag')}>{L('打开背包补给；也可免费返程', 'Open your bag to refuel, or return for free')}</button>}
        </> : <><h3>{pending ? L('平安归来', 'Welcome home') : entranceComplete ? L('今天的溪谷入口探查完成了', 'Today’s valley scouting is complete') : L('一起从溪谷入口出发', 'Explore the valley entrance together')}</h3><p>{greeting || (pending ? L('收好行囊和这趟探查的奖励吧。战利品可以在背包或出发整备中兑换金币。', 'Collect your supplies and rewards. Exchange treasure in your bag or trip preparation.') : entranceComplete ? L('每天可完成一次溪谷入口探查，凌晨 5 点刷新。先整理今天的发现，明天再来。', 'Complete valley entrance scouting once a day, resetting at 5 a.m. Sort today’s finds and return tomorrow.') : L('六段入口探查，每天可完成一次，凌晨 5 点刷新。通关获得小心心及随机战利品；未完成可以返程重试。', 'Six scouting steps, once a day with a 5 a.m. reset. Finish for hearts and a random treasure; unfinished trips can be retried.'))}</p>
          <div className="adventure-service-actions">{pending ? <button className="primary-button" onClick={() => setPanel('result')}><PackageOpen size={18} />{L('收好行囊', 'Collect everything')}</button> : <><button className="primary-button" onClick={() => setPanel('map')}><Map size={18} />{entranceComplete ? L('今日已完成 · 查看总地图', 'Done today · View region map') : L('查看总地图 · 选择节点', 'View region map · Choose a landmark')}</button>
            {(!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed) && <button className="secondary-button" onClick={() => update(claimAdventureStarter)}><Sparkles size={17} />{pet.adventure.starterClaimed ? L('补领胡萝卜蛋饭 ×4', 'Collect 4 carrot egg rice dishes') : L('领取入门补给 · 含料理 ×4', 'Collect starter supplies · 4 dishes included')}</button>}</>}</div>
        </>}
      </section>
      {storagePanel && <AdventureStorage key={storagePanel} panel={storagePanel} pet={pet} registry={registry} icons={icons} bag={bag} tool={tool} onPack={changeBag} onTool={setTool} onDepart={depart} onPanel={setPanel} onClose={close} onBuy={onBuy} onUseHomeItem={onUseHomeItem} update={update} perform={perform} />}
      {panel === 'map' && <AdventureMap adventure={pet.adventure} today={today} selection={mapSelection} portrait={shownPortrait} landscape={landscape} onToggleLandscape={() => perform(() => setLandscape(value => !value))} onSelect={selection => perform(() => setMapSelection(selection))} onPrepare={prepareSelectedNode} onResume={close} onCollect={() => setPanel('result')} onClose={close} />}
      {panel === 'journal' && dialog(L('旅行手账', 'Travel journal'), <><p>{L('溪谷的第一张地图', 'Your first valley map')}</p><div className="adventure-landmarks">{adventureDiscoveryNames().map((name, i) => <div key={name} data-found={pet.adventure.discoveries.includes('valley:' + i)}>{pet.adventure.discoveries.includes('valley:' + i) ? <Check size={17} /> : <Compass size={17} />}<span>{name}</span></div>)}</div><h4>{L('最近的旅途', 'Recent journeys')}</h4>{!pet.adventure.journal.length && <p>{L('收好第一趟行囊后，这里会留下记录。', 'Collect your first travel bag to record a journey.')}</p>}{pet.adventure.journal.map(entry => <article className="adventure-journal-entry" key={entry.id}><div><strong>{entry.actorName} · {adventureTaskName()}</strong><small>{entry.complete ? L('完成探查', 'Scouting complete') : L('提前返回', 'Returned early')} · {entry.steps}/6{entry.first ? L(' · 首次完成', ' · First completion') : ''}</small></div><span>♥ {entry.hearts} · {entry.coins} {L('金币', 'coins')}</span></article>)}</>)}
      {panel === 'result' && pending && dialog(L('本次探查结算', 'Trip rewards'), <><h4>{pending.complete ? L('入口附近，已经熟悉了', 'The entrance feels familiar now') : L('平安回来，也是一段旅程', 'A safe return is a journey too')}</h4><p>{pending.first ? L('首次完成的收获已列在下方。', 'Your first-completion rewards are listed below.') : L('保留所有已完成路段的收获。', 'Keep the rewards from every completed step.')}</p><div className="adventure-rewards"><span><Heart size={18} />{pending.hearts}</span>{pending.coins > 0 && <span>{pending.coins} {L('金币', 'coins')}</span>}{pending.rewardsClaimed && <small>{L('小心心与金币已到账', 'Hearts and coins received')}</small>}</div><h4>{L('收获与归还物资', 'Finds and returned supplies')}</h4><div className="adventure-item-list">{Object.entries(pending.items).filter(([, n]) => n > 0).map(([id, n]) => <span className="adventure-item-pill" key={id}><img src={icons[id] ?? unknownItemIcon} alt="" />{registry.get(id)?.name ?? id} ×{n}{isAdventureTreasure(id) && <small>{L('可兑换 ', 'Worth ')}{getAdventureTreasureValue(id) * n} {L('金币', 'coins')}</small>}</span>)}</div><div className="adventure-dialog-actions"><button className="primary-button" onClick={() => update(current => claimAdventureResult(current, pending.id))}><PackageOpen size={18} />{pending.rewardsClaimed ? L('领取剩余物资', 'Collect remaining supplies') : L('收好行囊', 'Collect everything')}</button><button className="secondary-button" onClick={() => setPanel('pack')}>{L('出发整备', 'Pack for the trip')}</button></div></>)}
    </div>
  </section>;
};
