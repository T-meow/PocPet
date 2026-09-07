import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { PetState } from '../../core/pet';
import type { PocPetSaveModSummary } from '../../core/saveCodec';
import { authorizeBackupFile, chooseBackupFile, readBackupPreferences, readBackupState, runAutomaticBackup, writeBackupPreferences, type BackupPreferences, type BackupState } from '../../platform/automaticBackup';

export const useAutomaticBackup = (pet: MutableRefObject<PetState>, mod: PocPetSaveModSummary | undefined, paused: boolean) => {
  const [state, setState] = useState<BackupState>({ snapshots: [], fileStatus: 'unconfigured' });
  const [preferences, setPreferences] = useState(readBackupPreferences);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const current = useRef({ mod, paused });
  current.current = { mod, paused };
  const perform = async (operation: () => Promise<BackupState>) => {
    if (inFlight.current || current.current.paused) return;
    inFlight.current = true;
    setBusy(true);
    try { setState(await operation()); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setState((previous) => ({ ...previous, error: String(error) }));
      }
    } finally { inFlight.current = false; setBusy(false); }
  };
  const backup = (force = true) => perform(() => runAutomaticBackup(pet.current, current.current.mod, force, () => current.current.paused));
  useEffect(() => {
    if (paused) return;
    const check = () => { if (document.visibilityState === 'visible') void backup(false); };
    check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [paused]);
  return {
    state, preferences, busy,
    backup: () => backup(true),
    chooseFile: () => perform(chooseBackupFile),
    authorizeFile: () => perform(authorizeBackupFile),
    setPreferences: (next: BackupPreferences) => {
      try { writeBackupPreferences(next); setPreferences(next); void backup(false); }
      catch (error) { setState((previous) => ({ ...previous, error: String(error) })); }
    },
    refresh: () => perform(readBackupState),
  };
};
export type AutomaticBackupController = ReturnType<typeof useAutomaticBackup>;
