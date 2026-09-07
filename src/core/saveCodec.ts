import { advancePet, normalizePet, defaultPetName, type NeighborEventContext, type PetState } from './pet';
import { rebasePetFutureCalendarState, shiftPetRuntimeTimestamps } from './gameClock';

export const saveFileSchemaVersion = 1;
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

export interface PocPetImportedSave {
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
  exportedAt?: string;
  sourceApp?: PocPetSaveAppId;
  source: 'envelope' | 'legacy';
}

export type StoredPetJsonLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState }
  | { status: 'corrupt'; raw: string; stage: SaveFailureStage; detail?: string };

export type SaveFailureStage = 'parse' | 'validation' | 'migration' | 'simulation' | 'storage';
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

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

const protectSaveFileText = (plainText: string) =>
  `${protectedSavePrefix}${checksumText(plainText)}:${bytesToBase64Url(transformSaveBytes(textEncoder.encode(plainText), appId))}`;

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
  const file: PocPetSaveFileV1 = {
    schemaVersion: saveFileSchemaVersion,
    app: appId,
    exportedAt: new Date(now).toISOString(),
    pet: normalizePet(pet, now),
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
  protectSaveFileText(createSaveFilePlainText(pet, activeMod, now));

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

export const parseSaveFileText = (text: string, now = Date.now(), fallbackName?: string): PocPetImportedSave => {
  let parsed: unknown;
  let protectedApp: PocPetSaveAppId | undefined;
  try {
    const unprotected = unprotectSaveFileText(text);
    parsed = JSON.parse(unprotected.plainText);
    protectedApp = unprotected.protectedApp;
  } catch {
    throw new Error('Save text is not valid PocPet save data.');
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
    if (parsed.schemaVersion !== saveFileSchemaVersion) {
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > saveFileSchemaVersion) {
        throw new Error(`This save file comes from a newer ${sourceApp} version. Please upgrade the app.`);
      }
      throw new Error('Unsupported save file version.');
    }
    if (!hasLegacyPetSaveFingerprint(parsed.pet)) throw new Error('Save file has invalid pet data.');
    const { exportedAt, timestamp } = readEnvelopeExportedAt(parsed.exportedAt);
    const activeMod = parsed.activeMod === undefined ? undefined : readActiveModSummary(parsed.activeMod);
    if (parsed.activeMod !== undefined && !activeMod) throw new Error('Save file has invalid Mod information.');
    return {
      pet: resetImportedTimeBaseline({ ...parsed.pet, name: repairPetName(parsed.pet.name, fallbackName ?? activeMod?.defaultPetName ?? defaultPetName) } as unknown as PetState, now, timestamp),
      activeMod,
      exportedAt,
      sourceApp,
      source: 'envelope',
    };
  }

  if (!hasLegacyPetSaveFingerprint(parsed)) {
    throw new Error('Save text is not recognizable as a PocPet save.');
  }
  const savedAt = isFiniteNumber(parsed.lastUpdatedAt) ? parsed.lastUpdatedAt : now;
  return {
    pet: resetImportedTimeBaseline({ ...parsed, name: repairPetName(parsed.name, fallbackName) } as unknown as PetState, now, savedAt),
    source: 'legacy',
  };
};

export const loadStoredPetJson = (
  raw: string | null,
  now = Date.now(),
  eventContext?: NeighborEventContext,
  fallbackName = defaultPetName,
): StoredPetJsonLoadResult => {
  if (raw === null) return { status: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { status: 'corrupt', raw, stage: 'parse', detail: String(error) };
  }
  if (!hasLegacyPetSaveFingerprint(parsed)) return { status: 'corrupt', raw, stage: 'validation' };
  let pet: PetState;
  try {
    pet = { ...parsed, name: repairPetName(parsed.name, fallbackName) } as unknown as PetState;
    normalizePet(pet, now, { preserveExpiredPartnerSchedule: true });
  } catch (error) {
    return { status: 'corrupt', raw, stage: 'migration', detail: String(error) };
  }
  try {
    return { status: 'ok', pet: advancePet(pet, now, eventContext) };
  } catch (error) {
    return { status: 'corrupt', raw, stage: 'simulation', detail: String(error) };
  }
};
