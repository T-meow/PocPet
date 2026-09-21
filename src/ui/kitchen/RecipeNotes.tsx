import type { PetState } from '../../core/petTypes';
import type { MilkChoice } from '../../core/companionActivityTypes';
import { getDishId, getIngredientReferenceCost, getRecipeMaterialCost, getRecipeUnlockReason, type RecipeDefinition } from '../../core/kitchenRecipes';
import { getMarketQuote } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';

export const RecipeNotes = ({ pet, recipe, banana, milk }: { pet: PetState; recipe: RecipeDefinition; banana: boolean; milk: MilkChoice }) => {
  const dishId = getDishId(recipe, banana);
  const cost = getRecipeMaterialCost(recipe, banana, getIngredientReferenceCost, milk);
  const quote = getMarketQuote(pet, dishId);
  const saleNote = getCuisineSaleNote(dishId);
  const unlockReason = getRecipeUnlockReason(pet, recipe.id);
  const made = pet.kitchen.made[recipe.id] ?? 0;
  return <section className="recipe-notes" aria-label="料理说明">
    <dl>
      <div><dt>材料参考 / 份</dt><dd>{Number(cost.toFixed(1))} 金币</dd></div>
      {quote && <><div><dt>回收 / 份</dt><dd>{quote.base} 金币</dd></div><div><dt>摆摊 / 份</dt><dd>{quote.price} 金币</dd></div></>}
    </dl>
    {saleNote && <p>{saleNote}</p>}
    <p>{made ? `做过 ${made} 份` : '还没一起做过'}{unlockReason ? ` · ${unlockReason}` : ''}</p>
    <p>参考成本按商店原价、作物种子成本和野生食材回收价值计算；加工食材包含原料，奶类按当前选择估算。标签显示每份基础属性，当前加成与实际恢复见恢复预览。</p>
  </section>;
};
