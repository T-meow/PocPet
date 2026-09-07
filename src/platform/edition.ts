export type AppEdition = 'standard' | 'bilibili';
export interface AppBuild { version: string; edition: AppEdition; revision: string }
declare const __APP_BUILD__: AppBuild;

export const appBuild: AppBuild = typeof __APP_BUILD__ === 'undefined'
  ? { version: '1.7.0', edition: 'standard', revision: 'local' }
  : __APP_BUILD__;

export const getEditionFeatures = (edition: AppEdition) => ({
  cloudSave: edition === 'bilibili',
  rename: edition === 'standard',
  importMod: edition === 'standard',
  shareCards: true,
  shareCustomName: edition === 'standard',
});

export const features = getEditionFeatures(appBuild.edition);
export const isNativeApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isBilibiliAppWebView = () =>
  typeof navigator !== 'undefined' && /BiliApp|bili-universal/i.test(navigator.userAgent);
