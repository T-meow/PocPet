import type { PetState } from './pet';
import { createSaveFilePlainText, parseSaveFileText, type PocPetImportedSave, type PocPetSaveModSummary } from './saveCodec';
import type { ToyCloudStorage } from '../platform/toySdk';

export const cloudSaveSchemaVersion = 1 as const;
export const cloudSaveChunkSize = 960;
export const cloudSaveMaxChunksPerGeneration = 60;
export const cloudSaveMaxEncodedLength = cloudSaveChunkSize * cloudSaveMaxChunksPerGeneration;
export const cloudSaveActiveKey = 'pocpet-save-active-v1';
export const authorFollowGiftCloudKey = 'pocpet-author-follow-gift-v2';
export type CloudSaveGeneration = 'a' | 'b';

export interface CloudSaveManifestV1 {
  schemaVersion: 1;
  generation: CloudSaveGeneration;
  encoding: 'zip-deflate-base64';
  chunkCount: number;
  encodedLength: number;
  checksum: string;
  uploadedAt: string;
  petName: string;
  petLevel: number;
  activeMod?: PocPetSaveModSummary;
}

export interface CloudSaveStatus {
  manifest?: CloudSaveManifestV1;
  activeGeneration?: CloudSaveGeneration;
  usedFallbackManifest: boolean;
}

export interface RestoredCloudSave {
  imported: PocPetImportedSave;
  plainText: string;
  manifest: CloudSaveManifestV1;
  generation: CloudSaveGeneration;
  recoveredFromPrevious: boolean;
}

class InvalidCloudSaveGenerationError extends Error {}

const manifestKey = (generation: CloudSaveGeneration) => `pocpet-save-${generation}-manifest-v1`;
const chunkKey = (generation: CloudSaveGeneration, index: number) =>
  `pocpet-save-${generation}-${String(index).padStart(2, '0')}`;

export const cloudSaveOwnedKeys = [
  cloudSaveActiveKey,
  manifestKey('a'),
  manifestKey('b'),
  ...(['a', 'b'] as const).flatMap((generation) =>
    Array.from({ length: cloudSaveMaxChunksPerGeneration }, (_, index) => chunkKey(generation, index))),
] as const;

const checksumText = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let hash = 0x811c9dc5;
  bytes.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  });
  return hash.toString(16).padStart(8, '0');
};

const readManifest = (text: string | undefined, expectedGeneration: CloudSaveGeneration): CloudSaveManifestV1 | undefined => {
  if (!text) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const raw = value as Record<string, unknown>;
    if (
      raw.schemaVersion !== cloudSaveSchemaVersion
      || raw.generation !== expectedGeneration
      || raw.encoding !== 'zip-deflate-base64'
      || typeof raw.chunkCount !== 'number'
      || !Number.isInteger(raw.chunkCount)
      || raw.chunkCount < 1
      || raw.chunkCount > cloudSaveMaxChunksPerGeneration
      || typeof raw.encodedLength !== 'number'
      || !Number.isInteger(raw.encodedLength)
      || raw.encodedLength < 1
      || raw.encodedLength > cloudSaveMaxEncodedLength
      || typeof raw.checksum !== 'string'
      || !/^[0-9a-f]{8}$/.test(raw.checksum)
      || typeof raw.uploadedAt !== 'string'
      || !Number.isFinite(Date.parse(raw.uploadedAt))
      || typeof raw.petName !== 'string'
      || typeof raw.petLevel !== 'number'
    ) return undefined;
    const activeMod = raw.activeMod && typeof raw.activeMod === 'object' && !Array.isArray(raw.activeMod)
      ? raw.activeMod as Record<string, unknown>
      : undefined;
    return {
      schemaVersion: cloudSaveSchemaVersion,
      generation: expectedGeneration,
      encoding: 'zip-deflate-base64',
      chunkCount: raw.chunkCount,
      encodedLength: raw.encodedLength,
      checksum: raw.checksum,
      uploadedAt: new Date(raw.uploadedAt).toISOString(),
      petName: raw.petName.slice(0, 32),
      petLevel: Math.max(1, Math.floor(raw.petLevel)),
      activeMod: activeMod
        && typeof activeMod.id === 'string'
        && typeof activeMod.name === 'string'
        && typeof activeMod.version === 'string'
        ? {
            id: activeMod.id.slice(0, 64),
            name: activeMod.name.slice(0, 48),
            version: activeMod.version.slice(0, 32),
          }
        : undefined,
    };
  } catch {
    return undefined;
  }
};

const loadZipText = async (base64: string) => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(base64, { base64: true, checkCRC32: true });
  const files = Object.values(zip.files).filter((file) => !file.dir);
  if (files.length !== 1 || files[0].name !== 'save.json') throw new Error('Cloud save archive has invalid contents.');
  const text = await files[0].async('string');
  if (new TextEncoder().encode(text).length > 512 * 1024) throw new Error('Cloud save expands beyond the safety limit.');
  return text;
};

export const encodeCloudSave = async (
  pet: PetState,
  activeMod?: PocPetSaveModSummary | null,
  now = Date.now(),
) => {
  const plainText = createSaveFilePlainText(pet, activeMod, now);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('save.json', plainText);
  const encoded = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  if (encoded.length > cloudSaveMaxEncodedLength) {
    throw new Error(`Cloud save is too large (${encoded.length}/${cloudSaveMaxEncodedLength} characters).`);
  }
  return {
    encoded,
    chunks: Array.from({ length: Math.ceil(encoded.length / cloudSaveChunkSize) }, (_, index) =>
      encoded.slice(index * cloudSaveChunkSize, (index + 1) * cloudSaveChunkSize)),
    checksum: checksumText(encoded),
    plainText,
  };
};

const readGeneration = async (
  storage: ToyCloudStorage,
  generation: CloudSaveGeneration,
  manifest?: CloudSaveManifestV1,
  now = Date.now(),
): Promise<RestoredCloudSave> => {
  const resolvedManifest = manifest ?? readManifest(
    (await storage.getCloudStorage([manifestKey(generation)]))[manifestKey(generation)],
    generation,
  );
  if (!resolvedManifest) {
    throw new InvalidCloudSaveGenerationError(`Cloud save generation ${generation.toUpperCase()} has no valid manifest.`);
  }
  const keys = Array.from({ length: resolvedManifest.chunkCount }, (_, index) => chunkKey(generation, index));
  const stored = await storage.getCloudStorage(keys);
  const encoded = keys.map((key) => stored[key] ?? '').join('');
  if (encoded.length !== resolvedManifest.encodedLength || checksumText(encoded) !== resolvedManifest.checksum) {
    throw new InvalidCloudSaveGenerationError(`Cloud save generation ${generation.toUpperCase()} is incomplete or damaged.`);
  }
  let plainText: string;
  let imported: PocPetImportedSave;
  try {
    plainText = await loadZipText(encoded);
    imported = parseSaveFileText(plainText, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cloud save payload could not be decoded.';
    throw new InvalidCloudSaveGenerationError(message);
  }
  return {
    imported,
    plainText,
    manifest: resolvedManifest,
    generation,
    recoveredFromPrevious: false,
  };
};

const parseActiveGeneration = (value: string | undefined): CloudSaveGeneration | undefined =>
  value === 'a' || value === 'b' ? value : undefined;

export const getCloudSaveStatus = async (storage: ToyCloudStorage): Promise<CloudSaveStatus> => {
  const keys = [cloudSaveActiveKey, manifestKey('a'), manifestKey('b')];
  const stored = await storage.getCloudStorage(keys);
  const requested = parseActiveGeneration(stored[cloudSaveActiveKey]);
  const manifests = {
    a: readManifest(stored[manifestKey('a')], 'a'),
    b: readManifest(stored[manifestKey('b')], 'b'),
  };
  if (requested && manifests[requested]) {
    return { activeGeneration: requested, manifest: manifests[requested], usedFallbackManifest: false };
  }
  const fallback = requested === 'a'
    ? 'b'
    : requested === 'b'
      ? 'a'
      : (['a', 'b'] as const)
          .filter((generation) => manifests[generation])
          .sort((left, right) => Date.parse(manifests[right]!.uploadedAt) - Date.parse(manifests[left]!.uploadedAt))[0];
  return fallback && manifests[fallback]
    ? { activeGeneration: fallback, manifest: manifests[fallback], usedFallbackManifest: Boolean(requested) }
    : { usedFallbackManifest: Boolean(requested) };
};

export const restoreCloudSave = async (storage: ToyCloudStorage, now = Date.now()): Promise<RestoredCloudSave> => {
  const status = await getCloudSaveStatus(storage);
  const first = status.activeGeneration;
  const generations: CloudSaveGeneration[] = first
    ? [first, first === 'a' ? 'b' : 'a']
    : ['a', 'b'];
  let firstError: unknown;
  for (let index = 0; index < generations.length; index += 1) {
    try {
      const result = await readGeneration(
        storage,
        generations[index],
        generations[index] === status.activeGeneration ? status.manifest : undefined,
        now,
      );
      return { ...result, recoveredFromPrevious: index > 0 || status.usedFallbackManifest };
    } catch (error) {
      firstError ??= error;
    }
  }
  throw firstError instanceof Error ? firstError : new Error('No usable cloud save was found.');
};

const writeInBatches = async (storage: ToyCloudStorage, entries: Array<[string, string]>) => {
  for (let index = 0; index < entries.length; index += 20) {
    await storage.setCloudStorage(Object.fromEntries(entries.slice(index, index + 20)));
  }
};

const otherGeneration = (generation: CloudSaveGeneration): CloudSaveGeneration =>
  generation === 'a' ? 'b' : 'a';

const isGenerationUsable = async (
  storage: ToyCloudStorage,
  generation: CloudSaveGeneration,
  manifest: CloudSaveManifestV1 | undefined,
  now: number,
) => {
  if (!manifest) return false;
  try {
    await readGeneration(storage, generation, manifest, now);
    return true;
  } catch (error) {
    if (error instanceof InvalidCloudSaveGenerationError) return false;
    throw error;
  }
};

const selectUploadGeneration = async (storage: ToyCloudStorage, now: number): Promise<CloudSaveGeneration> => {
  const keys = [cloudSaveActiveKey, manifestKey('a'), manifestKey('b')];
  const stored = await storage.getCloudStorage(keys);
  const requested = parseActiveGeneration(stored[cloudSaveActiveKey]);
  const manifests = {
    a: readManifest(stored[manifestKey('a')], 'a'),
    b: readManifest(stored[manifestKey('b')], 'b'),
  };

  if (requested) {
    return await isGenerationUsable(storage, requested, manifests[requested], now)
      ? otherGeneration(requested)
      : requested;
  }

  const usable: CloudSaveGeneration[] = [];
  for (const generation of ['a', 'b'] as const) {
    if (await isGenerationUsable(storage, generation, manifests[generation], now)) usable.push(generation);
  }
  if (usable.length === 1) return otherGeneration(usable[0]);
  if (usable.length === 2) {
    const newest = Date.parse(manifests.a!.uploadedAt) >= Date.parse(manifests.b!.uploadedAt) ? 'a' : 'b';
    return otherGeneration(newest);
  }
  return 'a';
};

export const uploadCloudSave = async (
  storage: ToyCloudStorage,
  pet: PetState,
  activeMod?: PocPetSaveModSummary | null,
  now = Date.now(),
): Promise<CloudSaveManifestV1> => {
  const generation = await selectUploadGeneration(storage, now);
  const payload = await encodeCloudSave(pet, activeMod, now);
  const manifest: CloudSaveManifestV1 = {
    schemaVersion: cloudSaveSchemaVersion,
    generation,
    encoding: 'zip-deflate-base64',
    chunkCount: payload.chunks.length,
    encodedLength: payload.encoded.length,
    checksum: payload.checksum,
    uploadedAt: new Date(now).toISOString(),
    petName: pet.name.slice(0, 32),
    petLevel: pet.level,
    activeMod: activeMod
      ? { id: activeMod.id, name: activeMod.name, version: activeMod.version }
      : undefined,
  };
  await writeInBatches(storage, payload.chunks.map((chunk, index) => [chunkKey(generation, index), chunk]));
  await storage.setCloudStorage({ [manifestKey(generation)]: JSON.stringify(manifest) });
  await readGeneration(storage, generation, manifest, now);
  await storage.setCloudStorage({ [cloudSaveActiveKey]: generation });

  const staleKeys = Array.from(
    { length: cloudSaveMaxChunksPerGeneration - payload.chunks.length },
    (_, index) => chunkKey(generation, payload.chunks.length + index),
  );
  try {
    if (staleKeys.length > 0) await storage.removeCloudStorage(staleKeys);
  } catch {
    // The new generation is already active and valid; stale cleanup can wait for the next upload.
  }
  return manifest;
};

export const hasAuthorFollowGiftCloudMarker = async (storage: ToyCloudStorage) =>
  (await storage.getCloudStorage([authorFollowGiftCloudKey]))[authorFollowGiftCloudKey] === '1';

export const writeAuthorFollowGiftCloudMarker = async (storage: ToyCloudStorage) => {
  await storage.setCloudStorage({ [authorFollowGiftCloudKey]: '1' });
};
