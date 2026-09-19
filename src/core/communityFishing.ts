import { fish, fishIds } from './communityData';
import { recordCommunityCatch } from './communityCommissions';
import type { WaterId } from './communityTypes';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';

export const advanceCommunityFishing = (pet: PetState, now: number): PetState => {
  const active = pet.community.fishing.active;
  if (!active || now < active.expiresAt && !pet.isSleeping && !pet.adventure.active && !isExpeditionAway(pet) && !pet.partnerSchedule.active && (!pet.miniGames.active || pet.miniGames.active.paused)) return pet;
  return { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '这一竿已经收起，鱼饵已消耗。离线或离开操作不会自动钓到鱼。' };
};
export const startCommunityFishing = (pet: PetState, water: WaterId, bait: 'fishing_bait' | 'river_bait', strongRod: boolean, now = Date.now()): PetState => {
  pet = advanceCommunityFishing(pet, now);
  const c = pet.community, fishing = c.fishing;
  if (!canSpendCompanionTime(pet) || fishing.active || fishing.pending || !c.facilities.fishing_hut.built || (water !== 'pond' && water !== 'upstream') || water === 'upstream' && !c.facilities.upstream.built) return pet;
  if ((bait !== 'fishing_bait' && bait !== 'river_bait') || bait === 'river_bait' && !c.facilities.upstream.built || (pet.inventory[bait] ?? 0) < 1 || (pet.inventory[strongRod ? 'reinforced_rod' : 'fishing_rod'] ?? 0) < 1 || pet.energy < 3 || pet.hunger < 2) return { ...pet, recentEvent: '抛竿需要钓竿、鱼饵 ×1、饱食 2、体力 3。' };
  const cast = fishing.casts + 1, roll = hashString(`fishing:${pet.createdAt}:${cast}:${water}:${bait}`), pool = fishIds.filter(id => fish[id].water === water);
  // Every third cast with plain bait guarantees the area's recipe fish.
  const id = pool[bait === 'fishing_bait' && cast % 3 === 1 ? 0 : roll % 100 < (bait === 'river_bait' ? 12 : 5) ? 2 : (roll % 2)];
  const biteAt = now + 8000;
  return updatePetSatiety({ ...pet, hunger: pet.hunger - 2, energy: pet.energy - 3, lastInteractionAt: now, inventory: removeInventoryItem(pet.inventory, bait), community: { ...c, fishing: { ...fishing, casts: cast,
    active: { id: `fish:${pet.createdAt}:${cast}`, water, fish: id, size: fish[id].length + roll % 15, phase: 'waiting', biteAt, expiresAt: biteAt + 20000, lastActionAt: now, tension: 20, progress: 0, revision: 0, strongRod } } }, recentEvent: '鱼饵轻轻落入水中。约 8 秒后留意浮漂，咬钩后 20 秒内提竿。' });
};
export const cancelCommunityFishing = (pet: PetState, id: string): PetState => pet.community.fishing.active?.id !== id ? pet : { ...pet, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined } }, recentEvent: '收起了这一竿，已用鱼饵不返还；没有自动鱼获。' };
export const actCommunityFishing = (pet: PetState, id: string, revision: number, action: 'hook' | 'reel' | 'slack', now = Date.now()): PetState => {
  pet = advanceCommunityFishing(pet, now);
  const session = pet.community.fishing.active;
  if (!session || session.id !== id || session.revision !== revision || now - session.lastActionAt < 600) return pet;
  if (action === 'hook') {
    if (session.phase !== 'waiting' || now < session.biteAt) return pet;
    return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, phase: 'reeling', expiresAt: now + 60000, lastActionAt: now, revision: revision + 1 } } }, recentEvent: '咬钩了！收线推进距离，张力高时松线；张力到 100 会脱钩。' };
  }
  if (session.phase !== 'reeling' || action !== 'reel' && action !== 'slack') return pet;
  const tension = Math.max(0, session.tension + (action === 'reel' ? session.strongRod ? 24 : 32 : -40));
  const progress = Math.max(0, session.progress + (action === 'reel' ? 28 : -5));
  if (tension >= 100) return { ...cancelCommunityFishing(pet, id), recentEvent: '鱼线绷得太紧，鱼儿脱钩了。下次在张力升高时松线。' };
  if (progress < 100) return { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: { ...session, tension, progress, revision: revision + 1, lastActionAt: now } } } };
  const entry = pet.community.fishing.journal[session.fish];
  const next = { ...pet, lastInteractionAt: now, community: { ...pet.community, fishing: { ...pet.community.fishing, active: undefined,
    pending: { id, fish: session.fish, size: session.size }, journal: { ...pet.community.fishing.journal, [session.fish]: { count: (entry?.count ?? 0) + 1, firstAt: entry?.firstAt ?? now, largest: Math.max(session.size, entry?.largest ?? 0) } } } }, recentEvent: `钓到了${fish[session.fish].name}，${session.size} 厘米！先收好鱼获再抛下一竿。` };
  return recordCommunityCatch(next, session.water, fish[session.fish].rare, now);
};
export const claimCommunityFish = (pet: PetState, id: string): PetState => {
  const pending = pet.community.fishing.pending;
  if (!pending || pending.id !== id || !canSpendCompanionTime(pet)) return pet;
  if ((pet.inventory[pending.fish] ?? 0) >= inventoryItemLimit) return { ...pet, recentEvent: '鱼获仓库已满，鱼会留在收获篮等你，图鉴已经记下。' };
  return { ...pet, inventory: addInventoryItem(pet.inventory, pending.fish, 1), community: { ...pet.community, fishing: { ...pet.community.fishing, pending: undefined } }, recentEvent: `收好了${fish[pending.fish].name}，图鉴永久保留，可到小摊查看回收和上架报价。` };
};
import { isExpeditionAway } from './expeditionData';
