import { facilityIds } from '../../core/communityData';
import type { PetState } from '../../core/petTypes';

export const unlockLocalTestFacilities = (pet: PetState): PetState => {
  const c = pet.community;
  if (c.gardenBuilt && c.irrigationFound && c.herbDiscovered && c.repairStep >= 2
    && facilityIds.every(id => c.facilities[id].built && c.facilities[id].found && c.facilities[id].work >= 2)
    && c.market.level >= 1 && pet.garden.slots.every(slot => slot.unlocked) && (pet.inventory.fishing_rod ?? 0) >= 1) return pet;

  return {
    ...pet,
    garden: { ...pet.garden, slots: pet.garden.slots.map(slot => ({ ...slot, unlocked: true })) },
    inventory: { ...pet.inventory, fishing_rod: Math.max(1, pet.inventory.fishing_rod ?? 0) },
    community: {
      ...c,
      irrigationFound: true,
      herbDiscovered: true,
      repairStep: Math.max(2, c.repairStep),
      gardenBuilt: true,
      facilities: Object.fromEntries(facilityIds.map(id => [id, { ...c.facilities[id], found: true, work: Math.max(2, c.facilities[id].work), built: true }])) as typeof c.facilities,
      market: { ...c.market, level: Math.max(1, c.market.level) },
    },
    recentEvent: '本地测试：菜地、果园、鸡舍、牛棚、钓鱼小屋、上游和小摊已全部解锁。',
  };
};
