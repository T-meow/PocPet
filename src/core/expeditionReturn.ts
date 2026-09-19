import { expeditionBagCount, expeditionCapacity, isExpeditionAway, regions } from './expeditionData';
import type { ExpeditionItemId, ExpeditionReceipt } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';
import { getPetStatCap } from './petStats';

export const withExpedition = (pet: PetState, changes: Partial<PetState['community']['expedition']>): PetState => ({ ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, ...changes } } });
export const putExpeditionFinds = (pet: PetState, finds: Inventory): PetState => {
  const state = pet.community.expedition, t = state.active;
  if (!t) return pet;
  const bag = { ...t.bag }, ground = { ...t.ground }, collection = { ...state.collection };
  let space = expeditionCapacity - expeditionBagCount(bag);
  for (const [id, amount] of Object.entries(finds)) {
    const take = Math.min(space, amount); space -= take;
    if (take) bag[id] = (bag[id] ?? 0) + take;
    if (take < amount) ground[id] = (ground[id] ?? 0) + amount - take;
    collection[id as ExpeditionItemId] = (collection[id as ExpeditionItemId] ?? 0) + amount;
  }
  return withExpedition(pet, { collection, active: { ...t, bag, ground } });
};
export const finishExpedition = (pet: PetState, reason: ExpeditionReceipt['reason'], now: number): PetState => {
  const t = pet.community.expedition.active;
  if (!t || pet.community.expedition.pending) return pet;
  return { ...withExpedition(pet, { active: undefined, pending: { id: t.id, mode: t.mode, route: t.route, items: t.bag, overflow: t.ground,
    selected: expeditionBagCount(t.ground) === 0, tool: t.tool, coins: t.coins, hearts: t.hearts, at: now, reason, journal: t.journal } }),
    recentEvent: reason === 'health' ? '健康低于 20%，伙伴已安全返回。发现与已经完成的故事保留，先整理行囊再入库。' : '远行结束了。收好物资，把今天的见闻带回社区。' };
};
// Only timed travel produces supplies from elapsed time. Manual trips never move offline.
export const settleExpeditionTime = (pet: PetState, now: number): PetState => {
  let t = pet.community.expedition.active;
  if (!t || t.paused) return pet;
  const unhealthy = pet.health < getPetStatCap(pet) * .2;
  if (t.mode === 'idle') {
    // A health crossing wins ties with a timed harvest; no work happens after retreat.
    const until = Math.min(now - (unhealthy ? 1 : 0), t.endsAt);
    const done = Math.max(t.settledParts, Math.min(t.parts, Math.floor((until - t.startedAt) / 3600000)));
    if (done > t.settledParts) {
      pet = putExpeditionFinds(pet, { [regions[t.route[0]].product]: done - t.settledParts });
      t = pet.community.expedition.active!;
      pet = withExpedition(pet, { active: { ...t, settledParts: done, revision: t.revision + 1 } });
    }
  }
  if (unhealthy && isExpeditionAway(pet)) return finishExpedition(pet, 'health', now);
  if (t.mode === 'idle' && now >= t.endsAt) return finishExpedition(pet, 'complete', t.endsAt);
  return pet;
};
