import { applyHeartGain, incrementAchievementItemUse, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { adventureActorIds, adventureBagCapacity, adventureBusyMessage, getAdventureShopPrice, adventureStepCount, adventureTransportCost, adventureTransportLimit, createAdventureShopStock, getAdventureSteps, type AdventureChoice } from './adventureData';
import { getAdventureTreasureValue, getAdventureTripTreasure, isAdventureTreasure } from './adventureItems';
import { getAdventureBagCount, getAdventureItemPurchaseCapacity, getAdventureLastCompletedDay, isAdventureEntranceCompleteForDay, isAdventureSupply } from './adventureState';
import type { AdventureRegionId, AdventureResult } from './adventureTypes';
import { getItemStatEffect } from './itemEffects';
import { addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { activityText as L } from './kitchenRecipes';
import { clampCoins, clampPetEnergy, clampPetHealth, clampPetStat, getPetStatScale } from './petStats';
import type { Inventory, ItemId, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';
import { getEffectiveDailyDateKey } from './gameClock';
import { getDailyResetDateKey } from './dailyReset';

const fail = (pet: PetState, message: string): PetState => ({ ...pet, recentEvent: message });
export const getAdventureStartReason = (pet: PetState, region: AdventureRegionId = 'valley', now = Date.now()) => pet.adventure.active ? adventureBusyMessage()
  : pet.adventure.pending ? L('先收好上次行程的物资。', 'Collect the supplies from your last trip first.')
    : isAdventureEntranceCompleteForDay(pet.adventure, region, getEffectiveDailyDateKey(pet, now)) ? region === 'valley' ? L('今日溪谷入口已完成，次日凌晨 5 点后可再次探查。', 'Today’s valley scouting is complete. Return after 5 a.m. tomorrow.') : L('这张地图的入口探查已经完成，后续任务筹备中。', 'Entrance scouting is complete here. Further tasks are coming later.')
    : pet.isSleeping ? L('先叫醒伙伴，再一起出发。', 'Wake your companion before setting out.')
      : pet.partnerSchedule.active ? L('等伙伴结束社区工作再出发。', 'Wait until community work ends.')
        : pet.miniGames.active && !pet.miniGames.active.paused ? L('先暂停小游戏再出发。', 'Pause your game before setting out.')
          : pet.energy < 12 || pet.hunger < 45 ? L('出发至少需要 45 饱食度、12 体力，请先补充状态。', 'Restore at least 45 hunger and 12 energy before setting out.') : '';

export const claimAdventureStarter = (pet: PetState): PetState => {
  if (pet.adventure.starterClaimed && pet.adventure.starterMealsClaimed) return pet;
  const items: Inventory = { ...(!pet.adventure.starterClaimed ? { trail_mix: 2, berry_bait: 1 } : {}), ...(!pet.adventure.starterMealsClaimed ? { dish_carrot_rice: 4 } : {}) };
  if (Object.entries(items).some(([id, amount]) => getAdventureItemPurchaseCapacity(pet, id) < amount || (pet.inventory[id] ?? 0) + amount > inventoryItemLimit)) return fail(pet, L('先为入门补给腾出仓库空间。', 'Make room in your inventory for the starter supplies.'));
  return { ...pet, inventory: Object.entries(items).reduce((stock, [id, amount]) => addInventoryItem(stock, id, amount), pet.inventory),
    adventure: { ...pet.adventure, starterClaimed: true, starterMealsClaimed: true }, recentEvent: L('入门补给已放入仓库，包含四份胡萝卜蛋饭。整理行囊后就可以出发。', 'Starter supplies, including four carrot egg rice dishes, are in your inventory. Pack your bag to set out.') };
};

export const startAdventure = (pet: PetState, region: AdventureRegionId, actorId: string, actorName: string, bag: Inventory, tool: boolean, now = Date.now()): PetState => {
  const reason = getAdventureStartReason(pet, region, now);
  if (reason) return fail(pet, reason);
  if (region !== 'valley' || !actorId || actorId.length > 128) return pet;
  const entries = Object.entries(bag).filter(([, amount]) => amount !== 0);
  if (entries.some(([id, amount]) => !isAdventureSupply(id) || !Number.isInteger(amount) || amount < 1 || (pet.inventory[id] ?? 0) < amount)
    || getAdventureBagCount(Object.fromEntries(entries)) > adventureBagCapacity || (tool && (pet.inventory.trail_rope ?? 0) < 1)) return fail(pet, L('行囊或仓库物资已变化，请重新整理。', 'Your supplies have changed. Check your travel bag again.'));
  const id = `scout:${pet.createdAt}:${pet.adventure.tripsStarted + 1}:${now}`;
  const neighbors = adventureActorIds.filter(value => value !== actorId);
  const roll = hashString(id);
  // First trip teaches the service; later trips can have an empty clearing.
  const neighborId = pet.adventure.tripsStarted === 0 || roll % 3 !== 0 ? neighbors[roll % neighbors.length] : undefined;
  let inventory = entries.reduce((stock, [item, amount]) => removeInventoryItem(stock, item, amount), pet.inventory);
  if (tool) inventory = removeInventoryItem(inventory, 'trail_rope');
  return { ...pet, inventory, lastInteractionAt: now,
    adventure: { ...pet.adventure, tripsStarted: pet.adventure.tripsStarted + 1, active: { id, region, actorId, actorName: actorName.slice(0, 32), startedAt: now, rulesVersion: 4, revision: 0, choices: [], bag: Object.fromEntries(entries), loot: {}, tool, neighborId, shopStock: createAdventureShopStock(), purchases: 0, transportedCount: 0, treasure: getAdventureTripTreasure(id) } },
    recentEvent: L('从溪谷入口出发，随时可以带着收获返回。', 'Setting out from the valley entrance. You can return with your discoveries at any time.') };
};

export const getAdventureChoiceReason = (pet: PetState, choice: AdventureChoice) => {
  const trip = pet.adventure.active;
  if (!trip || pet.isSleeping || pet.partnerSchedule.active) return L('当前无法继续探查。', 'Exploration cannot continue right now.');
  if (getAdventureBagCount(trip.loot)) return L('先收好、吃掉或放弃待拾取的物资。', 'Collect, eat or leave the supplies on the ground first.');
  if (choice.item && (trip.bag[choice.item] ?? 0) < 1) return L('行囊中缺少所需物资。', 'The required supply is missing from your travel bag.');
  if (choice.tool && !trip.tool) return L('本趟未携带探路绳。', 'You did not pack a trail rope.');
  if (pet.energy < choice.energy || pet.hunger < choice.hunger) return L('体力或饱食度不足，可使用补给或安全返回。', 'Not enough hunger or energy. Use supplies or return safely.');
  return '';
};

export const advanceAdventure = (pet: PetState, tripId: string, expectedStep: number, choiceId: string, now = Date.now()): PetState => {
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.choices.length !== expectedStep) return pet;
  const choice = getAdventureSteps(trip.rulesVersion)[expectedStep]?.choices.find(value => value.id === choiceId);
  if (!choice) return pet;
  const reason = getAdventureChoiceReason(pet, choice);
  if (reason) return fail(pet, reason);
  let bag = choice.item ? removeInventoryItem(trip.bag, choice.item) : trip.bag;
  let loot: Inventory = {};
  const complete = expectedStep + 1 === adventureStepCount;
  const found = choiceId === 'bank' ? { id: 'apple', amount: 2 } : choiceId === 'slope' ? { id: 'orange', amount: 1 } : choiceId === 'overlook' && trip.rulesVersion >= 3 ? { id: trip.rulesVersion >= 4 ? trip.treasure ?? getAdventureTripTreasure(trip.id) : 'coin_hoard', amount: 1 } : undefined;
  if (found) {
    if (getAdventureBagCount(bag) + found.amount <= adventureBagCapacity) bag = addInventoryItem(bag, found.id, found.amount);
    else loot = { [found.id]: found.amount };
  }
  return { ...pet, hunger: clampPetStat(pet, pet.hunger - choice.hunger), energy: clampPetEnergy(pet, pet.energy - choice.energy), lastInteractionAt: now,
    adventure: { ...pet.adventure, active: { ...trip, revision: trip.revision + 1, choices: [...trip.choices, choiceId], bag, loot, ...(complete ? { completedDay: getEffectiveDailyDateKey(pet, now) } : {}) } },
    recentEvent: L(`${choice.label}：饱食度 −${choice.hunger}，体力 −${choice.energy}。`, `${choice.label}: hunger −${choice.hunger}, energy −${choice.energy}.`) };
};

const validQuantity = (quantity: number) => Number.isInteger(quantity) && quantity > 0 && quantity <= adventureBagCapacity;
export const redeemAdventureTreasure = (pet: PetState, tripId: string, revision: number, quantity = 1, source: 'bag' | 'loot' = 'bag', itemId: ItemId = 'coin_hoard'): PetState => {
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !isAdventureTreasure(itemId) || !validQuantity(quantity) || (trip[source][itemId] ?? 0) < quantity) return pet;
  const coins = quantity * getAdventureTreasureValue(itemId);
  const name = getInventoryItem(itemId)!.name;
  return recordEarnedCoins({ ...pet, coins: clampCoins(pet.coins + coins), adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, [source]: removeInventoryItem(trip[source], itemId, quantity) } }, recentEvent: L(`${name}已兑换为 ${coins} 金币。`, `Exchanged ${name} for ${coins} coins.`) }, coins);
};
export const useAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1, source: 'bag' | 'loot' = 'bag'): PetState => {
  const trip = pet.adventure.active;
  const item = getInventoryItem(itemId);
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(quantity) || !item || itemId === 'berry_bait' || !isAdventureSupply(itemId) || (trip[source][itemId] ?? 0) < quantity || (itemId === 'golden_apple' && quantity !== 1)) return pet;
  const effect = getItemStatEffect(pet, item);
  const recovery = { hunger: clampPetStat(pet, pet.hunger + (effect.hunger ?? 0) * quantity), energy: clampPetEnergy(pet, pet.energy + (effect.energy ?? 0) * quantity),
    mood: clampPetStat(pet, pet.mood + (effect.mood ?? 0) * quantity), health: clampPetHealth(pet, pet.health + (effect.health ?? 0) * quantity), cleanliness: clampPetStat(pet, pet.cleanliness + (effect.cleanliness ?? 0) * quantity) };
  if (!Object.entries(recovery).some(([key, value]) => value > pet[key as keyof typeof recovery])) return fail(pet, L('当前不需要这份恢复补给。', 'You do not need this recovery supply right now.'));
  let next: PetState = { ...pet, ...recovery, adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, [source]: removeInventoryItem(trip[source], itemId, quantity) } },
    recentEvent: L(`使用了${item.name} ×${quantity}。`, `Used ${item.name} ×${quantity}.`) };
  for (let i = 0; i < quantity; i++) next = incrementAchievementItemUse(next, itemId);
  return next;
};

export const pickupAdventureLoot = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity: number): PetState => {
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(quantity) || (trip.loot[itemId] ?? 0) < quantity || getAdventureBagCount(trip.bag) + quantity > adventureBagCapacity) return pet;
  return { ...pet, adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), loot: removeInventoryItem(trip.loot, itemId, quantity) } }, recentEvent: L('发现的物资已收进行囊。', 'Your finds are now in the travel bag.') };
};

export const discardAdventureItem = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity: number, source: 'bag' | 'loot' | 'tool' = 'bag'): PetState => {
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(quantity)) return pet;
  if (source === 'tool' ? itemId !== 'trail_rope' || quantity !== 1 || !trip.tool : (trip[source][itemId] ?? 0) < quantity) return pet;
  return { ...pet, adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, ...(source === 'tool' ? { tool: false } : { [source]: removeInventoryItem(trip[source], itemId, quantity) }) } }, recentEvent: L('已放弃所选物资。', 'The selected supplies have been left behind.') };
};

export const canUseAdventureService = (pet: PetState) => Boolean(pet.adventure.active?.neighborId && pet.adventure.active.choices.length === 4 && !getAdventureBagCount(pet.adventure.active.loot));
export const getAdventureServiceQuote = (pet: PetState, itemId: ItemId, quantity: number, service: 'buy' | 'transport') => {
  const trip = pet.adventure.active;
  const remaining = service === 'buy' ? trip?.rulesVersion === 1 && trip.purchases > 0 ? 0 : trip?.shopStock[itemId] ?? 0 : Math.max(0, (trip?.rulesVersion === 1 ? 1 : adventureTransportLimit) - (trip?.transportedCount ?? 0));
  const unitPrice = service === 'buy' ? getAdventureShopPrice(itemId, trip?.rulesVersion) : adventureTransportCost;
  const total = unitPrice * quantity;
  const limit = Math.max(0, Math.min(remaining, adventureBagCapacity - getAdventureBagCount(trip?.bag ?? {}), service === 'buy' ? getAdventureItemPurchaseCapacity(pet, itemId) : pet.inventory[itemId] ?? 0, Math.floor((service === 'buy' ? pet.coins : pet.hearts) / (unitPrice || 1))));
  const canTrade = canUseAdventureService(pet) && isAdventureSupply(itemId) && unitPrice > 0 && validQuantity(quantity) && quantity <= limit;
  return { remaining, limit, unitPrice, total, canTrade };
};
export const buyAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1): PetState => {
  const trip = pet.adventure.active;
  const quote = getAdventureServiceQuote(pet, itemId, quantity, 'buy');
  if (!trip || trip.id !== tripId || trip.revision !== revision || !quote.canTrade) return pet;
  return { ...pet, coins: clampCoins(pet.coins - quote.total), adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), shopStock: removeInventoryItem(trip.shopStock, itemId, quantity), purchases: trip.purchases + 1 } }, recentEvent: L('购买的补给已放进行囊。', 'Purchased supplies are now in your travel bag.') };
};
export const transportAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1): PetState => {
  const trip = pet.adventure.active;
  const quote = getAdventureServiceQuote(pet, itemId, quantity, 'transport');
  if (!trip || trip.id !== tripId || trip.revision !== revision || !quote.canTrade) return pet;
  return { ...pet, hearts: pet.hearts - quote.total, inventory: removeInventoryItem(pet.inventory, itemId, quantity),
    adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), transportedCount: trip.transportedCount + quantity } }, recentEvent: L('伙伴从仓库送来了物资，已放进行囊。', 'Your neighbor delivered the supplies to your travel bag.') };
};

export const getAdventureRewardPreview = (pet: PetState) => {
  const trip = pet.adventure.active;
  const steps = trip?.choices.length ?? 0;
  const complete = steps === adventureStepCount;
  const first = complete && !(pet.adventure.completed.valley ?? 0);
  const legacy = trip?.rulesVersion === 1;
  if (trip && trip.rulesVersion >= 3) return { steps, complete, first, hearts: complete ? Math.round(22 * getPetStatScale(pet)) : 0, coins: 0 };
  return { steps, complete, first, hearts: Math.round((steps + (complete ? 6 : 0) + (first ? 10 : 0)) * getPetStatScale(pet)),
    coins: steps * (legacy ? 4 : 20) + (complete ? legacy ? 24 : 180 : 0) + (first ? legacy ? 30 : 60 : 0) + (trip?.choices.includes('slope') ? legacy ? 8 : 30 : 0) };
};

export const returnFromAdventure = (pet: PetState, tripId: string, now = Date.now()): PetState => {
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || pet.adventure.pending) return pet;
  if (getAdventureBagCount(trip.loot)) return fail(pet, L('先处理待拾取物资，再安全返回。', 'Collect, eat or leave the pending finds before returning.'));
  const reward = getAdventureRewardPreview(pet);
  const items = { ...trip.bag };
  if (trip.tool) items.trail_rope = (items.trail_rope ?? 0) + 1;
  const pending: AdventureResult = { ...reward, id: trip.id, region: trip.region, actorId: trip.actorId, actorName: trip.actorName, endedAt: now, items, rewardsClaimed: false,
    ...(reward.complete ? { completedDay: trip.completedDay ?? getDailyResetDateKey(now) } : {}) };
  return { ...pet, adventure: { ...pet.adventure, active: undefined, pending },
    recentEvent: L('已经安全返回前哨基地，收好这一趟的行囊吧。', 'Back at the outpost safely. Collect your travel bag and rewards.') };
};

export const claimAdventureResult = (pet: PetState, resultId: string): PetState => {
  const result = pet.adventure.pending;
  if (!result || result.id !== resultId) return pet;
  let next = pet;
  const remaining: Inventory = {};
  let inventory = pet.inventory;
  for (const [id, amount] of Object.entries(result.items)) {
    const delivered = Math.min(amount, Math.max(0, inventoryItemLimit - (inventory[id] ?? 0)));
    if (delivered) inventory = addInventoryItem(inventory, id, delivered);
    if (delivered < amount) remaining[id] = amount - delivered;
  }
  let hearts = result.hearts;
  if (!result.rewardsClaimed) {
    const gain = applyHeartGain(pet, result.hearts);
    hearts = gain.amount;
    next = recordEarnedHearts(recordEarnedCoins({ ...pet, hearts: gain.hearts, boostCards: gain.boostCards, coins: clampCoins(pet.coins + result.coins) }, result.coins), gain.amount);
  }
  const receipt = { ...result, hearts, rewardsClaimed: true };
  const pending = Object.keys(remaining).length ? { ...receipt, items: remaining } : undefined;
  const discoveries = [...new Set([...pet.adventure.discoveries, ...Array.from({ length: result.steps }, (_, i) => `${result.region}:${i}`)])];
  const previousDay = getAdventureLastCompletedDay(pet.adventure, result.region);
  const completedDay = result.completedDay ?? getDailyResetDateKey(result.endedAt);
  return { ...next, inventory, adventure: { ...pet.adventure, pending, discoveries,
    lastCompletedDay: !result.rewardsClaimed && result.complete ? { ...pet.adventure.lastCompletedDay, [result.region]: completedDay > previousDay ? completedDay : previousDay } : pet.adventure.lastCompletedDay,
    completed: !result.rewardsClaimed && result.complete ? { ...pet.adventure.completed, [result.region]: (pet.adventure.completed[result.region] ?? 0) + 1 } : pet.adventure.completed,
    journal: result.rewardsClaimed ? pet.adventure.journal : [receipt, ...pet.adventure.journal].slice(0, 8) },
    recentEvent: pending ? L('奖励已结算，仓库装不下的物资仍在大厅等你领取。', 'Rewards settled. Supplies that do not fit remain at the hall for collection.')
      : L('收好行囊，旅行手账也添上了新的记录。', 'Everything is collected, and your travel journal has a new entry.') };
};
