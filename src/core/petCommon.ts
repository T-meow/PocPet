import { list, pick, t } from '../i18n';
import { clampPetEnergy, clampPetHealth, clampPetStat, getPetEnergyCap, roundPetStatDisplayAmount, scalePetStatDelta } from './petStats';
import type { ActionStreak, CareActionKey, PetState, RecentActivity } from './petTypes';
import { randomInt } from './utils';

export const lowSleepMoodWarningThreshold = 25;

export const petInteractionHeartMoodThreshold = 75;
export const petInteractionHeartHealthThreshold = 40;
export const basePlayMoodGain = 18;
export const playEnergyCost = 3;
export const petInteractionMoodPerEnergy = basePlayMoodGain / playEnergyCost;
export const petInteractionEnergyCostRatio = 0.01;

export const getPetInteractionEnergyCost = (pet: PetState) =>
  Math.max(1, Math.round(getPetEnergyCap(pet) * petInteractionEnergyCostRatio));


const overuseWindowMs = 10 * 60 * 1000;
const defaultOveruseThreshold = 3;
const overuseThresholds: Partial<Record<CareActionKey, number>> = {
  touch: 6,
};






export const getRandomPetInteractionCost = (pet: PetState) => {
  const name = pet.name;
  const texts = list('pet.interaction.cost', { name });
  const energy = getPetInteractionEnergyCost(pet);
  const options = [
    {
      hunger: scalePetStatDelta(pet, 2),
      cleanliness: 0,
      energy,
      text: texts[0] ?? '',
    },
    {
      hunger: 0,
      cleanliness: scalePetStatDelta(pet, 3),
      energy,
      text: texts[1] ?? '',
    },
    {
      hunger: scalePetStatDelta(pet, 1),
      cleanliness: scalePetStatDelta(pet, 2),
      energy,
      text: texts[2] ?? '',
    },
    {
      hunger: scalePetStatDelta(pet, 1),
      cleanliness: 0,
      energy,
      text: texts[3] ?? '',
    },
  ];

  return options[Math.floor(Math.random() * options.length)];
};

export type ActionIncidentKind = 'play' | 'work';

export const getRandomHealthIncident = (kind: ActionIncidentKind, pet: PetState) => {
  const triggered = Math.random() < (kind === 'play' ? 0.2 : 0.3);
  if (!triggered) return undefined;

  const amount = scalePetStatDelta(pet, kind === 'play' ? randomInt(1, 3) : randomInt(2, 5));
  const text = pick(kind === 'play' ? 'pet.incident.play' : 'pet.incident.work', {
    amount: roundPetStatDisplayAmount(amount),
  });

  return { amount, text };
};

export const applyActionStreak = (pet: PetState, key: CareActionKey, now: number) => {
  if (key === 'feed' || key === 'touch') return { pet, text: '', triggered: false };

  const previous = pet.actionStreak;
  const count =
    previous.key === key && now - previous.windowStartedAt <= overuseWindowMs ? Math.min(previous.count + 1, 99) : 1;
  const nextStreak: ActionStreak = {
    key,
    count,
    windowStartedAt: previous.key === key && now - previous.windowStartedAt <= overuseWindowMs ? previous.windowStartedAt : now,
    lastAt: now,
  };

  const base = { ...pet, actionStreak: nextStreak };
  const threshold = overuseThresholds[key] ?? defaultOveruseThreshold;
  if (count < threshold) return { pet: base, text: '', triggered: false };

  const resetStreak: ActionStreak = {
    key: 'none',
    count: 0,
    windowStartedAt: now,
    lastAt: now,
  };

  const reactions: Record<CareActionKey, { effect: { hunger?: number; mood?: number; cleanliness?: number; energy?: number; health?: number }; textKey: string }> = {
    play: {
      effect: { energy: -2, hunger: -2 },
      textKey: 'pet.streak.play',
    },
    clean: {
      effect: { mood: -4, hunger: -1 },
      textKey: 'pet.streak.clean',
    },
    work: {
      effect: { mood: -2, health: -2 },
      textKey: 'pet.streak.work',
    },
    feed: {
      effect: { mood: -3, cleanliness: -1 },
      textKey: 'pet.streak.feed',
    },
    gift: {
      effect: { mood: -2 },
      textKey: 'pet.streak.gift',
    },
    touch: {
      effect: { mood: -3, energy: -1 },
      textKey: 'pet.streak.touch',
    },
  };

  const reaction = reactions[key];
  const hunger = scalePetStatDelta(base, reaction.effect.hunger ?? 0);
  const mood = scalePetStatDelta(base, reaction.effect.mood ?? 0);
  const cleanliness = scalePetStatDelta(base, reaction.effect.cleanliness ?? 0);
  const health = scalePetStatDelta(base, reaction.effect.health ?? 0);
  const displayAmount = (amount: number) => Math.abs(roundPetStatDisplayAmount(amount));
  return {
    pet: {
      ...base,
      actionStreak: resetStreak,
      hunger: clampPetStat(base, base.hunger + hunger),
      mood: clampPetStat(base, base.mood + mood),
      cleanliness: clampPetStat(base, base.cleanliness + cleanliness),
      energy: clampPetEnergy(base, base.energy + (reaction.effect.energy ?? 0)),
      health: clampPetHealth(base, base.health + health),
    },
    text: t(reaction.textKey, {
      name: pet.name,
      hunger: displayAmount(hunger),
      mood: displayAmount(mood),
      cleanliness: displayAmount(cleanliness),
      health: displayAmount(health),
      energy: displayAmount(reaction.effect.energy ?? 0),
    }),
    triggered: true,
  };
};


export const withActivity = (pet: PetState, activity: RecentActivity, now: number, durationMs = 4500): PetState => ({
  ...pet,
  recentActivity: activity,
  recentActivityUntil: now + durationMs,
});

export const markInteraction = (pet: PetState, now: number): PetState => ({
  ...pet,
  lastInteractionAt: now,
});



