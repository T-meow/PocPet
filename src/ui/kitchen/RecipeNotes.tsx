import type { PetState } from '../../core/petTypes';
import type { MilkChoice } from '../../core/companionActivityTypes';
import type { RecipeDefinition } from '../../core/kitchenRecipes';
import { HelpButton } from '../help/HelpButton';
import { getRecipeHelp } from '../help/productionHelp';

export const RecipeNotes = ({ pet, recipe, banana, milk }: { pet: PetState; recipe: RecipeDefinition; banana: boolean; milk: MilkChoice }) => {
  return <HelpButton {...getRecipeHelp(pet, recipe, banana, milk)} label="制作说明" />;
};
