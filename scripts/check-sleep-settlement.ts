import assert from 'node:assert/strict';
import { applyPetAction, useInventoryItem } from '../src/core/petActions';
import { createDefaultPet } from '../src/core/petState';
import type { ItemId, PetState } from '../src/core/petTypes';

const minuteMs = 60 * 1000;
const now = new Date(2026, 6, 23, 12, 0, 0, 0).getTime();

const createSleepingPet = (itemId?: ItemId): PetState => {
  const pet = createDefaultPet(now);
  return {
    ...pet,
    hunger: 40,
    mood: 40,
    cleanliness: 40,
    energy: 20,
    health: 80,
    isSleeping: true,
    lastUpdatedAt: now,
    lastEnergyRecoveryAt: now,
    sleepStartedAt: now - 12 * minuteMs,
    sleepStartMood: 70,
    sleepStartHunger: 70,
    sleepStartCleanliness: 70,
    inventory: itemId ? { ...pet.inventory, [itemId]: 1 } : pet.inventory,
  };
};

const assertWakeSnapshotCleared = (pet: PetState, message: string) => {
  assert.equal(pet.isSleeping, false, `${message}: pet should be awake`);
  assert.equal(pet.sleepStartedAt, 0, `${message}: sleep start should be cleared`);
  assert.equal(pet.sleepStartMood, 0, `${message}: mood snapshot should be cleared`);
  assert.equal(pet.sleepStartHunger, 0, `${message}: hunger snapshot should be cleared`);
  assert.equal(pet.sleepStartCleanliness, 0, `${message}: cleanliness snapshot should be cleared`);
};

const originalRandom = Math.random;
Math.random = () => 0;

try {
  const foodPet = createSleepingPet('emergency_biscuit');
  const foodWakeCount = foodPet.achievements.counters.manualWakeCount;
  const fed = useInventoryItem(foodPet, 'emergency_biscuit', now);
  assertWakeSnapshotCleared(fed, 'regular food wake');
  assert.equal(fed.mood, 39, 'normal sleep settlement (+2) must be applied before food and wake penalties');
  assert.equal(fed.hunger, 54);
  assert.equal(fed.achievements.counters.manualWakeCount, foodWakeCount + 1);

  const goldenApplePet = createSleepingPet('golden_apple');
  const goldenApple = useInventoryItem(goldenApplePet, 'golden_apple', now);
  assertWakeSnapshotCleared(goldenApple, 'golden apple wake');
  assert.equal(goldenApple.mood, 90, 'sleep settlement (+2), half-cap recovery (+50), then the wake penalty (-2) must all apply');
  assert.equal(goldenApple.energy, 70);
  assert.equal(goldenApple.inventory.golden_apple, undefined);

  const birthdayPet = createSleepingPet('birthday_cake');
  const birthday = useInventoryItem(birthdayPet, 'birthday_cake', now);
  assertWakeSnapshotCleared(birthday, 'birthday cake wake');
  assert.equal(birthday.mood, 100);
  assert.equal(birthday.energy, 100);
  assert.equal(birthday.inventory.birthday_cake, undefined);

  const actionPet = createSleepingPet();
  const actionWakeCount = actionPet.achievements.counters.manualWakeCount;
  const actionWake = applyPetAction(actionPet, 'play', now);
  assertWakeSnapshotCleared(actionWake, 'care action wake');
  assert.equal(actionWake.mood, 38, 'manual action wake must retain the sleep settlement before its wake penalty');
  assert.equal(actionWake.achievements.counters.manualWakeCount, actionWakeCount + 1);

  const zeroSnapshotPet: PetState = {
    ...createSleepingPet(),
    hunger: 80,
    mood: 80,
    cleanliness: 80,
    sleepStartMood: 0,
    sleepStartHunger: 0,
    sleepStartCleanliness: 0,
  };
  const zeroSnapshotWake = applyPetAction(zeroSnapshotPet, 'play', now);
  assert.equal(
    zeroSnapshotWake.mood,
    73,
    'zero is a valid sleep snapshot value and must trigger the low-stat settlement',
  );
  assert.equal(zeroSnapshotWake.health, 79);

  const staleSnapshotPet: PetState = {
    ...createDefaultPet(now),
    isSleeping: false,
    sleepStartedAt: now - 30 * minuteMs,
    sleepStartMood: 80,
    sleepStartHunger: 80,
    sleepStartCleanliness: 80,
    lastUpdatedAt: now,
  };
  const normalizedStaleSnapshot = applyPetAction(staleSnapshotPet, 'play', now);
  assert.equal(normalizedStaleSnapshot.sleepStartedAt, 0, 'awake legacy saves must discard stale snapshots without rewards');

  console.log('sleep settlement checks passed');
} finally {
  Math.random = originalRandom;
}
