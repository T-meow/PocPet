import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';
import { createDefaultPet } from '../src/core/pet';
import { checksumText, createSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { cloudSaveActiveKey, cloudSaveChunkSize, cloudSaveMaxEncodedLength, cloudSaveMaxPlainBytes, encodeCloudSave, getCloudContentChecksum, restoreCloudSave, uploadCloudSave, type CloudSaveGeneration } from '../src/core/cloudSave';
import type { ToyCloudStorage } from '../src/platform/toySdk';

class CloudMock implements ToyCloudStorage {
  readonly values = new Map<string, string>();
  writes = 0;
  corruptNextManifest = false;
  truncateNextManifest = false;
  failActivation = false;
  failRead = false;
  async getCloudStorage(keys = [...this.values.keys()]) {
    if (this.failRead) throw new Error('Injected network read failure');
    return Object.fromEntries(keys.flatMap((key) => this.values.has(key) ? [[key, this.values.get(key)!]] : []));
  }
  async setCloudStorage(entries: Record<string, string>) {
    this.writes++;
    if (this.failActivation && cloudSaveActiveKey in entries) { this.failActivation = false; throw new Error('Injected activation failure'); }
    assert.ok(new Set([...this.values.keys(), ...Object.keys(entries)]).size <= 128);
    for (const [key, value] of Object.entries(entries)) {
      assert.ok(Buffer.byteLength(value) <= 1024);
      this.values.set(key, value);
      if (this.truncateNextManifest && key.endsWith('-manifest-v1')) {
        this.truncateNextManifest = false;
        this.values.set(key, value.slice(0, -5));
      }
      if (this.corruptNextManifest && key.endsWith('-manifest-v1')) {
        this.corruptNextManifest = false;
        this.values.set(key.replace('-manifest-v1', '-00'), 'damaged on write');
      }
    }
  }
  async removeCloudStorage(keys: string[]) { keys.forEach((key) => this.values.delete(key)); }
}
const now = new Date(2026, 8, 12, 12).getTime();
const pet = createDefaultPet(now);
const oldPet = { ...pet } as Partial<typeof pet>;
delete oldPet.saveMetadata;
const legacyText = JSON.stringify({ app: 'PocPet', schemaVersion: 1, exportedAt: new Date(now).toISOString(), pet: oldPet });
const currentText = createSaveFileText(pet, null, now);
const zipBytes = async (text: string, targetBytes?: number) => {
  const zip = new JSZip(); zip.file('save.json', text);
  const options = { type: 'uint8array' as const, compression: 'DEFLATE' as const, compressionOptions: { level: 9 } };
  let bytes = await zip.generateAsync(options);
  if (targetBytes) {
    // ZIP comments are valid archive data and let this fixture hit an exact transport boundary.
    zip.comment = 'c'.repeat(targetBytes - bytes.length);
    bytes = await zip.generateAsync(options);
    assert.equal(bytes.length, targetBytes);
  }
  return Buffer.from(bytes).toString('base64');
};
const seedGeneration = async (cloud: CloudMock, text: string, generation: CloudSaveGeneration, size = 960, exactLength?: number) => {
  const encoded = await zipBytes(text, exactLength ? exactLength / 4 * 3 : undefined);
  const chunks = Array.from({ length: Math.ceil(encoded.length / size) }, (_, index) => encoded.slice(index * size, (index + 1) * size));
  for (const [index, chunk] of chunks.entries()) cloud.values.set(`pocpet-save-${generation}-${String(index).padStart(2, '0')}`, chunk);
  cloud.values.set(`pocpet-save-${generation}-manifest-v1`, JSON.stringify({ schemaVersion: 1, generation, encoding: 'zip-deflate-base64', chunkCount: chunks.length, encodedLength: encoded.length, checksum: checksumText(encoded), uploadedAt: new Date(now).toISOString(), petName: pet.name, petLevel: pet.level }));
  cloud.values.set(cloudSaveActiveKey, generation);
  return encoded;
};

assert.equal(cloudSaveChunkSize, 1024);
assert.equal(cloudSaveMaxEncodedLength, 61440);
assert.equal(cloudSaveMaxPlainBytes, 512 * 1024);
for (const text of [legacyText, JSON.stringify(oldPet), currentText]) {
  const cloud = new CloudMock();
  await seedGeneration(cloud, text, 'a', 960);
  const restored = await restoreCloudSave(cloud, now);
  assert.equal(restored.imported.pet.coins, pet.coins);
  assert.equal(restored.imported.pet.saveMetadata.compensation, text === currentText ? 'ineligible' : 'pending');
  assert.equal(cloud.writes, 0, 'cloud preview must not migrate, award or upload');
}
const fullCloud = new CloudMock();
const fullEncoded = await seedGeneration(fullCloud, currentText, 'a', 1024, cloudSaveMaxEncodedLength);
assert.equal(fullEncoded.length, 61440);
assert.equal(fullCloud.values.get('pocpet-save-a-59')?.length, 1024);
assert.equal((await restoreCloudSave(fullCloud, now)).imported.pet.name, pet.name, 'all 60 new-size blocks remain readable');

const cloud = new CloudMock();
cloud.values.set('other-feature', 'keep');
const initial = await uploadCloudSave(cloud, pet, null, now);
const written = cloud.writes;
const unchanged = await uploadCloudSave(cloud, pet, null, now + 1000);
assert.equal(unchanged.unchanged, true);
assert.equal(cloud.writes, written, 'only exportedAt differs: do not rewrite cloud blocks');
assert.equal(unchanged.uploadedAt, initial.uploadedAt);
assert.equal(getCloudContentChecksum(currentText), getCloudContentChecksum(JSON.stringify({ ...JSON.parse(currentText), exportedAt: new Date(now + 1000).toISOString() })));
const changed = { ...pet, lastUpdatedAt: now + 1000 };
assert.notEqual(getCloudContentChecksum(createSaveFileText(changed, null, now)), getCloudContentChecksum(currentText), 'game clocks are part of the digest');
const newer = await uploadCloudSave(cloud, changed, null, now + 1000);
assert.equal(newer.generation, 'b');
assert.ok(cloud.writes > written);
assert.equal(cloud.values.get('other-feature'), 'keep');
const dataChanged = { ...changed, coins: changed.coins + 10 };
const originalValues = new Map(cloud.values);
cloud.failRead = true;
await assert.rejects(uploadCloudSave(cloud, dataChanged, null, now + 1000), /network read/);
assert.deepEqual(cloud.values, originalValues);
cloud.failRead = false;
cloud.truncateNextManifest = true;
await assert.rejects(uploadCloudSave(cloud, dataChanged, null, now + 1000), /manifest.*verification/);
assert.equal(cloud.values.get(cloudSaveActiveKey), 'b', 'the stored manifest is read back before activation');
cloud.corruptNextManifest = true;
await assert.rejects(uploadCloudSave(cloud, dataChanged, null, now + 1000), /damaged/);
assert.equal(cloud.values.get(cloudSaveActiveKey), 'b', 'read-back verification must finish before activation');
assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, pet.coins);
cloud.failActivation = true;
await assert.rejects(uploadCloudSave(cloud, dataChanged, null, now + 1000), /activation/);
assert.equal(cloud.values.get(cloudSaveActiveKey), 'b');
assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, pet.coins);

// Digest is an optimization hint, not proof of equality or an excuse to skip validation.
const candidateText = createSaveFileText(dataChanged, null, now + 1000);
const activeManifestKey = 'pocpet-save-b-manifest-v1';
const existingManifest = JSON.parse(cloud.values.get(activeManifestKey)!);
cloud.values.set(activeManifestKey, JSON.stringify({ ...existingManifest, contentChecksum: getCloudContentChecksum(candidateText) }));
const actualChange = await uploadCloudSave(cloud, dataChanged, null, now + 1000);
assert.ok(!actualChange.unchanged, 'equal digest hints still compare the complete canonical content');
assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, dataChanged.coins);

const largeInventory = (count: number) => Object.fromEntries(Array.from({ length: count }, () => [`mod.${randomBytes(48).toString('hex')}`, 1]));
for (const oversized of [
  { ...pet, inventory: largeInventory(1600) }, // Below the plain limit but over the compressed transport limit.
  { ...pet, inventory: largeInventory(5400) }, // Over the raw UTF-8 limit.
]) {
  const before = new Map(cloud.values);
  const calls = cloud.writes;
  await assert.rejects(uploadCloudSave(cloud, oversized, null, now), /容量|capacity/);
  assert.equal(cloud.writes, calls);
  assert.deepEqual(cloud.values, before, 'oversized uploads leave both generations untouched');
}
const beforeLargeManifest = new Map(cloud.values);
await assert.rejects(uploadCloudSave(cloud, dataChanged, { id: 'id', name: '名称'.repeat(200), version: '1.0.0' }, now), /invalid Mod|容量|capacity/);
assert.deepEqual(cloud.values, beforeLargeManifest);
const transientNoise = await encodeCloudSave({ ...pet, recentEvent: randomBytes(100000).toString('base64') }, null, now);
assert.ok(transientNoise.encoded.length < 10000, 'large transient messages never reach cloud storage');

const futureText = JSON.stringify({ ...JSON.parse(currentText), minimumReaderVersion: '2.0.0' });
for (const futureIsActive of [true, false]) {
  const futureCloud = new CloudMock();
  await seedGeneration(futureCloud, currentText, 'a', 960);
  await seedGeneration(futureCloud, futureText, 'b', 1024);
  if (!futureIsActive) futureCloud.values.set(cloudSaveActiveKey, 'a');
  const before = new Map(futureCloud.values);
  if (futureIsActive) await assert.rejects(restoreCloudSave(futureCloud, now), UnsupportedSaveVersionError, 'a valid newer active save must not fall back to old progress');
  await assert.rejects(uploadCloudSave(futureCloud, pet, null, now), UnsupportedSaveVersionError, 'neither a newer active nor inactive copy may be overwritten');
  assert.deepEqual(futureCloud.values, before);
  assert.equal(futureCloud.writes, 0);
}
const futureManifest = new CloudMock();
await seedGeneration(futureManifest, currentText, 'a');
futureManifest.values.set('pocpet-save-b-manifest-v1', JSON.stringify({ schemaVersion: 2, generation: 'b' }));
await assert.rejects(restoreCloudSave(futureManifest, now), UnsupportedSaveVersionError);
await assert.rejects(uploadCloudSave(futureManifest, pet, null, now), UnsupportedSaveVersionError);

// Continue enforcing the existing decompression ceiling on old cloud data.
const bombCloud = new CloudMock();
await seedGeneration(bombCloud, JSON.stringify({ ...JSON.parse(legacyText), extra: 'x'.repeat(cloudSaveMaxPlainBytes) }), 'a');
await assert.rejects(restoreCloudSave(bombCloud, now), /safety limit/);
console.log('Cloud v2: legacy 960/new 1024 blocks, exact 61,440 capacity, unchanged data, preflight limits, interrupted writes, validation, fallback and future-version protection passed (mock storage only).');
