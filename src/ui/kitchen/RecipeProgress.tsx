import type { KitchenState } from '../../core/companionActivityTypes';
import { getDishId, type RecipeDefinition } from '../../core/kitchenRecipes';

export const RecipeProgress = ({ kitchen, actorId, recipe, banana }: {
  kitchen: KitchenState; actorId: string; recipe: RecipeDefinition; banana?: boolean;
}) => {
  const made = (kitchen.made[recipe.id] ?? 0) > 0;
  const tasted = kitchen.tasted[actorId] ?? {};
  const eaten = banana === undefined
    ? tasted[getDishId(recipe)] !== undefined || Boolean(recipe.fruitVariant && tasted[getDishId(recipe, true)] !== undefined)
    : tasted[getDishId(recipe, banana)] !== undefined;
  return <span className="recipe-progress">
    <span className={made ? 'achieved' : 'unachieved'} role="img" aria-label={made ? '做过' : '还没做过'} title={made ? '做过' : '还没做过'}>🧑‍🍳</span>
    <span className={eaten ? 'achieved' : 'unachieved'} role="img" aria-label={eaten ? '当前伙伴吃过' : '当前伙伴还没吃过'} title={eaten ? '当前伙伴吃过' : '当前伙伴还没吃过'}>🍴</span>
  </span>;
};
