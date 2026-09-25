import { applyHeartGain, incrementAchievementItemUse, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { adventureBusyMessage, getAdventureShopPrice, getAdventureStepCount, adventureTransportCost, adventureTransportLimit, createAdventureShopStock, getAdventureSteps, type AdventureChoice } from './adventureData';
import { getAdventureTreasureValue, getAdventureTripTreasure, isAdventureTreasure } from './adventureItems';
import { getAdventureBagCount, getAdventureItemPurchaseCapacity, getAdventureLastCompletedDay, isAdventureEntranceCompleteForDay, isAdventureMapUnlocked, isAdventureSupply } from './adventureState';
import type { AdventureDestinationId } from './adventureTypes';
import type { CommunityRoute } from './communityTypes';
import { discoverCommunityFinds } from './community';
import { facilityIds } from './communityData';
import { openTutorialGarden } from './communityUpgradeData';
import type { FacilityId } from './communityTypes';
import { adventureHealthRules, enforceAdventureHealth, finishAdventure, needsAdventureHealthReturn } from './adventureReturn';
export { getAdventureRewardPreview } from './adventureReturn';
import { applyItemHungerEffect, getItemStatEffect, getItemUsePlan, overfedMessage } from './itemEffects';
import { clampPetHunger, updatePetSatiety } from './petStats';
import { addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { activityText as L } from './kitchenRecipes';
import { clampCoins, clampPetEnergy, clampPetHealth, clampPetStat, getPetStatRatio } from './petStats';
import type { Inventory, ItemId, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';
import { getEffectiveDailyDateKey } from './gameClock';
import { getDailyResetDateKey } from './dailyReset';
import { completeValleyQuest, getValleyQuestReason, isValleyQuest, valleyQuests, valleyQuestIds } from './valleyQuests';
import { spendToolUse } from './toolDurability';
import { advanceExplorationBudget, getExplorationBudget, spendExplorationHarvest, settleExplorationLoot } from './explorationBudget';
import { getDecorationEffects } from './decorationEffects';
import { getExplorationBagCapacity } from './explorationBackpack';
import { createExplorationCheckState, type ExplorationCheckAction } from './explorationChecks';
import { applyExplorationCheck, previewExplorationAction } from './explorationCheckActions';
import { advancePet } from './petLifecycle';
import { isLandmarkId, landmarkId, legacyPurposeLandmark, parseLandmarkId, getLandmarkReason, expeditionRegionForMap } from './landmarkProgress';
import { getLandmarkSteps } from './landmarkData';
import { advanceLandmarkAdventure, landmarkCheckAction } from './landmarkAdventure';
import { regionalTreasureIds } from './regionalTreasures';
import { getAdventureStageChoices } from './adventureGathering';

const fail = (pet: PetState, message: string): PetState => ({ ...pet, recentEvent: message });
export const getAdventureStartReason = (pet: PetState, region?: AdventureDestinationId, now = Date.now(), purpose?: CommunityRoute) => {
  if (region && region !== 'tutorial') purpose = purpose ? legacyPurposeLandmark(purpose) : landmarkId(region, 'entrance');
  if (pet.timePause) return '时间已冻结，恢复时间后再出发。';
  if (pet.community.expedition.pending) return '先收好上一次远行的物资与工具。';
  if (pet.community.expedition.active) return '先完成或结束当前远征，行囊还留在基地。';
  if (pet.adventure.active) return adventureBusyMessage();
  if (pet.adventure.pending) return L('先收好上次行程的物资。', 'Collect the supplies from your last trip first.');
  if (pet.community.fishing.active) return '先收起鱼竿，再出发探索。';
  if (isLandmarkId(purpose)) { const location = parseLandmarkId(purpose); if (location.region !== region) return '目的地与地标不一致，请重新选择。'; const reason = getLandmarkReason(pet.adventure, location.region, location.node); if (reason) return reason; }
  if (isValleyQuest(purpose)) { const reason = getValleyQuestReason(pet.adventure, purpose); if (reason) return reason; }
  if (purpose === 'irrigation' || purpose && facilityIds.includes(purpose as FacilityId)) return '设施建设资格由溪谷故事开放，请选择对应剧情。';
  if (!region) return L('请先选择本次探查的目的地。', 'Choose a destination for this trip first.');
  if (region !== 'tutorial' && !isAdventureMapUnlocked(pet.adventure)) return L('先完成四节点「踩点探索」，解锁大地图。', 'Complete the four-stop tutorial to unlock the world map first.');
  if (!purpose && isAdventureEntranceCompleteForDay(pet.adventure, region, getEffectiveDailyDateKey(pet, now))) return region === 'tutorial'
    ? L('踩点探索已完成，可以在大地图选择新目的地。', 'The tutorial is complete. Choose your next destination on the world map.')
    : L('今日溪谷入口已完成，次日凌晨 5 点后可再次探查。', 'Today’s valley scouting is complete. Return after 5 a.m. tomorrow.');
  if (pet.isSleeping) return L('先叫醒伙伴，再一起出发。', 'Wake your companion before setting out.');
  if (pet.partnerSchedule.active) return L('等伙伴结束社区工作再出发。', 'Wait until community work ends.');
  if (pet.miniGames.active && !pet.miniGames.active.paused) return L('先暂停小游戏再出发。', 'Pause your game before setting out.');
  if (getPetStatRatio(pet, 'health') < adventureHealthRules.departure) return '健康不足，请先护理再出发。';
  const firstChoices = getAdventureSteps(isLandmarkId(purpose) ? 10 : region === 'valley' ? 9 : 8, region, purpose)[0].choices;
  const first = firstChoices.find(c => c.check?.mode === 'safe') ?? firstChoices[0];
  const energy = first.check ? previewExplorationAction(pet, { id: 'departure', bag: {}, tool: false }, { ...first, research: undefined, title: first.label, check: first.check }, '0').energy[1] : first.energy;
  return pet.energy < energy || pet.hunger < first.hunger
    ? L(`出发至少需要 ${first.hunger} 饱食度、${energy} 体力，请先补充状态。`, `Restore at least ${first.hunger} hunger and ${energy} energy before setting out.`) : '';
};

export const claimAdventureStarter = (pet: PetState): PetState => {
  if (pet.adventure.starterClaimed && pet.adventure.starterMealsClaimed) return pet;
  const items: Inventory = { ...(!pet.adventure.starterClaimed ? { trail_mix: 2, berry_bait: 1 } : {}), ...(!pet.adventure.starterMealsClaimed ? { dish_carrot_rice: 4 } : {}) };
  if (Object.entries(items).some(([id, amount]) => getAdventureItemPurchaseCapacity(pet, id) < amount || (pet.inventory[id] ?? 0) + amount > inventoryItemLimit)) return fail(pet, L('先为入门补给腾出仓库空间。', 'Make room in your inventory for the starter supplies.'));
  return { ...pet, inventory: Object.entries(items).reduce((stock, [id, amount]) => addInventoryItem(stock, id, amount), pet.inventory),
    adventure: { ...pet.adventure, starterClaimed: true, starterMealsClaimed: true }, recentEvent: L('入门补给已放入仓库，包含四份胡萝卜蛋饭。整理行囊后就可以出发。', 'Starter supplies, including four carrot egg rice dishes, are in your inventory. Pack your bag to set out.') };
};

export const startAdventure = (pet: PetState, region: AdventureDestinationId | undefined, actorId: string, actorName: string, bag: Inventory, _legacyTool: boolean, now = Date.now(), purpose?: CommunityRoute, target?: string, neighborIds: readonly string[] = []): PetState => {
  if (region && region !== 'tutorial') purpose = purpose ? legacyPurposeLandmark(purpose) : landmarkId(region, 'entrance');
  if (purpose && !isLandmarkId(purpose)) return pet;
  const reason = getAdventureStartReason(pet, region, now, purpose);
  if (reason) return fail(pet, reason);
  if (!region || !actorId || actorId.length > 128) return pet;
  const entries = Object.entries(bag).filter(([, amount]) => amount !== 0);
  if (entries.some(([id, amount]) => !isAdventureSupply(id) || !Number.isInteger(amount) || amount < 1 || (pet.inventory[id] ?? 0) < amount)
    || getAdventureBagCount(Object.fromEntries(entries)) > getExplorationBagCapacity(pet)) return fail(pet, L('行囊或仓库物资已变化，请重新整理。', 'Your supplies have changed. Check your travel bag again.'));
  pet = advanceExplorationBudget(pet, now);
  const id = `scout:${pet.createdAt}:${pet.adventure.tripsStarted + 1}:${now}`;
  const neighbors = [...new Set(neighborIds)].filter(value => value !== actorId && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(value)).sort();
  const roll = hashString(id);
  // The first valley completion teaches the service; tutorial trips have no shop.
  const neighborId = neighbors.length > 0 && region === 'valley' && (!(pet.adventure.completed.valley ?? 0) || roll % 3 !== 0) ? neighbors[roll % neighbors.length] : undefined;
  const inventory = entries.reduce((stock, [item, amount]) => removeInventoryItem(stock, item, amount), pet.inventory);
  const tool = false; // New trips use warehouse tools; true is reserved for legacy packed ropes.
  return { ...pet, inventory, lastInteractionAt: now,
    adventure: { ...pet.adventure, tripsStarted: pet.adventure.tripsStarted + 1, active: { id, region, purpose, rewardsVersion: 1, gatherBonus: getDecorationEffects(pet).emerald_pendant, actorId, actorName: actorName.slice(0, 32), startedAt: now, rulesVersion: isLandmarkId(purpose) ? 10 : 8, ...(isLandmarkId(purpose) ? { checkState: createExplorationCheckState(id), ...(target ? { target } : {}), nodeId: parseLandmarkId(purpose).node, stageIds: [], firstCompletion: false } : {}), energySpent: 0, healthLost: 0, paidActions: 0, rested: false, revision: 0, choices: [], bag: Object.fromEntries(entries), loot: {}, tool, neighborId, shopStock: neighborId ? createAdventureShopStock() : {}, purchases: 0, transportedCount: 0 } },
    recentEvent: region === 'tutorial' ? '从前哨门口开始 4 阶段新手踩点。' : '已开始手动地标探索。每次选择都会保存，途中可以补给或安全返程。' };
};

export const getAdventureCheckAction = (pet: PetState, choice: AdventureChoice, now = pet.lastUpdatedAt): ExplorationCheckAction => pet.adventure.active?.rulesVersion === 10 ? landmarkCheckAction(pet, choice, now) : ({
  ...choice, research: undefined, title: choice.label, check: choice.check!,
  finds: choice.harvest && (getExplorationBudget(pet, now)?.available ?? 0) < choice.harvest ? {} : choice.finds,
});
export const getAdventureChoicePreview = (pet: PetState, choice: AdventureChoice, now = pet.lastUpdatedAt) => {
  const trip = pet.adventure.active;
  if (!trip || trip.rulesVersion < 9 || !choice.check) return undefined;
  const modern = isLandmarkId(trip.purpose) ? parseLandmarkId(trip.purpose) : undefined;
  const preview = previewExplorationAction(pet, trip, getAdventureCheckAction(pet, choice, now), modern ? getLandmarkSteps(trip.purpose as import('./landmarkProgress').LandmarkId)[trip.choices.length]?.id ?? 'complete' : String(trip.choices.length), modern ? expeditionRegionForMap[modern.region] : 'valley');
  return { ...preview, reason: getAdventureChoicePrerequisiteReason(pet, choice, now) || preview.reason };
};
const getAdventureChoicePrerequisiteReason = (pet: PetState, choice: AdventureChoice, now = pet.lastUpdatedAt) => {
  if (needsAdventureHealthReturn(pet)) return '健康已低于撤退线，正在安全返程。';
  const trip = pet.adventure.active;
  if ((trip?.rulesVersion ?? 0) < 9 && choice.minMoodRatio && getPetStatRatio(pet, 'mood') < choice.minMoodRatio) return '心情不足 30%，可以选择普通路线或使用心情用品。';
  if (!trip || pet.isSleeping || pet.partnerSchedule.active) return L('当前无法继续探查。', 'Exploration cannot continue right now.');
  if (getAdventureBagCount(trip.loot)) return L('先收好、吃掉或放弃待拾取的物资。', 'Collect, eat or leave the supplies on the ground first.');
  if (choice.item && (trip.bag[choice.item] ?? 0) < 1) return L('行囊中缺少所需物资。', 'The required supply is missing from your travel bag.');
  if (choice.tool && !trip.tool && !(pet.inventory.trail_rope ?? 0)) return '仓库中需要探路绳。';
  if (trip.rulesVersion === 10 && choice.harvest && (getExplorationBudget(pet, now)?.available ?? 0) < choice.harvest) return '采集机会不足，可以离开采集点继续前进。';
  return '';
};
export const getAdventureChoiceReason = (pet: PetState, choice: AdventureChoice, now = pet.lastUpdatedAt) => {
  const prerequisite = getAdventureChoicePrerequisiteReason(pet, choice, now);
  if (prerequisite) return prerequisite;
  const preview = getAdventureChoicePreview(pet, choice, now);
  if (preview) return preview.reason;
  if (pet.energy < choice.energy || pet.hunger < choice.hunger) return L('体力或饱食度不足，可使用补给或安全返回。', 'Not enough hunger or energy. Use supplies or return safely.');
  return '';
};

export const advanceAdventure = (pet: PetState, tripId: string, expectedStep: number, choiceId: string, now = Date.now(), expectedRevision?: number): PetState => {
  if (pet.timePause) return pet;
  if (pet.adventure.active?.id !== tripId || pet.adventure.active.choices.length !== expectedStep) return pet;
  if (expectedRevision !== undefined && pet.adventure.active.revision !== expectedRevision) return pet;
  pet = (pet.adventure.active?.rulesVersion ?? 0) >= 9 ? advancePet(pet, now) : enforceAdventureHealth(pet, now);
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.choices.length !== expectedStep) return pet;
  const choices = getAdventureSteps(trip.rulesVersion, trip.region, trip.purpose, pet.community.expedition.regions.valley.base, trip.bag)[expectedStep]?.choices ?? [];
  const command = getAdventureStageChoices(pet, choices).find(value => value.id === choiceId);
  const choice = choices.find(value => value.id === (command?.sourceChoiceId ?? choiceId));
  if (!choice) return pet;
  const reason = getAdventureChoiceReason(pet, choice, now);
  if (reason) return fail(pet, reason);
  if (trip.rulesVersion === 10) return enforceAdventureHealth(advanceLandmarkAdventure(pet, trip, choice, expectedStep, now), now);
  const checked = trip.rulesVersion >= 9 && choice.check ? applyExplorationCheck(pet, trip, getAdventureCheckAction(pet, choice, now), String(expectedStep)) : undefined;
  if (trip.rulesVersion >= 9 && !checked) return pet;
  const ropeUse = !checked && choice.tool ? spendToolUse(pet, 'trail_rope', trip.tool) : undefined;
  if (choice.tool && !checked && !ropeUse) return pet;
  pet = checked?.pet ?? ropeUse?.pet ?? pet;
  let bag = choice.item ? removeInventoryItem(trip.bag, choice.item) : trip.bag;
  if (checked && choice.mealItem) bag = removeInventoryItem(bag, choice.mealItem);
  const loot: Inventory = {};
  const complete = expectedStep + 1 === getAdventureStepCount(trip.region, trip.purpose);
  const quest = isValleyQuest(trip.purpose) ? trip.purpose : undefined;
  const discovery = quest ? quest === 'valley_crossing' && complete ? discoverCommunityFinds(pet, now, 'commission') : { pet, items: {} }
    : trip.rulesVersion >= 5 && trip.region === 'valley' && (trip.purpose ? complete : expectedStep === 3) ? discoverCommunityFinds(pet, now, trip.purpose) : { pet, items: {} };
  pet = discovery.pet;
  if (quest && complete) {
    for (const [id, amount] of Object.entries(valleyQuests[quest].items)) discovery.items[id] = (discovery.items[id] ?? 0) + amount;
    pet = completeValleyQuest(pet, quest);
  }
  const modern = trip.rulesVersion >= 7 && trip.region === 'valley' && !trip.purpose;
  const finds: Inventory = {};
  if (modern) {
    pet = advanceExplorationBudget(pet, now);
    const usedBefore = pet.community.expedition.loop?.used ?? 0;
    if (checked) {
      if (choice.harvest && (getExplorationBudget(pet, now)?.available ?? 0) >= choice.harvest) pet = spendExplorationHarvest(pet, choice.harvest, now);
      Object.assign(finds, checked.result.finds);
    } else if ([1, 3].includes(expectedStep) && (getExplorationBudget(pet, now)?.available ?? 0) > 0) {
      pet = spendExplorationHarvest(pet, 1, now);
      Object.assign(finds, expectedStep === 3 ? { bamboo_shoot: 5 } : choiceId === 'bank' ? { valley_mushroom: 3 } : { community_wood: 4, community_stone: 3 });
    }
    if (trip.rewardsVersion === 1) {
      const successful = !checked || ['steady', 'success', 'excellent'].includes(checked.result.outcome);
      const extra = settleExplorationLoot(pet, (pet.community.expedition.loop?.used ?? 0) - usedBefore, 'manual', 'valley', now, successful ? finds : {}, trip.gatherBonus ?? 0);
      pet = extra.pet;
      for (const [item, amount] of Object.entries(extra.finds)) finds[item] = (finds[item] ?? 0) + amount;
    }
    const state = pet.community.expedition;
    if (complete && state.loop && !state.loop.firstTreasure) {
      finds.coin_hoard = (finds.coin_hoard ?? 0) + 1;
      pet = { ...pet, community: { ...pet.community, expedition: { ...state, loop: { ...state.loop, firstTreasure: true } } } };
    }
  }
  const found: Inventory = { ...discovery.items, ...(modern ? finds : trip.purpose ? {} : trip.region === 'tutorial' ? complete ? { map_handbook: 1, coin_hoard: 1 } : {}
    : choiceId === 'bank' ? { apple: 2 } : choiceId === 'slope' ? { orange: 1 } : choiceId === 'overlook' && trip.rulesVersion >= 3 ? { [trip.rulesVersion >= 4 ? trip.treasure ?? getAdventureTripTreasure(trip.id) : 'coin_hoard']: 1 } : {}) };
  if (modern) {
    const collection = { ...pet.community.expedition.collection };
    for (const item of ['coin_hoard', 'valley_amber', 'ancient_gold_bar', ...regionalTreasureIds] as const) if (found[item]) collection[item] = (collection[item] ?? 0) + found[item];
    pet = { ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, collection } } };
  }
  for (const [id, amount] of Object.entries(found)) {
    if (getAdventureBagCount(bag) + amount <= getExplorationBagCapacity(pet)) bag = addInventoryItem(bag, id, amount);
    else loot[id] = amount;
  }
  return enforceAdventureHealth(updatePetSatiety({ ...pet, ...(checked ? {} : { hunger: clampPetHunger(pet, pet.hunger - choice.hunger), energy: clampPetEnergy(pet, pet.energy - choice.energy), health: clampPetHealth(pet, pet.health + (choice.health ?? 0)), mood: clampPetStat(pet, pet.mood + (choice.mood ?? 0)) }), lastInteractionAt: now,
    adventure: { ...pet.adventure, active: { ...trip, energySpent: Math.max(0, (trip.energySpent ?? 0) + (checked?.energySpent ?? choice.energy)), healthLost: Math.max(0, (trip.healthLost ?? 0) + (checked?.healthLost ?? -Math.min(0, choice.health ?? 0))), paidActions: (trip.paidActions ?? 0) + Number(choice.hunger > 0 || choice.energy > 0), tool: trip.tool && !ropeUse?.broken && !(checked?.toolBroken && choice.check?.tool === 'trail_rope'), revision: trip.revision + 1, choices: [...trip.choices, choiceId], bag, loot, ...(checked ? { checkState: { ...checked.state, last: { ...checked.result, finds: found } } } : {}), ...(complete ? { completedDay: getEffectiveDailyDateKey(pet, now) } : {}) } },
    recentEvent: checked?.pet.recentEvent ?? L(`${choice.label}：饱食度 −${choice.hunger}，体力 −${choice.energy}。`, `${choice.label}: hunger −${choice.hunger}, energy −${choice.energy}.`) + (ropeUse ? ` 探路绳耐久 −1${ropeUse.broken ? '，已用尽，返程不再归还' : ''}。` : '') }), now);
};

const validQuantity = (pet: PetState, quantity: number) => Number.isInteger(quantity) && quantity > 0 && quantity <= getExplorationBagCapacity(pet);
export const redeemAdventureTreasure = (pet: PetState, tripId: string, revision: number, quantity = 1, source: 'bag' | 'loot' = 'bag', itemId: ItemId = 'coin_hoard'): PetState => {
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !isAdventureTreasure(itemId) || !validQuantity(pet, quantity) || (trip[source][itemId] ?? 0) < quantity) return pet;
  const coins = quantity * getAdventureTreasureValue(itemId);
  if (clampCoins(pet.coins + coins) !== pet.coins + coins) return fail(pet, '金币已满，战利品继续保留。');
  const name = getInventoryItem(itemId)!.name;
  return recordEarnedCoins({ ...pet, coins: clampCoins(pet.coins + coins), adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, [source]: removeInventoryItem(trip[source], itemId, quantity) } }, recentEvent: L(`${name}已兑换为 ${coins} 金币。`, `Exchanged ${name} for ${coins} coins.`) }, coins);
};
export const useAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1, source: 'bag' | 'loot' = 'bag'): PetState => {
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  const item = getInventoryItem(itemId);
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(pet, quantity) || !item || itemId === 'berry_bait' || !isAdventureSupply(itemId) || (itemId === 'golden_apple' && quantity !== 1)) return pet;
  const plan = getItemUsePlan(pet, item, quantity);
  if (plan.blocked) return fail(pet, overfedMessage);
  quantity = plan.quantity;
  if ((trip[source][itemId] ?? 0) < quantity) return pet;
  const effect = getItemStatEffect(pet, item);
  const recovery = { hunger: applyItemHungerEffect(pet, item, (effect.hunger ?? 0) * quantity), energy: clampPetEnergy(pet, pet.energy + (effect.energy ?? 0) * quantity),
    mood: clampPetStat(pet, pet.mood + (effect.mood ?? 0) * quantity), health: clampPetHealth(pet, pet.health + (effect.health ?? 0) * quantity), cleanliness: clampPetStat(pet, pet.cleanliness + (effect.cleanliness ?? 0) * quantity) };
  if (!Object.entries(recovery).some(([key, value]) => value > pet[key as keyof typeof recovery])) return fail(pet, L('当前不需要这份恢复补给。', 'You do not need this recovery supply right now.'));
  let next: PetState = { ...pet, ...recovery, adventure: { ...pet.adventure, active: { ...trip, energySpent: Math.max(0, (trip.energySpent ?? 0) - Math.max(0, recovery.energy - pet.energy)), healthLost: Math.max(0, (trip.healthLost ?? 0) - Math.max(0, recovery.health - pet.health)), revision: revision + 1, [source]: removeInventoryItem(trip[source], itemId, quantity) } },
    recentEvent: L(`使用了${item.name} ×${quantity}。`, `Used ${item.name} ×${quantity}.`) + (quantity < plan.requestedQuantity ? ' 已吃饱，其余未消耗。' : '') };
  for (let i = 0; i < quantity; i++) next = incrementAchievementItemUse(next, itemId);
  return updatePetSatiety(next);
};

export const pickupAdventureLoot = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity: number): PetState => {
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(pet, quantity) || (trip.loot[itemId] ?? 0) < quantity || getAdventureBagCount(trip.bag) + quantity > getExplorationBagCapacity(pet)) return pet;
  return { ...pet, adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), loot: removeInventoryItem(trip.loot, itemId, quantity) } }, recentEvent: L('发现的物资已收进行囊。', 'Your finds are now in the travel bag.') };
};

export const discardAdventureItem = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity: number, source: 'bag' | 'loot' | 'tool' = 'bag'): PetState => {
  if (pet.timePause) return pet;
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || trip.revision !== revision || !validQuantity(pet, quantity)) return pet;
  if (source === 'tool' ? itemId !== 'trail_rope' || quantity !== 1 || !trip.tool : (trip[source][itemId] ?? 0) < quantity) return pet;
  const toolWear = { ...pet.community.toolWear };
  if (source === 'tool') delete toolWear.trail_rope;
  return { ...pet, community: { ...pet.community, toolWear }, adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, ...(source === 'tool' ? { tool: false } : { [source]: removeInventoryItem(trip[source], itemId, quantity) }) } }, recentEvent: L('已放弃所选物资。', 'The selected supplies have been left behind.') };
};

export const canUseAdventureService = (pet: PetState) => Boolean(!needsAdventureHealthReturn(pet) && pet.adventure.active?.region === 'valley' && pet.adventure.active.neighborId && (pet.adventure.active.rulesVersion === 10 ? pet.adventure.active.stageIds?.some(id => id.endsWith(':obstacle')) && !pet.adventure.active.stageIds?.some(id => id.endsWith(':finish')) : pet.adventure.active.choices.length === 4) && !getAdventureBagCount(pet.adventure.active.loot));
export const getAdventureServiceQuote = (pet: PetState, itemId: ItemId, quantity: number, service: 'buy' | 'transport') => {
  const trip = pet.adventure.active;
  const remaining = service === 'buy' ? trip?.rulesVersion === 1 && trip.purchases > 0 ? 0 : trip?.shopStock[itemId] ?? 0 : Math.max(0, (trip?.rulesVersion === 1 ? 1 : adventureTransportLimit) - (trip?.transportedCount ?? 0));
  const unitPrice = service === 'buy' ? getAdventureShopPrice(itemId, trip?.rulesVersion) : adventureTransportCost;
  const total = unitPrice * quantity;
  const limit = Math.max(0, Math.min(remaining, getExplorationBagCapacity(pet) - getAdventureBagCount(trip?.bag ?? {}), service === 'buy' ? getAdventureItemPurchaseCapacity(pet, itemId) : pet.inventory[itemId] ?? 0, Math.floor((service === 'buy' ? pet.coins : pet.hearts) / (unitPrice || 1))));
  const canTrade = canUseAdventureService(pet) && isAdventureSupply(itemId) && unitPrice > 0 && validQuantity(pet, quantity) && quantity <= limit;
  return { remaining, limit, unitPrice, total, canTrade };
};
export const buyAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1): PetState => {
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  const quote = getAdventureServiceQuote(pet, itemId, quantity, 'buy');
  if (!trip || trip.id !== tripId || trip.revision !== revision || !quote.canTrade) return pet;
  return { ...pet, coins: clampCoins(pet.coins - quote.total), adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), shopStock: removeInventoryItem(trip.shopStock, itemId, quantity), purchases: trip.purchases + 1 } }, recentEvent: L('购买的补给已放进行囊。', 'Purchased supplies are now in your travel bag.') };
};
export const transportAdventureSupply = (pet: PetState, tripId: string, revision: number, itemId: ItemId, quantity = 1): PetState => {
  pet = enforceAdventureHealth(pet);
  const trip = pet.adventure.active;
  const quote = getAdventureServiceQuote(pet, itemId, quantity, 'transport');
  if (!trip || trip.id !== tripId || trip.revision !== revision || !quote.canTrade) return pet;
  return { ...pet, hearts: pet.hearts - quote.total, inventory: removeInventoryItem(pet.inventory, itemId, quantity),
    adventure: { ...pet.adventure, active: { ...trip, revision: revision + 1, bag: addInventoryItem(trip.bag, itemId, quantity), transportedCount: trip.transportedCount + quantity } }, recentEvent: L('伙伴从仓库送来了物资，已放进行囊。', 'Your neighbor delivered the supplies to your travel bag.') };
};

export const returnFromAdventure = (pet: PetState, tripId: string, now = Date.now()): PetState => {
  pet = enforceAdventureHealth(pet, now);
  const trip = pet.adventure.active;
  if (!trip || trip.id !== tripId || pet.adventure.pending) return pet;
  if (getAdventureBagCount(trip.loot)) return fail(pet, L('先处理待拾取物资，再安全返回。', 'Collect, eat or leave the pending finds before returning.'));
  return finishAdventure(pet, now);
};

export const claimAdventureResult = (pet: PetState, resultId: string): PetState => {
  const result = pet.adventure.pending;
  if (!result || result.id !== resultId || result.salvage) return pet;
  let next = pet;
  const remaining: Inventory = {};
  let inventory = pet.inventory;
  for (const [id, amount] of Object.entries(result.items)) {
    const delivered = Math.min(amount, Math.max(0, inventoryItemLimit - (inventory[id] ?? 0)));
    if (delivered) inventory = addInventoryItem(inventory, id, delivered);
    if (delivered < amount) remaining[id] = amount - delivered;
  }
  const owed = result.rewardsClaimed ? result.coinsRemaining ?? 0 : result.coins;
  const paid = clampCoins(pet.coins + owed) - pet.coins, coinsRemaining = owed - paid;
  next = recordEarnedCoins({ ...pet, coins: pet.coins + paid }, paid);
  let hearts = result.hearts;
  if (!result.rewardsClaimed) {
    const gain = applyHeartGain(next, result.hearts);
    hearts = gain.amount;
    next = recordEarnedHearts({ ...next, hearts: gain.hearts, boostCards: gain.boostCards }, gain.amount);
  }
  const receipt = { ...result, hearts, rewardsClaimed: true };
  const pending = Object.keys(remaining).length || coinsRemaining ? { ...receipt, items: remaining, coinsRemaining } : undefined;
  const discoveries = [...new Set([...pet.adventure.discoveries, ...(result.purpose ? [] : Array.from({ length: result.steps }, (_, i) => `${result.region}:${i}`))])];
  const previousDay = getAdventureLastCompletedDay(pet.adventure, result.region);
  const completedDay = result.completedDay ?? getDailyResetDateKey(result.endedAt);
  const entranceResult = !result.purpose || isLandmarkId(result.purpose) && parseLandmarkId(result.purpose).node === 'entrance';
  const adventure = { ...pet.adventure, pending, discoveries,
    landmarks: result.region === 'valley' && entranceResult && result.complete && !pet.adventure.landmarks.includes(landmarkId('valley', 'entrance')) ? [...pet.adventure.landmarks, landmarkId('valley', 'entrance')] : pet.adventure.landmarks,
    lastCompletedDay: entranceResult && !result.rewardsClaimed && result.complete ? { ...pet.adventure.lastCompletedDay, [result.region]: completedDay > previousDay ? completedDay : previousDay } : pet.adventure.lastCompletedDay,
    completed: entranceResult && !result.rewardsClaimed && result.complete ? { ...pet.adventure.completed, [result.region]: (pet.adventure.completed[result.region] ?? 0) + 1 } : pet.adventure.completed,
    journal: result.rewardsClaimed ? pet.adventure.journal : [receipt, ...pet.adventure.journal].slice(0, 8) };
  return { ...next, inventory, adventure, community: openTutorialGarden(next.community, adventure),
    recentEvent: pending ? L('奖励已结算，仓库装不下的物资仍在大厅等你领取。', 'Rewards settled. Supplies that do not fit remain at the hall for collection.')
      : result.region === 'tutorial' && result.complete ? '踩点探索完成！大地图已解锁，第 1 块菜地免费开放，体力上限永久 +4。'
        : L('收好行囊，旅行手账也添上了新的记录。', 'Everything is collected, and your travel journal has a new entry.') };
};
