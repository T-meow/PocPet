import { appBuild, isNativeApp } from './edition';
import { readReleaseAsset, releaseApiUrl, selectClientUpdate, updateCheckInterval, updateManifestName, type ClientTarget, type ClientUpdate } from '../core/clientUpdates';

const preferencesKey = 'pocpet.client-updates.v1';
const cacheKey = 'pocpet.client-updates.cache.v1';
export interface UpdatePreferences { enabled: boolean; ignoredVersion: string; snoozedVersion: string; snoozedAt: number; lastAttemptAt: number }
let volatilePreferences: UpdatePreferences | undefined;
export interface UpdateCheck { target: ClientTarget; update: ClientUpdate | null; checkedAt?: number }
export class UpdateCheckError extends Error {
  constructor(public reason: 'network' | 'rateLimit' | 'invalid' | 'platform' | 'openFailed') { super(reason); }
}
export const supportsClientUpdates = () => isNativeApp() && appBuild.edition === 'standard';
export const readUpdatePreferences = (): UpdatePreferences => {
  if (volatilePreferences) return { ...volatilePreferences };
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
    return {
      enabled: value?.enabled !== false,
      ignoredVersion: typeof value?.ignoredVersion === 'string' ? value.ignoredVersion : '',
      snoozedVersion: typeof value?.snoozedVersion === 'string' ? value.snoozedVersion : '',
      snoozedAt: Number.isFinite(value?.snoozedAt) ? value.snoozedAt : 0,
      lastAttemptAt: Number.isFinite(value?.lastAttemptAt) ? value.lastAttemptAt : 0,
    };
  } catch { return { enabled: true, ignoredVersion: '', snoozedVersion: '', snoozedAt: 0, lastAttemptAt: 0 }; }
};
export const writeUpdatePreferences = (changes: Partial<UpdatePreferences>) => {
  const next = { ...readUpdatePreferences(), ...changes };
  try { localStorage.setItem(preferencesKey, JSON.stringify(next)); volatilePreferences = undefined; }
  catch { volatilePreferences = next; }
  return next;
};
export const shouldRemindUpdate = (update: ClientUpdate | null, preferences: UpdatePreferences, now = Date.now()) => Boolean(
  update && update.version !== preferences.ignoredVersion &&
  (update.version !== preferences.snoozedVersion || now - preferences.snoozedAt >= updateCheckInterval),
);

let targetPromise: Promise<ClientTarget> | undefined;
export const getClientTarget = () => {
  if (!supportsClientUpdates()) return Promise.reject(new UpdateCheckError('platform'));
  targetPromise ??= import('@tauri-apps/api/core').then(({ invoke }) => invoke<ClientTarget>('get_client_update_target')).catch(() => {
    targetPromise = undefined;
    throw new UpdateCheckError('platform');
  });
  return targetPromise;
};
const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('read_client_update_json', { url });
  } catch (error) {
    throw new UpdateCheckError(error === 'rateLimit' || error === 'invalid' ? error : 'network');
  }
};
let inFlight: Promise<UpdateCheck> | undefined;
export const checkClientUpdate = (force = false): Promise<UpdateCheck> => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const target = await getClientTarget();
    const preferences = readUpdatePreferences();
    const now = Date.now();
    if (!force && (!preferences.enabled || now >= preferences.lastAttemptAt && now - preferences.lastAttemptAt < updateCheckInterval)) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Number.isFinite(cached.checkedAt)) return { target, update: selectClientUpdate(cached.release, appBuild.version, target, cached.manifest), checkedAt: cached.checkedAt };
      } catch { /* Ignore an invalid cache and keep the manual check available. */ }
      return { target, update: null };
    }
    writeUpdatePreferences({ lastAttemptAt: now });
    const release = await fetchJson(releaseApiUrl);
    let update: ClientUpdate | null;
    let manifest: unknown;
    try { update = selectClientUpdate(release, appBuild.version, target); } catch { throw new UpdateCheckError('invalid'); }
    if (update) {
      const asset = readReleaseAsset(release, updateManifestName);
      if (asset) manifest = await fetchJson(asset.url);
      try { update = selectClientUpdate(release, appBuild.version, target, manifest); } catch { throw new UpdateCheckError('invalid'); }
    }
    try { localStorage.setItem(cacheKey, JSON.stringify({ checkedAt: now, release, manifest })); } catch { /* The current check remains usable without a cache. */ }
    return { target, update, checkedAt: now };
  })().finally(() => { inFlight = undefined; });
  return inFlight;
};
export const openUpdateUrl = async (url: string) => {
  if (!supportsClientUpdates() || !url.startsWith('https://github.com/T-meow/PocPet/releases/')) throw new UpdateCheckError('openFailed');
  try { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
  catch { throw new UpdateCheckError('openFailed'); }
};
