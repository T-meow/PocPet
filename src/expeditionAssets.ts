import { expeditionProducts } from './core/expeditionData';
import type { ExpeditionItemId } from './core/expeditionTypes';
import { regionalTreasureIcons } from './fieldEquipmentAssets';
import { newItemIcons } from './newItemIconAssets';
export const expeditionItemIcons: Record<ExpeditionItemId, string> = {
  ...Object.fromEntries(Object.keys(expeditionProducts).map(id => [id, newItemIcons[id as ExpeditionItemId]])) as Record<ExpeditionItemId, string>,
  ...regionalTreasureIcons,
};
export const expeditionDishIcons = {
  dish_mushroom_rice: newItemIcons.dish_mushroom_rice,
  dish_honey_drink: newItemIcons.dish_honey_drink,
  dish_berry_milk: newItemIcons.dish_berry_milk,
  dish_kelp_rice: newItemIcons.dish_kelp_rice,
};
