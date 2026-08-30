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
import { builtinDoroManifest } from './builtinPetModManifests';
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

export const builtinPetMods: readonly ActivePetMod[] = [builtinDoroMod];

export const getBuiltinPetMod = (modId?: string) =>
  builtinPetMods.find((mod) => mod.manifest.id === modId) ?? null;
