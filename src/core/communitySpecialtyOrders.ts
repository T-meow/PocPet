import { recordEarnedCoins } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { removeInventoryItem } from './items';
import { clampCoins } from './petStats';
import { hashString } from './utils';
import type { PetState } from './petTypes';
import { decoratedOrderCoins } from './decorationEffects';
import { getRegionUnlocked } from './expeditionData';

export const specialtyGoods = {
  valley_mushroom: { name: '溪谷野菇', quantity: 12, base: 10, region: 'valley' },
  bamboo_shoot: { name: '嫩笋', quantity: 16, base: 6, region: 'valley' },
  lotus_seed: { name: '莲子', quantity: 8, base: 15, region: 'valley' },
  hill_honey: { name: '花丘蜂蜜', quantity: 8, base: 14, region: 'hills' },
  forest_berry: { name: '雾松林莓', quantity: 8, base: 12, region: 'forest' },
  coast_kelp: { name: '潮池海藻', quantity: 8, base: 12, region: 'coast' },
  observatory_part: { name: '观测零件', quantity: 8, base: 18, region: 'station' },
} as const;
export type SpecialtyItem = keyof typeof specialtyGoods;
export interface SpecialtyOrder { id: string; day: string; item: SpecialtyItem; quantity: number; unitPrice: number; multiplier: 3 | 5; acceptedAt: number; rewardCoins?: number }
export interface SpecialtyOrderState { acceptedDay: string; completed: number; active?: SpecialtyOrder }
export const specialtyDay = (pet: PetState, now = Date.now()) => [pet.community.specialtyOrders.acceptedDay, getEffectiveDailyDateKey(pet, now)].sort()[1];
export const getSpecialtyCandidates = (pet: PetState, now = Date.now()): SpecialtyOrder[] => {
  if (!(pet.adventure.completed.tutorial ?? 0)) return [];
  const day = specialtyDay(pet, now), ids = (Object.keys(specialtyGoods) as SpecialtyItem[]).filter(id => getRegionUnlocked(pet, specialtyGoods[id].region));
  if (!ids.length) return [];
  const rotation = hashString(day + ':valley-purchase') % ids.length;
  const urgent = Math.floor(Date.parse(day + 'T12:00:00Z') / 86400000) % 3 === 0;
  return [0, 1].slice(0, ids.length).map(index => {
    const item = ids[(rotation + index) % ids.length], data = specialtyGoods[item], multiplier = urgent && index === 0 ? 5 : 3;
    return { id: `specialty:${day}:${item}`, day, item, quantity: data.quantity, unitPrice: data.base * multiplier, multiplier, acceptedAt: 0, rewardCoins: decoratedOrderCoins(pet, data.quantity * data.base * multiplier) };
  });
};
export const canClaimSpecialtyOrder = (pet: PetState) => {
  const order = pet.community.specialtyOrders.active;
  return Boolean(order && (pet.inventory[order.item] ?? 0) >= order.quantity);
};
export const acceptSpecialtyOrder = (pet: PetState, id: string, now = Date.now()): PetState => {
  const state = pet.community.specialtyOrders, day = specialtyDay(pet, now);
  const order = getSpecialtyCandidates(pet, now).find(value => value.id === id);
  if (pet.timePause || !order || state.active || state.acceptedDay >= day) return pet;
  return { ...pet, community: { ...pet.community, specialtyOrders: { ...state, acceptedDay: day, active: { ...order, acceptedAt: now } } }, recentEvent: `已锁定${order.multiplier}倍收购价及装饰加成。交付${specialtyGoods[order.item].name} ×${order.quantity}可得 ${order.rewardCoins} 金币；接取后不过期。` };
};
export const cancelSpecialtyOrder = (pet: PetState, id: string): PetState => {
  const state = pet.community.specialtyOrders;
  if (pet.timePause || state.active?.id !== id) return pet;
  return { ...pet, community: { ...pet.community, specialtyOrders: { ...state, active: undefined } }, recentEvent: '已放弃收购单，今天的接取次数不会退还。' };
};
export const claimSpecialtyOrder = (pet: PetState, id: string): PetState => {
  const state = pet.community.specialtyOrders, order = state.active;
  if (pet.timePause || !order || order.id !== id || !canClaimSpecialtyOrder(pet) || pet.adventure.active || pet.community.expedition.active || pet.community.fishing.active) return pet;
  if (clampCoins(pet.coins + (order.rewardCoins ?? order.quantity * order.unitPrice)) !== pet.coins + (order.rewardCoins ?? order.quantity * order.unitPrice)) return { ...pet, recentEvent: '金币已满，收购单与物品继续保留。' };
  const coins = clampCoins(pet.coins + (order.rewardCoins ?? order.quantity * order.unitPrice)) - pet.coins;
  return recordEarnedCoins({ ...pet, coins: pet.coins + coins, inventory: removeInventoryItem(pet.inventory, order.item, order.quantity),
    community: { ...pet.community, specialtyOrders: { ...state, active: undefined, completed: state.completed + 1 } }, recentEvent: `特产交付完成，收到 ${coins} 金币。` }, coins);
};
