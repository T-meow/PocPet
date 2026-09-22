import { Backpack, Compass, X } from 'lucide-react';
import { adventureJourneyName, adventureJourneyCost } from '../core/adventureData';
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
import { ExplorationCheckPreparation } from './ExplorationCheck';

interface Props extends PreparationResources {
  pet: PetState; bag: Inventory; tool: boolean; destination?: AdventureDestinationId; purpose?: CommunityRoute;
  onPack: (id: ItemId, delta: number) => void; onTool: (value: boolean) => void;
  onDepart: () => void; onClose: () => void; perform: (action: () => void) => void;
  update?: (action: (pet: PetState) => PetState) => void;
}
export const AdventurePreparation = ({ pet, registry, icons, bag, tool, destination, purpose, onPack, onTool, onDepart, onClose, onUseHomeItem, perform, update }: Props) => {
  const capacity = getExplorationBagCapacity(pet);
  const carried: Inventory = { ...bag, ...(tool ? { trail_rope: 1 } : {}) };
  const reason = getAdventureStartReason(pet, destination, Date.now(), purpose);
  const valid = getAdventureBagCount(bag) <= capacity && Object.entries(carried).every(([id, n]) => n <= (pet.inventory[id] ?? 0));
  return <DialogShell className="storage-modal adventure-preparation" backdropClassName="storage-backdrop adventure-modal-backdrop adventure-preparation-backdrop" labelId="adventure-pack-title" onClose={() => perform(onClose)}>
    <header className="storage-header"><div className="storage-title"><span className="storage-title-icon"><Backpack /></span><h2 id="adventure-pack-title">{L('出发整备', 'Pack for the trip')}</h2></div><button className="icon-button" onClick={() => perform(onClose)} aria-label={L('关闭整备', 'Close preparation')}><X size={20} /></button></header>
    <PreparationInventory pet={pet} registry={registry} icons={icons} bag={bag} capacity={capacity} onPack={onPack} onUseHomeItem={onUseHomeItem} perform={perform} tool={{ equipped: tool, onChange: onTool }} bagExtra={<>{destination === 'valley' && <ExplorationCheckPreparation pet={pet} />}{update && <ExplorationBackpackUpgrade pet={pet} update={update} />}</>} />
    <div className="adventure-pack-depart"><div><strong>{destination ? (destination === 'tutorial' ? '' : L('溪谷 · ', 'Creek Valley · ')) + adventureJourneyName(destination, purpose) : L('尚未选择目的地', 'No destination selected')}</strong>{destination && <small>{purpose ? adventureJourneyCost(purpose) : destination === 'tutorial' ? L('4 个节点 · 全程饱食 32、体力 8 · 无需额外道具', '4 stops · 32 hunger, 8 energy in total · No extra items needed') : '预计饱食 −90 · 体力 −50 · 最多采集 2 次'}</small>}{(reason || !valid) && <small className="adventure-blocked">{reason || L('库存已变化，请调整携带选择。', 'Inventory changed. Adjust the selection.')}</small>}</div><button className="adventure-depart-button" disabled={Boolean(reason) || !valid} onClick={() => perform(onDepart)}><Compass size={22} />{L('出发', 'Set out')}</button></div>
  </DialogShell>;
};
