import { useEffect } from 'react';
import { Bell, Check, Download, Gift, RefreshCw } from 'lucide-react';
import { t } from '../i18n';
import { appBuild, features } from '../platform/edition';
import { recordEditionNoticeShown } from '../core/editionNotice';
import { DialogShell } from './DialogShell';

export const EditionNoticeDialog = ({ onAcknowledge, onBackup, onOpenAcknowledgements, onOpenUpdates }: {
  onAcknowledge: () => void;
  onBackup: () => void;
  onOpenAcknowledgements: () => void;
  onOpenUpdates?: () => void;
}) => {
  useEffect(() => { recordEditionNoticeShown(); }, []);
  const sections = [
    { key: 'farm', emoji: '🌱', tone: 'green', paragraphs: ['farmAdvice'] },
    { key: 'games', emoji: '🎮', tone: 'purple', paragraphs: ['gamesAdvice'] },
    { key: 'kitchen', emoji: '🍳', tone: 'amber', paragraphs: ['kitchenAdvice'] },
    { key: 'exploration', emoji: '🧭', tone: 'blue', paragraphs: ['explorationAdvice'] },
    { key: 'daily', emoji: '⭐', tone: 'green', paragraphs: ['dailyAdvice'] },
    { key: 'music', emoji: '🎵', tone: 'purple', paragraphs: ['musicAdvice'] },
    { key: 'backup', emoji: '💾', tone: 'blue', paragraphs: ['backupAdvice', 'formatTimeline', features.cloudSave ? 'downloadFallback' : 'localBackupAdvice'] },
  ];
  return <DialogShell className="edition-notice" labelId="edition-notice-title" onClose={onAcknowledge}>
    <header className="edition-notice__header">
      <span className="dialog-title-icon"><Bell size={23} aria-hidden="true" /></span>
      <div><h2 id="edition-notice-title">{t('ui.editionNotice.title', { version: appBuild.version })}</h2><p>v{appBuild.version} · {t('ui.editionNotice.subtitle')}</p></div>
    </header>
    <div className="edition-notice__body">
      {sections.map(({ key, emoji, tone, paragraphs }) => <section className={`edition-notice__section edition-notice__section--${key}`} data-tone={tone} key={key}>
        <span className="edition-notice__emoji" aria-hidden="true">{emoji}</span>
        <div><h3>{t(`ui.editionNotice.${key}Title`)}</h3>
          {paragraphs.map((paragraph) => <p className={['farmAdvice', 'backupAdvice'].includes(paragraph) ? 'edition-notice__highlight' : undefined} key={paragraph}>{t(`ui.editionNotice.${paragraph}`)}</p>)}
          {key === 'backup' && onOpenUpdates && <button type="button" className="text-button edition-notice__update-link" onClick={onOpenUpdates}><RefreshCw size={16} />{t('ui.editionNotice.openUpdates')}</button>}
        </div>
      </section>)}
      <p className="edition-notice__closing">{t('ui.editionNotice.closing')}</p>
      <button type="button" className="text-button edition-notice__update-link" onClick={onOpenAcknowledgements}><Gift size={16} />{t('ui.editionNotice.openAcknowledgements')}</button>
    </div>
    <footer className="edition-notice__footer save-actions">
      <button type="button" className="secondary-button save-action" onClick={onAcknowledge}><Check size={18} />{t('ui.editionNotice.acknowledge')}</button>
      <button type="button" className="primary-button save-action" onClick={onBackup}><Download size={18} />{t('ui.editionNotice.backup')}</button>
    </footer>
  </DialogShell>;
};
