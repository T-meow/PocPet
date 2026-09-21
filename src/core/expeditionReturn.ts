import { expeditionBagCount, isExpeditionAway, regions } from './expeditionData';
import type { ExpeditionItemId, ExpeditionReceipt } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';
import { getPetStatCap } from './petStats';
import { advanceExplorationBudget, earnExplorationPay, settleReservedHarvest } from './explorationBudget';
import { valleyGatherFinds } from './valleyExplorationData';
import { getExplorationBagCapacity } from './explorationBackpack';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';

export const withExpedition = (pet: PetState, changes: Partial<PetState['community']['expedition']>): PetState => ({ ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, ...changes } } });
export const putExpeditionFinds = (pet: PetState, finds: Inventory): PetState => {
  const state = pet.community.expedition, t = state.active;
  if (!t) return pet;
  const bag = { ...t.bag }, ground = { ...t.ground }, collection = { ...state.collection };
  let space = Math.max(0, (t.rulesVersion >= 2 && t.mode === 'idle' ? 512 : getExplorationBagCapacity(pet)) - expeditionBagCount(bag));
  for (const [id, amount] of Object.entries(finds)) {
    const take = Math.min(space, amount); space -= take;
    if (take) bag[id] = (bag[id] ?? 0) + take;
    if (take < amount) ground[id] = (ground[id] ?? 0) + amount - take;
    collection[id as ExpeditionItemId] = (collection[id as ExpeditionItemId] ?? 0) + amount;
  }
  return withExpedition(pet, { collection, active: { ...t, bag, ground } });
};
export const finishExpedition = (pet: PetState, reason: ExpeditionReceipt['reason'], now: number): PetState => {
  if (pet.timePause) return pet;
  let t = pet.community.expedition.active;
  if (!t || pet.community.expedition.pending) return pet;
  let refundCoins = 0;
  if (t.rulesVersion >= 2 && t.mode === 'idle') {
    pet = advanceExplorationBudget(pet, now);
    pet = settleReservedHarvest(pet, t.reservedHarvests ?? 0, true);
    const unopened = Math.max(0, Math.ceil(t.parts / 2) - Math.max(1, Math.ceil(Math.max(0, Math.min(now, t.endsAt) - t.startedAt) / 7200000)));
    if (t.rulesVersion === 2 && unopened) pet = putExpeditionFinds(pet, { trail_mix: unopened });
    if (t.rulesVersion >= 3) {
      const current = pet.community.expedition.active!, bag = { ...current.bag };
      const started = Math.max(1, Math.ceil(Math.max(0, Math.min(now, t.endsAt) - t.startedAt) / 7200000));
      for (const [index, segment] of (t.rationSegments ?? []).entries()) {
        if (segment.started || index < started) continue;
        refundCoins += segment.price;
        for (const [id, count] of Object.entries(segment.food)) bag[id] = (bag[id] ?? 0) + count;
      }
      pet = withExpedition(pet, { active: { ...current, bag } });
    }
    const state = pet.community.expedition;
    if (state.loop && reason === 'complete') pet = withExpedition(pet, { loop: { ...state.loop, idleCompleted: state.loop.idleCompleted + 1 } });
    t = pet.community.expedition.active!;
  }
  return { ...withExpedition(pet, { active: undefined, pending: { id: t.id, rulesVersion: t.rulesVersion, mode: t.mode, route: t.route, items: t.bag, overflow: t.ground,
    selected: expeditionBagCount(t.ground) === 0, tool: t.tool, coins: t.coins, refundCoins, hearts: t.hearts, at: now, reason, journal: t.journal } }),
    recentEvent: reason === 'health' ? '健康低于 20%，伙伴已安全返回。发现与已经完成的故事保留，先整理行囊再入库。' : '远行结束了。收好物资，把今天的见闻带回社区。' };
};
// Only timed travel produces supplies from elapsed time. Manual trips never move offline.
export const settleExpeditionTime = (pet: PetState, now: number): PetState => {
  if (pet.timePause) return pet;
  let t = pet.community.expedition.active;
  if (!t || t.paused) return pet;
  const unhealthy = pet.health < getPetStatCap(pet) * .2;
  if (t.mode === 'idle') {
    if (t.rulesVersion >= 3) {
      t = { ...t, rationSegments: t.rationSegments?.map((s, index) => s.started || now <= t!.startedAt + index * 7200000 ? s : { ...s, started: true }) };
      pet = withExpedition(pet, { active: t });
    }
    // A health crossing wins ties with a timed harvest; no work happens after retreat.
    const until = Math.min(now - (unhealthy ? 1 : 0), t.endsAt);
    const done = Math.max(t.settledParts, Math.min(t.parts, Math.floor((until - t.startedAt) / 3600000)));
    if (done > t.settledParts) {
      if (t.rulesVersion >= 2) {
        for (let hour = t.settledParts + 1; hour <= done; hour++) {
          if (!(pet.community.expedition.active?.reservedHarvests ?? 0)) break;
          const at = t.startedAt + hour * 3600000;
          pet = settleReservedHarvest(pet, 1, false);
          const region = t.route[0];
          pet = putExpeditionFinds(pet, region === 'valley' ? valleyGatherFinds(t.target ?? 'valley_mushroom', true) : { [regions[region].product]: 2 });
          const earned = earnExplorationPay(pet, 'hour', at, region);
          pet = earned.pet;
          const current = pet.community.expedition.active!;
          pet = withExpedition(pet, { active: { ...current, coins: current.coins + earned.coins, hearts: current.hearts + earned.hearts } });
          if (t.rulesVersion >= 3 && hour % 2 === 0) {
            const trip = pet.community.expedition.active!, index = hour / 2 - 1, segment = trip.rationSegments?.[index];
            if (segment && !segment.settled) {
              const won = segment.roll < segment.chance;
              pet = withExpedition(pet, { active: { ...trip, rationSegments: trip.rationSegments!.map((s, i) => i === index ? { ...s, started: true, settled: true, won } : s) } });
              const treasure = regionalTreasureIds.find(id => regionalTreasures[id].region === region)!;
              if (won) pet = putExpeditionFinds(pet, { [treasure]: 1 });
            }
          }
        }
      } else pet = putExpeditionFinds(pet, { [regions[t.route[0]].product]: done - t.settledParts });
      t = pet.community.expedition.active!;
      pet = withExpedition(pet, { active: { ...t, settledParts: done, revision: t.revision + 1 } });
    }
  }
  if (unhealthy && isExpeditionAway(pet)) return finishExpedition(pet, 'health', now);
  if (t.mode === 'idle' && now >= t.endsAt) return finishExpedition(pet, 'complete', t.endsAt);
  return pet;
};
