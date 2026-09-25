import { advancePet, normalizePet, defaultPetName, type NeighborEventContext, type PetState } from './pet';
import { advanceCommunityMarket } from './communityMarket';
import { marketPricingVersion } from './communityEconomy';
import { rebasePetFutureCalendarState, shiftPetRuntimeTimestamps } from './gameClock';
import { appBuild } from '../platform/edition';
import { t } from '../i18n';
import { isSaveMetadata, normalizeSaveMetadata } from './saveMetadata';
import { compactSaveEncoding, hydratePersistedPet, persistentPetKeys, toPersistedPet, type PersistedPetStateV2 } from './persistedPet';
export type { PersistedPetStateV2 } from './persistedPet';

export const saveFileSchemaVersion = 2;
export const minimumSaveReaderVersion = '1.9.0';
export const minimumSupportedSaveVersion = '1.9.0';
export class UnsupportedSaveVersionError extends Error {}
export class ObsoleteSaveVersionError extends Error {
  constructor() { super(t('ui.settings.save.obsoleteVersion', { version: minimumSupportedSaveVersion })); }
}
class InvalidSaveSyntaxError extends Error {}
export const pocPetSaveAppId = 'PocPet' as const;
export const mintSaveAppId = 'Pocpet-Mint' as const;
export type PocPetSaveAppId = typeof pocPetSaveAppId | typeof mintSaveAppId;

const appId = pocPetSaveAppId;
const supportedSaveAppIds: readonly PocPetSaveAppId[] = [pocPetSaveAppId, mintSaveAppId];
const protectedSavePrefix = 'POCPET-SAVE-v2:';
const textEncoder = new TextEncoder();

export interface PocPetSaveModSummary {
  id: string;
  name: string;
  version: string;
  defaultPetName?: string;
}

export interface SaveMigrationResult {
  formatVersion: 2;
  requiresMigration: false;
}

export interface PocPetImportedSave extends SaveMigrationResult {
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
  exportedAt?: string;
  sourceApp?: PocPetSaveAppId;
  source: 'envelope';
}

export interface PocPetSaveFileV2 {
  schemaVersion: 2;
  encoding?: typeof compactSaveEncoding;
  app: typeof appId;
  minimumReaderVersion: string;
  exportedAt: string;
  pet: PersistedPetStateV2;
  activeMod?: PocPetSaveModSummary;
}

export type StoredPetJsonLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState; formatVersion: 2 }
  | { status: 'corrupt'; raw: string; stage: SaveFailureStage; detail?: string };

export type SaveFailureStage = 'parse' | 'validation' | 'migration' | 'simulation' | 'storage' | 'version' | 'obsolete';
export const repairPetName = (value: unknown, fallbackName = defaultPetName) =>
  typeof value === 'string' && value.trim() ? value :
    typeof fallbackName === 'string' && fallbackName.trim() ? fallbackName : defaultPetName;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isSupportedSaveAppId = (value: unknown): value is PocPetSaveAppId =>
  supportedSaveAppIds.some((candidate) => candidate === value);

const numericPetFields = [
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

// Validate hydrated saves and distinguish obsolete raw saves from unrelated JSON.
const hasPetSaveFingerprint = (value: unknown): value is Record<string, unknown> => {
  if (!isObject(value)) return false;
  if (typeof value.recentEvent !== 'string') return false;
  if (typeof value.isSleeping !== 'boolean') return false;
  if (!isObject(value.inventory) || !isObject(value.actionStreak) || !isObject(value.pomodoro)) return false;
  return numericPetFields.every((field) => isFiniteNumber(value[field]));
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

export const checksumText = (text: string) => {
  const bytes = textEncoder.encode(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const createSaveFilePlainText = (pet: PetState, activeMod?: PocPetSaveModSummary | null, now = Date.now()) => {
  const file: PocPetSaveFileV2 = {
    schemaVersion: saveFileSchemaVersion,
    encoding: compactSaveEncoding,
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

const assertSupportedModuleVersions = (rawPet: Record<string, unknown>) => {
  const supportedModules: Record<string, number> = { garden: 6, goldenAppleGacha: 4, partnerSchedule: 7, boostCards: 2, classicEndgame: 2, timeGuard: 1, timePause: 1, kitchen: 1, miniGames: 1, companionMemories: 1, musicCompanion: 1, festivalStories: 3, adventure: 8, community: 13 };
  for (const [key, maximum] of Object.entries(supportedModules)) {
    const module = rawPet[key];
    if (isObject(module) && typeof module.schemaVersion === 'number' && module.schemaVersion > maximum) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  }
  const adventure = rawPet.adventure;
  const community = rawPet.community;
  const expedition = isObject(community) ? community.expedition : undefined;
  const expeditionTrip = isObject(expedition) ? expedition.active : undefined;
  if (isObject(expedition) && typeof expedition.schemaVersion === 'number' && expedition.schemaVersion > 5 || isObject(expeditionTrip) && typeof expeditionTrip.rulesVersion === 'number' && expeditionTrip.rulesVersion > 5) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  const trip = isObject(adventure) ? adventure.active : undefined;
  if (isObject(trip) && typeof trip.rulesVersion === 'number' && trip.rulesVersion > 10) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
};

const compareVersions = (left: string, right: string) => {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
};

const assertSupportedV2 = (parsed: Record<string, unknown>, rawPet: Record<string, unknown>) => {
  if (Object.keys(parsed).some((key) => !['schemaVersion', 'encoding', 'app', 'minimumReaderVersion', 'exportedAt', 'pet', 'activeMod'].includes(key))
    || parsed.encoding !== undefined && parsed.encoding !== compactSaveEncoding) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  const minimum = parsed.minimumReaderVersion;
  if (typeof minimum !== 'string' || !/^\d+\.\d+\.\d+$/.test(minimum)) throw new Error('Save file has an invalid minimum reader version.');
  if (compareVersions(minimum, minimumSupportedSaveVersion) < 0) throw new ObsoleteSaveVersionError();
  if (compareVersions(minimum, appBuild.version) > 0) throw new UnsupportedSaveVersionError(t('ui.settings.save.requiresVersion', { version: minimum }));
  if (Object.keys(rawPet).some((key) => !(persistentPetKeys as readonly string[]).includes(key))) throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
  if (!isSaveMetadata(rawPet.saveMetadata)) throw new Error('Save file has invalid save identity.');
};

const resetImportedTimeBaseline = (pet: PetState, now: number, savedAt: number): PetState => {
  // Frozen backups retain their original anchor. Importing, loading or exporting
  // them must not resume time or reset the remaining duration of an activity.
  if (pet.timePause !== undefined) return normalizePet(pet, now, { preserveExpiredPartnerSchedule: true, preserveMiniGameSession: true });
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
  const trimmed = text.trim();
  if (trimmed.startsWith(protectedSavePrefix)) throw new ObsoleteSaveVersionError();
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new InvalidSaveSyntaxError('Save text is not valid PocPet save data.');
  }

  if (!isObject(parsed)) {
    throw new Error('Save text must be a JSON object.');
  }

  if (parsed.app !== undefined || parsed.schemaVersion !== undefined) {
    if (!isSupportedSaveAppId(parsed.app)) throw new Error('This is not a supported PocPet save file.');
    const sourceApp = parsed.app;
    if (parsed.schemaVersion === 1) throw new ObsoleteSaveVersionError();
    if (parsed.schemaVersion !== saveFileSchemaVersion) {
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > saveFileSchemaVersion) {
        throw new UnsupportedSaveVersionError(t('ui.settings.save.newerVersion'));
      }
      throw new Error('Unsupported save file version.');
    }
    if (!isObject(parsed.pet)) throw new Error('Save file has invalid pet data.');
    assertSupportedV2(parsed, parsed.pet);
    assertSupportedModuleVersions(parsed.pet);
    const rawPet = hydratePersistedPet(parsed.pet, parsed.encoding === compactSaveEncoding);
    if (!hasPetSaveFingerprint(rawPet)) throw new Error('Save file has invalid pet data.');
    const { exportedAt } = readEnvelopeExportedAt(parsed.exportedAt);
    const activeMod = parsed.activeMod === undefined ? undefined : readActiveModSummary(parsed.activeMod);
    if (parsed.activeMod !== undefined && !activeMod) throw new Error('Save file has invalid Mod information.');
    return {
      pet: { ...rawPet, name: repairPetName(rawPet.name, fallbackName ?? activeMod?.defaultPetName ?? defaultPetName), saveMetadata: normalizeSaveMetadata(rawPet.saveMetadata, rawPet) } as unknown as PetState,
      activeMod,
      exportedAt,
      sourceApp,
      source: 'envelope',
      formatVersion: saveFileSchemaVersion,
      requiresMigration: false,
    };
  }

  if (hasPetSaveFingerprint(parsed)) throw new ObsoleteSaveVersionError();
  throw new Error('Save text is not recognizable as a PocPet save.');
};

const clearRestoredGachaHistory = (pet: PetState): PetState => ({
  ...pet, goldenAppleGacha: { ...pet.goldenAppleGacha, recentResults: [], recentHeartResults: [] },
});

export const parseSaveFileText = (text: string, now = Date.now(), fallbackName?: string): PocPetImportedSave => {
  const imported = decodeSaveSnapshot(text, fallbackName);
  const savedAt = imported.exportedAt ? Date.parse(imported.exportedAt) : imported.pet.lastUpdatedAt;
  const pet = resetImportedTimeBaseline(imported.pet, now, savedAt);
  return { ...imported, pet: clearRestoredGachaHistory(pet.community.market.pricingVersion < marketPricingVersion ? advanceCommunityMarket(pet, now) : pet) };
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
    return { status: 'corrupt', raw, stage: error instanceof UnsupportedSaveVersionError ? 'version' : error instanceof ObsoleteSaveVersionError ? 'obsolete' : error instanceof InvalidSaveSyntaxError ? 'parse' : 'validation', detail: String(error) };
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
