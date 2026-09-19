import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Fish, Leaf, MapPin, ShoppingBag, Sprout, X, Zap } from 'lucide-react';
import { getAdventureGrowthSources } from '../core/adventureGrowth';
import { getCommunityTasks, canClaimCommunityTask } from '../core/communityCommissions';
import { facilityAvailable } from '../core/communityData';
import { canSpendCompanionTime } from '../core/kitchen';
import { getPetEnergyCap } from '../core/petStats';
import { getValleyQuestReason, valleyQuestIds, valleyQuests } from '../core/valleyQuests';
import type { CommunityRoute, FacilityId, WaterId } from '../core/communityTypes';
import type { ItemRegistry, PetState } from '../core/petTypes';
import type { RecipeId } from '../core/companionActivityTypes';
import { DialogShell } from './DialogShell';
import { CommunityFacilities } from './community/CommunityFacilities';
import { CommunityFarm } from './community/CommunityFarm';
import { CommunityField, CommunityWarmOrder } from './community/CommunityField';
import { CommunityFishing } from './community/CommunityFishing';
import { CommunityBoard } from './community/CommunityBoard';
import { CommunityMarket } from './community/CommunityMarket';
import { CommunitySceneArt } from './community/CommunitySceneArt';
import { timeLeft } from './community/types';
import '../styles/community.css';

interface Props {
  pet: PetState; portrait: string; update: (action: (pet: PetState) => PetState) => void;
  onBack: () => void; onExplore: (purpose: CommunityRoute) => void; onKitchen: (recipe?: RecipeId) => void; onShop: () => void; onGarden: () => void;
  initialTab?: CommunityTab; initialPlace?: CommunityPlace; tab?: CommunityTab; onTabChange?: (tab: CommunityTab) => void;
  registry?: ItemRegistry; onExpedition?: () => void; onAdventure?: () => void;
}
// Retain previous navigation values for callers; operations now live in dialogs.
export type CommunityTab = 'village' | 'board' | 'field' | 'farm' | 'fishing' | 'market';
export type CommunityPlace = 'field' | 'orchard' | 'coop' | 'barn' | 'hut' | 'pond' | 'upstream' | 'fishbook' | 'board' | 'market' | 'journey' | 'growth' | 'kitchen';
type Place = CommunityPlace;
const titles: Record<Place, string> = { field: '水渠与菜地', orchard: '果园', coop: '鸡舍', barn: '牛棚', hut: '钓鱼小屋', pond: '栈桥垂钓', upstream: '溪流上游', fishbook: '鱼类手账', board: '邻里公告板', market: '溪畔小摊与工会回收', journey: '溪谷与日常', growth: '旅途留下的成长', kitchen: '水边的料理' };

export const CommunityPage = ({ pet, portrait, update, onBack, onExplore, onKitchen, onShop, onGarden, initialTab = 'village', initialPlace, tab: controlledTab, onTabChange, registry, onExpedition, onAdventure }: Props) => {
  const [localTab, setLocalTab] = useState<CommunityTab>(initialPlace && ['pond', 'upstream', 'fishbook', 'kitchen'].includes(initialPlace) ? 'fishing' : initialTab);
  const tab = controlledTab ?? localTab;
  const [panel, setPanel] = useState<Place | undefined>(() => initialPlace ?? (['field', 'board', 'market'].includes(tab) ? tab as Place : undefined));
  const c = pet.community, fishing = tab === 'fishing', free = canSpendCompanionTime(pet);
  const setTab = (next: CommunityTab) => { setLocalTab(next); onTabChange?.(next); };
  const changeScene = (next: CommunityTab) => { setTab(next); setPanel(undefined); };
  const visitWater = (water: WaterId = 'pond') => { setTab('fishing'); setPanel(water); };
  const goKitchen = (recipe?: RecipeId) => { setPanel(undefined); onKitchen(recipe); };
  const panelProps = { pet, update, onExplore, onKitchen: goKitchen, onShop, registry };
  const mapUnlocked = (pet.adventure.completed.tutorial ?? 0) > 0;
  const tasks = getCommunityTasks(pet), readyTasks = tasks.filter(task => canClaimCommunityTask(pet, task)).length;
  const builtCount = Number(c.gardenBuilt) + Object.values(c.facilities).filter(value => value.built).length;
  const mature = Boolean(c.crop && c.crop.readyAt <= Date.now());
  const facilityStatus = (id: FacilityId) => {
    const f = c.facilities[id];
    return f.built ? '已开放' : !facilityAvailable(pet, id) ? '等待前置' : !f.found ? '寻找线索' : f.work < 2 ? `修复 ${f.work}/2` : '可投入建材';
  };
  const animalStatus = (id: 'coop' | 'barn') => !c.facilities[id].built ? facilityStatus(id) : c.animals[id].stock ? `待收 ${c.animals[id].stock} 份` : c.animals[id].feed ? '正在生产' : '等待饲料';
  const fieldStatus = !c.gardenBuilt ? c.irrigationFound ? '修渠与建设' : '寻找阀芯' : mature ? '可以收获' : c.crop ? timeLeft(c.crop.readyAt) : '可以播种';
  const fishStatus = c.fishing.pending ? '鱼获待收' : c.fishing.active ? '继续这一竿' : c.facilities.fishing_hut.built ? '准备抛竿' : '先修小屋';
  const adventure = () => { setPanel(undefined); onAdventure?.(); };
  const nextQuest = valleyQuestIds.find(id => !getValleyQuestReason(pet.adventure, id));
  const next = !mapUnlocked ? { title: '和伙伴完成第一次踩点', detail: '到前哨基地走完四个节点，展开溪谷地图。', label: '去前哨基地', action: adventure }
    : !c.irrigationFound ? { title: '找到那枚灌溉阀芯', detail: '溪谷的常驻搜寻可以带回线索与种子。', label: '查看菜地', action: () => setPanel('field') }
      : !c.gardenBuilt ? { title: '让水流回菜地', detail: '清理杂草、疏通水渠，备齐木石后开放第一块田。', label: '一起修复', action: () => setPanel('field') }
        : !c.firstOrderDelivered ? { title: '给邻居留一碗暖粥', detail: '种下香草，收获后先留种，再用香草和大米做一碗暖粥。', label: pet.inventory.dish_herb_porridge ? '去交付暖粥' : '照顾菜地', action: () => setPanel(pet.inventory.dish_herb_porridge ? 'board' : 'field') }
          : !c.facilities.fishing_hut.built ? { title: '点亮水边的小屋', detail: '小屋建成就有普通钓竿。准备鱼饵，开始第一竿。', label: '看看钓鱼小屋', action: () => { setTab('fishing'); setPanel('hut'); } }
            : !Object.keys(c.fishing.journal).length ? { title: '把第一条鱼写进手账', detail: '点击栈桥准备鱼饵；成功的鱼获可做料理、交单或出售。', label: '去栈桥', action: () => visitWater() }
              : !pet.adventure.valleyCompleted.includes('valley_camp') ? { title: '走完溪谷的约定', detail: nextQuest ? valleyQuests[nextQuest].summary : '在地图查看前置，沿两条支路继续探索。', label: '打开溪谷地图', action: adventure }
                : { title: readyTasks ? '邻居的酬谢已经备好' : '今天想帮谁一点忙', detail: '接两份喜欢的委托，留下自用的收获，把余量带去小摊。', label: '看看公告板', action: () => setPanel('board') };
  const hotspot = (id: Place, name: string, status: string, x: number, y: number, ready = false) => <button key={id} type="button" className="community-place" data-place={id} data-ready={ready} style={{ '--place-x': `${x}%`, '--place-y': `${y}%` } as CSSProperties} aria-label={`${name}，${status}，打开地点窗口`} aria-haspopup="dialog" onClick={() => setPanel(id)}><span className="community-place-dot"><MapPin size={14} /></span><strong>{name}</strong><small>{status}</small></button>;
  const places = fishing ? <>
    {hotspot('hut', '钓鱼小屋', facilityStatus('fishing_hut'), 20, 48)}
    {hotspot('pond', '池塘栈桥', fishStatus, 47, 73, Boolean(c.fishing.pending || c.fishing.active))}
    {hotspot('upstream', '上游步道', facilityStatus('upstream'), 80, 28)}
    {hotspot('fishbook', '鱼类手账', `${Object.keys(c.fishing.journal).length}/6 种`, 85, 85)}
    {hotspot('kitchen', '水边料理', '鱼获与香草', 18, 85)}
  </> : <>
    {hotspot('orchard', '果园', '照顾果树', 18, 27)}
    {hotspot('coop', '鸡舍', animalStatus('coop'), 49, 32, c.animals.coop.stock > 0)}
    {hotspot('barn', '牛棚', animalStatus('barn'), 83, 33, c.animals.barn.stock > 0)}
    {hotspot('field', '菜地与水渠', fieldStatus, 22, 60, mature)}
    {hotspot('board', '邻里告示牌', readyTasks ? `${readyTasks} 单可交付` : `${tasks.length} 单进行中`, 53, 81, readyTasks > 0)}
    {hotspot('hut', '水边小屋', facilityStatus('fishing_hut'), 81, 68)}
    {hotspot('market', '溪畔小摊', c.market.open ? '营业中' : c.market.level ? '整理货架' : '修复与回收', 19, 87)}
  </>;
  let content: ReactNode;
  if (panel === 'field') content = <CommunityField {...panelProps} />;
  else if (panel === 'orchard') content = <section className="community-card"><h3>果树也在等你照顾</h3><p>去看看果树的长势，浇浇水，收下成熟的果实。果园与菜地可以同时生长，收获都能带去厨房。</p><button className="primary-button" onClick={onGarden}>进入果园照顾果树</button></section>;
  else if (panel === 'coop' || panel === 'barn') content = c.facilities[panel].built ? <CommunityFarm {...panelProps} only={panel} /> : <CommunityFacilities {...panelProps} only={panel} />;
  else if (panel === 'hut') content = c.facilities.fishing_hut.built ? <section className="community-card"><h3>小屋的门一直为你开着</h3><p>钓竿、鱼饵和收获都放在共用仓库。去栈桥抛一竿，或沿步道探访上游。</p><div className="community-actions"><button className="primary-button" onClick={() => visitWater(c.fishing.active?.water)}>去栈桥 · {fishStatus}</button><button className="secondary-button" onClick={onShop}>补充鱼饵与钓具</button><button className="secondary-button" onClick={() => { setTab('fishing'); setPanel('fishbook'); }}>翻开鱼类手账</button></div></section> : <CommunityFacilities {...panelProps} only="fishing_hut" />;
  else if (panel === 'pond' || panel === 'upstream') content = !c.facilities.fishing_hut.built ? <CommunityFacilities {...panelProps} only="fishing_hut" /> : panel === 'upstream' && !c.facilities.upstream.built ? <CommunityFacilities {...panelProps} only="upstream" /> : <CommunityFishing key={panel} {...panelProps} initialWater={panel} view="controls" />;
  else if (panel === 'fishbook' || panel === 'kitchen') content = <CommunityFishing {...panelProps} view={panel === 'fishbook' ? 'journal' : 'recipes'} />;
  else if (panel === 'board') content = <><CommunityWarmOrder {...panelProps} /><CommunityBoard {...panelProps} onFishing={visitWater} onFarm={setPanel} /></>;
  else if (panel === 'market') content = <>{!c.facilities.stall.built && <CommunityFacilities {...panelProps} only="stall" />}<CommunityMarket {...panelProps} /></>;
  else if (panel === 'growth') content = <section className="community-card"><p>首次成果永久增加体力上限，通过休息恢复新增容量。</p>{getAdventureGrowthSources(pet).map(source => <div className="community-growth-row" key={source.id} data-done={source.achieved}><span>{source.achieved ? '✓' : '○'} {source.name}</span><b>+{source.energy}</b></div>)}</section>;
  else if (panel === 'journey') content = <><section className="community-card"><h3>溪谷 · 第一盏灯</h3><p>入口之后，两条支路在旧桥会合；接着探访上游和温室，跟随石芽的足迹，点亮休息间。</p><ol className="community-steps"><li data-done={Boolean(pet.adventure.completed.valley)}><span>{pet.adventure.completed.valley ? '✓' : '○'}</span>入口附近探查</li>{valleyQuestIds.map(id => <li key={id} data-done={pet.adventure.valleyCompleted.includes(id)}><span>{pet.adventure.valleyCompleted.includes(id) ? '✓' : '○'}</span><div><b>{valleyQuests[id].name}</b><small>{valleyQuests[id].outcome}</small></div></li>)}</ol><button className="primary-button" disabled={!onAdventure} onClick={adventure}>去前哨基地选择任务</button></section><section className="community-card"><h3>让每次收获都接得上下一次</h3><p>香草收获 → 留种 → 暖粥／鱼汤 → 邻里交单。鸡舍与牛棚提供蛋奶，委托和小摊的金币用于补给与建设。</p><div className="community-actions"><button className="secondary-button" onClick={() => setPanel('board')}>查看常驻与每日委托</button><button className="secondary-button" onClick={() => setPanel('growth')}>旅途留下的成长</button>{onExpedition && (pet.adventure.valleyCompleted.includes('valley_camp') || c.expedition.regions.valley.surveyed || c.expedition.active || c.expedition.pending) && <button className="secondary-button" onClick={onExpedition}>野外基地与远行</button>}</div></section></>;

  return <section className="community-page">
    <header className="community-header"><button className="icon-button" onClick={onBack} aria-label="返回小窝"><ArrowLeft /></button><div><small>沿着溪流，慢慢生活</small><h2>溪畔社区</h2></div><div className="community-wallet"><span>🪙 {pet.coins}</span><span><Zap size={16} />{Math.floor(pet.energy)}/{getPetEnergyCap(pet)}</span></div></header>
    <nav className="community-tabs" aria-label="生活场景"><button aria-current={!fishing ? 'page' : undefined} onClick={() => changeScene('village')}><Sprout size={17} />溪畔农场</button><button aria-current={fishing ? 'page' : undefined} onClick={() => changeScene('fishing')}><Fish size={17} />钓鱼小屋</button><button className="community-tab-end" onClick={() => setPanel('journey')}><BookOpen size={17} />旅途与日常</button><button onClick={onShop} aria-label="打开商店补充物资"><ShoppingBag size={17} /><span>商店</span></button></nav>
    <div className="community-scene-heading"><div><small>{fishing ? '溪水送来的一点闲暇' : '每一次发现，都在这里生长'}</small><h1>{fishing ? '风很轻，今天钓点什么？' : c.gardenBuilt ? '菜地有了水，日子慢慢热闹。' : '从一条水渠，开始新的日常。'}</h1></div><span className="community-season"><Leaf size={15} />{fishing ? '池塘 · 上游' : `已开放 ${builtCount}/6 处`}</span></div>
    <div className="community-scene-layout"><div className="community-scene-card"><div className="community-place-scene" data-scene={fishing ? 'fishing' : 'farm'}><CommunitySceneArt community={c} fishing={fishing} />{portrait && <img className="community-scene-companion" src={portrait} alt={pet.name} />}{places}</div><footer><MapPin size={15} />点击地点，查看修复、收获和正在发生的事。</footer></div>
      <aside className="community-today"><section className="community-card community-next"><small>接下来，一起做这件事</small><h3>{next.title}</h3><p>{next.detail}</p><button className="primary-button" disabled={next.action === adventure && !onAdventure} onClick={next.action}>{next.label}<ArrowRight size={16} /></button></section><section className="community-card"><h3>今天的小收获</h3><button className="community-status-link" onClick={() => setPanel('field')}><Sprout size={16} /><span>菜地<small>{fieldStatus}</small></span>{mature && <Check size={16} />}</button><button className="community-status-link" onClick={() => visitWater(c.fishing.active?.water)}><Fish size={16} /><span>水边<small>{fishStatus}</small></span></button><button className="community-status-link" onClick={() => setPanel('board')}><BookOpen size={16} /><span>邻里委托<small>{readyTasks ? `${readyTasks} 单待交付` : `${tasks.length} 单进行中 · 每日最多接 2 单`}</small></span></button><button className="community-status-link" onClick={adventure} disabled={!onAdventure}><Compass size={16} /><span>溪谷冒险线<small>{pet.adventure.valleyCompleted.length}/7 段故事</small></span></button></section></aside>
    </div>
    {!free && <p className="community-note">伙伴正在休息或忙碌，可以先看看场景与任务。{c.fishing.active && <button className="text-button" onClick={() => visitWater(c.fishing.active?.water)}>回到当前鱼竿</button>}</p>}
    <p className="community-event" role={panel ? undefined : 'status'}>{pet.recentEvent}</p>
    {panel && <DialogShell className="community-place-dialog" backdropClassName="community-modal-backdrop" labelId="community-place-title" onClose={() => setPanel(undefined)}><header><div><small>{fishing ? '钓鱼小屋' : '溪畔农场'}</small><h2 id="community-place-title">{titles[panel]}</h2></div><button className="icon-button" onClick={() => setPanel(undefined)} aria-label="关闭地点窗口，返回场景"><X size={21} /></button></header><div className="community-dialog-content"><p className="community-event" role="status">{pet.recentEvent}</p>{!mapUnlocked && <p className="community-note">先去前哨完成踩点探索，就能在溪谷寻找建设线索。{onAdventure && <button className="text-button" onClick={adventure}>去前哨基地</button>}</p>}{!free && <p className="community-note">伙伴正在休息或忙碌；生产和建设操作会在空闲时开放。</p>}{content}</div></DialogShell>}
  </section>;
};
