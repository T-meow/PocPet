import { applyHeartGain, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { clampCoins, getPetStatCap } from './petStats';
import { inventoryItemLimit } from './saveMetadata';
import { expeditionBagCount, getRegionUnlocked, regionIds, regions } from './expeditionData';
import { finishExpedition, withExpedition } from './expeditionReturn';
import type { ExpeditionTrip, RegionId } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';
import { advanceExplorationBudget, getExplorationBudget, spendExplorationHarvest } from './explorationBudget';
import { valleyGatherTargets, type ValleyGatherTarget } from './valleyExplorationData';
import { getExplorationBagCapacity } from './explorationBackpack';
import { explorationTravel } from './explorationTravelData';
import { lockRationPlan, quoteExpeditionRations, type RationSelection } from './explorationRations';
import { getRegionUnlockReason, mapRegionForExpedition } from './landmarkProgress';

const fail = (pet: PetState, recentEvent: string): PetState => ({ ...pet, recentEvent });
export const getExpeditionHarvestLeft = (pet: PetState, _id: RegionId, now = Date.now()) => getExplorationBudget(pet, now)?.available ?? 0;
export const getExpeditionStartReason = (pet: PetState, route: RegionId[], mode: 'idle' = 'idle', parts = 2, now = Date.now(), rations?: RationSelection): string => {
  if (pet.timePause) return '时间已冻结，恢复时间后再出发。';
  const state = pet.community.expedition;
  if (mode !== 'idle' || route.length !== 1 || !regionIds.includes(route[0])) return '请选择一个地区安排挂机探索。';
  if (state.active || pet.adventure.active) return '先完成或结束当前探索。';
  if (state.pending || pet.adventure.pending) return '先收好上一次旅途物资。';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '伙伴正在休息或忙碌，空闲后再启程。';
  const region = route[0], progress = state.regions[region];
  if (!getRegionUnlocked(pet, region)) return getRegionUnlockReason(pet.adventure, mapRegionForExpedition[region]);
  if (!progress.surveyed || !progress.base) return '完成当地全部 8 个地标，并建好休息基地后开放挂机。';
  if (![2, 4, 8].includes(parts)) return '挂机可选择 2、4、8 小时。';
  if (pet.health < getPetStatCap(pet) * .4) return '健康不足，请先护理再出发。';
  if (getExpeditionHarvestLeft(pet, region, now) < parts) return '需要采集机会 ' + parts + ' 次；每 3 小时恢复 1 次，最多积存 24 次。';
  const quote = quoteExpeditionRations(pet, region, parts, rations), profile = explorationTravel[region];
  if (quote.reason) return quote.reason;
  return pet.energy < profile.idleEnergy * parts / 2 || pet.hunger < profile.idleHunger * parts / 2 ? '行路需饱食 ' + profile.idleHunger * parts / 2 + '、体力 ' + profile.idleEnergy * parts / 2 + '，请先补充。' : '';
};
export const startExpedition = (pet: PetState, route: RegionId[], bag: Inventory, tool: boolean, actorId: string, actorName: string, mode: 'idle' = 'idle', parts = 2, now = Date.now(), options: { target?: ValleyGatherTarget; rations?: RationSelection } = {}): PetState => {
  pet = advanceExplorationBudget(advancePet(pet, now), now);
  const reason = getExpeditionStartReason(pet, route, mode, parts, now, options.rations);
  if (reason) return fail(pet, reason);
  if (tool || expeditionBagCount(bag) || !actorId || actorId.length > 128) return pet;
  const target = options.target ?? 'valley_mushroom';
  if (!valleyGatherTargets.includes(target) || target === 'aquamarine') return pet;
  const state = pet.community.expedition, startedAt = Math.max(now, pet.lastUpdatedAt);
  const quote = quoteExpeditionRations(pet, route[0], parts, options.rations);
  let inventory = { ...pet.inventory };
  for (const [id, quantity] of Object.entries(quote.used)) inventory = removeInventoryItem(inventory, id, quantity);
  const trip: ExpeditionTrip = { rulesVersion: 5, id: 'expedition:' + state.nextId, revision: 0, mode: 'idle', actorId, actorName: actorName.slice(0, 32),
    route: [...route], leg: 0, step: 0, bag: {}, ground: {}, tool: false, rested: [], paused: false,
    target, rewardsVersion: 1, energySpent: 0, healthLost: 0, paidActions: 0, reservedHarvests: parts,
    rationPlan: lockRationPlan(quote, parts, pet.createdAt + ':' + state.nextId + ':' + startedAt),
    startedAt, endsAt: startedAt + parts * 3600000, settledParts: 0, parts, coins: 0, hearts: 0, journal: ['和' + actorName + '前往' + regions[route[0]].name + '挂机探索。'] };
  pet = spendExplorationHarvest(pet, parts, now, true);
  return { ...withExpedition(pet, { nextId: state.nextId + 1, active: trip }), inventory, coins: pet.coins - quote.coins, lastInteractionAt: now,
    recentEvent: '全程料理与采集机会已备好。每小时采集，每两小时判定当地珍宝；该地区连续未获得时，第 10 次判定保底。' };
};
export const getBaseUpgrade = (level: number, region: RegionId = 'valley') => level === 0
  ? { coins: 120, wood: 3, stone: 2, name: '修好休息基地', benefit: '开放本地区 2／4／8 小时挂机探索' }
  : { coins: 180, wood: 2, stone: 3, name: '修通往返步道', benefit: region === 'valley' ? '完善基地；累计采集 80 次并制作溪光水景后，提高每日探索酬谢' : '安全通路基础体力消耗降低 20%' };
export const upgradeExpeditionBase = (pet: PetState, region: RegionId, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause || !regionIds.includes(region)) return pet;
  pet = advancePet(pet, now);
  const state = pet.community.expedition, progress = state.regions[region];
  if (progress.base !== expectedLevel || progress.base >= 2 || !progress.surveyed || !canSpendCompanionTime(pet)) return pet;
  const quote = getBaseUpgrade(progress.base, region);
  if (pet.coins < quote.coins || (pet.inventory.community_wood ?? 0) < quote.wood || (pet.inventory.community_stone ?? 0) < quote.stone) return fail(pet, '建材或金币不足，探索成果会永久保留。');
  return { ...withExpedition(pet, { regions: { ...state.regions, [region]: { ...progress, base: progress.base + 1 } } }), coins: pet.coins - quote.coins,
    inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', quote.wood), 'community_stone', quote.stone), recentEvent: regions[region].base + '：' + quote.benefit + '。' };
};
export const returnExpedition = (pet: PetState, id: string, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  return pet.community.expedition.active?.id === id ? finishExpedition(pet, 'return', now) : pet;
};
export const selectExpeditionReturn = (pet: PetState, id: string, selection: Inventory): PetState => {
  const pending = pet.community.expedition.pending;
  if (pet.timePause || !pending || pending.id !== id || pending.selected || expeditionBagCount(selection) > getExplorationBagCapacity(pet)
    || Object.entries(selection).some(([item, count]) => !Number.isInteger(count) || count <= 0 || count > (pending.items[item] ?? 0) + (pending.overflow[item] ?? 0))) return pet;
  return withExpedition(pet, { pending: { ...pending, items: { ...selection }, overflow: {}, selected: true } });
};
export const claimExpedition = (pet: PetState, id: string): PetState => {
  const pending = pet.community.expedition.pending;
  if (pet.timePause || !pending || pending.id !== id || !pending.selected) return pet;
  const items = { ...pending.items };
  let tool = pending.tool;
  let inventory = pet.inventory;
  const remaining: Inventory = {};
  for (const [item, count] of Object.entries(items)) {
    const take = Math.min(count, Math.max(0, inventoryItemLimit - (inventory[item] ?? 0)));
    if (take) inventory = addInventoryItem(inventory, item, take);
    if (take < count) remaining[item] = count - take;
  }
  // The equipped rope has its own slot, including while a full warehouse delays its return.
  if (tool && (inventory.trail_rope ?? 0) < inventoryItemLimit) {
    inventory = addInventoryItem(inventory, 'trail_rope', 1);
    tool = false;
  }
  const gain = applyHeartGain(pet, pending.hearts), total = pending.coins + (pending.refundCoins ?? 0), paid = clampCoins(pet.coins + total) - pet.coins;
  const earned = Math.min(paid, pending.coins), refundPaid = paid - earned;
  const coins = pending.coins - earned, refundCoins = (pending.refundCoins ?? 0) - refundPaid;
  const keep = tool || Object.keys(remaining).length > 0 || coins > 0 || refundCoins > 0;
  return recordEarnedHearts(recordEarnedCoins({ ...withExpedition(pet, {
    pending: keep ? { ...pending, items: remaining, tool, coins, hearts: 0, refundCoins } : undefined,
    ...(keep ? {} : { lastReceipt: { id: pending.id, reason: pending.reason, at: pending.at, route: pending.route, journal: pending.journal,
      ...(pending.rationReturn ? { rationReturn: pending.rationReturn } : {}), ...(pending.lastCheck ? { lastCheck: pending.lastCheck } : {}), ...(pending.treasureFinds ? { treasureFinds: pending.treasureFinds } : {}), ...(pending.treasureChance !== undefined ? { treasureChance: pending.treasureChance } : {}) } }),
  }), inventory, coins: pet.coins + paid, hearts: gain.hearts, boostCards: gain.boostCards,
    recentEvent: keep ? '能放入的物资与酬谢已领取，剩余内容继续保留。' : '旅途物资与酬谢已全部入库。' }, earned), gain.amount);
};
