import { advancePet } from './petLifecycle';
import { getPetEnergyCap, getPetStatCap, updatePetSatiety } from './petStats';
import type { PetState } from './petTypes';
import { spendToolUse } from './toolDurability';
import { getAdventureStepCount } from './adventureData';

export type ExplorationSystem = 'adventure';
const activeTrip = (pet: PetState, system: ExplorationSystem) => pet.adventure.active;
const supportReason = (pet: PetState, system: ExplorationSystem) => {
  const trip = activeTrip(pet, system);
  return pet.timePause ? '时间冻结中' : !trip ? '仅限手动探索途中' : pet.health < getPetStatCap(pet) * .2 ? '健康过低，正在安全返程' : '';
};
export const getExplorationRescueQuote = (pet: PetState, system: ExplorationSystem) => {
  const cap = getPetStatCap(pet), energyCap = getPetEnergyCap(pet);
  const hunger = Math.max(0, Math.min(cap - pet.hunger, Math.floor(cap * .8))), energy = Math.max(0, Math.min(energyCap - pet.energy, Math.floor(energyCap * .5))), mood = Math.max(0, Math.min(cap - pet.mood, Math.floor(cap * .2)));
  const reason = supportReason(pet, system) || (!hunger && !energy ? '饱食和体力都无需恢复' : pet.hearts < 100 ? '需要 100 心心' : '');
  return { cost: 100, hunger, energy, mood, reason };
};
const recordRecovery = (pet: PetState, system: ExplorationSystem, energy: number, health: number, rest: boolean): PetState => {
  const t = pet.adventure.active!;
  return { ...pet, adventure: { ...pet.adventure, active: { ...t, revision: t.revision + 1, energySpent: Math.max(0, (t.energySpent ?? 0) - energy), healthLost: Math.max(0, (t.healthLost ?? 0) - health), rested: t.rested || rest } } };
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
  const t = activeTrip(pet, system), cap = getPetStatCap(pet), energyCap = getPetEnergyCap(pet);
  const energy = Math.max(0, Math.min(energyCap - pet.energy, Math.floor(energyCap * .25), t?.energySpent ?? 0));
  const health = Math.max(0, Math.min(cap - pet.health, 3, t?.healthLost ?? 0));
  const mood = Math.max(0, Math.min(cap - pet.mood, Math.floor(cap * .2)));
  const rested = pet.adventure.active?.rested;
  const checkpoint = t ? Math.floor(getAdventureStepCount(t.region, t.purpose) / 2) : 0;
  const atCheckpoint = Boolean(t && t.choices.length === checkpoint);
  const reason = supportReason(pet, system) || (rested ? '本趟已休整过' : !atCheckpoint ? `仅在完成第 ${checkpoint} 阶段后、继续前进前可以休整` : !(pet.inventory.camp_kit ?? 0) ? '仓库中需要便携营具' : !energy && !health && !mood ? '当前没有需要恢复的状态' : '');
  return { energy, health, mood, reason, checkpoint, atCheckpoint };
};
export const restExplorationWithKit = (pet: PetState, system: ExplorationSystem, id: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  const t = activeTrip(pet, system), q = getExplorationCampQuote(pet, system);
  if (!t || t.id !== id || t.revision !== revision || q.reason) return pet;
  const use = spendToolUse(pet, 'camp_kit');
  if (!use) return pet;
  return { ...recordRecovery(use.pet, system, q.energy, q.health, true), energy: pet.energy + q.energy, health: pet.health + q.health, mood: pet.mood + q.mood, lastInteractionAt: now,
    recentEvent: `支起便携营具：体力 +${q.energy}、心情 +${q.mood}、健康 +${q.health}。营具耐久 −1${use.broken ? '，已用尽' : ''}；本趟休整次数已使用。` };
};
