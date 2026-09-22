import assert from 'node:assert/strict';
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { getReleaseBuildPlan, releaseArtifactNames } from './release-policy.mjs';

// npm test is the only daily check. Release modes also work before npm ci in CI.
const { values } = parseArgs({ options: {
  release: { type: 'boolean' }, artifacts: { type: 'string' },
  dist: { type: 'string' }, edition: { type: 'string', default: 'standard' },
  binary: { type: 'string' }, arch: { type: 'string' }, metadata: { type: 'boolean' },
} });
const json = file => JSON.parse(readFileSync(file, 'utf8'));

async function verifyRelease() {
  const { version } = json('package.json');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(json('package-lock.json').version, version, 'package-lock version mismatch');
  assert.equal(json('package-lock.json').packages[''].version, version);
  assert.equal(json('src-tauri/tauri.conf.json').version, version, 'Tauri version mismatch');
  const cargo = JSON.parse(execFileSync('cargo', ['metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--no-deps', '--locked', '--format-version', '1'], { encoding: 'utf8' }));
  assert.equal(cargo.packages.find(item => item.name === 'app').version, version, 'Cargo version mismatch');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, revision);
  if ((process.env.GITHUB_REF || '').startsWith('refs/tags/')) assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`);
  if (values.metadata && process.env.GITHUB_OUTPUT) {
    const plan = getReleaseBuildPlan({ eventName: process.env.GITHUB_EVENT_NAME, ref: process.env.GITHUB_REF, manualFullBuild: process.env.MANUAL_FULL_BUILD === 'true' });
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nrevision=${revision}\nfull_build=${plan.fullBuild}\nrelease_build=${plan.releaseBuild}\npublish_release=${plan.publishRelease}\n`);
  }
  let assets = [];
  if (values.dist) {
    const build = json(join(values.dist, 'build-info.json'));
    assert.equal(build.version, version);
    assert.equal(build.edition, values.edition);
    assert.equal(build.revision, revision);
    const index = readFileSync(join(values.dist, 'index.html'), 'utf8');
    assert.equal(index.includes('toy-sdk.js'), values.edition === 'bilibili', 'Wrong SDK in frontend output');
    const manifest = json(join(values.dist, 'asset-manifest.json'));
    assets = [...new Set(Object.values(manifest).flatMap(entry => [entry.file, ...(entry.css || []), ...(entry.assets || [])]))];
    for (const asset of assets) assert.ok(existsSync(join(values.dist, asset)), `Missing asset: ${asset}`);
    for (const entry of Object.values(manifest).filter(entry => entry.isEntry)) assert.ok(index.includes(entry.file), 'Stale index.html');
  }
  if (values.binary) {
    assert.ok(values.dist && values.edition === 'standard', 'Native binaries need a standard-edition dist.');
    let binary = readFileSync(resolve(values.binary));
    if (values.binary.endsWith('.apk')) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(binary);
      const library = zip.file(`lib/${values.arch === 'arm64' ? 'arm64-v8a' : 'armeabi-v7a'}/libapp_lib.so`);
      assert.ok(library, 'APK architecture mismatch');
      binary = await library.async('nodebuffer');
    }
    if (binary.subarray(0, 2).toString() === 'MZ') {
      assert.equal(binary.readUInt16LE(binary.readUInt32LE(0x3c) + 4), values.arch === 'x86' ? 0x14c : 0x8664, 'Wrong PE architecture');
    } else if (binary.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
      assert.equal(binary.readUInt16LE(18), { arm64: 183, armv7: 40, x64: 62 }[values.arch], 'Wrong ELF architecture');
    } else {
      assert.equal(binary.readUInt32LE(0), 0xfeedfacf, 'Expected a native 64-bit Mach-O binary');
      assert.equal(binary.readUInt32LE(4), values.arch === 'arm64' ? 0x0100000c : 0x01000007, 'Wrong Mach-O architecture');
    }
    for (const asset of assets.filter(name => /\.(js|css)$/.test(name))) assert.ok(binary.includes(Buffer.from(asset)), `Stale embedded asset: ${asset}`);
  }
  console.log(`Release check passed: ${version}, ${values.edition}, ${revision.slice(0, 8)}`);
}

class MemoryStorage {
  values = new Map();
  failRead = '';
  failWrite = '';
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) {
    if (key === this.failRead) { this.failRead = ''; throw new Error('Injected read failure'); }
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (key === this.failWrite) { this.failWrite = ''; throw new Error('Injected write failure'); }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

async function verifySavesAndErrors() {
  const storage = new MemoryStorage();
  const descriptors = ['window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { localStorage: storage } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const realNow = Date.now;
  const now = Date.parse('2026-09-21T04:00:00.000Z');
  Date.now = () => now;
  const quiet = { neighbors: [], giftCandidates: [], random: () => 0 };
  let passed = 0;
  const check = async (label, fn) => {
    try { await fn(); passed++; console.log(`✓ ${label}`); }
    catch (error) { throw new Error(`${label}: ${error.message}`, { cause: error }); }
  };
  try {
    const [petModule, codec, disk, cloudModule, native, recovery, clock, dates] = await Promise.all([
      import('../src/core/petState.ts'), import('../src/core/saveCodec.ts'), import('../src/core/storage.ts'),
      import('../src/core/cloudSave.ts'), import('../src/platform/nativeSave.ts'), import('../src/platform/saveRecovery.ts'),
      import('../src/core/timePause.ts'), import('../src/core/persistedDates.ts'),
    ]);
    const { createDefaultPet, normalizePet } = petModule;
    const { createSaveFileText, parseSaveFileText, loadStoredPetJson, UnsupportedSaveVersionError } = codec;
    const primary = 'pocpet.pet.v1';
    const base = createDefaultPet(now);
    const pet = normalizePet({ ...base, coins: 5000, inventory: { ...base.inventory, apple: 3, emergency_biscuit: 3, 'fixture.mod:snack': 7 } }, now);
    const text = createSaveFileText(pet, null, now);
    const reset = raw => {
      native.cancelPendingNativeSave();
      storage.values.clear(); storage.failRead = ''; storage.failWrite = '';
      if (raw !== undefined) storage.setItem(primary, raw);
      const result = disk.loadPet(now, quiet);
      disk.takeStorageFeedback();
      return result;
    };

    await check('JSON v2、压缩日期和进度往返', () => {
      const before = JSON.stringify(pet);
      const envelope = JSON.parse(text);
      assert.equal(envelope.schemaVersion, 2);
      assert.ok(!('recentEvent' in envelope.pet));
      const loaded = parseSaveFileText(text, now).pet;
      for (const key of ['inventory', 'community', 'garden', 'saveMetadata']) assert.deepEqual(loaded[key], pet[key], key);
      assert.deepEqual(loaded.partnerSchedule.skills, pet.partnerSchedule.skills);
      assert.equal(loaded.coins, pet.coins);
      assert.equal(JSON.stringify(pet), before, 'export must not mutate game state');
      const importedText = createSaveFileText(loaded, null, now);
      assert.ok(createSaveFileText(parseSaveFileText(importedText, now).pet, null, now) === importedText, 'repeat import/export must stabilize after rebasing timers');
      const keys = ['2024-02-28', '2024-02-29', '2024-03-01', '2024-12-31'];
      assert.deepEqual(dates.unpackDateKeys(dates.packDateKeys(keys)), keys);
      const damaged = { ...envelope, pet: { ...envelope.pet, yearlyStats: { ...envelope.pet.yearlyStats, activeDateKeys: { first: 0, bits: 'broken' } } } };
      assert.equal(loadStoredPetJson(JSON.stringify(damaged), now).status, 'corrupt');
      const later = parseSaveFileText(text, now + 180 * 86400000).pet;
      assert.equal(later.lastUpdatedAt, now + 180 * 86400000);
      assert.equal(later.health, pet.health);
      const invalidStats = normalizePet({ ...pet, coins: NaN, health: -100, mood: Infinity, inventory: { apple: -2 } }, now);
      for (const key of ['coins', 'health', 'mood']) assert.ok(Number.isFinite(invalidStats[key]) && invalidStats[key] >= 0, key);
    });

    await check('全地图旧档迁移、旧在途安全返程与物产往返', async () => {
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { expeditionProducts } = await import('../src/core/expeditionData.ts');
      const { getAdventureSteps } = await import('../src/core/adventureData.ts');
      const { startAdventure } = await import('../src/core/adventure.ts');
      const { claimExpedition } = await import('../src/core/expedition.ts');
      const { getExplorationBagCapacity } = await import('../src/core/explorationBackpack.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const legacy = structuredClone(pet);
      legacy.adventure.schemaVersion = 7; delete legacy.adventure.landmarks;
      legacy.adventure.completed = { tutorial: 1, valley: 1 };
      legacy.adventure.valleyCompleted = ['valley_gather'];
      let loaded = normalizePet(legacy, now);
      assert.deepEqual(loaded.adventure.landmarks, ['landmark:valley:entrance', 'landmark:valley:gather']);
      legacy.community.expedition.regions.windmill = { surveyed: true, base: 2, harvestUsed: 0, harvestDay: '' };
      delete legacy.community.expedition.regions.hills;
      legacy.community.expedition.active = { id: 'expedition:19', rulesVersion: 4, mode: 'manual', actorId: 'official.furo', actorName: 'Furo', route: ['windmill', 'forest'], leg: 1, step: 3, startedAt: now, endsAt: now, parts: 2, settledParts: 0, tool: true, bag: { hill_honey: 2, forest_berry: 1 }, ground: { sea_glass: 3 }, coins: 47, hearts: 4, rested: [], paused: true, journal: [] };
      loaded = normalizePet(legacy, now);
      assert.equal(loaded.adventure.landmarks.filter(id => id.startsWith('landmark:windmill:')).length, 8);
      assert.equal(loaded.community.expedition.regions.hills.base, 2);
      assert.equal(loaded.community.expedition.active, undefined);
      const receipt = loaded.community.expedition.pending;
      assert.deepEqual(receipt.items, { hill_honey: 2, forest_berry: 1 });
      assert.deepEqual(receipt.overflow, { sea_glass: 3 });
      assert.equal(receipt.tool, true); assert.equal(receipt.coins, 47);
      assert.equal(loaded.coins, legacy.coins, 'migration must not grant chapter rewards');
      assert.deepEqual(normalizePet(loaded, now).community.expedition.pending, receipt);
      const restored = parseSaveFileText(createSaveFileText(loaded, null, now), now).pet;
      assert.deepEqual(restored.community.expedition.pending.items, receipt.items);
      assert.deepEqual(restored.adventure.landmarks, loaded.adventure.landmarks);
      const fullBag = getExplorationBagCapacity(restored);
      const blockedReturn = { ...restored, inventory: { ...restored.inventory, hill_honey: inventoryItemLimit, trail_rope: inventoryItemLimit }, community: { ...restored.community, expedition: { ...restored.community.expedition, pending: { ...receipt, selected: true, items: { hill_honey: fullBag }, overflow: {} } } } };
      const deferred = claimExpedition(blockedReturn, receipt.id);
      const deferredRestored = parseSaveFileText(createSaveFileText(deferred, null, now), now).pet;
      assert.deepEqual(deferredRestored.community.expedition.pending.items, { hill_honey: fullBag });
      assert.equal(deferredRestored.community.expedition.pending.tool, true, 'a blocked equipped tool must keep its separate return slot');
      const repeated = claimExpedition(deferredRestored, receipt.id);
      assert.deepEqual(repeated.community.expedition.pending, deferredRestored.community.expedition.pending);
      assert.equal(repeated.hearts, deferredRestored.hearts, 'deferred returns must not repeat heart rewards');
      repeated.inventory.hill_honey -= fullBag; repeated.inventory.trail_rope--;
      const collected = claimExpedition(repeated, receipt.id);
      assert.equal(collected.community.expedition.pending, undefined);
      assert.equal(collected.inventory.hill_honey, inventoryItemLimit); assert.equal(collected.inventory.trail_rope, inventoryItemLimit);
      assert.deepEqual(claimExpedition(collected, receipt.id), collected);
      const oldStory = structuredClone(loaded);
      oldStory.community.expedition.pending = undefined;
      oldStory.adventure.active = { id: 'old-story', actorId: 'official.furo', actorName: 'Furo', region: 'valley', purpose: 'valley_crossing', startedAt: now, rulesVersion: 8, revision: 1, choices: [getAdventureSteps(8, 'valley', 'valley_crossing')[0].choices[0].id], bag: { bento: 1 }, loot: {}, tool: true, shopStock: {}, purchases: 0, transportedCount: 0 };
      const oldRestored = parseSaveFileText(createSaveFileText(oldStory, null, now), now).pet;
      assert.equal(oldRestored.adventure.active.rulesVersion, 8);
      assert.equal(getAdventureSteps(8, 'valley', oldRestored.adventure.active.purpose).length, 3);
      assert.deepEqual(oldRestored.adventure.active.choices, oldStory.adventure.active.choices);
      const all = normalizePet({ ...pet, adventure: { ...pet.adventure, completed: { tutorial: 1 }, backpackLevel: 3, landmarks: mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node))) } }, now);
      const started = startAdventure(all, 'observatory', 'official.furo', 'Furo', {}, false, now, 'landmark:observatory:gather');
      assert.ok(started.adventure.active, started.recentEvent);
      started.adventure.active.bag = Object.fromEntries(Object.keys(expeditionProducts).map(id => [id, 1]));
      const saved = parseSaveFileText(createSaveFileText(started, null, now), now).pet;
      assert.deepEqual(saved.adventure.active.bag, started.adventure.active.bag, 'every region product and treasure survives the bag codec');
      assert.deepEqual(saved.adventure.landmarks, all.adventure.landmarks);
    });

    await check('挂机地区保底跨存档、提前返回与结算重复恢复', async () => {
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { regionIds } = await import('../src/core/expeditionData.ts');
      const { regionalTreasureIds, regionalTreasures } = await import('../src/core/regionalTreasures.ts');
      const { startExpedition, claimExpedition, getExpeditionStartReason } = await import('../src/core/expedition.ts');
      const { settleExpeditionTime, finishExpedition } = await import('../src/core/expeditionReturn.ts');
      const full = normalizePet({ ...pet, coins: 100000, adventure: { ...pet.adventure, completed: { tutorial: 1 }, landmarks: mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node))) }, community: { ...pet.community, expedition: { ...pet.community.expedition, regions: Object.fromEntries(regionIds.map(id => [id, { surveyed: true, base: 1, harvestUsed: 0, harvestDay: '' }])) } } }, now);
      for (const region of regionIds) {
        const treasure = regionalTreasureIds.find(id => regionalTreasures[id].region === region);
        let state = structuredClone(full);
        state.community.expedition.treasurePity[region] = 8;
        const snapshot = JSON.stringify(state);
        getExpeditionStartReason(state, [region], 'idle', 2, now);
        assert.equal(JSON.stringify(state), snapshot, 'preview must not advance pity');
        state = startExpedition(state, [region], {}, false, 'official.furo', 'Furo', 'idle', 2, now);
        assert.ok(state.community.expedition.active, state.recentEvent);
        const t = state.community.expedition.active;
        t.rationPlan.discoveries[0].roll = 99;
        const early = finishExpedition(settleExpeditionTime(state, now + 7199999), 'return', now + 7199999);
        assert.equal(early.community.expedition.treasurePity[region], 8);
        const missed = settleExpeditionTime(state, t.endsAt);
        assert.equal(missed.community.expedition.treasurePity[region], 9);
        assert.equal(missed.community.expedition.pending.items[treasure] ?? 0, 0);
        assert.deepEqual(settleExpeditionTime(missed, t.endsAt), missed);
        let restored = parseSaveFileText(createSaveFileText(missed, null, now), now).pet;
        assert.equal(restored.community.expedition.treasurePity[region], 9);
        restored = claimExpedition(restored, restored.community.expedition.pending.id);
        restored = startExpedition(restored, [region], {}, false, 'official.furo', 'Furo', 'idle', 2, now);
        assert.ok(restored.community.expedition.active, restored.recentEvent);
        restored.community.expedition.active.rationPlan.discoveries[0].roll = 99;
        const guaranteed = settleExpeditionTime(restored, restored.community.expedition.active.endsAt);
        assert.equal(guaranteed.community.expedition.treasurePity[region], 0);
        assert.equal(guaranteed.community.expedition.pending.items[treasure], 1);
        assert.equal(guaranteed.community.expedition.pending.treasureFinds[0].guaranteed, true);
        const pending = parseSaveFileText(createSaveFileText(guaranteed, null, now), now).pet;
        const id = pending.community.expedition.pending.id, claimed = claimExpedition(pending, id);
        assert.equal(claimExpedition(claimed, id), claimed);
        assert.equal(claimed.inventory[treasure], 1);
        const old = structuredClone(restored);
        old.community.expedition.active.rulesVersion = 4;
        old.community.expedition.active.rationPlan.version = 2;
        assert.equal(settleExpeditionTime(old, old.community.expedition.active.endsAt).community.expedition.treasurePity[region], 9, 'old trips retain their old rules');
        const lucky = structuredClone(state); lucky.community.expedition.active.rationPlan.discoveries[0].roll = 0;
        assert.equal(settleExpeditionTime(lucky, lucky.community.expedition.active.endsAt).community.expedition.treasurePity[region], 0);
      }
    });

    await check('手动阶段恢复、首通防重与满仓满币待领', async () => {
      const { startAdventure, advanceAdventure, returnFromAdventure, claimAdventureResult, redeemAdventureTreasure } = await import('../src/core/adventure.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getPetStatCap, getPetEnergyCap, clampCoins } = await import('../src/core/petStats.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      let state = startAdventure(fuel({ ...pet, adventure: { ...pet.adventure, completed: { tutorial: 1 } } }), 'valley', 'official.furo', 'Furo', {}, false, now, 'landmark:valley:entrance');
      for (const step of getLandmarkSteps('landmark:valley:entrance')) {
        state = fuel(state);
        const trip = state.adventure.active;
        state = advanceAdventure(state, trip.id, trip.choices.length, step.choices[0].id, now, trip.revision);
        assert.equal(state.adventure.active.stageIds.length, trip.choices.length + 1);
        const repeated = advanceAdventure(state, trip.id, trip.choices.length, step.choices[0].id, now, trip.revision);
        assert.deepEqual(repeated.adventure, state.adventure, 'stale stage action cannot repeat its reward');
        state = parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      }
      assert.equal(state.adventure.landmarks.filter(id => id === 'landmark:valley:entrance').length, 1);
      state = returnFromAdventure(state, state.adventure.active.id, now);
      const id = state.adventure.pending.id, amount = state.adventure.pending.coins;
      state.coins = clampCoins(Number.MAX_SAFE_INTEGER);
      state.inventory.coin_hoard = inventoryItemLimit;
      state = claimAdventureResult(state, id);
      assert.equal(state.adventure.pending.coinsRemaining, amount);
      assert.equal(state.adventure.pending.items.coin_hoard, 1);
      const claimedHearts = state.hearts;
      state = parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      assert.deepEqual(claimAdventureResult(state, id).inventory, state.inventory);
      state.coins -= amount; state.inventory.coin_hoard--;
      state = claimAdventureResult(state, id);
      assert.equal(state.hearts, claimedHearts);
      assert.equal(state.adventure.pending, undefined);
      assert.equal(claimAdventureResult(state, id), state);
      const repeatedTrip = startAdventure(fuel(state), 'valley', 'official.furo', 'Furo', {}, false, now, 'landmark:valley:entrance');
      assert.ok(repeatedTrip.adventure.active, repeatedTrip.recentEvent);
      repeatedTrip.adventure.active.bag.coin_hoard = 1;
      assert.equal(redeemAdventureTreasure(repeatedTrip, repeatedTrip.adventure.active.id, repeatedTrip.adventure.active.revision).adventure.active.bag.coin_hoard, 1);
    });

    await check('音乐陪伴存档兼容、累计进度与结算幂等', async () => {
      const { addMusicListeningTime, claimMusicHearts } = await import('../src/core/musicCompanion.ts');
      const oldEnvelope = JSON.parse(text);
      delete oldEnvelope.pet.musicCompanion;
      assert.deepEqual(parseSaveFileText(JSON.stringify(oldEnvelope), now).pet.musicCompanion, { schemaVersion: 1, pendingListeningMs: 0 });
      const almostReady = parseSaveFileText(createSaveFileText(addMusicListeningTime(pet, 120_000 - 1), null, now), now).pet;
      assert.equal(claimMusicHearts(almostReady), almostReady);
      assert.equal(claimMusicHearts(addMusicListeningTime(almostReady, 1)).hearts, pet.hearts + 1, 'two minutes across a save boundary earns one heart');
      const listening = addMusicListeningTime(pet, 25 * 60_000 + 123);
      const reopened = parseSaveFileText(createSaveFileText(listening, null, now), now + 10 * 86400_000).pet;
      assert.equal(reopened.musicCompanion.pendingListeningMs, listening.musicCompanion.pendingListeningMs, 'offline time must not add listening time');
      const claimed = claimMusicHearts(reopened);
      assert.equal(claimed.hearts - reopened.hearts, 12);
      assert.equal(claimed.musicCompanion.pendingListeningMs, 60_000 + 123);
      assert.equal(claimMusicHearts(claimed), claimed, 'repeated settlement must not repeat a reward');
      const carried = parseSaveFileText(createSaveFileText(claimed, null, now), now).pet;
      assert.equal(claimMusicHearts(addMusicListeningTime(carried, 60_000)).hearts, claimed.hearts + 1);
      assert.equal(claimMusicHearts(addMusicListeningTime(pet, 100 * 120_000)).hearts, pet.hearts + 100, 'no daily/session reward cap');
      for (const invalid of [-1, NaN, Infinity]) {
        assert.equal(addMusicListeningTime(pet, invalid), pet);
        assert.equal(normalizePet({ ...pet, musicCompanion: { pendingListeningMs: invalid } }, now).musicCompanion.pendingListeningMs, 0);
      }
      const frozen = { ...listening, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(addMusicListeningTime(frozen, 120_000), frozen);
      assert.equal(claimMusicHearts(frozen), frozen);
      const future = JSON.parse(text);
      future.pet.musicCompanion.schemaVersion = 99;
      assert.throws(() => parseSaveFileText(JSON.stringify(future), now), UnsupportedSaveVersionError);
    });

    await check('旧档、Mint 保护文本与迁移幂等', () => {
      const { saveMetadata: _metadata, ...legacy } = pet;
      const originals = [JSON.stringify(legacy), JSON.stringify({ schemaVersion: 1, app: 'PocPet', exportedAt: new Date(now).toISOString(), pet: legacy }),
        readFileSync(new URL('./fixtures/pocpet-mint-1.0.1-export.pocpet', import.meta.url), 'utf8')];
      for (const original of originals) {
        reset();
        const preview = parseSaveFileText(original, now);
        assert.equal(storage.length, 0, 'preview must not write or migrate');
        const converted = disk.replacePetFromImport(preview.pet, '', preview.activeMod, original, now);
        assert.equal(storage.getItem(disk.formatBackupStoragePrefix + converted.saveMetadata.id), original);
        assert.equal(converted.saveMetadata.compensation, 'claimed');
        assert.ok(converted.inventory.emergency_biscuit > (preview.pet.inventory.emergency_biscuit ?? 0));
        const reopened = disk.loadPet(now, quiet);
        assert.equal(reopened.status, 'ok');
        assert.deepEqual(reopened.pet.inventory, converted.inventory, 'reload cannot repeat compensation');
        const repeated = disk.replacePetFromImport(parseSaveFileText(original, now).pet, '', preview.activeMod, original, now);
        assert.equal(repeated.inventory.emergency_biscuit ?? 0, preview.pet.inventory.emergency_biscuit ?? 0);
        assert.equal(repeated.saveMetadata.id, converted.saveMetadata.id);
      }
      const fixture = json(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url));
      assert.ok(parseSaveFileText(fixture.text, now).pet.saveMetadata.id);
      reset(text);
      assert.equal(disk.loadPet(now, quiet).pet.saveMetadata.compensation, 'ineligible');
    });

    await check('损坏输入和高版本存档拒绝覆盖', () => {
      for (const invalid of ['{', '{}', '[]', 'null', 'POCPET-SAVE-v2:00000000:AAAA']) assert.throws(() => parseSaveFileText(invalid, now));
      const envelope = JSON.parse(text);
      const future = [
        { ...envelope, schemaVersion: 999 }, { ...envelope, minimumReaderVersion: '999.0.0' }, { ...envelope, encoding: 'compact-v999' },
        { ...envelope, pet: { ...envelope.pet, unknownModule: {} } },
        ...Object.entries(envelope.pet).filter(([, value]) => value && typeof value === 'object' && Number.isInteger(value.schemaVersion))
          .map(([key, value]) => ({ ...envelope, pet: { ...envelope.pet, [key]: { ...value, schemaVersion: 999 } } })),
        { ...envelope, pet: { ...envelope.pet, adventure: { ...envelope.pet.adventure, active: { rulesVersion: 999 } } } },
        { ...envelope, pet: { ...envelope.pet, community: { ...envelope.pet.community, expedition: { schemaVersion: 999 } } } },
      ];
      for (const value of future) {
        const raw = JSON.stringify(value);
        assert.throws(() => parseSaveFileText(raw, now), UnsupportedSaveVersionError);
        const blocked = reset(raw);
        assert.equal(blocked.status, 'corrupt'); assert.equal(blocked.stage, 'version');
        assert.throws(() => disk.savePet(pet), UnsupportedSaveVersionError);
        assert.equal(storage.getItem(primary), raw);
      }
    });

    await check('存储报错、导入回滚、多窗口冲突与备份恢复', () => {
      reset(text);
      const identity = { id: 'fixture.mod', name: 'Fixture', version: '1.0.0' };
      disk.setStoredSaveIdentity(identity); disk.savePet(pet);
      const keys = [primary, `${primary}.backup`, `${primary}.backup.identity`, `${primary}.identity`, `${primary}.import-backup`];
      const before = keys.map(key => storage.getItem(key));
      storage.failWrite = primary;
      assert.throws(() => disk.replacePetFromImport({ ...pet, coins: 99 }, text, null), /Injected write/);
      assert.deepEqual(keys.map(key => storage.getItem(key)), before, 'failed imports must preserve progress and identity');
      storage.setItem(primary, createSaveFileText({ ...pet, coins: 1 }, null, now));
      assert.throws(() => disk.savePet(pet), /storage-conflict/);
      assert.equal(parseSaveFileText(storage.getItem(primary), now).pet.coins, 1);
      reset(text); assert.equal(disk.backupCurrentPet(), true);
      storage.setItem(primary, '{broken');
      const damaged = disk.loadPet(now, quiet);
      assert.equal(damaged.status, 'corrupt'); assert.equal(damaged.backup.coins, pet.coins);
      assert.equal(disk.getPreservedCorruptPetRaw(), '{broken');
      assert.equal(disk.restorePetBackup(now, quiet).coins, pet.coins);
      storage.failRead = primary;
      assert.equal(disk.loadPet(now, quiet).status, 'unavailable');
      reset(); storage.setItem(primary, text); storage.failWrite = disk.upgradeStorageKey;
      assert.equal(disk.loadPet(now, quiet).persistenceError, 'upgradeBackup');
      assert.throws(() => disk.savePet(pet), /upgrade-backup-blocked/);
      assert.equal(storage.getItem(primary), text);
      reset(text); storage.setItem(disk.migrationLedgerStorageKey, '{broken');
      disk.savePet({ ...pet, coins: 321 });
      assert.equal(parseSaveFileText(storage.getItem(primary), now).pet.coins, 321);
      assert.equal(storage.getItem(disk.migrationLedgerStorageKey), '{broken');
    });

    await check('行程随机种子、规则版本及冻结时间保存', async () => {
      const { startAdventure } = await import('../src/core/adventure.ts');
      const ready = { ...pet, adventure: { ...pet.adventure, completed: { tutorial: 1 } } };
      const adventure = startAdventure(ready, 'valley', 'official.furo', 'Furo', {}, false, now);
      for (const [started, tripOf] of [[adventure, p => p.adventure.active]]) {
        const trip = tripOf(started);
        assert.ok(trip?.checkState, 'real trip must start with saved check state');
        const restored = tripOf(parseSaveFileText(createSaveFileText(started, null, now), now).pet);
        for (const key of ['id', 'rulesVersion', 'revision', 'bag', 'checkState']) assert.deepEqual(restored[key], trip[key], key);
      }
      const frozen = clock.prepareTimePause(pet, now, quiet);
      const restored = parseSaveFileText(createSaveFileText(frozen, null, now), now + 86400000).pet;
      assert.deepEqual(restored.timePause, frozen.timePause);
      assert.equal(restored.health, frozen.health);
      const resumed = clock.resumePetTime(restored, now + 86400000);
      assert.equal(resumed.timePause, undefined);
      assert.equal(resumed.health, frozen.health);
    });

    await check('云存档往返、写入中断、损坏回退与高版本保护', async () => {
      const { uploadCloudSave, restoreCloudSave, cloudSaveActiveKey } = cloudModule;
      const entries = new Map();
      let failActivation = false;
      const cloud = {
        getCloudStorage: async (keys = [...entries.keys()]) => Object.fromEntries(keys.filter(key => entries.has(key)).map(key => [key, entries.get(key)])),
        setCloudStorage: async values => {
          if (failActivation && cloudSaveActiveKey in values) { failActivation = false; throw new Error('Injected activation failure'); }
          for (const [key, value] of Object.entries(values)) entries.set(key, value);
        },
        removeCloudStorage: async keys => keys.forEach(key => entries.delete(key)),
      };
      await uploadCloudSave(cloud, pet, null, now);
      assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, pet.coins);
      assert.equal((await uploadCloudSave(cloud, pet, null, now + 1000)).unchanged, true);
      const active = entries.get(cloudSaveActiveKey);
      failActivation = true;
      await assert.rejects(uploadCloudSave(cloud, { ...pet, coins: 99 }, null, now + 1000), /activation failure/);
      assert.equal(entries.get(cloudSaveActiveKey), active);
      assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, pet.coins);
      const newer = await uploadCloudSave(cloud, { ...pet, coins: 123 }, null, now + 2000);
      entries.set(`pocpet-save-${newer.generation}-00`, 'damaged');
      assert.equal((await restoreCloudSave(cloud, now)).imported.pet.coins, pet.coins);
      entries.set(`pocpet-save-${newer.generation}-manifest-v1`, JSON.stringify({ schemaVersion: 999, generation: newer.generation }));
      const before = new Map(entries);
      await assert.rejects(restoreCloudSave(cloud, now), UnsupportedSaveVersionError);
      await assert.rejects(uploadCloudSave(cloud, pet, null, now), UnsupportedSaveVersionError);
      assert.deepEqual(entries, before);
    });

    await check('原生独立存档恢复、写入失败重试与过期写入取消', async () => {
      reset();
      const normalWindow = window;
      let recent = [text]; let fail = false; let error = '';
      const unsubscribe = native.subscribeNativeSave(value => { error = value; });
      window.__TAURI_INTERNALS__ = { invoke: async (command, payload) => {
        if (command === 'read_recent_saves') return { files: recent, warnings: [] };
        if (command === 'read_backup_files') return { files: [], warnings: [] };
        if (command === 'read_backup_latest') return null;
        assert.equal(command, 'write_recent_save');
        if (fail) throw new Error('Injected native failure');
        recent = [payload.text, ...recent].slice(0, 2);
      } };
      try {
        assert.ok((await recovery.collectRecoveryCandidates()).candidates.some(candidate => candidate.text === text));
        const newer = createSaveFileText({ ...pet, coins: 123 }, null, now);
        fail = true; native.queueNativeSave(newer, false); await native.flushNativeSave();
        assert.match(error, /native failure/); assert.equal(recent[0], text);
        fail = false; await native.flushNativeSave();
        assert.equal(recent[0], newer); assert.equal(error, '');
        native.queueNativeSave(text, false, () => false); await native.flushNativeSave();
        assert.equal(recent[0], newer, 'a stale page must not overwrite independent recovery');
        native.queueNativeSave(text, false); native.cancelPendingNativeSave(); await native.flushNativeSave();
        assert.equal(recent[0], newer);
      } finally { native.cancelPendingNativeSave(); unsubscribe(); delete normalWindow.__TAURI_INTERNALS__; }
    });

    await check('入口模块加载报错检查', async () => {
      const { createServer } = await import('vite');
      const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
      try {
        assert.equal(typeof (await server.ssrLoadModule('/src/ui/App.tsx')).App, 'function');
        await check('BGM 加载失败有界重试与暂停保护', async () => {
          const bgm = await server.ssrLoadModule('/src/core/bgm.ts');
          const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
          const performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
          let mediaClock = 0;
          let latestAudio;
          let creations = 0;
          let denyNextPlay = false;
          class MediaStub {
            currentTime = 0; paused = true; seeking = false; muted = false; volume = 0;
            constructor() { latestAudio = this; creations++; }
            play() {
              if (denyNextPlay) { denyNextPlay = false; return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' })); }
              this.paused = false; this.onplaying?.(); return Promise.resolve();
            }
            pause() { this.paused = true; this.onpause?.(); }
            removeAttribute() {}
            load() {}
          }
          Object.defineProperty(globalThis, 'Audio', { configurable: true, value: MediaStub });
          Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => mediaClock } });
          const progress = ms => { mediaClock += ms; latestAudio.currentTime += ms / 1000; latestAudio.ontimeupdate?.(); };
          try {
            bgm.setBgmEnabled(true); bgm.setBgmHidden(false); bgm.setBgmUnlocked(true);
            await Promise.resolve();
            const roomAudio = latestAudio;
            bgm.syncBgm('community'); bgm.syncBgm('garden'); bgm.syncBgm('room');
            assert.equal(latestAudio, roomAudio, 'shared scene navigation must not replace the player');
            bgm.beginMusicCompanion(); bgm.setMusicRewardEnabled(true); bgm.setBgmVolume(0.6);
            const baseline = bgm.getMeasuredListeningMs();
            progress(10_000);
            assert.equal(bgm.getMeasuredListeningMs() - baseline, 10_000);
            bgm.setBgmVolume(0); progress(10_000);
            assert.equal(bgm.getMeasuredListeningMs() - baseline, 10_000, 'muted audio cannot earn time');
            bgm.setBgmVolume(0.6); bgm.pauseMusicCompanion(); progress(10_000);
            assert.equal(bgm.getMeasuredListeningMs() - baseline, 10_000, 'paused audio cannot earn time');
            bgm.beginMusicCompanion(); await Promise.resolve();
            const beforeFailures = creations;
            for (let index = 0; index < 11; index++) latestAudio.onerror?.();
            assert.ok(bgm.getBgmPlaybackState().error, 'all failed tracks must stop with an error');
            assert.equal(creations - beforeFailures, 10, 'never recurse into unlimited retries');
            assert.equal(latestAudio.paused, true);
            bgm.beginMusicCompanion(); await Promise.resolve();
            assert.equal(bgm.getBgmPlaybackState().error, '');
            bgm.pauseMusicCompanion(); denyNextPlay = true;
            bgm.beginMusicCompanion(); await new Promise(resolve => setImmediate(resolve));
            assert.ok(bgm.getBgmPlaybackState().error);
            bgm.setBgmUnlocked(true); await Promise.resolve();
            assert.equal(bgm.getBgmPlaybackState().error, '', 'a new user gesture must recover autoplay rejection');
          } finally {
            bgm.setMusicRewardEnabled(false); bgm.setBgmEnabled(false); bgm.endMusicCompanion();
            if (descriptor) Object.defineProperty(globalThis, 'Audio', descriptor); else delete globalThis.Audio;
            if (performanceDescriptor) Object.defineProperty(globalThis, 'performance', performanceDescriptor);
          }
        });
      }
      finally { await server.close(); }
    });
    console.log(`Passed ${passed} save/error checks (in-memory storage; no browser or player saves).`);
  } finally {
    Date.now = realNow;
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

if (values.artifacts) {
  const expected = releaseArtifactNames(json('package.json').version, process.env.FULL_BUILD !== 'false').sort();
  assert.deepEqual(readdirSync(values.artifacts).sort(), expected, 'Release artifact set mismatch');
  for (const file of expected) assert.ok(statSync(join(values.artifacts, file)).size > 0, `Empty artifact: ${file}`);
  console.log(`Verified ${expected.length} release artifacts.`);
} else if (values.release) {
  await verifyRelease();
} else {
  assert.ok(!values.dist && !values.binary && !values.metadata && !values.arch, 'Release options require --release.');
  await verifySavesAndErrors();
}
