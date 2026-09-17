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
  let handles: unknown[] = [];
  const cancel = () => { handles.forEach(clock.cancel); handles = []; busy = false; };
  return {
    isBusy: () => busy,
    cancel,
    run: (action: () => void, motion: AdventureMotion = 'sway', animated = true) => {
      // Shared dialogs may delegate to an already guarded parent callback.
      if (committing) { action(); return true; }
      if (!animated) {
        cancel();
        notify({ phase: 'idle', motion });
        action();
        return true;
      }
      if (busy) return false;
      busy = true;
      notify({ phase: 'acting', motion });
      handles = [clock.schedule(() => {
        committing = true;
        try { action(); } finally { committing = false; notify({ phase: 'settling', motion }); }
      }, adventureActionCommitMs), clock.schedule(() => {
        handles = []; busy = false; notify({ phase: 'idle', motion });
      }, adventureActionDurationMs)];
      return true;
    },
  };
};
