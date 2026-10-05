import type { PetState } from '../../core/petTypes';
import { getRecipeVariants, getRecipeUnlockReason, type RecipeDefinition } from '../../core/kitchenRecipes';
import { getCraftLimit } from '../../core/kitchen';
import { rarityNames } from '../../core/foodCatalog';

export const RecipeIngredientChoice = ({ pet, recipe, onChange }: {
  pet: PetState; recipe: RecipeDefinition; onChange: (variantKey: string) => void;
}) => {
  if (!recipe.variantKey) return null;
  return <fieldset className="recipe-ingredient-choice">
    <legend>{recipe.id === 'mixed_juice' ? '选择两种水果' : '选择料理鱼'}</legend>
    <p>{recipe.id === 'mixed_juice' ? '每份消耗两种不同水果，各 1 份。' : '每份消耗所选鱼 1 条。观赏收藏鱼不用于料理。'}效果和售价随选材变化。</p>
    <label>本次配料
      <select value={recipe.variantKey} onChange={event => onChange(event.target.value)}>
        {getRecipeVariants(recipe).map(variant => {
          const reason = getRecipeUnlockReason(pet, recipe.id, variant.variantKey);
          return <option key={variant.variantKey} value={variant.variantKey}>{variant.variantLabel} · {rarityNames[variant.rarity]} · {reason || `可做 ${getCraftLimit(pet, recipe.id, false, undefined, variant.variantKey)} 份`}</option>;
        })}
      </select>
    </label>
  </fieldset>;
};
