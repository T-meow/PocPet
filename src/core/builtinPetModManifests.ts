import doroManifestJson from '../mods/mod-doro/manifest.json';
import mintManifestJson from '../mods/mod-mint/manifest.json';
import deepseekManifestJson from '../mods/mod-deepseek/manifest.json';
import { validatePetModManifest, type PetModManifest } from './mod';

export const builtinDoroManifest = validatePetModManifest(doroManifestJson);
export const builtinMintManifest = validatePetModManifest(mintManifestJson);
export const builtinDeepSeekManifest = validatePetModManifest(deepseekManifestJson);

export const builtinPetModManifests: readonly PetModManifest[] = [builtinDoroManifest, builtinMintManifest, builtinDeepSeekManifest];

export const getBuiltinPetModManifest = (modId?: string) =>
  builtinPetModManifests.find((manifest) => manifest.id === modId) ?? null;

export const isBuiltinPetModId = (modId?: string) => Boolean(getBuiltinPetModManifest(modId));

export const isProtectedPetModId = (modId?: string) => modId === builtinMintManifest.id;

export const getAvailableBuiltinPetModManifests = (deletedIds: readonly string[] = []) =>
  builtinPetModManifests.filter((mod) => isProtectedPetModId(mod.id) || !deletedIds.includes(mod.id));
