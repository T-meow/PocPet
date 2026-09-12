import { type NeighborEventContext, type PetState } from './pet';
import { checksumText, createSaveFileText, decodeSaveSnapshot, loadStoredPetJson, readActiveModSummary, UnsupportedSaveVersionError, type SaveFailureStage, type PocPetSaveModSummary } from './saveCodec';
import { migrationCompensationItems, prepareMigrationCompensation, type MigrationItemId, type SaveMetadata } from './saveMetadata';
import { applyLocalPetPreferences, persistPetPreferences } from './petPreferences';
import { t } from '../i18n';
import { getStoredPetModManifest } from './modStorage';
import { appBuild } from '../platform/edition';

const storageKey = 'pocpet.pet.v1';
const backupStorageKey = 'pocpet.pet.v1.backup';
const importBackupStorageKey = 'pocpet.pet.v1.import-backup';
const corruptStorageKey = 'pocpet.pet.v1.corrupt';
const identityStorageKey = 'pocpet.pet.v1.identity';
export const formatBackupStoragePrefix = 'pocpet.pet.v1.pre-format-v2.';
export const migrationLedgerStorageKey = 'pocpet.save-v2.migrations';
const storageFeedback: string[] = [];
export const takeStorageFeedback = () => storageFeedback.splice(0);
export const upgradeStorageKey = `pocpet.pet.v1.pre-upgrade.${appBuild.version}`;
let expectedRaw: string | null | undefined;
let persistedIdentity: PocPetSaveModSummary | undefined;
let lastRollingBackupAt = 0;
let upgradeBackupBlocked = false;
let unsupportedSaveBlocked = false;

export type PetStorageLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState; persistenceError?: 'upgradeBackup' }
  | { status: 'unavailable'; stage: 'storage'; detail: string }
  | { status: 'corrupt'; raw: string; backup: PetState | null; stage: SaveFailureStage; detail?: string };

const isValidStoredPetRaw = (raw: string) => {
  try {
    decodeSaveSnapshot(raw);
    return true;
  } catch {
    return false;
  }
};

const preserveCorruptRaw = (raw: string) => {
  try {
    writeRecoveryCopy(corruptStorageKey, raw, getStoredSaveIdentity());
  } catch {
    // Keep the primary key untouched when storage is unavailable or full.
  }
};

export const hasStoredPet = () => window.localStorage.getItem(storageKey) !== null;

export const loadPet = (now = Date.now(), eventContext?: NeighborEventContext, fallbackName?: string): PetStorageLoadResult => {
  upgradeBackupBlocked = false;
  unsupportedSaveBlocked = false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    expectedRaw = raw;
    persistedIdentity = getStoredSaveIdentity();
    const result = loadStoredPetJson(raw, now, eventContext, fallbackName ?? persistedIdentity?.defaultPetName);
    if (result.status === 'ok') {
      try {
        const identity = getStoredSaveIdentity();
        // Capture legacy identity before a later import or role change alters the library.
        if (window.localStorage.getItem(identityStorageKey) === null) {
          for (const key of [backupStorageKey, upgradeStorageKey, corruptStorageKey]) {
            const copy = window.localStorage.getItem(key);
            if (copy && window.localStorage.getItem(`${key}.identity`) === null) writeRecoveryCopy(key, copy, identity);
          }
        }
        if (window.localStorage.getItem(upgradeStorageKey) === null) writeRecoveryCopy(upgradeStorageKey, raw!, identity);
        if (window.localStorage.getItem(identityStorageKey) === null) setStoredSaveIdentity(identity);
        preserveLegacyFormat(raw!, identity);
      } catch {
        // The primary is valid: allow viewing/export, but never overwrite its unpreserved bytes.
        upgradeBackupBlocked = true;
        return { ...result, persistenceError: 'upgradeBackup' };
      }
      const restored = applyLocalPetPreferences(result.pet);
      if (result.formatVersion !== 2 || restored.saveMetadata.compensation === 'pending') {
        try { return { ...result, pet: persistCurrentPet(restored, getStoredSaveIdentity(), now) }; }
        catch { upgradeBackupBlocked = true; return { ...result, pet: restored, persistenceError: 'upgradeBackup' }; }
      }
      return { ...result, pet: restored };
    }
    if (result.status === 'corrupt' && result.stage === 'version') {
      unsupportedSaveBlocked = true;
      return { ...result, backup: null };
    }
    const backupResult = loadStoredPetJson(window.localStorage.getItem(backupStorageKey), now, eventContext, fallbackName);
    if (result.status === 'missing' && backupResult.status !== 'ok') return result;
    if (result.status === 'corrupt') preserveCorruptRaw(result.raw);
    return {
      status: 'corrupt', raw: raw ?? '',
      stage: result.status === 'corrupt' ? result.stage : 'storage',
      detail: result.status === 'corrupt' ? result.detail : undefined,
      backup: backupResult.status === 'ok' ? backupResult.pet : null,
    };
  } catch (error) {
    return { status: 'unavailable', stage: 'storage', detail: String(error) };
  }
};

export const getStoredSaveIdentity = (): PocPetSaveModSummary | undefined => {
  try {
    const raw = window.localStorage.getItem(identityStorageKey);
    if (raw !== null) return readActiveModSummary(JSON.parse(raw));
    const primary = window.localStorage.getItem(storageKey);
    if (primary) {
      try { const embedded = decodeSaveSnapshot(primary).activeMod; if (embedded) return embedded; } catch { /* Legacy data may use the existing Mod library. */ }
    }
    return readActiveModSummary(getStoredPetModManifest());
  } catch { return undefined; }
};
export const setStoredSaveIdentity = (identity?: PocPetSaveModSummary) => {
  assertStorageUnchanged();
  window.localStorage.setItem(identityStorageKey, JSON.stringify(identity ?? null));
};
const readRecoveryIdentity = (key: string, raw: string): PocPetSaveModSummary | undefined => {
  try {
    const metadata = window.localStorage.getItem(`${key}.identity`);
    if (metadata === null) {
      return window.localStorage.getItem(identityStorageKey) === null ? getStoredSaveIdentity() : undefined;
    }
    const stored = JSON.parse(metadata);
    return stored?.checksum === checksumText(raw) ? readActiveModSummary(stored.activeMod) : undefined;
  } catch { return undefined; }
};
const writeRecoveryCopy = (key: string, raw: string, identity?: PocPetSaveModSummary) => {
  const metadataKey = `${key}.identity`;
  const previousRaw = window.localStorage.getItem(key);
  const previousMetadata = window.localStorage.getItem(metadataKey);
  try {
    window.localStorage.setItem(metadataKey, JSON.stringify({ checksum: checksumText(raw), activeMod: identity ?? null }));
    window.localStorage.setItem(key, raw);
  } catch (error) {
    try {
      restoreStorageValue(key, previousRaw);
      restoreStorageValue(metadataKey, previousMetadata);
    } catch { /* A mismatched sidecar is ignored when reading recovery points. */ }
    throw error;
  }
};
const preserveLegacyFormat = (raw: string, identity?: PocPetSaveModSummary) => {
  const decoded = decodeSaveSnapshot(raw);
  if (decoded.formatVersion === 2) return;
  const firstKey = formatBackupStoragePrefix + decoded.pet.saveMetadata.id;
  const firstCopy = window.localStorage.getItem(firstKey);
  const key = firstCopy === null || firstCopy === raw ? firstKey : `${firstKey}.${checksumText(raw)}`;
  const existing = window.localStorage.getItem(key);
  if (existing === null) writeRecoveryCopy(key, raw, identity ?? decoded.activeMod);
  else if (existing !== raw) throw new Error('Conflicting original save backup.');
};

const persistCurrentPet = (pet: PetState, identity?: PocPetSaveModSummary, now = Date.now()): PetState => {
  const previousRaw = window.localStorage.getItem(storageKey);
  const previousLedger = window.localStorage.getItem(migrationLedgerStorageKey);
  const ledger: Record<string, true | { delivered: SaveMetadata['pendingItems'] }> = Object.create(null);
  if (previousLedger) {
    const parsed: unknown = JSON.parse(previousLedger);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid save migration record.');
    for (const [id, value] of Object.entries(parsed)) {
      if (value === true) { ledger[id] = true; continue; }
      if (!value || typeof value !== 'object' || !value.delivered || typeof value.delivered !== 'object') throw new Error('Invalid save migration record.');
      const delivered: SaveMetadata['pendingItems'] = {};
      for (const itemId of Object.keys(migrationCompensationItems) as MigrationItemId[]) {
        const amount: unknown = value.delivered[itemId];
        if (!Number.isInteger(amount) || (amount as number) < 0 || (amount as number) > migrationCompensationItems[itemId]) throw new Error('Invalid save migration record.');
        delivered[itemId] = amount as number;
      }
      ledger[id] = { delivered };
    }
  }
  const record = ledger[pet.saveMetadata.id];
  const prepared = prepareMigrationCompensation(pet, record === true ? migrationCompensationItems : record?.delivered);
  const next = prepared.pet;
  const raw = createSaveFileText(next, identity, now);
  const nextLedger = prepared.delivered ? JSON.stringify({ ...ledger, [next.saveMetadata.id]: { delivered: prepared.delivered } }) : previousLedger;
  try {
    window.localStorage.setItem(storageKey, raw);
    if (nextLedger !== previousLedger && nextLedger !== null) window.localStorage.setItem(migrationLedgerStorageKey, nextLedger);
  } catch (error) {
    try { restoreStorageValue(storageKey, previousRaw); restoreStorageValue(migrationLedgerStorageKey, previousLedger); } catch { /* Retain recovery copies and the original error. */ }
    throw error;
  }
  expectedRaw = raw;
  persistedIdentity = identity;
  persistPetPreferences(next);
  if (Object.keys(prepared.granted).length) {
    storageFeedback.push(t('pet.reward.saveMigrationGift', { biscuits: prepared.granted.emergency_biscuit ?? 0, milk: prepared.granted.strawberry_milk ?? 0 })
      + (Object.keys(next.saveMetadata.pendingItems).length ? t('pet.reward.saveMigrationPending') : ''));
  } else if (pet.saveMetadata.compensation === 'pending' && Object.keys(next.saveMetadata.pendingItems).length) storageFeedback.push(t('pet.reward.saveMigrationPending'));
  return next;
};

const recoveryStorageKeys = () => {
  const keys = new Set([backupStorageKey, upgradeStorageKey, corruptStorageKey]);
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key && (/^pocpet\.pet\.v1\.pre-upgrade\.\d+\.\d+\.\d+$/.test(key) || (key.startsWith(formatBackupStoragePrefix) && !key.endsWith('.identity')))) keys.add(key);
    }
  } catch { /* Known keys and independent backup stores can still be checked. */ }
  return [...keys];
};
export const getStoredRecoveryCopies = () => recoveryStorageKeys()
  .flatMap((key) => {
    try { const raw = window.localStorage.getItem(key); return raw ? [{ key, raw, activeMod: readRecoveryIdentity(key, raw) }] : []; } catch { return []; }
  });
export const assertStorageUnchanged = () => {
  if (unsupportedSaveBlocked) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  if (upgradeBackupBlocked) throw new Error('upgrade-backup-blocked');
  const raw = window.localStorage.getItem(storageKey);
  if (expectedRaw !== undefined && raw !== expectedRaw) throw new Error('storage-conflict');
};

export const backupCurrentPet = () => {
  assertStorageUnchanged();
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null || !isValidStoredPetRaw(raw)) return false;
  // Role selection may change before React writes the corresponding next pet state.
  writeRecoveryCopy(backupStorageKey, raw, expectedRaw === undefined ? getStoredSaveIdentity() : persistedIdentity);
  return true;
};

export const saveImportBackup = (saveText: string) => {
  assertStorageUnchanged();
  window.localStorage.setItem(importBackupStorageKey, saveText);
};

export const getImportBackup = () => window.localStorage.getItem(importBackupStorageKey);

export const savePet = (pet: PetState) => {
  assertStorageUnchanged();
  const previous = window.localStorage.getItem(storageKey);
  if (previous) preserveLegacyFormat(previous, persistedIdentity);
  try {
    if (Date.now() - lastRollingBackupAt >= 5 * 60_000 && backupCurrentPet()) lastRollingBackupAt = Date.now();
  } catch {
    // A failed backup must not block the primary atomic localStorage write.
  }
  return persistCurrentPet(pet, getStoredSaveIdentity());
};

const restoreStorageValue = (key: string, value: string | null) => {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
};

export const replacePetFromImport = (pet: PetState, importBackupText: string, identity?: PocPetSaveModSummary | null, sourceText?: string, now = Date.now()) => {
  assertStorageUnchanged();
  const previousPrimary = window.localStorage.getItem(storageKey);
  const previousBackup = window.localStorage.getItem(backupStorageKey);
  const previousBackupIdentity = window.localStorage.getItem(`${backupStorageKey}.identity`);
  const previousImportBackup = window.localStorage.getItem(importBackupStorageKey);
  const previousIdentity = window.localStorage.getItem(identityStorageKey);
  const previousMod = expectedRaw === undefined ? getStoredSaveIdentity() : persistedIdentity;
  if (previousPrimary && isValidStoredPetRaw(previousPrimary)) preserveLegacyFormat(previousPrimary, previousMod);
  if (sourceText) preserveLegacyFormat(sourceText, identity ?? undefined);

  try {
    window.localStorage.setItem(importBackupStorageKey, importBackupText);
    if (previousPrimary !== null && isValidStoredPetRaw(previousPrimary)) {
      writeRecoveryCopy(backupStorageKey, previousPrimary, previousMod);
    }
    if (identity !== undefined) setStoredSaveIdentity(identity ?? undefined);
    return persistCurrentPet(applyLocalPetPreferences(pet), identity === undefined ? getStoredSaveIdentity() : identity ?? undefined, now);
  } catch (error) {
    try {
      restoreStorageValue(storageKey, previousPrimary);
      restoreStorageValue(backupStorageKey, previousBackup);
      restoreStorageValue(`${backupStorageKey}.identity`, previousBackupIdentity);
      restoreStorageValue(importBackupStorageKey, previousImportBackup);
      restoreStorageValue(identityStorageKey, previousIdentity);
    } catch {
      // Preserve the original write error; callers keep the in-memory pet unchanged.
    }
    throw error;
  }
};

export const restorePetBackup = (now = Date.now(), eventContext?: NeighborEventContext): PetState | null => {
  assertStorageUnchanged();
  const backupRaw = window.localStorage.getItem(backupStorageKey);
  const identity = backupRaw ? readRecoveryIdentity(backupStorageKey, backupRaw) : undefined;
  const result = loadStoredPetJson(backupRaw, now, eventContext, identity?.defaultPetName);
  if (result.status !== 'ok' || backupRaw === null) return null;

  const primaryRaw = window.localStorage.getItem(storageKey);
  if (primaryRaw !== null && !isValidStoredPetRaw(primaryRaw)) preserveCorruptRaw(primaryRaw);
  return replacePetFromImport(result.pet, primaryRaw ?? '', identity ?? null, backupRaw, now);
};

export const getPreservedCorruptPetRaw = () => window.localStorage.getItem(corruptStorageKey);

export const clearPet = () => {
  assertStorageUnchanged();
  window.localStorage.removeItem(storageKey);
  expectedRaw = null;
  persistedIdentity = undefined;
  window.localStorage.removeItem(backupStorageKey);
  window.localStorage.removeItem(`${backupStorageKey}.identity`);
  window.localStorage.removeItem(importBackupStorageKey);
  window.localStorage.removeItem(identityStorageKey);
};
