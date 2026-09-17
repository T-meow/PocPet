import type { CookingMethod } from './core/companionActivityTypes';
import mix from './assets/kitchen/equipment_mix.webp';
import pan from './assets/kitchen/equipment_pan.webp';
import blender from './assets/kitchen/equipment_blender.webp';
import oven from './assets/kitchen/equipment_oven.webp';
import mixFront from './assets/kitchen/equipment_mix_front.webp';
import panFront from './assets/kitchen/equipment_pan_front.webp';
import blenderFront from './assets/kitchen/equipment_blender_front.webp';
import ovenFront from './assets/kitchen/equipment_oven_front.webp';

// Foregrounds share the 512 px canvas with the full image, keeping food behind rims and glass.
export const kitchenEquipmentImages: Record<CookingMethod, { image: string; foreground: string }> = {
  mix: { image: mix, foreground: mixFront },
  pan: { image: pan, foreground: panFront },
  blender: { image: blender, foreground: blenderFront },
  oven: { image: oven, foreground: ovenFront },
};
