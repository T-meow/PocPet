import { highProfitDishPercent, isHighProfitDish } from '../core/communityEconomy';
import '../styles/dish-value-badge.css';

export const DishValueBadge = ({ itemId }: { itemId: string }) => {
  if (!isHighProfitDish(itemId)) return null;
  const label = `高利润料理：基础利润超过整条料理链原料计价的 ${highProfitDishPercent}%`;
  return <span className="storage-tile-tag dish-value-tag" role="img" aria-label={label} title={label}><span aria-hidden="true">🪙</span></span>;
};
