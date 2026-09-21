import { fish, isWaterOpen, waters, waterIds } from './communityData';
import { recordCommunityCatch } from './communityCommissions';
import type { WaterId } from './communityTypes';
import { spendToolUse } from './toolDurability';
import type { DurableToolId } from './fieldEquipmentData';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { getFishingLevelEffects } from './communityUpgradeData';
import { getDecorationEffects } from './decorationEffects';
import { getFishingClicks, isGoldCrownFish, sampleFishingCatch } from './fishingRules';
import { eatReturningRations } from './expeditionRationReturn';

export const getFishingWaitMs = (pet: PetState) => Math.round(getFishingLevelEffects(pet.community.upgrades.fishing_hut).waitSeconds * 1000 * (1 - getDecorationEffects(pet).pearl_lamp / 100));

export const advanceCommunityFishing = (pet: PetState, now: number): PetState => {
  if (pet.timePause) return pet;
  const active = pet.community.fishing.active;
  if (!active || active.mode === 'idle' || !pet.isSleeping && !pet.adventure.active && !isExpeditionAway(pet) && !pet.partnerSchedule.active && (!pet.miniGames.active || pet.miniGames.active.paused)) return pet;
  return { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '这一竿已经收起，鱼饵与所用钓具耐久不返还。离线或离开操作不会自动钓到鱼。' };
};
export const startCommunityFishing = (pet: PetState, water: WaterId, bait: 'fishing_bait' | 'river_bait', strongRod: boolean, now = Date.now(), gear: { float?: boolean; net?: boolean } = {}): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt) return pet;
  pet = advanceCommunityFishing(pet, now);
  const c = pet.community, fishing = c.fishing, hutLevel = c.upgrades.fishing_hut, effects = getFishingLevelEffects(hutLevel);
  if (!canSpendCompanionTime(pet) || fishing.active || fishing.pending || !waterIds.includes(water) || !isWaterOpen(pet, water)) return pet;
  if ((bait !== 'fishing_bait' && bait !== 'river_bait') || bait === 'river_bait' && !c.facilities.upstream.built || (pet.inventory[bait] ?? 0) < 1 || (pet.inventory[strongRod ? 'reinforced_rod' : 'fishing_rod'] ?? 0) < 1 || pet.energy < effects.energy || pet.hunger < effects.hunger) return { ...pet, recentEvent: `抛竿需要钓竿、鱼饵 ×1、饱食 ${effects.hunger}、体力 ${effects.energy}。` };
  const equipment: DurableToolId[] = [strongRod ? 'reinforced_rod' : 'fishing_rod', ...(gear.net ? ['landing_net' as const] : [])];
  if (equipment.some(id => !(pet.inventory[id] ?? 0))) return { ...pet, recentEvent: '所选钓具不足，请重新选择。鱼饵与耐久均未消耗。' };
  for (const id of equipment) pet = spendToolUse(pet, id)!.pet;
  const cast = fishing.casts + 1, caught = sampleFishingCatch(pet.createdAt, cast, water, bait);
  const waitMs = getFishingWaitMs(pet), biteAt = now + waitMs;
  return updatePetSatiety({ ...pet, hunger: pet.hunger - effects.hunger, energy: pet.energy - effects.energy, lastInteractionAt: now, inventory: removeInventoryItem(pet.inventory, bait), community: { ...pet.community, fishing: { ...fishing, casts: cast,
    active: { mode: 'manual', id: `fish:${pet.createdAt}:${cast}`, water, ...caught, phase: 'waiting', biteAt, lastActionAt: now, clicks: 0, requiredClicks: getFishingClicks(strongRod, gear.net), revision: 0, strongRod, landingNet: gear.net === true, hutLevel } } }, recentEvent: `鱼饵与所选钓具耐久各消耗 1 次。约 ${waitMs / 1000} 秒后可以提竿，随后点击收线。本竿按小屋 Lv.${hutLevel} 与当前装饰效果结算。` });
};
export const cancelCommunityFishing = (pet: PetState, id: string, now = Date.now()): PetState => {
  const session = pet.community.fishing.active;
  if (pet.timePause || !session || session.id !== id) return pet;
  if (session.mode === 'idle') {
    const returning = eatReturningRations(pet, session, now);
    const items = { [session.bait]: session.reservedBait };
    for (const caught of session.catches) items[caught.fish] = (items[caught.fish] ?? 0) + 1;
    return { ...returning.pet, community: { ...returning.pet.community, fishing: { ...pet.community.fishing, active: undefined, pending: { id, mode: 'idle', water: session.water, catches: session.catches, items, at: now, reason: 'return', rationReturn: returning.summary } } }, recentEvent: '收起鱼竿，已获得的鱼与剩余鱼饵保留在收获篮。' };
  }
  return { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '收起了这一竿，已用鱼饵和钓具耐久不返还；没有自动鱼获。' };
};
export const actCommunityFishing = (pet: PetState, id: string, revision: number, action: 'hook' | 'reel' | 'slack', now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advanceCommunityFishing(pet, now);
  const session = pet.community.fishing.active;
  if (!session || session.mode !== 'manual' || session.id !== id || session.revision !== revision || now - session.lastActionAt < 600) return pet;
  if (action === 'hook') {
    if (session.phase !== 'waiting' || now < session.biteAt) return pet;
    return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, phase: 'reeling', lastActionAt: now, revision: revision + 1 } } }, recentEvent: `咬钩了，点击收线 ${session.requiredClicks} 次即可收获。` };
  }
  if (session.phase !== 'reeling' || action !== 'reel') return pet;
  const clicks = session.clicks + 1;
  if (clicks < session.requiredClicks) return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, clicks, revision: revision + 1, lastActionAt: now } } } };
  const entry = pet.community.fishing.journal[session.fish];
  const crown = isGoldCrownFish(session.fish, session.size);
  const next: PetState = { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined,
    pending: { id, mode: 'manual', water: session.water, at: now, reason: 'complete', items: { [session.fish]: 1 }, catches: [{ fish: session.fish, size: session.size, newRecord: session.size > (entry?.largest ?? 0), newCrown: crown && !entry?.goldCrown }] }, journal: { ...pet.community.fishing.journal, [session.fish]: { count: (entry?.count ?? 0) + 1, firstAt: entry?.firstAt ?? now, largest: Math.max(session.size, entry?.largest ?? 0), goldCrown: Boolean(entry?.goldCrown || crown) } } } }, recentEvent: `钓到了${fish[session.fish].name}，${session.size} 厘米！先收好鱼获再抛下一竿。` };
  return recordCommunityCatch(next, session.water, fish[session.fish].rare, now);
};
export const claimCommunityFish = (pet: PetState, id: string): PetState => {
  if (pet.timePause) return pet;
  const pending = pet.community.fishing.pending;
  if (!pending || pending.id !== id || !canSpendCompanionTime(pet)) return pet;
  let inventory = pet.inventory;
  const remaining: typeof inventory = {};
  for (const [item, count] of Object.entries(pending.items)) {
    const amount = Math.min(count, Math.max(0, inventoryItemLimit - (inventory[item] ?? 0)));
    inventory = addInventoryItem(inventory, item, amount);
    if (amount < count) remaining[item] = count - amount;
  }
  const rest = Object.keys(remaining).length ? { ...pending, items: remaining } : undefined;
  return { ...pet, inventory, community: { ...pet.community, fishing: { ...pet.community.fishing, pending: rest } }, recentEvent: rest ? '仓库暂时装不下的鱼获仍在收获篮，腾出空间后可继续领取。' : '鱼获已收好，图鉴永久保留。' };
};
import { isExpeditionAway } from './expeditionData';

export const buildWaterBoardwalk = (pet: PetState, water: 'forest_pool' | 'coast_pier'): PetState => {
  if (water !== 'forest_pool' && water !== 'coast_pier') return pet;
  const access = pet.community.waterAccess[water], cost = waters[water];
  if (pet.timePause || !canSpendCompanionTime(pet) || !pet.community.facilities.fishing_hut.built || !pet.community.expedition.regions[cost.region].surveyed || !access.found || access.built || pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone) return pet;
  return { ...pet, coins: pet.coins - cost.coins, inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', cost.wood), 'community_stone', cost.stone),
    community: { ...pet.community, waterAccess: { ...pet.community.waterAccess, [water]: { found: true, built: true } } }, recentEvent: `${cost.name}栈道修好了！以后在钓鱼小屋直接选择水域即可垂钓。` };
};
