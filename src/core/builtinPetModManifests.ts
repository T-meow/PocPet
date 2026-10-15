import doroManifestJson from '../mods/mod-doro/manifest.json';
import mintManifestJson from '../mods/mod-mint/manifest.json';
import deepseekManifestJson from '../mods/mod-deepseek/manifest.json';
import { validatePetModManifest, type PetModManifest } from './mod';
import { defaultPetBirthday } from './dateRewards';
import { favoriteFoodIds } from './items';

export const builtinFuroManifest = validatePetModManifest({
  schemaVersion: 2,
  id: 'official.furo',
  name: 'Furo',
  version: '1.0.0',
  defaultPetName: 'Furo',
  description: 'Furo 伙伴，喜欢猪蹄、草莓和奶制品相关食物。',
  birthday: defaultPetBirthday,
  favoriteFoodIds: [...favoriteFoodIds],
});

export const builtinDoroManifest = validatePetModManifest(doroManifestJson);
export const builtinMintManifest = validatePetModManifest(mintManifestJson);
export const builtinDeepSeekManifest = validatePetModManifest(deepseekManifestJson);

export const builtinPetModManifests: readonly PetModManifest[] = [builtinFuroManifest, builtinDoroManifest, builtinMintManifest, builtinDeepSeekManifest];

export const getBuiltinPetModManifest = (modId?: string) =>
  builtinPetModManifests.find((manifest) => manifest.id === modId) ?? null;

export const isBuiltinPetModId = (modId?: string) => Boolean(getBuiltinPetModManifest(modId));

export const getAvailableBuiltinPetModManifests = (deletedIds: readonly string[] = []) =>
  builtinPetModManifests.filter((mod) => !deletedIds.includes(mod.id));
