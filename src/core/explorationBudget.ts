import { getEffectiveDailyDateKey } from './gameClock';
import { getPetStatScale } from './petStats';
import type { Inventory, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { explorationTravel } from './explorationTravelData';

export const explorationRefillMs = 3 * 3600000;
export const explorationCapacity = 24;
export interface PatrolVoucher { day: string; slot: number; face: number; paid: number; region?: RegionId; quote?: number }
export interface ExplorationBudget {
  refillAt: number; available: number; used: number; day: string;
  vouchers: PatrolVoucher[]; heartDays: { day: string; hours: number; claimed: boolean }[];
  observations: string[]; milestones: number[]; idleCompleted: number; firstTreasure: boolean;
}
const setBudget = (pet: PetState, loop: ExplorationBudget): PetState => ({ ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, loop } } });
export const getExplorationTier = (pet: PetState) => {
  const state = pet.community.expedition;
  if (state.regions.valley.base >= 2 && (state.loop?.used ?? 0) >= 80 && pet.community.decorations.includes('creek_fountain')) return 3;
  return state.regions.valley.surveyed && state.regions.valley.base >= 1 ? 2 : 1;
};
export const getPatrolFace = (pet: PetState) => [150, 300, 600][getExplorationTier(pet) - 1];
export const shiftExplorationDay = (day: string, offset: number) => new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
export const advanceExplorationBudget = (pet: PetState, now: number): PetState => {
  if (pet.timePause || !(pet.adventure.completed.tutorial ?? 0)) return pet;
  const state = pet.community.expedition, old = state.loop;
  const day = [old?.day ?? '', getEffectiveDailyDateKey(pet, now)].sort()[1];
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
      const legacyPaid = !old && pet.adventure.lastCompletedDay?.valley === issueDay;
      for (let slot = 0; slot < 4; slot++) loop.vouchers.push({ day: issueDay, slot, face: getPatrolFace(pet), paid: legacyPaid ? 100 : 0 });
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
export const earnExplorationPay = (pet: PetState, kind: 'manual' | 'hour', now: number, region: RegionId = 'valley') => {
  if (pet.timePause) return { pet, coins: 0, hearts: 0 };
  pet = advanceExplorationBudget(pet, now);
  const old = pet.community.expedition.loop;
  if (!old) return { pet, coins: 0, hearts: 0 };
  const loop = { ...old, vouchers: old.vouchers.map(v => ({ ...v })), heartDays: old.heartDays.map(v => ({ ...v })) };
  const voucher = loop.vouchers.find(v => v.paid < (kind === 'manual' ? 100 : 80) && (!v.region && !v.paid || (v.region ?? 'valley') === region));
  let coins = 0, hearts = 0;
  if (voucher) {
    const paid = kind === 'manual' ? 100 : Math.min(80, voucher.paid + 40);
    voucher.region ??= voucher.paid ? 'valley' : region;
    voucher.quote ??= Math.floor(voucher.face * explorationTravel[voucher.region].payPercent / 100);
    coins = Math.floor(voucher.quote * paid / 100) - Math.floor(voucher.quote * voucher.paid / 100);
    voucher.paid = paid;
  }
  const heart = loop.heartDays.find(v => !v.claimed);
  if (heart) {
    heart.hours += kind === 'manual' ? 4 : 1;
    if (heart.hours >= 4) { heart.claimed = true; hearts = Math.round(22 * getPetStatScale(pet)); }
  }
  return { pet: setBudget(pet, loop), coins, hearts };
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
export const recordLegacyPatrolPay = (pet: PetState, day: string, now: number): PetState => {
  pet = advanceExplorationBudget(pet, now);
  const loop = pet.community.expedition.loop;
  return loop ? setBudget(pet, { ...loop, firstTreasure: true, vouchers: loop.vouchers.map(v => v.day === day ? { ...v, paid: 100 } : v), heartDays: loop.heartDays.map(v => v.day === day ? { ...v, claimed: true } : v) }) : pet;
};
