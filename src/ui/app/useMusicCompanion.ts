import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import type { PetState } from '../../core/petTypes';
import { acknowledgeNativeMusic, beginMusicCompanion, bindMusicOwner, discardNativeMusic, endMusicCompanion, getBgmPlaybackState,
  getMeasuredListeningMs, getNativeListeningReceipt, pauseMusicCompanion, refreshNativeMusic, setMusicRewardEnabled,
  subscribeBgmPlayback, usesNativeMusic, waitForNativeMusic } from '../../core/bgm';
import { addMusicListeningTime, claimMusicHearts } from '../../core/pet';
import type { NativeListeningReceipt } from '../../core/musicCompanion';
import { flushNativeSave, getNativeSaveError } from '../../platform/nativeSave';
import { isNativeApp } from '../../platform/edition';

interface Options {
  pet: PetState;
  petRef: MutableRefObject<PetState>;
  actorId: string;
  blocked: boolean;
  save: (pet: PetState, mode?: 'quiet' | 'action' | 'event') => PetState | undefined;
  saveListeningReceipt: (owner: string, receipt: NativeListeningReceipt) => PetState | undefined;
  commit: (pet: PetState, options?: { silent?: boolean }) => PetState;
}
const ownerOf = (options: Options) => `${options.pet.saveMetadata.id}:${options.actorId}`;

export const useMusicCompanion = (options: Options) => {
  const playback = useSyncExternalStore(subscribeBgmPlayback, getBgmPlaybackState, getBgmPlaybackState);
  const latest = useRef(options); latest.current = options;
  const acknowledged = useRef(getBgmPlaybackState().measuredListeningMs);
  const identity = ownerOf(options);
  const [ready, setReady] = useState(!isNativeApp());
  const [busy, setBusy] = useState(false);
  const [initializationError, setInitializationError] = useState('');
  const checkpointQueue = useRef(Promise.resolve(true));
  const checkpoint = () => {
    if (!usesNativeMusic()) {
      // Save synchronously on pagehide; the page may not run another microtask.
      const current = latest.current;
      const delta = Math.floor(getMeasuredListeningMs() - acknowledged.current);
      if (current.blocked) { setMusicRewardEnabled(false); pauseMusicCompanion(); return Promise.resolve(false); }
      if (current.petRef.current.timePause || delta < 1) return Promise.resolve(true);
      if (!current.save(addMusicListeningTime(current.petRef.current, delta), 'quiet')) {
        setMusicRewardEnabled(false); pauseMusicCompanion(); return Promise.resolve(false);
      }
      acknowledged.current += delta;
      return Promise.resolve(true);
    }
    const owner = ownerOf(latest.current);
    checkpointQueue.current = checkpointQueue.current.then(async () => {
      await refreshNativeMusic();
      const current = latest.current;
      if (current.blocked || ownerOf(current) !== owner) return false;
      const receipt = getNativeListeningReceipt();
      if (!receipt || receipt.owner !== owner || receipt.milliseconds === 0) return true;
      const saved = current.saveListeningReceipt(owner, receipt)?.musicCompanion.nativeCheckpoint;
      if (saved?.sessionId !== receipt.sessionId || saved.milliseconds < receipt.milliseconds) return false;
      await flushNativeSave();
      if (getNativeSaveError() || ownerOf(latest.current) !== owner || latest.current.blocked) return false;
      await acknowledgeNativeMusic(receipt.sessionId, receipt.milliseconds);
      return true;
    }).catch(() => false).then(ok => {
      if (!ok) { setMusicRewardEnabled(false); pauseMusicCompanion(); }
      return ok;
    });
    return checkpointQueue.current;
  };
  const checkpointRef = useRef(checkpoint); checkpointRef.current = checkpoint;

  useEffect(() => {
    let disposed = false;
    acknowledged.current = getMeasuredListeningMs();
    setReady(!isNativeApp());
    void bindMusicOwner(identity).then(() => {
      if (!disposed) { setReady(true); setInitializationError(''); void checkpointRef.current(); }
    }).catch(() => { if (!disposed) setInitializationError('音乐服务连接失败，请重启游戏后重试。'); });
    // Unmounting a WebView must not stop an Android media service.
    return () => { disposed = true; };
  }, [identity]);

  useLayoutEffect(() => {
    setMusicRewardEnabled(!options.blocked && !options.pet.timePause);
    if (options.blocked) pauseMusicCompanion();
  }, [identity, options.blocked, Boolean(options.pet.timePause)]);

  useEffect(() => {
    const flush = () => { void checkpointRef.current(); };
    const timer = window.setInterval(flush, 5000);
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);

  const start = () => { if (ready && !latest.current.blocked) { setMusicRewardEnabled(!latest.current.petRef.current.timePause); beginMusicCompanion(); } };
  const pause = () => { pauseMusicCompanion(); void checkpoint(); };
  const detach = async (discardUnsaved = false) => {
    pauseMusicCompanion();
    if (!await checkpoint() && !discardUnsaved) throw new Error('聆听进度尚未保存，请先处理存档提示。');
    if (usesNativeMusic()) await discardNativeMusic();
    else if (getBgmPlaybackState().active) endMusicCompanion();
    acknowledged.current = getMeasuredListeningMs();
  };
  const finish = async (): Promise<number | undefined> => {
    if (busy) return;
    setBusy(true);
    try {
      pauseMusicCompanion();
      if (!await checkpoint()) return;
      const current = latest.current, before = current.petRef.current;
      const next = claimMusicHearts(before);
      if (next !== before && !current.save(current.commit(next, { silent: true }), 'event')) return;
      endMusicCompanion();
      await waitForNativeMusic();
      return next.hearts - before.hearts;
    } finally { setBusy(false); }
  };
  const receipt = getNativeListeningReceipt(), saved = options.pet.musicCompanion.nativeCheckpoint;
  const uncommitted = usesNativeMusic() ? receipt?.owner === identity
    ? Math.max(0, receipt.milliseconds - (saved?.sessionId === receipt.sessionId ? saved.milliseconds : 0)) : 0
    : Math.max(0, Math.floor(playback.measuredListeningMs - acknowledged.current));
  return { playback: initializationError ? { ...playback, error: initializationError } : playback,
    pendingListeningMs: options.pet.musicCompanion.pendingListeningMs + uncommitted, start, pause, finish, detach, busy: busy || !ready };
};
