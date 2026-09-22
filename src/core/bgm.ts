import room from '../assets/audio/bgm/bgm_room_loop.mp3';
import shop from '../assets/audio/bgm/bgm_shop_loop.mp3';
import sleep from '../assets/audio/bgm/bgm_sleep_loop.mp3';
import gardenF1 from '../assets/audio/bgm/bgm_garden_f1.mp3';
import gardenF2 from '../assets/audio/bgm/bgm_garden_f2.mp3';
import fishingF3 from '../assets/audio/bgm/bgm_fishing_f3.mp3';
import fishingF4 from '../assets/audio/bgm/bgm_fishing_f4.mp3';
import adventureA2 from '../assets/audio/bgm/bgm_adventure_a2.mp3';
import adventureA5 from '../assets/audio/bgm/bgm_adventure_a5.mp3';
import nightA3 from '../assets/audio/bgm/bgm_night_a3.mp3';
import nightA4 from '../assets/audio/bgm/bgm_night_a4.mp3';

export type BgmMode = 'room' | 'sleep' | 'shop' | 'community' | 'garden' | 'fishing' | 'adventure' | 'night';
export type BgmRepeatMode = 'sequence' | 'single';
export const bgmTracks = [
  { id: 'room', title: '小窝时光', source: room },
  { id: 'gardenF1', title: '午后云朵', source: gardenF1 },
  { id: 'gardenF2', title: '轻松爵士', source: gardenF2 },
  { id: 'fishingF3', title: '溪边吉他 · 一', source: fishingF3 },
  { id: 'fishingF4', title: '溪边吉他 · 二', source: fishingF4 },
  { id: 'adventureA2', title: '轻快的旅途', source: adventureA2 },
  { id: 'adventureA5', title: '向着远方', source: adventureA5 },
  { id: 'nightA3', title: '夜色吉他 · 一', source: nightA3 },
  { id: 'nightA4', title: '夜色吉他 · 二', source: nightA4 },
  { id: 'shop', title: '小店闲逛', source: shop },
  { id: 'sleep', title: '晚安好梦', source: sleep },
] as const;
export type BgmTrackId = typeof bgmTracks[number]['id'];
type Scene = Exclude<BgmMode, 'community' | 'garden'>;
const playlists: Record<Scene, readonly BgmTrackId[]> = {
  room: ['room', 'gardenF1', 'gardenF2'], shop: ['shop'], sleep: ['sleep'],
  fishing: ['fishingF3', 'fishingF4'], adventure: ['adventureA2', 'adventureA5'], night: ['nightA3', 'nightA4'],
};
const allTracks = bgmTracks.map(track => track.id);
const canonicalScene = (mode: BgmMode): Scene => mode === 'community' || mode === 'garden' ? 'room' : mode;
const readPreference = (key: string) => {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; }
};
const writePreference = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* Audio remains usable without preference storage. */ }
};
const storedVolume = readPreference('pocpet.audio.bgmVolume');
let volume = storedVolume !== null && storedVolume.trim() !== '' && Number.isFinite(Number(storedVolume))
  ? Math.max(0, Math.min(1, Number(storedVolume))) : 0.6;
let allowBackground = readPreference('pocpet.audio.musicBackground') === 'true';
export const supportsMusicBackground = typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent);
let repeatMode: BgmRepeatMode = 'sequence';
let enabled = true;
let unlocked = false;
let hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
let desiredScene: Scene = 'room';
let currentScene: Scene | undefined;
const sceneIndexes: Partial<Record<Scene, number>> = {};
let audio: HTMLAudioElement | undefined;
let trackId: BgmTrackId | undefined;
let playing = false;
let playPending = false;
let fadeTimer: ReturnType<typeof setInterval> | undefined;
let active = false;
let userPaused = false;
let rewardEnabled = false;
let error = '';
let needsGesture = false;
const failedTracks = new Set<BgmTrackId>();
let measuredMs = 0;
let sessionStartMs = 0;
let meterPosition = 0;
let meterClock = 0;
let meterEligible = false;
const clock = () => performance.now();
const backgroundAllowed = () => !hidden || active && allowBackground && supportsMusicBackground;
const canCount = () => Boolean(active && rewardEnabled && enabled && backgroundAllowed() && !userPaused && playing && audio && !audio.paused && !audio.seeking && !audio.muted && audio.volume > 0);
const resetMeter = () => {
  meterPosition = audio?.currentTime ?? 0;
  meterClock = clock();
  meterEligible = canCount();
};
const samplePlayback = () => {
  const position = audio?.currentTime ?? 0;
  const elapsed = Math.max(0, clock() - meterClock);
  // Media progress excludes buffering and offline time. The monotonic clock
  // bounds discontinuities; seeks are reset separately and never earn time.
  if (meterEligible && !audio?.seeking && Number.isFinite(position)) {
    const delta = (position - meterPosition) * 1000;
    if (delta > 0) measuredMs += delta <= elapsed + 250 ? delta : elapsed;
  }
  resetMeter();
};

export interface BgmPlaybackState {
  active: boolean;
  playing: boolean;
  paused: boolean;
  enabled: boolean;
  trackId: BgmTrackId | undefined;
  volume: number;
  repeatMode: BgmRepeatMode;
  allowBackground: boolean;
  hiddenPaused: boolean;
  sessionListeningMs: number;
  measuredListeningMs: number;
  error: string;
}
const listeners = new Set<() => void>();
const snapshot = (): BgmPlaybackState => ({ active, playing: playing && Boolean(audio && !audio.paused), paused: userPaused, enabled,
  trackId, volume, repeatMode, allowBackground: allowBackground && supportsMusicBackground,
  hiddenPaused: hidden && !backgroundAllowed(), sessionListeningMs: Math.floor((measuredMs - sessionStartMs) / 1000) * 1000,
  measuredListeningMs: Math.floor(measuredMs / 1000) * 1000, error });
let state = snapshot();
const publish = () => {
  const next = snapshot();
  if ((Object.keys(next) as (keyof BgmPlaybackState)[]).every(key => next[key] === state[key])) return;
  state = next;
  listeners.forEach(listener => listener());
};
export const getBgmPlaybackState = () => state;
export const subscribeBgmPlayback = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getMeasuredListeningMs = () => { samplePlayback(); return measuredMs; };
export const setMusicRewardEnabled = (value: boolean) => { samplePlayback(); rewardEnabled = value; resetMeter(); publish(); };

const stopFade = () => { if (fadeTimer !== undefined) clearInterval(fadeTimer); fadeTimer = undefined; };
const pauseAudio = () => {
  samplePlayback();
  stopFade();
  audio?.pause();
  playing = false;
  resetMeter();
  publish();
};
const detachAudio = () => {
  samplePlayback();
  stopFade();
  if (audio) {
    audio.onplaying = audio.onpause = audio.onwaiting = audio.onended = audio.onerror = null;
    audio.ontimeupdate = audio.onseeking = audio.onseeked = audio.onvolumechange = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  audio = undefined;
  playing = false;
  playPending = false;
  resetMeter();
};
const fadeIn = (target: HTMLAudioElement) => {
  stopFade();
  const start = clock(), from = target.volume;
  fadeTimer = setInterval(() => {
    if (audio !== target || target.paused) { stopFade(); return; }
    const progress = Math.min(1, (clock() - start) / 360);
    samplePlayback();
    target.volume = from + (volume - from) * progress;
    resetMeter();
    if (progress === 1) stopFade();
  }, 60);
};
const selectedPlaylist = () => active ? allTracks : playlists[desiredScene];
const failTrack = (target: HTMLAudioElement) => {
  if (target !== audio) return;
  if (trackId) failedTracks.add(trackId);
  const list = selectedPlaylist();
  if (list.every(id => failedTracks.has(id))) {
    error = '这些音乐暂时无法播放，请稍后重试。';
    pauseAudio();
    return;
  }
  advanceTrack(true);
};
const startAudio = () => {
  if (!enabled || !unlocked || !backgroundAllowed() || active && userPaused || error) { pauseAudio(); return; }
  const target = audio;
  if (!target || !target.paused || playPending) return;
  playPending = true;
  let request: Promise<void> | undefined;
  try { request = target.play(); }
  catch { playPending = false; failTrack(target); return; }
  void Promise.resolve(request).then(() => {
    if (audio !== target) { target.pause(); return; }
    playPending = false;
    if (!enabled || !backgroundAllowed() || active && userPaused) { pauseAudio(); return; }
    fadeIn(target);
  }).catch((cause: unknown) => {
    if (audio !== target) return;
    playPending = false;
    if (cause instanceof Error && cause.name === 'AbortError') { refresh(); return; }
    if (cause instanceof Error && cause.name === 'NotAllowedError') {
      unlocked = false;
      needsGesture = true;
      error = '请点击播放，让音乐继续。';
      pauseAudio();
    } else failTrack(target);
  });
};
const loadTrack = (id: BgmTrackId) => {
  detachAudio();
  trackId = id;
  if (typeof Audio === 'undefined') { publish(); return; }
  const target = new Audio(bgmTracks.find(track => track.id === id)!.source);
  audio = target;
  target.preload = 'auto';
  target.volume = 0;
  // Handle every ending ourselves, including a single-song repeat, so a
  // wrapped currentTime cannot lose or duplicate listening progress.
  target.loop = false;
  target.onplaying = () => {
    if (audio !== target) return;
    samplePlayback(); playing = true; resetMeter(); publish();
  };
  target.onpause = target.onwaiting = () => {
    if (audio !== target) return;
    samplePlayback(); playing = false; resetMeter(); publish();
  };
  target.ontimeupdate = () => { if (audio === target) { samplePlayback(); publish(); } };
  target.onseeking = target.onseeked = () => { if (audio === target) resetMeter(); };
  target.onvolumechange = () => { if (audio === target) samplePlayback(); };
  target.onended = () => {
    if (audio !== target) return;
    samplePlayback();
    failedTracks.clear();
    advanceTrack(false);
  };
  target.onerror = () => failTrack(target);
  resetMeter();
  publish();
  startAudio();
};
const advanceTrack = (skipFailed: boolean) => {
  const list = selectedPlaylist();
  const currentIndex = list.indexOf(trackId!);
  let index = active && repeatMode === 'single' && !skipFailed ? Math.max(0, currentIndex) : (currentIndex + 1) % list.length;
  if (skipFailed) while (failedTracks.has(list[index])) index = (index + 1) % list.length;
  if (!active) sceneIndexes[desiredScene] = index;
  loadTrack(list[index]);
};
const refresh = () => {
  if (!enabled || !unlocked || !backgroundAllowed() || active && userPaused || error) { pauseAudio(); return; }
  if (!active && (currentScene !== desiredScene || !audio)) {
    currentScene = desiredScene;
    loadTrack(playlists[desiredScene][sceneIndexes[desiredScene] ?? 0]);
  } else if (!audio) loadTrack(allTracks[0]);
  else startAudio();
  publish();
};

export const syncBgm = (mode: BgmMode) => {
  const next = canonicalScene(mode);
  if (next !== desiredScene && !active) { error = ''; failedTracks.clear(); }
  desiredScene = next;
  refresh();
};
export const setBgmEnabled = (value: boolean) => { samplePlayback(); enabled = value; resetMeter(); refresh(); };
export const setBgmUnlocked = (value: boolean) => {
  unlocked = value;
  if (value && needsGesture) { error = ''; needsGesture = false; }
  refresh();
};
export const setBgmHidden = (value: boolean) => { samplePlayback(); hidden = value; resetMeter(); refresh(); };
export const setBgmVolume = (value: number) => {
  if (!Number.isFinite(value)) return;
  samplePlayback(); stopFade();
  volume = Math.max(0, Math.min(1, value));
  if (audio) audio.volume = volume;
  writePreference('pocpet.audio.bgmVolume', String(volume));
  resetMeter(); publish();
};
export const setMusicBackground = (value: boolean) => {
  samplePlayback(); allowBackground = value && supportsMusicBackground;
  writePreference('pocpet.audio.musicBackground', String(allowBackground));
  resetMeter(); refresh();
};
export const setBgmRepeatMode = (value: BgmRepeatMode) => { repeatMode = value; publish(); };
export const beginMusicCompanion = () => {
  samplePlayback();
  if (!active) { active = true; sessionStartMs = measuredMs; }
  userPaused = false; error = ''; failedTracks.clear();
  resetMeter();
  if (audio?.error && trackId) loadTrack(trackId);
  else refresh();
  publish();
};
export const pauseMusicCompanion = () => {
  if (!active) return;
  samplePlayback(); userPaused = true; pauseAudio();
};
export const nextMusicTrack = () => {
  if (!active) return;
  error = ''; failedTracks.clear();
  // Manual next always advances, including in single-song mode.
  const next = allTracks[(allTracks.indexOf(trackId!) + 1) % allTracks.length];
  loadTrack(next);
};
export const endMusicCompanion = () => {
  if (!active) return;
  samplePlayback(); active = false; userPaused = false; error = ''; failedTracks.clear();
  currentScene = undefined;
  detachAudio();
  refresh();
  publish();
};
