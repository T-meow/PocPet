import { ArrowRight, Backpack, Compass, Heart, Utensils, X, Zap } from 'lucide-react';
import { currencyIcon, unknownItemIcon } from '../assets';
import { adventureJourneyCost, getAdventureStepCount } from '../core/adventureData';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import { ExplorationBackpackUpgrade } from './expedition/ExplorationBackpackUpgrade';
import type { AdventureDestinationId } from '../core/adventureTypes';
import type { CommunityRoute } from '../core/communityTypes';
import { getAdventureStartReason } from '../core/adventure';
import { getAdventureBagCount } from '../core/adventureState';
import { activityText as L } from '../core/kitchenRecipes';
import type { Inventory, ItemId, PetState } from '../core/petTypes';
import { DialogShell } from './DialogShell';
import { PreparationInventory, type PreparationResources } from './PreparationInventory';
import { ExplorationHelp } from './help/ExplorationGuide';
import { AdventureCompanionStatus, AdventureLandscape } from './AdventurePresentation';
import type { AdventureCompanion } from './AdventureCompanions';
import { completedLandmark, isLandmarkId, parseLandmarkId, regionNames, landmarkNames } from '../core/landmarkProgress';
import { getLandmarkGatherCount, landmarkCosts, landmarkFirstReward, landmarkSummary } from '../core/landmarkData';
import { getToolUsesLeft, toolDurabilityLabel } from '../core/toolDurability';

interface Props extends PreparationResources {
  pet: PetState; bag: Inventory; destination?: AdventureDestinationId; purpose?: CommunityRoute; embedded?: boolean; actor?: AdventureCompanion;
  onPack: (id: ItemId, delta: number) => void;
  onDepart: () => void; onClose: () => void; perform: (action: () => void) => void;
  update?: (action: (pet: PetState) => PetState) => void;
}
export const AdventurePreparation = ({ pet, registry, icons, bag, destination, purpose, onPack, onDepart, onClose, onUseHomeItem, onToggleItemFavorite, perform, update, embedded, actor }: Props) => {
  const capacity = getExplorationBagCapacity(pet);
  const reason = getAdventureStartReason(pet, destination, Date.now(), purpose);
  const valid = getAdventureBagCount(bag) <= capacity && Object.entries(bag).every(([id, n]) => n <= (pet.inventory[id] ?? 0));
  const landmark = isLandmarkId(purpose) ? purpose : undefined;
  const location = landmark ? parseLandmarkId(landmark) : { region: destination && destination !== 'tutorial' ? destination : 'valley' as const, node: 'entrance' as const };
  const name = destination === 'tutorial' ? '新手踩点' : landmarkNames[location.region][location.node];
  const costs = landmark ? landmarkCosts(landmark) : destination === 'tutorial' ? { hunger:32, energy:8 } : undefined;
  const reward = landmark && !completedLandmark(pet.adventure,location.region,location.node) ? landmarkFirstReward(landmark) : undefined;
  const tools = (['trail_rope','survey_lens','harvest_sickle','prospector_pick','camp_kit'] as const).filter(id => getToolUsesLeft(pet,id) > 0);
  const contents = <>
    {!embedded && <header className="storage-header"><div className="storage-title"><span className="storage-title-icon"><Backpack /></span><h2 id="adventure-pack-title">{L('出发整备', 'Pack for the trip')}</h2></div><ExplorationHelp pet={pet} purpose={purpose} destination={destination} /><button className="icon-button" onClick={() => perform(onClose)} aria-label={L('关闭整备', 'Close preparation')}><X size={20} /></button></header>}
    <div className="exploration-prep-layout"><div className="exploration-prep-main">
    <div className="exploration-prep-overview"><section className="exploration-panel exploration-destination-card"><AdventureLandscape region={location.region} node={location.node} label={regionNames[location.region]} /><h3>{name}</h3><p>{landmark ? landmarkSummary(landmark).name : '沿着路标，走过第一段小小旅途。'}</p></section><section className="exploration-panel exploration-route-overview"><div className="exploration-section-heading"><h3>行程概览</h3><span className="exploration-tag">{getAdventureStepCount(destination,purpose)} 个阶段</span></div><p>抵达地标，记录线索；和伙伴完成故事，把新的发现带回家。</p>{costs ? <div className="exploration-route-costs"><span><Utensils size={21} />基础饱食消耗<strong>{costs.hunger}</strong></span><span><Zap size={21} />基础体力消耗<strong>{costs.energy}</strong></span></div> : <p>{purpose && adventureJourneyCost(purpose)}</p>}<small>{landmark && `沿途 ${getLandmarkGatherCount(landmark)} 处可采集；每处消耗 1 次采集机会，也可跳过。`}技能与工具可进一步降低行动消耗。</small></section></div>
    <PreparationInventory pet={pet} registry={registry} icons={icons} bag={bag} capacity={capacity} onPack={onPack} onUseHomeItem={onUseHomeItem} onToggleItemFavorite={onToggleItemFavorite} perform={perform} bagHeadingExtra={update && <ExplorationBackpackUpgrade compact pet={pet} update={update} />} />
    <section className="exploration-panel exploration-first-rewards"><h3>{reward ? '首次完成奖励' : destination === 'tutorial' ? '第一段旅途的发现' : '继续记录新的发现'}</h3>{reward ? <div className="exploration-reward-chips">{reward.coins > 0 && <span><img src={currencyIcon} alt="" />+{reward.coins}</span>}{reward.hearts > 0 && <span><Heart size={21} />+{reward.hearts}</span>}{Object.entries(reward.items).map(([id,n]) => <span key={id}><img src={icons[id] ?? unknownItemIcon} alt="" />{registry.get(id)?.name ?? id} ×{n}</span>)}<p>首次成果会永久记入旅行手册；有效采集另计奖励。</p></div> : <p>{destination === 'tutorial' ? '找到地图手册，完成后解锁地区地图。' : '重访地标，继续调查当地物产与珍宝。'}</p>}</section>
    </div><aside className="exploration-panel exploration-prep-aside">{actor && <AdventureCompanionStatus compact pet={pet} actor={actor} />}<section className="exploration-ready-tools"><div className="exploration-section-heading"><h3>可用工具</h3><small>仓库直用</small></div>{tools.map(id => <div key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span>{registry.get(id)?.name ?? id}<small>{toolDurabilityLabel(pet,id)}</small></span></div>)}{!tools.length && <p>目前还没有探索工具，也可以选择普通行动完成旅途。</p>}<small>工具不占行囊空间；使用时消耗耐久。</small></section>
    <div className="adventure-pack-depart"><div><strong>{destination ? name : L('尚未选择目的地', 'No destination selected')}</strong>{(reason || !valid) ? <small className="adventure-blocked" role="status">{reason || L('库存已变化，请调整携带选择。', 'Inventory changed. Adjust the selection.')}</small> : <small>准备好了，下一段故事正在等你。</small>}</div><button className="adventure-depart-button" disabled={Boolean(reason) || !valid} onClick={() => perform(onDepart)}><Compass size={22} /><span>出发，去{name}</span><ArrowRight size={19} /></button></div>
    </aside></div>
  </>;
  return embedded ? <div className="adventure-map-preparation">{contents}</div> : <DialogShell className="storage-modal adventure-preparation" backdropClassName="storage-backdrop adventure-modal-backdrop adventure-preparation-backdrop" labelId="adventure-pack-title" onClose={() => perform(onClose)}>{contents}</DialogShell>;
};
