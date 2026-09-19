export interface TimePauseState {
  schemaVersion: 1;
  pausedAt: number;
}

// A damaged pause marker must enter save recovery, never silently thaw a pet.
export const readTimePause = (value: unknown): TimePauseState | undefined => {
  if (value === undefined) return undefined;
  const raw = value as Partial<TimePauseState> | null;
  if (!raw || raw.schemaVersion !== 1 || typeof raw.pausedAt !== 'number'
    || !Number.isSafeInteger(raw.pausedAt) || raw.pausedAt <= 0 || raw.pausedAt > 8.64e15) {
    throw new Error('Invalid time freeze in save data.');
  }
  return { schemaVersion: 1, pausedAt: raw.pausedAt };
};
