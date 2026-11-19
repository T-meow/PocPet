import { builtinMintManifest } from '../../core/builtinPetModManifests';
import { mintSaveAppId, type PocPetImportedSave } from '../../core/saveCodec';
import { getLanguage, t } from '../../i18n';

export const saveImportConfirmation = (save: PocPetImportedSave, showPreview: boolean) => {
  if (!showPreview) return t('ui.settings.save.confirmReplace');

  const mod = save.activeMod ?? (save.sourceApp === mintSaveAppId ? builtinMintManifest : undefined);
  const metadata = save.pet.saveMetadata;
  return t('ui.settings.save.previewMessage', {
    name: save.pet.name,
    level: save.pet.level,
    exportedAt: save.exportedAt ? new Date(save.exportedAt).toLocaleString(getLanguage()) : t('ui.settings.save.previewLegacyTime'),
    mod: mod ? `${mod.name} v${mod.version}` : t('ui.settings.save.previewBuiltinMod'),
    format: t(save.requiresMigration ? 'ui.settings.save.formatLegacy' : 'ui.settings.save.formatV2'),
    migration: save.requiresMigration ? t('ui.settings.save.previewMigration') : [
      t('ui.settings.save.previewCurrent'),
      t(metadata.compensation === 'pending' ? 'ui.settings.save.migrationPending' : metadata.origin === 'legacy' ? 'ui.settings.save.migrationComplete' : 'ui.settings.save.newProgress'),
      Object.keys(metadata.pendingItems).length ? t('pet.reward.saveMigrationPending') : '',
    ].filter(Boolean).join(' '),
  });
};
