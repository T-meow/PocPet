import { allDishes, getRecipeIngredients, activityText as L } from '../core/kitchenRecipes';
import { batchActionUnlockLevel, getDailyBiscuitClaimInfo, maxBatchQuantity } from '../core/pet';
import type { InventoryItemDefinition, PetState, ShopCategory } from '../core/pet';
import { t } from '../i18n';

export type ItemBrowseCategory = ShopCategory | 'all' | 'ingredients';
export type ItemStorageMode = 'shop' | 'bag';
export interface ItemBrowseState { category: ItemBrowseCategory; query: string; selectedId?: string; quantity: number; }
export const createItemBrowseState = (): ItemBrowseState => ({ category: 'all', query: '', quantity: 1 });
export const getStorageReturnTarget = (dialog: string | null, previous: 'kitchen' | 'play' | null) => dialog === 'kitchen' || dialog === 'play' ? dialog : dialog === 'shop' || dialog === 'inventory' ? previous : null;
const recipeIngredientIds = new Set<string>(allDishes.flatMap(({ recipe, banana }) => getRecipeIngredients(recipe, banana)));
export const isKitchenIngredient = (item: InventoryItemDefinition) => recipeIngredientIds.has(item.id) || item.tags.includes('kitchen_material');
export const isDedicatedKitchenMaterial = (item: InventoryItemDefinition) => item.tags.includes('kitchen_material') && !item.usable;
export const getItemBrowseCategories = () => [
  { id: 'all' as const, label: L('全部', 'All') },
  { id: 'food' as const, label: t('pet.shop.categories.food') },
  { id: 'ingredients' as const, label: L('食材', 'Ingredients') },
  { id: 'item' as const, label: t('pet.shop.categories.item') },
  { id: 'care' as const, label: t('pet.shop.categories.care') },
  { id: 'garden' as const, label: t('pet.shop.categories.garden') },
];
export const matchesItemBrowseCategory = (item: InventoryItemDefinition, category: ItemBrowseCategory) => {
  if (category === 'all') return true;
  if (category === 'ingredients') return isKitchenIngredient(item);
  if (category === 'food') return item.kind === 'food' && !isDedicatedKitchenMaterial(item);
  return item.kind === category;
};
export const filterBrowseItems = (items: readonly InventoryItemDefinition[], category: ItemBrowseCategory, query = '') => {
  const search = query.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return matchesItemBrowseCategory(item, category) && (!search || `${item.displayName} ${item.displaySummary}`.toLocaleLowerCase().includes(search));
  });
};
export const getItemBrowseTone = (item: InventoryItemDefinition) => isKitchenIngredient(item) ? 'mint' : ({ food: 'peach', item: 'lilac', care: 'sky', garden: 'mint' } as const)[item.kind];
export const getItemBrowseLimit = (pet: PetState, item: InventoryItemDefinition, mode: ItemStorageMode, now = Date.now()) => {
  const batchLimit = pet.level >= batchActionUnlockLevel ? maxBatchQuantity : 1;
  if (mode === 'shop') {
    if (!item.shop) return 0;
    if (item.id === 'emergency_biscuit') {
      const claim = getDailyBiscuitClaimInfo(pet, now);
      return Math.min(batchLimit, Math.max(0, claim.limit - claim.claimed));
    }
    return batchLimit;
  }
  if (!item.usable || item.kind === 'garden') return 0;
  const single = item.id === 'golden_apple' || item.id === 'birthday_cake';
  return Math.min(single ? 1 : batchLimit, pet.inventory[item.id] ?? 0);
};
export const resolveItemBrowseState = (state: ItemBrowseState, items: readonly InventoryItemDefinition[], limit: (item: InventoryItemDefinition) => number): ItemBrowseState => {
  const item = items.find((entry) => entry.id === state.selectedId) ?? items[0];
  const selectedId = item?.id;
  const requested = selectedId === state.selectedId && Number.isFinite(state.quantity) ? Math.floor(state.quantity) : 1;
  const quantity = Math.max(1, Math.min(item ? limit(item) : 1, requested));
  return selectedId === state.selectedId && quantity === state.quantity ? state : { ...state, selectedId, quantity };
};
