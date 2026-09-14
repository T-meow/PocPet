import type { KitchenState } from './core/companionActivityTypes';
import platePlain from './assets/kitchen/plate_plain.png';
import plateFlower from './assets/kitchen/plate_flower.png';
import plateStars from './assets/kitchen/plate_stars.png';
import servingBowl from './assets/kitchen/serving_bowl.png';
import servingGlass from './assets/kitchen/serving_glass.png';
import cookingSpoon from './assets/kitchen/cooking_spoon.png';
import kitchenPlant from './assets/kitchen/kitchen_plant.png';

export const kitchenSceneImages = { servingBowl, servingGlass, cookingSpoon, kitchenPlant };
export const kitchenPlateImages: Record<KitchenState['plating'], string> = { plain: platePlain, flower: plateFlower, stars: plateStars };
