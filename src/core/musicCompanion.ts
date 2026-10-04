import type { PetState } from './petTypes';
import { recordEarnedHearts } from './achievements';

export interface NativeListeningReceipt {
  sessionId: string;
  owner: string;
  milliseconds: number;
}
export interface MusicCompanionState {
  schemaVersion: 2;
  pendingListeningMs: number;
  nativeCheckpoint?: { sessionId: string; milliseconds: number };
}

export const musicHeartIntervalMs = 2 * 60 * 1000;
export const musicHeartsPerInterval = 2;
export const defaultMusicCompanionState = (): MusicCompanionState => ({ schemaVersion: 2, pendingListeningMs: 0 });
export const normalizeMusicCompanionState = (value: unknown): MusicCompanionState => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ms = raw.pendingListeningMs;
  const checkpoint = raw.nativeCheckpoint as MusicCompanionState['nativeCheckpoint'];
  return { schemaVersion: 2, pendingListeningMs: typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(ms))) : 0,
    ...(checkpoint && typeof checkpoint.sessionId === 'string' && checkpoint.sessionId.length <= 128
      && Number.isSafeInteger(checkpoint.milliseconds) && checkpoint.milliseconds >= 0
      ? { nativeCheckpoint: { sessionId: checkpoint.sessionId, milliseconds: checkpoint.milliseconds } } : {}) };
};
export const addMusicListeningTime = (pet: PetState, milliseconds: number): PetState => {
  if (pet.timePause || !Number.isFinite(milliseconds) || milliseconds < 1) return pet;
  return { ...pet, musicCompanion: { ...pet.musicCompanion,
    pendingListeningMs: Math.min(Number.MAX_SAFE_INTEGER, pet.musicCompanion.pendingListeningMs + Math.floor(milliseconds)) } };
};
// The checkpoint and the earned time travel through the same save transaction.
// A receipt contains only actual eligible playback, including time before a freeze.
export const applyNativeListeningReceipt = (pet: PetState, owner: string, receipt: NativeListeningReceipt): PetState => {
  if (receipt.owner !== owner || !receipt.sessionId || receipt.sessionId.length > 128
    || !Number.isSafeInteger(receipt.milliseconds) || receipt.milliseconds < 0) return pet;
  const checkpoint = pet.musicCompanion.nativeCheckpoint;
  const previous = checkpoint?.sessionId === receipt.sessionId ? checkpoint.milliseconds : 0;
  if (receipt.milliseconds <= previous) return pet;
  return { ...pet, musicCompanion: { ...pet.musicCompanion,
    pendingListeningMs: Math.min(Number.MAX_SAFE_INTEGER, pet.musicCompanion.pendingListeningMs + receipt.milliseconds - previous),
    nativeCheckpoint: { sessionId: receipt.sessionId, milliseconds: receipt.milliseconds } } };
};
export const getMusicHeartReward = (pet: PetState) => Math.floor(pet.musicCompanion.pendingListeningMs / musicHeartIntervalMs) * musicHeartsPerInterval;
export const claimMusicHearts = (pet: PetState): PetState => {
  const hearts = getMusicHeartReward(pet);
  if (pet.timePause || hearts === 0) return pet;
  // This is a fixed companionship reward: do not apply random/card bonuses.
  return recordEarnedHearts({ ...pet, hearts: pet.hearts + hearts,
    musicCompanion: { ...pet.musicCompanion, pendingListeningMs: pet.musicCompanion.pendingListeningMs % musicHeartIntervalMs },
    recentEvent: `和${pet.name}一起听了一会儿音乐，收获 ${hearts} 颗小心心。`,
  }, hearts);
};
