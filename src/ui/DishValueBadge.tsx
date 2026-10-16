import { highProfitDishPercent, isHighValueProduct } from '../core/communityEconomy';
import '../styles/dish-value-badge.css';

export const DishValueBadge = ({ itemId }: { itemId: string }) => {
  if (!isHighValueProduct(itemId)) return null;
  const label = `高价值商品：基础利润超过原料计价的 ${highProfitDishPercent}%`;
  return <span className="storage-tile-tag dish-value-tag" role="img" aria-label={label} title={label}><span aria-hidden="true">🪙</span></span>;
};
