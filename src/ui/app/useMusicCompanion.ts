import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type MutableRefObject } from 'react';
import type { PetState } from '../../core/petTypes';
import { beginMusicCompanion, endMusicCompanion, getBgmPlaybackState, getMeasuredListeningMs, pauseMusicCompanion, setMusicRewardEnabled, subscribeBgmPlayback } from '../../core/bgm';
import { addMusicListeningTime, claimMusicHearts } from '../../core/pet';

interface Options {
  pet: PetState;
  petRef: MutableRefObject<PetState>;
  actorId: string;
  blocked: boolean;
  save: (pet: PetState, mode?: 'quiet' | 'action' | 'event') => PetState | undefined;
  commit: (pet: PetState, options?: { silent?: boolean }) => PetState;
}

export const useMusicCompanion = (options: Options) => {
  const playback = useSyncExternalStore(subscribeBgmPlayback, getBgmPlaybackState, getBgmPlaybackState);
  const latest = useRef(options);
  latest.current = options;
  const acknowledged = useRef(getBgmPlaybackState().measuredListeningMs);
  const identity = `${options.pet.saveMetadata.id}:${options.actorId}`;
  const checkpoint = () => {
    const current = latest.current;
    if (current.blocked) return false;
    if (current.petRef.current.timePause) return true;
    const delta = Math.floor(getMeasuredListeningMs() - acknowledged.current);
    if (delta < 1) return true;
    const saved = current.save(addMusicListeningTime(current.petRef.current, delta), 'quiet');
    if (!saved) {
      setMusicRewardEnabled(false);
      pauseMusicCompanion();
      return false;
    }
    acknowledged.current += delta;
    return true;
  };
  const checkpointRef = useRef(checkpoint);
  checkpointRef.current = checkpoint;

  useLayoutEffect(() => {
    acknowledged.current = getMeasuredListeningMs();
    return () => {
      setMusicRewardEnabled(false);
      if (getBgmPlaybackState().active) endMusicCompanion();
    };
  }, [identity]);

  useLayoutEffect(() => {
    setMusicRewardEnabled(!options.blocked && !options.pet.timePause);
    if (options.blocked) pauseMusicCompanion();
  }, [identity, options.blocked, Boolean(options.pet.timePause)]);

  useEffect(() => {
    const flush = () => { checkpointRef.current(); };
    const timer = window.setInterval(flush, 5000);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const start = () => { if (!latest.current.blocked) beginMusicCompanion(); };
  const pause = () => { pauseMusicCompanion(); checkpoint(); };
  const detach = () => {
    pauseMusicCompanion();
    checkpoint();
    if (getBgmPlaybackState().active) endMusicCompanion();
    acknowledged.current = getMeasuredListeningMs();
  };
  const finish = (): number | undefined => {
    pauseMusicCompanion();
    if (!checkpoint()) return;
    const current = latest.current;
    const before = current.petRef.current;
    const next = claimMusicHearts(before);
    if (next !== before && !current.save(current.commit(next, { silent: true }), 'event')) return;
    endMusicCompanion();
    return next.hearts - before.hearts;
  };
  const pendingListeningMs = options.pet.musicCompanion.pendingListeningMs + Math.max(0, Math.floor(playback.measuredListeningMs - acknowledged.current));
  return { playback, pendingListeningMs, start, pause, finish, detach };
};
