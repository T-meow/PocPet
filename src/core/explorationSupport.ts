import { advancePet } from './petLifecycle';
import { getPetEnergyCap, getPetStatCap, updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { spendToolUse } from './toolDurability';

export type ExplorationSystem = 'adventure' | 'expedition';
const activeTrip = (pet: PetState, system: ExplorationSystem) => system === 'adventure' ? pet.adventure.active : pet.community.expedition.active;
const supportReason = (pet: PetState, system: ExplorationSystem) => {
  const trip = activeTrip(pet, system), expedition = system === 'expedition' ? pet.community.expedition.active : undefined;
  return pet.timePause ? '时间冻结中' : !trip || expedition?.mode === 'idle' ? '仅限手动探索途中' : expedition?.paused ? '行程已在基地暂停' : pet.health < getPetStatCap(pet) * .2 ? '健康过低，正在安全返程' : '';
};
export const getExplorationRescueQuote = (pet: PetState, system: ExplorationSystem) => {
  const cap = getPetStatCap(pet), energyCap = getPetEnergyCap(pet);
  const hunger = Math.max(0, Math.min(cap - pet.hunger, Math.floor(cap * .8))), energy = Math.max(0, Math.min(energyCap - pet.energy, Math.floor(energyCap * .5))), mood = Math.max(0, Math.min(cap - pet.mood, Math.floor(cap * .2)));
  const reason = supportReason(pet, system) || (!hunger && !energy ? '饱食和体力都无需恢复' : pet.hearts < 100 ? '需要 100 心心' : '');
  return { cost: 100, hunger, energy, mood, reason };
};
const recordRecovery = (pet: PetState, system: ExplorationSystem, energy: number, health: number, rest: boolean): PetState => {
  if (system === 'adventure') {
    const t = pet.adventure.active!;
    return { ...pet, adventure: { ...pet.adventure, active: { ...t, revision: t.revision + 1, energySpent: Math.max(0, (t.energySpent ?? 0) - energy), healthLost: Math.max(0, (t.healthLost ?? 0) - health), rested: t.rested || rest } } };
  }
  const s = pet.community.expedition, t = s.active!;
  return { ...pet, community: { ...pet.community, expedition: { ...s, active: { ...t, revision: t.revision + 1, energySpent: Math.max(0, (t.energySpent ?? 0) - energy), healthLost: Math.max(0, (t.healthLost ?? 0) - health), rested: rest ? [...t.rested, t.route[t.leg]] : t.rested } } } };
};
export const rescueExploration = (pet: PetState, system: ExplorationSystem, id: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  const t = activeTrip(pet, system), q = getExplorationRescueQuote(pet, system);
  if (!t || t.id !== id || t.revision !== revision || q.reason) return pet;
  return updatePetSatiety({ ...recordRecovery(pet, system, q.energy, 0, false), hearts: pet.hearts - q.cost, hunger: pet.hunger + q.hunger, energy: pet.energy + q.energy, mood: pet.mood + q.mood, lastInteractionAt: now,
    recentEvent: `邻居送来了应急物资包：饱食 +${q.hunger}、体力 +${q.energy}、心情 +${q.mood}。花费 100 心心，可以继续当前行程。` });
};
export const getExplorationCampQuote = (pet: PetState, system: ExplorationSystem) => {
  const t = activeTrip(pet, system), cap = getPetStatCap(pet), energyCap = getPetEnergyCap(pet), e = system === 'expedition' ? pet.community.expedition.active : undefined;
  const energy = Math.max(0, Math.min(energyCap - pet.energy, Math.floor(energyCap * .25), t?.energySpent ?? 0));
  const health = Math.max(0, Math.min(cap - pet.health, 3, t?.healthLost ?? 0));
  const mood = Math.max(0, Math.min(cap - pet.mood, Math.floor(cap * .2)));
  const rested = e ? e.rested.includes(e.route[e.leg]) : pet.adventure.active?.rested;
  const paid = t?.paidActions ?? (e ? e.style !== 'walk' && e.step > 0 : (pet.adventure.active?.choices.length ?? 0) > 0);
  const reason = supportReason(pet, system) || (rested ? '本地区已休整过' : !paid || e?.style === 'walk' ? '完成一次有消耗的行动后可以扎营' : !(pet.inventory.camp_kit ?? 0) ? '需要便携营具' : !energy && !health && !mood ? '当前没有需要恢复的状态' : '');
  return { energy, health, mood, reason };
};
export const restExplorationWithKit = (pet: PetState, system: ExplorationSystem, id: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  const t = activeTrip(pet, system), q = getExplorationCampQuote(pet, system);
  if (!t || t.id !== id || t.revision !== revision || q.reason) return pet;
  const use = spendToolUse(pet, 'camp_kit');
  if (!use) return pet;
  return { ...recordRecovery(use.pet, system, q.energy, q.health, true), energy: pet.energy + q.energy, health: pet.health + q.health, mood: pet.mood + q.mood, lastInteractionAt: now,
    recentEvent: `支起便携营具：体力 +${q.energy}、心情 +${q.mood}、健康 +${q.health}。营具耐久 −1${use.broken ? '，已用尽' : ''}；本地区休整次数已使用。` };
};
