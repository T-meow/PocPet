import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime, kitchenBatchLimit } from './kitchen';
import { inventoryItemLimit } from './saveMetadata';
import { regions } from './expeditionData';
import { getHandcraftRecipe, type HandcraftId } from './handcraftData';
import type { PetState } from './petTypes';

export const getHandcraftUnlockReason = (pet: PetState, id: HandcraftId) => {
  const recipe = getHandcraftRecipe(id);
  if (!recipe) return '未知手工配方';
  const missing = recipe.regions.filter(region => !pet.community.expedition.regions[region].surveyed && !(region === 'valley' && pet.adventure.valleyCompleted.includes('valley_camp')));
  return missing.length ? '先完成' + missing.map(region => regions[region].name).join('、') + '的地区故事' : '';
};
export const getHandcraftLimit = (pet: PetState, id: HandcraftId) => {
  const recipe = getHandcraftRecipe(id), state = pet.kitchen.handcraft;
  if (!recipe || getHandcraftUnlockReason(pet, id) || state.revision >= Number.MAX_SAFE_INTEGER) return 0;
  return Math.max(0, Math.min(kitchenBatchLimit, inventoryItemLimit - (pet.inventory[id] ?? 0), Number.MAX_SAFE_INTEGER - (state.made[id] ?? 0),
    ...Object.entries(recipe.inputs).map(([input, quantity]) => Math.floor((pet.inventory[input] ?? 0) / quantity))));
};
export const getHandcraftReason = (pet: PetState, id: HandcraftId, quantity: number) => {
  if (pet.timePause) return '时间已冻结，恢复后继续制作';
  const unlock = getHandcraftUnlockReason(pet, id);
  if (unlock) return unlock;
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '等伙伴空闲后再一起制作';
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > kitchenBatchLimit) return `每次可制作 1–${kitchenBatchLimit} 件`;
  if (quantity > getHandcraftLimit(pet, id)) return (pet.inventory[id] ?? 0) + quantity > inventoryItemLimit ? '成品仓库空间不足' : '材料不足，或制作记录已达上限';
  return '';
};
export const craftHandcraft = (pet: PetState, id: HandcraftId, quantity: number, expectedRevision: number, now = Date.now()): PetState => {
  const recipe = getHandcraftRecipe(id), state = pet.kitchen.handcraft;
  if (!recipe || !Number.isFinite(now) || state.revision !== expectedRevision || getHandcraftReason(pet, id, quantity)) return pet;
  let inventory = Object.entries(recipe.inputs).reduce((stock, [input, amount]) => removeInventoryItem(stock, input, amount * quantity), pet.inventory);
  inventory = addInventoryItem(inventory, id, quantity);
  return { ...pet, inventory, lastInteractionAt: now, kitchen: { ...pet.kitchen, handcraft: { ...state, revision: state.revision + 1, made: { ...state.made, [id]: (state.made[id] ?? 0) + quantity } } },
    recentEvent: `做好了${recipe.name} ×${quantity}，已收入背包，可以带到小摊出售。` };
};
