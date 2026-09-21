import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { createSaveFileText, decodeSaveSnapshot, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { packDateKeys, unpackDateKeys } from '../src/core/persistedDates';
import { compactSaveEncoding } from '../src/core/persistedPet';
import { allDishes } from '../src/core/kitchenRecipes';
import { memoryText, rememberTogether } from '../src/core/companionMemories';
import { createYearReview } from '../src/core/yearlyStats';
import { claimExpedition, returnExpedition } from '../src/core/expedition';
import { restoreCloudSave, uploadCloudSave } from '../src/core/cloudSave';
import { createCommunityTestPet } from './fixtures/community-pet';

const now = new Date(2026, 11, 31, 12).getTime();
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const dates = (first: string, count: number) => Array.from({ length: count }, (_, index) =>
  new Date(Date.parse(`${first}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
const year = dates('2026-01-01', 365);
const leapDays = ['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'];
for (const keys of [[], ['2026-12-31'], leapDays, year, dates('2024-01-01', 366), dates('2025-09-21', 365),
  dates('2026-03-01', 100).filter((_, index) => index % 3 !== 0), dates('0000-01-01', 10), dates('9999-12-22', 10)]) {
  assert.deepEqual(unpackDateKeys(packDateKeys(keys)), keys, 'dates survive leap days, year boundaries, sparse activity and DST');
}
assert.deepEqual(unpackDateKeys(packDateKeys(leapDays)), leapDays);
assert.ok(bytes(packDateKeys(year)) < bytes(year) / 20, 'a full year uses less than 5% of its original date storage');
for (const keys of [['2026-12-31', '2026-01-01'], ['2026-01-01', '2026-01-01'], ['2026-02-30'], ['1900-01-01', '2026-01-01']]) {
  assert.deepEqual(packDateKeys(keys), keys, 'unusual legacy ordering and labels must not change during encoding');
}
for (const malformed of [null, 4, 'bad', {}, { first: NaN, bits: 'AQ==' }, { first: 0.5, bits: 'AQ==' },
  { first: 0, bits: '!!!' }, { first: 0, bits: 'AQ' }, { first: 0, bits: 'AA==' }, { first: 0, bits: 'Ag==' },
  { first: 0, bits: 'AQA=' }, { first: 2932896, bits: 'Aw==' },
  { first: 0, bits: Buffer.alloc(47, 255).toString('base64') }, { first: 0, bits: Buffer.alloc(513, 1).toString('base64') }]) {
  assert.throws(() => unpackDateKeys(malformed), /invalid compact activity dates/);
}

let pet = createCommunityTestPet('long-trip', now);
pet.createdAt = new Date(2025, 0, 1, 12).getTime();
pet.yearlyStats = { ...pet.yearlyStats, year: 2026, activeDateKeys: year };
pet.achievements.counters.companionYearActiveDateKeysByYear = { '1': dates('2025-01-01', 365), '2': year };
for (const dish of allDishes) pet = rememberTogether(pet, 'official.furo', 'first_taste', dish.id, now - 60000);
pet.companionMemories.entries.push({ id: 'legacy-custom-memory', actorId: 'official.furo', kind: 'menu_page', subject: 'first_menu', at: now - 50000, mentionedAt: 0 });
pet = normalizePet(pet, now);
const before = JSON.stringify(pet);
const text = createSaveFileText(pet, null, now);
const saved = JSON.parse(text);
assert.equal(JSON.stringify(pet), before, 'saving must not mutate the running game');
assert.equal(saved.encoding, compactSaveEncoding);
assert.ok(!Array.isArray(saved.pet.yearlyStats.activeDateKeys));
assert.ok(!('journal' in saved.pet.community.expedition.active));
assert.ok(saved.pet.companionMemories.entries.every((entry: object) => !('mentionedAt' in entry)));
assert.ok(saved.pet.companionMemories.entries.slice(0, allDishes.length).every((entry: object) => !('id' in entry)));
assert.equal(saved.pet.companionMemories.entries.at(-1).id, 'legacy-custom-memory', 'non-derived legacy IDs retain their identity');

const restored = parseSaveFileText(text, now).pet;
assert.deepEqual(restored.yearlyStats, pet.yearlyStats);
assert.deepEqual(restored.achievements.counters, pet.achievements.counters);
assert.deepEqual(createYearReview(restored.yearlyStats, restored.createdAt), createYearReview(pet.yearlyStats, pet.createdAt));
assert.deepEqual(restored.companionMemories, pet.companionMemories);
assert.deepEqual(restored.companionMemories.entries.map(memoryText), pet.companionMemories.entries.map(memoryText));
assert.equal(rememberTogether(restored, 'official.furo', 'first_taste', allDishes[0].id, now), restored, 'rebuilt IDs still prevent duplicate memories');
assert.deepEqual(restored.community.expedition.active, { ...pet.community.expedition.active, journal: [] });
assert.deepEqual(JSON.parse(createSaveFileText(restored, null, now)).pet.companionMemories, saved.pet.companionMemories);

// Old V2 payloads have full memory fields, string date arrays and no encoding marker.
const legacy = { ...saved, pet: { ...saved.pet, yearlyStats: pet.yearlyStats, companionMemories: pet.companionMemories,
  achievements: pet.achievements, community: pet.community } };
delete legacy.encoding;
const migrated = parseSaveFileText(JSON.stringify(legacy), now).pet;
assert.deepEqual(migrated.companionMemories, pet.companionMemories);
assert.deepEqual(migrated.yearlyStats, pet.yearlyStats);
assert.deepEqual(migrated.achievements.counters, pet.achievements.counters);
assert.equal(JSON.parse(createSaveFileText(migrated, null, now)).encoding, compactSaveEncoding);
const oldFixture = JSON.parse(readFileSync(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url), 'utf8'));
assert.equal(decodeSaveSnapshot(oldFixture.text).formatVersion, 2);
assert.throws(() => decodeSaveSnapshot(JSON.stringify({ ...saved, encoding: 'compact-v999' })), UnsupportedSaveVersionError);
const damaged = JSON.stringify({ ...saved, pet: { ...saved.pet, yearlyStats: { ...saved.pet.yearlyStats, activeDateKeys: { first: 0, bits: 'broken' } } } });
const failure = loadStoredPetJson(damaged, now);
assert.equal(failure.status, 'corrupt', 'invalid packed dates must not silently reset activity history');
if (failure.status === 'corrupt') assert.equal(failure.raw, damaged);

// Removing display-only expedition logs must preserve receipts and one-time claims.
const pending = returnExpedition(pet, pet.community.expedition.active!.id, now);
assert.ok(pending.community.expedition.pending);
const pendingText = createSaveFileText(pending, null, now);
assert.ok(!('journal' in JSON.parse(pendingText).pet.community.expedition.pending));
const pendingReload = parseSaveFileText(pendingText, now).pet;
const claimed = claimExpedition(pending, pending.community.expedition.pending!.id);
const claimedReload = claimExpedition(pendingReload, pendingReload.community.expedition.pending!.id);
assert.deepEqual(claimedReload.inventory, claimed.inventory);
assert.equal(claimedReload.coins, claimed.coins);
assert.equal(claimedReload.hearts, claimed.hearts);
assert.ok(claimedReload.community.expedition.lastReceipt);
const receiptText = createSaveFileText(claimedReload, null, now);
assert.ok(!('journal' in JSON.parse(receiptText).pet.community.expedition.lastReceipt));
const receiptReload = parseSaveFileText(receiptText, now).pet;
assert.equal(receiptReload.community.expedition.nextId, claimedReload.community.expedition.nextId);
const repeated = claimExpedition(receiptReload, claimedReload.community.expedition.lastReceipt!.id);
assert.equal(repeated.coins, receiptReload.coins);
assert.equal(repeated.hearts, receiptReload.hearts);
assert.deepEqual(repeated.inventory, receiptReload.inventory);

// The same compact payload is used by compressed cloud transport, without real cloud writes.
const values = new Map<string, string>();
const cloud = {
  async getCloudStorage(keys = [...values.keys()]) { return Object.fromEntries(keys.flatMap(key => values.has(key) ? [[key, values.get(key)!]] : [])); },
  async setCloudStorage(entries: Record<string, string>) { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
  async removeCloudStorage(keys: string[]) { keys.forEach(key => values.delete(key)); },
};
await uploadCloudSave(cloud, pet, null, now);
const cloudPet = (await restoreCloudSave(cloud, now)).imported.pet;
assert.deepEqual(cloudPet.companionMemories, pet.companionMemories);
assert.deepEqual(cloudPet.achievements.counters, pet.achievements.counters);
assert.deepEqual(cloudPet.yearlyStats, pet.yearlyStats);
const freshText = createSaveFileText(createDefaultPet(now), null, now);
assert.ok(Array.isArray(JSON.parse(freshText).pet.yearlyStats.activeDateKeys), 'short lists stay plain when that is smaller');
console.log(`Save compaction passed: sample ${bytes(legacy)} -> ${bytes(saved)} bytes; 365 dates ${bytes(year)} -> ${bytes(packDateKeys(year))} bytes; legacy/custom memories, expedition claims, calendar boundaries, corrupt data and cloud round-trips preserved.`);
