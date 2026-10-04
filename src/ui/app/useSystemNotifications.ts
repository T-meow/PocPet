import { useEffect, useRef, useState } from 'react';
import type { PetState } from '../../core/petTypes';
import { deriveNotificationPlans, groupDueReminders, isReminderCompleted, type NotificationPlan, type NotificationTarget, type NotificationCategory } from '../../core/notificationPlans';
import { backgroundCall, getBackgroundCapabilities, refreshBackgroundCapabilities, type BackgroundCapabilities } from '../../platform/background';
import { isNotificationTarget, readNotificationPreferences, requestNotificationPermission, showSystemNotification, subscribeNotificationClicks, writeNotificationPreferences } from '../../platform/notifications';

interface Options { pet: PetState; blocked: boolean; notify: (text: string) => void; onOpen: (target: NotificationTarget) => void }
interface NativeReminderResult { plans?: NotificationPlan[]; foreground?: NotificationPlan[]; target?: string; owner?: string }
export const useSystemNotifications = (options: Options) => {
  const latest = useRef(options); latest.current = options;
  const [preferences, setPreferences] = useState(readNotificationPreferences);
  const prefs = useRef(preferences); prefs.current = preferences;
  const [capabilities, setCapabilities] = useState<BackgroundCapabilities>();
  const caps = useRef(capabilities); caps.current = capabilities;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const previous = useRef(new Map<string, NotificationPlan>());
  const scope = useRef('');
  const delivered = useRef(new Set<string>());
  const inFlight = useRef(false);
  const running = useRef<Promise<void>>(Promise.resolve());
  const stopped = useRef(false);
  const mounted = useRef(false);
  const owner = () => latest.current.pet.saveMetadata.id;

  const inspect = async () => {
    try { setCapabilities(await refreshBackgroundCapabilities()); }
    catch { setError('暂时无法连接系统通知服务。'); }
  };
  useEffect(() => {
    mounted.current = true;
    void inspect();
    const visible = () => { if (document.visibilityState === 'visible') void inspect(); };
    document.addEventListener('visibilitychange', visible);
    const unsubscribe = subscribeNotificationClicks(owner, target => latest.current.onOpen(target));
    return () => { mounted.current = false; unsubscribe(); document.removeEventListener('visibilitychange', visible); };
  }, []);

  const synchronize = async () => {
    if (!mounted.current || stopped.current || inFlight.current || !caps.current) return;
    inFlight.current = true;
    const started = latest.current, startedPreferences = prefs.current;
    try {
      const { pet, blocked } = started, currentOwner = pet.saveMetadata.id, now = Date.now();
      const android = caps.current.platform === 'android';
      if (scope.current !== currentOwner) {
        previous.current.clear(); delivered.current.clear();
        try { for (const id of JSON.parse(window.localStorage.getItem(`pocpet.notifications.delivered:${currentOwner}`) ?? '[]')) if (typeof id === 'string') delivered.current.add(id); } catch { /* No delivery history yet. */ }
        if (android) {
          const stored = await backgroundCall<NativeReminderResult>('remindersState');
          if (stored.owner === currentOwner) for (const plan of stored.plans ?? []) previous.current.set(plan.key, plan);
        }
        scope.current = currentOwner;
      }
      if (stopped.current || latest.current.pet !== pet || latest.current.blocked !== blocked || prefs.current !== startedPreferences) return;
      const enabled = !blocked && !pet.timePause;
      if (!enabled) previous.current.clear();
      const raw = enabled ? deriveNotificationPlans(pet).filter(plan => prefs.current.categories[plan.category]) : [];
      const next = new Map(raw.filter(plan => plan.at > now && !delivered.current.has(plan.key)).map(plan => [plan.key, plan]));
      const due = [...previous.current.values()].map(plan => raw.find(current => current.key === plan.key) ?? plan).filter(plan => enabled && prefs.current.categories[plan.category]
        && !delivered.current.has(plan.key) && isReminderCompleted(pet, plan, now));
      if (android) {
        const result = await backgroundCall<NativeReminderResult>('syncReminders', { owner: currentOwner, plans: prefs.current.enabled ? [...next.values(), ...due] : [], enabled: enabled && prefs.current.enabled });
        if (stopped.current || owner() !== currentOwner || latest.current.blocked) return;
        if (!latest.current.pet.timePause) for (const plan of groupDueReminders((result.foreground ?? []).filter(plan => prefs.current.categories[plan.category]))) latest.current.notify(plan.body);
        if ((!result.owner || result.owner === currentOwner) && isNotificationTarget(result.target)) latest.current.onOpen(result.target);
      }
      if (!android || !prefs.current.enabled) {
        for (const plan of groupDueReminders(due)) {
          if (document.visibilityState === 'visible' && document.hasFocus()) latest.current.notify(plan.body);
          else if (prefs.current.enabled) {
            try { await showSystemNotification(plan, currentOwner, target => latest.current.onOpen(target)); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '系统通知发送失败'); latest.current.notify(plan.body); }
          }
        }
      }
      for (const plan of due) delivered.current.add(plan.key);
      delivered.current = new Set([...delivered.current].slice(-256));
      try { window.localStorage.setItem(`pocpet.notifications.delivered:${currentOwner}`, JSON.stringify([...delivered.current])); } catch { /* Keep deduplication for this session. */ }
      previous.current = next;
    } catch (cause) { setError(cause instanceof Error ? cause.message : '提醒同步失败，请重新开启通知。'); }
    finally {
      inFlight.current = false;
      if (mounted.current && !stopped.current && (latest.current.pet !== started.pet || latest.current.blocked !== started.blocked || prefs.current !== startedPreferences))
        window.setTimeout(() => syncRef.current(), 0);
    }
  };
  const syncRef = useRef(() => { running.current = synchronize(); });
  syncRef.current = () => { if (!inFlight.current) running.current = synchronize(); };
  useEffect(() => { void syncRef.current(); }, [options.pet, options.blocked, preferences, capabilities]);
  useEffect(() => {
    const timer = window.setInterval(() => { void syncRef.current(); }, 1000);
    return () => { window.clearInterval(timer); };
  }, []);

  const savePreferences = (next: typeof preferences) => {
    try { writeNotificationPreferences(next); prefs.current = next; setPreferences(next); setError(''); }
    catch { setError('通知设置保存失败，请检查本地存储空间。'); }
  };
  const toggle = async () => {
    if (busy) return;
    if (preferences.enabled) { savePreferences({ ...preferences, enabled: false }); return; }
    setBusy(true);
    try {
      const status = await requestNotificationPermission(); setCapabilities(status);
      if (status.permission !== 'granted') { setError(status.notifications ? '通知未获授权，请在系统或浏览器设置中允许通知。' : '此环境暂不支持系统通知。'); return; }
      previous.current.clear();
      savePreferences({ ...preferences, enabled: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法申请通知权限。'); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try {
      const status = await getBackgroundCapabilities();
      if (status.permission !== 'granted') throw new Error('请先开启并允许系统通知。');
      await showSystemNotification({ key: 'test', source: 'schedule', category: 'tasks', at: Date.now(), title: 'PocPet 测试通知', body: '计时完成后，会在这里提醒你。', target: 'partnerSchedule' }, owner(), target => latest.current.onOpen(target));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '测试通知发送失败。'); }
    finally { setBusy(false); }
  };
  const requestExact = async () => {
    try { await backgroundCall('requestExactAlarms'); await inspect(); } catch { setError('无法打开准时提醒设置。'); }
  };
  const clear = async () => {
    stopped.current = true;
    await running.current;
    previous.current.clear();
    try {
      if ((await getBackgroundCapabilities()).platform === 'android') await backgroundCall('syncReminders', { owner: owner(), plans: [], enabled: false });
    } catch (cause) { stopped.current = false; throw cause; }
  };
  const resume = () => { stopped.current = false; scope.current = ''; syncRef.current(); };
  return { preferences, capabilities, busy, error, toggle, test, requestExact, clear, resume,
    setCategory: (category: NotificationCategory, enabled: boolean) => savePreferences({ ...preferences, categories: { ...preferences.categories, [category]: enabled } }) };
};
export type SystemNotificationController = ReturnType<typeof useSystemNotifications>;
