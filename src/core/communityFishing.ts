import { fish, isWaterOpen, waters, waterIds } from './communityData';
import { recordCommunityCatch } from './communityCommissions';
import type { FishingCatch, FishingReceipt, WaterId } from './communityTypes';
import { getToolUsesLeft, spendToolUse } from './toolDurability';
import { toolDefinitions, type DurableToolId } from './fieldEquipmentData';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { getPetStatCap, updatePetSatiety } from './petStats';
import type { Inventory, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getFishingLevelEffects } from './communityUpgradeData';
import { getDecorationEffects } from './decorationEffects';
import { fishingIntervalMs, getFishingClicks, isGoldCrownFish, sampleFishingCatch } from './fishingRules';
import { eatReturningRations, rationReturnLines } from './expeditionRationReturn';
import { quoteFishingRations } from './fishingRations';
import type { RationSelection } from './explorationRations';
import { advancePet } from './petLifecycle';

type Bait = 'fishing_bait' | 'river_bait';
const withFishing = (pet: PetState, changes: Partial<PetState['community']['fishing']>): PetState => ({ ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, ...changes } } });
export const isIdleFishing = (pet: PetState) => pet.community.fishing.active?.mode === 'idle';
export const getFishingWaitMs = (pet: PetState, useFloat = false) => Math.round((getFishingLevelEffects(pet.community.upgrades.fishing_hut).waitSeconds - (useFloat ? 2 : 0)) * 1000 * (1 - getDecorationEffects(pet).pearl_lamp / 100));

const preparationReason = (pet: PetState, water: WaterId, bait: Bait) => {
  if (pet.timePause) return '时间已冻结';
  if (pet.community.fishing.pending) return '先收好上一趟鱼获';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '伙伴正在休息或忙碌';
  if (!waterIds.includes(water) || !isWaterOpen(pet, water)) return '先开放这片水域';
  if (!['fishing_bait', 'river_bait'].includes(bait) || bait === 'river_bait' && !pet.community.facilities.upstream.built) return '先修好上游步道，再使用溪流鱼饵';
  return '';
};
export const getManualFishingReason = (pet: PetState, water: WaterId, bait: Bait, strong: boolean, gear: { float?: boolean; net?: boolean } = {}) => {
  const reason = preparationReason(pet, water, bait);
  if (reason) return reason;
  const effects = getFishingLevelEffects(pet.community.upgrades.fishing_hut);
  if (!(pet.inventory[bait] ?? 0)) return '鱼饵不足，去商店补充';
  if (!(pet.inventory[strong ? 'reinforced_rod' : 'fishing_rod'] ?? 0)) return '所选钓竿不足，去商店补充';
  if (gear.float && !(pet.inventory.fishing_float ?? 0) || gear.net && !(pet.inventory.landing_net ?? 0)) return '所选附件不足，请调整钓具';
  if (pet.energy < effects.energy || pet.hunger < effects.hunger) return '需要体力 ' + effects.energy + '、饱食 ' + effects.hunger;
  return '';
};

export const recordFishingCatch = (pet: PetState, caught: { fish: keyof typeof fish; size: number }, now: number): { pet: PetState; caught: FishingCatch } => {
  const entry = pet.community.fishing.journal[caught.fish], crown = isGoldCrownFish(caught.fish, caught.size);
  const result = { ...caught, newRecord: caught.size > (entry?.largest ?? 0), newCrown: crown && !entry?.goldCrown };
  const next = withFishing(pet, { journal: { ...pet.community.fishing.journal, [caught.fish]: {
    count: (entry?.count ?? 0) + 1, firstAt: entry?.firstAt ?? now, largest: Math.max(caught.size, entry?.largest ?? 0), goldCrown: Boolean(entry?.goldCrown || crown),
  } } });
  return { pet: recordCommunityCatch(next, fish[caught.fish].water, fish[caught.fish].rare, now), caught: result };
};

export const startCommunityFishing = (pet: PetState, water: WaterId, bait: Bait, strongRod: boolean, now = Date.now(), gear: { float?: boolean; net?: boolean } = {}): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt || pet.community.fishing.active || pet.community.fishing.pending) return pet;
  const reason = getManualFishingReason(pet, water, bait, strongRod, gear);
  if (reason) return { ...pet, recentEvent: reason };
  const hutLevel = pet.community.upgrades.fishing_hut, effects = getFishingLevelEffects(hutLevel);
  const equipment: DurableToolId[] = [strongRod ? 'reinforced_rod' : 'fishing_rod', ...(gear.float ? ['fishing_float' as const] : []), ...(gear.net ? ['landing_net' as const] : [])];
  for (const id of equipment) pet = spendToolUse(pet, id)!.pet;
  const cast = pet.community.fishing.casts + 1, caught = sampleFishingCatch(pet.createdAt, cast, water, bait), waitMs = getFishingWaitMs(pet, gear.float);
  return updatePetSatiety({ ...withFishing(pet, { casts: cast, active: {
    mode: 'manual', id: 'fish:' + pet.createdAt + ':' + cast, water, ...caught, phase: 'waiting', biteAt: now + waitMs,
    lastActionAt: now, clicks: 0, requiredClicks: getFishingClicks(strongRod, gear.net), revision: 0, strongRod, landingNet: gear.net === true, hutLevel,
  } }), hunger: pet.hunger - effects.hunger, energy: pet.energy - effects.energy, inventory: removeInventoryItem(pet.inventory, bait), lastInteractionAt: now,
    recentEvent: '抛出鱼竿，静候鱼儿上钩。鱼饵与所选钓具耐久各消耗 1 次。' });
};

export const actCommunityFishing = (pet: PetState, id: string, revision: number, action: 'hook' | 'reel' | 'slack', now = Date.now()): PetState => {
  const session = pet.community.fishing.active;
  if (pet.timePause || !Number.isFinite(now) || !session || session.mode !== 'manual' || session.id !== id || session.revision !== revision || now < session.biteAt || now < session.lastActionAt || now < pet.lastUpdatedAt || action === 'slack') return pet;
  // A legacy hook command is the first reel, never a separate QTE step.
  if (action !== 'reel' && action !== 'hook' || action === 'hook' && session.phase !== 'waiting') return pet;
  const clicks = session.clicks + 1;
  if (clicks < session.requiredClicks) return { ...withFishing(pet, { active: { ...session, phase: 'reeling', clicks, revision: revision + 1, lastActionAt: now } }), lastInteractionAt: now };
  const result = recordFishingCatch(pet, session, now);
  return { ...withFishing(result.pet, { active: undefined, pending: { id, mode: 'manual', water: session.water, at: now, reason: 'complete', items: { [session.fish]: 1 }, catches: [result.caught] } }), lastInteractionAt: now,
    recentEvent: '钓到了' + fish[session.fish].name + '，' + session.size + ' 厘米！' + (result.caught.newCrown ? '获得金冠！' : result.caught.newRecord ? '刷新长度纪录！' : '') };
};

export const quoteIdleFishing = (pet: PetState, water: WaterId, bait: Bait, strongRod: boolean, hours: number, rations?: RationSelection) => {
  const food = quoteFishingRations(pet, hours, rations), plannedCasts = [2, 4, 8].includes(hours) ? hours * 4 : 0;
  const rod = strongRod ? 'reinforced_rod' : 'fishing_rod';
  const uses = getToolUsesLeft(pet, rod) + Math.max(0, (pet.inventory[rod] ?? 0) - 1) * toolDefinitions[rod].uses;
  const reason = preparationReason(pet, water, bait) || food.reason
    || (pet.health < getPetStatCap(pet) * .4 ? '健康需达到上限的 40%，请先护理' : '')
    || ((pet.inventory[bait] ?? 0) < plannedCasts ? '全程需要鱼饵 ' + plannedCasts + ' 份' : '')
    || (uses < plannedCasts ? '全程需要钓竿耐久 ' + plannedCasts + ' 次，含备用竿现有 ' + uses + ' 次' : '');
  return { food, plannedCasts, uses, reason };
};
export const startIdleFishing = (pet: PetState, water: WaterId, bait: Bait, strongRod: boolean, hours: number, actorId: string, actorName: string, rations?: RationSelection, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt) return pet;
  pet = advancePet(pet, now);
  const q = quoteIdleFishing(pet, water, bait, strongRod, hours, rations);
  if (q.reason) return { ...pet, recentEvent: q.reason };
  let inventory = removeInventoryItem(pet.inventory, bait, q.plannedCasts);
  for (const [id, n] of Object.entries(q.food.used)) inventory = removeInventoryItem(inventory, id, n);
  const nextId = pet.community.fishing.nextIdleId;
  return { ...withFishing(pet, { nextIdleId: nextId + 1, active: {
    mode: 'idle', id: 'idle-fish:' + pet.createdAt + ':' + nextId, revision: 0, water, bait, strongRod, actorId, actorName,
    hutLevel: pet.community.upgrades.fishing_hut, startedAt: now, endsAt: now + hours * 3600000, settledCasts: 0,
    plannedCasts: q.plannedCasts, reservedBait: q.plannedCasts, catches: [], rationPlan: { food: q.food.food, purchased: q.food.purchased, coins: q.food.coins },
  } }), inventory, coins: pet.coins - q.food.coins, lastInteractionAt: now, recentEvent: actorName + '带着食物去了' + waters[water].name + '，每 15 分钟收获一条鱼。' };
};

const finishIdleFishing = (pet: PetState, reason: FishingReceipt['reason'], now: number): PetState => {
  const session = pet.community.fishing.active;
  if (!session || session.mode !== 'idle' || pet.community.fishing.pending) return pet;
  const returning = reason === 'complete' ? undefined : eatReturningRations(pet, session, now);
  const items: Inventory = {};
  for (const caught of session.catches) items[caught.fish] = (items[caught.fish] ?? 0) + 1;
  if (session.reservedBait) items[session.bait] = session.reservedBait;
  return { ...withFishing(returning?.pet ?? pet, { active: undefined, pending: {
    id: session.id, mode: 'idle', water: session.water, at: now, reason, catches: session.catches, items,
    ...(returning ? { rationReturn: returning.summary } : {}),
  } }), lastEnergyRecoveryAt: now, recentEvent: (reason === 'health' ? '健康不足，伙伴已安全回到小屋。' : '钓鱼结束，收好今天的鱼获吧。') + (returning ? rationReturnLines(returning.summary).join('') : '') };
};

// Called at lifecycle boundaries: online ticks and long offline gaps settle the same casts.
export const advanceCommunityFishing = (pet: PetState, now: number): PetState => {
  if (pet.timePause || !Number.isFinite(now)) return pet;
  let session = pet.community.fishing.active;
  if (!session || session.mode !== 'idle') return pet;
  const unhealthy = pet.health < getPetStatCap(pet) * .2;
  const until = Math.min(session.endsAt, now - (unhealthy ? 1 : 0));
  const done = Math.max(session.settledCasts, Math.min(session.plannedCasts, Math.floor((until - session.startedAt) / fishingIntervalMs)));
  while (session.settledCasts < done) {
    const rod = session.strongRod ? 'reinforced_rod' : 'fishing_rod';
    const tool = session.reservedBait > 0 ? spendToolUse(pet, rod) : undefined;
    if (!tool) return finishIdleFishing(pet, 'supplies', session.startedAt + (session.settledCasts + 1) * fishingIntervalMs);
    pet = tool.pet;
    const at = session.startedAt + (session.settledCasts + 1) * fishingIntervalMs, cast = pet.community.fishing.casts + 1;
    const result = recordFishingCatch(pet, sampleFishingCatch(pet.createdAt, cast, session.water, session.bait), at);
    session = { ...session, settledCasts: session.settledCasts + 1, reservedBait: session.reservedBait - 1, revision: session.revision + 1, catches: [...session.catches, result.caught] };
    pet = withFishing(result.pet, { casts: cast, active: session });
  }
  if (unhealthy) return finishIdleFishing(pet, 'health', now);
  if (now >= session.endsAt) return finishIdleFishing(pet, 'complete', session.endsAt);
  return pet;
};

export const cancelCommunityFishing = (pet: PetState, id: string, now = Date.now()): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt || pet.community.fishing.active?.id !== id) return pet;
  if (pet.community.fishing.active.mode === 'idle') {
    pet = advancePet(pet, now);
    return pet.community.fishing.active?.id === id ? finishIdleFishing(pet, 'return', now) : pet;
  }
  return { ...withFishing(pet, { active: undefined }), recentEvent: '收起鱼竿。已用鱼饵和耐久不返还。' };
};
export const claimCommunityFish = (pet: PetState, id: string): PetState => {
  const pending = pet.community.fishing.pending;
  if (pet.timePause || !pending || pending.id !== id || !canSpendCompanionTime(pet)) return pet;
  let inventory = pet.inventory;
  const remaining: Inventory = {};
  for (const [item, count] of Object.entries(pending.items)) {
    const amount = Math.min(count, Math.max(0, inventoryItemLimit - (inventory[item] ?? 0)));
    if (amount) inventory = addInventoryItem(inventory, item, amount);
    if (amount < count) remaining[item] = count - amount;
  }
  const rest = Object.keys(remaining).length ? { ...pending, items: remaining } : undefined;
  return { ...withFishing(pet, { pending: rest }), inventory, recentEvent: rest ? '仓库装不下的鱼获与鱼饵仍在收获篮，腾出空间后继续领取。' : '鱼获已收好，图鉴和金冠永久保留。' };
};

export const buildWaterBoardwalk = (pet: PetState, water: 'forest_pool' | 'coast_pier'): PetState => {
  if (water !== 'forest_pool' && water !== 'coast_pier') return pet;
  const access = pet.community.waterAccess[water], cost = waters[water];
  if (pet.timePause || !canSpendCompanionTime(pet) || !pet.community.facilities.fishing_hut.built || !pet.community.expedition.regions[cost.region].surveyed || !access.found || access.built || pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone) return pet;
  return { ...pet, coins: pet.coins - cost.coins, inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', cost.wood), 'community_stone', cost.stone),
    community: { ...pet.community, waterAccess: { ...pet.community.waterAccess, [water]: { found: true, built: true } } }, recentEvent: cost.name + '栈道修好了！以后在钓鱼小屋直接选择水域即可垂钓。' };
};
