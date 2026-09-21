import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Fish, Leaf, MapPin, Sprout, X, Zap } from 'lucide-react';
import { getAdventureGrowthSources } from '../core/adventureGrowth';
import { getCommunityTasks, canClaimCommunityTask } from '../core/communityCommissions';
import { facilityAvailable, fishIds, waterIds, isWaterOpen } from '../core/communityData';
import { getGardenReminder } from '../core/garden';
import { canSpendCompanionTime } from '../core/kitchen';
import { gardenCompensationRewardId } from '../core/petState';
import { getPetEnergyCap } from '../core/petStats';
import { getValleyQuestReason, valleyQuestIds, valleyQuests } from '../core/valleyQuests';
import type { CommunityRoute, FacilityId, WaterId } from '../core/communityTypes';
import type { ItemRegistry, PetState } from '../core/petTypes';
import type { RecipeId } from '../core/companionActivityTypes';
import { DialogShell } from './DialogShell';
import { CommunityFacilities } from './community/CommunityFacilities';
import { CommunityFarm } from './community/CommunityFarm';
import { CommunityField } from './community/CommunityField';
import { CommunityFishing } from './community/CommunityFishing';
import { FishingDialog } from './community/FishingDialog';
import { CommunityBoard } from './community/CommunityBoard';
import { CommunityMarket } from './community/CommunityMarket';
import { CommunitySceneArt } from './community/CommunitySceneArt';
import '../styles/community.css';
import '../styles/community-places.css';
import '../styles/valley-loop.css';
import { CommunityValleyProgress } from './community/CommunityValleyProgress';
import { canClaimSpecialtyOrder } from '../core/communitySpecialtyOrders';
import type { OutpostRequest } from './outpostNavigation';
import { TreasureDisplay, DecorationDetail, DecorationScene, DecorationCorner } from './community/TreasureDisplay';
import type { CommunityDecorationId } from '../core/regionalTreasures';
import { getDecorationLevel } from '../core/decorationEffects';
import '../styles/decorations.css';

interface Props {
  pet: PetState; portrait: string; update: (action: (pet: PetState) => PetState) => void;
  actorId?: string; actorName?: string;
  onBack: () => void; onExplore: (purpose: CommunityRoute) => void; onKitchen: (recipe?: RecipeId) => void; onShop: () => void; orchard: ReactNode;
  initialTab?: CommunityTab; initialPlace?: CommunityPlace; tab?: CommunityTab; onTabChange?: (tab: CommunityTab) => void;
  place?: CommunityPlace | null; onPlaceChange?: (place: CommunityPlace | null) => void;
  registry?: ItemRegistry; itemIconMap?: Partial<Record<string, string>>; onOpenOutpost?: (request: OutpostRequest) => void; onAdventure?: () => void;
}
// Retain previous navigation values for callers; operations now live in dialogs.
export type CommunityTab = 'village' | 'board' | 'field' | 'farm' | 'fishing' | 'market';
export type CommunityPlace = 'field' | 'orchard' | 'coop' | 'barn' | 'hut' | 'hut_manage' | 'pond' | 'upstream' | 'fishbook' | 'board' | 'market' | 'journey' | 'growth' | 'kitchen';
type Place = CommunityPlace;
const fishingPlaces: readonly Place[] = ['hut', 'hut_manage', 'pond', 'upstream', 'fishbook', 'kitchen'];
const titles: Record<Place, string> = { field: '水渠与菜地', orchard: '果园', coop: '鸡舍', barn: '牛棚', hut: '钓鱼小屋', hut_manage: '小屋建设与水域', pond: '栈桥垂钓', upstream: '溪流上游', fishbook: '鱼类手账', board: '邻里公告板', market: '溪畔小摊', journey: '旅途与日常', growth: '旅途留下的成长', kitchen: '水边的料理' };

export const CommunityPage = ({ pet, portrait, actorId = 'official.furo', actorName = pet.name, update, onBack, onExplore, onKitchen, onShop, orchard, initialTab = 'village', initialPlace, tab: controlledTab, onTabChange, place: controlledPlace, onPlaceChange, registry, itemIconMap, onOpenOutpost, onAdventure }: Props) => {
  const [localTab, setLocalTab] = useState<CommunityTab>(initialPlace && fishingPlaces.includes(initialPlace) ? 'fishing' : initialTab);
  const [selectedDecoration, setSelectedDecoration] = useState<CommunityDecorationId | null>(null);
  const tab = controlledTab ?? localTab;
  const [localPanel, setLocalPanel] = useState<Place | null>(() => initialPlace ?? (['field', 'board', 'market'].includes(tab) ? tab as Place : null));
  const panel = controlledPlace !== undefined ? controlledPlace : localPanel;
  const setPanel = (next: Place | null) => { setLocalPanel(next); onPlaceChange?.(next); };
  const c = pet.community, fishing = tab === 'fishing', free = canSpendCompanionTime(pet);
  const setTab = (next: CommunityTab) => { setLocalTab(next); onTabChange?.(next); };
  const changeScene = (next: CommunityTab) => { setTab(next); setPanel(null); };
  const openPlace = (next: Place) => { setTab(fishingPlaces.includes(next) ? 'fishing' : 'village'); setPanel(next); };
  const visitWater = (water: WaterId = 'pond') => openPlace(water === 'upstream' ? 'upstream' : 'pond');
  const goKitchen = (recipe?: RecipeId) => { setPanel(null); onKitchen(recipe); };
  const panelProps = { pet, update, onExplore, onKitchen: goKitchen, onShop, registry, itemIconMap, onAdventure: onAdventure ? () => { setPanel(null); onAdventure(); } : undefined, onOpenOutpost: onOpenOutpost ? (request: OutpostRequest) => { setPanel(null); onOpenOutpost(request); } : undefined };
  const mapUnlocked = (pet.adventure.completed.tutorial ?? 0) > 0;
  const tasks = getCommunityTasks(pet), readyTasks = tasks.filter(task => canClaimCommunityTask(pet, task)).length + Number(canClaimSpecialtyOrder(pet));
  const activeTasks = tasks.length + Number(Boolean(c.specialtyOrders.active));
  const builtCount = Number(c.gardenBuilt) + Object.values(c.facilities).filter(value => value.built).length;
  const matureCount = c.plots.filter(plot => plot.crop && plot.crop.readyAt <= Date.now()).length, mature = matureCount > 0;
  const orchardReminder = getGardenReminder(pet);
  const orchardGiftReady = orchardReminder === 'ready' || !pet.claimedRewardIds.includes(gardenCompensationRewardId);
  const orchardStatus = orchardReminder === 'ready' ? '果实待收' : orchardGiftReady ? '补偿待领取' : orchardReminder === 'withered' ? '需要照顾' : '照顾果树';
  const facilityStatus = (id: FacilityId) => {
    const f = c.facilities[id];
    return f.built ? '已开放' : !facilityAvailable(pet, id) ? '查看剧情与前置' : '可交付建材';
  };
  const animalStatus = (id: 'coop' | 'barn') => !c.facilities[id].built ? facilityStatus(id) : c.animals[id].stock ? `待收 ${c.animals[id].stock} 份` : c.animals[id].feed ? '正在生产' : '等待饲料';
  const fieldStatus = !c.gardenBuilt ? '踩点结算后免费开放' : mature ? `${matureCount} 块可以收获` : `${c.plots.filter(plot => plot.crop).length}/${c.plots.length} 块生长中`;
  const fishStatus = c.fishing.pending ? '鱼获待收' : c.fishing.active?.mode === 'idle' ? `挂机钓鱼 · ${c.fishing.active.settledCasts}/${c.fishing.active.plannedCasts} 条` : c.fishing.active ? '继续这一竿' : c.facilities.fishing_hut.built ? '准备抛竿' : '先修小屋';
  const adventure = () => { setPanel(null); onAdventure?.(); };
  const nextQuest = valleyQuestIds.find(id => !getValleyQuestReason(pet.adventure, id));
  const next = !mapUnlocked ? { title: '和伙伴完成第一次踩点', detail: '到前哨基地走完四个节点，展开溪谷地图。', label: '去前哨基地', action: adventure }
    : !c.herbDiscovered ? { title: '把溪谷香草带回家', detail: '菜地已免费开放，去溪谷完成水渠故事，取得香草种子与配方。', label: '打开溪谷地图', action: adventure }
        : !c.firstOrderDelivered ? { title: '给邻居留一碗暖粥', detail: '种下香草，收获后用香草和大米做一碗暖粥。', label: pet.inventory.dish_herb_porridge ? '去交付暖粥' : '照顾菜地', action: () => openPlace(pet.inventory.dish_herb_porridge ? 'board' : 'field') }
          : !c.facilities.fishing_hut.built ? { title: '点亮水边的小屋', detail: '小屋建成就有普通钓竿。准备鱼饵，开始第一竿。', label: '看看钓鱼小屋', action: () => openPlace('hut') }
            : !Object.keys(c.fishing.journal).length ? { title: '把第一条鱼写进手账', detail: '点击栈桥准备鱼饵；成功的鱼获可做料理、交单或出售。', label: '去栈桥', action: () => visitWater() }
              : !pet.adventure.valleyCompleted.includes('valley_camp') ? { title: '走完溪谷的约定', detail: nextQuest ? valleyQuests[nextQuest].summary : '在地图查看前置，沿两条支路继续探索。', label: '打开溪谷地图', action: adventure }
                : !c.expedition.regions.valley.base ? { title: '给下一次远行留个落脚点', detail: '修好温室休息间，开放 2／4／8 小时挂机探索。', label: '去建设基地', action: () => onOpenOutpost?.({ view: 'camp', region: 'valley' }) }
                  : !(c.expedition.loop?.idleCompleted ?? 0) ? { title: '让伙伴带回一篮溪谷收获', detail: '先接一份高价收购，再按需要安排挂机目标。', label: '看看特产收购', action: () => openPlace('board') }
                    : !c.decorations.includes('creek_fountain') ? { title: '把一束溪光留在农场', detail: '累计勘探海蓝宝，用它与石料制作溪光水景。', label: pet.inventory.creek_aquamarine ? '去制作溪光水景' : '去溪谷勘探', action: () => pet.inventory.creek_aquamarine ? openPlace('journey') : onOpenOutpost?.({ view: 'route', region: 'valley', target: 'aquamarine' }) }
                      : { title: readyTasks ? '邻居的酬谢已经备好' : '今天想帮谁一点忙', detail: '邻里委托每日 2 单，特产收购每日另接 1 单；已接任务不过期。', label: '看看公告板', action: () => openPlace('board') };
  const hotspot = (id: Place, name: string, status: string, x: number, y: number, ready = false) => {
    const entersFishing = id === 'hut' && !fishing;
    const destination = entersFishing ? '进入钓鱼小屋' : '打开地点窗口';
    return <button key={id} type="button" className="community-place" data-place={id} data-ready={ready} style={{ '--place-x': `${x}%`, '--place-y': `${y}%` } as CSSProperties} aria-label={`${name}，${status}，${destination}`} aria-haspopup={entersFishing ? undefined : 'dialog'} onClick={() => entersFishing ? changeScene('fishing') : openPlace(id)}><span className="community-place-dot"><MapPin size={14} /></span><strong>{name}</strong><small>{status}</small></button>;
  };
  const places = fishing ? <>
    {hotspot('hut', '钓鱼小屋', facilityStatus('fishing_hut'), 20, 48)}
    {hotspot('pond', '池塘栈桥', fishStatus, 47, 73, Boolean(c.fishing.pending || c.fishing.active))}
    {hotspot('upstream', '上游步道', facilityStatus('upstream'), 80, 28)}
    {hotspot('fishbook', '鱼类手账', `${Object.keys(c.fishing.journal).length}/${fishIds.length} 种`, 85, 85)}
    {hotspot('kitchen', '水边料理', '鱼获与香草', 18, 85)}
  </> : <>
    {hotspot('orchard', '果园', orchardStatus, 18, 27, orchardGiftReady)}
    {hotspot('coop', '鸡舍', animalStatus('coop'), 49, 32, c.animals.coop.stock > 0)}
    {hotspot('barn', '牛棚', animalStatus('barn'), 83, 33, c.animals.barn.stock > 0)}
    {hotspot('field', '菜地与水渠', fieldStatus, 22, 60, mature)}
    {hotspot('board', '邻里告示牌', readyTasks ? `${readyTasks} 单可交付` : `${activeTasks} 单进行中`, 53, 81, readyTasks > 0)}
    {hotspot('hut', '钓鱼小屋', fishStatus, 81, 68, Boolean(c.fishing.pending || c.fishing.active))}
    {hotspot('market', '溪畔小摊', c.market.open ? '营业中' : c.market.level ? '整理货架' : '修复与回收', 19, 87)}
  </>;
  let content: ReactNode;
  const fishingPanel = c.facilities.fishing_hut.built && (panel === 'hut' || panel === 'pond' || panel === 'upstream' && c.facilities.upstream.built);
  if (panel === 'field') content = <CommunityField {...panelProps} />;
  else if (panel === 'orchard') content = orchard;
  else if (panel === 'coop' || panel === 'barn') content = c.facilities[panel].built ? <CommunityFarm {...panelProps} only={panel} /> : <CommunityFacilities {...panelProps} only={panel} />;
  else if (panel === 'hut_manage') content = c.facilities.fishing_hut.built ? <><CommunityFishing {...panelProps} view="management" /><button className="secondary-button" onClick={() => openPlace('upstream')}>查看上游步道</button></> : <CommunityFacilities {...panelProps} only="fishing_hut" />;
  else if (panel === 'hut' || panel === 'pond' || panel === 'upstream') content = !c.facilities.fishing_hut.built ? <CommunityFacilities {...panelProps} only="fishing_hut" /> : <CommunityFacilities {...panelProps} only="upstream" />;
  else if (panel === 'fishbook' || panel === 'kitchen') content = <CommunityFishing {...panelProps} view={panel === 'fishbook' ? 'journal' : 'recipes'} />;
  else if (panel === 'board') content = <CommunityBoard {...panelProps} onFishing={visitWater} onFarm={openPlace} />;
  else if (panel === 'market') content = c.facilities.stall.built ? <CommunityMarket {...panelProps} /> : <CommunityFacilities {...panelProps} only="stall" />;
  else if (panel === 'growth') content = <section className="community-card"><p>首次成果永久增加体力上限，通过休息恢复新增容量。</p>{getAdventureGrowthSources(pet).filter(source => source.achieved || !source.id.startsWith('project_')).map(source => <div className="community-growth-row" key={source.id} data-done={source.achieved}><span>{source.achieved ? '✓' : '○'} {source.name}</span><b>+{source.energy}</b></div>)}</section>;
  else if (panel === 'journey') content = <><section className="community-card"><h3>从前哨出发，把收获带回农场</h3><p>地图里继续故事、采集与营地建设；回到农场，交付订单或制作收藏。</p><div className="community-actions"><button className="primary-button" disabled={!onAdventure} onClick={adventure}>去前哨基地</button>{onOpenOutpost && <><button className="secondary-button" onClick={() => panelProps.onOpenOutpost?.({ view: 'idle', region: 'valley' })}>安排挂机探索</button><button className="secondary-button" onClick={() => panelProps.onOpenOutpost?.({ view: 'journal' })}>旅行日志</button></>}<button className="secondary-button" onClick={() => setPanel('growth')}>旅途留下的成长</button></div></section><TreasureDisplay pet={pet} onSelect={setSelectedDecoration} /><CommunityValleyProgress {...panelProps} onAdventure={adventure} onOpen={openPlace} /></>;

  return <section className="community-page">
    <header className="community-header"><button className="icon-button" onClick={fishing ? () => changeScene('village') : onBack} aria-label={fishing ? '返回农场' : '返回小窝'}><ArrowLeft /></button><div><small>沿着溪流，慢慢生活</small><h2>{fishing ? '钓鱼小屋' : '溪畔农场'}</h2></div><span className="community-energy" aria-label={`体力 ${Math.floor(pet.energy)}/${getPetEnergyCap(pet)}`}><Zap size={16} />{Math.floor(pet.energy)}/{getPetEnergyCap(pet)}</span></header>
    <div className="community-scene-heading"><div><small>{fishing ? '溪水送来的一点闲暇' : '每一次发现，都在这里生长'}</small><h1>{fishing ? '风很轻，今天钓点什么？' : c.gardenBuilt ? '菜地有了水，日子慢慢热闹。' : '从一条水渠，开始新的日常。'}</h1></div><span className="community-season"><Leaf size={15} />{fishing ? `水域 ${waterIds.filter(id => isWaterOpen(pet, id)).length}/${waterIds.length} 已直通` : `已开放 ${builtCount}/6 处`}</span></div>
    <div className="community-scene-layout"><div className="community-scene-card"><div className="community-place-scene" data-scene={fishing ? 'fishing' : 'farm'}><CommunitySceneArt community={c} fishing={fishing} />{portrait && <img className="community-scene-companion" src={portrait} alt={pet.name} />}{places}<DecorationScene pet={pet} fishing={fishing} onSelect={setSelectedDecoration} /></div>{!fishing && <DecorationCorner pet={pet} onSelect={setSelectedDecoration} />}<footer><MapPin size={15} />点击地点，查看修复、收获和正在发生的事。</footer></div>
      <aside className="community-today"><section className="community-card community-next"><small>接下来，一起做这件事</small><h3>{next.title}</h3><p>{next.detail}</p><button className="primary-button" disabled={next.action === adventure && !onAdventure} onClick={next.action}>{next.label}<ArrowRight size={16} /></button></section><section className="community-card"><h3>今天的小收获</h3><button className="community-status-link" data-tone="mint" onClick={() => openPlace('field')}><Sprout size={16} /><span>菜地<small>{fieldStatus}</small></span>{mature && <Check size={16} />}</button><button className="community-status-link" data-tone="sky" onClick={() => visitWater(c.fishing.active?.water)}><Fish size={16} /><span>水边<small>{fishStatus}</small></span></button><button className="community-status-link" data-tone="lilac" onClick={() => openPlace('board')}><BookOpen size={16} /><span>邻里委托<small>{readyTasks ? `${readyTasks} 单待交付` : `${activeTasks} 单进行中 · 邻里 2 单＋特产 1 单`}</small></span></button><button className="community-status-link" data-tone="gold" onClick={() => openPlace('journey')}><Compass size={16} /><span>旅途与日常<small>{pet.adventure.valleyCompleted.length}/7 段故事</small></span></button></section></aside>
    </div>
    {!free && <p className="community-note">伙伴正在休息或忙碌，可以先看看场景与任务。{c.fishing.active && <button className="text-button" onClick={() => visitWater(c.fishing.active?.water)}>回到当前鱼竿</button>}</p>}
    <p className="community-event" role={panel ? undefined : 'status'}>{pet.recentEvent}</p>
    {fishing && <div className="community-actions"><button className="secondary-button" onClick={() => openPlace('hut_manage')}>小屋建设与水域</button><button className="secondary-button" onClick={() => openPlace('fishbook')}>鱼类手账与金冠</button></div>}
    {fishingPanel && <FishingDialog {...panelProps} portrait={portrait} actorId={actorId} actorName={actorName} initialWater={c.fishing.active?.water ?? c.fishing.pending?.water ?? (panel === 'upstream' ? 'upstream' : 'pond')} onClose={() => setPanel(null)} onManage={() => openPlace('hut_manage')} onShop={() => { setPanel(null); onShop(); }} />}
    {selectedDecoration && <DecorationDetail key={`${selectedDecoration}:${getDecorationLevel(pet, selectedDecoration)}`} pet={pet} update={update} id={selectedDecoration} onClose={() => setSelectedDecoration(null)} onOpenOutpost={panelProps.onOpenOutpost ? request => { setSelectedDecoration(null); panelProps.onOpenOutpost?.(request); } : undefined} />}
    {panel && !fishingPanel && <DialogShell fullscreen className="community-place-dialog" backdropClassName="community-modal-backdrop" labelId="community-place-title" onClose={() => setPanel(null)}><header><div><small>{fishingPlaces.includes(panel) ? '钓鱼小屋' : '溪畔农场'}</small><h2 id="community-place-title">{titles[panel]}</h2></div><button className="icon-button" onClick={() => setPanel(null)} aria-label="关闭地点窗口，返回场景"><X size={21} /></button></header><div className="community-dialog-content">{panel !== 'orchard' && !mapUnlocked && <p className="community-note">先去前哨完成踩点探索，就能在溪谷寻找建设线索。{onAdventure && <button className="text-button" onClick={adventure}>去前哨基地</button>}</p>}{!free && <p className="community-note">伙伴正在休息或忙碌；生产和建设操作会在空闲时开放。</p>}{content}</div></DialogShell>}
  </section>;
};
