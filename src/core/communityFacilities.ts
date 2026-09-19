import { facilities, facilityAvailable, facilityIds } from './communityData';
import type { CommunityRoute, FacilityId } from './communityTypes';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { addSkillXp, practiceSkillXp } from './partnerSchedule';
import { updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';

export const discoverCommunityFacility = (pet: PetState, purpose?: CommunityRoute): PetState => {
  const id = purpose && facilityIds.includes(purpose as FacilityId) ? purpose as FacilityId
    : !purpose ? facilityIds.find(id => !pet.community.facilities[id].found && facilityAvailable(pet, id)) : undefined;
  if (!id || !facilityAvailable(pet, id) || pet.community.facilities[id].found) return pet;
  return { ...pet, community: { ...pet.community, facilities: { ...pet.community.facilities, [id]: { ...pet.community.facilities[id], found: true } } } };
};
export const workCommunityFacility = (pet: PetState, id: FacilityId, expected: number, now = Date.now()): PetState => {
  const state = pet.community.facilities[id];
  if (!state || !canSpendCompanionTime(pet) || !facilityAvailable(pet, id) || !state.found || state.built || state.work !== expected || expected >= 2) return pet;
  if (pet.hunger < 4 || pet.energy < 4) return { ...pet, recentEvent: '修复需要 4 饱食、4 体力，请先休整。' };
  return updatePetSatiety({ ...pet, hunger: pet.hunger - 4, energy: pet.energy - 4, lastInteractionAt: now,
    community: { ...pet.community, facilities: { ...pet.community.facilities, [id]: { ...state, work: expected + 1 } } },
    partnerSchedule: { ...pet.partnerSchedule, skills: { ...pet.partnerSchedule.skills, garden: addSkillXp(pet.partnerSchedule.skills.garden, practiceSkillXp) } },
    recentEvent: `完成了${facilities[id].jobs[expected]}，记下一次园艺练习。` });
};
export const buildCommunityFacility = (pet: PetState, id: FacilityId, now = Date.now()): PetState => {
  const state = pet.community.facilities[id], cost = facilities[id];
  if (!state || !cost || !canSpendCompanionTime(pet) || !facilityAvailable(pet, id) || !state.found || state.built || state.work < 2) return pet;
  if (pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone) return { ...pet, recentEvent: '建材或金币不足，已完成的修复会保留。' };
  if (id === 'fishing_hut' && (pet.inventory.fishing_rod ?? 0) >= inventoryItemLimit) return { ...pet, recentEvent: '请为小屋赠送的钓竿腾出一个库存位置。' };
  let inventory = removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', cost.wood), 'community_stone', cost.stone);
  if (id === 'fishing_hut') inventory = addInventoryItem(inventory, 'fishing_rod', 1);
  return { ...pet, coins: pet.coins - cost.coins, inventory, community: { ...pet.community,
    facilities: { ...pet.community.facilities, [id]: { found: true, work: 2, built: true } },
    market: id === 'stall' ? { ...pet.community.market, level: 1, lastVisitAt: now } : pet.community.market,
  }, recentEvent: `${cost.name}开放了！${cost.benefit}。` };
};
