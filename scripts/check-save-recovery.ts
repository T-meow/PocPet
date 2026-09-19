import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultPet, type PetState } from '../src/core/pet';
import {
  createSaveFileText,
  decodeSaveSnapshot,
  loadStoredPetJson,
  parseSaveFileText,
  pocPetSaveAppId,
  UnsupportedSaveVersionError,
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
import { isBackupDue, readBackupState, runAutomaticBackup, trimBackupSnapshots, type BackupSnapshot } from '../src/platform/automaticBackup';
import { editionNoticeKey, recordEditionNoticeShown, readEditionNotice, localDateKey, shouldShowEditionNotice } from '../src/core/editionNotice';
import { builtinMintManifest } from '../src/core/builtinPetModManifests';
import { collectRecoveryCandidates, findNewerRecovery, readRecoveryCandidate } from '../src/platform/saveRecovery';
import { cancelPendingNativeSave, flushNativeSave, queueNativeSave, subscribeNativeSave } from '../src/platform/nativeSave';
import { normalizePet } from '../src/core/petState';
import { claimKitchenStarter, craftRecipe } from '../src/core/kitchen';
import { acknowledgeMiniGameResult, resumeMiniGame, startMiniGame } from '../src/core/miniGames';
import { advancePartnerSchedule, claimPartnerScheduleResult, normalizePartnerScheduleState, partnerScheduleDefinitions } from '../src/core/partnerSchedule';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  private failSetKey: string | undefined;
  private failGetKey: string | undefined;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    if (this.failGetKey === key) {
      this.failGetKey = undefined;
      throw new Error(`Injected storage read failure for ${key}`);
    }
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

  failNextGet(key: string) { this.failGetKey = key; }

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

// Upgrade the pre-kitchen shape directly; do not run the current exporter first.
const preActivitiesPet = { ...basePet, name: 'Before activities', level: 20, coins: 9876, hearts: 5432, inventory: { bento: 2, toy_ball: 3, strawberry_milk: 4, golden_apple: 5, 'creator.snack': 7 } };
const { kitchen: _kitchen, miniGames: _games, companionMemories: _memories, ...legacyActivitiesRaw } = preActivitiesPet;
legacyActivitiesRaw.partnerSchedule = { ...legacyActivitiesRaw.partnerSchedule, schemaVersion: 5 } as unknown as PetState['partnerSchedule'];
const oldEnvelope = (pet: unknown, at = exportAt) => JSON.stringify({ app: pocPetSaveAppId, schemaVersion: 1, exportedAt: new Date(at).toISOString(), pet });
const loadValid = (pet: unknown, at = exportAt) => {
  // Pick coin-only offline events so unrelated random hearts/gifts cannot mask duplicate game rewards.
  const result = loadStoredPetJson(JSON.stringify(pet), at, { neighbors: [], giftCandidates: [], random: () => 0 });
  assert.equal(result.status, 'ok', result.status === 'corrupt' ? result.detail : undefined);
  if (result.status !== 'ok') throw new Error('Upgrade failed');
  return result.pet;
};
for (const loaded of [loadValid(legacyActivitiesRaw), parseSaveFileText(JSON.stringify(legacyActivitiesRaw), importAt).pet, parseSaveFileText(oldEnvelope(legacyActivitiesRaw), importAt).pet]) {
  assert.equal(loaded.level, 20);
  assert.equal(loaded.coins, 9876);
  assert.equal(loaded.hearts, 5432);
  assert.deepEqual(loaded.inventory, preActivitiesPet.inventory, 'old inventory and unknown Mod items survive');
  assert.deepEqual(loaded.kitchen.equipment, ['mix', 'pan']);
  assert.deepEqual(loaded.kitchen.made, {});
  assert.equal(loaded.kitchen.starterClaimed, false);
  assert.ok(loaded.miniGames.unlocked.includes('catch'), 'existing toy balls remain usable for catch');
  assert.equal(loaded.partnerSchedule.schemaVersion, 7);
  const starter = claimKitchenStarter(loaded);
  assert.equal(starter.inventory.rice, 1);
  assert.equal(claimKitchenStarter(starter), starter, 'upgrade does not allow repeated starter claims');
}
for (const badList of [null, {}, { includes: 1 }, 'blender,bubbles', 42]) {
  const loaded = loadValid({ ...preActivitiesPet, kitchen: { equipment: badList }, miniGames: { unlocked: badList } });
  assert.deepEqual(loaded.kitchen.equipment, ['mix', 'pan']);
  assert.deepEqual(loaded.miniGames.unlocked, ['matching', 'catch']);
  assert.equal(loaded.coins, preActivitiesPet.coins, 'a malformed optional list cannot discard the whole pet');
}
const kitchenHistory: PetState = {
  ...preActivitiesPet,
  inventory: { ...preActivitiesPet.inventory, dish_milk_cookies: 5, dish_biscuit_cup: 3, dish_biscuit_layer_cake: 2, rice: 10, egg: 10 },
  kitchen: { ...basePet.kitchen, starterClaimed: true, equipment: ['mix', 'pan', 'blender', 'oven'], made: { egg_rice: 3, milk_cookies: 5 }, firstMadeAt: { egg_rice: exportAt - 60000 }, tasted: { 'official.mint': { dish_milk_cookies: exportAt - 30000 } }, recentOperationIds: ['old-cook'], lastCraft: { id: 'old-cook', dishId: 'dish_egg_rice', quantity: 3, hearts: 120, at: exportAt - 60000 } },
  companionMemories: { schemaVersion: 1, entries: [{ id: 'old-memory', actorId: 'official.mint', kind: 'first_taste', subject: 'dish_milk_cookies', at: exportAt - 30000, mentionedAt: 0 }] },
};
for (const loaded of [loadValid(kitchenHistory), parseSaveFileText(oldEnvelope(kitchenHistory), importAt).pet, parseSaveFileText(createSaveFileText(kitchenHistory, builtinMintManifest, exportAt), importAt).pet]) {
  const { lastCraft: _oldDisplay, ...expectedKitchenProgress } = kitchenHistory.kitchen;
  const { lastCraft: _loadedDisplay, ...loadedKitchenProgress } = loaded.kitchen;
  assert.deepEqual(loadedKitchenProgress, expectedKitchenProgress, 'old recipe IDs, completion receipts, first-made and tasted dates survive');
  assert.deepEqual(loaded.inventory, kitchenHistory.inventory, 'renaming strawberry desserts must not remove their old inventory IDs');
  assert.deepEqual(loaded.companionMemories, kitchenHistory.companionMemories);
  assert.equal(claimKitchenStarter(loaded), loaded);
  assert.equal(craftRecipe(loaded, 'egg_rice', false, 3, 'old-cook', importAt), loaded, 'a loaded cooking result cannot award twice');
}
for (const game of ['matching', 'catch', 'bubbles'] as const) {
  const ready = { ...preActivitiesPet, miniGames: { ...basePet.miniGames, unlocked: ['matching', 'catch', 'bubbles'] as const } } as PetState;
  const started = startMiniGame(ready, game, 'gentle', 'official.mint', `old-${game}`, exportAt);
  const oldGame = { ...started, miniGames: { ...started.miniGames, active: { ...started.miniGames.active!, elapsedMs: 12000, baseHearts: 696 } } };
  for (const loaded of [loadValid(oldGame, importAt), parseSaveFileText(oldEnvelope(oldGame), importAt).pet]) {
    assert.equal(loaded.miniGames.active?.paused, true);
    assert.equal(loaded.miniGames.active?.actorId, 'official.mint');
    assert.equal(loaded.miniGames.active?.elapsedMs, 12000, 'time away never counts as active game time');
    assert.deepEqual(loaded.miniGames.active?.deck, oldGame.miniGames.active.deck);
    assert.equal(loaded.miniGames.active?.baseHearts, game === 'catch' ? 39 : 13, 'unfinished old games use the approved level curve');
    assert.equal(loaded.hearts, started.hearts, 'loading cannot award an unfinished game');
    assert.equal(loaded.inventory.toy_ball, started.inventory.toy_ball);
    assert.equal(resumeMiniGame(loaded, 'official.mint', importAt).inventory.toy_ball, started.inventory.toy_ball, 'the already-paid ball is not charged on resume');
  }
}
const completedGame: PetState = { ...preActivitiesPet, miniGames: { ...basePet.miniGames, lastResult: { id: 'old-result', actorId: 'official.mint', game: 'matching', mode: 'gentle', hearts: 2312, baseHearts: 2312, rewardLevel: 99, score: 6, elapsedMs: 14000, at: exportAt, pending: true } } };
const completedGameLoaded = parseSaveFileText(oldEnvelope(completedGame), importAt).pet;
assert.deepEqual(completedGameLoaded.miniGames.lastResult, { ...completedGame.miniGames.lastResult, mood: undefined, skillXp: undefined }, 'completed rewards keep their historical amount without inventing missing mood or skill rewards');
assert.equal(acknowledgeMiniGameResult(completedGameLoaded, 'old-result').hearts, completedGameLoaded.hearts);

for (const definition of partnerScheduleDefinitions) {
  const oldMinutes = { short: 45, standard: 120, long: 240 }[definition.size];
  const elapsedMinutes = 10;
  const schedule = normalizePartnerScheduleState(undefined, preActivitiesPet, exportAt);
  const active = { offerId: schedule.offers[0].id, templateId: definition.id, category: definition.category, size: definition.size, startedAt: exportAt - elapsedMinutes * 60000, endsAt: exportAt + (oldMinutes - elapsedMinutes) * 60000, coinReward: 77, skillXp: 10, trophyRewardMultiplier: 1, grantsMasterCompletion: false };
  const raw = { ...legacyActivitiesRaw, partnerSchedule: { ...schedule, schemaVersion: 5, active } };
  const newRemaining = (definition.durationMinutes - elapsedMinutes) * 60000;
  const loaded = loadValid(raw);
  assert.equal(loaded.partnerSchedule.active?.endsAt, exportAt + newRemaining);
  const imported = parseSaveFileText(oldEnvelope(raw), importAt).pet;
  assert.equal(imported.partnerSchedule.active?.endsAt, importAt + newRemaining, 'import shifts an old schedule after shortening it once');
  assert.equal(normalizePet(imported, importAt).partnerSchedule.active?.endsAt, importAt + newRemaining);
  const reimported = parseSaveFileText(createSaveFileText(imported, null, importAt), importAt + 3600000).pet;
  assert.equal(reimported.partnerSchedule.active?.endsAt, importAt + 3600000 + newRemaining);
  const pending = advancePartnerSchedule(imported, importAt + newRemaining);
  assert.equal(pending.partnerSchedule.pendingResult?.coinReward, 77);
  const claimed = claimPartnerScheduleResult(pending, 'coins', importAt + newRemaining);
  assert.equal(claimed.coins, pending.coins + 77);
  assert.equal(claimPartnerScheduleResult(claimed, 'coins', importAt + newRemaining).coins, claimed.coins);
  const offline = loadValid(raw, active.endsAt + 60000);
  assert.equal(offline.partnerSchedule.pendingResult?.completedAt, active.endsAt, 'already expired legacy schedules keep their original completion time');
}
console.log('Upgrade compatibility: pre-kitchen raw/envelope saves, malformed optional lists, old dessert IDs, game history and all 12 schedule imports passed.');

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
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').pet.name, 'First');

localStorage.setItem('pocpet.pet.v1', '{}');
const damaged = loadPet(importAt);
assert.equal(damaged.status, 'corrupt');
assert.equal(damaged.status === 'corrupt' ? damaged.backup?.name : undefined, 'First');
assert.equal(getPreservedCorruptPetRaw(), '{}');

const restored = restorePetBackup(importAt);
assert.equal(restored?.name, 'First');
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1') ?? '{}').pet.name, 'First');
assert.equal(getPreservedCorruptPetRaw(), '{}', 'restoring must preserve the damaged original');

savePet(secondPet);
assert.equal(backupCurrentPet(), true);
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').pet.name, 'Second');
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
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1') ?? '{}').pet.name, 'Second');
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1.backup') ?? '{}').pet.name, 'First');
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
assert.equal(decodeSaveSnapshot(localStorage.getItem('pocpet.pet.v1')!).pet.name, 'Second');

localStorage.clear();
const originalUpgradeRaw = JSON.stringify(firstPet);
const previousUpgradeKey = 'pocpet.pet.v1.pre-upgrade.1.7.2';
const previousUpgradeRaw = JSON.stringify({ ...firstPet, name: 'Before 1.7.2' });
assert.notEqual(upgradeStorageKey, previousUpgradeKey, 'this release needs its own upgrade backup');
localStorage.setItem(previousUpgradeKey, previousUpgradeRaw);
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
assert.equal(localStorage.getItem(previousUpgradeKey), previousUpgradeRaw, 'upgrading preserves the earlier release backup byte for byte');
assert.ok(getStoredRecoveryCopies().some((copy) => copy.key === previousUpgradeKey));
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

assert.deepEqual(getEditionFeatures('bilibili'), { cloudSave: true, saveFileDownload: false, rename: false, importMod: false, shareCards: true, shareCustomName: false });
assert.deepEqual(getEditionFeatures('standard'), { cloudSave: false, saveFileDownload: true, rename: true, importMod: true, shareCards: true, shareCustomName: true });
assert.equal(shouldShowEditionNotice({ count: 0, lastLaunch: '' }, 'first'), true);
assert.equal(shouldShowEditionNotice({ count: 1, lastLaunch: 'first' }, 'first'), false);
assert.equal(shouldShowEditionNotice({ count: 3, lastLaunch: 'third' }, 'fourth'), false);
assert.equal(shouldShowEditionNotice({ count: 1, lastLaunch: 'first' }, 'second'), true);
localStorage.setItem('pocpet.edition-notice.1.6', JSON.stringify({ count: 3, lastDate: localDateKey(exportAt) }));
localStorage.setItem('pocpet.edition-notice.1.8.0', JSON.stringify({ count: 3, lastLaunch: 'old-announcement' }));
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

// The native Rust regression uses this same real 1.8 export as its write input.
const nativeFixture: BackupSnapshot = JSON.parse(readFileSync(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url), 'utf8'));
const fixturePet = parseSaveFileText(nativeFixture.text, nativeFixture.savedAt).pet;
assert.equal(fixturePet.name, nativeFixture.petName);
assert.equal(fixturePet.coins, 1234);
assert.equal(fixturePet.inventory.apple, 7);
const previousWindow = globalThis.window;
const nativeHistory = new Map<string, string>();
let nativeLatest: string | null = null;
let failNativeWrite = false;
let nativeWrites = 0;
Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { localStorage, __TAURI_INTERNALS__: {
  invoke: async (command: string, payload?: { snapshot: string }) => {
    if (command === 'read_backup_files') return { files: [...nativeHistory.values()], warnings: [] };
    if (command === 'read_backup_latest') return nativeLatest;
    assert.equal(command, 'write_backup_files');
    if (failNativeWrite) throw new Error('Injected native backup write failure');
    const snapshot: BackupSnapshot = JSON.parse(payload!.snapshot);
    assert.equal(parseSaveFileText(snapshot.text, snapshot.savedAt).formatVersion, 2);
    nativeHistory.set(snapshot.dateKey, payload!.snapshot);
    nativeLatest = snapshot.text;
    nativeWrites++;
  },
} } });
try {
  const initialBackup = await runAutomaticBackup(firstPet, undefined, true);
  assert.equal(initialBackup.error, undefined);
  assert.equal(initialBackup.fileStatus, 'native');
  assert.equal(initialBackup.snapshots.length, 1);
  assert.equal(initialBackup.fileSavedAt, initialBackup.snapshots[0].savedAt);
  await runAutomaticBackup(firstPet);
  assert.equal(nativeWrites, 1, 'scheduled checks skip an already backed-up day');
  const changedPet = { ...firstPet, coins: 9876 };
  const repeated = await runAutomaticBackup(changedPet, undefined, true);
  assert.equal(repeated.snapshots.length, 1);
  assert.equal(parseSaveFileText(repeated.snapshots[0].text).pet.coins, 9876, 'immediate backup refreshes the same day');
  failNativeWrite = true;
  await assert.rejects(runAutomaticBackup(firstPet, undefined, true), /Injected native/);
  assert.deepEqual((await readBackupState()).snapshots, repeated.snapshots, 'a failed write preserves the last recovery point');
  failNativeWrite = false;
  assert.equal((await runAutomaticBackup(firstPet, undefined, true)).error, undefined, 'a failure does not poison the backup queue');
  const writesBeforePause = nativeWrites;
  await runAutomaticBackup(firstPet, undefined, true, () => true);
  assert.equal(nativeWrites, writesBeforePause, 'paused/conflicting saves never write a backup');
} finally { globalThis.window = previousWindow; }

// Android's independent recent saves must survive selective WebView data loss.
const recentNow = Date.now();
const oldPet = createDefaultPet(recentNow - 7 * 86400000);
const progressedPet = { ...oldPet, level: 20, coins: 12345, lastUpdatedAt: recentNow - 1000 };
const oldText = createSaveFileText(oldPet, null, recentNow - 7 * 86400000);
const progressText = createSaveFileText(progressedPet, null, recentNow - 1000);
let recentFiles = [progressText];
const recentWrites: string[] = [];
let recentFailure = false;
let holdRecent: (() => Promise<void>) | undefined;
let holdBackupRead: (() => Promise<void>) | undefined;
let dailyWrites = 0;
let dailyFiles: string[] = [];
let nativeError = '';
const unsubscribeNative = subscribeNativeSave((error) => { nativeError = error; });
Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { localStorage, __TAURI_INTERNALS__: {
  invoke: async (command: string, payload?: { text: string; snapshot: string }) => {
    if (command === 'read_recent_saves') return { files: [...recentFiles], warnings: [] };
    if (command === 'read_backup_files') { await holdBackupRead?.(); return { files: dailyFiles, warnings: [] }; }
    if (command === 'read_backup_latest') return null;
    if (command === 'write_backup_files') { dailyWrites++; return; }
    assert.equal(command, 'write_recent_save');
    await holdRecent?.();
    if (recentFailure) throw new Error('Injected recent save failure');
    recentWrites.push(payload!.text);
    recentFiles = [payload!.text, ...recentFiles].slice(0, 2);
  },
} } });
try {
  localStorage.clear();
  localStorage.setItem('pocpet.pet.v1', oldText);
  const rolledBack = loadPet(recentNow, undefined, undefined, true);
  assert.equal(rolledBack.status, 'ok');
  assert.equal(localStorage.getItem('pocpet.pet.v1'), oldText, 'startup comparison must precede any rewrite of the original primary');
  const recovery = await collectRecoveryCandidates();
  assert.equal(recovery.unavailable, false);
  const newer = findNewerRecovery(oldText, recovery.candidates);
  assert.equal(newer.length, 1);
  assert.equal(newer[0].level, 20, 'valid but rolled-back primary must reveal the newer native save');
  const candidate = (text: string) => ({ ...newer[0], text });
  assert.equal(findNewerRecovery(progressText, [candidate(createSaveFileText(progressedPet, null, recentNow))]).length, 0, 'later export of identical progress is not a rollback');
  assert.equal(findNewerRecovery(progressText, [candidate(createSaveFileText(oldPet, null, recentNow))]).length, 0, 'delayed backup of an older tick is not newer progress');
  assert.equal(findNewerRecovery(oldText, [candidate(createSaveFileText(createDefaultPet(recentNow), null, recentNow))]).length, 0, 'another playthrough must not replace an intentional new game');
  assert.equal(findNewerRecovery(progressText, [candidate(createSaveFileText({ ...progressedPet, coins: 1 }, null, recentNow))]).length, 1, 'newer progress may have spent resources');
  localStorage.setItem('pocpet.pet.v1', JSON.stringify(oldPet));
  loadPet(recentNow, undefined, undefined, true);
  assert.equal(localStorage.getItem('pocpet.pet.v1'), JSON.stringify(oldPet), 'legacy migration is deferred until recovery comparison completes');
  assert.equal(findNewerRecovery(JSON.stringify(oldPet), recovery.candidates).length, 1);
  localStorage.failNextGet('pocpet.pet.v1');
  assert.equal(loadPet(recentNow, undefined, undefined, true).status, 'unavailable');
  assert.ok((await collectRecoveryCandidates()).candidates.some((item) => item.text === progressText), 'a main-store read error must not hide independent recovery points');

  for (const broken of [null, '{"broken":', '{}']) {
    localStorage.clear();
    if (broken !== null) localStorage.setItem('pocpet.pet.v1', broken);
    assert.notEqual(loadPet(recentNow, undefined, undefined, true).status, 'ok');
    const recovered = await collectRecoveryCandidates();
    assert.ok(recovered.candidates.some((item) => item.text === progressText));
    assert.equal(recentFiles[0], progressText, 'damaged primary never overwrites the native original during loading');
  }
  localStorage.clear();
  localStorage.setItem('pocpet.pet.v1', progressText);
  loadPet(recentNow, undefined, undefined, true);
  replacePetFromImport(parseSaveFileText(oldText, recentNow).pet, progressText, null, oldText, recentNow);
  await flushNativeSave();
  assert.equal(findNewerRecovery(localStorage.getItem('pocpet.pet.v1')!, [candidate(progressText)]).length, 0, 'confirmed import becomes the new baseline even if lower level');
  const beforeWriteFailure = [...recentFiles];
  localStorage.failNextSet('pocpet.pet.v1');
  assert.throws(() => savePet(progressedPet), /Injected storage failure/);
  await flushNativeSave();
  assert.deepEqual(recentFiles, beforeWriteFailure, 'failed local commits are not mirrored as successful native saves');
  const beforeConflict = recentWrites.length;
  savePet(progressedPet, false);
  localStorage.setItem('pocpet.pet.v1', oldText);
  await flushNativeSave();
  assert.equal(recentWrites.length, beforeConflict, 'a checkpoint must not overwrite native data after another page changes the primary');
  loadPet(recentNow, undefined, undefined, true);

  let releaseWrite!: () => void;
  let enteredWrite!: () => void;
  const startedWrite = new Promise<void>((resolve) => { enteredWrite = resolve; });
  const blockedWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
  holdRecent = () => { enteredWrite(); return blockedWrite; };
  queueNativeSave(oldText);
  await startedWrite;
  const writeStart = recentWrites.length;
  queueNativeSave(progressText);
  const newestText = createSaveFileText({ ...progressedPet, coins: 999 }, null, recentNow + 1);
  queueNativeSave(newestText);
  releaseWrite();
  await flushNativeSave();
  holdRecent = undefined;
  assert.deepEqual(recentWrites.slice(writeStart), [oldText, newestText], 'overlapping requests serialize and coalesce to the latest state');
  recentFailure = true;
  queueNativeSave(progressText);
  await flushNativeSave();
  assert.ok(nativeError);
  assert.equal(recentFiles[0], newestText);
  recentFailure = false;
  await flushNativeSave();
  assert.equal(nativeError, '');
  assert.equal(recentFiles[0], progressText, 'retry retains and persists the failed pending save');
  queueNativeSave(oldText, false);
  cancelPendingNativeSave();
  await flushNativeSave();
  assert.equal(recentFiles[0], progressText, 'reset discards an unstarted checkpoint');

  let releaseCancelled!: () => void;
  let enteredCancelled!: () => void;
  const cancelledStarted = new Promise<void>((resolve) => { enteredCancelled = resolve; });
  const cancelledWrite = new Promise<void>((resolve) => { releaseCancelled = resolve; });
  holdRecent = async () => { enteredCancelled(); await cancelledWrite; holdRecent = undefined; throw new Error('Cancelled generation failed late'); };
  queueNativeSave(oldText);
  await cancelledStarted;
  cancelPendingNativeSave();
  queueNativeSave(progressText);
  releaseCancelled();
  await flushNativeSave();
  assert.equal(nativeError, '', 'a late failure from the old playthrough must not block the imported save');
  assert.equal(recentFiles[0], progressText);

  let releaseRead!: () => void;
  let enteredRead!: () => void;
  const startedRead = new Promise<void>((resolve) => { enteredRead = resolve; });
  const blockedRead = new Promise<void>((resolve) => { releaseRead = resolve; });
  holdBackupRead = () => { enteredRead(); return blockedRead; };
  const queuedBackup = runAutomaticBackup(progressedPet, undefined, true);
  await startedRead;
  replacePetFromImport(parseSaveFileText(oldText, recentNow).pet, progressText, null, oldText, recentNow);
  releaseRead();
  await queuedBackup;
  await flushNativeSave();
  holdBackupRead = undefined;
  assert.equal(dailyWrites, 0, 'a backup started before import must not overwrite history after import commits');

  localStorage.clear();
  recentFiles = ['{bad'];
  loadPet(recentNow, undefined, undefined, true);
  const damagedRecent = await collectRecoveryCandidates();
  assert.equal(damagedRecent.candidates.length, 0);
  assert.ok(damagedRecent.warnings.length, 'unreadable independent copies must not silently become a new game');
  const future = JSON.parse(progressText);
  future.schemaVersion = 3;
  recentFiles = [JSON.stringify(future)];
  assert.equal((await collectRecoveryCandidates()).unavailable, true, 'unknown newer native formats block automatic overwrite');
  recentFiles = [];
  dailyFiles = [JSON.stringify({ dateKey: localDateKey(recentNow), savedAt: recentNow, text: JSON.stringify(future) })];
  assert.equal((await collectRecoveryCandidates()).unavailable, true, 'unknown newer daily formats must not be silently discarded');
  await assert.rejects(runAutomaticBackup(progressedPet, undefined, true), UnsupportedSaveVersionError);
  assert.equal(dailyWrites, 0, 'older clients cannot overwrite a future-format daily backup');
} finally {
  cancelPendingNativeSave();
  await flushNativeSave();
  unsubscribeNative();
  globalThis.window = previousWindow;
}

console.log('Save validation, backup recovery, and import timing checks passed.');
