import { Upload, Volume2, VolumeX } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { resolvePetStatusImages } from '../assets';
import { builtinPetMods } from '../core/builtinPetMods';
import type { InstalledPetModSummary } from '../core/mod';
import { t } from '../i18n';
import { features } from '../platform/edition';

interface RolePickerProps {
  installedMods: readonly InstalledPetModSummary[];
  modMessage: string;
  isAudioEnabled: boolean;
  isLoading?: boolean;
  onUseBuiltin: () => void;
  onUseBuiltinMod: (modId: string) => void;
  onUseInstalledMod: (modId: string) => void;
  onImportMod: (event: ChangeEvent<HTMLInputElement>) => void;
  onAudioToggle: () => void;
}

const defaultRolePetImage = resolvePetStatusImages(null).content;

export const RolePicker = ({ installedMods, modMessage, isAudioEnabled, isLoading = false, onUseBuiltin, onUseBuiltinMod, onUseInstalledMod, onImportMod, onAudioToggle }: RolePickerProps) => (
  <main className="app-shell app-shell--role-picker">
    <section className="role-picker" aria-label={t('ui.rolePicker.aria')}>
      <div className="role-picker__header">
        <p className="eyebrow">{t('ui.brand.eyebrow')}</p>
        <h1>{t('ui.rolePicker.title')}</h1>
        {(isLoading || features.importMod) && <p>{isLoading ? t('ui.rolePicker.loading') : t('ui.rolePicker.description')}</p>}
      </div>
      {!isLoading && (
        <div className="role-picker__grid">
          <button type="button" className="role-card" onClick={onUseBuiltin}>
            <img src={defaultRolePetImage} alt="" aria-hidden="true" />
            <span><strong>{t('ui.rolePicker.builtinTitle')}</strong></span>
          </button>
          {builtinPetMods.map((mod) => (
            <button type="button" className="role-card" key={mod.manifest.id} onClick={() => onUseBuiltinMod(mod.manifest.id)}>
              <img src={mod.petImageUrls.content ?? defaultRolePetImage} alt="" aria-hidden="true" />
              <span>
                <strong>{mod.manifest.name}</strong>
              </span>
            </button>
          ))}
          {installedMods.map((mod) => (
            <button type="button" className="role-card" key={mod.manifest.id} onClick={() => onUseInstalledMod(mod.manifest.id)}>
              <img src={mod.contentImageUrl ?? defaultRolePetImage} alt="" aria-hidden="true" />
              <span>
                <strong>{t('ui.rolePicker.installedTitle', { name: mod.manifest.name })}</strong>
                <small>{t('ui.rolePicker.installedSummary', { pet: mod.manifest.defaultPetName })}</small>
              </span>
            </button>
          ))}
          {features.importMod && <label className="role-card role-card--import">
            <Upload size={34} aria-hidden="true" />
            <span><strong>{t('ui.rolePicker.importTitle')}</strong><small>{t('ui.rolePicker.importSummary')}</small></span>
            <input type="file" accept=".zip,application/zip" onChange={onImportMod} />
          </label>}
        </div>
      )}
      {modMessage && <p className="role-picker__message">{modMessage}</p>}
      <button type="button" className="icon-button audio-button role-picker__audio" aria-label={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')} aria-pressed={isAudioEnabled} onClick={onAudioToggle}>
        {isAudioEnabled ? <Volume2 size={21} aria-hidden="true" /> : <VolumeX size={21} aria-hidden="true" />}
      </button>
    </section>
  </main>
);
