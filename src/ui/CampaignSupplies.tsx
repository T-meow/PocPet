import { unknownItemIcon } from '../assets';
import { getAdventureBagCount } from '../core/adventureState';
import { getExplorationBagCapacity } from '../core/explorationBackpack';
import type { CampaignVisitId } from '../core/explorationCampaignData';
import { getCampaignSupplies } from '../core/explorationCampaignState';
import type { Inventory, ItemId, ItemRegistry, PetState } from '../core/petTypes';

export const CampaignSupplies = ({ pet, visitId, bag, registry, icons, onPack }: {
  pet: PetState; visitId: CampaignVisitId; bag: Inventory; registry: ItemRegistry; icons: Record<string, string>; onPack: (id: ItemId, delta: number) => void;
}) => {
  const requirements = getCampaignSupplies(pet, visitId), space = getExplorationBagCapacity(pet) - getAdventureBagCount(bag);
  return <section className="exploration-panel campaign-supplies"><h3>这趟要带的东西</h3>{requirements.length ? <><p>这些留给聚餐准备。路上自己吃的补给，可以另外装一些。</p>{requirements.map((requirement, i) => <div className="campaign-supply-group" key={i}><strong>{requirement.items.map(id => registry.get(id)?.name ?? id).join('或')} · 共 {requirement.amount} 份</strong><small>行囊已有 {requirement.items.reduce((n, id) => n + (bag[id] ?? 0), 0)} 份{requirement.items.length > 1 && '，可以搭配携带'}</small>{requirement.items.map(id => <div className="campaign-supply-row" key={id}><img src={icons[id] ?? unknownItemIcon} alt="" /><span><strong>{registry.get(id)?.name ?? id}</strong><small>仓库余量 {Math.max(0, (pet.inventory[id] ?? 0) - (bag[id] ?? 0))}</small></span><div className="campaign-quantity"><button aria-label={`取出一份${registry.get(id)?.name ?? id}`} disabled={!(bag[id] > 0)} onClick={() => onPack(id, -1)}>−</button><b>{bag[id] ?? 0}</b><button aria-label={`装入一份${registry.get(id)?.name ?? id}`} disabled={space < 1 || (bag[id] ?? 0) >= (pet.inventory[id] ?? 0)} onClick={() => onPack(id, 1)}>+</button></div></div>)}</div>)}</> : <p>这趟不用另交材料。带好自己的路上补给就行。</p>}<small>已经办好的事会保留；借来的凳子、灯和桌布由伙伴帮忙带，不占行囊。</small></section>;
};
