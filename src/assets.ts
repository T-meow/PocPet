import coin from './assets/icon/coin.webp';
import trailMix from './assets/icon/item_trail_mix.webp';
import berryBait from './assets/icon/item_berry_bait.webp';
import trailRope from './assets/icon/item_trail_rope.webp';
import coinHoard from './assets/icon/item_coin_hoard.webp';
import valleyAmber from './assets/icon/item_valley_amber.webp';
import ancientGoldBar from './assets/icon/item_ancient_gold_bar.webp';
import { kitchenItemIcons } from './companionActivityAssets';
import goodEndingCg1 from './assets/CG1.png';
import iconAdMilk from './assets/icon/icon_ADmilk.webp';
import iconBeltedBell from './assets/icon/icon_belted_bell.webp';
import iconBerryCake from './assets/icon/icon_berry_cake.webp';
import itemBirthdayCake from './assets/icon/item_birthday_cake.webp';
import iconCloudPuff from './assets/icon/icon_cloud_puff.webp';
import iconFlowers from './assets/icon/icon_flowers.webp';
import iconPigTotters from './assets/icon/icon_pigtotters.webp';
import iconShinyStickers from './assets/icon/icon_shiny_stickers.webp';
import itemBento from './assets/icon/item_bento.webp';
import itemBlanket from './assets/icon/item_blanket.webp';
import itemEmergencyBiscuit from './assets/icon/item_emergency_biscuit.webp';
import sodaBiscuitBox from './assets/icon/item_soda_biscuit_box.webp';
import itemEnergyDrink from './assets/icon/item_energy_drink.webp';
import itemGiftBox from './assets/icon/item_gift_box1.webp';
import itemGoldenApple from './assets/icon/item_golden_apple.webp';
import itemFruitTreeSapling from './assets/icon/item_fruit_tree_sapling.webp';
import itemCareTreeSapling from './assets/icon/item_care_tree_sapling.webp';
import itemGiftTreeSapling from './assets/icon/item_gift_tree_sapling.webp';
import itemMoneyTreeSapling from './assets/icon/item_money_tree_sapling.webp';
import itemGoldenAppleTreeSapling from './assets/icon/item_golden_apple_tree_sapling.webp';
import itemNormalFertilizer from './assets/icon/item_normal_fertilizer.webp';
import itemHeartFertilizer from './assets/icon/item_heart_fertilizer.webp';
import itemHarvestNutrient from './assets/icon/item_harvest_nutrient.webp';
import itemMedicine from './assets/icon/item_medicine.webp';
import itemNutriMeal from './assets/icon/item_nutri_meal.webp';
import itemOrange from './assets/icon/item_orange.webp';
import itemApple from './assets/icon/item_apple.webp';
import itemBanana from './assets/icon/item_banana.webp';
import itemWatermelon from './assets/icon/item_watermelon.webp';
import itemPictureBook from './assets/icon/item_picture_book.webp';
import itemStrawberryMilk from './assets/icon/item_strawberry_milk.webp';
import itemShampoo from './assets/icon/item_shampoo.webp';
import itemToyBall from './assets/icon/item_toy_ball.webp';
import itemVitaminTablet from './assets/icon/item_vitamin_tablet.webp';
import itemWetWipes from './assets/icon/item_wet_wipes.webp';
import petBath from './assets/pet/pet_bath.png';
import petDirtySad from './assets/pet/pet_dirty_sad.png';
import petEatCookie from './assets/pet/pet_eat_cookie.png';
import petEatMeat from './assets/pet/pet_eat_meat.png';
import petEatNoodles from './assets/pet/pet_eat_noodles.png';
import petGiveHeart from './assets/pet/pet_give_heart.png';
import petHappy from './assets/pet/pet_happy.png';
import petHungry from './assets/pet/pet_hungry.png';
import petIdleSit from './assets/pet/pet_idle_sit.png';
import petLittleDirty from './assets/pet/pet_little_dirty.png';
import petLevelUp from './assets/pet/pet_levelUp.png';
import petReadingBooks from './assets/pet/pet_reading_books.png';
import petSick from './assets/pet/pet_sick1.png';
import petSleep from './assets/pet/pet_sleep.png';
import petWorkout from './assets/pet/pet_workout.png';
import petWorkMakingFood from './assets/pet/pet_work_making_food.png';
import petWorkWateringPlants from './assets/pet/pet_work_watering_plants.png';
import tree1 from './assets/tree1.webp';
import tree2 from './assets/tree2.webp';
import tree3 from './assets/tree3.webp';
import tree4 from './assets/tree4.webp';
import tree5 from './assets/tree5.webp';
import type { ActivePetMod } from './core/mod';
import type { BuiltinItemId, PetStatus, RecentActivity } from './core/petTypes';

export const currencyIcon = coin;
export const giftBoxIcon = itemGiftBox;
export const unknownItemIcon = itemGiftBox;
export const goodEndingImage = goodEndingCg1;
export const treeStageImages = [tree1, tree2, tree3, tree4, tree5] as const;

export const itemIcons: Record<BuiltinItemId, string> = {
  trail_mix: trailMix,
  berry_bait: berryBait,
  trail_rope: trailRope,
  coin_hoard: coinHoard,
  valley_amber: valleyAmber,
  ancient_gold_bar: ancientGoldBar,
  ...kitchenItemIcons,
  emergency_biscuit: itemEmergencyBiscuit,
  soda_biscuit_box: sodaBiscuitBox,
  bento: itemBento,
  orange: itemOrange,
  apple: itemApple,
  banana: itemBanana,
  watermelon: itemWatermelon,
  nutri_meal: itemNutriMeal,
  pig_trotter: iconPigTotters,
  strawberry_cake: iconBerryCake,
  birthday_cake: itemBirthdayCake,
  ad_milk: iconAdMilk,
  strawberry_milk: itemStrawberryMilk,
  small_bouquet: iconFlowers,
  shiny_sticker: iconShinyStickers,
  soft_cloud_doll: iconCloudPuff,
  ribbon_bell: iconBeltedBell,
  toy_ball: itemToyBall,
  picture_book: itemPictureBook,
  shampoo: itemShampoo,
  wet_wipes: itemWetWipes,
  medicine: itemMedicine,
  vitamin_tablet: itemVitaminTablet,
  blanket: itemBlanket,
  energy_drink: itemEnergyDrink,
  golden_apple: itemGoldenApple,
  fruit_tree_sapling: itemFruitTreeSapling,
  care_tree_sapling: itemCareTreeSapling,
  gift_tree_sapling: itemGiftTreeSapling,
  money_tree_sapling: itemMoneyTreeSapling,
  golden_apple_tree_sapling: itemGoldenAppleTreeSapling,
  normal_fertilizer: itemNormalFertilizer,
  heart_fertilizer: itemHeartFertilizer,
  harvest_nutrient: itemHarvestNutrient,
};

export const petStatusImages: Record<PetStatus, string> = {
  content: petIdleSit,
  hungry: petHungry,
  sad: petDirtySad,
  dirty: petLittleDirty,
  tired: petReadingBooks,
  sick: petSick,
  sleeping: petSleep,
};

export const petActivityImages: Partial<Record<RecentActivity, string>> = {
  happy: petHappy,
  bath: petBath,
  eat_cookie: petEatCookie,
  eat_noodles: petEatNoodles,
  eat_meat: petEatMeat,
  give_heart: petGiveHeart,
  level_up: petLevelUp,
  reading_books: petReadingBooks,
  workout: petWorkout,
  work_food: petWorkMakingFood,
  work_plants: petWorkWateringPlants,
};


const omitUndefinedValues = <T extends string>(values?: Partial<Record<T, string>>): Partial<Record<T, string>> => {
  const result: Partial<Record<T, string>> = {};
  Object.entries(values ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') result[key as T] = value;
  });
  return result;
};

export const resolveItemIcons = (mod?: ActivePetMod | null): Record<string, string> => ({
  ...itemIcons,
  ...omitUndefinedValues(mod?.itemImageUrls),
});

export const resolvePetStatusImages = (mod?: ActivePetMod | null): Record<PetStatus, string> => ({
  ...petStatusImages,
  ...omitUndefinedValues(mod?.petImageUrls),
});

export const resolvePetActivityImages = (mod?: ActivePetMod | null): Partial<Record<RecentActivity, string>> => ({
  ...petActivityImages,
  ...omitUndefinedValues(mod?.petImageUrls),
});
