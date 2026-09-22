import actionBath from '../assets/audio/action/action_bath.mp3';
import actionBlanket from '../assets/audio/action/action_blanket.mp3';
import actionEat from '../assets/audio/action/action_eat.mp3';
import actionWorkPlayMedicine from '../assets/audio/action/action_work_play_medicine.mp3';
import { setBgmEnabled, setBgmHidden, setBgmUnlocked } from './bgm';
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
import fishingCast from '../assets/audio/world/fishing_cast.mp3';
import fishingBite from '../assets/audio/world/fishing_bite.mp3';
import fishingReel from '../assets/audio/world/fishing_reel.mp3';
import worldHarvest from '../assets/audio/world/harvest.mp3';
import worldStep from '../assets/audio/world/step.mp3';

export type { BgmMode } from './bgm';
export { syncBgm } from './bgm';

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
  | 'kitchen_finish'
  | 'fishing_cast'
  | 'fishing_bite'
  | 'fishing_reel'
  | 'world_harvest'
  | 'world_step';

const audioEnabledStorageKey = 'pocpet.audio.enabled';
const sfxVolume = 0.48;

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
  fishing_cast: fishingCast,
  fishing_bite: fishingBite,
  fishing_reel: fishingReel,
  world_harvest: worldHarvest,
  world_step: worldStep,
};

const canUseAudio = () => typeof window !== 'undefined' && typeof Audio !== 'undefined';

const readInitialAudioEnabled = () => {
  try { return typeof window === 'undefined' || window.localStorage.getItem(audioEnabledStorageKey) !== 'false'; }
  catch { return true; }
};

let audioEnabled = readInitialAudioEnabled();
let audioUnlocked = false;
setBgmEnabled(audioEnabled);

const writeAudioEnabled = (value: boolean) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(audioEnabledStorageKey, String(value)); } catch { /* Keep the in-memory audio preference. */ }
};

let audioTemporarilyMuted = typeof document !== 'undefined' ? document.visibilityState !== 'visible' : false;

export const getAudioEnabled = () => audioEnabled;

export const setAudioEnabled = (value: boolean) => {
  audioEnabled = value;
  writeAudioEnabled(value);
  setBgmEnabled(value);
};

export const setAudioTemporarilyMuted = (value: boolean) => {
  audioTemporarilyMuted = value;
  setBgmHidden(value);
};

export const unlockAudio = async () => {
  if (!audioEnabled || !canUseAudio()) return false;
  if (audioUnlocked) { setBgmUnlocked(true); return true; }

  const probe = new Audio(sfxSources.tap);
  probe.volume = 0;
  try {
    await probe.play();
    probe.pause();
    probe.currentTime = 0;
    audioUnlocked = true;
    setBgmUnlocked(true);
    return true;
  } catch {
    return false;
  }
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
