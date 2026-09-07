import { useEffect } from 'react';
import { Bell, Check, Download, Image, RefreshCw, ShieldCheck } from 'lucide-react';
import { t } from '../i18n';
import { appBuild, features } from '../platform/edition';
import { recordEditionNoticeShown } from '../core/editionNotice';
import { DialogShell } from './DialogShell';

export const EditionNoticeDialog = ({ onAcknowledge, onBackup, onOpenUpdates }: {
  onAcknowledge: () => void;
  onBackup: () => void;
  onOpenUpdates?: () => void;
}) => {
  useEffect(() => { recordEditionNoticeShown(); }, []);
  const sections = [
    { key: 'backup', Icon: Download, paragraphs: ['backupAdvice', features.cloudSave ? 'downloadFallback' : 'localBackupAdvice'] },
    ...(features.cloudSave ? [
      { key: 'policy', Icon: ShieldCheck, paragraphs: ['policyChanges', 'existingData'] },
      { key: 'sharing', Icon: Image, paragraphs: ['sharingAdvice'] },
    ] : []),
    { key: 'updates', Icon: RefreshCw, paragraphs: ['updateAdvice', 'installAdvice'] },
  ];
  return <DialogShell className="edition-notice" labelId="edition-notice-title" onClose={onAcknowledge}>
    <header className="edition-notice__header">
      <span className="dialog-title-icon"><Bell size={23} aria-hidden="true" /></span>
      <div><h2 id="edition-notice-title">{t('ui.editionNotice.title')}</h2><p>v{appBuild.version}</p></div>
    </header>
    <div className="edition-notice__body">
      {sections.map(({ key, Icon, paragraphs }) => <section className={`edition-notice__section edition-notice__section--${key}`} key={key}>
        <Icon size={19} aria-hidden="true" />
        <div><h3>{t(`ui.editionNotice.${key}Title`)}</h3>
          {paragraphs.map((paragraph) => <p key={paragraph}>{t(`ui.editionNotice.${paragraph}`)}</p>)}
          {key === 'updates' && onOpenUpdates && <button type="button" className="text-button edition-notice__update-link" onClick={onOpenUpdates}><RefreshCw size={16} />{t('ui.editionNotice.openUpdates')}</button>}
        </div>
      </section>)}
    </div>
    <footer className="edition-notice__footer save-actions">
      <button type="button" className="secondary-button save-action" onClick={onAcknowledge}><Check size={18} />{t('ui.editionNotice.acknowledge')}</button>
      <button type="button" className="primary-button save-action" onClick={onBackup}><Download size={18} />{t('ui.editionNotice.backup')}</button>
    </footer>
  </DialogShell>;
};
