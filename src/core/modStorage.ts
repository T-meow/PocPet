import { t } from '../i18n';
import {
  itemImageKeys as builtinItemImageKeys,
  modCgImageKeys,
  petActivityImageKeys,
  petStatusImageKeys,
  validatePetModManifest,
  type ActivePetMod,
  type InstalledPetModSummary,
  type ParsedPetMod,
  type PetImageKey,
  type PetModLibraryState,
  type PetModManifest,
} from './mod';
import { builtinFuroManifest, builtinPetModManifests, getAvailableBuiltinPetModManifests, getBuiltinPetModManifest, isBuiltinPetModId } from './builtinPetModManifests';

const legacyActiveManifestStorageKey = 'pocpet.mod.active.v1';
const libraryStorageKey = 'pocpet.mod.library.v1';
const databaseName = 'pocpet-mods';
const imageStoreName = 'images';
const modIdIndexName = 'modId';
const databaseVersion = 2;

export const petModLibraryLimit = 12;
export const petModMinimumCount = 2;
export const petModMinimumMessage = '至少保留两位伙伴，恢复默认角色或导入新角色后才能继续删除。';

type ImageScope = 'pet' | 'item' | 'cg';
type ObjectUrlOwner = 'active' | 'library' | 'prepared';

interface StoredImageRecord {
  key: string;
  modId: string;
  scope: ImageScope;
  imageKey: string;
  blob: Blob;
}

const objectUrlsByOwner: Record<ObjectUrlOwner, Set<string>> = {
  active: new Set<string>(),
  library: new Set<string>(),
  prepared: new Set<string>(),
};

const revokeObjectUrls = (owner: ObjectUrlOwner) => {
  for (const url of objectUrlsByOwner[owner]) URL.revokeObjectURL(url);
  objectUrlsByOwner[owner].clear();
};

const createTrackedObjectUrl = (owner: ObjectUrlOwner, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  objectUrlsByOwner[owner].add(url);
  return url;
};

const getImageRecordKey = (modId: string, scope: ImageScope, key: string) => `${modId}:${scope}:${key}`;

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onerror = () => reject(request.error ?? new Error('Unable to open mod image database.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(imageStoreName)
        ? request.transaction?.objectStore(imageStoreName)
        : db.createObjectStore(imageStoreName, { keyPath: 'key' });
      if (store && !store.indexNames.contains(modIdIndexName)) {
        store.createIndex(modIdIndexName, 'modId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Mod image database request failed.'));
    request.onsuccess = () => resolve(request.result);
  });

const getRecords = async (keys: readonly string[]) => {
  if (keys.length === 0) return [];
  const db = await openDatabase();
  try {
    const tx = db.transaction(imageStoreName, 'readonly');
    const store = tx.objectStore(imageStoreName);
    return await Promise.all(keys.map((key) => requestResult<StoredImageRecord | undefined>(store.get(key))));
  } finally {
    db.close();
  }
};

const replaceModRecords = async (modId: string, records: StoredImageRecord[]) => {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(imageStoreName, 'readwrite');
      const store = tx.objectStore(imageStoreName);
      const cursorRequest = store.index(modIdIndexName).openCursor(IDBKeyRange.only(modId));
      let queuedNewRecords = false;

      cursorRequest.onerror = () => reject(cursorRequest.error ?? tx.error ?? new Error('Unable to replace mod resources.'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
          return;
        }
        if (!queuedNewRecords) {
          queuedNewRecords = true;
          records.forEach((record) => store.put(record));
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Unable to replace mod resources.'));
      tx.onabort = () => reject(tx.error ?? new Error('Unable to replace mod resources.'));
    });
  } finally {
    db.close();
  }
};

const deleteModRecords = (modId: string) => replaceModRecords(modId, []);

const emptyLibraryState = (): PetModLibraryState => ({ schemaVersion: 1, activeModId: builtinFuroManifest.id, mods: [], deletedBuiltinModIds: [] });

export const getAvailablePetModManifests = (library: PetModLibraryState): readonly PetModManifest[] => [
  ...getAvailableBuiltinPetModManifests(library.deletedBuiltinModIds),
  ...library.mods.map((mod) => mod.manifest),
];

const normalizeImportedAt = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export const normalizePetModLibraryState = (value: unknown): PetModLibraryState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyLibraryState();
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.mods)) return emptyLibraryState();

  const modsById = new Map<string, PetModLibraryState['mods'][number]>();
  raw.mods.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const item = entry as Record<string, unknown>;
    try {
      const manifest = validatePetModManifest(item.manifest);
      modsById.set(manifest.id, { manifest, importedAt: normalizeImportedAt(item.importedAt) });
    } catch {
      // A bad catalog entry must not hide the remaining installed mods.
    }
  });
  const mods = Array.from(modsById.values())
    .filter((mod) => !isBuiltinPetModId(mod.manifest.id))
    .slice(-petModLibraryLimit);
  let deletedBuiltinModIds = Array.isArray(raw.deletedBuiltinModIds)
    ? [...new Set(raw.deletedBuiltinModIds.filter((id): id is string => typeof id === 'string' && isBuiltinPetModId(id)))]
    : [];
  // 损坏的角色库也要保留至少两位可选伙伴。
  for (const builtin of builtinPetModManifests) {
    if (getAvailableBuiltinPetModManifests(deletedBuiltinModIds).length + mods.length >= petModMinimumCount) break;
    deletedBuiltinModIds = deletedBuiltinModIds.filter((id) => id !== builtin.id);
  }
  const available = getAvailablePetModManifests({ schemaVersion: 1, mods, deletedBuiltinModIds });
  const requestedId = typeof raw.activeModId === 'string' ? raw.activeModId : builtinFuroManifest.id;
  const activeModId = available.find((mod) => mod.id === requestedId)?.id ?? available[0].id;
  return { schemaVersion: 1, activeModId, mods, deletedBuiltinModIds };
};

const writeLibraryState = (state: PetModLibraryState) => {
  window.localStorage.setItem(libraryStorageKey, JSON.stringify(state));
};

const readLegacyManifest = () => {
  try {
    const raw = window.localStorage.getItem(legacyActiveManifestStorageKey);
    return raw ? validatePetModManifest(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const readPetModLibraryState = (): PetModLibraryState => {
  let library = emptyLibraryState();
  let hasLibrary = false;
  try {
    const raw = window.localStorage.getItem(libraryStorageKey);
    if (raw) { library = normalizePetModLibraryState(JSON.parse(raw)); hasLibrary = true; }
  } catch {
    library = emptyLibraryState();
  }

  const legacyManifest = readLegacyManifest();
  if (legacyManifest && !isBuiltinPetModId(legacyManifest.id) && !library.mods.some((mod) => mod.manifest.id === legacyManifest.id)) {
    library = {
      ...library,
      activeModId: hasLibrary ? library.activeModId : legacyManifest.id,
      mods: [...library.mods, { manifest: legacyManifest, importedAt: Date.now() }].slice(-petModLibraryLimit),
    };
  }
  return library;
};

export const getPetModLibraryState = (): PetModLibraryState => {
  const library = readPetModLibraryState();
  writeLibraryState(library);
  window.localStorage.removeItem(legacyActiveManifestStorageKey);
  return library;
};

export const getStoredPetModManifest = (): PetModManifest | null => {
  const library = readPetModLibraryState();
  return getBuiltinPetModManifest(library.activeModId)
    ?? library.mods.find((mod) => mod.manifest.id === library.activeModId)?.manifest
    ?? null;
};

const toStoredImageRecords = (mod: ParsedPetMod): StoredImageRecord[] => {
  const records: StoredImageRecord[] = [];
  Object.entries(mod.petImages).forEach(([imageKey, blob]) => {
    if (blob) records.push({ key: getImageRecordKey(mod.manifest.id, 'pet', imageKey), modId: mod.manifest.id, scope: 'pet', imageKey, blob });
  });
  Object.entries(mod.itemImages).forEach(([imageKey, blob]) => {
    if (blob) records.push({ key: getImageRecordKey(mod.manifest.id, 'item', imageKey), modId: mod.manifest.id, scope: 'item', imageKey, blob });
  });
  Object.entries(mod.cgImages).forEach(([imageKey, blob]) => {
    if (blob) records.push({ key: getImageRecordKey(mod.manifest.id, 'cg', imageKey), modId: mod.manifest.id, scope: 'cg', imageKey, blob });
  });
  return records;
};

export const installPetMod = async (mod: ParsedPetMod) => {
  if (isBuiltinPetModId(mod.manifest.id)) {
    throw new Error(t('ui.settings.mod.builtinConflict', { name: mod.manifest.name }));
  }
  const library = getPetModLibraryState();
  const existingIndex = library.mods.findIndex((item) => item.manifest.id === mod.manifest.id);
  if (existingIndex < 0 && library.mods.length >= petModLibraryLimit) {
    throw new Error(t('ui.settings.mod.libraryLimit', { count: petModLibraryLimit }));
  }

  await replaceModRecords(mod.manifest.id, toStoredImageRecords(mod));
  const nextEntry = { manifest: mod.manifest, importedAt: Date.now() };
  const mods = existingIndex >= 0
    ? library.mods.map((item, index) => index === existingIndex ? nextEntry : item)
    : [...library.mods, nextEntry];
  writeLibraryState({ ...library, mods });
  return nextEntry;
};

export const setActivePetMod = (modId?: string) => {
  const library = getPetModLibraryState();
  const available = getAvailablePetModManifests(library);
  const requestedId = modId ?? builtinFuroManifest.id;
  const activeModId = available.find((mod) => mod.id === requestedId)?.id ?? library.activeModId ?? available[0].id;
  writeLibraryState({ ...library, activeModId });
};

let deletingPetMod = false;
export const deletePetMod = async (modId: string) => {
  if (deletingPetMod) throw new Error('正在删除角色，请稍候。');
  deletingPetMod = true;
  try {
    const library = getPetModLibraryState();
    const available = getAvailablePetModManifests(library);
    if (!available.some((mod) => mod.id === modId)) return;
    if (available.length <= petModMinimumCount) throw new Error(petModMinimumMessage);
    const builtin = isBuiltinPetModId(modId);
    const wasActive = library.activeModId === modId;
    const next = {
      ...library,
      activeModId: wasActive ? available.find((mod) => mod.id !== modId)!.id : library.activeModId,
      mods: library.mods.filter((mod) => mod.manifest.id !== modId),
      deletedBuiltinModIds: builtin ? [...new Set([...(library.deletedBuiltinModIds ?? []), modId])] : library.deletedBuiltinModIds,
    };
    // A failed catalog write must never destroy the only stored image copies.
    writeLibraryState(next);
    if (!builtin) {
      try {
        await deleteModRecords(modId);
      } catch (error) {
        // IndexedDB deletes are transactional; on failure the image records remain.
        // Restore this entry without discarding any other intervening library changes.
        const current = readPetModLibraryState(), entry = library.mods.find((mod) => mod.manifest.id === modId)!;
        const mods = [...current.mods];
        if (!mods.some((mod) => mod.manifest.id === modId)) mods.splice(Math.min(library.mods.indexOf(entry), mods.length), 0, entry);
        writeLibraryState({ ...current, mods, activeModId: wasActive && current.activeModId === next.activeModId ? modId : current.activeModId });
        throw error;
      }
    }
    if (wasActive) revokeObjectUrls('active');
    revokeObjectUrls('library');
  } finally {
    deletingPetMod = false;
  }
};

export const restoreBuiltinPetMod = (modId: string) => {
  if (!isBuiltinPetModId(modId)) throw new Error('找不到这个内置角色。');
  const library = getPetModLibraryState();
  writeLibraryState({ ...library, deletedBuiltinModIds: (library.deletedBuiltinModIds ?? []).filter((id) => id !== modId) });
};

export const restoreBuiltinPetMods = () => {
  const library = getPetModLibraryState();
  writeLibraryState({ ...library, deletedBuiltinModIds: [] });
};

export const listInstalledPetMods = async (): Promise<InstalledPetModSummary[]> => {
  const library = getPetModLibraryState();
  const records = await getRecords(library.mods.map((entry) => getImageRecordKey(entry.manifest.id, 'pet', 'content')));
  const { getBuiltinPetMod } = await import('./builtinPetMods');
  revokeObjectUrls('library');
  const builtinMods = getAvailableBuiltinPetModManifests(library.deletedBuiltinModIds).map((manifest) => ({
    manifest, importedAt: 0, contentImageUrl: getBuiltinPetMod(manifest.id)?.petImageUrls.content,
  }));
  return [...builtinMods, ...library.mods.map((entry, index) => {
    const record = records[index];
    return {
      ...entry,
      contentImageUrl: record?.blob ? createTrackedObjectUrl('library', record.blob) : undefined,
    };
  })];
};

const loadPetModResources = async (modId: string, owner: ObjectUrlOwner): Promise<ActivePetMod | null> => {
  const library = getPetModLibraryState();
  if (isBuiltinPetModId(modId)) {
    if (!getAvailableBuiltinPetModManifests(library.deletedBuiltinModIds).some((mod) => mod.id === modId)) return null;
    const { getBuiltinPetMod } = await import('./builtinPetMods');
    const builtinMod = getBuiltinPetMod(modId);
    revokeObjectUrls(owner);
    return builtinMod;
  }
  const manifest = library.mods.find((mod) => mod.manifest.id === modId)?.manifest;
  if (!manifest) return null;

  const petImageUrls: ActivePetMod['petImageUrls'] = {};
  const itemImageUrls: ActivePetMod['itemImageUrls'] = {};
  const cgImageUrls: ActivePetMod['cgImageUrls'] = {};
  const petKeys = [...petStatusImageKeys, ...petActivityImageKeys];
  const itemKeys = manifest.schemaVersion === 2
    ? [...Object.keys(manifest.items?.overrides ?? {}), ...(manifest.items?.custom ?? []).map((item) => item.id)]
    : [...builtinItemImageKeys];
  const petRecordKeys = petKeys.map((key) => getImageRecordKey(manifest.id, 'pet', key));
  const itemRecordKeys = itemKeys.map((key) => getImageRecordKey(manifest.id, 'item', key));
  const cgRecordKeys = modCgImageKeys.map((key) => getImageRecordKey(manifest.id, 'cg', key));
  const records = await getRecords([...petRecordKeys, ...itemRecordKeys, ...cgRecordKeys]);
  const recordsByKey = new Map(records.flatMap((record) => record ? [[record.key, record] as const] : []));
  revokeObjectUrls(owner);

  petKeys.forEach((key) => {
    const blob = recordsByKey.get(getImageRecordKey(manifest.id, 'pet', key))?.blob;
    if (blob) petImageUrls[key as PetImageKey] = createTrackedObjectUrl(owner, blob);
  });
  itemKeys.forEach((key) => {
    const blob = recordsByKey.get(getImageRecordKey(manifest.id, 'item', key))?.blob;
    if (blob) itemImageUrls[key] = createTrackedObjectUrl(owner, blob);
  });
  modCgImageKeys.forEach((key) => {
    const blob = recordsByKey.get(getImageRecordKey(manifest.id, 'cg', key))?.blob;
    if (blob) cgImageUrls[key] = createTrackedObjectUrl(owner, blob);
  });
  return { manifest, petImageUrls, itemImageUrls, cgImageUrls };
};

export const loadPetMod = (modId: string) => loadPetModResources(modId, 'active');
export const preparePetMod = (modId: string) => loadPetModResources(modId, 'prepared');
export const discardPreparedPetMod = () => revokeObjectUrls('prepared');
export const adoptPreparedPetMod = () => {
  revokeObjectUrls('active');
  for (const url of objectUrlsByOwner.prepared) objectUrlsByOwner.active.add(url);
  objectUrlsByOwner.prepared.clear();
};

export const loadActivePetMod = async () => {
  const activeModId = getPetModLibraryState().activeModId;
  return activeModId ? loadPetMod(activeModId) : null;
};

// Compatibility wrappers for callers that still use the former single-slot API.
export const saveActivePetMod = async (mod: ParsedPetMod) => {
  await installPetMod(mod);
  setActivePetMod(mod.manifest.id);
};

export const clearActivePetMod = async () => {
  setActivePetMod(undefined);
};
