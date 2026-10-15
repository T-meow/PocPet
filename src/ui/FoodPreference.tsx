import { favoriteFoodIds as defaultFavoriteFoodIds } from '../core/items';
import type { ItemId } from '../core/petTypes';

export const FoodPreference = ({ itemId, favoriteFoodIds, compact = false }: {
  itemId: ItemId; favoriteFoodIds?: readonly ItemId[]; compact?: boolean;
}) => {
  const favorite = (favoriteFoodIds ?? defaultFavoriteFoodIds).includes(itemId);
  if (!favorite) return null;
  const label = '当前伙伴喜欢';
  return compact
    ? <span className="achieved" role="img" aria-label={label} title={label}>❤️</span>
    : <span className="activity-muted">❤️ {label}</span>;
};
