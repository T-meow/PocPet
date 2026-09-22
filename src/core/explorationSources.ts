import { wildIngredients } from './foodCatalog';
import { regionalTreasures } from './regionalTreasures';
import { regionIds, regions } from './expeditionData';
import { getLandmarkReason, mapRegionForExpedition, type LandmarkNode } from './landmarkProgress';
import type { PetState } from './petTypes';

export const getExplorationSource = (pet: PetState, item: string) => {
  const target = item === 'aquamarine' ? 'creek_aquamarine' : item;
  const wild = wildIngredients[target as keyof typeof wildIngredients], treasure = regionalTreasures[target as keyof typeof regionalTreasures];
  const region = wild?.region ?? treasure?.region ?? (target === 'forest_berry_seed' ? 'forest' : ['materials', 'community_wood', 'community_stone', 'creek_herb', 'creek_herb_seed'].includes(target) ? 'valley' : regionIds.find(id => regions[id].product === target || regions[id].alternative === target));
  if (!region) return undefined;
  const node: LandmarkNode = target === 'creek_herb_seed' ? 'crossing' : getLandmarkReason(pet.adventure, mapRegionForExpedition[region], 'gather') ? 'entrance' : 'gather';
  return { region, node, target: ['community_wood', 'community_stone'].includes(target) ? 'materials' : target === 'creek_herb_seed' ? undefined : target };
};
