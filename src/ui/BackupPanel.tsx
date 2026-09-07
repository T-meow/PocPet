import { Download, FolderOpen, RotateCcw, Save } from 'lucide-react';
import { getLanguage, t } from '../i18n';
import { canChooseBackupFile, type BackupSnapshot } from '../platform/automaticBackup';
import type { AutomaticBackupController } from './app/useAutomaticBackup';

export const BackupPanel = ({ controller, onRestore, onExport }: {
  controller: AutomaticBackupController;
  onRestore: (text: string) => void;
  onExport: (snapshot: BackupSnapshot) => void;
}) => {
  const { state, preferences, busy } = controller;
  const formatTime = (time: number) => new Date(time).toLocaleString(getLanguage());
  return <div className="backup-panel">
    <h3>{t('ui.backup.title')}</h3>
    <label className="settings-toggle-row"><span>{t('ui.backup.enabled')}</span>
      <input type="checkbox" checked={preferences.enabled} onChange={(event) => controller.setPreferences({ ...preferences, enabled: event.target.checked })} />
    </label>
    <label className="field settings-inline-field"><span>{t('ui.backup.interval')}</span>
      <input type="number" min={1} max={30} step={1} value={preferences.intervalDays} onChange={(event) => {
        const days = Number(event.target.value);
        if (Number.isInteger(days) && days >= 1 && days <= 30) controller.setPreferences({ ...preferences, intervalDays: days });
      }} />
    </label>
    <p>{state.snapshots[0] ? `${t('ui.backup.latest')}: ${formatTime(state.snapshots[0].savedAt)}` : t('ui.backup.empty')}</p>
    <p>{t(`ui.backup.${state.fileStatus}`)}{state.fileSavedAt ? ` · ${formatTime(state.fileSavedAt)}` : ''}</p>
    {state.error && <p role="status" className="settings-cloud-warning">{t('ui.backup.failed')}</p>}
    {Boolean(state.warnings?.length) && <p role="status" className="settings-cloud-warning">{t('ui.backup.skippedFiles', { count: state.warnings!.length })}</p>}
    <div className="modal-actions">
      <button type="button" className="primary-button" disabled={busy} onClick={() => void controller.backup()}><Save size={18} />{t(busy ? 'ui.backup.busy' : 'ui.backup.now')}</button>
      {canChooseBackupFile() && <button type="button" className="secondary-button" disabled={busy} onClick={() => void controller.chooseFile()}><FolderOpen size={18} />{t('ui.backup.choose')}</button>}
      {state.fileStatus === 'permission' && <button type="button" className="secondary-button" disabled={busy} onClick={() => void controller.authorizeFile()}>{t('ui.backup.authorize')}</button>}
    </div>
    {state.snapshots.length > 0 && <ul className="backup-history" aria-label={t('ui.backup.history')}>
      {state.snapshots.map((snapshot) => <li key={snapshot.dateKey}>
        <span><strong>{snapshot.petName} · Lv.{snapshot.level}</strong><small>{formatTime(snapshot.savedAt)}</small></span>
        <button className="icon-button" type="button" title={t('ui.backup.restore')} aria-label={t('ui.backup.restore')} onClick={() => onRestore(snapshot.text)}><RotateCcw size={18} /></button>
        <button className="icon-button" type="button" title={t('ui.backup.export')} aria-label={t('ui.backup.export')} onClick={() => onExport(snapshot)}><Download size={18} /></button>
      </li>)}
    </ul>}
    <p className="settings-cloud-warning">{t('ui.backup.storageWarning')}</p>
  </div>;
};
