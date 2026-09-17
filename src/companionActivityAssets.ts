import type { DishId, KitchenMaterialId } from './core/companionActivityTypes';
import rice from './assets/icon/item_rice.webp';
import egg from './assets/icon/item_egg.webp';
import flour from './assets/icon/item_flour.webp';
import carrot from './assets/icon/item_carrot.webp';
import tomato from './assets/icon/item_tomato.webp';
import greens from './assets/icon/item_greens.webp';
import pork from './assets/icon/item_pork.webp';
import cabbage from './assets/icon/item_cabbage.webp';
import shiitake from './assets/icon/item_shiitake.webp';
import glutinousRice from './assets/icon/item_glutinous_rice.webp';
import braisedPork from './assets/icon/item_braised_pork.webp';
import redBeanPaste from './assets/icon/item_red_bean_paste.webp';
import mixedNuts from './assets/icon/item_mixed_nuts.webp';
import dishPlainRice from './assets/icon/item_dish_plain_rice.webp';
import dishFruitSalad from './assets/icon/item_dish_fruit_salad.webp';
import dishBananaShake from './assets/icon/item_dish_banana_shake.webp';
import dishWatermelonJuice from './assets/icon/item_dish_watermelon_juice.webp';
import dishBiscuitCup from './assets/icon/item_dish_biscuit_cup.webp';
import dishEggRice from './assets/icon/item_dish_egg_rice.webp';
import dishCarrotRice from './assets/icon/item_dish_carrot_rice.webp';
import dishFruitPancake from './assets/icon/item_dish_fruit_pancake.webp';
import dishFruitPancakeBanana from './assets/icon/item_dish_fruit_pancake_banana.webp';
import dishMilkCookies from './assets/icon/item_dish_milk_cookies.webp';
import dishCarrotOmelet from './assets/icon/item_dish_carrot_omelet.webp';
import dishRicePancake from './assets/icon/item_dish_rice_pancake.webp';
import dishFruitPudding from './assets/icon/item_dish_fruit_pudding.webp';
import dishFruitPuddingBanana from './assets/icon/item_dish_fruit_pudding_banana.webp';
import dishApplePie from './assets/icon/item_dish_apple_pie.webp';
import dishBiscuitLayerCake from './assets/icon/item_dish_biscuit_layer_cake.webp';
import dishTomatoEggBowl from './assets/icon/item_dish_tomato_egg_bowl.webp';
import dishPorkRiceBowl from './assets/icon/item_dish_pork_rice_bowl.webp';
import dishDumplingsPorkCabbage from './assets/icon/item_dish_dumplings_pork_cabbage.webp';
import dishDumplingsVegetable from './assets/icon/item_dish_dumplings_vegetable.webp';
import dishZongziBraisedPork from './assets/icon/item_dish_zongzi_braised_pork.webp';
import dishZongziRedBean from './assets/icon/item_dish_zongzi_red_bean.webp';
import dishMooncakeMixedNuts from './assets/icon/item_dish_mooncake_mixed_nuts.webp';
import dishMooncakeRedBean from './assets/icon/item_dish_mooncake_red_bean.webp';

export const kitchenItemIcons: Record<DishId | KitchenMaterialId, string> = {
  rice: rice,
  egg: egg,
  flour: flour,
  carrot: carrot,
  tomato: tomato,
  greens: greens,
  pork,
  cabbage,
  shiitake,
  glutinous_rice: glutinousRice,
  braised_pork: braisedPork,
  red_bean_paste: redBeanPaste,
  mixed_nuts: mixedNuts,
  dish_plain_rice: dishPlainRice,
  dish_fruit_salad: dishFruitSalad,
  dish_banana_shake: dishBananaShake,
  dish_watermelon_juice: dishWatermelonJuice,
  dish_biscuit_cup: dishBiscuitCup,
  dish_egg_rice: dishEggRice,
  dish_carrot_rice: dishCarrotRice,
  dish_fruit_pancake: dishFruitPancake,
  dish_fruit_pancake_banana: dishFruitPancakeBanana,
  dish_milk_cookies: dishMilkCookies,
  dish_carrot_omelet: dishCarrotOmelet,
  dish_rice_pancake: dishRicePancake,
  dish_fruit_pudding: dishFruitPudding,
  dish_fruit_pudding_banana: dishFruitPuddingBanana,
  dish_apple_pie: dishApplePie,
  dish_biscuit_layer_cake: dishBiscuitLayerCake,
  dish_tomato_egg_bowl: dishTomatoEggBowl,
  dish_pork_rice_bowl: dishPorkRiceBowl,
  dish_dumplings_pork_cabbage: dishDumplingsPorkCabbage,
  dish_dumplings_vegetable: dishDumplingsVegetable,
  dish_zongzi_braised_pork: dishZongziBraisedPork,
  dish_zongzi_red_bean: dishZongziRedBean,
  dish_mooncake_mixed_nuts: dishMooncakeMixedNuts,
  dish_mooncake_red_bean: dishMooncakeRedBean,
};

// Bottom offsets come from the approved food-and-plate silhouette in its 256 px master.
export const dishPresentation: Record<DishId, { container: string; rimBottom: string }> = {
  dish_plain_rice: { container: 'fixed_plate', rimBottom: '26.20%' },
  dish_fruit_salad: { container: 'fixed_plate', rimBottom: '25.65%' },
  dish_banana_shake: { container: 'fixed_glass', rimBottom: '16.00%' },
  dish_watermelon_juice: { container: 'fixed_glass', rimBottom: '16.00%' },
  dish_biscuit_cup: { container: 'fixed_dessert_glass', rimBottom: '16.00%' },
  dish_egg_rice: { container: 'fixed_plate', rimBottom: '25.92%' },
  dish_carrot_rice: { container: 'fixed_plate', rimBottom: '25.62%' },
  dish_fruit_pancake: { container: 'fixed_plate', rimBottom: '22.12%' },
  dish_fruit_pancake_banana: { container: 'fixed_plate', rimBottom: '22.29%' },
  dish_milk_cookies: { container: 'fixed_plate', rimBottom: '26.21%' },
  dish_carrot_omelet: { container: 'fixed_plate', rimBottom: '25.63%' },
  dish_rice_pancake: { container: 'fixed_plate', rimBottom: '24.50%' },
  dish_fruit_pudding: { container: 'fixed_plate', rimBottom: '22.79%' },
  dish_fruit_pudding_banana: { container: 'fixed_plate', rimBottom: '23.90%' },
  dish_apple_pie: { container: 'fixed_plate', rimBottom: '22.04%' },
  dish_biscuit_layer_cake: { container: 'fixed_plate', rimBottom: '17.82%' },
  dish_tomato_egg_bowl: { container: 'fixed_plate', rimBottom: '24.47%' },
  dish_pork_rice_bowl: { container: 'fixed_plate', rimBottom: '22.63%' },
  dish_dumplings_pork_cabbage: { container: 'fixed_plate', rimBottom: '25.78%' },
  dish_dumplings_vegetable: { container: 'fixed_plate', rimBottom: '25.78%' },
  dish_zongzi_braised_pork: { container: 'fixed_plate', rimBottom: '22.66%' },
  dish_zongzi_red_bean: { container: 'fixed_plate', rimBottom: '22.66%' },
  dish_mooncake_mixed_nuts: { container: 'fixed_plate', rimBottom: '25.00%' },
  dish_mooncake_red_bean: { container: 'fixed_plate', rimBottom: '25.00%' },
};
