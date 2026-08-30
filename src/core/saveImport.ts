import { builtinMintManifest } from './builtinPetModManifests';
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
): Promise<ImportedSaveModResolution> => {
  const importedMod = imported.activeMod;
  const matchingImportedMod = importedMod ? await loadMod(importedMod.id) : null;
  const fallbackMod = !matchingImportedMod && imported.sourceApp === mintSaveAppId
    ? await loadMod(builtinMintManifest.id)
    : null;

  return {
    mod: matchingImportedMod ?? fallbackMod,
    missingImportedMod: Boolean(importedMod && !matchingImportedMod),
    usedMintFallback: Boolean(fallbackMod),
  };
};
