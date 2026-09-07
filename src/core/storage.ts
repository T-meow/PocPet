import { normalizePet, type NeighborEventContext, type PetState } from './pet';
import { checksumText, hasLegacyPetSaveFingerprint, loadStoredPetJson, readActiveModSummary, type SaveFailureStage, type PocPetSaveModSummary } from './saveCodec';
import { getStoredPetModManifest } from './modStorage';
import { appBuild } from '../platform/edition';

const storageKey = 'pocpet.pet.v1';
const backupStorageKey = 'pocpet.pet.v1.backup';
const importBackupStorageKey = 'pocpet.pet.v1.import-backup';
const corruptStorageKey = 'pocpet.pet.v1.corrupt';
const identityStorageKey = 'pocpet.pet.v1.identity';
export const upgradeStorageKey = `pocpet.pet.v1.pre-upgrade.${appBuild.version}`;
let expectedRaw: string | null | undefined;
let persistedIdentity: PocPetSaveModSummary | undefined;
let lastRollingBackupAt = 0;
let upgradeBackupBlocked = false;

export type PetStorageLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState; persistenceError?: 'upgradeBackup' }
  | { status: 'unavailable'; stage: 'storage'; detail: string }
  | { status: 'corrupt'; raw: string; backup: PetState | null; stage: SaveFailureStage; detail?: string };

const isValidStoredPetRaw = (raw: string) => {
  try {
    return hasLegacyPetSaveFingerprint(JSON.parse(raw));
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
      } catch {
        // The primary is valid: allow viewing/export, but never overwrite its unpreserved bytes.
        upgradeBackupBlocked = true;
        return { ...result, persistenceError: 'upgradeBackup' };
      }
      return result;
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
    return raw === null ? readActiveModSummary(getStoredPetModManifest()) : readActiveModSummary(JSON.parse(raw));
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
const recoveryStorageKeys = () => {
  const keys = new Set([backupStorageKey, upgradeStorageKey, corruptStorageKey]);
  try {
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key && /^pocpet\.pet\.v1\.pre-upgrade\.\d+\.\d+\.\d+$/.test(key)) keys.add(key);
    }
  } catch { /* Known keys and independent backup stores can still be checked. */ }
  return [...keys];
};
export const getStoredRecoveryCopies = () => recoveryStorageKeys()
  .flatMap((key) => {
    try { const raw = window.localStorage.getItem(key); return raw ? [{ key, raw, activeMod: readRecoveryIdentity(key, raw) }] : []; } catch { return []; }
  });
export const assertStorageUnchanged = () => {
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
  try {
    if (Date.now() - lastRollingBackupAt >= 5 * 60_000 && backupCurrentPet()) lastRollingBackupAt = Date.now();
  } catch {
    // A failed backup must not block the primary atomic localStorage write.
  }
  const raw = JSON.stringify(normalizePet(pet));
  window.localStorage.setItem(storageKey, raw);
  expectedRaw = raw;
  persistedIdentity = getStoredSaveIdentity();
};

const restoreStorageValue = (key: string, value: string | null) => {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
};

export const replacePetFromImport = (pet: PetState, importBackupText: string, identity?: PocPetSaveModSummary | null) => {
  assertStorageUnchanged();
  const previousPrimary = window.localStorage.getItem(storageKey);
  const previousBackup = window.localStorage.getItem(backupStorageKey);
  const previousBackupIdentity = window.localStorage.getItem(`${backupStorageKey}.identity`);
  const previousImportBackup = window.localStorage.getItem(importBackupStorageKey);
  const previousIdentity = window.localStorage.getItem(identityStorageKey);
  const previousMod = expectedRaw === undefined ? getStoredSaveIdentity() : persistedIdentity;
  const nextPrimary = JSON.stringify(normalizePet(pet));

  try {
    window.localStorage.setItem(importBackupStorageKey, importBackupText);
    if (previousPrimary !== null && isValidStoredPetRaw(previousPrimary)) {
      writeRecoveryCopy(backupStorageKey, previousPrimary, previousMod);
    }
    if (identity !== undefined) setStoredSaveIdentity(identity ?? undefined);
    window.localStorage.setItem(storageKey, nextPrimary);
    expectedRaw = nextPrimary;
    persistedIdentity = getStoredSaveIdentity();
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
  const previousIdentity = window.localStorage.getItem(identityStorageKey);
  try {
    setStoredSaveIdentity(identity);
    window.localStorage.setItem(storageKey, backupRaw);
  } catch (error) {
    restoreStorageValue(identityStorageKey, previousIdentity);
    throw error;
  }
  expectedRaw = backupRaw;
  persistedIdentity = identity;
  return result.pet;
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
