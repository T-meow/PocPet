import { useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { t, getLanguage } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import type { SaveFailureStage } from '../core/saveCodec';
import type { SaveRecoveryCandidate } from '../platform/saveRecovery';

export const SaveRecovery = ({ candidates, stage, unavailable, raw, message, onRestore, onImport, onExport, onStartNew }: {
  candidates: SaveRecoveryCandidate[]; stage?: SaveFailureStage; unavailable: boolean; raw: string; message: string;
  onRestore: (candidate: SaveRecoveryCandidate) => Promise<void>;
  onImport: (text: string) => Promise<void>;
  onExport: () => void;
  onStartNew: () => void;
}) => {
  const [selected, setSelected] = useState(candidates[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [importText, setImportText] = useState('');
  const [readError, setReadError] = useState(false);
  const perform = async (action: () => Promise<void>) => { setBusy(true); setReadError(false); try { await action(); } catch { setReadError(true); } finally { setBusy(false); } };
  return <main className="app-shell app-shell--role-picker"><section className="save-recovery">
    <h1>{t('ui.backup.recoveryTitle')}</h1>
    <p>{t(unavailable ? 'ui.backup.recoveryStorage' : raw ? 'ui.backup.recoveryMessage' : 'ui.backup.recoveryMissing')}</p>
    {stage && <p>{t('ui.backup.stage')}: {t(`ui.backup.${stage}`)}</p>}
    {message && <p role="status">{message}</p>}
    {readError && <p role="status">{t('ui.backup.failed')}</p>}
    <label className="field"><span>{t('ui.backup.history')}</span>
      <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!candidates.length}>
        {!candidates.length && <option value="">{t('ui.backup.empty')}</option>}
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{new Date(candidate.savedAt).toLocaleString(getLanguage())} · {candidate.petName} · Lv.{candidate.level}</option>)}
      </select>
    </label>
    <div className="modal-actions">
      <button type="button" className="primary-button" disabled={busy || !selected || unavailable} onClick={() => { const candidate = candidates.find((item) => item.id === selected); if (candidate) void perform(() => onRestore(candidate)); }}><RotateCcw size={18} />{t('ui.backup.restore')}</button>
      <button type="button" className="secondary-button" onClick={() => window.location.reload()}>{t('ui.backup.retry')}</button>
      {raw && <button type="button" className="secondary-button" onClick={onExport}><Download size={18} />{t('ui.backup.original')}</button>}
    </div>
    {raw && <textarea className="save-textarea" readOnly value={raw} aria-label={t('ui.backup.original')} onFocus={(event) => event.target.select()} />}
    <label className="secondary-button settings-file-picker"><Upload size={18} />{t('ui.backup.import')}
      <input className="file-input" type="file" disabled={busy} onChange={async (event) => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) await perform(async () => setImportText(await file.text()));
      }} />
    </label>
    <textarea className="save-textarea" aria-label={t('ui.settings.save.pasteText')} value={importText} onChange={(event) => setImportText(event.target.value)} />
    <button type="button" className="primary-button" disabled={busy || unavailable || !importText.trim()} onClick={() => void perform(() => onImport(importText))}>{t('ui.settings.save.importPasted')}</button>
    <button type="button" className="text-button" disabled={busy || unavailable} onClick={() => setConfirmNew(true)}>{t('ui.backup.startNew')}</button>
    {confirmNew && <ConfirmDialog title={t('ui.backup.startNew')} message={t('ui.backup.newWarning')} cancelLabel={t('ui.backup.recoveryTitle')} confirmLabel={t('ui.backup.startNew')} onCancel={() => setConfirmNew(false)} onConfirm={onStartNew} />}
  </section></main>;
};
