export const adventureActionCommitMs = 700;
export const adventureActionDurationMs = 1050;
export type AdventureActionPhase = 'idle' | 'acting' | 'settling';
export type AdventureMotion = 'sway' | 'walk' | 'pack' | 'happy';
export interface AdventureActionState { phase: AdventureActionPhase; motion: AdventureMotion; }
export interface AdventureActionClock {
  schedule: (callback: () => void, delay: number) => unknown;
  cancel: (handle: unknown) => void;
}
// Synchronous gate closes before React renders; queued actions never survive unmount.
export const createAdventureActionGate = (notify: (state: AdventureActionState) => void, clock: AdventureActionClock = {
  schedule: (callback, delay) => setTimeout(callback, delay), cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}) => {
  let busy = false;
  let committing = false;
  let generation = 0;
  let handles: unknown[] = [];
  const cancel = () => { generation++; handles.forEach(clock.cancel); handles = []; busy = false; notify({ phase: 'idle', motion: 'sway' }); };
  return {
    isBusy: () => busy,
    cancel,
    run: (action: () => void, motion: AdventureMotion = 'sway', animated = true) => {
      // Shared dialogs may delegate to an already guarded parent callback.
      if (committing) { action(); return true; }
      if (!animated) {
        action();
        return true;
      }
      if (busy) return false;
      busy = true;
      const token = ++generation;
      let committed = false;
      notify({ phase: 'acting', motion });
      handles = [clock.schedule(() => {
        if (token !== generation || committed) return;
        committed = true;
        committing = true;
        try { action(); } finally { committing = false; if (token === generation) notify({ phase: 'settling', motion }); }
      }, adventureActionCommitMs), clock.schedule(() => {
        if (token !== generation) return;
        handles = []; busy = false; notify({ phase: 'idle', motion });
      }, adventureActionDurationMs)];
      return true;
    },
  };
};
