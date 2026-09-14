import type { ClassicTrophyId } from './core/classicTrophies';
import studyBronze from './assets/trophies/study_bronze.png';
import studySilver from './assets/trophies/study_silver.png';
import studyGold from './assets/trophies/study_gold.png';
import cookingBronze from './assets/trophies/cooking_bronze.png';
import cookingSilver from './assets/trophies/cooking_silver.png';
import cookingGold from './assets/trophies/cooking_gold.png';
import gardenBronze from './assets/trophies/garden_bronze.png';
import gardenSilver from './assets/trophies/garden_silver.png';
import gardenGold from './assets/trophies/garden_gold.png';
import exerciseBronze from './assets/trophies/exercise_bronze.png';
import exerciseSilver from './assets/trophies/exercise_silver.png';
import exerciseGold from './assets/trophies/exercise_gold.png';
import diamond from './assets/trophies/diamond.png';

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
