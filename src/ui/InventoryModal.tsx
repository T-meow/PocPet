import { ChefHat, Sprout } from 'lucide-react';
import type { InventoryItemDefinition, ItemId, PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
import { getItemUsePlan, overfedMessage } from '../core/itemEffects';
import { t } from '../i18n';
import { ItemStorageModal } from './ItemStorageModal';
import { isDedicatedKitchenMaterial, isKitchenIngredient, type ItemBrowseState } from './itemBrowse';

interface InventoryModalProps {
  items: readonly InventoryItemDefinition[];
  pet: PetState;
  itemIconMap: Partial<Record<string, string>>;
  browse: ItemBrowseState;
  onBrowseChange: (state: ItemBrowseState) => void;
  isPetBusy: boolean;
  onClose: () => void;
  onOpenShop: () => void;
  onOpenGarden: () => void;
  onOpenCommunity?: () => void;
  onOpenKitchen: () => void;
  onUseItem: (itemId: ItemId, quantity: number) => void;
  favoriteFoodIds?: readonly ItemId[];
}

export const InventoryModal = ({ items, pet, itemIconMap, browse, onBrowseChange, isPetBusy, onClose, onOpenShop, onOpenGarden, onOpenCommunity, onOpenKitchen, onUseItem, favoriteFoodIds }: InventoryModalProps) => <ItemStorageModal
  mode="bag" pet={pet} items={items} itemIconMap={itemIconMap} browse={browse} onBrowseChange={onBrowseChange} onClose={onClose} onSwitch={onOpenShop} quantityDisabled={isPetBusy} favoriteFoodIds={favoriteFoodIds}
  renderActions={(item, quantity) => {
    if (onOpenCommunity && ['carrot_seed', 'creek_herb_seed', 'community_wood', 'community_stone', 'animal_feed', 'fishing_bait', 'river_bait', 'fishing_rod', 'reinforced_rod', 'golden_koi', 'silver_grayling'].includes(item.id)) return <button className="storage-primary" onClick={onOpenCommunity}><Sprout size={17} />去溪畔社区</button>;
    if (isAdventureTreasure(item.id)) return <button className="storage-primary" disabled={isPetBusy || (pet.inventory[item.id] ?? 0) < quantity} onClick={() => onUseItem(item.id, quantity)}>{L(`兑换 ×${quantity} · ${getAdventureTreasureValue(item.id) * quantity} 金币`, `Exchange ×${quantity} · ${getAdventureTreasureValue(item.id) * quantity} coins`)}</button>;
    if (item.kind === 'garden') return <button className="storage-primary" onClick={onOpenGarden}><Sprout size={17} />{t('ui.inventory.goGarden')}</button>;
    if (isDedicatedKitchenMaterial(item)) return <button className="storage-primary" onClick={onOpenKitchen}><ChefHat size={17} />{L('去厨房', 'Open kitchen')}</button>;
    const plan = getItemUsePlan(pet, item, quantity);
    return <><button className="storage-primary" data-use-item={item.id} disabled={isPetBusy || !item.usable || plan.blocked || (pet.inventory[item.id] ?? 0) < plan.quantity} title={pet.adventure.active ? L('途中只能使用行囊中的补给。', 'Use supplies from your travel bag while exploring.') : isPetBusy ? t('ui.inventory.partnerScheduleBusy') : plan.blocked ? overfedMessage : undefined} onClick={() => onUseItem(item.id, plan.quantity)}>
      {pet.adventure.active ? L('探查中', 'Exploring') : isPetBusy ? t('ui.inventory.partnerScheduleBusyShort') : !item.usable ? t('ui.inventory.unavailable') : plan.blocked ? '吃撑了，先消化一下' : L(`${item.kind === 'food' ? '喂食' : '使用'} ×${plan.quantity}`, `${item.kind === 'food' ? 'Feed' : 'Use'} ×${plan.quantity}`)}
    </button>{isKitchenIngredient(item) && <button className="storage-secondary" onClick={onOpenKitchen}><ChefHat size={17} />{L('留着做菜 · 去厨房', 'Cook with it · Kitchen')}</button>}</>;
  }} />;
