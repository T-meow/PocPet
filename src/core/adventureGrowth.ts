import type { PetState } from './petTypes';
import { getExpeditionMilestones } from './expeditionData';

type GrowthPet = Partial<Pick<PetState, 'adventure' | 'community'>>;
// Permanent first-time milestones only increase energy capacity. Keep them
// separate from level-based consumption and heart multipliers.
export const getAdventureGrowthSources = (pet: GrowthPet) => [
  { id: 'tutorial', name: '首次踩点探索', energy: 3, achieved: (pet.adventure?.completed.tutorial ?? 0) > 0 },
  { id: 'valley', name: '首次溪谷探查', energy: 5, achieved: (pet.adventure?.completed.valley ?? 0) > 0 },
  { id: 'garden', name: '修好社区菜地', energy: 4, achieved: pet.community?.gardenBuilt === true },
  { id: 'order', name: '第一碗社区暖粥', energy: 3, achieved: pet.community?.firstOrderDelivered === true },
  ...getExpeditionMilestones(pet),
];
export const getAdventureEnergyBonus = (pet: GrowthPet) => getAdventureGrowthSources(pet).reduce((sum, source) => sum + (source.achieved ? source.energy : 0), 0);
