import { ArrowLeft, Download, FileText, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Check, RefreshCw, Trash2 } from 'lucide-react';
import { Cloud, Copy, FileImage, Play, Share2 } from 'lucide-react';
import { authorFollowGiftTickets, defaultPetBirthday, getPetBirthdayMaxDay, type PetBirthday, type PetCalendarDate } from '../core/pet';
import type { ActivePetMod, InstalledPetModSummary } from '../core/mod';
import { cloudSaveMaxEncodedLength, type CloudSaveManifestV1 } from '../core/cloudSave';
import { giftBoxIcon } from '../assets';
import { languages, list, t, type LanguageCode } from '../i18n';
import type { ToyAuthorSummary, ToyAuthorVideoSummary } from '../platform/toySdk';
import type { ToyCloudAvailability, ToyCloudBusyAction } from './app/useToyIntegration';
import { appBuild, features, isNativeApp } from '../platform/edition';
import { BackupPanel } from './BackupPanel';
import type { AutomaticBackupController } from './app/useAutomaticBackup';
import type { BackupSnapshot } from '../platform/automaticBackup';
import { ClientUpdatePanel } from './ClientUpdatePanel';
import type { ClientUpdateController } from './app/useClientUpdates';
import { canShareTextFile } from '../platform/saveTextFile';
import { AppearancePanel } from './AppearancePanel';
import type { Appearance } from './appearance';
import type { PetState } from '../core/pet';
import { activityText as L } from '../core/kitchenRecipes';
import { Palette, Settings, Volume2, VolumeX, Save, Image, Info } from 'lucide-react';

interface SettingsModalProps {
  pet: PetState;
  portrait: string;
  appearance: Appearance;
  onAppearanceChange: (value: Appearance) => void;
  isAudioEnabled: boolean;
  onAudioToggle: () => void;
  updateController: ClientUpdateController;
  backupController: AutomaticBackupController;
  onRestoreBackup: (text: string) => void;
  onExportBackup: (snapshot: BackupSnapshot) => void;
  onCopySave: () => void;
  onShareSaveFile: () => void;
  isSharingSaveFile: boolean;
  activeMod: ActivePetMod | null;
  installedMods: readonly InstalledPetModSummary[];
  modMessage: string;
  draftName: string;
  draftBirthday?: PetBirthday;
  metDate: PetCalendarDate;
  language: LanguageCode;
  saveText: string;
  importSaveText: string;
  hasImportBackup: boolean;
  hasOpenedHelp: boolean;
  hasClaimedAuthorFollowGift: boolean;
  hasClaimedHelpPageGift: boolean;
  initialPage?: SettingsPage;
  onPageChange?: (page: SettingsPage) => void;
  cloudAvailability: ToyCloudAvailability;
  cloudManifest?: CloudSaveManifestV1;
  cloudUsedFallback: boolean;
  cloudBusy: ToyCloudBusyAction;
  cloudReminderEnabled: boolean;
  cloudReminderDue: boolean;
  hasLatestYearReview: boolean;
  shareBusy: 'profile' | 'year' | null;
  shareDetails?: { base64?: string; url: string };
  authorSummary: ToyAuthorSummary;
  authorVideo: ToyAuthorVideoSummary;
  isAuthorLoading: boolean;
  onDraftNameChange: (value: string) => void;
  onDraftBirthdayChange: (value: PetBirthday) => void;
  onLanguageChange: (value: LanguageCode) => void;
  onImportSaveTextChange: (value: string) => void;
  onOpenHelp: () => void;
  onOpenAuthorSpace: () => void;
  onOpenIntroVideo: () => void;
  onClaimHelpPageGift: () => void;
  onClose: () => void;
  onSaveProfile: () => void;
  onReset: () => void;
  onClearMod: () => void;
  onActivateMod: (modId: string) => void;
  onDeleteMod: (modId: string) => void;
  onExportSave: () => void;
  onDownloadSave: () => void;
  onImportPastedSave: () => void;
  onRestoreImportBackup: () => void;
  onCloudUpload: () => void;
  onCloudRestore: () => void;
  onCloudReminderEnabledChange: (enabled: boolean) => void;
  onSaveProfileCard: () => void;
  onSaveYearReviewCard: () => void;
  onShareApp: () => void;
  onCopyShareLink: () => void;
  onModFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportSaveFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export type SettingsPage = 'main' | 'mod' | 'save' | 'share' | 'updates' | 'appearance' | 'help';

const birthdayMonths = Array.from({ length: 12 }, (_, index) => index + 1);

export const SettingsModal = ({
  pet, portrait, appearance, onAppearanceChange, isAudioEnabled, onAudioToggle,
  updateController,
  backupController, onRestoreBackup, onExportBackup, onCopySave,
  onShareSaveFile, isSharingSaveFile,
  activeMod,
  installedMods,
  modMessage,
  draftName,
  draftBirthday,
  metDate,
  language,
  saveText,
  importSaveText,
  hasImportBackup,
  hasClaimedAuthorFollowGift,
  hasClaimedHelpPageGift,
  initialPage = 'main',
  onPageChange,
  cloudAvailability,
  cloudManifest,
  cloudUsedFallback,
  cloudBusy,
  cloudReminderEnabled,
  cloudReminderDue,
  hasLatestYearReview,
  shareBusy,
  shareDetails,
  authorSummary,
  authorVideo,
  isAuthorLoading,
  onDraftNameChange,
  onDraftBirthdayChange,
  onLanguageChange,
  onImportSaveTextChange,
  onOpenHelp,
  onOpenAuthorSpace,
  onOpenIntroVideo,
  onClaimHelpPageGift,
  onClose,
  onSaveProfile,
  onReset,
  onClearMod,
  onActivateMod,
  onDeleteMod,
  onExportSave,
  onDownloadSave,
  onImportPastedSave,
  onRestoreImportBackup,
  onCloudUpload,
  onCloudRestore,
  onCloudReminderEnabledChange,
  onSaveProfileCard,
  onSaveYearReviewCard,
  onShareApp,
  onCopyShareLink,
  onModFileChange,
  onImportSaveFileChange,
}: SettingsModalProps) => {
  const modFileInputRef = useRef<HTMLInputElement>(null);
  const saveFileInputRef = useRef<HTMLInputElement>(null);
  const cloudVisible = features.cloudSave && !isNativeApp() && cloudAvailability === 'available';
  const [page, setPageState] = useState<SettingsPage>(initialPage);
  const setPage = (next: SettingsPage) => { setPageState(next); onPageChange?.(next); };
  useEffect(() => setPageState(initialPage), [initialPage]);
  const helpSections = [
    { title: t('ui.settings.help.careTitle'), items: list('ui.settings.help.care') },
    { title: t('ui.settings.help.growthTitle'), items: list('ui.settings.help.growth') },
  ];
  const activeModSummary = activeMod
    ? t('ui.settings.mod.current', { name: activeMod.manifest.name, version: activeMod.manifest.version })
    : t('ui.settings.mod.currentDefault');
  const birthdayMonth = draftBirthday?.month ?? defaultPetBirthday.month;
  const birthdayMaxDay = getPetBirthdayMaxDay(birthdayMonth);
  const birthdayDay = Math.min(draftBirthday?.day ?? defaultPetBirthday.day, birthdayMaxDay);
  const birthdayDays = Array.from({ length: birthdayMaxDay }, (_, index) => index + 1);

  const handleBirthdayMonthChange = (value: string) => {
    const month = Number(value);
    const maxDay = getPetBirthdayMaxDay(month);
    onDraftBirthdayChange({ month, day: Math.min(birthdayDay, maxDay) });
  };

  const handleBirthdayDayChange = (value: string) => {
    onDraftBirthdayChange({ month: birthdayMonth, day: Number(value) });
  };

  const handleOpenHelp = () => {
    onOpenHelp();
    setPage('help');
  };
  const cloudUploadedAt = cloudManifest
    ? new Date(cloudManifest.uploadedAt).toLocaleString(language)
    : undefined;
  const cloudStatusKey = cloudAvailability === 'checking'
    ? 'ui.settings.cloud.checking'
    : cloudAvailability === 'available'
      ? cloudManifest ? 'ui.settings.cloud.ready' : 'ui.settings.cloud.empty'
      : cloudAvailability === 'unsupported'
        ? 'ui.settings.cloud.unsupported'
        : 'ui.settings.cloud.unavailable';

  return (
    <>
      <section className="settings-page" aria-labelledby="settings-title">
        <header className="v2-page-heading"><button className="icon-button" onClick={onClose} aria-label={L('返回小窝', 'Back home')}><ArrowLeft /></button><div><p className="eyebrow">YOUR LITTLE PREFERENCES</p><h2 id="settings-title">{L('把小窝调成喜欢的样子', 'Make yourself at home')}</h2></div></header>
        <div className="settings-layout"><nav className="settings-nav v2-card" aria-label={L('设置分类', 'Setting categories')}>{([
          ['main', L('基本设置', 'General'), Settings], ['appearance', L('外观与环境', 'Appearance & environment'), Palette], ['save', L('存档与恢复', 'Saves & recovery'), Save], ['share', L('分享与名片', 'Sharing & cards'), Image], ['updates', L('更新', 'Updates'), RefreshCw], ['help', L('帮助与关于', 'Help & about'), Info],
        ] as const).map(([id, label, Icon]) => <button key={id} aria-current={(page === id || (page === 'mod' && id === 'main')) ? 'page' : undefined} onClick={() => id === 'help' ? handleOpenHelp() : setPage(id)}><Icon size={18} />{label}</button>)}</nav><div className="settings-content">
        <div className="settings-modal__body">
          {page === 'appearance' && <AppearancePanel pet={pet} appearance={appearance} onChange={onAppearanceChange} />}
          {page === 'main' && (
            <>
              <h3>{L('认识彼此', 'Getting to know each other')}</h3>
              <div className="settings-profile-row"><img src={portrait} alt="" /><div><strong>{pet.name}</strong><p>Lv.{pet.level} · {L(`相伴 ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} 天`, `${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} days together`)}</p><button className="text-button" onClick={() => setPage('mod')}>{L('角色与 Mod', 'Companions & Mods')}</button></div></div>
              <p className="settings-free-notice">{t('ui.settings.freeNotice')}</p>

              <label className="field settings-inline-field settings-name-field">
                <span>{t('ui.settings.petName')}</span>
                <input value={draftName} readOnly={!features.rename} title={!features.rename ? t('ui.editionNotice.restricted') : undefined} maxLength={32} onChange={(event) => onDraftNameChange(event.target.value)} />
              </label>

              <div className="field settings-birthday-field">
                <div className="settings-birthday-heading">
                  <span>{t('ui.settings.petBirthday')}</span>
                </div>
                <div className="settings-birthday-grid">
                  <label>
                    <span className="settings-date-label">{t('ui.settings.birthdayMonth')}</span>
                    <select value={birthdayMonth} onChange={(event) => handleBirthdayMonthChange(event.target.value)}>
                      {birthdayMonths.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="settings-date-label">{t('ui.settings.birthdayDay')}</span>
                    <select value={birthdayDay} onChange={(event) => handleBirthdayDayChange(event.target.value)}>
                      {birthdayDays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="settings-anniversary-field">
                <div>
                  <span>{t('ui.settings.petAnniversary')}</span>
                  <strong>{t('ui.settings.metDateValue', { year: metDate.year, month: metDate.month, day: metDate.day })}</strong>
                </div>
              </div>

              <label className="field settings-inline-field settings-language-field" title={t('ui.settings.languageHint')}>
                <span>{t('ui.settings.language')}</span>
                <select value={language} onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}>
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="settings-nav-card" onClick={() => setPage('mod')}>
                <span>
                  <strong>{t('ui.settings.mod.manage')}</strong>
                  <small>{activeModSummary}</small>
                </span>
              </button>
              <button className="settings-toggle-row" role="switch" aria-checked={isAudioEnabled} onClick={onAudioToggle}><span>{L('声音', 'Sounds')}</span>{isAudioEnabled ? <Volume2 /> : <VolumeX />}</button>
            </>
          )}

          {page === 'mod' && (
            <section className="settings-section" aria-label={t('ui.settings.mod.sectionAria')}>
              <button className="text-button" onClick={() => setPage('main')}><ArrowLeft size={16} />{L('基本设置', 'General')}</button>
              <div className="settings-section__intro">
                <span>{activeModSummary}</span>
              </div>
              {modMessage && <p className="settings-message">{modMessage}</p>}
              {features.importMod && <input ref={modFileInputRef} className="file-input" type="file" accept=".zip,application/zip" onChange={onModFileChange} />}
              <div className="settings-mod-list" aria-label={t('ui.settings.mod.libraryAria')}>
                {installedMods.map((mod) => {
                  const isActive = activeMod?.manifest.id === mod.manifest.id;
                  return (
                    <div className="settings-mod-row" key={mod.manifest.id}>
                      {mod.contentImageUrl
                        ? <img src={mod.contentImageUrl} alt="" aria-hidden="true" />
                        : <span className="settings-mod-row__placeholder" aria-hidden="true" />}
                      <span>
                        <strong>{mod.manifest.name}</strong>
                        <small>{mod.manifest.defaultPetName} · v{mod.manifest.version}</small>
                      </span>
                      {isActive ? (
                        <span className="settings-mod-row__active"><Check size={15} aria-hidden="true" />{t('ui.settings.mod.currentShort')}</span>
                      ) : (
                        <button type="button" className="secondary-button" onClick={() => onActivateMod(mod.manifest.id)}>
                          {t('ui.settings.mod.activate')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => onDeleteMod(mod.manifest.id)}
                        aria-label={t('ui.settings.mod.delete', { name: mod.manifest.name })}
                        title={t('ui.settings.mod.delete', { name: mod.manifest.name })}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                {installedMods.length === 0
                  ? <p className="settings-mod-list__empty">{t('ui.settings.mod.libraryEmpty')}</p>
                  : null}
              </div>
              <div className="modal-actions">
                <button type="button" className="primary-button" disabled={!features.importMod} title={!features.importMod ? t('ui.editionNotice.restricted') : undefined} onClick={() => modFileInputRef.current?.click()}>
                  <Upload size={18} aria-hidden="true" />
                  {t('ui.settings.mod.import')}
                </button>
                <button type="button" className="text-button settings-action" onClick={onClearMod}>
                  {t('ui.settings.mod.useBuiltin')}
                </button>
              </div>
            </section>
          )}

          {page === 'updates' && updateController.supported && <ClientUpdatePanel controller={updateController} onBackup={() => setPage('save')} />}
          {page === 'updates' && !updateController.supported && <section className="v2-card"><h3>{L('当前版本', 'Current version')} · {appBuild.version}</h3><p>{L('网页版会随站点更新，重新打开即可使用最新内容。', 'The web edition updates with the site. Reopen it to use the latest version.')}</p></section>}

          {page === 'save' && (
            <section className="settings-section settings-save-section" aria-label={t('ui.settings.save.sectionAria')}>
              {modMessage && <p className="settings-message">{modMessage}</p>}
              <div className="v2-card settings-save-format">
                <h3>{t('ui.settings.save.formatV2')}</h3>
                <p>{t(pet.saveMetadata.compensation === 'pending' ? 'ui.settings.save.migrationPending' : pet.saveMetadata.origin === 'legacy' ? 'ui.settings.save.migrationComplete' : 'ui.settings.save.newProgress')}</p>
                {Object.keys(pet.saveMetadata.pendingItems).length > 0 && <p>{t('pet.reward.saveMigrationPending')}</p>}
                <p>{t('ui.editionNotice.backupAdvice')} {t('ui.editionNotice.formatTimeline')}</p>
              </div>
              <BackupPanel controller={backupController} onRestore={onRestoreBackup} onExport={onExportBackup} />
              <h3 className="save-section-title">{t('ui.backup.exportTitle')}</h3>
              <div className="save-actions">
                <button type="button" className="secondary-button save-action" onClick={onExportSave}>
                  <FileText size={18} aria-hidden="true" />
                  {t('ui.settings.save.exportText')}
                </button>
                <button type="button" className="primary-button save-action" onClick={onDownloadSave}>
                  <Download size={18} aria-hidden="true" />
                  {t(appBuild.edition === 'bilibili' && !isNativeApp() ? 'ui.settings.save.saveToPhone' : 'ui.settings.save.download')}
                </button>
              </div>
              {saveText && <><textarea className="save-textarea" readOnly value={saveText} aria-label={t('ui.settings.save.exportedAria')} onFocus={(event) => event.target.select()} />
                <div className="save-actions">
                  <button type="button" className="secondary-button save-action" onClick={onCopySave}><Copy size={18} />{t('ui.backup.copy')}</button>
                  {!isNativeApp() && canShareTextFile('pocpet-save.pocpet', saveText) && <button type="button" className="secondary-button save-action" disabled={isSharingSaveFile} onClick={onShareSaveFile}>
                    <Share2 size={18} />{t('ui.settings.save.shareFile')}
                  </button>}
                </div></>}
              <h3 className="save-section-title save-section-title--divided">{t('ui.backup.importTitle')}</h3>
              <div className="save-actions">
                <button type="button" className="secondary-button save-action" onClick={() => saveFileInputRef.current?.click()}><Upload size={18} />{t('ui.settings.save.importFile')}</button>
                <input ref={saveFileInputRef} className="file-input" type="file" onChange={onImportSaveFileChange} />
                {hasImportBackup && (
                  <button type="button" className="secondary-button save-action" onClick={onRestoreImportBackup}>
                    <RotateCcw size={18} aria-hidden="true" />
                    {t('ui.settings.save.restoreImportBackup')}
                  </button>
                )}
              </div>
              <label className="field">
                <span>{t('ui.settings.save.pasteText')}</span>
                <textarea className="save-textarea" value={importSaveText} onChange={(event) => onImportSaveTextChange(event.target.value)} />
              </label>
              <button type="button" className="primary-button save-action" disabled={!importSaveText.trim()} onClick={onImportPastedSave}>
                <Upload size={18} aria-hidden="true" />
                {t('ui.settings.save.importPasted')}
              </button>
              {cloudVisible && <div className="settings-cloud-panel">
                <div className="settings-cloud-panel__heading">
                  <span className="settings-cloud-panel__icon"><Cloud size={20} aria-hidden="true" /></span>
                  <span>
                    <strong>{t('ui.settings.cloud.title')}</strong>
                    <small>{t(cloudStatusKey)}</small>
                  </span>
                </div>
                {cloudManifest && (
                  <dl className="settings-cloud-meta">
                    <div><dt>{t('ui.settings.cloud.pet')}</dt><dd>{cloudManifest.petName} · Lv.{cloudManifest.petLevel}</dd></div>
                    <div><dt>{t('ui.settings.cloud.uploadedAt')}</dt><dd>{cloudUploadedAt}</dd></div>
                    <div><dt>{t('ui.settings.cloud.capacity')}</dt><dd>{t('ui.settings.cloud.capacityValue', { used: (cloudManifest.encodedLength / 1024).toFixed(1), max: cloudSaveMaxEncodedLength / 1024, percent: Math.ceil(cloudManifest.encodedLength / cloudSaveMaxEncodedLength * 100) })}</dd></div>
                    {cloudManifest.activeMod && <div><dt>Mod</dt><dd>{cloudManifest.activeMod.name} v{cloudManifest.activeMod.version}</dd></div>}
                  </dl>
                )}
                {cloudUsedFallback && <p className="settings-cloud-warning">{t('ui.settings.cloud.fallback')}</p>}
                <div className="save-actions">
                  <button
                    type="button"
                    className="primary-button save-action"
                    disabled={cloudAvailability !== 'available' || cloudBusy !== null}
                    onClick={onCloudUpload}
                  >
                    <Upload size={18} aria-hidden="true" />
                    {cloudBusy === 'upload' ? t('ui.settings.cloud.uploading') : t('ui.settings.cloud.upload')}
                  </button>
                  <button
                    type="button"
                    className="secondary-button save-action"
                    disabled={cloudAvailability !== 'available' || !cloudManifest || cloudBusy !== null}
                    onClick={onCloudRestore}
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    {cloudBusy === 'restore' ? t('ui.settings.cloud.restoring') : t('ui.settings.cloud.restore')}
                  </button>
                </div>
                <label className="settings-toggle-row">
                  <span>
                    <strong>{t('ui.settings.cloud.reminder')}</strong>
                  </span>
                  <input
                    type="checkbox"
                    checked={cloudReminderEnabled}
                    onChange={(event) => onCloudReminderEnabledChange(event.target.checked)}
                  />
                </label>
              </div>}
            </section>
          )}

          {page === 'share' && (
            <section className="settings-section settings-share-section" aria-label={t('ui.share.sectionAria')}>
              <div className="settings-profile-card"><p className="eyebrow">POCKET · A LITTLE LIFE, TOGETHER</p><h3>{L(`${pet.name} 的伙伴名片`, `${pet.name}’s companion card`)}</h3><img src={portrait} alt="" /><p>{L(`相伴第 ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)} 天，平凡的日子也在发光。`, `Day ${Math.max(1, Math.floor(pet.ageSeconds / 86400) + 1)}. A little glow in ordinary days.`)}</p><div><span>Lv.{pet.level}</span><span>{L(`收获 ${pet.garden.lifetimeHarvestCount} 次`, `${pet.garden.lifetimeHarvestCount} harvests`)}</span></div></div>
              {modMessage && <p className="settings-message">{modMessage}</p>}
              <div className="settings-share-actions">
                {!features.shareCards && <p>{t('ui.editionNotice.restricted')}</p>}
                <button type="button" className="settings-share-action" disabled={!features.shareCards || shareBusy !== null} onClick={onSaveProfileCard}>
                  <FileImage size={22} aria-hidden="true" />
                  <span><strong>{shareBusy === 'profile' ? t('ui.share.cardGenerating') : t('ui.share.saveProfileCard')}</strong><small>{t('ui.share.profileCardSummary')}</small></span>
                </button>
                <button type="button" className="settings-share-action" disabled={!features.shareCards || !hasLatestYearReview || shareBusy !== null} onClick={onSaveYearReviewCard}>
                  <FileImage size={22} aria-hidden="true" />
                  <span><strong>{shareBusy === 'year' ? t('ui.share.cardGenerating') : t('ui.share.yearCard')}</strong><small>{hasLatestYearReview ? t('ui.share.yearCardSummary') : t('ui.share.yearCardEmpty')}</small></span>
                </button>
                <button type="button" className="settings-share-action" onClick={onShareApp}>
                  <Share2 size={22} aria-hidden="true" />
                  <span><strong>{t('ui.share.app')}</strong><small>{t('ui.share.appSummary')}</small></span>
                </button>
              </div>
              {shareDetails && (
                <div className="settings-share-qr">
                  {shareDetails.base64 && <img src={shareDetails.base64} alt={t('ui.share.qrAlt')} />}
                  <div className="settings-share-link-actions">
                    <a href={shareDetails.url} target="_blank" rel="noopener noreferrer">{shareDetails.url}</a>
                    <button type="button" className="secondary-button" onClick={onCopyShareLink}>
                      <Copy size={16} aria-hidden="true" />
                      {t('ui.share.copyLink')}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {page === 'main' && (
          <div className="modal-actions settings-modal__footer">
            <button type="button" className="primary-button" onClick={onSaveProfile}>{t('ui.backup.saveProfile')}</button>
            <button type="button" className="danger-button" onClick={onReset}>
              <RotateCcw size={18} aria-hidden="true" />
              {t('ui.settings.resetSave')}
            </button>
          </div>
        )}
      {page === 'help' && (
        <section className="settings-help-content v2-card" aria-labelledby="settings-help-title">
          <header>
            <h2 id="settings-help-title">{t('ui.settings.help.title')}</h2>
          </header>
          <div className="help-author-cards">
            <button type="button" className="help-author-card" onClick={onOpenAuthorSpace}>
              {authorSummary.avatar
                ? <img src={authorSummary.avatar} alt="" aria-hidden="true" />
                : <span className="help-author-card__placeholder" aria-hidden="true" />}
              <span>
                <strong>{authorSummary.nickname || t('ui.settings.author.name')}</strong>
                <small>{t(
                  hasClaimedAuthorFollowGift
                    ? 'ui.settings.author.rewardClaimed'
                    : 'ui.settings.author.rewardAvailable',
                  { count: authorFollowGiftTickets },
                )}</small>
              </span>
            </button>
            <button type="button" className="help-author-card help-author-card--video" onClick={onOpenIntroVideo}>
              {authorVideo.cover
                ? <img src={authorVideo.cover} alt="" aria-hidden="true" />
                : <span className="help-author-card__video-icon"><Play size={22} aria-hidden="true" /></span>}
              <span>
                <strong>{authorVideo.title || t('ui.settings.author.videoTitle')}</strong>
                {isAuthorLoading ? <small>{t('ui.settings.author.loading')}</small> : null}
              </span>
            </button>
          </div>
          {modMessage && <p className="settings-message" role="status">{modMessage}</p>}
          <div className="help-content">
            {helpSections.map((section) => (
              <section className="help-section" key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {!hasClaimedHelpPageGift && (
            <button
              type="button"
              className="help-gift-button"
              aria-label={t('ui.rewards.claim')}
              title={t('ui.rewards.claim')}
              onClick={onClaimHelpPageGift}
            >
              <img src={giftBoxIcon} alt="" aria-hidden="true" />
            </button>
          )}
        </section>
      )}
        <small className="build-info">v{appBuild.version} · {appBuild.edition} · {appBuild.revision.slice(0, 8)}</small>
      </div></div></section>
    </>
  );
};
