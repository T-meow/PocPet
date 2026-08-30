import assert from 'node:assert/strict';
import { createDefaultPet, type PetState } from '../src/core/pet';
import {
  createSaveFileText,
  loadStoredPetJson,
  parseSaveFileText,
  pocPetSaveAppId,
} from '../src/core/saveCodec';
import {
  backupCurrentPet,
  clearPet,
  getImportBackup,
  getPreservedCorruptPetRaw,
  loadPet,
  replacePetFromImport,
  restorePetBackup,
  saveImportBackup,
  savePet,
} from '../src/core/storage';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  private failSetKey: string | undefined;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  failNextSet(key: string) {
    this.failSetKey = key;
  }

  setItem(key: string, value: string) {
    if (this.failSetKey === key) {
      this.failSetKey = undefined;
      throw new Error(`Injected storage failure for ${key}`);
    }
    this.values.set(key, String(value));
  }
}

const exportAt = new Date(2026, 6, 23, 12, 0, 0, 0).getTime();
const importAt = exportAt + 2 * 60 * 60 * 1000;
const basePet = createDefaultPet(exportAt);

assert.throws(() => parseSaveFileText('{}', importAt), /recognizable/);
assert.throws(
  () => parseSaveFileText(JSON.stringify({ app: 'PocPet', schemaVersion: 1, exportedAt: new Date(exportAt).toISOString(), pet: {} }), importAt),
  /invalid pet data/,
);
assert.throws(
  () => parseSaveFileText(JSON.stringify({ app: 'AnotherApp', schemaVersion: 1, exportedAt: new Date(exportAt).toISOString(), pet: basePet }), importAt),
  /not a supported PocPet/,
);
assert.throws(
  () => parseSaveFileText(JSON.stringify({
    app: 'PocPet',
    schemaVersion: 1,
    exportedAt: new Date(exportAt).toISOString(),
    pet: basePet,
    activeMod: { id: '', name: 'Broken', version: '1.0.0' },
  }), importAt),
  /invalid Mod information/,
);

const legacy101Save = {
  name: 'Legacy',
  level: 3,
  hunger: 80,
  mood: 70,
  cleanliness: 60,
  energy: 50,
  health: 90,
  ageSeconds: 123,
  lastUpdatedAt: exportAt,
  isSleeping: false,
  recentEvent: 'Legacy event',
  recentActivity: 'idle',
  recentActivityUntil: 0,
  coins: 456,
  hearts: 7,
  inventory: { bento: 2 },
  lastDailyRewardAt: 0,
  lastDailyEncounterAt: exportAt,
  dailyBiscuitClaimDate: '',
  dailyBiscuitClaims: 0,
  dailyDiscountDate: '',
  dailyDiscountUsed: false,
  weatherDate: '',
  weather: 'sunny',
  lastEnergyRecoveryAt: exportAt,
  sleepStartedAt: 0,
  sleepStartMood: 0,
  sleepStartHunger: 0,
  sleepStartCleanliness: 0,
  lastDreamTalkAt: 0,
  actionStreak: { key: 'none', count: 0, windowStartedAt: exportAt, lastAt: 0 },
  lastInteractionAt: exportAt,
  lastPetInteractionAt: 0,
  pomodoro: basePet.pomodoro,
};
const importedLegacy = parseSaveFileText(JSON.stringify(legacy101Save), importAt);
assert.equal(importedLegacy.source, 'legacy');
assert.equal(importedLegacy.pet.name, 'Legacy');

const runningPet: PetState = {
  ...basePet,
  pomodoro: {
    ...basePet.pomodoro,
    isRunning: true,
    phase: 'focus',
    phaseStartedAt: exportAt - 10 * 60 * 1000,
    phaseEndsAt: exportAt + 15 * 60 * 1000,
    pausedRemainingMs: 0,
  },
};
const importedRunning = parseSaveFileText(createSaveFileText(runningPet, null, exportAt), importAt);
assert.equal(importedRunning.source, 'envelope');
assert.equal(importedRunning.sourceApp, pocPetSaveAppId);
assert.equal(importedRunning.exportedAt, new Date(exportAt).toISOString());
assert.equal(importedRunning.pet.pomodoro.isRunning, false);
assert.equal(importedRunning.pet.pomodoro.pausedRemainingMs, 15 * 60 * 1000);
assert.deepEqual(importedRunning.pet.actionStreak, {
  key: 'none',
  count: 0,
  windowStartedAt: importAt,
  lastAt: 0,
});
const importedRunningLater = parseSaveFileText(createSaveFileText(runningPet, null, exportAt), importAt + 60 * 60 * 1000);
assert.equal(importedRunningLater.pet.pomodoro.pausedRemainingMs, 15 * 60 * 1000, 'preview delay must not consume imported Pomodoro time');

const sleepingPet: PetState = {
  ...basePet,
  hunger: 42,
  mood: 43,
  cleanliness: 44,
  isSleeping: true,
  sleepStartedAt: exportAt - 30 * 60 * 1000,
  sleepStartMood: 90,
  sleepStartHunger: 91,
  sleepStartCleanliness: 92,
};
const importedSleeping = parseSaveFileText(createSaveFileText(sleepingPet, null, exportAt), importAt).pet;
assert.equal(importedSleeping.sleepStartedAt, importAt, 'imported sleep starts from the confirmation time');
assert.equal(importedSleeping.sleepStartMood, importedSleeping.mood);
assert.equal(importedSleeping.sleepStartHunger, importedSleeping.hunger);
assert.equal(importedSleeping.sleepStartCleanliness, importedSleeping.cleanliness);

const corruptLoad = loadStoredPetJson('{}', importAt);
assert.equal(corruptLoad.status, 'corrupt');

const localStorage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage };

const firstPet = { ...basePet, name: 'First' };
const secondPet = { ...basePet, name: 'Second' };
savePet(firstPet);
savePet(secondPet);
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').name, 'First');

localStorage.setItem('pocpet.pet.v1', '{}');
const damaged = loadPet(importAt);
assert.equal(damaged.status, 'corrupt');
assert.equal(damaged.status === 'corrupt' ? damaged.backup?.name : undefined, 'First');
assert.equal(getPreservedCorruptPetRaw(), '{}');

const restored = restorePetBackup(importAt);
assert.equal(restored?.name, 'First');
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1') ?? '{}').name, 'First');
assert.equal(getPreservedCorruptPetRaw(), '{}', 'restoring must preserve the damaged original');

savePet(secondPet);
assert.equal(backupCurrentPet(), true);
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').name, 'Second');
const importBackupText = createSaveFileText(secondPet, null, exportAt);
saveImportBackup(importBackupText);
savePet(firstPet);
assert.equal(getImportBackup(), importBackupText, 'automatic recent backups must not overwrite the pre-import backup');

const previousPrimary = localStorage.getItem('pocpet.pet.v1');
const previousBackup = localStorage.getItem('pocpet.pet.v1.backup');
const previousImportBackup = localStorage.getItem('pocpet.pet.v1.import-backup');
localStorage.failNextSet('pocpet.pet.v1');
assert.throws(
  () => replacePetFromImport(secondPet, createSaveFileText(firstPet, null, exportAt)),
  /Injected storage failure/,
);
assert.equal(localStorage.getItem('pocpet.pet.v1'), previousPrimary, 'failed import must restore the primary save');
assert.equal(localStorage.getItem('pocpet.pet.v1.backup'), previousBackup, 'failed import must restore the rolling backup');
assert.equal(localStorage.getItem('pocpet.pet.v1.import-backup'), previousImportBackup, 'failed import must restore the prior import backup');

const successfulImportBackup = createSaveFileText(firstPet, null, exportAt);
replacePetFromImport(secondPet, successfulImportBackup);
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1') ?? '{}').name, 'Second');
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').name, 'First');
assert.equal(getImportBackup(), successfulImportBackup);

clearPet();
assert.equal(localStorage.length, 0);

console.log('Save validation, backup recovery, and import timing checks passed.');
