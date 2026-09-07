export const releaseRepository = 'T-meow/PocPet';
export const releasePageUrl = `https://github.com/${releaseRepository}/releases/latest`;
export const releaseApiUrl = `https://api.github.com/repos/${releaseRepository}/releases/latest`;
export const updateManifestName = 'update-info.json';
export const updateCheckInterval = 24 * 60 * 60 * 1000;

export interface ClientTarget { platform: string; arch: string }
export interface UpdateAsset { name: string; url: string; size: number }
export interface ClientUpdate {
  version: string;
  notes: string;
  pageUrl: string;
  publishedAt?: string;
  asset?: UpdateAsset;
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const stableVersion = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return undefined;
  const version = value.replace(/^v/, '');
  return version.split('.').every((part) => Number.isSafeInteger(Number(part))) ? version : undefined;
};
export const compareVersions = (left: string, right: string) => {
  const a = stableVersion(left), b = stableVersion(right);
  if (!a || !b) throw new Error('Invalid stable version');
  const parts = a.split('.').map(Number), other = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (parts[index] !== other[index]) return parts[index] > other[index] ? 1 : -1;
  return 0;
};

export const readReleaseAsset = (release: unknown, name: string): UpdateAsset | undefined => {
  if (!record(release) || !stableVersion(release.tag_name) || !Array.isArray(release.assets)) return undefined;
  const asset = release.assets.find((item) => record(item) && item.name === name);
  if (!record(asset) || asset.state !== 'uploaded' || typeof asset.size !== 'number' || !Number.isSafeInteger(asset.size) || asset.size <= 0) return undefined;
  const expectedUrl = `https://github.com/${releaseRepository}/releases/download/${encodeURIComponent(String(release.tag_name))}/${encodeURIComponent(name)}`;
  return asset.browser_download_url === expectedUrl ? { name, url: expectedUrl, size: asset.size } : undefined;
};

export const selectClientUpdate = (release: unknown, currentVersion: string, target: ClientTarget, manifest?: unknown): ClientUpdate | null => {
  if (release === null) return null;
  if (!record(release) || typeof release.draft !== 'boolean' || typeof release.prerelease !== 'boolean' || !Array.isArray(release.assets)) throw new Error('Invalid release');
  if (release.draft || release.prerelease) return null;
  const version = stableVersion(release.tag_name);
  if (!version) throw new Error('Invalid release version');
  if (compareVersions(version, currentVersion) <= 0) return null;
  const key = `${target.platform}-${target.arch}`;
  const targetNames: Record<string, string[]> = {
    'windows-x86_64': [`pocket${version}.exe`],
    'windows-x86': [`pocket${version}-win32.exe`],
    'android-aarch64': [`pocket${version}.apk`],
    'android-arm': [`pocket${version}-32bit.apk`],
    'linux-x86_64': [`pocket${version}-ubuntu.AppImage`, `pocket${version}-ubuntu.deb`],
    'macos-aarch64': [`pocket${version}-mac.dmg`],
    'macos-x86_64': [`pocket${version}-mac.dmg`],
  };
  let asset: UpdateAsset | undefined;
  if (manifest !== undefined) {
    if (!record(manifest) || manifest.version !== version || manifest.edition !== 'standard' || !record(manifest.platforms)) throw new Error('Invalid update manifest');
    const entry = manifest.platforms[key];
    if (entry !== undefined) {
      if (!record(entry) || typeof entry.asset !== 'string' || !targetNames[key]?.includes(entry.asset)) throw new Error('Invalid update target');
      asset = readReleaseAsset(release, entry.asset);
      if (!asset || asset.size !== entry.size) throw new Error('Update asset mismatch');
    }
  } else {
    // Legacy names identify these targets; old macOS packages do not identify their architecture.
    if (target.platform !== 'macos') asset = targetNames[key]?.map((name) => readReleaseAsset(release, name)).find(Boolean);
  }
  return {
    version, asset,
    notes: typeof release.body === 'string' ? release.body.slice(0, 30_000) : '',
    pageUrl: `https://github.com/${releaseRepository}/releases/tag/${encodeURIComponent(String(release.tag_name))}`,
    publishedAt: typeof release.published_at === 'string' && Number.isFinite(Date.parse(release.published_at)) ? release.published_at : undefined,
  };
};
