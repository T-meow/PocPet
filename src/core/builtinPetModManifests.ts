import doroManifestJson from '../mods/mod-doro/manifest.json';
import mintManifestJson from '../mods/mod-mint/manifest.json';
import { validatePetModManifest, type PetModManifest } from './mod';

export const builtinDoroManifest = validatePetModManifest(doroManifestJson);
export const builtinMintManifest = validatePetModManifest(mintManifestJson);

export const builtinPetModManifests: readonly PetModManifest[] = [builtinDoroManifest, builtinMintManifest];

export const getBuiltinPetModManifest = (modId?: string) =>
  builtinPetModManifests.find((manifest) => manifest.id === modId) ?? null;

export const isBuiltinPetModId = (modId?: string) => Boolean(getBuiltinPetModManifest(modId));
