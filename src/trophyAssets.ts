import type { ClassicTrophyId } from './core/classicTrophies';
import studyBronze from './assets/trophies/study_bronze.webp';
import studySilver from './assets/trophies/study_silver.webp';
import studyGold from './assets/trophies/study_gold.webp';
import cookingBronze from './assets/trophies/cooking_bronze.webp';
import cookingSilver from './assets/trophies/cooking_silver.webp';
import cookingGold from './assets/trophies/cooking_gold.webp';
import gardenBronze from './assets/trophies/garden_bronze.webp';
import gardenSilver from './assets/trophies/garden_silver.webp';
import gardenGold from './assets/trophies/garden_gold.webp';
import exerciseBronze from './assets/trophies/exercise_bronze.webp';
import exerciseSilver from './assets/trophies/exercise_silver.webp';
import exerciseGold from './assets/trophies/exercise_gold.webp';
import diamond from './assets/trophies/diamond.webp';

export const trophyImages: Record<ClassicTrophyId | 'diamond', string> = {
  study_bronze: studyBronze,
  study_silver: studySilver,
  study_gold: studyGold,
  cooking_bronze: cookingBronze,
  cooking_silver: cookingSilver,
  cooking_gold: cookingGold,
  garden_bronze: gardenBronze,
  garden_silver: gardenSilver,
  garden_gold: gardenGold,
  exercise_bronze: exerciseBronze,
  exercise_silver: exerciseSilver,
  exercise_gold: exerciseGold,
  diamond: diamond,
};
