import type { CookingMethod } from './core/companionActivityTypes';
import mix from './assets/kitchen/equipment_mix.png';
import pan from './assets/kitchen/equipment_pan.png';
import blender from './assets/kitchen/equipment_blender.png';
import oven from './assets/kitchen/equipment_oven.png';
import mixFront from './assets/kitchen/equipment_mix_front.png';
import panFront from './assets/kitchen/equipment_pan_front.png';
import blenderFront from './assets/kitchen/equipment_blender_front.png';
import ovenFront from './assets/kitchen/equipment_oven_front.png';

// Foregrounds share the 512 px canvas with the full image, keeping food behind rims and glass.
export const kitchenEquipmentImages: Record<CookingMethod, { image: string; foreground: string }> = {
  mix: { image: mix, foreground: mixFront },
  pan: { image: pan, foreground: panFront },
  blender: { image: blender, foreground: blenderFront },
  oven: { image: oven, foreground: ovenFront },
};
