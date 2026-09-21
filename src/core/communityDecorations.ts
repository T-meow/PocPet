import { removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { communityDecorations, communityDecorationIds, type CommunityDecorationId } from './regionalTreasures';
import type { PetState } from './petTypes';

export const buildCommunityDecoration = (pet: PetState, id: CommunityDecorationId): PetState => {
  if (pet.timePause || !communityDecorationIds.includes(id) || !canSpendCompanionTime(pet) || pet.community.decorations.includes(id)) return pet;
  const decoration = communityDecorations[id];
  if (Object.entries(decoration.items).some(([item, count]) => (pet.inventory[item] ?? 0) < count)) return { ...pet, recentEvent: '装饰材料还未备齐，珍宝也可以保留收藏或换钱。' };
  return { ...pet, inventory: Object.entries(decoration.items).reduce((stock, [item, count]) => removeInventoryItem(stock, item, count), pet.inventory),
    community: { ...pet.community, decorations: [...pet.community.decorations, id] }, recentEvent: `「${decoration.name}」建好了！已永久陈列在农场「旅途与日常」的珍宝展台，出售其他同类珍宝不会影响装饰。` };
};
