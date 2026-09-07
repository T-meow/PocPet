import { createSaveFileText, parseSaveFileText, type PocPetSaveModSummary } from '../core/saveCodec';
import type { PetState } from '../core/pet';
import { assertStorageUnchanged } from '../core/storage';
import { localDateKey } from '../core/editionNotice';
import { isNativeApp, isBilibiliAppWebView } from './edition';

export const automaticBackupFileName = 'pocpet-auto-backup.pocpet';
const preferencesKey = 'pocpet.automatic-backup.v1';
export interface BackupPreferences { enabled: boolean; intervalDays: number }
export interface BackupSnapshot { dateKey: string; savedAt: number; petName: string; level: number; text: string }
export type BackupFileStatus = 'native' | 'saved' | 'unconfigured' | 'permission' | 'unsupported' | 'error';
export interface BackupState {
  snapshots: BackupSnapshot[];
  fileStatus: BackupFileStatus;
  fileSavedAt?: number;
  error?: string;
  warnings?: string[];
}
interface BackupFileHandle {
  name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
  getFile(): Promise<File>;
}
type PickerWindow = Window & { showSaveFilePicker?: (options: unknown) => Promise<BackupFileHandle> };

export const readBackupPreferences = (): BackupPreferences => {
  try {
    const raw = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    return { enabled: raw?.enabled !== false, intervalDays: Number.isInteger(raw?.intervalDays) ? Math.max(1, Math.min(30, raw.intervalDays)) : 1 };
  } catch { return { enabled: true, intervalDays: 1 }; }
};
export const writeBackupPreferences = (preferences: BackupPreferences) => {
  localStorage.setItem(preferencesKey, JSON.stringify(preferences));
};
export const isBackupDue = (latest: BackupSnapshot | undefined, preferences: BackupPreferences, now = Date.now()) => {
  if (!preferences.enabled) return false;
  if (!latest) return true;
  const day = (dateKey: string) => Date.parse(`${dateKey}T00:00:00Z`);
  return day(localDateKey(now)) - day(latest.dateKey) >= preferences.intervalDays * 86_400_000;
};
export const trimBackupSnapshots = (snapshots: BackupSnapshot[]) =>
  [...new Map(snapshots.map((snapshot) => [snapshot.dateKey, snapshot])).values()]
    .sort((a, b) => b.savedAt - a.savedAt).slice(0, 7);
export const canChooseBackupFile = () => !isNativeApp()
  && !isBilibiliAppWebView() && typeof (window as PickerWindow).showSaveFilePicker === 'function';

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('pocpet-backups', 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('snapshots', { keyPath: 'dateKey' });
    request.result.createObjectStore('settings');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Backup database is blocked.'));
});
const readSetting = async <T>(key: string): Promise<T | undefined> => {
  const db = await openDatabase();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction('settings').objectStore('settings').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
};
const writeSetting = async (key: string, value: unknown) => {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
};
const validateSnapshot = (value: unknown): value is BackupSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as BackupSnapshot;
  if (!Number.isFinite(snapshot.savedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.dateKey) || typeof snapshot.text !== 'string') return false;
  try { parseSaveFileText(snapshot.text, snapshot.savedAt); return true; } catch { return false; }
};
export const readBackupSnapshots = async (): Promise<{ snapshots: BackupSnapshot[]; warnings: string[] }> => {
  if (isNativeApp()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const { files, warnings } = await invoke<{ files: string[]; warnings: string[] }>('read_backup_files');
    const snapshots = files.flatMap((text) => {
      try { const value: unknown = JSON.parse(text); if (validateSnapshot(value)) return [value]; } catch { /* Skip invalid recovery points. */ }
      warnings.push('Invalid backup data');
      return [];
    });
    return { snapshots: trimBackupSnapshots(snapshots), warnings };
  }
  const db = await openDatabase();
  try {
    return await new Promise<{ snapshots: BackupSnapshot[]; warnings: string[] }>((resolve, reject) => {
      const request = db.transaction('snapshots').objectStore('snapshots').getAll();
      request.onsuccess = () => resolve({ snapshots: trimBackupSnapshots(request.result.filter(validateSnapshot)), warnings: [] });
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
};
export const listBackupSnapshots = async (): Promise<BackupSnapshot[]> => (await readBackupSnapshots()).snapshots;
const writeSnapshot = async (snapshot: BackupSnapshot, force: boolean, preferences: BackupPreferences) => {
  assertStorageUnchanged();
  if (isNativeApp()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('write_backup_files', { snapshot: JSON.stringify(snapshot) });
    return;
  }
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      const request = store.getAll();
      request.onsuccess = () => {
        const current = trimBackupSnapshots(request.result.filter(validateSnapshot));
        if (!force && !isBackupDue(current[0], preferences, snapshot.savedAt)) return;
        const keep = trimBackupSnapshots([...current, snapshot]);
        store.put(snapshot);
        for (const old of request.result as BackupSnapshot[]) {
          if (!keep.some((item) => item.dateKey === old.dateKey)) store.delete(old.dateKey);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
};
export const readBackupState = async (): Promise<BackupState> => {
  const { snapshots, warnings } = await readBackupSnapshots();
  if (isNativeApp()) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      const latest = await invoke<string | null>('read_backup_latest');
      return { snapshots, warnings, fileStatus: !snapshots.length || latest === snapshots[0]?.text ? 'native' : 'error', fileSavedAt: latest === snapshots[0]?.text ? snapshots[0]?.savedAt : undefined };
    } catch (error) {
      return { snapshots, warnings, fileStatus: 'error', error: String(error) };
    }
  }
  const handle = canChooseBackupFile() ? await readSetting<BackupFileHandle>('file') : undefined;
  let fileStatus: BackupFileStatus = !canChooseBackupFile() ? 'unsupported' : !handle ? 'unconfigured' : 'permission';
  if (handle) {
    try { if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') fileStatus = 'saved'; }
    catch { /* An expired handle must not prevent internal recovery points. */ }
  }
  return {
    snapshots, warnings, fileStatus,
    fileSavedAt: await readSetting<number>('fileSavedAt'),
  };
};
const syncExternalFile = async (state: BackupState) => {
  const latest = state.snapshots[0];
  if (!latest || isNativeApp() || !canChooseBackupFile()) return state;
  const handle = await readSetting<BackupFileHandle>('file');
  if (!handle || state.fileStatus === 'permission' || state.fileSavedAt === latest.savedAt) return state;
  assertStorageUnchanged();
  const writable = await handle.createWritable();
  try { await writable.write(latest.text); await writable.close(); }
  catch (error) { await writable.abort().catch(() => undefined); throw error; }
  await writeSetting('fileSavedAt', latest.savedAt);
  return { ...state, fileStatus: 'saved' as const, fileSavedAt: latest.savedAt };
};
let queue: Promise<unknown> = Promise.resolve();
export const runAutomaticBackup = (pet: PetState, mod?: PocPetSaveModSummary, force = false, isPaused = () => false): Promise<BackupState> => {
  const operation = async () => {
    const preferences = readBackupPreferences();
    let state = await readBackupState();
    if (isPaused() || !preferences.enabled && !force) return state;
    if (isNativeApp() && state.fileStatus === 'error' && state.snapshots[0]) {
      try { await writeSnapshot(state.snapshots[0], true, preferences); }
      catch (error) { return { ...state, error: String(error) }; }
      state = await readBackupState();
    }
    if (isPaused()) return state;
    if (force || isBackupDue(state.snapshots[0], preferences)) {
      const now = Date.now();
      const snapshot: BackupSnapshot = { dateKey: localDateKey(now), savedAt: now, petName: pet.name, level: pet.level, text: createSaveFileText(pet, mod, now) };
      parseSaveFileText(snapshot.text, now);
      await writeSnapshot(snapshot, force, preferences);
      state = await readBackupState();
    }
    if (isPaused()) return state;
    try { return await syncExternalFile(state); }
    catch (error) { return { ...state, fileStatus: 'error' as const, error: String(error) }; }
  };
  const task = queue.catch(() => undefined).then(async () => navigator.locks
    ? await navigator.locks.request('pocpet-automatic-backup', operation) : await operation());
  queue = task;
  return task;
};
export const chooseBackupFile = async () => {
  if (!canChooseBackupFile()) throw new Error('File binding is unavailable.');
  const handle = await (window as PickerWindow).showSaveFilePicker!({ suggestedName: automaticBackupFileName });
  if (handle.name !== automaticBackupFileName) throw new Error(`Use the dedicated file name: ${automaticBackupFileName}`);
  await writeSetting('file', handle);
  await writeSetting('fileSavedAt', null);
  return syncExternalFile(await readBackupState());
};
export const authorizeBackupFile = async () => {
  const handle = await readSetting<BackupFileHandle>('file');
  if (handle) await handle.requestPermission({ mode: 'readwrite' });
  return syncExternalFile(await readBackupState());
};
export const readExternalBackup = async (): Promise<string | undefined> => {
  if (isNativeApp()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return (await invoke<string | null>('read_backup_latest')) ?? undefined;
  }
  if (!canChooseBackupFile()) return undefined;
  const handle = await readSetting<BackupFileHandle>('file');
  if (!handle || await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') return undefined;
  return (await handle.getFile()).text();
};
