import type { KitchenState } from './core/companionActivityTypes';
import platePlain from './assets/kitchen/plate_plain.webp';
import plateFlower from './assets/kitchen/plate_flower.webp';
import plateStars from './assets/kitchen/plate_stars.webp';
import servingBowl from './assets/kitchen/serving_bowl.webp';
import servingGlass from './assets/kitchen/serving_glass.webp';
import cookingSpoon from './assets/kitchen/cooking_spoon.webp';
import kitchenPlant from './assets/kitchen/kitchen_plant.webp';

export const kitchenSceneImages = { servingBowl, servingGlass, cookingSpoon, kitchenPlant };
export const kitchenPlateImages: Record<KitchenState['plating'], string> = { plain: platePlain, flower: plateFlower, stars: plateStars };
