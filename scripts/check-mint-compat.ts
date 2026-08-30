import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  builtinDoroManifest,
  builtinMintManifest,
  builtinPetModManifests,
  isBuiltinPetModId,
} from '../src/core/builtinPetModManifests';
import { createDefaultPet, createItemRegistry, useInventoryItem } from '../src/core/pet';
import {
  formatFavoriteFoodText,
  getModFavoriteFoodIds,
  petActivityImageKeys,
  petStatusImageKeys,
  type ActivePetMod,
  type PetModManifest,
} from '../src/core/mod';
import { normalizePetModLibraryState } from '../src/core/modStorage';
import {
  createSaveFilePlainText,
  createSaveFileText,
  mintSaveAppId,
  parseSaveFileText,
  pocPetSaveAppId,
  type PocPetSaveAppId,
} from '../src/core/saveCodec';
import { resolveImportedSaveMod } from '../src/core/saveImport';

const protectedSavePrefix = 'POCPET-SAVE-v2:';
const textEncoder = new TextEncoder();
const fixtureNow = Date.parse('2026-07-01T04:00:00.000Z');
const fixturePath = resolve('scripts/fixtures/pocpet-mint-1.0.1-export.pocpet');

const checksumText = (text: string) => {
  const bytes = textEncoder.encode(text);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const transformSaveBytes = (bytes: Uint8Array, saveAppId: PocPetSaveAppId) => {
  const keyBytes = textEncoder.encode(`${saveAppId}:save-file:v2`);
  const output = new Uint8Array(bytes.length);
  let state = 0x6d2b79f5;

  for (const keyByte of keyBytes) {
    state = (Math.imul(state ^ keyByte, 1664525) + 1013904223) >>> 0;
  }
  for (let index = 0; index < bytes.length; index += 1) {
    state = (Math.imul(state + index + keyBytes[index % keyBytes.length], 1664525) + 1013904223) >>> 0;
    output[index] = bytes[index] ^ (state & 0xff) ^ keyBytes[index % keyBytes.length];
  }
  return output;
};

const protectFixtureText = (plainText: string, saveAppId: PocPetSaveAppId) => {
  const payload = Buffer.from(transformSaveBytes(textEncoder.encode(plainText), saveAppId))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${protectedSavePrefix}${checksumText(plainText)}:${payload}`;
};

const toActiveMod = (manifest: PetModManifest, itemImageUrls: Record<string, string> = {}): ActivePetMod => ({
  manifest,
  petImageUrls: {},
  itemImageUrls,
  cgImageUrls: {},
});

const protectedFixture = readFileSync(fixturePath, 'utf8').trim();
const importedFixture = parseSaveFileText(protectedFixture, fixtureNow);
assert.equal(importedFixture.source, 'envelope');
assert.equal(importedFixture.sourceApp, mintSaveAppId);
assert.equal(importedFixture.pet.name, 'mint-legacy');
assert.equal(importedFixture.pet.level, 37);
assert.equal(importedFixture.pet.coins, 4321);
assert.equal(importedFixture.pet.inventory.emergency_biscuit, 12);
assert.equal(importedFixture.activeMod?.id, builtinMintManifest.id);

const basePet = createDefaultPet(fixtureNow);
const mintEnvelope = JSON.parse(createSaveFilePlainText(basePet, null, fixtureNow)) as Record<string, unknown>;
mintEnvelope.app = mintSaveAppId;
delete mintEnvelope.activeMod;
const protectedMintWithoutMod = protectFixtureText(JSON.stringify(mintEnvelope), mintSaveAppId);
const importedMintWithoutMod = parseSaveFileText(protectedMintWithoutMod, fixtureNow);
assert.equal(importedMintWithoutMod.sourceApp, mintSaveAppId);
assert.equal(importedMintWithoutMod.activeMod, undefined);

const currentSave = parseSaveFileText(createSaveFileText(basePet, null, fixtureNow), fixtureNow);
assert.equal(currentSave.sourceApp, pocPetSaveAppId, 'PocPet exports must keep their existing app id and key');

const mismatchedProtection = protectFixtureText(JSON.stringify(mintEnvelope), pocPetSaveAppId);
assert.throws(
  () => parseSaveFileText(mismatchedProtection, fixtureNow),
  /protection does not match its app identifier/,
);
const replacement = protectedFixture.endsWith('A') ? 'B' : 'A';
assert.throws(() => parseSaveFileText(`${protectedFixture.slice(0, -1)}${replacement}`, fixtureNow));

const mintActiveMod = toActiveMod(builtinMintManifest);
const doroActiveMod = toActiveMod(builtinDoroManifest);
const availableMods = new Map([
  [builtinMintManifest.id, mintActiveMod],
  [builtinDoroManifest.id, doroActiveMod],
]);
const loadCalls: string[] = [];
const loadMod = async (modId: string) => {
  loadCalls.push(modId);
  return availableMods.get(modId) ?? null;
};

const defaultMintResolution = await resolveImportedSaveMod(importedMintWithoutMod, loadMod);
assert.equal(defaultMintResolution.mod?.manifest.id, builtinMintManifest.id);
assert.equal(defaultMintResolution.missingImportedMod, false);
assert.equal(defaultMintResolution.usedMintFallback, true);
assert.deepEqual(loadCalls.splice(0), [builtinMintManifest.id]);

const explicitDoroResolution = await resolveImportedSaveMod({
  sourceApp: mintSaveAppId,
  activeMod: {
    id: builtinDoroManifest.id,
    name: builtinDoroManifest.name,
    version: builtinDoroManifest.version,
  },
}, loadMod);
assert.equal(explicitDoroResolution.mod?.manifest.id, builtinDoroManifest.id);
assert.equal(explicitDoroResolution.missingImportedMod, false);
assert.equal(explicitDoroResolution.usedMintFallback, false);
assert.deepEqual(loadCalls.splice(0), [builtinDoroManifest.id]);

const missingModResolution = await resolveImportedSaveMod({
  sourceApp: mintSaveAppId,
  activeMod: { id: 'creator.missing', name: 'Missing Mod', version: '2.0.0' },
}, loadMod);
assert.equal(missingModResolution.mod?.manifest.id, builtinMintManifest.id);
assert.equal(missingModResolution.missingImportedMod, true);
assert.equal(missingModResolution.usedMintFallback, true);
assert.deepEqual(loadCalls.splice(0), ['creator.missing', builtinMintManifest.id]);

assert.deepEqual(
  builtinPetModManifests.map((manifest) => manifest.id),
  [builtinDoroManifest.id, builtinMintManifest.id],
);
assert.equal(isBuiltinPetModId(builtinMintManifest.id), true);
const normalizedLibrary = normalizePetModLibraryState({
  schemaVersion: 1,
  activeModId: builtinMintManifest.id,
  mods: [{ manifest: builtinMintManifest, importedAt: 123 }],
});
assert.equal(normalizedLibrary.activeModId, builtinMintManifest.id);
assert.equal(normalizedLibrary.mods.length, 0, 'installed Mint copies must collapse into the built-in entry');

const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const assertPng = (path: string) => {
  const bytes = readFileSync(resolve('src/mods/mod-mint', path));
  assert(bytes.subarray(0, pngHeader.length).equals(pngHeader), `${path} must be a PNG`);
};
for (const key of [...petStatusImageKeys, ...petActivityImageKeys]) assertPng(`pet/${key}.png`);
assertPng('cg/good_ending_year_1.png');
assertPng('items/emergency_biscuit.png');

const mintRuntimeMod = toActiveMod(builtinMintManifest, { emergency_biscuit: 'mint:item:emergency_biscuit' });
const mintItemRegistry = createItemRegistry(mintRuntimeMod);
const mintBiscuit = mintItemRegistry.get('emergency_biscuit');
assert(mintBiscuit);
assert.equal(mintBiscuit.name, '咕比脆');
assert.equal(mintBiscuit.summary, '香脆轻巧的小点心');
assert.equal(mintBiscuit.imageUrl, 'mint:item:emergency_biscuit');
assert.deepEqual(getModFavoriteFoodIds(mintRuntimeMod), ['emergency_biscuit', 'strawberry_cake']);

const petWithBiscuit = {
  ...basePet,
  hunger: 50,
  mood: 50,
  inventory: { emergency_biscuit: 1 },
};
const itemOptions = { item: mintBiscuit, itemName: mintBiscuit.name };
const withoutFavorite = useInventoryItem(petWithBiscuit, 'emergency_biscuit', fixtureNow, {
  ...itemOptions,
  favoriteFoodIds: [],
});
const withFavorite = useInventoryItem(petWithBiscuit, 'emergency_biscuit', fixtureNow, {
  ...itemOptions,
  favoriteFoodIds: getModFavoriteFoodIds(mintRuntimeMod),
  favoriteText: (amount) => formatFavoriteFoodText(mintRuntimeMod, amount),
});
assert.equal(withFavorite.mood - withoutFavorite.mood, 4);
assert.match(withFavorite.recentEvent, /喜欢的味道/);

console.log('Mint protected save compatibility and built-in Mod checks passed.');
