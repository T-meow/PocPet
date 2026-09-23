import { getEffectiveDailyDateKey } from './gameClock';
import { getPetStatScale } from './petStats';
import type { Inventory, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { explorationTravel } from './explorationTravelData';
import { adventureTreasureIds, adventureTreasureValues } from './adventureItems';
import { hashString } from './utils';
import { wildIngredientIds } from './foodCatalog';
import { getExplorationRoll } from './explorationChecks';
import { getDailyResetDateKey } from './dailyReset';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';

export const explorationRefillMs = 3 * 3600000;
export const explorationCapacity = 24;
export interface ExplorationVoucher { day: string; slot: number; face: number; paid: number; region?: RegionId; quote?: number; rewardsVersion?: 1; lootUsed?: number; lootRegion?: RegionId; lootQuote?: number }
export interface ExplorationBudget {
  refillAt: number; available: number; used: number; day: string;
  vouchers: ExplorationVoucher[]; heartDays: { day: string; hours: number; claimed: boolean }[];
  observations: string[]; milestones: number[]; idleCompleted: number; firstTreasure: boolean;
  lootSettledThrough?: number;
}
const setBudget = (pet: PetState, loop: ExplorationBudget): PetState => ({ ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, loop } } });
export const getExplorationTier = (pet: PetState) => {
  const state = pet.community.expedition;
  if (state.regions.valley.base >= 2 && (state.loop?.used ?? 0) >= 80 && pet.community.decorations.includes('creek_fountain')) return 3;
  return state.regions.valley.surveyed && state.regions.valley.base >= 1 ? 2 : 1;
};
export const getExplorationFace = (pet: PetState) => [150, 300, 600][getExplorationTier(pet) - 1];
export const shiftExplorationDay = (day: string, offset: number) => new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
export const advanceExplorationBudget = (pet: PetState, now: number): PetState => {
  if (pet.timePause || !(pet.adventure.completed.tutorial ?? 0)) return pet;
  const state = pet.community.expedition, old = state.loop;
  // The saved budget is its own anti-replay watermark. During offline settlement
  // the global clock already points at load time, but each hour needs its actual date.
  const currentDay = old ? getDailyResetDateKey(now) : getEffectiveDailyDateKey(pet, now);
  const day = old && old.day > currentDay ? old.day : currentDay;
  const legacyUsed = old ? 0 : Object.values(state.regions).reduce((sum, r) => sum + (r.harvestDay === day ? r.harvestUsed : 0), 0);
  let loop: ExplorationBudget = old ? { ...old } : { refillAt: now, available: Math.max(0, 8 - legacyUsed), used: legacyUsed, day: '', vouchers: [], heartDays: [], observations: [], milestones: [], idleCompleted: 0, firstTreasure: Boolean(pet.adventure.completed.valley || pet.adventure.pending?.region === 'valley' && pet.adventure.pending.complete && !pet.adventure.pending.purpose) };
  const reserved = state.active?.reservedHarvests ?? 0;
  const ticks = Math.floor(Math.max(0, now - loop.refillAt) / explorationRefillMs);
  loop.available = Math.min(explorationCapacity - reserved, loop.available + ticks);
  loop.refillAt = loop.available + reserved >= explorationCapacity ? Math.max(now, loop.refillAt) : loop.refillAt + ticks * explorationRefillMs;
  if (loop.day !== day) {
    const oldest = shiftExplorationDay(day, -2);
    loop.vouchers = loop.vouchers.filter(v => v.day >= oldest);
    loop.heartDays = loop.heartDays.filter(v => v.day >= oldest);
    for (let offset = -2; offset <= 0; offset++) {
      const issueDay = shiftExplorationDay(day, offset);
      if (loop.day ? issueDay <= loop.day : issueDay !== day) continue;
      const pending = pet.adventure.pending;
      const legacyPending = pending?.region === 'valley' && pending.complete && !pending.purpose && (pending.completedDay ?? getDailyResetDateKey(pending.endedAt)) === issueDay;
      const legacyPaid = !old && (pet.adventure.lastCompletedDay?.valley === issueDay || legacyPending);
      for (let slot = 0; slot < 4; slot++) loop.vouchers.push({ day: issueDay, slot, face: getExplorationFace(pet), paid: legacyPaid ? 100 : 0, rewardsVersion: 1, lootUsed: legacyPaid ? 100 : 0 });
      loop.heartDays.push({ day: issueDay, hours: 0, claimed: legacyPaid });
    }
    loop.day = day;
  }
  return setBudget(pet, loop);
};
export const getExplorationBudget = (pet: PetState, now = Date.now()) => advanceExplorationBudget(pet, now).community.expedition.loop;
export const spendExplorationHarvest = (pet: PetState, count: number, now: number, reserve = false): PetState => {
  if (pet.timePause) return pet;
  pet = advanceExplorationBudget(pet, now);
  const loop = pet.community.expedition.loop;
  if (!loop || !Number.isInteger(count) || count <= 0 || loop.available < count) return pet;
  return setBudget(pet, { ...loop, available: loop.available - count, used: loop.used + (reserve ? 0 : count) });
};
export const settleReservedHarvest = (pet: PetState, count: number, refund: boolean): PetState => {
  const state = pet.community.expedition, t = state.active, loop = state.loop;
  if (!t || !loop) return pet;
  const quantity = Math.max(0, Math.min(t.reservedHarvests ?? 0, count));
  return { ...pet, community: { ...pet.community, expedition: { ...state,
    loop: { ...loop, available: loop.available + (refund ? quantity : 0), used: loop.used + (refund ? 0 : quantity) },
    active: { ...t, reservedHarvests: (t.reservedHarvests ?? 0) - quantity } } } };
};
// Currency is reserved into the trip receipt here, and paid to the wallet only on claim.
export const earnExplorationPay = (pet: PetState, kind: 'manual' | 'hour', now: number, region: RegionId = 'valley', modern = true) => {
  if (pet.timePause) return { pet, coins: 0, hearts: 0 };
  pet = advanceExplorationBudget(pet, now);
  const old = pet.community.expedition.loop;
  if (!old) return { pet, coins: 0, hearts: 0 };
  const loop = { ...old, vouchers: old.vouchers.map(v => ({ ...v })), heartDays: old.heartDays.map(v => ({ ...v })) };
  const voucher = loop.vouchers.find(v => v.paid < (kind === 'manual' ? 100 : 80) && (!v.region && !v.paid || (v.region ?? 'valley') === region));
  let coins = 0, hearts = 0;
  if (voucher) {
    // Old trips keep the whole untouched voucher; spent random rewards cannot be paid twice.
    if (!modern && !voucher.paid && !voucher.lootUsed) voucher.rewardsVersion = undefined;
    const paid = kind === 'manual' ? 100 : Math.min(80, voucher.paid + 40);
    voucher.region ??= voucher.paid ? 'valley' : region;
    voucher.quote ??= Math.floor(voucher.face * explorationTravel[voucher.region].payPercent / 100);
    const ratio = voucher.rewardsVersion === 1 ? .75 : 1;
    coins = Math.floor(voucher.quote * paid * ratio / 100) - Math.floor(voucher.quote * voucher.paid * ratio / 100);
    if (!modern && voucher.rewardsVersion === 1) voucher.lootUsed = Math.max(voucher.lootUsed ?? 0, paid);
    voucher.paid = paid;
  }
  const heart = loop.heartDays.find(v => !v.claimed);
  if (heart) {
    heart.hours += kind === 'manual' ? 4 : 1;
    if (heart.hours >= 4) { heart.claimed = true; hearts = Math.round(22 * getPetStatScale(pet)); }
  }
  return { pet: setBudget(pet, loop), coins, hearts };
};
const ordinaryGatherIds = new Set(['community_wood', 'community_stone', 'creek_herb', 'valley_mushroom', 'hill_honey', 'forest_berry', 'pine_resin', 'coast_kelp', 'sea_glass', 'observatory_part', ...wildIngredientIds]);
export const commonLootMeanValue = adventureTreasureIds.reduce((sum, id) => sum + adventureTreasureValues[id], 0) / adventureTreasureIds.length;
export const manualTreasureChance = 5;
// Called once after actual consumption, never from a quote or reservation.
export const settleExplorationLoot = (pet: PetState, count: number, kind: 'manual' | 'hour', region: RegionId, now: number, ordinary: Inventory = {}, gatherBonus = 0): { pet: PetState; finds: Inventory } => {
  if (pet.timePause || !Number.isInteger(count) || count <= 0) return { pet, finds: {} };
  pet = advanceExplorationBudget(pet, now);
  const old = pet.community.expedition.loop, finds: Inventory = {};
  if (!old || count > old.used) return { pet, finds };
  const loop = { ...old, vouchers: old.vouchers.map(v => ({ ...v })) };
  const candidates = Object.keys(ordinary).filter(id => ordinary[id] > 0 && ordinaryGatherIds.has(id)).sort();
  const treasure = kind === 'manual' ? regionalTreasureIds.find(id => regionalTreasures[id].region === region) : undefined;
  for (let index = Math.max(0, (loop.lootSettledThrough ?? 0) - (loop.used - count)); index < count; index++) {
    const seed = `${pet.saveMetadata.id}:${pet.createdAt}:harvest:${loop.used - count + index + 1}`;
    const limit = kind === 'hour' ? 80 : 100, share = kind === 'hour' ? 40 : region === 'valley' ? 50 : 100;
    const voucher = loop.vouchers.find(v => v.rewardsVersion === 1 && (v.lootUsed ?? 0) < limit && (!v.lootRegion || v.lootRegion === region));
    if (voucher) {
      const used = voucher.lootUsed ?? 0, next = Math.min(limit, used + share);
      voucher.lootRegion ??= region;
      voucher.lootQuote ??= Math.floor(voucher.face * explorationTravel[region].payPercent / 100);
      const expected = voucher.lootQuote * .25 * (next - used) / 100;
      voucher.lootUsed = next;
      if (getExplorationRoll(hashString(seed), 'common', 'hit') < expected / commonLootMeanValue) {
        const item = adventureTreasureIds[Math.floor(getExplorationRoll(hashString(seed), 'common', 'kind') * adventureTreasureIds.length)];
        finds[item] = (finds[item] ?? 0) + 1;
      }
      if (treasure && getExplorationRoll(hashString(seed), 'regional', 'hit') < manualTreasureChance / 100) {
        finds[treasure] = (finds[treasure] ?? 0) + 1;
      }
    }
    if (kind === 'manual' && candidates.length && getExplorationRoll(hashString(seed), 'pendant', 'hit') < gatherBonus / 100) {
      const item = candidates[Math.floor(getExplorationRoll(hashString(seed), 'pendant', 'kind') * candidates.length)];
      finds[item] = (finds[item] ?? 0) + 1;
    }
  }
  loop.lootSettledThrough = Math.max(loop.lootSettledThrough ?? 0, loop.used);
  return { pet: setBudget(pet, loop), finds };
};
export const recordValleyObservation = (pet: PetState, key: string, now: number): { pet: PetState; finds: Inventory } => {
  if (pet.timePause) return { pet, finds: {} };
  pet = advanceExplorationBudget(pet, now);
  const old = pet.community.expedition.loop, finds: Inventory = {};
  if (!old || !/^[0-5]:[ab]$/.test(key)) return { pet, finds };
  const observations = [...new Set([...old.observations, key])], milestones = [...old.milestones];
  if (observations.length >= 6 && !milestones.includes(6)) { milestones.push(6); finds.valley_amber = 1; }
  if (observations.length >= 12 && pet.adventure.valleyCompleted.includes('valley_camp') && !milestones.includes(12)) { milestones.push(12); finds.ancient_gold_bar = 1; }
  return { pet: setBudget(pet, { ...old, observations, milestones }), finds };
};
export const recordLegacyEntrancePay = (pet: PetState, day: string, now: number): PetState => {
  pet = advanceExplorationBudget(pet, now);
  const loop = pet.community.expedition.loop;
  return loop ? setBudget(pet, { ...loop, firstTreasure: true, vouchers: loop.vouchers.map(v => v.day === day ? { ...v, paid: 100, lootUsed: 100 } : v), heartDays: loop.heartDays.map(v => v.day === day ? { ...v, claimed: true } : v) }) : pet;
};
