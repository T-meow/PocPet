import { favoriteFoodIds as defaultFavoriteFoodIds, type InventoryItemDefinition, type ItemId, type PetState } from '../core/pet';
import { getDish } from '../core/kitchenRecipes';
import { DishValueBadge } from './DishValueBadge';

export const ItemFoodBadges = ({ pet, item, actorId, favoriteFoodIds }: {
  pet: PetState; item: InventoryItemDefinition; actorId: string; favoriteFoodIds?: readonly ItemId[];
}) => {
  const food = item.kind === 'food';
  const favorite = food && (favoriteFoodIds ?? defaultFavoriteFoodIds).includes(item.id);
  const dish = getDish(item.id);
  // Dishes have per-companion taste records; other food only has shared feeding history.
  const eaten = food && (dish
    ? pet.kitchen.tasted[actorId]?.[dish.id] !== undefined
    : (pet.achievements.counters.itemUseCountsById[item.id] ?? 0) > 0);
  if (!favorite && !eaten) return <DishValueBadge itemId={item.id} />;
  const eatenLabel = dish ? '当前伙伴吃过' : '吃过（历史喂食记录）';
  return <span className="storage-food-badges">
    <span className="storage-food-badge-slot">{favorite && <span role="img" aria-label="当前伙伴最爱的食物" title="当前伙伴最爱的食物">❤️</span>}</span>
    <span className="storage-food-badge-slot"><DishValueBadge itemId={item.id} /></span>
    <span className="storage-food-badge-slot">{eaten && <span role="img" aria-label={eatenLabel} title={eatenLabel}>🍴</span>}</span>
  </span>;
};
