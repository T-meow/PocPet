import actionBath from '../assets/audio/action/action_bath.mp3';
import actionBlanket from '../assets/audio/action/action_blanket.mp3';
import actionEat from '../assets/audio/action/action_eat.mp3';
import actionWorkPlayMedicine from '../assets/audio/action/action_work_play_medicine.mp3';
import bgmRoomLoop from '../assets/audio/bgm/bgm_room_loop.mp3';
import bgmShopLoop from '../assets/audio/bgm/bgm_shop_loop.mp3';
import bgmSleepLoop from '../assets/audio/bgm/bgm_sleep_loop.mp3';
import petHeart from '../assets/audio/pet/pet_heart.mp3';
import petLowState from '../assets/audio/pet/pet_hunger_sad_sick.mp3';
import petRead from '../assets/audio/pet/pet_read.mp3';
import petSleepWakeTouch from '../assets/audio/pet/pet_sleep_wake_touch.mp3';
import itemPurchase from '../assets/audio/ui/Item purchase 12.mp3';
import notification from '../assets/audio/ui/Notification.mp3';
import uiTap from '../assets/audio/ui/ui_Click_Tap.mp3';
import uiClose from '../assets/audio/ui/ui_close.mp3';
import uiCoin from '../assets/audio/ui/ui_coin.mp3';
import uiError from '../assets/audio/ui/ui_error.mp3';
import uiOpen from '../assets/audio/ui/ui_open.mp3';
import kitchenStir from '../assets/audio/kitchen/kitchen_stir.mp3';
import kitchenSizzle from '../assets/audio/kitchen/kitchen_sizzle.mp3';
import kitchenBlend from '../assets/audio/kitchen/kitchen_blend.mp3';

export type BgmMode = 'room' | 'sleep' | 'shop';

export type SfxId =
  | 'tap'
  | 'open'
  | 'close'
  | 'error'
  | 'coin'
  | 'purchase'
  | 'notification'
  | 'pet_touch'
  | 'pet_heart'
  | 'pet_low_state'
  | 'pet_read'
  | 'action_eat'
  | 'action_bath'
  | 'action_blanket'
  | 'action_work_play_medicine'
  | 'game_flip'
  | 'game_match'
  | 'game_throw'
  | 'game_catch'
  | 'game_miss'
  | 'game_blow'
  | 'game_bubble'
  | 'game_pop'
  | 'game_finish'
  | 'kitchen_add'
  | 'kitchen_stir'
  | 'kitchen_flip'
  | 'kitchen_blend'
  | 'kitchen_bake'
  | 'kitchen_simmer'
  | 'kitchen_serve'
  | 'kitchen_finish';

const audioEnabledStorageKey = 'pocpet.audio.enabled';
const bgmVolume = 0.18;
const sfxVolume = 0.48;

const bgmSources: Record<BgmMode, string> = {
  room: bgmRoomLoop,
  sleep: bgmSleepLoop,
  shop: bgmShopLoop,
};

const sfxSources: Record<SfxId, string> = {
  tap: uiTap,
  open: uiOpen,
  close: uiClose,
  error: uiError,
  coin: uiCoin,
  purchase: itemPurchase,
  notification,
  pet_touch: petSleepWakeTouch,
  pet_heart: petHeart,
  pet_low_state: petLowState,
  pet_read: petRead,
  action_eat: actionEat,
  action_bath: actionBath,
  action_blanket: actionBlanket,
  action_work_play_medicine: actionWorkPlayMedicine,
  game_flip: uiTap,
  game_match: petHeart,
  game_throw: actionWorkPlayMedicine,
  game_catch: itemPurchase,
  game_miss: uiClose,
  game_blow: actionBath,
  game_bubble: uiOpen,
  game_pop: uiTap,
  game_finish: notification,
  kitchen_add: uiTap,
  kitchen_stir: kitchenStir,
  kitchen_flip: kitchenSizzle,
  kitchen_blend: kitchenBlend,
  kitchen_bake: kitchenSizzle,
  kitchen_simmer: kitchenStir,
  kitchen_serve: itemPurchase,
  kitchen_finish: notification,
};

const canUseAudio = () => typeof window !== 'undefined' && typeof Audio !== 'undefined';

const readInitialAudioEnabled = () => {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(audioEnabledStorageKey) !== 'false';
};

let audioEnabled = readInitialAudioEnabled();
let audioUnlocked = false;
let desiredBgmMode: BgmMode = 'room';
let currentBgmMode: BgmMode | undefined;
let bgmAudio: HTMLAudioElement | undefined;
let fadeTimer: number | undefined;

const writeAudioEnabled = (value: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(audioEnabledStorageKey, String(value));
};

const stopFade = () => {
  if (fadeTimer !== undefined && typeof window !== 'undefined') {
    window.clearInterval(fadeTimer);
    fadeTimer = undefined;
  }
};

let audioTemporarilyMuted = typeof document !== 'undefined' ? document.visibilityState !== 'visible' : false;

const pauseBgm = () => {
  stopFade();
  if (!bgmAudio) return;
  bgmAudio.pause();
};

const stopBgm = () => {
  pauseBgm();
  if (!bgmAudio) return;
  bgmAudio.currentTime = 0;
  bgmAudio = undefined;
  currentBgmMode = undefined;
};

const fadeInBgm = (audio: HTMLAudioElement) => {
  stopFade();
  fadeTimer = window.setInterval(() => {
    if (!bgmAudio || bgmAudio !== audio || audioTemporarilyMuted || !audioEnabled) {
      stopFade();
      return;
    }
    bgmAudio.volume = Math.min(bgmVolume, bgmAudio.volume + 0.03);
    if (bgmAudio.volume >= bgmVolume) stopFade();
  }, 60);
};

const startBgmAudio = (audio: HTMLAudioElement) => {
  audio.volume = Math.min(audio.volume, bgmVolume);
  if (!audio.paused) {
    if (audio.volume < bgmVolume) fadeInBgm(audio);
    return;
  }

  const playPromise = audio.play();
  if (playPromise) {
    void playPromise
      .then(() => {
        if (!bgmAudio || bgmAudio !== audio || !audioEnabled || audioTemporarilyMuted) return;
        fadeInBgm(audio);
      })
      .catch(() => {
        audioUnlocked = false;
      });
  }
};

const playDesiredBgm = () => {
  if (!audioEnabled || !audioUnlocked || !canUseAudio() || audioTemporarilyMuted) return;
  if (currentBgmMode === desiredBgmMode && bgmAudio) {
    startBgmAudio(bgmAudio);
    return;
  }

  stopBgm();
  const nextAudio = new Audio(bgmSources[desiredBgmMode]);
  nextAudio.loop = true;
  nextAudio.preload = 'auto';
  nextAudio.volume = 0;
  bgmAudio = nextAudio;
  currentBgmMode = desiredBgmMode;

  startBgmAudio(nextAudio);
};

export const getAudioEnabled = () => audioEnabled;

export const setAudioEnabled = (value: boolean) => {
  audioEnabled = value;
  writeAudioEnabled(value);
  if (!value) {
    pauseBgm();
    return;
  }
  playDesiredBgm();
};

export const setAudioTemporarilyMuted = (value: boolean) => {
  if (audioTemporarilyMuted === value) return;
  audioTemporarilyMuted = value;
  if (value) {
    pauseBgm();
    return;
  }
  playDesiredBgm();
};

export const unlockAudio = async () => {
  if (!audioEnabled || !canUseAudio()) return false;
  if (audioUnlocked) {
    playDesiredBgm();
    return true;
  }

  const probe = new Audio(sfxSources.tap);
  probe.volume = 0;
  try {
    await probe.play();
    probe.pause();
    probe.currentTime = 0;
    audioUnlocked = true;
    playDesiredBgm();
    return true;
  } catch {
    return false;
  }
};

export const syncBgm = (mode: BgmMode) => {
  desiredBgmMode = mode;
  if (!audioEnabled) {
    pauseBgm();
    return;
  }
  playDesiredBgm();
};

export const playSfx = (id: SfxId) => {
  if (!audioEnabled || audioTemporarilyMuted || !canUseAudio()) return;
  const audio = new Audio(sfxSources[id]);
  audio.preload = 'auto';
  audio.volume = sfxVolume;
  const playPromise = audio.play();
  if (playPromise) {
    void playPromise
      .then(() => {
        audioUnlocked = true;
      })
      .catch(() => {
        audioUnlocked = false;
      });
  }
};
