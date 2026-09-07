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
  getStoredRecoveryCopies,
  getStoredSaveIdentity,
  loadPet,
  replacePetFromImport,
  restorePetBackup,
  saveImportBackup,
  savePet,
  setStoredSaveIdentity,
  upgradeStorageKey,
} from '../src/core/storage';
import { getEditionFeatures } from '../src/platform/edition';
import { isBackupDue, trimBackupSnapshots, type BackupSnapshot } from '../src/platform/automaticBackup';
import { editionNoticeKey, recordEditionNoticeShown, readEditionNotice, localDateKey, shouldShowEditionNotice } from '../src/core/editionNotice';
import { builtinMintManifest } from '../src/core/builtinPetModManifests';
import { readRecoveryCandidate } from '../src/platform/saveRecovery';

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
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = localStorage;

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

assert.equal(loadPet(importAt).status, 'ok');
clearPet();
assert.equal(localStorage.getItem('pocpet.pet.v1'), null);
assert.ok(localStorage.getItem(upgradeStorageKey), 'reset must retain the pre-upgrade original');

localStorage.setItem('pocpet.pet.v1.backup', JSON.stringify(firstPet));
const missingWithBackup = loadPet(importAt);
assert.equal(missingWithBackup.status, 'corrupt', 'a missing primary with a valid backup must open recovery');
assert.equal(missingWithBackup.status === 'corrupt' ? missingWithBackup.backup?.name : undefined, 'First');

for (const name of [null, undefined, '', '   ', 123]) {
  const raw = JSON.stringify({ ...basePet, name });
  const loaded = loadStoredPetJson(raw, importAt, undefined, 'Mod Default');
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.status === 'ok' && loaded.pet.name, 'Mod Default');
  assert.equal(parseSaveFileText(raw, importAt, 'Mod Default').pet.name, 'Mod Default');
}
assert.equal(loadStoredPetJson('{', importAt).status, 'corrupt');
assert.equal(loadStoredPetJson('{', importAt).status === 'corrupt' && (loadStoredPetJson('{', importAt) as { stage: string }).stage, 'parse');
localStorage.setItem('pocpet.pet.v1', JSON.stringify(firstPet));
assert.equal(loadPet(importAt).status, 'ok');
localStorage.setItem('pocpet.pet.v1', JSON.stringify(secondPet));
assert.throws(() => savePet(firstPet), /storage-conflict/, 'a stale page must not overwrite another page');
assert.equal(JSON.parse(localStorage.getItem('pocpet.pet.v1')!).name, 'Second');

localStorage.clear();
const originalUpgradeRaw = JSON.stringify(firstPet);
localStorage.setItem('pocpet.pet.v1', originalUpgradeRaw);
localStorage.failNextSet(upgradeStorageKey);
const readOnlyLoad = loadPet(importAt);
assert.equal(readOnlyLoad.status, 'ok', 'a failed upgrade backup must not hide valid progress');
assert.ok(readOnlyLoad.status === 'ok' && readOnlyLoad.persistenceError === 'upgradeBackup');
if (readOnlyLoad.status === 'ok') {
  assert.equal(parseSaveFileText(createSaveFileText(readOnlyLoad.pet), importAt).pet.name, 'First', 'read-only progress remains exportable');
}
assert.throws(() => savePet(secondPet), /upgrade-backup-blocked/);
assert.throws(() => replacePetFromImport(secondPet, 'backup'), /upgrade-backup-blocked/);
assert.throws(() => clearPet(), /upgrade-backup-blocked/);
assert.equal(localStorage.getItem('pocpet.pet.v1'), originalUpgradeRaw);
const writableLoad = loadPet(importAt);
assert.ok(writableLoad.status === 'ok' && !writableLoad.persistenceError, 'reload retries the upgrade backup after storage recovers');
assert.equal(localStorage.getItem(upgradeStorageKey), originalUpgradeRaw);
localStorage.setItem('pocpet.pet.v1.pre-upgrade.1.5.0', originalUpgradeRaw);
assert.ok(getStoredRecoveryCopies().some((copy) => copy.key === 'pocpet.pet.v1.pre-upgrade.1.5.0'), 'a version bump must not hide earlier pre-upgrade copies');
savePet(secondPet);

localStorage.clear();
const modA = { ...builtinMintManifest, id: 'legacy-custom-a', name: 'Custom A', defaultPetName: 'Default A' };
const modB = { id: 'mod-b', name: 'Mod B', version: '1.0.0', defaultPetName: 'Default B' };
localStorage.setItem('pocpet.mod.library.v1', JSON.stringify({ schemaVersion: 1, activeModId: modA.id, mods: [{ manifest: modA, importedAt: exportAt }] }));
const namelessBackup = JSON.stringify({ ...firstPet, name: '' });
localStorage.setItem('pocpet.pet.v1.backup', namelessBackup);
assert.equal(loadPet(importAt).status, 'corrupt');
const candidateFor = (key: string) => {
  const copy = getStoredRecoveryCopies().find((item) => item.key === key)!;
  assert.ok(copy, `Missing recovery copy: ${key}`);
  return { id: key, text: copy.raw, format: 'stored' as const, savedAt: exportAt, petName: '', level: 0, activeMod: copy.activeMod };
};
const legacyRecovery = readRecoveryCandidate(candidateFor('pocpet.pet.v1.backup'));
assert.equal(legacyRecovery.activeMod?.id, modA.id, '1.5 local backups retain their installed custom role without the new identity key');
assert.equal(legacyRecovery.pet.name, modA.defaultPetName);
localStorage.setItem('pocpet.pet.v1', originalUpgradeRaw);
assert.equal(loadPet(importAt).status, 'ok');
assert.equal(getStoredSaveIdentity()?.id, modA.id);
assert.equal(localStorage.getItem('pocpet.pet.v1.backup'), namelessBackup, 'adding identity must preserve the exact old backup bytes');
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod?.id, modA.id);
replacePetFromImport(secondPet, createSaveFileText(firstPet, modA, exportAt), modB);
const recoveredA = readRecoveryCandidate(candidateFor('pocpet.pet.v1.backup'));
assert.equal(recoveredA.activeMod?.id, modA.id, 'rolling backup A must not inherit imported primary B');
assert.equal(recoveredA.pet.name, 'First', 'valid legacy names remain unchanged');
assert.equal(candidateFor(upgradeStorageKey).activeMod?.id, modA.id);
const rollbackKeys = ['pocpet.pet.v1', 'pocpet.pet.v1.backup', 'pocpet.pet.v1.backup.identity', 'pocpet.pet.v1.identity', 'pocpet.pet.v1.import-backup'];
const beforeFailedImport = rollbackKeys.map((key) => localStorage.getItem(key));
localStorage.failNextSet('pocpet.pet.v1');
assert.throws(() => replacePetFromImport(firstPet, createSaveFileText(secondPet, modB, exportAt), modA), /Injected storage failure/);
assert.deepEqual(rollbackKeys.map((key) => localStorage.getItem(key)), beforeFailedImport, 'failed import rolls back both progress and per-backup identity');
setStoredSaveIdentity(modA);
backupCurrentPet();
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod?.id, modB.id, 'a role change must not retag the previously persisted pet before its next write');
savePet(firstPet);
backupCurrentPet();
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod?.id, modA.id, 'new primary writes capture the newly selected role');
localStorage.setItem('pocpet.pet.v1.backup', JSON.stringify(secondPet));
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod, undefined, 'mismatched backup metadata must not supply another save identity');

localStorage.clear();
localStorage.setItem('pocpet.mod.library.v1', JSON.stringify({ schemaVersion: 1, activeModId: builtinMintManifest.id, mods: [] }));
localStorage.setItem('pocpet.pet.v1.backup', originalUpgradeRaw);
loadPet(importAt);
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod?.id, builtinMintManifest.id, 'legacy built-in roles remain recoverable');
localStorage.clear();
localStorage.setItem('pocpet.pet.v1', originalUpgradeRaw);
loadPet(importAt);
replacePetFromImport(secondPet, createSaveFileText(firstPet, null, exportAt), modB);
assert.equal(candidateFor('pocpet.pet.v1.backup').activeMod, undefined, 'a backup of the default role must remain the default role');

assert.deepEqual(getEditionFeatures('bilibili'), { cloudSave: true, rename: false, importMod: false, shareCards: true, shareCustomName: false });
assert.deepEqual(getEditionFeatures('standard'), { cloudSave: false, rename: true, importMod: true, shareCards: true, shareCustomName: true });
assert.equal(shouldShowEditionNotice({ count: 0, lastLaunch: '' }, 'first'), true);
assert.equal(shouldShowEditionNotice({ count: 1, lastLaunch: 'first' }, 'first'), false);
assert.equal(shouldShowEditionNotice({ count: 3, lastLaunch: 'third' }, 'fourth'), false);
assert.equal(shouldShowEditionNotice({ count: 1, lastLaunch: 'first' }, 'second'), true);
localStorage.setItem('pocpet.edition-notice.1.6', JSON.stringify({ count: 3, lastDate: localDateKey(exportAt) }));
for (let launch = 0; launch < 4; launch++) {
  if (launch === 0) localStorage.failNextSet(editionNoticeKey);
  recordEditionNoticeShown(`launch-${launch}`);
  recordEditionNoticeShown(`launch-${launch}`);
  assert.equal(readEditionNotice().count, Math.min(launch + 1, 3), 'three launches, once per launch, including launches on the same date');
}
const noticeBeforeImport = localStorage.getItem(editionNoticeKey);
const noticeExport = createSaveFileText(firstPet, null, exportAt);
replacePetFromImport(firstPet, noticeExport);
assert.equal(localStorage.getItem(editionNoticeKey), noticeBeforeImport, 'import must not reset the version notice');
const snapshots: BackupSnapshot[] = Array.from({ length: 9 }, (_, index) => ({
  dateKey: localDateKey(exportAt + index * 86400000), savedAt: exportAt + index * 86400000,
  petName: 'Backup', level: 3, text: 'fixture',
}));
assert.equal(trimBackupSnapshots(snapshots).length, 7);
assert.equal(trimBackupSnapshots(snapshots)[0].savedAt, snapshots[8].savedAt);
assert.equal(trimBackupSnapshots([...snapshots, snapshots[8]]).length, 7);
assert.equal(isBackupDue(snapshots[0], { enabled: true, intervalDays: 1 }, exportAt), false);
assert.equal(isBackupDue(snapshots[0], { enabled: true, intervalDays: 1 }, exportAt + 86400000), true);
assert.equal(isBackupDue(snapshots[0], { enabled: true, intervalDays: 3 }, exportAt + 86400000), false);
assert.equal(isBackupDue(undefined, { enabled: false, intervalDays: 1 }, exportAt), false);

console.log('Save validation, backup recovery, and import timing checks passed.');
