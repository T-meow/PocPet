import doroManifestJson from '../mods/mod-doro/manifest.json';
import { validatePetModManifest, type PetModManifest } from './mod';

export const builtinDoroManifest = validatePetModManifest(doroManifestJson);

export const builtinPetModManifests: readonly PetModManifest[] = [builtinDoroManifest];

export const getBuiltinPetModManifest = (modId?: string) =>
  builtinPetModManifests.find((manifest) => manifest.id === modId) ?? null;

export const isBuiltinPetModId = (modId?: string) => Boolean(getBuiltinPetModManifest(modId));
