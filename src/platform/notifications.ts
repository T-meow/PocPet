import { isNativeApp } from './edition';
import { backgroundCall, refreshBackgroundCapabilities } from './background';
import type { NotificationCategory, NotificationPlan, NotificationTarget } from '../core/notificationPlans';

export interface NotificationPreferences {
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
}
const preferencesKey = 'pocpet.notifications.preferences';
export const readNotificationPreferences = (): NotificationPreferences => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(preferencesKey) ?? '{}');
    return { enabled: raw.enabled === true, categories: { tasks: raw.categories?.tasks !== false, harvest: raw.categories?.harvest !== false, pomodoro: raw.categories?.pomodoro !== false } };
  } catch { return { enabled: false, categories: { tasks: true, harvest: true, pomodoro: true } }; }
};
export const writeNotificationPreferences = (preferences: NotificationPreferences) => {
  window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
};
export const notificationTargets: readonly NotificationTarget[] = ['partnerSchedule', 'adventure', 'fishing', 'field', 'garden', 'ranch', 'pomodoro', 'music'];
export const isNotificationTarget = (value: unknown): value is NotificationTarget => notificationTargets.includes(value as NotificationTarget);

let registration: Promise<ServiceWorkerRegistration | undefined> | undefined;
const notificationWorker = () => registration ??= (async () => {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return undefined;
  try {
    const worker = await navigator.serviceWorker.register(new URL('notification-sw.js', document.baseURI).href);
    if (!worker.active) await new Promise<void>((resolve, reject) => {
      const installing = worker.installing ?? worker.waiting;
      if (!installing) { reject(new Error('通知服务尚未就绪')); return; }
      const timer = window.setTimeout(() => reject(new Error('通知服务启动超时')), 10_000);
      const changed = () => {
        if (installing.state === 'activated' || installing.state === 'redundant') {
          window.clearTimeout(timer); installing.removeEventListener('statechange', changed);
          if (installing.state === 'activated') resolve(); else reject(new Error('通知服务不可用'));
        }
      };
      installing.addEventListener('statechange', changed); changed();
    });
    return worker;
  } catch { registration = undefined; return undefined; }
})();

export const requestNotificationPermission = async () => {
  if (isNativeApp()) {
    await backgroundCall('requestNotificationPermission');
    return refreshBackgroundCapabilities();
  }
  if (typeof Notification === 'undefined' || !window.isSecureContext) return refreshBackgroundCapabilities();
  // Keep this call before any await: browsers require a direct user gesture.
  await new Promise<NotificationPermission>((resolve, reject) => {
    const request = Notification.requestPermission(resolve);
    if (request && typeof request.then === 'function') void request.then(resolve, reject);
  });
  if (Notification.permission === 'granted') await notificationWorker();
  return refreshBackgroundCapabilities();
};

export const showSystemNotification = async (plan: NotificationPlan, owner: string, onOpen: (target: NotificationTarget) => void) => {
  if (isNativeApp()) { await backgroundCall('showNotification', { ...plan, owner }); return; }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') throw new Error('系统通知尚未授权');
  const worker = await notificationWorker();
  const options: NotificationOptions = { body: plan.body, tag: `pocpet:${owner}:${plan.key}`, data: { owner, target: plan.target, url: document.baseURI } };
  if (worker && typeof worker.showNotification === 'function') {
    try { await worker.showNotification(plan.title, options); return; } catch { /* Try the page API when worker notifications fail. */ }
  }
  const notification = new Notification(plan.title, options);
  notification.onclick = () => { window.focus(); onOpen(plan.target); notification.close(); };
};

export const subscribeNotificationClicks = (owner: () => string, onOpen: (target: NotificationTarget) => void) => {
  const receive = (data: { owner?: string; target?: string }) => {
    if ((!data.owner || data.owner === owner()) && isNotificationTarget(data.target)) onOpen(data.target);
  };
  const webMessage = (event: MessageEvent) => { if (event.data?.type === 'pocpet-notification') receive(event.data); };
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', webMessage);
  let unlisten: (() => void) | undefined, disposed = false;
  if (isNativeApp()) void import('@tauri-apps/api/event').then(({ listen }) => listen<{ owner: string; target: string }>('pocpet-notification', event => receive(event.payload)))
    .then(stop => { if (disposed) stop(); else unlisten = stop; }).catch(() => { /* Polling handles Android activation as well. */ });
  const query = new URL(window.location.href).searchParams;
  if (query.has('pocpet-notification')) {
    receive({ owner: query.get('notification-owner') ?? '', target: query.get('pocpet-notification') ?? '' });
    const url = new URL(window.location.href); url.searchParams.delete('pocpet-notification'); url.searchParams.delete('notification-owner');
    window.history.replaceState(window.history.state, '', url.href);
  }
  return () => { disposed = true; unlisten?.(); if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', webMessage); };
};
