import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CircleHelp, ClipboardList, Compass, Flag, Heart, Home, Map, Tent, X } from 'lucide-react';
import { currencyIcon } from '../assets';
import { getAdventureCompanions, resolveAdventureCompanion } from './AdventureCompanions';
import { AdventureHome } from './AdventureHome';
import { AdventureGrowth } from './AdventureGrowth';
import { AdventureReceipt } from './AdventureReceipt';
import type { InstalledPetModSummary } from '../core/mod';
import { claimAdventureStarter, returnFromAdventure, startAdventure } from '../core/adventure';
import { adventureJourneyName } from '../core/adventureData';
import { getAdventureBagCount, isAdventureMapUnlocked, isAdventureSupply } from '../core/adventureState';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import type { CommunityRoute } from '../core/communityTypes';
import type { RegionId } from '../core/expeditionTypes';
import { regionIds, regions } from '../core/expeditionData';
import { landmarkId, legacyPurposeLandmark, parseLandmarkId, expeditionRegionForMap, mapRegionForExpedition, nextLandmarks, landmarkNames } from '../core/landmarkProgress';
import { AdventureStorage, type AdventureStoragePanel } from './AdventureStorage';
import { DialogScope, DialogShell } from './DialogShell';
import { AdventureMap } from './AdventureMap';
import { AdventurePreparation } from './AdventurePreparation';
import { AdventureJourneyView } from './AdventureJourneyView';
import { ExplorationHarvestStatus } from './ExplorationHarvestStatus';
import { ExpeditionJourney } from './expedition/ExpeditionJourney';
import { IdleExpeditionPreparation } from './expedition/IdleExpeditionPreparation';
import { TravelJournal } from './TravelJournal';
import type { OutpostRequest } from './outpostNavigation';
import { useAdventureAction } from './useAdventureAction';
import { useExplorationNavigation, type ExplorationNavigation } from './useExplorationNavigation';
import { ExplorationHelp, ExplorationHandbookNavigation } from './help/ExplorationGuide';
import { formatInteger } from './numberFormat';
import { adventureTripProgress, campaignCargoIds, campaignEventVisible, campaignVisitComplete } from '../core/explorationCampaignState';
import { campaignVisits, type CampaignVisitId } from '../core/explorationCampaignData';
import { ExplorationTasks } from './ExplorationTasks';
import '../styles/outpost.css';
import '../styles/valley-loop.css';
import '../styles/exploration-campaign.css';

interface Props {
  pet: PetState; actorId: string; actorName: string; portrait: string; happyPortrait?: string; registry: ItemRegistry; icons: Record<string, string>;
  installedMods: readonly InstalledPetModSummary[]; update: (fn: (pet: PetState) => PetState) => void;
  onBack: () => void; onKitchen: () => void; communityRoute?: CommunityRoute; onCommunity?: () => void; initialOutpost?: OutpostRequest; onShop?: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
  onToggleItemFavorite: (id: ItemId) => void;
  onMuseum?: () => void;
}
const screenNames: Record<ExplorationNavigation['screen'], string> = { home: '前哨大厅', map: '探索地图', prepare: '出发准备', journey: '手动探索', receipt: '返程结算', growth: '营地与成长', journal: '旅行手册', tasks: '探索任务' };
export const AdventurePage = (props: Props) => <AdventureContent {...props} />;
const AdventureContent = (props: Props) => {
  const { pet, actorId, actorName, portrait, registry, icons, update, onBack: leave, initialOutpost: entry, communityRoute, onBuy, onUseHomeItem, onToggleItemFavorite } = props;
  const trip = pet.adventure.active, pending = pet.adventure.pending, expedition = pet.community.expedition;
  const roster = getAdventureCompanions(props.installedMods);
  const traveler = trip ?? expedition.active;
  const representedActor = traveler ?? pending;
  const shownActor = representedActor && representedActor.actorId !== actorId ? resolveAdventureCompanion(roster, representedActor.actorId, representedActor.actorName)
    : { id: actorId, name: representedActor?.actorName ?? actorName, portrait };
  const neighbor = trip?.neighborId ? resolveAdventureCompanion(roster, trip.neighborId) : undefined;
  const initialSelection = communityRoute ? parseLandmarkId(legacyPurposeLandmark(communityRoute)) : entry && entry.view !== 'journal' ? { region: mapRegionForExpedition[entry.region], node: entry.node ?? (entry.target ? 'gather' as const : 'entrance' as const) } : undefined;
  const { navigation: nav, navigate, back } = useExplorationNavigation({ screen: pending || expedition.pending ? 'receipt' : trip || expedition.active ? 'journey' : entry?.view === 'journal' ? 'journal' : entry?.view === 'camp' ? 'growth' : initialSelection ? 'prepare' : 'home', selection: initialSelection, mode: entry?.view === 'idle' ? 'idle' : 'manual', target: entry && entry.view !== 'journal' ? entry.target : undefined, museumVisit: entry && entry.view !== 'journal' ? entry.museumVisit : undefined }, leave, { journey: Boolean(trip || expedition.active), receipt: Boolean(pending || expedition.pending) });
  const [overlay, setOverlay] = useState<Exclude<AdventureStoragePanel, 'pack'> | 'return'>();
  const [bag, setBag] = useState<Inventory>({});
  const mainRef = useRef<HTMLElement>(null), scrollPositions = useRef<Record<string, number>>({});
  const scrollKey = `${nav.screen}:${nav.mode}:${typeof nav.selection === 'object' ? nav.selection.region : nav.selection ?? ''}:${nav.screen === 'prepare' ? JSON.stringify(nav.selection) + (nav.target ?? '') : nav.screen === 'tasks' ? nav.taskTab ?? 'current' : ''}`;
  useLayoutEffect(() => { if (mainRef.current) mainRef.current.scrollTop = scrollPositions.current[scrollKey] ?? 0; }, [scrollKey]);
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet), busy = action.phase !== 'idle';
  const selection = nav.selection === 'tutorial' ? undefined : nav.selection;
  const destination = nav.selection === 'tutorial' ? 'tutorial' : selection?.node ? selection.region : undefined;
  const purpose = selection?.node ? landmarkId(selection.region, selection.node) : undefined;
  useEffect(() => {
    // Packing is a draft. Release task-only materials when choosing another destination.
    const cargo = nav.museumVisit ? [] : campaignCargoIds(pet, purpose);
    setBag(current => Object.fromEntries(Object.entries(current).filter(([id]) => isAdventureSupply(id) || cargo.includes(id))));
  }, [purpose, nav.museumVisit]);
  const region = selection ? expeditionRegionForMap[selection.region] : 'valley';
  const unlocked = isAdventureMapUnlocked(pet.adventure), recommended = nextLandmarks(pet.adventure)[0];
  const go = (screen: ExplorationNavigation['screen'], extra: Partial<ExplorationNavigation> = {}, replace = false) => { action.cancel(); navigate({ ...nav, screen, ...extra }, replace); setOverlay(undefined); };
  const openOutpost = (request: OutpostRequest) => request.view === 'journal' ? go('journal') : go(request.view === 'camp' ? 'growth' : 'prepare', { selection: { region: mapRegionForExpedition[request.region], node: request.node ?? (request.target ? 'gather' : 'entrance') }, mode: request.view === 'idle' ? 'idle' : 'manual', target: request.target, campaignVisit: undefined, museumVisit: request.museumVisit });
  const openMap = (r: RegionId = region) => unlocked ? go('map', { selection: { region: mapRegionForExpedition[r], node: nextLandmarks(pet.adventure).find(value => value.region === mapRegionForExpedition[r])?.node ?? 'entrance' }, campaignVisit: undefined, museumVisit: undefined }) : go('prepare', { selection: 'tutorial', mode: 'manual', campaignVisit: undefined, museumVisit: undefined });
  const openTaskVisit = (id: CampaignVisitId) => { const visit = campaignVisits[id]; setBag({}); go('prepare', { selection: { region: visit.region, node: visit.node }, mode: 'manual', target: undefined, campaignVisit: id, museumVisit: undefined }); };
  const storage = (panel: AdventureStoragePanel) => panel === 'pack' ? go('prepare', { selection: nav.selection ?? recommended ?? 'tutorial', mode: 'manual' }) : setOverlay(panel);
  const move = (fn: (p: PetState) => PetState) => action.run(() => update(current => {
    const live = current.adventure.active;
    if (current.timePause || live?.id !== trip?.id || live?.revision !== trip?.revision) return current;
    return fn(current);
  }), 'walk');
  const changeBag = (id: ItemId, delta: number) => setBag(current => {
    const count = (current[id] ?? 0) + delta;
    if (count < 0 || delta > 0 && (count > (pet.inventory[id] ?? 0) || getAdventureBagCount(current) + delta > capacity)) return current;
    const next = { ...current }; if (count) next[id] = count; else delete next[id]; return next;
  });
  const depart = () => move(current => startAdventure(current, destination, actorId, actorName, bag, false, Date.now(), purpose, nav.target, roster.map(actor => actor.id), nav.campaignVisit, nav.museumVisit));
  useEffect(() => { if (trip || expedition.active) { navigate({ ...nav, screen: 'journey', mode: expedition.active ? 'idle' : 'manual' }, true); setBag({}); setOverlay(undefined); } }, [trip?.id, expedition.active?.id]);
  useEffect(() => { if (pending || expedition.pending) { navigate({ ...nav, screen: 'receipt' }, true); setOverlay(undefined); } }, [pending?.id, expedition.pending?.id]);
  useEffect(() => { if (trip && getAdventureBagCount(trip.loot)) setOverlay('loot'); }, [trip?.id, trip?.choices.length]);
  const requestReturn = () => {
    if (!trip) return;
    if (trip.rulesVersion < 11 && getAdventureBagCount(trip.loot)) { setOverlay('loot'); return; }
    const progress = adventureTripProgress(pet, trip);
    if (progress.steps >= progress.total && (!trip.campaign || campaignVisitComplete(pet.adventure.campaign, trip.campaign.visitId))) move(p => returnFromAdventure(p, trip.id)); else setOverlay('return');
  };
  const primary = () => pending || expedition.pending ? go('receipt') : trip || expedition.active ? go('journey') : !unlocked ? go('prepare', { selection: 'tutorial', mode: 'manual', campaignVisit: undefined, museumVisit: undefined }) : recommended ? go('prepare', { selection: recommended, mode: 'manual', campaignVisit: undefined, museumVisit: undefined }) : openMap();
  const primaryLabel = pending || expedition.pending ? '领取上次探险收获' : trip || expedition.active ? '继续当前探险' : !unlocked ? '开始新手踩点 · 4 个阶段' : recommended ? `下一站：${landmarkNames[recommended.region][recommended.node]}` : '选择目的地';
  const expeditionProps = { onToggleItemFavorite, pet, actorId, actorName, portrait: shownActor.portrait, update, registry, icons, onUseHomeItem, onCommunity: props.onCommunity ?? leave, onKitchen: props.onKitchen, onShop: () => setOverlay('supplies'), onHall: () => go('home') };
  return <ExplorationHandbookNavigation.Provider value={() => go('journal', { target: 'help' })}><DialogScope status={<ExplorationHarvestStatus pet={pet} interactive={false} />}><div className="exploration-app" data-screen={nav.screen} data-action-phase={action.phase}>
    <nav className="exploration-rail" aria-label="探险导航"><div className="exploration-brand"><Compass size={42} strokeWidth={1.2} /><strong>PocPet</strong></div><div className="exploration-rail-links">
      <button aria-current={nav.screen === 'home' ? 'page' : undefined} onClick={() => go('home')}><Flag /><span>前哨</span></button>
      <button aria-current={['map','prepare','journey','receipt'].includes(nav.screen) ? 'page' : undefined} onClick={() => openMap()}><Map /><span>地图</span></button>
      <button aria-current={nav.screen === 'tasks' ? 'page' : undefined} onClick={() => go('tasks')}><ClipboardList /><span>任务{Object.values(pet.adventure.campaign.tasks).some(record => record && !record.claimedAt) && ' ·'}</span></button>
      <button aria-current={nav.screen === 'growth' ? 'page' : undefined} onClick={() => go('growth')}><Tent /><span>成长</span></button><button aria-current={nav.screen === 'journal' ? 'page' : undefined} onClick={() => go('journal')}><BookOpen /><span>手册</span></button>
    </div><button className="exploration-rail-home" onClick={leave}><Home /><span>小窝</span></button></nav>
    <header className="exploration-header"><div className="exploration-heading"><button className="icon-button" onClick={back} aria-label={nav.screen === 'home' ? '返回小窝' : '返回上一页'}><ArrowLeft /></button><h2>{(nav.screen === 'prepare' || nav.screen === 'journey') && nav.mode === 'idle' ? expedition.active ? '挂机进行中' : '挂机探索' : screenNames[nav.screen]}</h2><span className="exploration-heading-note">{nav.screen === 'home' ? '旅途从这里开始' : nav.screen === 'map' ? '沿着小路，发现新的故事' : nav.screen === 'journal' ? '把走过的风景记下来' : '和伙伴一起，慢慢探索'}</span></div><div className="exploration-header-tools"><ExplorationHarvestStatus pet={pet} /><div className="exploration-wallet"><span aria-label={`${formatInteger(pet.coins)} 金币`}><img src={currencyIcon} alt="" /><b>{formatInteger(pet.coins)}</b></span><span aria-label={`${formatInteger(pet.hearts)} 心心`}><Heart size={22} /><b>{formatInteger(pet.hearts)}</b></span></div><button className="icon-button" aria-label="探索玩法手册" onClick={() => go('journal',{target:'help'})}><CircleHelp size={23} /></button></div>
    </header>
    <main className="exploration-main" ref={mainRef} onScroll={event => { scrollPositions.current[scrollKey] = event.currentTarget.scrollTop; }}>
      {nav.screen === 'home' && <AdventureHome pet={pet} actor={shownActor} roster={roster} primaryLabel={primaryLabel} onPrimary={primary} onMap={() => openMap()} onJournal={() => go('journal', { target: undefined })} onTasks={() => go('tasks')} onSupplies={() => setOverlay('supplies')} onStarter={() => update(claimAdventureStarter)} />}
      {nav.screen === 'map' && <AdventureMap embedded adventure={pet.adventure} pet={pet} icons={icons} registry={registry} onOutpost={openOutpost} selection={selection} portrait={portrait} onSelect={value => navigate({ ...nav, selection: value, target: undefined, campaignVisit: undefined, museumVisit: undefined }, true)} mode={nav.mode} onMode={mode => navigate({ ...nav, mode, campaignVisit: undefined, museumVisit: undefined }, true)} onResume={() => go('journey')} onCollect={() => go('receipt')} onClose={back} onPrepare={() => go('prepare')} />}
      {nav.screen === 'prepare' && <section className="exploration-preparation"><div className="exploration-preparation-toolbar"><div className="exploration-inline-actions"><button onClick={() => openMap()}>更换目的地</button><button onClick={() => setOverlay('supplies')}>购买补给与工具</button></div><ExplorationHelp pet={pet} destination={destination} purpose={purpose} mode={nav.mode} /></div>
        {nav.mode === 'manual' ? <AdventurePreparation onToggleItemFavorite={onToggleItemFavorite} embedded pet={pet} actor={shownActor} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} campaignVisit={nav.campaignVisit} museumVisit={nav.museumVisit} onPack={changeBag} onDepart={depart} onClose={back} onUseHomeItem={onUseHomeItem} perform={fn => { if (!busy) fn(); }} update={update} /> : <IdleExpeditionPreparation key={region} embedded {...expeditionProps} initialRegion={region} initialTarget={nav.target} onMap={openMap} onCamp={r => openOutpost({ view: 'camp', region: r })} onRoute={(r, target) => openOutpost({ view: 'manual', region: r, target })} />}</section>}
      {nav.screen === 'journey' && (trip ? <><p className="exploration-trip-progress">{adventureJourneyName(trip.region, trip.purpose)} · {campaignEventVisible(pet) ? '聚餐准备' : `${adventureTripProgress(pet, trip).steps}/${adventureTripProgress(pet, trip).total} 阶段`}</p><AdventureJourneyView key={trip.id} pet={pet} portrait={shownActor.portrait} neighbor={neighbor} mods={props.installedMods} update={update} move={move} busy={busy} onStorage={storage} onReturn={requestReturn} onTasks={() => go('tasks')} /></> : expedition.active ? <ExpeditionJourney {...expeditionProps} /> : <section><p>行程已结束。</p><button onClick={() => go(pending || expedition.pending ? 'receipt' : 'home')}>查看收获与下一站</button></section>)}
      {nav.screen === 'receipt' && (pending ? <AdventureReceipt pet={pet} result={pending} portrait={shownActor.portrait} registry={registry} icons={icons} update={update} /> : expedition.pending ? <ExpeditionJourney {...expeditionProps} /> : <section className="exploration-next"><h3>收获已入库</h3><p>{pet.recentEvent}</p>{pet.adventure.campaign.startedAt && <button className="primary-button" onClick={() => go('tasks')}>看看聚餐任务与待领心意</button>}<button className="secondary-button" onClick={primary}>{primaryLabel}</button>{regionIds.filter(id => expedition.regions[id].surveyed && !expedition.regions[id].base).map(id => <button key={id} onClick={() => openOutpost({ view: 'camp', region: id })}>建设{regions[id].name}营地，开启挂机</button>)}</section>)}
      {nav.screen === 'growth' && <AdventureGrowth pet={pet} update={update} region={region} onRegion={id => navigate({ ...nav, selection:{region:mapRegionForExpedition[id]} },true)} onMap={() => openMap(region)} onShop={() => setOverlay('supplies')} onIdle={() => openOutpost({view:'idle',region})} />}
      {nav.screen === 'journal' && <TravelJournal embedded key={nav.target === 'help' ? 'help' : 'records'} initialTab={nav.target === 'help' ? 'help' : 'records'} pet={pet} onClose={back} onMap={() => openMap()} onReceipt={() => go('receipt')} />}
      {nav.screen === 'tasks' && <ExplorationTasks pet={pet} actorId={actorId} mods={props.installedMods} update={update} onVisit={openTaskVisit} onMap={() => openMap()} onResume={() => go('journey')} onReceipt={() => go('receipt')} tab={nav.taskTab ?? 'current'} onTab={taskTab => navigate({ ...nav, taskTab }, true)} />}
      {nav.screen === 'receipt' && props.onMuseum && (pending?.museumVisit || pet.adventure.journal[0]?.museumVisit) && <button className="secondary-button" onClick={props.onMuseum}>回纪念馆查看委托与展品</button>}
    </main>
    {overlay && overlay !== 'return' && <AdventureStorage onToggleItemFavorite={onToggleItemFavorite} key={overlay} panel={overlay} pet={pet} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} onPack={changeBag} onDepart={depart} onPanel={storage} onClose={() => setOverlay(undefined)} onBuy={onBuy} onUseHomeItem={onUseHomeItem} update={update} />}
    {overlay === 'return' && trip && <DialogShell role="alertdialog" className="exploration-confirm-sheet" labelId="exploration-return-title" onClose={() => setOverlay(undefined)}><header><h3 id="exploration-return-title">提前返回前哨</h3><button className="icon-button" aria-label="取消返程" onClick={() => setOverlay(undefined)}><X /></button></header><div className="exploration-sheet-body"><p>{trip.museum ? '纪念馆委托和回访记录都会保留，下次可以从已完成的步骤继续。未交付的料理随行囊带回。' : trip.campaign ? '聚餐准备、已交的材料和待领心意都会保留。下次来接着办，未用的东西随行囊带回。' : '保留当前行囊、已获得的采集奖励与研究进度。本次未完成的地标不会获得首次完成奖励。'}</p><p>这趟已经完成 {adventureTripProgress(pet, trip).steps}/{adventureTripProgress(pet, trip).total} 阶段；返程不额外消耗。</p></div><footer><button data-dialog-autofocus onClick={() => setOverlay(undefined)}>继续探险</button><button className="primary-button" onClick={() => { move(p => returnFromAdventure(p, trip.id)); setOverlay(undefined); }}>确认返程</button></footer></DialogShell>}
  </div></DialogScope></ExplorationHandbookNavigation.Provider>;
};
