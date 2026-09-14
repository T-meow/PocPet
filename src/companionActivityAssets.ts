import type { DishId, KitchenMaterialId } from './core/companionActivityTypes';
import rice from './assets/icon/item_rice.png';
import egg from './assets/icon/item_egg.png';
import flour from './assets/icon/item_flour.png';
import carrot from './assets/icon/item_carrot.png';
import tomato from './assets/icon/item_tomato.png';
import greens from './assets/icon/item_greens.png';
import dishPlainRice from './assets/icon/item_dish_plain_rice.png';
import dishFruitSalad from './assets/icon/item_dish_fruit_salad.png';
import dishBananaShake from './assets/icon/item_dish_banana_shake.png';
import dishWatermelonJuice from './assets/icon/item_dish_watermelon_juice.png';
import dishBiscuitCup from './assets/icon/item_dish_biscuit_cup.png';
import dishEggRice from './assets/icon/item_dish_egg_rice.png';
import dishCarrotRice from './assets/icon/item_dish_carrot_rice.png';
import dishFruitPancake from './assets/icon/item_dish_fruit_pancake.png';
import dishFruitPancakeBanana from './assets/icon/item_dish_fruit_pancake_banana.png';
import dishMilkCookies from './assets/icon/item_dish_milk_cookies.png';
import dishCarrotOmelet from './assets/icon/item_dish_carrot_omelet.png';
import dishRicePancake from './assets/icon/item_dish_rice_pancake.png';
import dishFruitPudding from './assets/icon/item_dish_fruit_pudding.png';
import dishFruitPuddingBanana from './assets/icon/item_dish_fruit_pudding_banana.png';
import dishApplePie from './assets/icon/item_dish_apple_pie.png';
import dishBiscuitLayerCake from './assets/icon/item_dish_biscuit_layer_cake.png';
import dishTomatoEggBowl from './assets/icon/item_dish_tomato_egg_bowl.png';
import dishPorkRiceBowl from './assets/icon/item_dish_pork_rice_bowl.png';

export const kitchenItemIcons: Record<DishId | KitchenMaterialId, string> = {
  rice: rice,
  egg: egg,
  flour: flour,
  carrot: carrot,
  tomato: tomato,
  greens: greens,
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
};
