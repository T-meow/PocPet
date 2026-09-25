import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Backpack, BookOpen, Clock, Compass, Ellipsis, Eye, Heart, LockKeyhole, Map, PackageOpen, RotateCw, ShoppingBag, Sparkles, Truck, Utensils, X, Zap } from 'lucide-react';
import { resolvePetStatusImages, unknownItemIcon } from '../assets';
import { adventureHallScene, getAdventureNodeScene } from './adventureScenes';
import type { InstalledPetModSummary } from '../core/mod';
import { hashString } from '../core/utils';
import { advanceAdventure, canUseAdventureService, claimAdventureResult, claimAdventureStarter, getAdventureChoiceReason, getAdventureChoicePreview, returnFromAdventure, startAdventure } from '../core/adventure';
import { ExplorationChoiceDetails, ExplorationCheckSummary, ExplorationCheckBuffs } from './ExplorationCheck';
import { adventureTaskName, adventureJourneyName, adventureTutorialRewardText, getAdventureStepCount, getAdventureSteps } from '../core/adventureData';
import { getAdventureStageChoices } from '../core/adventureGathering';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { getExplorationBudget } from '../core/explorationBudget';
import { ExplorationSupport } from './expedition/ExplorationSupport';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { getAdventureBagCount, isAdventureMapUnlocked } from '../core/adventureState';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import { activityText as L } from '../core/kitchenRecipes';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import { AdventureStorage, type AdventureStoragePanel } from './AdventureStorage';
import { DialogShell } from './DialogShell';
import { useAdventureAction } from './useAdventureAction';
import { AdventureMap, type AdventureMapSelection } from './AdventureMap';
import { AdventureMapLandscape } from './AdventureMapLandscape';
import { adventureHealthRules } from '../core/adventureReturn';
import { getPetStatRatio } from '../core/petStats';
import type { CommunityRoute } from '../core/communityTypes';
import { deliverCommunityParcel, getCommunityTasks } from '../core/communityCommissions';
import { AdventureReturnSelection } from './AdventureReturnSelection';
import { getAdventureRouteNode } from '../core/valleyQuests';
import { ExpeditionPanel } from './expedition/ExpeditionPanel';
import { TravelJournal } from './TravelJournal';
import { currentExpeditionRequest, initialOutpostRequest, mapRegionForExpedition, type OutpostRequest } from './outpostNavigation';
import type { RegionId } from '../core/expeditionTypes';
import { AdventurePreparation } from './AdventurePreparation';
import { IdleExpeditionPreparation } from './expedition/IdleExpeditionPreparation';
import { landmarkId, legacyPurposeLandmark, parseLandmarkId, mainStoryProgress, expeditionRegionForMap } from '../core/landmarkProgress';
import { commissionDefinitions, canDeliverCommunityParcel } from '../core/communityCommissions';
import type { ValleyGatherTarget } from '../core/valleyExplorationData';
import { AdventureStatMeter } from './AdventureStatMeter';
import { ExplorationHelp } from './help/ExplorationGuide';

interface Props {
  pet: PetState; actorId: string; actorName: string; portrait: string; happyPortrait?: string; registry: ItemRegistry; icons: Record<string, string>;
  installedMods: readonly InstalledPetModSummary[];
  update: (action: (pet: PetState) => PetState) => void;
  onBack: () => void; onKitchen: () => void;
  communityRoute?: CommunityRoute;
  onCommunity?: () => void;
  initialOutpost?: OutpostRequest;
  onShop?: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
}
type Panel = AdventureStoragePanel | 'map' | 'journal' | 'result' | 'expedition';
const defaultPortrait = resolvePetStatusImages(null).content;

export const AdventurePage = ({ pet, actorId, actorName, portrait, happyPortrait, installedMods, registry, icons, update: commit, onBack: leave, onKitchen: kitchen, onBuy, onUseHomeItem, communityRoute, onCommunity, initialOutpost, onShop }: Props) => {
  const trip = pet.adventure.active;
  const roster = [
    { id: 'official.furo', name: 'Furo', portrait: defaultPortrait },
    ...installedMods.map((mod) => ({ id: mod.manifest.id, name: mod.manifest.defaultPetName, portrait: mod.contentImageUrl ?? defaultPortrait })),
  ];
  const actorNameFor = (id: string) => roster.find((actor) => actor.id === id)?.name ?? L('旅途伙伴', 'Travel companion');
  const actorPortrait = (id: string) => roster.find((actor) => actor.id === id)?.portrait;
  const pending = pet.adventure.pending;
  const entry = initialOutpostRequest(pet, initialOutpost);
  const initialLandmark = communityRoute ? parseLandmarkId(legacyPurposeLandmark(communityRoute)) : entry && entry.view !== 'journal' ? { region: mapRegionForExpedition[entry.region], node: entry.node ?? (entry.target ? 'gather' as const : 'entrance' as const) } : undefined;
  const [mode, setMode] = useState<'manual' | 'idle'>(entry?.view === 'idle' ? 'idle' : 'manual');
  const [target, setTarget] = useState<string | undefined>(entry && entry.view !== 'journal' ? entry.target : undefined);
  const [panel, setPanelNow] = useState<Panel | undefined>(() => entry ? entry.view === 'journal' ? 'journal' : entry.view === 'camp' || pet.community.expedition.active || pet.community.expedition.pending ? 'expedition' : 'map' : pending ? 'result' : getAdventureBagCount(trip?.loot ?? {}) ? 'loot' : communityRoute && !trip ? 'map' : undefined);
  const [outpostRequest, setOutpostRequest] = useState<Exclude<OutpostRequest, { view: 'journal' }>>(() => entry && entry.view !== 'journal' ? entry : { view: 'idle', region: 'valley' });
  const expedition = pet.community.expedition;
  const expeditionBusy = Boolean(expedition.active || expedition.pending);
  const [purpose, setPurpose] = useState<CommunityRoute | undefined>(initialLandmark ? landmarkId(initialLandmark.region, initialLandmark.node) : undefined);
  const [landscape, setLandscape] = useState(false);
  const [panorama, setPanorama] = useState(false);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const outpostReturnToMap = useRef(false);
  const [selection, setSelection] = useState<AdventureMapSelection | 'tutorial' | undefined>(initialLandmark);
  const mapSelection = selection === 'tutorial' ? undefined : selection;
  const destination = selection === 'tutorial' ? 'tutorial' : mapSelection?.node ? mapSelection.region : undefined;
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
    else if (request.view === 'camp' || expeditionBusy) { setOutpostRequest(request); setPanelNow('expedition'); }
    else { const region = mapRegionForExpedition[request.region], node = request.node ?? (request.target ? 'gather' : 'entrance'); setMode(request.view === 'idle' ? 'idle' : 'manual'); setTarget(request.target); setSelection({ region, node }); setPurpose(landmarkId(region, node)); setPanelNow('map'); }
  };
  const openRegionMap = (region: RegionId = 'valley') => {
    action.cancel(); outpostReturnToMap.current = false; setPurpose(landmarkId(mapRegionForExpedition[region], 'entrance')); setSelection({ region: mapRegionForExpedition[region], node: 'entrance' }); setPanelNow('map');
  };
  const closeMore = () => {
    if (!moreRef.current?.open) return;
    moreRef.current.open = false;
    moreRef.current.querySelector('summary')?.focus({ preventScroll: true });
  };
  const fromMore = (callback: () => void) => { closeMore(); callback(); };
  const [bag, setBag] = useState<Inventory>({});
  const [greeting, setGreeting] = useState('');
  const lootCount = getAdventureBagCount(trip?.loot ?? {});
  useEffect(() => { action.cancel(); if (trip) { setSelection(undefined); setBag({}); setPurpose(undefined); setPanelNow(current => current === 'expedition' || current === 'journal' ? current : lootCount ? 'loot' : undefined); } }, [trip?.id]);
  useEffect(() => { if (expedition.active) setPanelNow('expedition'); }, [expedition.active?.id]);
  // Open new finds once; switching panels never discards uncollected items.
  useEffect(() => { if (lootCount) setPanelNow('loot'); }, [trip?.id, trip?.choices.length]);
  useEffect(() => { if (pending) setPanelNow(current => current === 'journal' ? current : 'result'); else setPanelNow(current => current === 'result' ? undefined : current); }, [pending?.id]);
  const currentDestination = trip?.region ?? pending?.region ?? destination;
  const steps = getAdventureSteps(trip?.rulesVersion, currentDestination, trip?.purpose ?? pending?.purpose ?? purpose, pet.community.expedition.regions.valley.base, trip?.bag);
  const stepCount = getAdventureStepCount(currentDestination, trip?.purpose ?? pending?.purpose ?? purpose);
  const step = trip ? steps[trip.choices.length] : undefined;
  const stageChoices = getAdventureStageChoices(pet, step?.choices ?? []);
  const availableHarvests = stageChoices.some(choice => choice.harvest) ? getExplorationBudget(pet, pet.lastUpdatedAt)?.available ?? 0 : 0;
  const completed = trip?.choices.length ?? pending?.steps ?? 0;
  const carriedCount = trip ? getAdventureBagCount(trip.bag) : pending ? getAdventureBagCount(pending.items) - (pending.items.trail_rope ?? 0) : getAdventureBagCount(bag);
  const neighbors = roster.filter(actor => actor.id !== (trip?.actorId ?? actorId));
  const services = canUseAdventureService(pet);
  const today = getEffectiveDailyDateKey(pet);
  const neighborOffset = neighbors.length ? hashString(`${today}:${actorId}`) % neighbors.length : 0;
  const hallNeighbors = [...neighbors.slice(neighborOffset), ...neighbors.slice(0, neighborOffset)].slice(0, 3);
  const changeBag = (id: ItemId, delta: number) => setBag(current => {
    const next = (current[id] ?? 0) + delta;
    if (next < 0 || delta > 0 && next > (pet.inventory[id] ?? 0) || getAdventureBagCount(current) + delta > capacity) return current;
    const result = { ...current, [id]: next };
    if (!next) delete result[id];
    return result;
  });
  const depart = () => move(current => startAdventure(current, destination, actorId, actorName, { ...bag }, false, Date.now(), purpose, undefined, roster.map(actor => actor.id)));
  const returnHome = () => { if (lootCount) setPanel('loot'); else if (trip) move(current => returnFromAdventure(current, trip.id)); };
  const close = () => { if (!trip) { setSelection(undefined); setPurpose(undefined); } setPanel(undefined); };
  const closeOutpost = () => {
    if (outpostReturnToMap.current && mapUnlocked) { outpostReturnToMap.current = false; setPanel('map'); }
    else close();
  };
  const selectTutorial = () => perform(() => { setPurpose(undefined); setSelection('tutorial'); setPanelNow('pack'); });
  const dialog = (title: string, contents: ReactNode) => <DialogShell className="adventure-dialog" backdropClassName="adventure-modal-backdrop" labelId="adventure-dialog-title" onClose={close}>
    <header><h3 id="adventure-dialog-title">{title}</h3><button className="icon-button" onClick={close} aria-label={L('关闭，返回场景', 'Close and return to the scene')}><X size={20} /></button></header>
    <div className="adventure-dialog-body">{contents}</div>
  </DialogShell>;
  const storagePanel = panel && !['map', 'journal', 'result', 'expedition'].includes(panel) ? panel as AdventureStoragePanel : undefined;
  const storageDialog = storagePanel && <AdventureStorage key={storagePanel} panel={storagePanel} pet={pet} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} onPack={changeBag} onDepart={depart} onPanel={setPanel} onClose={close} onBuy={onBuy} onUseHomeItem={onUseHomeItem} update={update} perform={perform} />;
  const travelingPortrait = !trip || trip.actorId === actorId ? portrait : actorPortrait(trip.actorId);
  const sceneRegion = trip?.region === 'tutorial' ? 'valley' : trip?.region;
  const scene = sceneRegion ? getAdventureNodeScene(sceneRegion, getAdventureRouteNode(trip?.purpose)) : adventureHallScene;
  const shownPortrait = phase === 'settling' && (!trip || trip.actorId === actorId) ? happyPortrait ?? travelingPortrait : travelingPortrait;
  const expeditionMinutes = Math.max(0, Math.ceil(((expedition.active?.endsAt ?? 0) - Date.now()) / 60000));
  const expeditionLabel = expedition.pending ? '领取旅途物资' : expedition.active ? expedition.active.mode === 'idle' ? '查看挂机行程' : '查看当前旅途' : '挂机出发';
  const expeditionHint = expedition.pending ? '已回到前哨 · 收获待领取' : expedition.active ? expedition.active.mode === 'idle' ? `剩余 ${Math.floor(expeditionMinutes / 60)} 小时 ${expeditionMinutes % 60} 分` : expedition.active.paused ? '已在营地暂停 · 随时继续' : '保留行囊与当前进度' : '2／4／8 小时 · 带回物资';

  const story = mainStoryProgress(pet.adventure);
  const selectedRegion = mapSelection?.region ?? 'valley';
  const coreRegion = expeditionRegionForMap[selectedRegion];
  const expeditionDialog = panel === 'expedition' && <ExpeditionPanel pet={pet} registry={registry} icons={icons} onUseHomeItem={onUseHomeItem} actorId={actorId} actorName={actorName} portrait={portrait} update={update} request={outpostRequest} onClose={closeOutpost} onNavigate={openOutpost} onMap={region => mapUnlocked ? openRegionMap(region) : selectTutorial()} onCommunity={onCommunity ?? onBack} onKitchen={onKitchen} onShop={onShop ?? (() => setPanel('supplies'))} />;

  return <><div className="adventure-viewport"><section className={'adventure-page' + (landscape ? ' adventure-page--landscape' : '') + (panorama ? ' adventure-page--panorama' : '')} data-action-phase={phase} data-motion={action.motion}>
    <header className="adventure-hud">
      <div className="adventure-heading"><button className="icon-button" onClick={onBack} aria-label={L('返回小窝，保留探查进度', 'Back home; keep scouting progress')}><ArrowLeft size={21} /></button>
        <h2>{trip || pending ? adventureJourneyName(currentDestination, trip?.purpose ?? pending?.purpose) : L('前哨基地 · 基地大厅', 'The outpost · Outpost hall')}</h2>
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
    <div className={trip ? 'adventure-stage adventure-scene--valley' : 'adventure-stage adventure-scene--hall'}>
      <nav className="adventure-toolbar" aria-label={L('冒险操作', 'Adventure actions')}>
        <button disabled={!mapUnlocked} aria-label={mapUnlocked ? L('总地图', 'Region map') : L('总地图未解锁', 'World map locked')} title={!mapUnlocked ? L('完成踩点探索后解锁大地图', 'Complete the tutorial to unlock the world map') : undefined} onClick={() => setPanel('map')}>{mapUnlocked ? <Map size={18} /> : <LockKeyhole size={18} />}{L('地图', 'Map')}</button>
        {trip ? <><button onClick={() => setPanel('bag')}><Backpack size={18} />{L('背包', 'Bag')}</button>
          {lootCount > 0 && <button className="adventure-loot-alert" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('待拾取', 'Finds')} {lootCount}</button>}
          <button onClick={returnHome} aria-label={L('免费返程', 'Return free')}><ArrowLeft size={18} />{L('返程', 'Return')}</button></>
          : <>{pending && <button onClick={() => setPanel('result')}><PackageOpen size={18} />{L('领取行囊', 'Collect bag')}</button>}<button disabled={Boolean(pending) || expeditionBusy} onClick={() => mapUnlocked ? openRegionMap() : selectTutorial()}><Backpack size={18} />选择地图与补给</button></>}
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
      {sceneRegion ? <div className="adventure-backdrop adventure-landmark-scene" role="img" aria-label={adventureJourneyName(trip?.region, trip?.purpose) + '场景'}><AdventureMapLandscape region={sceneRegion} /><img className="adventure-scene-landmark" src={scene} alt="" /></div> : <img className="adventure-backdrop" src={adventureHallScene} alt={L('有地图桌与补给架的木质大厅', 'A wooden hall with a map table and supply shelves')} />}
      <div className="adventure-cast">
        <div className="adventure-actor adventure-actor--you">{shownPortrait && <img src={shownPortrait} alt={trip?.actorName ?? actorName} />}<span>{trip?.actorName ?? actorName}</span></div>
        {!trip && hallNeighbors.map((actor, index) => <button className={'adventure-actor adventure-neighbor adventure-neighbor--' + index} key={actor.id} onClick={() => perform(() => setGreeting(actor.name + L('：这趟要多带几份料理！途中遇见我，可以买补给，也可以请我从仓库送来物资。', ': Pack a few dishes! If we meet on the trail, I can sell supplies or deliver items from home.')))} aria-label={L('聊聊 · ', 'Talk with ') + actor.name}><img src={actor.portrait} alt="" /><span>{actor.name}</span></button>)}
        {trip?.neighborId && services && <div className="adventure-actor adventure-neighbor--encounter">{actorPortrait(trip.neighborId) && <img src={actorPortrait(trip.neighborId)} alt={actorNameFor(trip.neighborId)} />}<span>{actorNameFor(trip.neighborId)}</span></div>}
      </div>
      </div></div>
      <section className="adventure-dialogue" aria-label={L('当前事件与行动', 'Current event and actions')}>
        {trip && <ExplorationSupport key={trip.id} pet={pet} system="adventure" update={update} move={move} busy={phase !== 'idle'} />}
        <ExplorationCheckBuffs state={trip?.checkState} />
        <ExplorationCheckSummary result={trip?.checkState?.last ?? pending?.lastCheck} />
        {!trip && !pending && <nav className="adventure-outpost-actions" aria-label="前哨常用功能"><button onClick={() => openOutpost(currentExpeditionRequest(pet) ?? { view: 'idle', region: 'valley' })}><Clock size={21} /><span><strong>{expeditionLabel}</strong><small>{expeditionHint}</small></span></button><button onClick={() => setPanel('journal')}><BookOpen size={21} /><span><strong>旅行日志</strong><small>旅途记录 · 故事与发现</small></span></button></nav>}
        {!trip && !pending && mapUnlocked && <div className="adventure-service-actions"><span>主线地标 {story.completed}/40 · 章节 {story.chapters}/5</span>{onCommunity && <button className="secondary-button" onClick={onCommunity}>回农场 · 建设与委托</button>}</div>}
        {trip && getCommunityTasks(pet).filter(task => commissionDefinitions[task.template]?.deliveryItem && !task.found).map(task => <div className="community-note" key={task.id}><p>{commissionDefinitions[task.template].name}：到指定地标的记录阶段后送达，实际消耗行囊便当 ×1。</p><button className="secondary-button" disabled={!canDeliverCommunityParcel(pet, task)} onClick={() => update(p => deliverCommunityParcel(p, task.id, trip.id, trip.revision))}>交付行囊便当</button></div>)}
        {trip ? <><div className="adventure-dialogue-heading"><h3>{services ? actorNameFor(trip.neighborId!) + ' · ' + L('路上遇见你', 'Good to see you') : step?.title ?? L('这一带的路已经记住了', 'You know these paths now')}</h3><ExplorationHelp pet={pet} purpose={trip.purpose} destination={trip.region} choices={stageChoices} /></div>
          <p>{services ? L('我带了些补给，也能从家里送来物资，每份 2 小心心。先歇歇脚，再往前走吧。', 'I have supplies and can deliver items from home for 2 hearts each. Rest before moving on.') : step?.story ?? L('带着发现和未用完的补给，一起回到大厅吧。', 'Bring your discoveries and unused supplies back to the hall.')}</p>
          {services && <div className="adventure-service-actions"><button className="secondary-button" onClick={() => setPanel('shop')}><ShoppingBag size={17} />{L('看看随身补给', 'Browse supplies')}</button><button className="secondary-button" onClick={() => setPanel('delivery')}><Truck size={17} />{L('请伙伴运输', 'Request delivery')}</button></div>}
          {lootCount > 0 ? <button className="primary-button" onClick={() => setPanel('loot')}><PackageOpen size={18} />{L('先处理待拾取物资', 'Handle pending finds first')}</button> : <div className="adventure-choices">{stageChoices.map(choice => {
            const reason = getAdventureChoiceReason(pet, choice);
            const preview = getAdventureChoicePreview(pet, choice);
            const label = choice.harvest ? `${choice.label}（${availableHarvests}次）` : choice.label;
            if (preview && choice.check) return <div className="exploration-choice-card" key={choice.id}><button className="exploration-choice-action" disabled={phase !== 'idle' || Boolean(reason)} title={reason || choice.detail} onClick={() => move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision))}><strong>{label}</strong><small>{choice.detail}</small><ExplorationChoiceDetails pet={pet} preview={preview} definition={choice.check} hunger={choice.hunger} reason={reason} harvest={choice.harvest} research={Boolean(choice.research)} hideFinds={choice.randomGather} item={choice.item} mealItem={choice.mealItem} /></button></div>;
            return <div className="exploration-choice-card" key={choice.id}><button className="exploration-choice-action" disabled={phase !== 'idle' || Boolean(reason)} title={reason || label} onClick={() => move(current => advanceAdventure(current, trip.id, trip.choices.length, choice.id, Date.now(), trip.revision))}><span className="adventure-choice-heading"><strong>{label}</strong><span className="adventure-cost"><Utensils size={14} />−{choice.hunger}<Zap size={14} />−{choice.energy}<ArrowRight size={14} /></span></span><small>{choice.tool ? '拉稳绳索，小心走过这段路。' : choice.detail}</small>{choice.tool && <small>探路绳 · 耐久 −1</small>}{Boolean(choice.health || choice.mood) && <small>{[choice.health ? `健康 ${choice.health > 0 ? '+' : ''}${choice.health}` : '', choice.mood ? `心情 ${choice.mood > 0 ? '+' : ''}${choice.mood}` : ''].filter(Boolean).join(' · ')}</small>}{pet.health + (choice.health ?? 0) < getPetStatCap(pet) * adventureHealthRules.retreat && <small className="adventure-blocked">完成此行动后将安全返回。</small>}{reason && <small className="adventure-blocked">{reason}</small>}</button></div>;
          })}{!step && <button className="primary-button" onClick={returnHome}>{L('完成探查，返回大厅', 'Finish scouting and return')}</button>}</div>}
          {step && stageChoices.every(choice => Boolean(getAdventureChoiceReason(pet, choice))) && !lootCount && <button className="text-button" onClick={() => setPanel('bag')}>{L('打开背包补给；也可免费返程', 'Open your bag to refuel, or return for free')}</button>}
        </> : <><h3>{pending ? L('平安归来', 'Welcome home') : expeditionBusy ? '旅途安排已记下' : L('这次想去哪里？', 'Where shall we go?')}</h3><p>{greeting || (expeditionBusy ? expedition.pending ? '这一趟的收获已运回前哨，可以领取物资，再安排下一次出发。' : '当前进度会一直保留。打开行程查看挂机情况或领取收获，也可以先翻翻旅行日志。' : pending ? L('收好行囊和这趟探查的奖励吧。战利品可以在背包或出发整备中兑换金币。', 'Collect your supplies and rewards. Exchange treasure in your bag or trip preparation.') : !mapUnlocked ? L('先从附近的「踩点探索」开始：四个阶段，熟悉路线和行囊操作。通关并收好发现后，再展开大地图。', 'Start close to home with the four-stop tutorial. Learn the route and travel bag, then collect your finds to open the world map.') : '打开地图，选择地标和手动／挂机模式，带好补给后出发。主线按地标推进；已完成的地标可重复采集、调查及完成委托。')}</p>
          {!pending && !mapUnlocked && <div className="adventure-tutorial-card"><strong><Compass size={18} />{adventureTaskName('tutorial')}<small>{L('新手关 · 4 个阶段', 'Tutorial · 4 stops')}</small></strong><p>{adventureTutorialRewardText()}</p><small>{L('全程饱食 32、体力 8，无需额外道具；未完成可返程重试。', '32 hunger and 8 energy in total; no extra items needed. Unfinished trips can be retried.')}</small></div>}
          <div className="adventure-service-actions">{pending ? <button className="primary-button" onClick={() => setPanel('result')}><PackageOpen size={18} />{L('收好行囊', 'Collect everything')}</button> : <>{mapUnlocked ? <button className="primary-button" onClick={() => setPanel('map')}><Map size={18} />{L('查看总地图 · 选择目的地', 'View world map · Choose a destination')}</button> : <button className="primary-button" onClick={selectTutorial}><Compass size={18} />{L('选择踩点探索 · 整备', 'Choose tutorial · Prepare')}</button>}
            {(!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed) && <button className="secondary-button" onClick={() => update(claimAdventureStarter)}><Sparkles size={17} />{pet.adventure.starterClaimed ? L('补领胡萝卜蛋饭 ×4', 'Collect 4 carrot egg rice dishes') : L('领取入门补给 · 含料理 ×4', 'Collect starter supplies · 4 dishes included')}</button>}</>}</div>
        </>}
      </section>
      </div>
      {storagePanel !== 'pack' && storageDialog}
      {panel === 'result' && pending?.salvage && dialog('健康不足，已安全返程', <><ExplorationCheckSummary result={pending.lastCheck} /><AdventureReturnSelection key={pending.id} capacity={capacity} result={pending} registry={registry} update={update} /></>)}
      {panel === 'map' && mapUnlocked && <AdventureMap adventure={pet.adventure} pet={pet} icons={icons} registry={registry} onOutpost={openOutpost} today={today} selection={mapSelection} portrait={shownPortrait} landscape={landscape} onToggleLandscape={() => setLandscape(value => !value)} onSelect={value => { setPurpose(value.node ? landmarkId(value.region, value.node) : undefined); setSelection(value); setTarget(undefined); }} mode={mode} onMode={setMode} onResume={close} onCollect={() => setPanel('result')} onClose={close} preparation={mode === 'manual' ? <>
        <AdventurePreparation embedded pet={pet} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} onPack={changeBag} onDepart={depart} onClose={close} onUseHomeItem={onUseHomeItem} perform={perform} update={update} />
      </> : <IdleExpeditionPreparation key={coreRegion} embedded pet={pet} actorId={actorId} actorName={actorName} portrait={portrait} registry={registry} icons={icons} onUseHomeItem={onUseHomeItem} update={update} initialRegion={coreRegion} initialTarget={target as ValleyGatherTarget | undefined} onMap={openRegionMap} onCamp={region => openOutpost({ view: 'camp', region })} onRoute={(region, target) => openOutpost({ view: 'manual', region, target })} onCommunity={onCommunity ?? onBack} onKitchen={onKitchen} onShop={onShop ?? (() => setPanel('supplies'))} />} />}
      {panel === 'result' && pending && !pending.salvage && dialog(L('本次探查结算', 'Trip rewards'), <><ExplorationCheckSummary result={pending.lastCheck} /><h4>{pending.complete ? pending.region === 'tutorial' ? L('踩点探索完成，大地图就在眼前', 'Tutorial complete: the world map awaits') : pending.purpose ? adventureJourneyName(pending.region, pending.purpose) + ' · 已完成' : L('入口附近，已经熟悉了', 'The entrance feels familiar now') : L('平安回来，也是一段旅程', 'A safe return is a journey too')}</h4><p>{pending.region === 'tutorial' && pending.complete ? L('收好这次发现，地图手册将带你去往更远的地方。一堆金币可以在背包中兑换为 360 金币。', 'Collect your finds and let the map handbook guide you farther. Exchange the coin hoard in your inventory for 360 coins.') : pending.first ? L('首次完成的收获已列在下方。', 'Your first-completion rewards are listed below.') : L('保留所有已完成路段的收获。', 'Keep the rewards from every completed step.')}</p><div className="adventure-rewards">{pending.hearts > 0 && <span><Heart size={18} />{pending.hearts}</span>}{pending.coins > 0 && <span>{pending.rewardsClaimed ? pending.coinsRemaining ?? 0 : pending.coins} {L('金币', 'coins')}</span>}{pending.rewardsClaimed && <small>{L('奖励已结算', 'Rewards received')}</small>}</div><h4>{L('收获与归还物资', 'Finds and returned supplies')}</h4><div className="adventure-item-list">{Object.entries(pending.items).filter(([, n]) => n > 0).map(([id, n]) => <span className="adventure-item-pill" key={id}><img src={icons[id] ?? unknownItemIcon} alt="" />{registry.get(id)?.name ?? id} ×{n}{isAdventureTreasure(id) && <small>{L('可兑换 ', 'Worth ')}{getAdventureTreasureValue(id) * n} {L('金币', 'coins')}</small>}</span>)}</div><div className="adventure-dialog-actions"><button className="primary-button" onClick={() => update(current => claimAdventureResult(current, pending.id))}><PackageOpen size={18} />{pending.rewardsClaimed ? L('领取剩余物资', 'Collect remaining supplies') : L('收好行囊', 'Collect everything')}</button><button className="secondary-button" onClick={close}>{L('返回大厅', 'Return to the hall')}</button></div></>)}
    </div>
    {storagePanel === 'pack' && storageDialog}
  </section></div>
    {expeditionDialog}
    {panel === 'journal' && <TravelJournal pet={pet} onClose={closeOutpost} onMap={() => mapUnlocked ? openRegionMap() : selectTutorial()} onReceipt={system => system === 'adventure' ? setPanel('result') : openOutpost(currentExpeditionRequest(pet) ?? { view: 'idle', region: 'valley' })} />}
  </>;
};
