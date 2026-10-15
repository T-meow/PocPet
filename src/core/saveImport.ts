import { builtinFuroManifest, builtinMintManifest } from './builtinPetModManifests';
import type { ActivePetMod } from './mod';
import { mintSaveAppId, type PocPetImportedSave } from './saveCodec';

type PetModLoader = (modId: string) => Promise<ActivePetMod | null>;

export interface ImportedSaveModResolution {
  mod: ActivePetMod | null;
  missingImportedMod: boolean;
  usedMintFallback: boolean;
}

export const resolveImportedSaveMod = async (
  imported: Pick<PocPetImportedSave, 'activeMod' | 'sourceApp'>,
  loadMod: PetModLoader,
  loadFallback?: () => Promise<ActivePetMod | null>,
): Promise<ImportedSaveModResolution> => {
  const importedMod = imported.activeMod;
  const matchingImportedMod = importedMod ? await loadMod(importedMod.id) : null;
  const fallbackMod = !matchingImportedMod && imported.sourceApp === mintSaveAppId
    ? await loadMod(builtinMintManifest.id)
    : null;
  const defaultMod = !matchingImportedMod && !fallbackMod ? await loadMod(builtinFuroManifest.id) : null;
  const mod = matchingImportedMod ?? fallbackMod ?? defaultMod ?? await loadFallback?.() ?? null;

  return {
    mod,
    missingImportedMod: Boolean(importedMod && !matchingImportedMod),
    usedMintFallback: Boolean(fallbackMod),
  };
};
