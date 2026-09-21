import { isTravelFood, standardRationPrice, type RationSelection } from './explorationRations';
import { getInventoryItem } from './items';
import type { Inventory, ItemId, PetState } from './petTypes';

export const quoteFishingRations = (pet: PetState, hours: number, selection: RationSelection = { food: {}, autoFill: true }) => {
  const valid = [2, 4, 8].includes(hours), minimum = valid ? hours / 2 : 0, maximum = minimum * 2, nutrition = minimum * 36;
  const used: Inventory = {};
  let count = 0, hunger = 0, reason = valid ? '' : '请选择 2、4、8 小时';
  for (const [id, n] of Object.entries(selection.food)) {
    if (!Number.isSafeInteger(n) || n < 0 || !isTravelFood(id)) { reason ||= '只能携带普通可食用补给'; continue; }
    if (!n) continue;
    used[id] = n; count += n; hunger += (getInventoryItem(id as ItemId)!.effect.hunger ?? 0) * n;
  }
  const purchased = selection.autoFill ? Math.max(0, minimum - count, Math.ceil((nutrition - hunger) / 36)) : 0;
  const food = { ...used }, coins = purchased * standardRationPrice;
  if (purchased) food.trail_mix = (food.trail_mix ?? 0) + purchased;
  count += purchased; hunger += purchased * 36;
  if (count > maximum) reason ||= `全程最多携带 ${maximum} 份食物`;
  else if (count < minimum || hunger < nutrition) reason ||= `至少需要 ${minimum} 份食物、${nutrition} 点基础饱食`;
  if (Object.entries(used).some(([id, n]) => (pet.inventory[id] ?? 0) < n)) reason ||= '携带的食物超过库存';
  if (pet.coins < coins) reason ||= '补给金币不足';
  return { food, used, purchased, coins, count, hunger, minimum, maximum, nutrition, reason };
};
