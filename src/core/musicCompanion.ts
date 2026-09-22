import type { PetState } from './petTypes';
import { recordEarnedHearts } from './achievements';

export interface MusicCompanionState {
  schemaVersion: 1;
  pendingListeningMs: number;
}

export const musicHeartIntervalMs = 2 * 60 * 1000;
export const defaultMusicCompanionState = (): MusicCompanionState => ({ schemaVersion: 1, pendingListeningMs: 0 });
export const normalizeMusicCompanionState = (value: unknown): MusicCompanionState => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ms = raw.pendingListeningMs;
  return { schemaVersion: 1, pendingListeningMs: typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(ms))) : 0 };
};
export const addMusicListeningTime = (pet: PetState, milliseconds: number): PetState => {
  if (pet.timePause || !Number.isFinite(milliseconds) || milliseconds < 1) return pet;
  return { ...pet, musicCompanion: { schemaVersion: 1,
    pendingListeningMs: Math.min(Number.MAX_SAFE_INTEGER, pet.musicCompanion.pendingListeningMs + Math.floor(milliseconds)) } };
};
export const getMusicHeartReward = (pet: PetState) => Math.floor(pet.musicCompanion.pendingListeningMs / musicHeartIntervalMs);
export const claimMusicHearts = (pet: PetState): PetState => {
  const hearts = getMusicHeartReward(pet);
  if (pet.timePause || hearts === 0) return pet;
  // This is a fixed companionship reward: do not apply random/card bonuses.
  return recordEarnedHearts({ ...pet, hearts: pet.hearts + hearts,
    musicCompanion: { schemaVersion: 1, pendingListeningMs: pet.musicCompanion.pendingListeningMs % musicHeartIntervalMs },
    recentEvent: `和${pet.name}一起听了一会儿音乐，收获 ${hearts} 颗小心心。`,
  }, hearts);
};
