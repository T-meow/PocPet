import { ChefHat, Sprout } from 'lucide-react';
import type { InventoryItemDefinition, ItemId, PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
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
}

export const InventoryModal = ({ items, pet, itemIconMap, browse, onBrowseChange, isPetBusy, onClose, onOpenShop, onOpenGarden, onOpenKitchen, onUseItem }: InventoryModalProps) => <ItemStorageModal
  mode="bag" pet={pet} items={items} itemIconMap={itemIconMap} browse={browse} onBrowseChange={onBrowseChange} onClose={onClose} onSwitch={onOpenShop} quantityDisabled={isPetBusy}
  renderActions={(item, quantity) => {
    if (item.kind === 'garden') return <button className="storage-primary" onClick={onOpenGarden}><Sprout size={17} />{t('ui.inventory.goGarden')}</button>;
    if (isDedicatedKitchenMaterial(item)) return <button className="storage-primary" onClick={onOpenKitchen}><ChefHat size={17} />{L('去厨房', 'Open kitchen')}</button>;
    return <><button className="storage-primary" data-use-item={item.id} disabled={isPetBusy || !item.usable || (pet.inventory[item.id] ?? 0) < quantity} title={isPetBusy ? t('ui.inventory.partnerScheduleBusy') : undefined} onClick={() => onUseItem(item.id, quantity)}>
      {isPetBusy ? t('ui.inventory.partnerScheduleBusyShort') : !item.usable ? t('ui.inventory.unavailable') : L(`${item.kind === 'food' ? '喂食' : '使用'} ×${quantity}`, `${item.kind === 'food' ? 'Feed' : 'Use'} ×${quantity}`)}
    </button>{isKitchenIngredient(item) && <button className="storage-secondary" onClick={onOpenKitchen}><ChefHat size={17} />{L('留着做菜 · 去厨房', 'Cook with it · Kitchen')}</button>}</>;
  }} />;
