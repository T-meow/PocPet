import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Backpack, BookOpen, Compass, Heart, Map, ShoppingBag, Tent, Utensils, X, Zap } from 'lucide-react';
import { unknownItemIcon } from '../assets';
import { AdventureHall, getAdventureCompanions, resolveAdventureCompanion } from './AdventureCompanions';
import type { InstalledPetModSummary } from '../core/mod';
import { claimAdventureResult, claimAdventureStarter, returnFromAdventure, startAdventure } from '../core/adventure';
import { adventureJourneyName, getAdventureStepCount } from '../core/adventureData';
import { getAdventureBagCount, isAdventureMapUnlocked } from '../core/adventureState';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { getExplorationTier } from '../core/explorationBudget';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';
import type { CommunityRoute } from '../core/communityTypes';
import type { RegionId } from '../core/expeditionTypes';
import { regionIds, regions } from '../core/expeditionData';
import { landmarkId, legacyPurposeLandmark, parseLandmarkId, mainStoryProgress, expeditionRegionForMap, mapRegionForExpedition, nextLandmarks, landmarkNames } from '../core/landmarkProgress';
import { AdventureStorage, type AdventureStoragePanel } from './AdventureStorage';
import { DialogScope, DialogShell } from './DialogShell';
import { AdventureMap } from './AdventureMap';
import { AdventurePreparation } from './AdventurePreparation';
import { AdventureJourneyView } from './AdventureJourneyView';
import { AdventureReturnSelection } from './AdventureReturnSelection';
import { AdventureStatMeter } from './AdventureStatMeter';
import { ExplorationHarvestStatus } from './ExplorationHarvestStatus';
import { ExpeditionJourney } from './expedition/ExpeditionJourney';
import { IdleExpeditionPreparation } from './expedition/IdleExpeditionPreparation';
import { ExpeditionCamp } from './expedition/ExpeditionCamp';
import { ExplorationBackpackUpgrade } from './expedition/ExplorationBackpackUpgrade';
import { TravelJournal } from './TravelJournal';
import type { OutpostRequest } from './outpostNavigation';
import { useAdventureAction } from './useAdventureAction';
import { useExplorationNavigation, type ExplorationNavigation } from './useExplorationNavigation';
import { ExplorationHelp, ExplorationHandbookNavigation } from './help/ExplorationGuide';
import { explorationSkillNames } from '../core/explorationChecks';
import { getEffectiveDailyDateKey } from '../core/gameClock';
import '../styles/outpost.css';
import '../styles/valley-loop.css';

interface Props {
  pet: PetState; actorId: string; actorName: string; portrait: string; happyPortrait?: string; registry: ItemRegistry; icons: Record<string, string>;
  installedMods: readonly InstalledPetModSummary[]; update: (fn: (pet: PetState) => PetState) => void;
  onBack: () => void; onKitchen: () => void; communityRoute?: CommunityRoute; onCommunity?: () => void; initialOutpost?: OutpostRequest; onShop?: () => void;
  onBuy: (id: ItemId, quantity: number) => void; onUseHomeItem: (id: ItemId, quantity: number) => void;
}
const screenNames: Record<ExplorationNavigation['screen'], string> = { home: '探险首页', map: '地区地图', prepare: '出发准备', journey: '探险过程', receipt: '返程结算', growth: '营地与成长', journal: '旅行手册' };
export const AdventurePage = (props: Props) => <AdventureContent {...props} />;
const AdventureContent = (props: Props) => {
  const { pet, actorId, actorName, portrait, registry, icons, update, onBack: leave, initialOutpost: entry, communityRoute, onBuy, onUseHomeItem } = props;
  const trip = pet.adventure.active, pending = pet.adventure.pending, expedition = pet.community.expedition;
  const roster = getAdventureCompanions(props.installedMods);
  const traveler = trip ?? expedition.active;
  const shownActor = traveler && traveler.actorId !== actorId ? resolveAdventureCompanion(roster, traveler.actorId, traveler.actorName)
    : { id: actorId, name: traveler?.actorName ?? actorName, portrait };
  const neighbor = trip?.neighborId ? resolveAdventureCompanion(roster, trip.neighborId) : undefined;
  const initialSelection = communityRoute ? parseLandmarkId(legacyPurposeLandmark(communityRoute)) : entry && entry.view !== 'journal' ? { region: mapRegionForExpedition[entry.region], node: entry.node ?? (entry.target ? 'gather' as const : 'entrance' as const) } : undefined;
  const { navigation: nav, navigate, back } = useExplorationNavigation({ screen: pending || expedition.pending ? 'receipt' : trip || expedition.active ? 'journey' : entry?.view === 'journal' ? 'journal' : entry?.view === 'camp' ? 'growth' : initialSelection ? 'prepare' : 'home', selection: initialSelection, mode: entry?.view === 'idle' ? 'idle' : 'manual', target: entry && entry.view !== 'journal' ? entry.target : undefined }, leave);
  const [overlay, setOverlay] = useState<Exclude<AdventureStoragePanel, 'pack'> | 'return'>();
  const [bag, setBag] = useState<Inventory>({});
  const mainRef = useRef<HTMLElement>(null), scrollPositions = useRef<Record<string, number>>({});
  const scrollKey = `${nav.screen}:${nav.mode}:${typeof nav.selection === 'object' ? nav.selection.region : nav.selection ?? ''}:${nav.screen === 'prepare' ? JSON.stringify(nav.selection) + (nav.target ?? '') : ''}`;
  useLayoutEffect(() => { if (mainRef.current) mainRef.current.scrollTop = scrollPositions.current[scrollKey] ?? 0; }, [scrollKey]);
  const action = useAdventureAction(), capacity = getExplorationBagCapacity(pet), busy = action.phase !== 'idle';
  const selection = nav.selection === 'tutorial' ? undefined : nav.selection;
  const destination = nav.selection === 'tutorial' ? 'tutorial' : selection?.node ? selection.region : undefined;
  const purpose = selection?.node ? landmarkId(selection.region, selection.node) : undefined;
  const region = selection ? expeditionRegionForMap[selection.region] : 'valley';
  const unlocked = isAdventureMapUnlocked(pet.adventure), story = mainStoryProgress(pet.adventure), recommended = nextLandmarks(pet.adventure)[0];
  const go = (screen: ExplorationNavigation['screen'], extra: Partial<ExplorationNavigation> = {}, replace = false) => { action.cancel(); navigate({ ...nav, screen, ...extra }, replace); setOverlay(undefined); };
  const openOutpost = (request: OutpostRequest) => request.view === 'journal' ? go('journal') : go(request.view === 'camp' ? 'growth' : 'prepare', { selection: { region: mapRegionForExpedition[request.region], node: request.node ?? (request.target ? 'gather' : 'entrance') }, mode: request.view === 'idle' ? 'idle' : 'manual', target: request.target });
  const openMap = (r: RegionId = region) => unlocked ? go('map', { selection: { region: mapRegionForExpedition[r] } }) : go('prepare', { selection: 'tutorial', mode: 'manual' });
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
  const depart = () => move(current => startAdventure(current, destination, actorId, actorName, bag, false, Date.now(), purpose, nav.target, roster.map(actor => actor.id)));
  useEffect(() => { if (trip || expedition.active) { navigate({ ...nav, screen: 'journey', mode: expedition.active ? 'idle' : 'manual' }, true); setBag({}); setOverlay(undefined); } }, [trip?.id, expedition.active?.id]);
  useEffect(() => { if (pending || expedition.pending) { navigate({ ...nav, screen: 'receipt' }, true); setOverlay(undefined); } }, [pending?.id, expedition.pending?.id]);
  useEffect(() => { if (trip && getAdventureBagCount(trip.loot)) setOverlay('loot'); }, [trip?.id, trip?.choices.length]);
  const requestReturn = () => {
    if (!trip) return;
    if (trip.rulesVersion < 11 && getAdventureBagCount(trip.loot)) { setOverlay('loot'); return; }
    if (trip.choices.length >= getAdventureStepCount(trip.region, trip.purpose)) move(p => returnFromAdventure(p, trip.id)); else setOverlay('return');
  };
  const primary = () => pending || expedition.pending ? go('receipt') : trip || expedition.active ? go('journey') : !unlocked ? go('prepare', { selection: 'tutorial', mode: 'manual' }) : recommended ? go('prepare', { selection: recommended, mode: 'manual' }) : openMap();
  const primaryLabel = pending || expedition.pending ? '领取上次探险收获' : trip || expedition.active ? '继续当前探险' : !unlocked ? '开始新手踩点 · 4 个阶段' : recommended ? `下一站：${landmarkNames[recommended.region][recommended.node]}` : '选择目的地';
  const expeditionProps = { pet, actorId, actorName, portrait, update, registry, icons, onUseHomeItem, onCommunity: props.onCommunity ?? leave, onKitchen: props.onKitchen, onShop: () => setOverlay('supplies') };
  return <ExplorationHandbookNavigation.Provider value={() => go('journal', { target: 'help' })}><DialogScope status={<ExplorationHarvestStatus pet={pet} interactive={false} />}><div className="exploration-app" data-screen={nav.screen} data-action-phase={action.phase}>
    <header className="exploration-header"><div className="exploration-heading"><button className="icon-button" onClick={back} aria-label={nav.screen === 'home' ? '返回小窝' : '返回上一页'}><ArrowLeft /></button><h2>{screenNames[nav.screen]}</h2><span>{pet.coins} 金币 · {pet.hearts} 心心</span></div><ExplorationHarvestStatus pet={pet} />
      {(nav.screen === 'prepare' || nav.screen === 'journey') && <div className="exploration-stat-row"><AdventureStatMeter kind="hunger" label="饱食" value={pet.hunger} max={getPetStatCap(pet)} icon={<Utensils size={14} />} /><AdventureStatMeter kind="energy" label="体力" value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={14} />} /><AdventureStatMeter kind="health" label="健康" value={pet.health} max={getPetStatCap(pet)} icon={<Heart size={14} />} /></div>}
    </header>
    <main className="exploration-main" ref={mainRef} onScroll={event => { scrollPositions.current[scrollKey] = event.currentTarget.scrollTop; }}>
      {nav.screen === 'home' && <><AdventureHall actor={shownActor} roster={roster} day={getEffectiveDailyDateKey(pet)} traveling={Boolean(traveler)} /><section className="exploration-next"><small>主线地标 {story.completed}/40 · 章节 {story.chapters}/5</small><h3>{pending || expedition.pending ? '伙伴平安归来，收获等你领取' : trip || expedition.active ? '旅途进度已经保存' : !unlocked ? '先熟悉行囊与探险操作' : '带好补给，继续探索'}</h3><p>手动探险推进地标故事与研究；完成地区全部 8 个地标并建好营地后，可安排挂机收集物产。</p><button className="primary-button" onClick={primary}><Compass size={20} />{primaryLabel}</button></section>
        {(!pet.adventure.starterClaimed || !pet.adventure.starterMealsClaimed) && <button className="secondary-button" onClick={() => update(claimAdventureStarter)}>领取入门补给 · 含料理 ×4</button>}
        <nav className="exploration-home-links"><button onClick={() => openMap()}><Map />地区地图<small>选择地标与物产</small></button><button onClick={() => go('growth')}><Tent />营地与成长<small>建设 · 背包 · 技能</small></button><button onClick={() => go('journal')}><BookOpen />旅行手册<small>记录 · 发现 · 玩法</small></button><button onClick={() => setOverlay('supplies')}><ShoppingBag />基地补给<small>料理与探险工具</small></button></nav>
        {regionIds.filter(id => expedition.regions[id].surveyed).map(id => <section className="exploration-camp-prompt" key={id}><strong>{regions[id].name} · 8/8 地标已完成</strong><button onClick={() => openOutpost({ view: expedition.regions[id].base ? 'idle' : 'camp', region: id })}>{expedition.regions[id].base ? '安排挂机采集' : '建设营地，开启挂机'}</button></section>)}</>}
      {nav.screen === 'map' && <AdventureMap embedded adventure={pet.adventure} pet={pet} icons={icons} registry={registry} onOutpost={openOutpost} selection={selection} portrait={portrait} onSelect={value => navigate({ ...nav, selection: value, target: undefined }, true)} mode={nav.mode} onMode={mode => navigate({ ...nav, mode }, true)} onResume={() => go('journey')} onCollect={() => go('receipt')} onClose={back} onPrepare={() => go('prepare')} />}
      {nav.screen === 'prepare' && <section className="exploration-preparation"><div className="help-heading"><h3>{nav.mode === 'idle' ? `${regions[region].name} · 挂机探索` : adventureJourneyName(destination, purpose)}</h3><ExplorationHelp pet={pet} destination={destination} purpose={purpose} mode={nav.mode} /></div><div className="exploration-inline-actions"><button onClick={() => openMap()}>更换目的地</button><button onClick={() => setOverlay('supplies')}>购买补给与工具</button></div>
        {nav.mode === 'manual' ? <AdventurePreparation embedded pet={pet} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} onPack={changeBag} onDepart={depart} onClose={back} onUseHomeItem={onUseHomeItem} perform={fn => { if (!busy) fn(); }} update={update} /> : <IdleExpeditionPreparation key={region} embedded {...expeditionProps} initialRegion={region} initialTarget={nav.target} onMap={openMap} onCamp={r => openOutpost({ view: 'camp', region: r })} onRoute={(r, target) => openOutpost({ view: 'manual', region: r, target })} />}</section>}
      {nav.screen === 'journey' && (trip ? <><p className="exploration-trip-progress">{adventureJourneyName(trip.region, trip.purpose)} · {trip.choices.length}/{getAdventureStepCount(trip.region, trip.purpose)} 阶段</p><AdventureJourneyView key={trip.id} pet={pet} portrait={shownActor.portrait} neighbor={neighbor} update={update} move={move} busy={busy} onStorage={storage} onReturn={requestReturn} /></> : expedition.active ? <ExpeditionJourney {...expeditionProps} /> : <section><p>行程已结束。</p><button onClick={() => go(pending || expedition.pending ? 'receipt' : 'home')}>查看收获与下一站</button></section>)}
      {nav.screen === 'receipt' && (pending ? <section className="exploration-receipt"><h3>{pending.returnReason === 'health' ? '健康不足，已安全返程' : pending.complete ? '探险成功，欢迎回来' : '平安归来'}</h3><p>{adventureJourneyName(pending.region, pending.purpose)} · {pending.steps} 个阶段{pending.first ? ' · 首次完成' : ''}</p>{pending.salvage ? <AdventureReturnSelection key={pending.id} capacity={capacity} result={pending} registry={registry} update={update} /> : <><p>金币 {pending.rewardsClaimed ? pending.coinsRemaining ?? 0 : pending.coins} · 心心 {pending.rewardsClaimed ? 0 : pending.hearts}</p><div className="exploration-item-list">{Object.entries(pending.items).filter(([, n]) => n > 0).map(([id, n]) => <div key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span>{registry.get(id)?.name ?? id}</span><b>×{n}</b></div>)}</div><button className="primary-button" onClick={() => update(p => claimAdventureResult(p, pending.id))}><Backpack />{pending.rewardsClaimed ? '领取剩余物品' : '领取收获'}</button><p>仓库暂时装不下的物品会继续保留。</p></>}</section> : expedition.pending ? <ExpeditionJourney {...expeditionProps} /> : <section className="exploration-next"><h3>收获已入库</h3><p>{pet.recentEvent}</p><button className="primary-button" onClick={primary}>{primaryLabel}</button>{regionIds.filter(id => expedition.regions[id].surveyed && !expedition.regions[id].base).map(id => <button key={id} onClick={() => openOutpost({ view: 'camp', region: id })}>建设{regions[id].name}营地，开启挂机</button>)}</section>)}
      {nav.screen === 'growth' && <><label className="exploration-region-select">地区<select value={region} onChange={e => navigate({ ...nav, selection: { region: mapRegionForExpedition[e.target.value as RegionId] } }, true)}>{regionIds.map(id => <option value={id} key={id}>{regions[id].name}</option>)}</select></label><ExpeditionCamp pet={pet} update={update} region={region} onMap={() => openMap(region)} onGather={() => openOutpost({ view: 'manual', region, target: 'materials' })} onIdle={() => openOutpost({ view: 'idle', region })} /><ExplorationBackpackUpgrade pet={pet} update={update} /><section className="exploration-growth"><h3>技能与探索收益 · 第 {getExplorationTier(pet)} 档</h3>{(['study', 'garden', 'exercise', 'cooking'] as const).map(skill => <p key={skill}><strong>{explorationSkillNames[skill]} Lv.{pet.partnerSchedule.skills[skill].level}</strong> · {skill === 'cooking' ? `自动补给费用 −${pet.partnerSchedule.skills[skill].level * 3}%` : `对应动作体力 −${pet.partnerSchedule.skills[skill].level * 4}%、饱食 −${pet.partnerSchedule.skills[skill].level * 2}%`}</p>)}<p>学习用于调查，园艺用于采集，运动用于越障。对应安全选项和工具动作同样获得减免。</p></section></>}
      {nav.screen === 'journal' && <TravelJournal embedded key={nav.target === 'help' ? 'help' : 'records'} initialTab={nav.target === 'help' ? 'help' : 'records'} pet={pet} onClose={back} onMap={() => openMap()} onReceipt={() => go('receipt')} />}
    </main>
    <nav className="exploration-bottom-nav" aria-label="探险导航"><button aria-current={nav.screen === 'home' ? 'page' : undefined} onClick={() => go('home')}>前哨</button><button aria-current={nav.screen === 'map' ? 'page' : undefined} onClick={() => openMap()}>地图</button><button aria-current={nav.screen === 'growth' ? 'page' : undefined} onClick={() => go('growth')}>成长</button><button aria-current={nav.screen === 'journal' ? 'page' : undefined} onClick={() => go('journal')}>手册</button></nav>
    {overlay && overlay !== 'return' && <AdventureStorage panel={overlay} pet={pet} registry={registry} icons={icons} bag={bag} destination={destination} purpose={purpose} onPack={changeBag} onDepart={depart} onPanel={storage} onClose={() => setOverlay(undefined)} onBuy={onBuy} onUseHomeItem={onUseHomeItem} update={update} />}
    {overlay === 'return' && trip && <DialogShell role="alertdialog" className="exploration-confirm-sheet" labelId="exploration-return-title" onClose={() => setOverlay(undefined)}><header><h3 id="exploration-return-title">提前返回前哨</h3><button className="icon-button" aria-label="取消返程" onClick={() => setOverlay(undefined)}><X /></button></header><div className="exploration-sheet-body"><p>保留当前行囊、已获得的采集奖励与研究进度。本次未完成的地标不会获得首次完成奖励。</p><p>已经完成 {trip.choices.length}/{getAdventureStepCount(trip.region, trip.purpose)} 阶段；返程不额外消耗。</p></div><footer><button data-dialog-autofocus onClick={() => setOverlay(undefined)}>继续探险</button><button className="primary-button" onClick={() => { move(p => returnFromAdventure(p, trip.id)); setOverlay(undefined); }}>确认返程</button></footer></DialogShell>}
  </div></DialogScope></ExplorationHandbookNavigation.Provider>;
};
