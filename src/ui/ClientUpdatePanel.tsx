import { Download, ExternalLink, RefreshCw, Save } from 'lucide-react';
import { appBuild } from '../platform/edition';
import { getLanguage, t } from '../i18n';
import type { ClientUpdateController } from './app/useClientUpdates';
import { compareVersions } from '../core/clientUpdates';

export const ClientUpdatePanel = ({ controller, onBackup }: { controller: ClientUpdateController; onBackup: () => void }) => {
  const { result, preferences, checking, opening, error } = controller;
  const update = result?.update;
  const state = checking ? 'checking' : error ? error : update ? update.asset ? 'available' : 'noPackage' : result?.checkedAt ? 'current' : 'idle';
  return <section className="client-update-panel" aria-label={t('ui.updates.title')}>
    <div className="client-update-version"><span>{t('ui.updates.installed')}</span><strong>v{appBuild.version}</strong></div>
    {result?.target && <p className="client-update-target">{result.target.platform} · {result.target.arch}</p>}
    <label className="settings-toggle-row"><span>{t('ui.updates.automatic')}</span>
      <input type="checkbox" checked={preferences.enabled} onChange={(event) => controller.setEnabled(event.target.checked)} />
    </label>
    <div className="save-actions">
      <button type="button" className="secondary-button save-action" disabled={checking} onClick={() => void controller.check()}><RefreshCw size={18} className={checking ? 'update-checking-icon' : ''} />{t('ui.updates.check')}</button>
      <button type="button" className="secondary-button save-action" disabled={opening} onClick={() => void controller.openRelease()}><ExternalLink size={18} />{t('ui.updates.releasePage')}</button>
    </div>
    <p role="status" className={error ? 'settings-cloud-warning' : 'client-update-status'}>{t(`ui.updates.${state}`, { version: update?.version ?? '' })}</p>
    {result?.checkedAt && <small>{t('ui.updates.lastChecked', { time: new Date(result.checkedAt).toLocaleString(getLanguage()) })}</small>}
    {update && <div className="client-update-release">
      <h3>v{update.version}</h3>
      {update.publishedAt && <small>{new Date(update.publishedAt).toLocaleDateString(getLanguage())}</small>}
      <p className="client-update-notes">{update.notes || t('ui.updates.noNotes')}</p>
      {update.asset && <>
        <p className="client-update-target">{update.asset.name} · {(update.asset.size / 1024 / 1024).toFixed(1)} MB</p>
        <p className="settings-cloud-warning">{t('ui.updates.backupHint')}</p>
        {result?.target.platform === 'android' && compareVersions(appBuild.version, '1.6.1') < 0 && <p className="settings-cloud-warning">{t('ui.updates.androidMigration')}</p>}
        <div className="save-actions">
          <button type="button" className="secondary-button save-action" onClick={onBackup}><Save size={18} />{t('ui.updates.backup')}</button>
          <button type="button" className="primary-button save-action" disabled={opening} onClick={() => void controller.openDownload()}><Download size={18} />{t('ui.updates.download')}</button>
        </div>
      </>}
      <div className="save-actions">
        <button type="button" className="text-button save-action" onClick={controller.remindLater}>{t('ui.updates.later')}</button>
        <button type="button" className="text-button save-action" disabled={preferences.ignoredVersion === update.version} onClick={controller.ignore}>{t(preferences.ignoredVersion === update.version ? 'ui.updates.ignored' : 'ui.updates.ignore')}</button>
      </div>
    </div>}
  </section>;
};
