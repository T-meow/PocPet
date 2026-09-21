import type { BuiltinItemId } from './core/petTypes';
// Approved A-I originals; source and crop records are retained in the local art manifest.
import field_watering_can from './assets/icon/item_field_watering_can.webp';
import harvest_sickle from './assets/icon/item_harvest_sickle.webp';
import nutrient_compost from './assets/icon/item_nutrient_compost.webp';
import fishing_float from './assets/icon/item_fishing_float.webp';
import landing_net from './assets/icon/item_landing_net.webp';
import prospector_pick from './assets/icon/item_prospector_pick.webp';
import survey_lens from './assets/icon/item_survey_lens.webp';
import camp_kit from './assets/icon/item_camp_kit.webp';
import creek_aquamarine from './assets/icon/item_creek_aquamarine.webp';
import hill_sunstone from './assets/icon/item_hill_sunstone.webp';
import forest_emerald from './assets/icon/item_forest_emerald.webp';
import tidal_pearl from './assets/icon/item_tidal_pearl.webp';
import star_sapphire from './assets/icon/item_star_sapphire.webp';
import field_dressing from './assets/icon/item_field_dressing.webp';
import comfort_charm from './assets/icon/item_comfort_charm.webp';
import map_handbook from './assets/icon/item_map_handbook.webp';
import creek_herb_seed from './assets/icon/item_creek_herb_seed.webp';
import carrot_seed from './assets/icon/item_carrot_seed.webp';
import forest_berry_seed from './assets/icon/item_forest_berry_seed.webp';
import greens_seed from './assets/icon/item_greens_seed.webp';
import tomato_seed from './assets/icon/item_tomato_seed.webp';
import cabbage_seed from './assets/icon/item_cabbage_seed.webp';
import potato_seed from './assets/icon/item_potato_seed.webp';
import corn_seed from './assets/icon/item_corn_seed.webp';
import wheat_seed from './assets/icon/item_wheat_seed.webp';
import pumpkin_seed from './assets/icon/item_pumpkin_seed.webp';
import pepper_seed from './assets/icon/item_pepper_seed.webp';
import strawberry_seed from './assets/icon/item_strawberry_seed.webp';
import mint_seed from './assets/icon/item_mint_seed.webp';
import ginger_seed from './assets/icon/item_ginger_seed.webp';
import lotus_seed_packet from './assets/icon/item_lotus_seed_packet.webp';
import sunflower_seed from './assets/icon/item_sunflower_seed.webp';
import creek_herb from './assets/icon/item_creek_herb.webp';
import farm_milk from './assets/icon/item_farm_milk.webp';
import wheat from './assets/icon/item_wheat.webp';
import potato from './assets/icon/item_potato.webp';
import sweet_corn from './assets/icon/item_sweet_corn.webp';
import pumpkin from './assets/icon/item_pumpkin.webp';
import sweet_pepper from './assets/icon/item_sweet_pepper.webp';
import strawberry from './assets/icon/item_strawberry.webp';
import mint from './assets/icon/item_mint.webp';
import ginger from './assets/icon/item_ginger.webp';
import lotus_root from './assets/icon/item_lotus_root.webp';
import sunflower_kernel from './assets/icon/item_sunflower_kernel.webp';
import cream from './assets/icon/item_cream.webp';
import cheese from './assets/icon/item_cheese.webp';
import forest_berry_jam from './assets/icon/item_forest_berry_jam.webp';
import cooking_oil from './assets/icon/item_cooking_oil.webp';
import bamboo_shoot from './assets/icon/item_bamboo_shoot.webp';
import wild_onion from './assets/icon/item_wild_onion.webp';
import wood_ear from './assets/icon/item_wood_ear.webp';
import sea_salt from './assets/icon/item_sea_salt.webp';
import lotus_seed from './assets/icon/item_lotus_seed.webp';
import mountain_chestnut from './assets/icon/item_mountain_chestnut.webp';
import wild_lemon from './assets/icon/item_wild_lemon.webp';
import pine_nut from './assets/icon/item_pine_nut.webp';
import clam from './assets/icon/item_clam.webp';
import sea_shrimp from './assets/icon/item_sea_shrimp.webp';
import matsutake from './assets/icon/item_matsutake.webp';
import mountain_tea from './assets/icon/item_mountain_tea.webp';
import valley_mushroom from './assets/icon/item_valley_mushroom.webp';
import hill_honey from './assets/icon/item_hill_honey.webp';
import forest_berry from './assets/icon/item_forest_berry.webp';
import coast_kelp from './assets/icon/item_coast_kelp.webp';
import community_wood from './assets/icon/item_community_wood.webp';
import community_stone from './assets/icon/item_community_stone.webp';
import pine_resin from './assets/icon/item_pine_resin.webp';
import sea_glass from './assets/icon/item_sea_glass.webp';
import observatory_part from './assets/icon/item_observatory_part.webp';
import animal_feed from './assets/icon/item_animal_feed.webp';
import fishing_bait from './assets/icon/item_fishing_bait.webp';
import river_bait from './assets/icon/item_river_bait.webp';
import fishing_rod from './assets/icon/item_fishing_rod.webp';
import reinforced_rod from './assets/icon/item_reinforced_rod.webp';
import pond_crucian from './assets/icon/item_pond_crucian.webp';
import pond_carp from './assets/icon/item_pond_carp.webp';
import golden_koi from './assets/icon/item_golden_koi.webp';
import stream_trout from './assets/icon/item_stream_trout.webp';
import river_perch from './assets/icon/item_river_perch.webp';
import silver_grayling from './assets/icon/item_silver_grayling.webp';
import wheat_fish from './assets/icon/item_wheat_fish.webp';
import stream_grouper from './assets/icon/item_stream_grouper.webp';
import redtail_barbel from './assets/icon/item_redtail_barbel.webp';
import striped_catfish from './assets/icon/item_striped_catfish.webp';
import moss_bream from './assets/icon/item_moss_bream.webp';
import glass_eel from './assets/icon/item_glass_eel.webp';
import moon_carp from './assets/icon/item_moon_carp.webp';
import silver_sardine from './assets/icon/item_silver_sardine.webp';
import blue_mackerel from './assets/icon/item_blue_mackerel.webp';
import bluefin_bream from './assets/icon/item_bluefin_bream.webp';
import sunset_butterflyfish from './assets/icon/item_sunset_butterflyfish.webp';
import star_ray from './assets/icon/item_star_ray.webp';
import dish_mushroom_rice from './assets/icon/item_dish_mushroom_rice.webp';
import dish_honey_drink from './assets/icon/item_dish_honey_drink.webp';
import dish_berry_milk from './assets/icon/item_dish_berry_milk.webp';
import dish_kelp_rice from './assets/icon/item_dish_kelp_rice.webp';
import dish_herb_porridge from './assets/icon/item_dish_herb_porridge.webp';
import dish_creek_fish_soup from './assets/icon/item_dish_creek_fish_soup.webp';
import dish_river_grill from './assets/icon/item_dish_river_grill.webp';
import dish_milk_custard from './assets/icon/item_dish_milk_custard.webp';
import dish_carp_rice from './assets/icon/item_dish_carp_rice.webp';
import dish_mashed_potato from './assets/icon/item_dish_mashed_potato.webp';
import dish_corn_chowder from './assets/icon/item_dish_corn_chowder.webp';
import dish_pumpkin_rice from './assets/icon/item_dish_pumpkin_rice.webp';
import dish_pepper_pork_bowl from './assets/icon/item_dish_pepper_pork_bowl.webp';
import dish_bamboo_mushroom_soup from './assets/icon/item_dish_bamboo_mushroom_soup.webp';
import dish_lotus_pork_soup from './assets/icon/item_dish_lotus_pork_soup.webp';
import dish_chestnut_rice from './assets/icon/item_dish_chestnut_rice.webp';
import dish_cream_matsutake from './assets/icon/item_dish_cream_matsutake.webp';
import dish_cheese_vegetables from './assets/icon/item_dish_cheese_vegetables.webp';
import dish_wood_ear_dumplings from './assets/icon/item_dish_wood_ear_dumplings.webp';
import dish_crispy_wheat_fish from './assets/icon/item_dish_crispy_wheat_fish.webp';
import dish_tomato_crucian from './assets/icon/item_dish_tomato_crucian.webp';
import dish_lemon_trout from './assets/icon/item_dish_lemon_trout.webp';
import dish_pumpkin_perch_soup from './assets/icon/item_dish_pumpkin_perch_soup.webp';
import dish_bamboo_grouper from './assets/icon/item_dish_bamboo_grouper.webp';
import dish_pepper_redtail from './assets/icon/item_dish_pepper_redtail.webp';
import dish_herb_catfish from './assets/icon/item_dish_herb_catfish.webp';
import dish_corn_bream_soup from './assets/icon/item_dish_corn_bream_soup.webp';
import dish_honey_eel_rice from './assets/icon/item_dish_honey_eel_rice.webp';
import dish_sardine_rice_ball from './assets/icon/item_dish_sardine_rice_ball.webp';
import dish_salt_mackerel from './assets/icon/item_dish_salt_mackerel.webp';
import dish_lemon_bream_rice from './assets/icon/item_dish_lemon_bream_rice.webp';
import dish_strawberry_cheese_cup from './assets/icon/item_dish_strawberry_cheese_cup.webp';
import dish_berry_jam_biscuit from './assets/icon/item_dish_berry_jam_biscuit.webp';
import dish_honey_pumpkin_pie from './assets/icon/item_dish_honey_pumpkin_pie.webp';
import dish_chestnut_milk_cake from './assets/icon/item_dish_chestnut_milk_cake.webp';
import dish_mint_lemon_drink from './assets/icon/item_dish_mint_lemon_drink.webp';
import dish_lotus_milk_soup from './assets/icon/item_dish_lotus_milk_soup.webp';
import dish_pine_honey_biscuit from './assets/icon/item_dish_pine_honey_biscuit.webp';
import dish_mountain_herb_tea from './assets/icon/item_dish_mountain_herb_tea.webp';
import dish_seafood_rice from './assets/icon/item_dish_seafood_rice.webp';
import dish_valley_travel_bento from './assets/icon/item_dish_valley_travel_bento.webp';

export const newItemIcons = {
  field_watering_can,
  harvest_sickle,
  nutrient_compost,
  fishing_float,
  landing_net,
  prospector_pick,
  survey_lens,
  camp_kit,
  creek_aquamarine,
  hill_sunstone,
  forest_emerald,
  tidal_pearl,
  star_sapphire,
  field_dressing,
  comfort_charm,
  map_handbook,
  creek_herb_seed,
  carrot_seed,
  forest_berry_seed,
  greens_seed,
  tomato_seed,
  cabbage_seed,
  potato_seed,
  corn_seed,
  wheat_seed,
  pumpkin_seed,
  pepper_seed,
  strawberry_seed,
  mint_seed,
  ginger_seed,
  lotus_seed_packet,
  sunflower_seed,
  creek_herb,
  farm_milk,
  wheat,
  potato,
  sweet_corn,
  pumpkin,
  sweet_pepper,
  strawberry,
  mint,
  ginger,
  lotus_root,
  sunflower_kernel,
  cream,
  cheese,
  forest_berry_jam,
  cooking_oil,
  bamboo_shoot,
  wild_onion,
  wood_ear,
  sea_salt,
  lotus_seed,
  mountain_chestnut,
  wild_lemon,
  pine_nut,
  clam,
  sea_shrimp,
  matsutake,
  mountain_tea,
  valley_mushroom,
  hill_honey,
  forest_berry,
  coast_kelp,
  community_wood,
  community_stone,
  pine_resin,
  sea_glass,
  observatory_part,
  animal_feed,
  fishing_bait,
  river_bait,
  fishing_rod,
  reinforced_rod,
  pond_crucian,
  pond_carp,
  golden_koi,
  stream_trout,
  river_perch,
  silver_grayling,
  wheat_fish,
  stream_grouper,
  redtail_barbel,
  striped_catfish,
  moss_bream,
  glass_eel,
  moon_carp,
  silver_sardine,
  blue_mackerel,
  bluefin_bream,
  sunset_butterflyfish,
  star_ray,
  dish_mushroom_rice,
  dish_honey_drink,
  dish_berry_milk,
  dish_kelp_rice,
  dish_herb_porridge,
  dish_creek_fish_soup,
  dish_river_grill,
  dish_milk_custard,
  dish_carp_rice,
  dish_mashed_potato,
  dish_corn_chowder,
  dish_pumpkin_rice,
  dish_pepper_pork_bowl,
  dish_bamboo_mushroom_soup,
  dish_lotus_pork_soup,
  dish_chestnut_rice,
  dish_cream_matsutake,
  dish_cheese_vegetables,
  dish_wood_ear_dumplings,
  dish_crispy_wheat_fish,
  dish_tomato_crucian,
  dish_lemon_trout,
  dish_pumpkin_perch_soup,
  dish_bamboo_grouper,
  dish_pepper_redtail,
  dish_herb_catfish,
  dish_corn_bream_soup,
  dish_honey_eel_rice,
  dish_sardine_rice_ball,
  dish_salt_mackerel,
  dish_lemon_bream_rice,
  dish_strawberry_cheese_cup,
  dish_berry_jam_biscuit,
  dish_honey_pumpkin_pie,
  dish_chestnut_milk_cake,
  dish_mint_lemon_drink,
  dish_lotus_milk_soup,
  dish_pine_honey_biscuit,
  dish_mountain_herb_tea,
  dish_seafood_rice,
  dish_valley_travel_bento,
} satisfies Partial<Record<BuiltinItemId, string>>;
