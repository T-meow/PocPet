import { fish, fishIds, isWaterOpen, waters, waterIds } from './communityData';
import { recordCommunityCatch } from './communityCommissions';
import type { WaterId } from './communityTypes';
import { spendToolUse } from './toolDurability';
import type { DurableToolId } from './fieldEquipmentData';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';
import { getFishingLevelEffects } from './communityUpgradeData';

export const advanceCommunityFishing = (pet: PetState, now: number): PetState => {
  if (pet.timePause) return pet;
  const active = pet.community.fishing.active;
  if (!active || now < active.expiresAt && !pet.isSleeping && !pet.adventure.active && !isExpeditionAway(pet) && !pet.partnerSchedule.active && (!pet.miniGames.active || pet.miniGames.active.paused)) return pet;
  return { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '这一竿已经收起，鱼饵与所用钓具耐久不返还。离线或离开操作不会自动钓到鱼。' };
};
export const startCommunityFishing = (pet: PetState, water: WaterId, bait: 'fishing_bait' | 'river_bait', strongRod: boolean, now = Date.now(), gear: { float?: boolean; net?: boolean } = {}): PetState => {
  if (pet.timePause || !Number.isFinite(now) || now < pet.lastUpdatedAt) return pet;
  pet = advanceCommunityFishing(pet, now);
  const c = pet.community, fishing = c.fishing, hutLevel = c.upgrades.fishing_hut, effects = getFishingLevelEffects(hutLevel);
  if (!canSpendCompanionTime(pet) || fishing.active || fishing.pending || !waterIds.includes(water) || !isWaterOpen(pet, water)) return pet;
  if ((bait !== 'fishing_bait' && bait !== 'river_bait') || bait === 'river_bait' && !c.facilities.upstream.built || (pet.inventory[bait] ?? 0) < 1 || (pet.inventory[strongRod ? 'reinforced_rod' : 'fishing_rod'] ?? 0) < 1 || pet.energy < effects.energy || pet.hunger < effects.hunger) return { ...pet, recentEvent: `抛竿需要钓竿、鱼饵 ×1、饱食 ${effects.hunger}、体力 ${effects.energy}。` };
  const equipment: DurableToolId[] = [strongRod ? 'reinforced_rod' : 'fishing_rod', ...(gear.float ? ['fishing_float' as const] : []), ...(gear.net ? ['landing_net' as const] : [])];
  if (equipment.some(id => !(pet.inventory[id] ?? 0))) return { ...pet, recentEvent: '所选钓具不足，请重新选择。鱼饵与耐久均未消耗。' };
  for (const id of equipment) pet = spendToolUse(pet, id)!.pet;
  const cast = fishing.casts + 1, roll = hashString(`fishing:${pet.createdAt}:${cast}:${water}:${bait}`), pool = fishIds.filter(id => fish[id].water === water);
  // Every third cast with plain bait guarantees the area's recipe fish.
  const weight = (id: typeof pool[number]) => fish[id].weight * (bait === 'river_bait' && ['rare', 'epic', 'legendary'].includes(fish[id].rarity) ? 2.5 : 1);
  let point = (roll >>> 0) / 0x100000000 * pool.reduce((sum, id) => sum + weight(id), 0);
  const sampled = pool.find(id => (point -= weight(id)) < 0) ?? pool[pool.length - 1];
  const id = bait === 'fishing_bait' && cast % 3 === 1 ? pool[0] : sampled;
  const biteAt = now + 8000, windowSeconds = effects.windowSeconds + (gear.float ? 10 : 0);
  return updatePetSatiety({ ...pet, hunger: pet.hunger - effects.hunger, energy: pet.energy - effects.energy, lastInteractionAt: now, inventory: removeInventoryItem(pet.inventory, bait), community: { ...pet.community, fishing: { ...fishing, casts: cast,
    active: { id: `fish:${pet.createdAt}:${cast}`, water, fish: id, size: fish[id].length + roll % 15, phase: 'waiting', biteAt, expiresAt: biteAt + windowSeconds * 1000, lastActionAt: now, tension: 20, progress: 0, revision: 0, strongRod, landingNet: gear.net === true, hutLevel } } }, recentEvent: `鱼饵与所选钓具耐久各消耗 1 次。约 8 秒后留意浮漂，咬钩后 ${windowSeconds} 秒内提竿；本竿按小屋 Lv.${hutLevel} 结算。` });
};
export const cancelCommunityFishing = (pet: PetState, id: string): PetState => pet.timePause || pet.community.fishing.active?.id !== id ? pet : { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '收起了这一竿，已用鱼饵和钓具耐久不返还；没有自动鱼获。' };
export const actCommunityFishing = (pet: PetState, id: string, revision: number, action: 'hook' | 'reel' | 'slack', now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advanceCommunityFishing(pet, now);
  const session = pet.community.fishing.active;
  if (!session || session.id !== id || session.revision !== revision || now - session.lastActionAt < 600) return pet;
  if (action === 'hook') {
    if (session.phase !== 'waiting' || now < session.biteAt) return pet;
    return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, phase: 'reeling', expiresAt: now + 60000, lastActionAt: now, revision: revision + 1 } } }, recentEvent: '咬钩了！收线推进距离，张力高时松线；张力到 100 会脱钩。' };
  }
  if (session.phase !== 'reeling' || action !== 'reel' && action !== 'slack') return pet;
  const effects = getFishingLevelEffects(session.hutLevel);
  const tension = Math.max(0, session.tension + (action === 'reel' ? session.strongRod ? effects.strongTension : effects.tension : -40));
  const progress = Math.max(0, session.progress + (action === 'reel' ? session.landingNet ? 36 : 28 : -5));
  if (tension >= 100) return { ...cancelCommunityFishing(pet, id), recentEvent: '鱼线绷得太紧，鱼儿脱钩了。下次在张力升高时松线。' };
  if (progress < 100) return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, tension, progress, revision: revision + 1, lastActionAt: now } } } };
  const entry = pet.community.fishing.journal[session.fish];
  const next = { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined,
    pending: { id, fish: session.fish, size: session.size }, journal: { ...pet.community.fishing.journal, [session.fish]: { count: (entry?.count ?? 0) + 1, firstAt: entry?.firstAt ?? now, largest: Math.max(session.size, entry?.largest ?? 0) } } } }, recentEvent: `钓到了${fish[session.fish].name}，${session.size} 厘米！先收好鱼获再抛下一竿。` };
  return recordCommunityCatch(next, session.water, fish[session.fish].rare, now);
};
export const claimCommunityFish = (pet: PetState, id: string): PetState => {
  if (pet.timePause) return pet;
  const pending = pet.community.fishing.pending;
  if (!pending || pending.id !== id || !canSpendCompanionTime(pet)) return pet;
  if ((pet.inventory[pending.fish] ?? 0) >= inventoryItemLimit) return { ...pet, recentEvent: '鱼获仓库已满，鱼会留在收获篮等你，图鉴已经记下。' };
  return { ...pet, inventory: addInventoryItem(pet.inventory, pending.fish, 1), community: { ...pet.community, fishing: { ...pet.community.fishing, pending: undefined } }, recentEvent: `收好了${fish[pending.fish].name}，图鉴永久保留，可到小摊查看回收和上架报价。` };
};
import { isExpeditionAway } from './expeditionData';

export const buildWaterBoardwalk = (pet: PetState, water: 'forest_pool' | 'coast_pier'): PetState => {
  if (water !== 'forest_pool' && water !== 'coast_pier') return pet;
  const access = pet.community.waterAccess[water], cost = waters[water];
  if (pet.timePause || !canSpendCompanionTime(pet) || !pet.community.facilities.fishing_hut.built || !pet.community.expedition.regions[cost.region].surveyed || !access.found || access.built || pet.coins < cost.coins || (pet.inventory.community_wood ?? 0) < cost.wood || (pet.inventory.community_stone ?? 0) < cost.stone) return pet;
  return { ...pet, coins: pet.coins - cost.coins, inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', cost.wood), 'community_stone', cost.stone),
    community: { ...pet.community, waterAccess: { ...pet.community.waterAccess, [water]: { found: true, built: true } } }, recentEvent: `${cost.name}栈道修好了！以后在钓鱼小屋直接选择水域即可垂钓。` };
};
