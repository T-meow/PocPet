export type ToyAbility =
  | 'navigate'
  | 'saveImageToAlbum'
  | 'share'
  | 'getQrCode'
  | 'closeBrowser'
  | 'getCloudStorage'
  | 'setCloudStorage'
  | 'removeCloudStorage'
  | 'getAuthorProfile'
  | 'getAuthorVideos'
  | 'getAuthorRelation';

export interface ToyCloudStorage {
  getCloudStorage(keys?: string[]): Promise<Record<string, string>>;
  setCloudStorage(items: Record<string, string>): Promise<void>;
  removeCloudStorage(keys: string[]): Promise<void>;
}

export interface ToySdk extends ToyCloudStorage {
  isSupport(ability: ToyAbility): Promise<boolean>;
  navigate(req: { type: 'video' | 'space'; id: string; extra?: Record<string, string> }): Promise<void>;
  saveImageToAlbum(req: { url?: string; base64Data?: string; hintMsg?: string }): Promise<{ localPath: string }>;
  share(req: { path: string }): Promise<void>;
  getQrCode(req?: { path?: string; size?: number }): Promise<{ base64: string; url: string }>;
  getAuthorProfile(): Promise<unknown>;
  getAuthorVideos(req: { videos: Array<{ aid: number } | { bvid: string }> }): Promise<unknown>;
  getAuthorRelation(): Promise<unknown>;
}

declare global {
  interface Window {
    toy?: ToySdk;
  }
}

export const pocPetAuthorSpaceId = '37393114';
export const pocPetIntroVideoBvid = 'BV1zmTX6iEgn';

const toyAbilityProbeTimeoutMs = 3_000;

export const withToySdkTimeout = <T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) => new Promise<T>((resolve, reject) => {
  const timer = globalThis.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  operation.then(
    (value) => {
      globalThis.clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      globalThis.clearTimeout(timer);
      reject(error);
    },
  );
});

export const getToySdk = (): ToySdk | undefined =>
  typeof window === 'undefined' ? undefined : window.toy;

export const getSafeToyPageUrl = (href = typeof window === 'undefined' ? '' : window.location.href) => {
  try {
    const url = new URL(href);
    const isBilibiliHost = url.hostname === 'bilibili.com' || url.hostname.endsWith('.bilibili.com');
    return isBilibiliHost && url.pathname.startsWith('/toy/') ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export const isToyPreviewUrl = (url: string) => {
  try {
    return /^\/toy\/preview\/preview_[^/]+\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

export const openToySharePanel = (sdk = getToySdk()) => {
  if (!sdk) throw new Error('Toy SDK is unavailable.');
  return sdk.share({ path: 'index.html' });
};

export const supportsToyAbility = async (ability: ToyAbility, sdk = getToySdk()) => {
  if (!sdk) return false;
  try {
    return await withToySdkTimeout(
      sdk.isSupport(ability),
      toyAbilityProbeTimeoutMs,
      `Toy ability probe timed out: ${ability}`,
    );
  } catch {
    return false;
  }
};

export const supportsToyCloudStorage = async (sdk = getToySdk()) => {
  if (!sdk) return false;
  const support = await Promise.all([
    supportsToyAbility('getCloudStorage', sdk),
    supportsToyAbility('setCloudStorage', sdk),
    supportsToyAbility('removeCloudStorage', sdk),
  ]);
  return support.every(Boolean);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const readAuthorFollowing = (value: unknown): boolean | undefined => {
  if (!isRecord(value) || value.status !== 'ok' || !isRecord(value.data)) return undefined;
  return typeof value.data.isFollowing === 'boolean' ? value.data.isFollowing : undefined;
};

export interface ToyAuthorSummary {
  nickname?: string;
  avatar?: string;
  follower?: number;
}

export interface ToyAuthorVideoSummary {
  bvid: string;
  title?: string;
  cover?: string;
}

export const readAuthorSummary = (value: unknown): ToyAuthorSummary => {
  if (!isRecord(value) || value.status !== 'ok' || !isRecord(value.data)) return {};
  const data = value.data;
  return {
    nickname: typeof data.nickname === 'string' ? data.nickname : undefined,
    avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
    follower: typeof data.follower === 'number' && Number.isFinite(data.follower) ? data.follower : undefined,
  };
};

export const readAuthorVideoSummary = (value: unknown, expectedBvid: string): ToyAuthorVideoSummary => {
  if (!isRecord(value) || value.status !== 'ok') return { bvid: expectedBvid };
  const data = value.data;
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray(value.items)
      ? value.items
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : isRecord(data) && Array.isArray(data.videos)
        ? data.videos
        : [];
  const item = candidates.find((candidate) => isRecord(candidate) && candidate.bvid === expectedBvid);
  if (!isRecord(item)) return { bvid: expectedBvid };
  return {
    bvid: expectedBvid,
    title: typeof item.title === 'string' ? item.title : undefined,
    cover: typeof item.cover === 'string'
      ? item.cover
      : typeof item.pic === 'string'
        ? item.pic
        : undefined,
  };
};

export const openAuthorSpace = async (sdk = getToySdk()) => {
  if (sdk) {
    await sdk.navigate({ type: 'space', id: pocPetAuthorSpaceId, extra: { from: 'pocpet' } });
    return 'toy' as const;
  }
  const url = `https://space.bilibili.com/${pocPetAuthorSpaceId}`;
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return 'external' as const;
};

export const openIntroVideo = async (sdk = getToySdk()) => {
  if (sdk) {
    await sdk.navigate({ type: 'video', id: pocPetIntroVideoBvid, extra: { from: 'pocpet' } });
    return 'toy' as const;
  }
  const url = `https://www.bilibili.com/video/${pocPetIntroVideoBvid}`;
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return 'external' as const;
};
