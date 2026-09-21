import type { BuiltinItemId, PetState } from './petTypes';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { inventoryItemLimit } from './saveMetadata';

export const processingRecipes = [
  { id: 'mill_flour', name: '磨制面粉', inputs: { wheat: 1 }, output: 'flour', quantity: 2, fee: 0, unlock: 'garden' },
  { id: 'strawberry_milk', name: '草莓牛奶', inputs: { farm_milk: 2, strawberry: 1 }, output: 'strawberry_milk', quantity: 2, fee: 0, unlock: 'barn' },
  { id: 'ad_milk', name: 'AD 高钙奶', inputs: { farm_milk: 1 }, output: 'ad_milk', quantity: 1, fee: 2, unlock: 'barn' },
  { id: 'cream', name: '鲜奶制奶油', inputs: { farm_milk: 2 }, output: 'cream', quantity: 1, fee: 0, unlock: 'barn' },
  { id: 'cheese', name: '鲜奶制奶酪', inputs: { farm_milk: 3 }, output: 'cheese', quantity: 1, fee: 0, unlock: 'barn' },
  { id: 'berry_jam', name: '林莓果酱', inputs: { forest_berry: 2 }, output: 'forest_berry_jam', quantity: 1, fee: 0, unlock: 'berry' },
  { id: 'cooking_oil', name: '葵花籽榨油', inputs: { sunflower_kernel: 2 }, output: 'cooking_oil', quantity: 1, fee: 0, unlock: 'sunflower' },
] as const satisfies readonly { id: string; name: string; inputs: Partial<Record<BuiltinItemId, number>>; output: BuiltinItemId; quantity: number; fee: number; unlock: string }[];
export type ProcessingId = typeof processingRecipes[number]['id'];
export const getProcessingUnlockReason = (pet: PetState, id: ProcessingId) => {
  const recipe = processingRecipes.find(r => r.id === id);
  if (!recipe) return '未知加工配方';
  const c = pet.community;
  if (recipe.unlock === 'garden' && !c.gardenBuilt) return '先开放菜地';
  if (recipe.unlock === 'barn' && !c.facilities.barn.built) return '先开放牛棚';
  if (recipe.unlock === 'berry' && !c.expedition.regions.forest.surveyed && !c.expedition.collection.forest_berry && !c.discoveredCrops.includes('berry') && !(pet.inventory.forest_berry > 0)) return '先发现林莓';
  if (recipe.unlock === 'sunflower' && !c.expedition.regions.hills.surveyed && !c.discoveredCrops.includes('sunflower')) return '先在山丘发现向日葵';
  return '';
};
export const getProcessingLimit = (pet: PetState, id: ProcessingId) => {
  const r = processingRecipes.find(entry => entry.id === id);
  if (!r || getProcessingUnlockReason(pet, id)) return 0;
  return Math.max(0, Math.min(99, Math.floor((inventoryItemLimit - (pet.inventory[r.output] ?? 0)) / r.quantity),
    r.fee ? Math.floor(pet.coins / r.fee) : 99, ...Object.entries(r.inputs).map(([item, count]) => Math.floor((pet.inventory[item] ?? 0) / count))));
};
/** A revision makes double clicks and stale batch previews atomic, including after reload. */
export const processFood = (pet: PetState, id: ProcessingId, batches: number, revision: number, now = Date.now()): PetState => {
  const r = processingRecipes.find(entry => entry.id === id);
  if (!r || pet.timePause || !canSpendCompanionTime(pet) || pet.community.processing.revision !== revision || !Number.isInteger(batches) || batches < 1 || batches > getProcessingLimit(pet, id)) return pet;
  let inventory = Object.entries(r.inputs).reduce((stock, [item, count]) => removeInventoryItem(stock, item, count * batches), pet.inventory);
  inventory = addInventoryItem(inventory, r.output, r.quantity * batches);
  return { ...pet, inventory, coins: pet.coins - r.fee * batches, lastInteractionAt: now,
    community: { ...pet.community, processing: { revision: revision + 1 } }, recentEvent: `${r.name}完成，得到 ${r.quantity * batches} 份，已放入共用库存。${r.fee ? `调制费 ${r.fee * batches} 金币。` : '免费加工。'}` };
};
