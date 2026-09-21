import { facilities, facilityAvailable } from './communityData';
import type { FacilityId } from './communityTypes';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';

export const buildCommunityFacility = (pet: PetState, id: FacilityId, now = Date.now()): PetState => {
  const state = pet.community.facilities[id], cost = facilities[id];
  if (!state || !cost || !Number.isFinite(now) || pet.timePause || !canSpendCompanionTime(pet) || !facilityAvailable(pet, id) || state.built) return pet;
  if (pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone) return { ...pet, recentEvent: '建材或金币不足，备齐后一次交付即可开放。' };
  if (id === 'fishing_hut' && (pet.inventory.fishing_rod ?? 0) >= inventoryItemLimit) return { ...pet, recentEvent: '请为小屋赠送的钓竿腾出一个库存位置。' };
  let inventory = removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', cost.wood), 'community_stone', cost.stone);
  if (id === 'fishing_hut') inventory = addInventoryItem(inventory, 'fishing_rod', 1);
  return { ...pet, coins: pet.coins - cost.coins, inventory, community: { ...pet.community,
    facilities: { ...pet.community.facilities, [id]: { found: true, work: 2, built: true } },
    market: id === 'stall' ? { ...pet.community.market, level: 1, lastVisitAt: now } : pet.community.market,
  }, recentEvent: `${cost.name}开放了！${cost.benefit}。` };
};
