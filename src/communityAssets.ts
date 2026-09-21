import { fishIds } from './core/communityData';
import type { FishId } from './core/communityTypes';
import { productionItemIcons } from './foodProductionAssets';
import { fieldEquipmentIcons, regionalTreasureIcons } from './fieldEquipmentAssets';
import { newItemIcons } from './newItemIconAssets';

export const communityItemIcons = {
  ...productionItemIcons,
  ...fieldEquipmentIcons,
  ...regionalTreasureIcons,
  ...Object.fromEntries(fishIds.map(id => [id, newItemIcons[id]])) as Record<FishId, string>,
  animal_feed: newItemIcons.animal_feed,
  farm_milk: newItemIcons.farm_milk,
  fishing_bait: newItemIcons.fishing_bait,
  river_bait: newItemIcons.river_bait,
  fishing_rod: newItemIcons.fishing_rod,
  reinforced_rod: newItemIcons.reinforced_rod,
  field_dressing: newItemIcons.field_dressing,
  comfort_charm: newItemIcons.comfort_charm,
  carrot_seed: newItemIcons.carrot_seed,
  creek_herb_seed: newItemIcons.creek_herb_seed,
  creek_herb: newItemIcons.creek_herb,
  community_wood: newItemIcons.community_wood,
  community_stone: newItemIcons.community_stone,
};
export const herbPorridgeIcon = newItemIcons.dish_herb_porridge;
export const communityDishIcons = {
  dish_creek_fish_soup: newItemIcons.dish_creek_fish_soup,
  dish_river_grill: newItemIcons.dish_river_grill,
  dish_milk_custard: newItemIcons.dish_milk_custard,
  dish_carp_rice: newItemIcons.dish_carp_rice,
};
