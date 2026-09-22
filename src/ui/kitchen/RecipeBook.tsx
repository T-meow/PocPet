import { useState } from 'react';
import type { RecipeId } from '../../core/companionActivityTypes';
import { browseRecipes, type RecipeFilter } from '../../core/kitchenBrowse';
import { getDishId, recipeCategoryNames, recipeName } from '../../core/kitchenRecipes';
import { rarityNames, rarityOrder } from '../../core/foodCatalog';
import { RecipeBadges } from './RecipeBadges';

const sortOptions = [
  { value: 'energy', label: '体力 ↓', title: '基础体力恢复：高到低' },
  { value: 'hunger', label: '饱食 ↓', title: '基础饱食恢复：高到低' },
  { value: 'cost', label: '成本 ↑', title: '材料参考成本：低到高' },
  { value: 'rarity', label: '稀有度 ↓', title: '稀有度：高到低' },
] as const;

export const RecipeBook = ({ icons, selected, onSelect }: { icons: Record<string, string>; selected: RecipeId; onSelect: (id: RecipeId) => void }) => {
  const [filter, setFilter] = useState<RecipeFilter>({ category: '', rarity: '', sort: 'rarity' });
  const shown = browseRecipes(filter);
  return <section className="kitchen-recipe-book"><h3>食谱本 · {shown.length} 道</h3><div className="recipe-filters">
    <label>种类<select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value as RecipeFilter['category'] })}><option value="">全部</option>{Object.entries(recipeCategoryNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>稀有度<select value={filter.rarity} onChange={e => setFilter({ ...filter, rarity: e.target.value as RecipeFilter['rarity'] })}><option value="">全部</option>{rarityOrder.map(id => <option key={id} value={id}>{rarityNames[id]}</option>)}</select></label>
    <label>排序<select value={filter.sort} title={sortOptions.find(option => option.value === filter.sort)?.title} onChange={e => setFilter({ ...filter, sort: e.target.value as RecipeFilter['sort'] })}>{sortOptions.map(option => <option key={option.value} value={option.value} title={option.title}>{option.label}</option>)}</select></label>
  </div>
  <div className="recipe-grid">{shown.map(recipe => <button
    type="button" className={`recipe-card${selected === recipe.id ? ' selected' : ''}`}
    key={recipe.id} aria-haspopup="dialog" onClick={() => onSelect(recipe.id)}
  >
    <img src={icons[getDishId(recipe)]} alt="" draggable={false} />
    <strong>{recipeName(recipe)}</strong>
    <RecipeBadges recipe={recipe} />
  </button>)}</div>{!shown.length && <p>没有符合这些条件的料理，调整筛选后再看看。</p>}</section>;
};
