import { toolDefinitions, type DurableToolId } from './fieldEquipmentData';
import { removeInventoryItem } from './items';
import type { PetState } from './petTypes';

// Each stack has one tool in use; all remaining units are unused spares.
// A packed rope keeps its wear here while the existing trip owns the physical unit.
export const getToolUsesLeft = (pet: PetState, id: DurableToolId, packed = false): number =>
  !packed && (pet.inventory[id] ?? 0) < 1 ? 0 : toolDefinitions[id].uses - (pet.community.toolWear[id] ?? 0);
export const toolDurabilityLabel = (pet: PetState, id: DurableToolId, packed = false) =>
  `剩余 ${getToolUsesLeft(pet, id, packed)}/${toolDefinitions[id].uses} 次${!packed && (pet.inventory[id] ?? 0) > 1 ? ` · 备用 ${pet.inventory[id] - 1} 件` : ''}`;
export const spendToolUse = (pet: PetState, id: DurableToolId, packed = false): { pet: PetState; broken: boolean } | undefined => {
  if (pet.timePause || getToolUsesLeft(pet, id, packed) <= 0) return undefined;
  const wear = (pet.community.toolWear[id] ?? 0) + 1, broken = wear >= toolDefinitions[id].uses;
  const toolWear = { ...pet.community.toolWear };
  if (broken) delete toolWear[id]; else toolWear[id] = wear;
  return { broken, pet: { ...pet, inventory: broken && !packed ? removeInventoryItem(pet.inventory, id) : pet.inventory, community: { ...pet.community, toolWear } } };
};
