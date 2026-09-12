import { advancePet, normalizePet, defaultPetName, type NeighborEventContext, type PetState } from './pet';
import { rebasePetFutureCalendarState, shiftPetRuntimeTimestamps } from './gameClock';
import { appBuild } from '../platform/edition';
import { t } from '../i18n';
import { isSaveMetadata, normalizeSaveMetadata } from './saveMetadata';
import { hydratePersistedPet, persistentPetKeys, toPersistedPet, type PersistedPetStateV2 } from './persistedPet';
export type { PersistedPetStateV2 } from './persistedPet';

export const saveFileSchemaVersion = 2;
export const minimumSaveReaderVersion = '1.8.0';
export class UnsupportedSaveVersionError extends Error {}
class InvalidSaveSyntaxError extends Error {}
export const pocPetSaveAppId = 'PocPet' as const;
export const mintSaveAppId = 'Pocpet-Mint' as const;
export type PocPetSaveAppId = typeof pocPetSaveAppId | typeof mintSaveAppId;

const appId = pocPetSaveAppId;
const supportedSaveAppIds: readonly PocPetSaveAppId[] = [pocPetSaveAppId, mintSaveAppId];
const protectedSavePrefix = 'POCPET-SAVE-v2:';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface PocPetSaveModSummary {
  id: string;
  name: string;
  version: string;
  defaultPetName?: string;
}

export interface PocPetSaveFileV1 {
  schemaVersion: 1;
  app: typeof appId;
  exportedAt: string;
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
}

export interface SaveMigrationResult {
  formatVersion: 0 | 1 | 2;
  requiresMigration: boolean;
}

export interface PocPetImportedSave extends SaveMigrationResult {
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
  exportedAt?: string;
  sourceApp?: PocPetSaveAppId;
  source: 'envelope' | 'legacy';
}

export interface PocPetSaveFileV2 {
  schemaVersion: 2;
  app: typeof appId;
  minimumReaderVersion: string;
  exportedAt: string;
  pet: PersistedPetStateV2;
  activeMod?: PocPetSaveModSummary;
}

export type StoredPetJsonLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState; formatVersion: 0 | 1 | 2 }
  | { status: 'corrupt'; raw: string; stage: SaveFailureStage; detail?: string };

export type SaveFailureStage = 'parse' | 'validation' | 'migration' | 'simulation' | 'storage' | 'version';
export const repairPetName = (value: unknown, fallbackName = defaultPetName) =>
  typeof value === 'string' && value.trim() ? value :
    typeof fallbackName === 'string' && fallbackName.trim() ? fallbackName : defaultPetName;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isSupportedSaveAppId = (value: unknown): value is PocPetSaveAppId =>
  supportedSaveAppIds.some((candidate) => candidate === value);

const legacyNumericFields = [
  'level',
  'hunger',
  'mood',
  'cleanliness',
  'energy',
  'health',
  'coins',
  'hearts',
  'lastUpdatedAt',
] as const;

// These fields have all existed since 1.0.1. Requiring the stable fingerprint
// keeps old raw saves importable without treating arbitrary JSON as a pet.
export const hasLegacyPetSaveFingerprint = (value: unknown): value is Record<string, unknown> => {
  if (!isObject(value)) return false;
  if (typeof value.recentEvent !== 'string') return false;
  if (typeof value.isSleeping !== 'boolean') return false;
  if (!isObject(value.inventory) || !isObject(value.actionStreak) || !isObject(value.pomodoro)) return false;
  return legacyNumericFields.every((field) => isFiniteNumber(value[field]));
};

const readSummaryString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
};

export const readActiveModSummary = (value: unknown): PocPetSaveModSummary | undefined => {
  if (!isObject(value)) return undefined;
  const id = readSummaryString(value.id, 64);
  const name = readSummaryString(value.name, 48);
  const version = readSummaryString(value.version, 32);
  return id && name && version ? { id, name, version, defaultPetName: readSummaryString(value.defaultPetName, 32) } : undefined;
};

const readEnvelopeExportedAt = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Save file is missing its export time.');
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error('Save file has an invalid export time.');
  }
  return { exportedAt: value, timestamp };
};

const base64UrlToBytes = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const checksumText = (text: string) => {
  const bytes = textEncoder.encode(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const getProtectedSaveKey = (saveAppId: PocPetSaveAppId) => `${saveAppId}:save-file:v2`;

const transformSaveBytes = (bytes: Uint8Array, saveAppId: PocPetSaveAppId) => {
  const keyBytes = textEncoder.encode(getProtectedSaveKey(saveAppId));
  const output = new Uint8Array(bytes.length);
  let state = 0x6d2b79f5;

  for (let index = 0; index < keyBytes.length; index += 1) {
    state = (Math.imul(state ^ keyBytes[index], 1664525) + 1013904223) >>> 0;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    state = (Math.imul(state + index + keyBytes[index % keyBytes.length], 1664525) + 1013904223) >>> 0;
    output[index] = bytes[index] ^ (state & 0xff) ^ keyBytes[index % keyBytes.length];
  }

  return output;
};

const unprotectSaveFileText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith(protectedSavePrefix)) return { plainText: trimmed };

  const body = trimmed.slice(protectedSavePrefix.length);
  const separatorIndex = body.indexOf(':');
  if (separatorIndex <= 0) throw new Error('Save text is damaged.');

  const expectedChecksum = body.slice(0, separatorIndex).toLowerCase();
  const payload = body.slice(separatorIndex + 1);
  if (!/^[0-9a-f]{8}$/.test(expectedChecksum) || !payload) throw new Error('Save text is damaged.');

  let protectedBytes: Uint8Array;
  try {
    protectedBytes = base64UrlToBytes(payload);
  } catch {
    throw new Error('Save text could not be decoded.');
  }

  for (const protectedApp of supportedSaveAppIds) {
    const plainText = textDecoder.decode(transformSaveBytes(protectedBytes, protectedApp));
    if (checksumText(plainText) === expectedChecksum) return { plainText, protectedApp };
  }

  throw new Error('Save text checksum does not match.');
};

export const createSaveFilePlainText = (pet: PetState, activeMod?: PocPetSaveModSummary | null, now = Date.now()) => {
  const file: PocPetSaveFileV2 = {
    schemaVersion: saveFileSchemaVersion,
    app: appId,
    minimumReaderVersion: minimumSaveReaderVersion,
    exportedAt: new Date(now).toISOString(),
    pet: toPersistedPet(pet, now),
    activeMod: activeMod
      ? {
          id: activeMod.id,
          name: activeMod.name,
          version: activeMod.version,
          defaultPetName: activeMod.defaultPetName,
        }
      : undefined,
  };

  return JSON.stringify(file);
};

export const createSaveFileText = (pet: PetState, activeMod?: PocPetSaveModSummary | null, now = Date.now()) =>
  createSaveFilePlainText(pet, activeMod, now);

const assertSupportedV2 = (parsed: Record<string, unknown>, rawPet: Record<string, unknown>) => {
  if (Object.keys(parsed).some((key) => !['schemaVersion', 'app', 'minimumReaderVersion', 'exportedAt', 'pet', 'activeMod'].includes(key))) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  const minimum = parsed.minimumReaderVersion;
  if (typeof minimum !== 'string' || !/^\d+\.\d+\.\d+$/.test(minimum)) throw new Error('Save file has an invalid minimum reader version.');
  const required = minimum.split('.').map(Number);
  const current = appBuild.version.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (required[index] > current[index]) throw new UnsupportedSaveVersionError(t('ui.settings.save.requiresVersion', { version: minimum }));
    if (required[index] < current[index]) break;
  }
  const supportedModules: Record<string, number> = { garden: 4, goldenAppleGacha: 4, partnerSchedule: 6, boostCards: 2, classicEndgame: 2, timeGuard: 1, kitchen: 1, miniGames: 1, companionMemories: 1 };
  for (const [key, maximum] of Object.entries(supportedModules)) {
    const module = rawPet[key];
    if (isObject(module) && typeof module.schemaVersion === 'number' && module.schemaVersion > maximum) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  }
  if (Object.keys(rawPet).some((key) => !(persistentPetKeys as readonly string[]).includes(key))) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  if (!isSaveMetadata(rawPet.saveMetadata)) throw new Error('Save file has invalid save identity.');
};

const resetImportedTimeBaseline = (pet: PetState, now: number, savedAt: number): PetState => {
  const sourceNow = Number.isFinite(savedAt) && savedAt >= 0 ? savedAt : now;
  const sourceNormalized = normalizePet(pet, sourceNow, { preserveExpiredPartnerSchedule: true });
  const normalized = normalizePet(
    rebasePetFutureCalendarState(
      shiftPetRuntimeTimestamps(sourceNormalized, now - sourceNow),
      now,
    ),
    now,
    { preserveExpiredPartnerSchedule: true },
  );
  const pomodoroPhaseDurationMs = (
    normalized.pomodoro.phase === 'focus'
      ? normalized.pomodoro.settings.focusMinutes
      : normalized.pomodoro.settings.shortBreakMinutes
  ) * 60 * 1000;
  const pomodoro = normalized.pomodoro.isRunning
    ? {
        ...normalized.pomodoro,
        isRunning: false,
        phaseStartedAt: 0,
        phaseEndsAt: 0,
        pausedRemainingMs: Math.min(
          pomodoroPhaseDurationMs,
          Math.max(0, normalized.pomodoro.phaseEndsAt - now),
        ),
      }
    : normalized.pomodoro;

  return {
    ...normalized,
    lastUpdatedAt: now,
    lastEnergyRecoveryAt: now,
    sleepStartedAt: normalized.isSleeping ? now : 0,
    sleepStartMood: normalized.isSleeping ? normalized.mood : 0,
    sleepStartHunger: normalized.isSleeping ? normalized.hunger : 0,
    sleepStartCleanliness: normalized.isSleeping ? normalized.cleanliness : 0,
    lastDreamTalkAt: normalized.isSleeping ? 0 : normalized.lastDreamTalkAt,
    recentActivityUntil: 0,
    lastInteractionAt: now,
    lastPetInteractionAt: now,
    lastDailyEncounterAt: now,
    actionStreak: {
      key: 'none',
      count: 0,
      windowStartedAt: now,
      lastAt: 0,
    },
    pomodoro,
    timeGuard: {
      ...normalized.timeGuard,
      lastObservedAt: now,
    },
  };
};

export const decodeSaveSnapshot = (text: string, fallbackName?: string): PocPetImportedSave => {
  let parsed: unknown;
  let protectedApp: PocPetSaveAppId | undefined;
  try {
    const unprotected = unprotectSaveFileText(text);
    parsed = JSON.parse(unprotected.plainText);
    protectedApp = unprotected.protectedApp;
  } catch {
    throw new InvalidSaveSyntaxError('Save text is not valid PocPet save data.');
  }

  if (!isObject(parsed)) {
    throw new Error('Save text must be a JSON object.');
  }

  if (parsed.app !== undefined || parsed.schemaVersion !== undefined) {
    if (!isSupportedSaveAppId(parsed.app)) throw new Error('This is not a supported PocPet save file.');
    const sourceApp = parsed.app;
    if (protectedApp && protectedApp !== sourceApp) {
      throw new Error('Save protection does not match its app identifier.');
    }
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== saveFileSchemaVersion) {
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > saveFileSchemaVersion) {
        throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
      }
      throw new Error('Unsupported save file version.');
    }
    if (!isObject(parsed.pet)) throw new Error('Save file has invalid pet data.');
    if (parsed.schemaVersion === 2) assertSupportedV2(parsed, parsed.pet);
    const rawPet = parsed.schemaVersion === 2 ? hydratePersistedPet(parsed.pet) : parsed.pet;
    if (!hasLegacyPetSaveFingerprint(rawPet)) throw new Error('Save file has invalid pet data.');
    const { exportedAt } = readEnvelopeExportedAt(parsed.exportedAt);
    const activeMod = parsed.activeMod === undefined ? undefined : readActiveModSummary(parsed.activeMod);
    if (parsed.activeMod !== undefined && !activeMod) throw new Error('Save file has invalid Mod information.');
    return {
      pet: { ...rawPet, name: repairPetName(rawPet.name, fallbackName ?? activeMod?.defaultPetName ?? defaultPetName), saveMetadata: normalizeSaveMetadata(rawPet.saveMetadata, rawPet) } as unknown as PetState,
      activeMod,
      exportedAt,
      sourceApp,
      source: 'envelope',
      formatVersion: parsed.schemaVersion as 1 | 2,
      requiresMigration: parsed.schemaVersion !== 2,
    };
  }

  if (!hasLegacyPetSaveFingerprint(parsed)) {
    throw new Error('Save text is not recognizable as a PocPet save.');
  }
  return {
    pet: { ...parsed, name: repairPetName(parsed.name, fallbackName), saveMetadata: normalizeSaveMetadata(parsed.saveMetadata, parsed) } as unknown as PetState,
    source: 'legacy',
    formatVersion: 0,
    requiresMigration: true,
  };
};

const clearRestoredGachaHistory = (pet: PetState): PetState => ({
  ...pet, goldenAppleGacha: { ...pet.goldenAppleGacha, recentResults: [], recentHeartResults: [] },
});

export const parseSaveFileText = (text: string, now = Date.now(), fallbackName?: string): PocPetImportedSave => {
  const imported = decodeSaveSnapshot(text, fallbackName);
  const savedAt = imported.exportedAt ? Date.parse(imported.exportedAt) : imported.pet.lastUpdatedAt;
  return { ...imported, pet: clearRestoredGachaHistory(resetImportedTimeBaseline(imported.pet, now, savedAt)) };
};

export const loadStoredPetJson = (
  raw: string | null,
  now = Date.now(),
  eventContext?: NeighborEventContext,
  fallbackName = defaultPetName,
): StoredPetJsonLoadResult => {
  if (raw === null) return { status: 'missing' };
  let decoded: PocPetImportedSave;
  try {
    decoded = decodeSaveSnapshot(raw, fallbackName);
  } catch (error) {
    return { status: 'corrupt', raw, stage: error instanceof UnsupportedSaveVersionError ? 'version' : error instanceof InvalidSaveSyntaxError ? 'parse' : 'validation', detail: String(error) };
  }
  let pet: PetState;
  try {
    pet = decoded.pet;
    const normalized = normalizePet(pet, now, { preserveExpiredPartnerSchedule: true });
    // Loading a save pauses games, while preserving raw calendar fields for offline settlement.
    pet = { ...pet, miniGames: normalized.miniGames };
  } catch (error) {
    return { status: 'corrupt', raw, stage: 'migration', detail: String(error) };
  }
  try {
    return { status: 'ok', pet: clearRestoredGachaHistory(advancePet(pet, now, eventContext)), formatVersion: decoded.formatVersion };
  } catch (error) {
    return { status: 'corrupt', raw, stage: 'simulation', detail: String(error) };
  }
};
