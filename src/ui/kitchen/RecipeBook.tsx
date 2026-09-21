import { useState } from 'react';
import type { PetState } from '../../core/petTypes';
import type { RecipeId } from '../../core/companionActivityTypes';
import { browseRecipes, type RecipeFilter } from '../../core/kitchenBrowse';
import { getDishId, recipeCategoryNames, recipeName } from '../../core/kitchenRecipes';
import { rarityNames, rarityOrder } from '../../core/foodCatalog';
import { RecipeBadges } from './RecipeBadges';

export const RecipeBook = ({ pet, icons, selected, onSelect }: { pet: PetState; icons: Record<string, string>; selected: RecipeId; onSelect: (id: RecipeId) => void }) => {
  const [filter, setFilter] = useState<RecipeFilter>({ category: '', rarity: '', unlocked: false, ingredients: false, equipment: false, sort: 'rarity' });
  const shown = browseRecipes(pet, filter);
  return <section className="kitchen-recipe-book"><h3>食谱本 · {shown.length} 道</h3><div className="recipe-filters">
    <label>种类<select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value as RecipeFilter['category'] })}><option value="">全部种类</option>{Object.entries(recipeCategoryNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label>稀有度<select value={filter.rarity} onChange={e => setFilter({ ...filter, rarity: e.target.value as RecipeFilter['rarity'] })}><option value="">全部稀有度</option>{rarityOrder.map(id => <option key={id} value={id}>{rarityNames[id]}</option>)}</select></label>
    <label className="recipe-filter-sort">排序<select value={filter.sort} onChange={e => setFilter({ ...filter, sort: e.target.value as RecipeFilter['sort'] })}><option value="energy">基础体力恢复：高到低</option><option value="hunger">基础饱食恢复：高到低</option><option value="cost">材料参考成本：低到高</option><option value="rarity">稀有度：高到低</option></select></label>
    {([['unlocked', '已解锁'], ['ingredients', '材料齐全'], ['equipment', '厨具齐全']] as const).map(([id, label]) => <label key={id} className="recipe-filter-check"><input type="checkbox" checked={filter[id]} onChange={e => setFilter({ ...filter, [id]: e.target.checked })} />{label}</label>)}
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
