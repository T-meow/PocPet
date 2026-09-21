import { advanceCommunityAnimals } from './communityFarm';
import { upgradeCommunityMarket } from './communityMarket';
import { getAnimalCapacity, getCommunityUpgradeQuote, type CommunityUpgradeId } from './communityUpgradeData';
import { removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import type { PetState } from './petTypes';
export { getCommunityUpgradeQuote } from './communityUpgradeData';

export const upgradeCommunityFacility = (pet: PetState, id: CommunityUpgradeId, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt || !canSpendCompanionTime(pet)) return pet;
  const quote = getCommunityUpgradeQuote(pet, id, expectedLevel);
  if (!quote.ready || !quote.task) return pet;
  if (id === 'stall') return upgradeCommunityMarket(pet, expectedLevel, now);
  // Settle using the old capacity. Time spent full never becomes extra production.
  pet = advanceCommunityAnimals(pet, now);
  const { task, targetLevel } = quote;
  const community = { ...pet.community, upgrades: { ...pet.community.upgrades, [id]: targetLevel } };
  if (id === 'garden') community.plots = [...community.plots, { id: targetLevel }];
  if (id === 'coop' || id === 'barn') {
    const state = community.animals[id], capacity = getAnimalCapacity(community, id);
    community.animals = { ...community.animals, [id]: { ...state, revision: state.revision + 1,
      nextAt: state.nextAt ?? (state.feed > 0 && state.stock + 2 <= capacity.stock ? now + state.cycleMs : undefined) } };
  }
  return { ...pet, coins: pet.coins - task.coins, inventory: Object.entries(task.items).reduce((inventory, [item, quantity]) => removeInventoryItem(inventory, item, quantity), pet.inventory),
    community, recentEvent: `${task.name}已完成！${task.effect}。` };
};
