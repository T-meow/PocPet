import { ChefHat, Sprout } from 'lucide-react';
import type { InventoryItemDefinition, ItemId, PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { getAdventureTreasureValue, isAdventureTreasure } from '../core/adventureItems';
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
  onOpenKitchen: () => void;
  onUseItem: (itemId: ItemId, quantity: number) => void;
  favoriteFoodIds?: readonly ItemId[];
}

export const InventoryModal = ({ items, pet, itemIconMap, browse, onBrowseChange, isPetBusy, onClose, onOpenShop, onOpenGarden, onOpenKitchen, onUseItem, favoriteFoodIds }: InventoryModalProps) => <ItemStorageModal
  mode="bag" pet={pet} items={items} itemIconMap={itemIconMap} browse={browse} onBrowseChange={onBrowseChange} onClose={onClose} onSwitch={onOpenShop} quantityDisabled={isPetBusy} favoriteFoodIds={favoriteFoodIds}
  renderActions={(item, quantity) => {
    if (isAdventureTreasure(item.id)) return <button className="storage-primary" disabled={isPetBusy || (pet.inventory[item.id] ?? 0) < quantity} onClick={() => onUseItem(item.id, quantity)}>{L(`兑换 ×${quantity} · ${getAdventureTreasureValue(item.id) * quantity} 金币`, `Exchange ×${quantity} · ${getAdventureTreasureValue(item.id) * quantity} coins`)}</button>;
    if (item.kind === 'garden') return <button className="storage-primary" onClick={onOpenGarden}><Sprout size={17} />{t('ui.inventory.goGarden')}</button>;
    if (isDedicatedKitchenMaterial(item)) return <button className="storage-primary" onClick={onOpenKitchen}><ChefHat size={17} />{L('去厨房', 'Open kitchen')}</button>;
    return <><button className="storage-primary" data-use-item={item.id} disabled={isPetBusy || !item.usable || (pet.inventory[item.id] ?? 0) < quantity} title={pet.adventure.active ? L('途中只能使用行囊中的补给。', 'Use supplies from your travel bag while exploring.') : isPetBusy ? t('ui.inventory.partnerScheduleBusy') : undefined} onClick={() => onUseItem(item.id, quantity)}>
      {pet.adventure.active ? L('探查中', 'Exploring') : isPetBusy ? t('ui.inventory.partnerScheduleBusyShort') : !item.usable ? t('ui.inventory.unavailable') : L(`${item.kind === 'food' ? '喂食' : '使用'} ×${quantity}`, `${item.kind === 'food' ? 'Feed' : 'Use'} ×${quantity}`)}
    </button>{isKitchenIngredient(item) && <button className="storage-secondary" onClick={onOpenKitchen}><ChefHat size={17} />{L('留着做菜 · 去厨房', 'Cook with it · Kitchen')}</button>}</>;
  }} />;
