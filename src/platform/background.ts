import { isNativeApp } from './edition';
import type { NativeListeningReceipt } from '../core/musicCompanion';

export interface BackgroundCapabilities {
  platform: string;
  nativeMusic: boolean;
  notifications: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
  exactAlarms: boolean;
}
export interface NativePlaybackSnapshot {
  active: boolean;
  playing: boolean;
  paused: boolean;
  hiddenPaused: boolean;
  trackId: string;
  position: number;
  volume: number;
  allowBackground: boolean;
  repeatMode: 'sequence' | 'single';
  receipt?: NativeListeningReceipt;
  error: string;
}
export const backgroundCall = async <T>(action: string, payload: unknown = {}): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>('background_command', { action, payload });
};
let capabilities: Promise<BackgroundCapabilities> | undefined;
export const getBackgroundCapabilities = (): Promise<BackgroundCapabilities> => {
  if (!isNativeApp()) {
    const supported = typeof Notification !== 'undefined' && typeof window !== 'undefined' && window.isSecureContext === true && window.top === window.self;
    return Promise.resolve({ platform: 'web', nativeMusic: false, notifications: supported,
      permission: !supported ? 'unsupported' : Notification.permission === 'default' ? 'prompt' : Notification.permission, exactAlarms: false });
  }
  return capabilities ??= backgroundCall<BackgroundCapabilities>('capabilities').catch(error => { capabilities = undefined; throw error; });
};
export const refreshBackgroundCapabilities = () => { capabilities = undefined; return getBackgroundCapabilities(); };
