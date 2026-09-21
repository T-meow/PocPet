import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Backpack, BookOpen, Clock, Compass, Ellipsis, Eye, Heart, LockKeyhole, Map, PackageOpen, RotateCw, ShoppingBag, Sparkles, Truck, Utensils, X, Zap } from 'lucide-react';
import { resolvePetStatusImages, unknownItemIcon } from '../assets';
import { adventureHallScene, getAdventureNodeScene } from './adventureScenes';
import { getBuiltinPetMod } from '../core/builtinPetMods';
import { advanceAdventure, canUseAdventureService, claimAdventureResult, claimAdventureStarter, getAdventureChoiceReason, getAdventureChoicePreview, getAdventureRewardPreview, returnFromAdventure, startAdventure } from '../core/adventure';
import { ExplorationChoiceDetails, ExplorationCheckSummary, ExplorationCheckBuffs } from './ExplorationCheck';
import { adventureActorIds, adventureTaskName, adventureJourneyName, adventureJourneyDetail, adventureTreasureRewardText, adventureTutorialRewardText, getAdventureStepCount, getAdventureSteps } from '../core/adventureData';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { ExplorationSupport } from './expedition/ExplorationSupport';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { getAdventureNodeStatus } from '../core/adventureMap';
import { getAdventureBagCount, isAdventureEntranceCompleteForDay, isAdventureMapUnlocked } from '../core/adventureState';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { activityText as L } from '../core/kitchenRecipes';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { AdventureStorage, type AdventureStoragePanel } from './AdventureStorage';
import { DialogShell } from './DialogShell';
import { useAdventureAction } from './useAdventureAction';
import { AdventureMap, type AdventureMapSelection } from './AdventureMap';
import { adventureHealthRules } from '../core/adventureReturn';
import { getPetStatRatio } from '../core/petStats';
import type { CommunityRoute } from '../core/communityTypes';
import { deliverCommunityParcel, getCommunityTasks } from '../core/communityCommissions';
import { AdventureReturnSelection } from './AdventureReturnSelection';
import { getAdventureRouteNode, isAtCommunityBridge, isValleyQuest, valleyQuestForNode, valleyQuests, type ValleyQuestId } from '../core/valleyQuests';
import { ExpeditionPanel } from './expedition/ExpeditionPanel';
import { TravelJournal } from './TravelJournal';
import { currentExpeditionRequest, initialOutpostRequest, mapRegionForExpedition, type OutpostRequest } from './outpostNavigation';
import type { RegionId } from '../core/expeditionTypes';
import { AdventureStatMeter } from './AdventureStatMeter';

interface Props {
  pet: PetState; actorId: string; actorName: string; portrait: string; happyPortrait?: string; registry: ItemRegistry; icons: Record<string, string>;
  update: (action: (pet: PetState) => PetState) => void;
  onBack: () => void; onKitchen: () => void;
  communityRoute?: CommunityRoute;
  onCommunity?: () => void;
  initialOutpost?: OutpostRequest;
  onShop?: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
}
type Panel = AdventureStoragePanel | 'map' | 'journal' | 'result' | 'task' | 'expedition';
const actorNameFor = (id: string) => id === 'official.furo' ? 'Furo' : id === 'official.doro' ? 'Doro' : id === 'official.mint' ? 'mint' : L('伙伴', 'Companion');
const builtinPortrait = (id: string) => adventureActorIds.some(actor => actor === id) ? resolvePetStatusImages(getBuiltinPetMod(id)).content : undefined;

export const AdventurePage = ({ pet, actorId, actorName, portrait, happyPortrait, registry, icons, update: commit, onBack: leave, onKitchen: kitchen, onBuy, onUseHomeItem, communityRoute, onCommunity, initialOutpost, onShop }: Props) => {
  const trip = pet.adventure.active;
  const pending = pet.adventure.pending;
  const entry = initialOutpostRequest(pet, initialOutpost);
  const [panel, setPanelNow] = useState<Panel | undefined>(() => entry ? entry.view === 'journal' ? 'journal' : 'expedition' : pending ? 'result' : getAdventureBagCount(trip?.loot ?? {}) ? 'loot' : communityRoute && !trip ? 'pack' : undefined);
  const [outpostRequest, setOutpostRequest] = useState<Exclude<OutpostRequest, { view: 'journal' }>>(() => entry && entry.view !== 'journal' ? entry : { view: 'idle', region: 'valley' });
  const expedition = pet.community.expedition;
  const expeditionBusy = Boolean(expedition.active || expedition.pending);
  const [purpose, setPurpose] = useState<CommunityRoute | undefined>(communityRoute);
  const [visiting, setVisiting] = useState<ValleyQuestId>();
  const [landscape, setLandscape] = useState(false);
  const [panorama, setPanorama] = useState(false);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const outpostReturnToMap = useRef(false);
  const [selection, setSelection] = useState<AdventureMapSelection | 'tutorial'>();
  const mapSelection = selection === 'tutorial' ? undefined : selection;
  const destination = purpose ? 'valley' : selection === 'tutorial' ? 'tutorial' : mapSelection?.node ? mapSelection.region : undefined;
  const mapUnlocked = isAdventureMapUnlocked(pet.adventure);
  const action = useAdventureAction();
  const capacity = getExplorationBagCapacity(pet), phase = action.phase;
  const perform = (callback: () => void) => callback();
  const update = commit;
  const move = (callback: (pet: PetState) => PetState) => action.run(() => commit(current => {
    const live = current.adventure.active;
    if (current.timePause || live?.id !== trip?.id || live?.choices.length !== trip?.choices.length) return current;
    if (live && live.rulesVersion >= 9 && live.revision !== trip?.revision) return current;
    return callback(current);
  }), 'walk');
  const setPanel = setPanelNow;
  const onBack = () => { action.cancel(); leave(); };
  const onKitchen = () => { action.cancel(); kitchen(); };
  const openOutpost = (request: OutpostRequest) => {
    action.cancel();
    if (panel === 'map') outpostReturnToMap.current = true;
    else if (panel !== 'expedition' && panel !== 'journal') outpostReturnToMap.current = false;
    if (request.view === 'journal') setPanelNow('journal');
    else { setOutpostRequest(request); setPanelNow('expedition'); }
  };
  const openRegionMap = (region: RegionId = 'valley') => {
    action.cancel(); outpostReturnToMap.current = false; setPurpose(undefined); setSelection({ region: mapRegionForExpedition[region] }); setPanelNow('map');
  };
  const closeMore = () => {
    if (!moreRef.current?.open) return;
    moreRef.current.open = false;
    moreRef.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  const fromMore = (callback: () => void) => { closeMore(); callback(); };
  const [bag, setBag] = useState<Inventory>({});
  const [tool, setTool] = useState(false);
  const [greeting, setGreeting] = useState('');
  const lootCount = getAdventureBagCount(trip?.loot ?? {});
  useEffect(() => { action.cancel(); setSelection(undefined); setBag({}); setTool(false); if (trip) { setPurpose(undefined); setVisiting(undefined); setPanelNow(current => current === 'expedition' || current === 'journal' ? current : lootCount ? 'loot' : undefined); } }, [trip?.id]);
  // Open new finds once; switching panels never discards uncollected items.
  useEffect(() => { if (lootCount) setPanelNow('loot'); }, [trip?.id, trip?.choices.length]);
  useEffect(() => { if (pending) setPanelNow(current => current === 'journal' ? current : 'result'); else setPanelNow(current => current === 'result' ? undefined : current); }, [pending?.id]);
  const currentDestination = trip?.region ?? pending?.region ?? destination;
  const steps = getAdventureSteps(trip?.rulesVersion, currentDestination, trip?.purpose ?? pending?.purpose ?? purpose, pet.community.expedition.regions.valley.base, trip?.bag);
  const stepCount = getAdventureStepCount(currentDestination, trip?.purpose ?? pending?.purpose ?? purpose);
  const step = trip ? steps[trip.choices.length] : undefined;
  const completed = trip?.choices.length ?? pending?.steps ?? 0;
  const carriedCount = trip ? getAdventureBagCount(trip.bag) : pending ? getAdventureBagCount(pending.items) - (pending.items.trail_rope ?? 0) : getAdventureBagCount(bag);
  const neighbors = adventureActorIds.filter(id => id !== (trip?.actorId ?? actorId));
  const reward = getAdventureRewardPreview(pet);
  const services = canUseAdventureService(pet);
  const today = getEffectiveDailyDateKey(pet);
  const entranceComplete = isAdventureEntranceCompleteForDay(pet.adventure, 'valley', today);
  const changeBag = (id: ItemId, delta: number) => setBag(current => {
    const next = (current[id] ?? 0) + delta;
    if (next < 0 || delta > 0 && next > (pet.inventory[id] ?? 0) || getAdventureBagCount(current) + delta > capacity) return current;
    const result = { ...current, [id]: next };
    if (!next) delete result[id];
    return result;
  });
  const depart = () => move(current => startAdventure(current, destination, actorId, actorName, { ...bag }, tool, Date.now(), purpose));
  const returnHome = () => { if (lootCount) setPanel('loot'); else if (trip) move(current => returnFromAdventure(current, trip.id)); };
  const close = () => { if (!trip) { setSelection(undefined); setPurpose(undefined); } setPanel(undefined); };
  const closeOutpost = () => {
    if (outpostReturnToMap.current && mapUnlocked) { outpostReturnToMap.current = false; setPanel('map'); }
    else close();
  };
  const prepareSelectedNode = () => {
    if (!trip && !pending && mapSelection?.node && getAdventureNodeStatus(pet.adventure, mapSelection.region, mapSelection.node, today) === 'available') {
      setPurpose(mapSelection.region === 'valley' ? valleyQuestForNode(mapSelection.node) : undefined);
      setPanel('pack');
    }
  };
  const selectTutorial = () => perform(() => { setPurpose(undefined); setSelection('tutorial'); setPanelNow('pack'); });
  const dialog = (title: string, contents: ReactNode) => <DialogShell className="adventure-dialog" backdropClassName="adventure-modal-backdrop" labelId="adventure-dialog-title" onClose={close}>
    <header><h3 id="adventure-dialog-title">{title}</h3><button className="icon-button" onClick={close} aria-label={L('关闭，返回场景', 'Close and return to the scene')}><X size={20} /></button></header>
    <div className="adventure-dialog-body">{contents}</div>
  </DialogShell>;
  const storagePanel = panel && !['map', 'journal', 'result', 'task', 'expedition'].includes(panel) ? panel as AdventureStoragePanel : undefined;
  const storageDialog = storagePanel && <AdventureStorage key={storagePanel} panel={storagePanel} pet={pet} registry={registry} icons={icons} bag={bag} tool={tool} destination={destination} purpose={purpose} onPack={changeBag} onTool={setTool} onDepart={depart} onPanel={setPanel} onClose={close} onBuy={onBuy} onUseHomeItem={onUseHomeItem} update={update} perform={perform} />;
  const travelingPortrait = !trip || trip.actorId === actorId ? portrait : builtinPortrait(trip.actorId);
  const shownPortrait = phase === 'settling' && (!trip || trip.actorId === actorId) ? happyPortrait ?? travelingPortrait : travelingPortrait;
  const expeditionMinutes = Math.max(0, Math.ceil(((expedition.active?.endsAt ?? 0) - Date.now()) / 60000));
  const expeditionLabel = expedition.pending ? '领取旅途物资' : expedition.active ? expedition.active.mode === 'idle' ? '查看挂机行程' : '继续当前巡路' : '挂机出发';
  const expeditionHint = expedition.pending ? '已回到前哨 · 收获待领取' : expedition.active ? expedition.active.mode === 'idle' ? `剩余 ${Math.floor(expeditionMinutes / 60)} 小时 ${expeditionMinutes % 60} 分` : expedition.active.paused ? '已在营地暂停 · 随时继续' : '保留行囊与当前进度' : '2／4／8 小时 · 带回物资';

  const preparingIdle = panel === 'expedition' && !expeditionBusy && outpostRequest.view === 'idle';
  const expeditionDialog = panel === 'expedition' && <ExpeditionPanel pet={pet} registry={registry} icons={icons} onUseHomeItem={onUseHomeItem} actorId={actorId} actorName={actorName} portrait={portrait} update={update} request={outpostRequest} onClose={closeOutpost} onNavigate={openOutpost} onMap={region => mapUnlocked ? openRegionMap(region) : selectTutorial()} onCommunity={onCommunity ?? onBack} onKitchen={onKitchen} onShop={onShop ?? (() => setPanel('supplies'))} />;

  return <><div className="adventure-viewport"><section className={'adventure-page' + (landscape ? ' adventure-page--landscape' : '') + (panorama ? ' adventure-page--panorama' : '')} data-action-phase={phase} data-motion={action.motion}>
    <header className="adventure-hud">
      <div className="adventure-heading"><button className="icon-button" onClick={onBack} aria-label={L('返回小窝，保留探查进度', 'Back home; keep scouting progress')}><ArrowLeft size={21} /></button>
        <h2>{trip || pending ? adventureJourneyName(currentDestination, trip?.purpose ?? pending?.purpose) : visiting ? valleyQuests[visiting].name : L('前哨基地 · 基地大厅', 'The outpost · Outpost hall')}</h2>
        <span className="adventure-wallet"><Heart size={15} />{pet.hearts} <span>{pet.coins} {L('金币', 'coins')}</span></span>
        {(trip || phase !== 'idle') && <span className="adventure-action-status" role="status">{phase === 'acting' ? L('行动中…', 'In motion…') : phase === 'settling' ? L('准备好了', 'Ready') : ''}</span>}
      </div>
      <div className="adventure-hud-row">
        <div className="adventure-progress">{currentDestination ? <><span>{L('已完成', 'Completed')} <b>{completed}/{stepCount}</b></span><progress value={completed} max={stepCount} aria-label={L('本次探查进度', 'Trip progress')} /></> : <span><Compass size={16} />{expeditionBusy ? expeditionHint : L('请先选择目的地', 'Choose a destination first')}</span>}</div>
        <div className="adventure-stats" aria-label={L('探索状态', 'Exploration status')}>
          <AdventureStatMeter kind="hunger" label={L('饱食', 'Hunger')} value={pet.hunger} max={getPetStatCap(pet)} icon={<Utensils size={14} />} />
          <AdventureStatMeter kind="energy" label={L('体力', 'Energy')} value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={14} />} />
          <AdventureStatMeter kind="health" label="健康" value={pet.health} max={getPetStatCap(pet)} icon={<Heart size={14} />} />
          <AdventureStatMeter kind="mood" label="心情" value={pet.mood} max={getPetStatCap(pet)} icon={<Sparkles size={14} />} />
          <AdventureStatMeter kind="bag" label={L('背包', 'Bag')} value={carriedCount} max={capacity} icon={<Backpack size={14} />} />
        </div>
      </div>
    </header>
    {pending?.returnReason === 'health' && <p className="adventure-health-warning" role="status">健康不足，已安全返程。</p>}
    {trip && trip.rulesVersion < 9 && getPetStatRatio(pet, 'mood') < adventureHealthRules.lowMood && <p className="adventure-health-warning">心情低于 30%，部分支路暂不开放，可以用心情用品或选择普通路线。</p>}
    <div className={trip || visiting ? 'adventure-stage adventure-scene--valley' : 'adventure-stage adventure-scene--hall'}>
      <nav className="adventure-toolbar" aria-label={L('冒险操作', 'Adventure actions')}>
        <button disabled={!mapUnlocked} aria-label={mapUnlocked ? L('总地图', 'Region map') : L('总地图未解锁', 'World map locked')} title={!mapUnlocked ? L('完成踩点探索后解锁大地图', 'Complete the tutorial to unlock the world map') : undefined} onClick={() => setPanel('map')}>{mapUnlocked ? <Map size={18} /> : <LockKeyhole size={18} />}{L('地图', 'Map')}</button>
        {trip ? <><button onClick={() => setPanel('bag')}><Backpack size={18} />{L('背包', 'Bag')}</button>
          {lootCount > 0 && <button className="adventure-loot-alert" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('待拾取', 'Finds')} {lootCount}</button>}
          <button onClick={returnHome} aria-label={L('免费返程', 'Return free')}><ArrowLeft size={18} />{L('返程', 'Return')}</button></>
          : <>{pending && <button onClick={() => setPanel('result')}><PackageOpen size={18} />{L('领取行囊', 'Collect bag')}</button>}<button disabled={Boolean(pending) || expeditionBusy} onClick={() => setPanel('pack')}><Backpack size={18} />{L('出发整备', 'Pack for the trip')}</button></>}
        {panorama && <button onClick={() => perform(() => setPanorama(false))}><Eye size={18} />{L('返回操作', 'Show actions')}</button>}
        <details className="adventure-more" ref={moreRef}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeMore(); } }}>
          <summary><Ellipsis size={18} />{L('更多', 'More')}</summary>
          <div className="adventure-more-actions">
            {(trip || pending) && <button onClick={() => fromMore(() => setPanel('journal'))}><BookOpen size={18} />旅行日志</button>}
            <button onClick={() => fromMore(() => perform(() => setLandscape(value => !value)))} aria-pressed={landscape}><RotateCw size={18} />{landscape ? L('自动方向', 'Auto orientation') : L('横屏查看', 'Landscape')}</button>
            {!panorama && <button onClick={() => fromMore(() => perform(() => setPanorama(true)))}><Eye size={18} />{L('看全景', 'Panorama')}</button>}
            {!trip && !pending && <><button onClick={() => fromMore(() => setPanel('supplies'))}><ShoppingBag size={18} />{L('补给', 'Supplies')}</button><button onClick={() => fromMore(onKitchen)}><Utensils size={18} />{L('厨房', 'Kitchen')}</button></>}
          </div>
        </details>
      </nav>
      <div className="adventure-content">
      <div className="adventure-scene-view"><div className="adventure-scene-canvas">
      <img className="adventure-backdrop" src={trip ? getAdventureNodeScene(trip.region === 'tutorial' ? 'valley' : trip.region, getAdventureRouteNode(trip.purpose)) : visiting ? getAdventureNodeScene('valley', valleyQuests[visiting].node) : adventureHallScene} alt={trip ? adventureJourneyName(trip.region, trip.purpose) + '场景' : visiting ? valleyQuests[visiting].name + '场景' : L('有地图桌与补给架的木质大厅', 'A wooden hall with a map table and supply shelves')} />
      <div className="adventure-cast">
        <div className="adventure-actor adventure-actor--you">{shownPortrait && <img src={shownPortrait} alt={trip?.actorName ?? actorName} />}<span>{trip?.actorName ?? actorName}</span></div>
        {!trip && !visiting && neighbors.map((id, index) => <button className={'adventure-actor adventure-neighbor adventure-neighbor--' + index} key={id} onClick={() => perform(() => setGreeting(actorNameFor(id) + L('：这趟要多带几份料理！途中遇见我，可以买补给，也可以请我从仓库送来物资。', ': Pack a few dishes! If we meet on the trail, I can sell supplies or deliver items from home.')))} aria-label={L('聊聊 · ', 'Talk with ') + actorNameFor(id)}><img src={builtinPortrait(id)} alt="" /><span>{actorNameFor(id)}</span></button>)}
        {trip?.neighborId && trip.choices.length === 4 && <div className="adventure-actor adventure-neighbor--encounter"><img src={builtinPortrait(trip.neighborId)} alt={actorNameFor(trip.neighborId)} /><span>{actorNameFor(trip.neighborId)}</span></div>}
      </div>
      </div></div>
      <section className="adventure-dialogue" aria-label={L('当前事件与行动', 'Current event and actions')}>
        {trip && <ExplorationSupport pet={pet} system="adventure" update={update} move={move} busy={phase !== 'idle'} />}
        <ExplorationCheckBuffs state={trip?.checkState} />
        <ExplorationCheckSummary result={trip?.checkState?.last ?? pending?.lastCheck} />
        {!trip && !pending && <nav className="adventure-outpost-actions" aria-label="前哨常用功能"><button onClick={() => openOutpost(currentExpeditionRequest(pet) ?? { view: 'idle', region: 'valley' })}><Clock size={21} /><span><strong>{expeditionLabel}</strong><small>{expeditionHint}</small></span></button><button onClick={() => setPanel('journal')}><BookOpen size={21} /><span><strong>旅行日志</strong><small>旅途记录 · 故事与发现</small></span></button></nav>}
        {!trip && !pending && mapUnlocked && <div className="adventure-service-actions"><span>溪谷故事 {pet.adventure.valleyCompleted.length}/7</span>{onCommunity && <button className="secondary-button" onClick={onCommunity}>回农场 · 建设与委托</button>}</div>}
        {trip?.purpose && !isValleyQuest(trip.purpose) && <p>{adventureJourneyDetail(trip.purpose)}</p>}
        {trip?.region === 'valley' && getCommunityTasks(pet).filter(task => task.template === 'delivery' && !task.found).map(task => <div className="community-note" key={task.id}><p>旧桥送餐：在旧桥任务或委托短途送达，消耗行囊便当 ×1。行囊便当：{trip.bag.bento ?? 0}</p><button className="secondary-button" disabled={!isAtCommunityBridge(trip) || !(trip.bag.bento ?? 0)} onClick={() => update(p => deliverCommunityParcel(p, task.id, trip.id, trip.revision))}>将便当交给守望者</button></div>)}
        {trip ? <><div className="adventure-dialogue-heading"><h3>{services ? actorNameFor(trip.neighborId!) + ' · ' + L('路上遇见你', 'Good to see you') : step?.title ?? L('这一带的路已经记住了', 'You know these paths now')}</h3><button className="adventure-task-button" onClick={() => setPanel('task')}>{L('任务详情', 'Task details')}</button></div>
          <p>{services ? L('我带了些补给，也能从家里送来物资，每份 2 小心心。先歇歇脚，再往前走吧。', 'I have supplies and can deliver items from home for 2 hearts each. Rest before moving on.') : step?.story ?? L('带着发现和未用完的补给，一起回到大厅吧。', 'Bring your discoveries and unused supplies back to the hall.')}</p>
          {services && <div className="adventure-service-actions"><button className="secondary-button" onClick={() => setPanel('shop')}><ShoppingBag size={17} />{L('看看随身补给', 'Browse supplies')}</button><button className="secondary-button" onClick={() => setPanel('delivery')}><Truck size={17} />{L('请伙伴运输', 'Request delivery')}</button></div>}
          {lootCount > 0 ? <button className="primary-button" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('先处理待拾取物资', 'Handle pending finds first')}</button> : <div className="adventure-choices">{step?.choices.map(choice => {
            const reason = getAdventureChoiceReason(pet, choice);
            const preview = getAdventureChoicePreview(pet, choice);
            if (preview && choice.check) return <button key={choice.id} disabled={phase !== 'idle' || Boolean(reason)} title={reason || choice.detail} onClick={() => move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision))}><strong>{choice.label}</strong><small>{choice.detail}</small><ExplorationChoiceDetails pet={pet} preview={preview} definition={choice.check} hunger={choice.hunger} reason={reason} /></button>;
            return <button key={choice.id} disabled={phase !== 'idle' || Boolean(reason)} title={reason || choice.detail} onClick={() => move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision))}><span className="adventure-choice-heading"><strong>{choice.label}</strong><span className="adventure-cost"><Utensils size={14} />−{choice.hunger}<Zap size={14} />−{choice.energy}<ArrowRight size={14} /></span></span><small>{choice.detail}</small>{Boolean(choice.health || choice.mood) && <small>健康 {(choice.health ?? 0) >= 0 ? '+' : ''}{choice.health ?? 0} · 心情 {(choice.mood ?? 0) >= 0 ? '+' : ''}{choice.mood ?? 0}</small>}{pet.health + (choice.health ?? 0) < getPetStatCap(pet) * adventureHealthRules.retreat && <small className="adventure-blocked">完成此行动后将安全返回。</small>}{reason && <small className="adventure-blocked">{reason}</small>}</button>;
          })}{!step && <button className="primary-button" onClick={returnHome}>{L('完成探查，返回大厅', 'Finish scouting and return')}</button>}</div>}
          {step && step.choices.every(choice => Boolean(getAdventureChoiceReason(pet, choice))) && !lootCount && <button className="text-button" onClick={() => setPanel('bag')}>{L('打开背包补给；也可免费返程', 'Open your bag to refuel, or return for free')}</button>}
        </> : visiting && !pending ? <><h3>重访 · {valleyQuests[visiting].name}</h3><p>{valleyQuests[visiting].steps[2].story}</p><p>{valleyQuests[visiting].outcome}</p><div className="adventure-service-actions"><button className="primary-button" onClick={() => setPanel('map')}><Map size={18} />看看下一处目的地</button><button className="secondary-button" onClick={() => setVisiting(undefined)}>返回基地大厅</button>{onCommunity && <button className="secondary-button" onClick={onCommunity}>回农场</button>}</div></> : <><h3>{pending ? L('平安归来', 'Welcome home') : expeditionBusy ? '旅途安排已记下' : L('这次想去哪里？', 'Where shall we go?')}</h3><p>{greeting || (expeditionBusy ? expedition.pending ? '这一趟的收获已运回前哨，可以领取物资，再安排下一次出发。' : '当前进度会一直保留。打开行程继续巡路或查看挂机情况，也可以先翻翻旅行日志。' : pending ? L('收好行囊和这趟探查的奖励吧。战利品可以在背包或出发整备中兑换金币。', 'Collect your supplies and rewards. Exchange treasure in your bag or trip preparation.') : !mapUnlocked ? L('先从附近的「踩点探索」开始：四个节点，熟悉路线和行囊操作。通关并收好发现后，再展开大地图。', 'Start close to home with the four-stop tutorial. Learn the route and travel bag, then collect your finds to open the world map.') : entranceComplete ? L('今天的溪谷入口探查已完成，凌晨 5 点刷新。', 'Today’s valley scouting is complete and resets at 5 a.m.') + '地图里的七段故事仍可继续；也可以回农场修复、生产或接取委托短途。' : L('可以先打开出发整备整理行囊，再到大地图选择目的地。选好去处后，就能带着准备好的物资出发。', 'You can pack your bag first, then choose a destination on the world map. Once you choose where to go, set out with your prepared supplies.'))}</p>
          {!pending && !mapUnlocked && <div className="adventure-tutorial-card"><strong><Compass size={18} />{adventureTaskName('tutorial')}<small>{L('新手关 · 4 个节点', 'Tutorial · 4 stops')}</small></strong><p>{adventureTutorialRewardText()}</p><small>{L('全程饱食 32、体力 8，无需额外道具；未完成可返程重试。', '32 hunger and 8 energy in total; no extra items needed. Unfinished trips can be retried.')}</small></div>}
          <div className="adventure-service-actions">{pending ? <button className="primary-button" onClick={() => setPanel('result')}><PackageOpen size={18} />{L('收好行囊', 'Collect everything')}</button> : <>{mapUnlocked ? <button className="primary-button" onClick={() => setPanel('map')}><Map size={18} />{L('查看总地图 · 选择目的地', 'View world map · Choose a destination')}</button> : <button className="primary-button" onClick={selectTutorial}><Compass size={18} />{L('选择踩点探索 · 整备', 'Choose tutorial · Prepare')}</button>}
            {(!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed) && <button className="secondary-button" onClick={() => update(claimAdventureStarter)}><Sparkles size={17} />{pet.adventure.starterClaimed ? L('补领胡萝卜蛋饭 ×4', 'Collect 4 carrot egg rice dishes') : L('领取入门补给 · 含料理 ×4', 'Collect starter supplies · 4 dishes included')}</button>}</>}</div>
        </>}
      </section>
      </div>
      {storagePanel !== 'pack' && storageDialog}
      {panel === 'result' && pending?.salvage && dialog('健康不足，已安全返程', <><ExplorationCheckSummary result={pending.lastCheck} /><AdventureReturnSelection key={pending.id} capacity={capacity} result={pending} registry={registry} update={update} /></>)}
      {panel === 'map' && mapUnlocked && <AdventureMap adventure={pet.adventure} pet={pet} onOutpost={openOutpost} today={today} selection={mapSelection} portrait={shownPortrait} landscape={landscape} onToggleLandscape={() => perform(() => setLandscape(value => !value))} onSelect={value => perform(() => { setPurpose(undefined); setSelection(value); })} onPrepare={prepareSelectedNode} onVisit={id => { if (pet.adventure.valleyCompleted.includes(id)) { setVisiting(id); setPurpose(undefined); setSelection(undefined); setPanel(undefined); } }} onResume={close} onCollect={() => setPanel('result')} onClose={close} />}
      {panel === 'task' && trip && dialog(L('任务详情', 'Task details'), <><h4>{adventureJourneyName(trip.region, trip.purpose)}</h4><p>{trip.purpose ? adventureJourneyDetail(trip.purpose) : trip.region === 'tutorial' ? adventureTutorialRewardText() : trip.rulesVersion >= 3 ? adventureTreasureRewardText(trip.rulesVersion) : <>{reward.hearts} {L('基础小心心', 'base hearts')} · {reward.coins} {L('金币', 'coins')}</>}</p></>)}
      {panel === 'result' && pending && !pending.salvage && dialog(L('本次探查结算', 'Trip rewards'), <><ExplorationCheckSummary result={pending.lastCheck} /><h4>{pending.complete ? pending.region === 'tutorial' ? L('踩点探索完成，大地图就在眼前', 'Tutorial complete: the world map awaits') : pending.purpose ? adventureJourneyName(pending.region, pending.purpose) + ' · 已完成' : L('入口附近，已经熟悉了', 'The entrance feels familiar now') : L('平安回来，也是一段旅程', 'A safe return is a journey too')}</h4><p>{pending.region === 'tutorial' && pending.complete ? L('收好这次发现，地图手册将带你去往更远的地方。一堆金币可以在背包中兑换为 360 金币。', 'Collect your finds and let the map handbook guide you farther. Exchange the coin hoard in your inventory for 360 coins.') : pending.first ? L('首次完成的收获已列在下方。', 'Your first-completion rewards are listed below.') : L('保留所有已完成路段的收获。', 'Keep the rewards from every completed step.')}</p><div className="adventure-rewards">{pending.hearts > 0 && <span><Heart size={18} />{pending.hearts}</span>}{pending.coins > 0 && <span>{pending.coins} {L('金币', 'coins')}</span>}{pending.rewardsClaimed && <small>{L('奖励已结算', 'Rewards received')}</small>}</div><h4>{L('收获与归还物资', 'Finds and returned supplies')}</h4><div className="adventure-item-list">{Object.entries(pending.items).filter(([, n]) => n > 0).map(([id, n]) => <span className="adventure-item-pill" key={id}><img src={icons[id] ?? unknownItemIcon} alt="" />{registry.get(id)?.name ?? id} ×{n}{isAdventureTreasure(id) && <small>{L('可兑换 ', 'Worth ')}{getAdventureTreasureValue(id) * n} {L('金币', 'coins')}</small>}</span>)}</div><div className="adventure-dialog-actions"><button className="primary-button" onClick={() => update(current => claimAdventureResult(current, pending.id))}><PackageOpen size={18} />{pending.rewardsClaimed ? L('领取剩余物资', 'Collect remaining supplies') : L('收好行囊', 'Collect everything')}</button><button className="secondary-button" onClick={close}>{L('返回大厅', 'Return to the hall')}</button></div></>)}
    </div>
    {storagePanel === 'pack' && storageDialog}
    {preparingIdle && expeditionDialog}
  </section></div>
    {!preparingIdle && expeditionDialog}
    {panel === 'journal' && <TravelJournal pet={pet} onClose={closeOutpost} onMap={() => mapUnlocked ? openRegionMap() : selectTutorial()} onReceipt={system => system === 'adventure' ? setPanel('result') : openOutpost(currentExpeditionRequest(pet) ?? { view: 'idle', region: 'valley' })} />}
  </>;
};
