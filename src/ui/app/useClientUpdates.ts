import { useEffect, useRef, useState } from 'react';
import { checkClientUpdate, openUpdateUrl, readUpdatePreferences, shouldRemindUpdate, supportsClientUpdates, UpdateCheckError, writeUpdatePreferences, type UpdateCheck } from '../../platform/clientUpdates';
import { releasePageUrl } from '../../core/clientUpdates';

export const useClientUpdates = () => {
  const supported = supportsClientUpdates();
  const [result, setResult] = useState<UpdateCheck>();
  const [preferences, setPreferences] = useState(readUpdatePreferences);
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<UpdateCheckError['reason']>();
  const active = useRef(true);
  const pending = useRef(false);
  const check = async (force = true) => {
    if (!supported || pending.current) return;
    pending.current = true;
    setChecking(true);
    setError(undefined);
    try { const next = await checkClientUpdate(force); if (active.current) setResult(next); }
    catch (error) { if (active.current) setError(error instanceof UpdateCheckError ? error.reason : 'network'); }
    finally { pending.current = false; if (active.current) setChecking(false); }
  };
  useEffect(() => {
    active.current = true;
    const inspect = () => { if (document.visibilityState === 'visible') void check(false); };
    if (supported) { inspect(); document.addEventListener('visibilitychange', inspect); }
    const timer = supported ? window.setInterval(inspect, 60 * 60 * 1000) : undefined;
    return () => { active.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', inspect); };
  }, [supported]);
  const changePreferences = (changes: Parameters<typeof writeUpdatePreferences>[0]) => setPreferences(writeUpdatePreferences(changes));
  const open = async (download: boolean) => {
    if (opening) return;
    setOpening(true);
    setError(undefined);
    try { await openUpdateUrl(download && result?.update?.asset ? result.update.asset.url : result?.update?.pageUrl ?? releasePageUrl); }
    catch { setError('openFailed'); }
    finally { setOpening(false); }
  };
  return {
    supported, result, preferences, checking, opening, error, check,
    showReminder: !checking && !error && shouldRemindUpdate(result?.update ?? null, preferences),
    setEnabled: (enabled: boolean) => { changePreferences({ enabled }); if (enabled) void check(false); },
    ignore: () => changePreferences({ ignoredVersion: result?.update?.version ?? '' }),
    remindLater: () => changePreferences({ snoozedVersion: result?.update?.version ?? '', snoozedAt: Date.now() }),
    openDownload: () => open(true), openRelease: () => open(false),
  };
};
export type ClientUpdateController = ReturnType<typeof useClientUpdates>;
