import doroGoodEndingImage from '../mods/mod-doro/cg/good_ending_year_1.png';
import doroBathImage from '../mods/mod-doro/pet/bath.png';
import doroContentImage from '../mods/mod-doro/pet/content.png';
import doroDirtyImage from '../mods/mod-doro/pet/dirty.png';
import doroEatCookieImage from '../mods/mod-doro/pet/eat_cookie.png';
import doroEatMeatImage from '../mods/mod-doro/pet/eat_meat.png';
import doroEatNoodlesImage from '../mods/mod-doro/pet/eat_noodles.png';
import doroGiveHeartImage from '../mods/mod-doro/pet/give_heart.png';
import doroHappyImage from '../mods/mod-doro/pet/happy.png';
import doroHungryImage from '../mods/mod-doro/pet/hungry.png';
import doroLevelUpImage from '../mods/mod-doro/pet/level_up.png';
import doroReadingBooksImage from '../mods/mod-doro/pet/reading_books.png';
import doroSadImage from '../mods/mod-doro/pet/sad.png';
import doroSickImage from '../mods/mod-doro/pet/sick.png';
import doroSleepingImage from '../mods/mod-doro/pet/sleeping.png';
import doroTiredImage from '../mods/mod-doro/pet/tired.png';
import doroWorkFoodImage from '../mods/mod-doro/pet/work_food.png';
import doroWorkPlantsImage from '../mods/mod-doro/pet/work_plants.png';
import doroWorkoutImage from '../mods/mod-doro/pet/workout.png';
import mintGoodEndingImage from '../mods/mod-mint/cg/good_ending_year_1.png';
import mintEmergencyBiscuitImage from '../mods/mod-mint/items/emergency_biscuit.png';
import mintBathImage from '../mods/mod-mint/pet/bath.png';
import mintContentImage from '../mods/mod-mint/pet/content.png';
import mintDirtyImage from '../mods/mod-mint/pet/dirty.png';
import mintEatCookieImage from '../mods/mod-mint/pet/eat_cookie.png';
import mintEatMeatImage from '../mods/mod-mint/pet/eat_meat.png';
import mintEatNoodlesImage from '../mods/mod-mint/pet/eat_noodles.png';
import mintGiveHeartImage from '../mods/mod-mint/pet/give_heart.png';
import mintHappyImage from '../mods/mod-mint/pet/happy.png';
import mintHungryImage from '../mods/mod-mint/pet/hungry.png';
import mintLevelUpImage from '../mods/mod-mint/pet/level_up.png';
import mintReadingBooksImage from '../mods/mod-mint/pet/reading_books.png';
import mintSadImage from '../mods/mod-mint/pet/sad.png';
import mintSickImage from '../mods/mod-mint/pet/sick.png';
import mintSleepingImage from '../mods/mod-mint/pet/sleeping.png';
import mintTiredImage from '../mods/mod-mint/pet/tired.png';
import mintWorkFoodImage from '../mods/mod-mint/pet/work_food.png';
import mintWorkPlantsImage from '../mods/mod-mint/pet/work_plants.png';
import mintWorkoutImage from '../mods/mod-mint/pet/workout.png';
import deepseekGoodEndingImage from '../mods/mod-deepseek/cg/good_ending_year_1.png';
import deepseekBathImage from '../mods/mod-deepseek/pet/bath.png';
import deepseekContentImage from '../mods/mod-deepseek/pet/content.png';
import deepseekDirtyImage from '../mods/mod-deepseek/pet/dirty.png';
import deepseekEatCookieImage from '../mods/mod-deepseek/pet/eat_cookie.png';
import deepseekEatMeatImage from '../mods/mod-deepseek/pet/eat_meat.png';
import deepseekEatNoodlesImage from '../mods/mod-deepseek/pet/eat_noodles.png';
import deepseekGiveHeartImage from '../mods/mod-deepseek/pet/give_heart.png';
import deepseekHappyImage from '../mods/mod-deepseek/pet/happy.png';
import deepseekHungryImage from '../mods/mod-deepseek/pet/hungry.png';
import deepseekLevelUpImage from '../mods/mod-deepseek/pet/level_up.png';
import deepseekReadingBooksImage from '../mods/mod-deepseek/pet/reading_books.png';
import deepseekSadImage from '../mods/mod-deepseek/pet/sad.png';
import deepseekSickImage from '../mods/mod-deepseek/pet/sick.png';
import deepseekSleepingImage from '../mods/mod-deepseek/pet/sleeping.png';
import deepseekTiredImage from '../mods/mod-deepseek/pet/tired.png';
import deepseekWorkFoodImage from '../mods/mod-deepseek/pet/work_food.png';
import deepseekWorkPlantsImage from '../mods/mod-deepseek/pet/work_plants.png';
import deepseekWorkoutImage from '../mods/mod-deepseek/pet/workout.png';
import { builtinDeepSeekManifest, builtinDoroManifest, builtinMintManifest } from './builtinPetModManifests';
import type { ActivePetMod } from './mod';

export const builtinDoroMod: ActivePetMod = {
  manifest: builtinDoroManifest,
  petImageUrls: {
    bath: doroBathImage,
    content: doroContentImage,
    dirty: doroDirtyImage,
    eat_cookie: doroEatCookieImage,
    eat_meat: doroEatMeatImage,
    eat_noodles: doroEatNoodlesImage,
    give_heart: doroGiveHeartImage,
    happy: doroHappyImage,
    hungry: doroHungryImage,
    level_up: doroLevelUpImage,
    reading_books: doroReadingBooksImage,
    sad: doroSadImage,
    sick: doroSickImage,
    sleeping: doroSleepingImage,
    tired: doroTiredImage,
    work_food: doroWorkFoodImage,
    work_plants: doroWorkPlantsImage,
    workout: doroWorkoutImage,
  },
  itemImageUrls: {},
  cgImageUrls: {
    good_ending_year_1: doroGoodEndingImage,
  },
};

export const builtinMintMod: ActivePetMod = {
  manifest: builtinMintManifest,
  petImageUrls: {
    bath: mintBathImage,
    content: mintContentImage,
    dirty: mintDirtyImage,
    eat_cookie: mintEatCookieImage,
    eat_meat: mintEatMeatImage,
    eat_noodles: mintEatNoodlesImage,
    give_heart: mintGiveHeartImage,
    happy: mintHappyImage,
    hungry: mintHungryImage,
    level_up: mintLevelUpImage,
    reading_books: mintReadingBooksImage,
    sad: mintSadImage,
    sick: mintSickImage,
    sleeping: mintSleepingImage,
    tired: mintTiredImage,
    work_food: mintWorkFoodImage,
    work_plants: mintWorkPlantsImage,
    workout: mintWorkoutImage,
  },
  itemImageUrls: {
    emergency_biscuit: mintEmergencyBiscuitImage,
  },
  cgImageUrls: {
    good_ending_year_1: mintGoodEndingImage,
  },
};

export const builtinDeepSeekMod: ActivePetMod = {
  manifest: builtinDeepSeekManifest,
  petImageUrls: {
    bath: deepseekBathImage, content: deepseekContentImage, dirty: deepseekDirtyImage,
    eat_cookie: deepseekEatCookieImage, eat_meat: deepseekEatMeatImage, eat_noodles: deepseekEatNoodlesImage,
    give_heart: deepseekGiveHeartImage, happy: deepseekHappyImage, hungry: deepseekHungryImage,
    level_up: deepseekLevelUpImage, reading_books: deepseekReadingBooksImage, sad: deepseekSadImage,
    sick: deepseekSickImage, sleeping: deepseekSleepingImage, tired: deepseekTiredImage,
    work_food: deepseekWorkFoodImage, work_plants: deepseekWorkPlantsImage, workout: deepseekWorkoutImage,
  },
  itemImageUrls: {},
  cgImageUrls: {
    good_ending_year_1: deepseekGoodEndingImage,
  },
};

export const builtinPetMods: readonly ActivePetMod[] = [builtinDoroMod, builtinMintMod, builtinDeepSeekMod];

export const getBuiltinPetMod = (modId?: string) =>
  builtinPetMods.find((mod) => mod.manifest.id === modId) ?? null;
