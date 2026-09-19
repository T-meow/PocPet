import { isNativeApp } from './edition';

// Recent saves are independent of both WebView storage and the daily backup schedule.
let pending: { text: string; isCurrent: () => boolean } | undefined;
let running: Promise<void> | undefined;
let lastWritten: string | undefined;
let failure = '';
let generation = 0;
const listeners = new Set<(error: string) => void>();
const report = (error: string) => {
  failure = error;
  for (const listener of listeners) listener(error);
};
export const subscribeNativeSave = (listener: (error: string) => void) => {
  listeners.add(listener);
  listener(failure);
  return () => { listeners.delete(listener); };
};
export const readNativeSaves = async (): Promise<{ files: string[]; warnings: string[] }> => {
  if (!isNativeApp()) return { files: [], warnings: [] };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('read_recent_saves');
};
export const flushNativeSave = (): Promise<void> => {
  if (running) return running;
  if (!pending || !isNativeApp()) return Promise.resolve();
  running = (async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    while (pending) {
      const request = pending;
      const { text } = request;
      const startedGeneration = generation;
      pending = undefined;
      try {
        if (!request.isCurrent()) continue;
        if (text !== lastWritten) await invoke('write_recent_save', { text });
        lastWritten = text;
        report('');
      } catch (error) {
        if (generation !== startedGeneration) continue;
        pending ??= request;
        throw error;
      }
    }
  })().catch((error) => { report(String(error)); }).finally(() => {
    running = undefined;
    if (pending && !failure) void flushNativeSave();
  });
  return running;
};
export const queueNativeSave = (text: string, immediate = true, isCurrent = () => true) => {
  if (!isNativeApp()) return;
  pending = { text, isCurrent };
  if (immediate) void flushNativeSave();
};
export const cancelPendingNativeSave = () => { generation++; pending = undefined; lastWritten = undefined; };
