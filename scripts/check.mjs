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
    const { createSaveFileText, parseSaveFileText, loadStoredPetJson, UnsupportedSaveVersionError, ObsoleteSaveVersionError } = codec;
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

    await check('社区旧筹备兼容、回礼往返与满仓原子领取', async () => {
      const actions = await import('../src/core/communityProjectActions.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const { getPetEnergyCap } = await import('../src/core/petStats.ts');
      const legacy = structuredClone(pet);
      legacy.community.schemaVersion = 11; delete legacy.community.activityBoard;
      legacy.community.expedition.projects.riverside = { completed: 2, stage: 1, theme: 'journey', lastDay: '2026-09-01', firstAt: now - 86400000, actorId: 'old.partner', actorName: '旧伙伴' };
      legacy.inventory.dish_mushroom_rice = 2;
      let state = parseSaveFileText(createSaveFileText(legacy, null, now), now).pet;
      assert.equal(state.community.schemaVersion, 13);
      assert.equal(state.community.expedition.projects.riverside.stage, 1);
      const cap = getPetEnergyCap(state), runId = actions.getProjectRunId(state, 'riverside');
      const frozen = { ...state, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(actions.contributeCommunityProject(frozen, 'riverside', runId, 1, now), frozen);
      const prepared = actions.contributeCommunityProject(state, 'riverside', runId, 1, now);
      assert.equal(prepared.community.expedition.projects.riverside.stage, 2, 'legacy accepted menus bypass new unlock conditions');
      assert.equal(prepared.inventory.dish_mushroom_rice ?? 0, 0);
      assert.deepEqual(actions.contributeCommunityProject(prepared, 'riverside', runId, 1, now).inventory, prepared.inventory);
      state = actions.finishCommunityProject(prepared, 'riverside', runId, 'new.partner', '新伙伴', now);
      const reward = state.community.expedition.projects.riverside.reward;
      assert.ok(reward); assert.equal(reward.hearts, 200); assert.equal(reward.first, false);
      assert.equal(state.community.expedition.projects.riverside.actorName, '旧伙伴');
      assert.equal(getPetEnergyCap(state), cap);
      assert.equal(state.community.expedition.projects.riverside.completed, 3);
      assert.deepEqual(actions.finishCommunityProject(prepared, 'riverside', runId, 'new.partner', '新伙伴', now).community.expedition.projects.riverside.reward, reward, 'same saved invitation must not reroll');
      assert.equal(actions.finishCommunityProject(state, 'riverside', runId, 'new.partner', '新伙伴', now).community.expedition.projects.riverside.completed, 3);
      state = parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      assert.deepEqual(state.community.expedition.projects.riverside.reward, reward);
      const olderQuote = structuredClone(state);
      olderQuote.community.expedition.projects.riverside.reward.hearts = 175;
      olderQuote.community.expedition.projects.riverside.reward.items = { golden_apple: 2 };
      assert.deepEqual(parseSaveFileText(createSaveFileText(olderQuote, null, now), now).pet.community.expedition.projects.riverside.reward,
        olderQuote.community.expedition.projects.riverside.reward, 'pending rewards retain their stored quote instead of using current balance data');
      const [item, amount] = Object.entries(reward.items)[0];
      state.inventory[item] = inventoryItemLimit;
      const beforeHearts = state.hearts, beforeItems = { ...state.inventory };
      const blocked = actions.claimCommunityProjectReward(state, 'riverside', reward.id);
      assert.equal(blocked.hearts, beforeHearts); assert.deepEqual(blocked.inventory, beforeItems);
      state = parseSaveFileText(createSaveFileText(blocked, null, now), now).pet;
      assert.deepEqual(state.community.expedition.projects.riverside.reward, reward);
      state.inventory[item] -= amount;
      const fullHearts = { ...state, hearts: Number.MAX_SAFE_INTEGER };
      assert.ok(actions.claimCommunityProjectReward(fullHearts, 'riverside', reward.id).community.expedition.projects.riverside.reward);
      const claimed = actions.claimCommunityProjectReward(state, 'riverside', reward.id);
      assert.equal(claimed.hearts, beforeHearts + reward.hearts);
      assert.equal(claimed.inventory[item], inventoryItemLimit);
      assert.equal(claimed.community.expedition.projects.riverside.reward, undefined);
      assert.equal(actions.claimCommunityProjectReward(claimed, 'riverside', reward.id), claimed);
      assert.equal(parseSaveFileText(createSaveFileText(claimed, null, now), now).pet.community.expedition.projects.riverside.reward, undefined);
    });

    await check('社区周邀请保存稳定、过期请求与时钟恢复防重', async () => {
      const { getCommunityActivityBoard, advanceCommunityActivities } = await import('../src/core/communityActivities.ts');
      const { startCommunityProject, contributeCommunityProject, finishCommunityProject } = await import('../src/core/communityProjectActions.ts');
      const { reconcilePetClock } = await import('../src/core/gameClock.ts');
      const time = new Date(2026, 8, 21, 12).getTime();
      const initial = createDefaultPet(time);
      let state = normalizePet({ ...initial, adventure: { ...initial.adventure, completed: { tutorial: 1 } }, community: { ...initial.community, gardenBuilt: true, herbDiscovered: true, firstOrderDelivered: true }, inventory: { carrot: 3, egg: 2, dish_herb_porridge: 2 } }, time);
      state = advanceCommunityActivities(state, time);
      const board = state.community.activityBoard;
      assert.equal(board.week, '2026-09-21'); assert.equal(board.project, 'riverside');
      state = startCommunityProject(state, 'riverside', 'garden', board.invitationId, time);
      assert.equal(state.community.activityBoard.accepted, true);
      state = contributeCommunityProject(state, 'riverside', board.invitationId, 0, time);
      const saved = parseSaveFileText(createSaveFileText(state, null, time), time).pet;
      assert.deepEqual(saved.community.activityBoard, state.community.activityBoard);
      assert.deepEqual(startCommunityProject(saved, 'riverside', 'journey', board.invitationId, time).community.expedition.projects, saved.community.expedition.projects, 'repeated accept cannot reset supplies or change theme');
      state = contributeCommunityProject(saved, 'riverside', board.invitationId, 1, time);
      const first = finishCommunityProject(state, 'riverside', board.invitationId, 'official.furo', 'Furo', time);
      assert.equal(first.community.expedition.projects.riverside.reward.hearts, 400);
      assert.equal(first.community.expedition.projects.riverside.completed, 1);
      assert.equal(first.community.acceptedToday.length, 0, 'activity must not consume daily commissions');
      const unlocked = structuredClone(saved);
      unlocked.community.facilities.fishing_hut.built = true;
      unlocked.community.fishing.journal = { pond_crucian: { count: 1, firstAt: time, largest: 1 }, pond_carp: { count: 1, firstAt: time, largest: 1 } };
      assert.equal(getCommunityActivityBoard(unlocked, time).project, 'riverside', 'new unlock does not replace this week');
      const boundary = new Date(2026, 8, 28, 5).getTime();
      assert.equal(getCommunityActivityBoard(unlocked, boundary - 1).invitationId, board.invitationId);
      const next = advanceCommunityActivities(unlocked, boundary);
      assert.equal(next.community.activityBoard.project, 'exhibition');
      assert.equal(next.community.expedition.projects.riverside.stage, 1, 'unfinished preparations survive rollover');
      assert.equal(startCommunityProject(next, 'riverside', 'garden', board.invitationId, boundary).community.expedition.projects.riverside.stage, 1);
      const restored = parseSaveFileText(createSaveFileText(next, null, boundary), boundary).pet;
      assert.deepEqual(restored.community.activityBoard, next.community.activityBoard);
      const accepted = startCommunityProject(restored, 'exhibition', 'garden', restored.community.activityBoard.invitationId, boundary);
      const rollback = reconcilePetClock(accepted, time).pet;
      assert.equal(rollback.community.activityBoard.accepted, true);
      assert.equal(rollback.community.activityBoard.invitationId, accepted.community.activityBoard.invitationId);
      assert.equal(getCommunityActivityBoard(rollback, time).invitationId, accepted.community.activityBoard.invitationId);
      const frozen = { ...accepted, timePause: { schemaVersion: 1, pausedAt: boundary } };
      assert.equal(advanceCommunityActivities(frozen, boundary + 7 * 86400000), frozen);
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

    await check('跨日挂机读档与在线结算一致、回拨防重', async () => {
      const { advancePet } = await import('../src/core/petLifecycle.ts');
      const { startExpedition } = await import('../src/core/expedition.ts');
      const { advanceExplorationBudget } = await import('../src/core/explorationBudget.ts');
      const { landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { getDailyResetDateKey } = await import('../src/core/dailyReset.ts');
      const start = new Date(2026, 8, 22, 3).getTime(), hour = 3600000, end = start + 4 * hour;
      const initial = createDefaultPet(start);
      let state = normalizePet({ ...initial, coins: 10000, hunger: 100, energy: 100, health: 100, mood: 100, cleanliness: 100,
        adventure: { ...initial.adventure, completed: { tutorial: 1 }, landmarks: landmarkNodes.map(node => landmarkId('valley', node)) },
        community: { ...initial.community, expedition: { ...initial.community.expedition, regions: { ...initial.community.expedition.regions,
          valley: { surveyed: true, base: 1, harvestDay: '', harvestUsed: 0 } } } } }, start);
      state = advanceExplorationBudget(state, start);
      state.community.expedition.loop.vouchers.forEach(voucher => { voucher.paid = 100; voucher.lootUsed = 100; });
      state.community.expedition.loop.heartDays.forEach(day => { day.claimed = true; });
      state = startExpedition(state, ['valley'], {}, false, 'official.furo', 'Furo', 'idle', 4, start);
      assert.ok(state.community.expedition.active, state.recentEvent);
      const saved = createSaveFileText(state, null, start);
      const reload = (text, at) => {
        const loaded = loadStoredPetJson(text, at, quiet);
        assert.equal(loaded.status, 'ok');
        return loaded.pet;
      };
      const receipt = pet => {
        const { journal: _journal, ...result } = pet.community.expedition.pending;
        return result;
      };
      let online = state;
      for (let at = start + hour; at <= end; at += hour) online = advancePet(online, at, quiet);
      const offline = reload(saved, end);
      assert.equal(offline.community.expedition.pending.coins, 270);
      assert.equal(offline.community.expedition.pending.hearts, 0, 'only three harvest hours belong to the new day');
      assert.deepEqual(receipt(offline), receipt(online));
      assert.deepEqual(offline.community.expedition.loop, online.community.expedition.loop);
      assert.equal(offline.timeGuard.maxDailyDateKey, getDailyResetDateKey(end));
      const restored = reload(createSaveFileText(offline, null, end), end);
      assert.deepEqual(receipt(restored), receipt(offline), 'reloading the settled receipt must not pay again');
      assert.deepEqual(restored.community.expedition.loop, offline.community.expedition.loop);
      const later = reload(saved, end + 4 * 86400000);
      assert.deepEqual(receipt(later), receipt(online), 'later login must not change a finished trip reward');
      assert.ok(later.community.expedition.loop.vouchers.every(voucher => voucher.paid === 0 && voucher.lootUsed === 0), 'old harvests must not consume current-day vouchers');
      const rolledBack = advancePet(offline, start, quiet);
      assert.deepEqual(rolledBack.community.expedition.loop.vouchers, offline.community.expedition.loop.vouchers);
      assert.deepEqual(rolledBack.community.expedition.loop.heartDays, offline.community.expedition.loop.heartDays);
      const caughtUp = advancePet(rolledBack, end, quiet);
      assert.deepEqual(caughtUp.community.expedition.loop.vouchers, offline.community.expedition.loop.vouchers, 'catching up after rollback must not reissue vouchers');
      assert.deepEqual(caughtUp.community.expedition.loop.heartDays, offline.community.expedition.loop.heartDays);
    });

    await check('手动随机珍宝额度、存档恢复与采集防重', async () => {
      const { advanceExplorationBudget, spendExplorationHarvest, settleExplorationLoot } = await import('../src/core/explorationBudget.ts');
      const { regionalTreasures } = await import('../src/core/regionalTreasures.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      // Fixed identity: the first two harvests find gems; the first also finds a gold bar.
      const initial = advanceExplorationBudget(normalizePet({ ...pet, saveMetadata: { ...pet.saveMetadata, id: 'save:regional-fixture-121498' },
        adventure: { ...pet.adventure, completed: { tutorial: 1 } } }, now), now);
      const harvest = (state, region = 'valley', count = 1, kind = 'manual') => settleExplorationLoot(spendExplorationHarvest(state, count, now), count, kind, region, now);
      const original = JSON.stringify(initial);
      for (const [item, { region }] of Object.entries(regionalTreasures)) {
        const result = harvest(initial, region);
        assert.deepEqual(result.finds, { ancient_gold_bar: 1, [item]: 1 }, 'regional and existing common rolls are independent');
        const restored = harvest(reload(initial), region);
        assert.deepEqual(restored.finds, result.finds, 'saving before consumption cannot reroll');
        assert.deepEqual(restored.pet.community.expedition.loop, result.pet.community.expedition.loop);
        const repeated = settleExplorationLoot(reload(result.pet), 1, 'manual', region, now);
        assert.deepEqual(repeated.finds, {}, 'saving after consumption cannot replay the harvest');
        assert.deepEqual(repeated.pet.community.expedition.loop, result.pet.community.expedition.loop);
        assert.deepEqual(result.pet.community.treasureResearch, initial.community.treasureResearch);
        assert.deepEqual(result.pet.community.expedition.treasurePity, initial.community.expedition.treasurePity);
      }
      assert.equal(JSON.stringify(initial), original, 'settlement must not mutate the input snapshot');
      const twice = harvest(initial, 'valley', 2);
      assert.deepEqual(twice.finds, { ancient_gold_bar: 1, creek_aquamarine: 2 });
      assert.equal(twice.pet.community.expedition.loop.vouchers[0].lootUsed, 100, 'two valley harvests consume one voucher, with no gem surcharge');
      const first = harvest(initial), second = harvest(reload(first.pet));
      assert.equal(first.finds.creek_aquamarine + second.finds.creek_aquamarine, 2);
      assert.deepEqual(second.pet.community.expedition.loop, twice.pet.community.expedition.loop, 'batched and separately saved harvests agree');
      const partial = structuredClone(initial);
      partial.community.expedition.loop.vouchers = [{ ...partial.community.expedition.loop.vouchers[0], lootUsed: 99 }];
      const last = harvest(reload(partial), 'valley', 2);
      assert.deepEqual(last.finds, { creek_aquamarine: 1 }, 'partial quota keeps 5%; the next harvest has no quota');
      assert.deepEqual(harvest(reload(last.pet)).finds, {}, 'exhausted quota blocks both kinds of treasure');
      assert.deepEqual(harvest(initial, 'valley', 1, 'hour').finds, { ancient_gold_bar: 1 }, 'hourly gathering keeps its existing common loot only');
      assert.deepEqual(harvest({ ...initial, timePause: { schemaVersion: 1, pausedAt: now } }).finds, {});
      assert.deepEqual(settleExplorationLoot(initial, 0, 'manual', 'valley', now).finds, {});
      const nearMiss = structuredClone(initial);
      nearMiss.saveMetadata.id = 'save:regional-fixture-12'; // First regional roll is just above 5%.
      nearMiss.community.decorations = ['star_dome', 'emerald_pendant'];
      nearMiss.community.decorationLevels = { star_dome: 10, emerald_pendant: 10 };
      nearMiss.community.expedition.treasurePity.valley = 9;
      const missed = harvest(reload(nearMiss));
      assert.equal(missed.finds.creek_aquamarine ?? 0, 0, 'manual drops receive neither decoration bonuses nor idle pity');
      assert.equal(missed.pet.community.expedition.treasurePity.valley, 9);
    });

    await check('手动珍宝行囊溢出、旧在途兼容与领取恢复', async () => {
      const { startAdventure, advanceAdventure, getAdventureChoicePreview, pickupAdventureLoot, discardAdventureItem, returnFromAdventure, claimAdventureResult } = await import('../src/core/adventure.ts');
      const { getAdventureSteps } = await import('../src/core/adventureData.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const { getExplorationBagCapacity } = await import('../src/core/explorationBackpack.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      const initial = startAdventure(fuel({ ...pet, saveMetadata: { ...pet.saveMetadata, id: 'save:regional-fixture-121498' },
        inventory: { ...pet.inventory, prospector_pick: 1 }, adventure: { ...pet.adventure, completed: { tutorial: 1 } } }), 'valley', 'official.furo', 'Furo', {}, false, now);
      const act = (state, choice) => advanceAdventure(state, state.adventure.active.id, state.adventure.active.choices.length, choice, now, state.adventure.active.revision);
      const steps = getLandmarkSteps('landmark:valley:entrance');
      let ready = initial;
      for (const step of steps.slice(0, 2)) ready = act(fuel(ready), step.choices[0].id);
      assert.equal(ready.community.expedition.loop.used, 0, 'observation does not consume or roll');
      ready.adventure.active.bag = { trail_mix: getExplorationBagCapacity(ready) };
      const choice = steps[2].choices.find(option => option.id === 'tool:creek_aquamarine');
      const snapshot = JSON.stringify(ready);
      getAdventureChoicePreview(ready, choice, now);
      assert.equal(JSON.stringify(ready), snapshot, 'preview does not settle rewards');
      const blocked = structuredClone(ready);
      blocked.community.expedition.loop.available = 0;
      assert.deepEqual(act(blocked, choice.id).adventure, blocked.adventure, 'failed consumption cannot produce loot');
      let state = act(reload(ready), choice.id);
      assert.deepEqual(state.adventure.active, act(ready, choice.id).adventure.active);
      assert.equal(state.adventure.active.loot.creek_aquamarine, 2);
      assert.equal(state.adventure.active.loot.ancient_gold_bar, 1);
      assert.equal(state.community.treasureResearch.creek_aquamarine, 2, 'only the tool advances research');
      assert.equal(state.community.expedition.collection.creek_aquamarine, 2);
      const trip = ready.adventure.active;
      assert.deepEqual(advanceAdventure(state, trip.id, trip.choices.length, choice.id, now, trip.revision), state);
      state = reload(state);
      assert.equal(state.adventure.active.loot.creek_aquamarine, 2, 'full bag overflow survives reload');
      const loot = { ...state.adventure.active.loot }, space = Object.values(loot).reduce((sum, amount) => sum + amount, 0);
      state = discardAdventureItem(state, trip.id, state.adventure.active.revision, 'trail_mix', space);
      for (const [item, amount] of Object.entries(loot)) state = pickupAdventureLoot(state, trip.id, state.adventure.active.revision, item, amount);
      state = returnFromAdventure(state, trip.id, now);
      assert.equal(state.adventure.pending.items.creek_aquamarine, 2, 'return keeps harvested gems without another roll');
      assert.equal(state.community.expedition.loop.used, 2);
      state.inventory.creek_aquamarine = inventoryItemLimit;
      state = claimAdventureResult(reload(state), trip.id);
      assert.deepEqual(state.adventure.pending.items, { creek_aquamarine: 2 });
      state = reload(state);
      assert.deepEqual(claimAdventureResult(state, trip.id).inventory, state.inventory);
      state.inventory.creek_aquamarine -= 2;
      state = claimAdventureResult(state, trip.id);
      assert.equal(state.inventory.creek_aquamarine, inventoryItemLimit);
      assert.equal(state.adventure.pending, undefined);
      assert.equal(claimAdventureResult(state, trip.id), state);
      const old = structuredClone(initial);
      old.adventure.active.rulesVersion = 8; old.adventure.active.purpose = undefined;
      let legacy = reload(old);
      for (const step of getAdventureSteps(8, 'valley').slice(0, 2)) legacy = act(fuel(legacy), step.choices[0].id);
      assert.equal(legacy.adventure.active.bag.creek_aquamarine, 1, 'unconsumed harvests on old trips use the new drop rule');
      assert.equal(legacy.community.expedition.collection.creek_aquamarine, 1);
      assert.equal(reload(legacy).adventure.active.bag.creek_aquamarine, 1);
    });

    await check('随机采集存档固定、原行动记录与重复请求防重', async () => {
      const { startAdventure, advanceAdventure, getAdventureChoicePreview } = await import('../src/core/adventure.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getAdventureStageChoices } = await import('../src/core/adventureGathering.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      const act = (state, id) => advanceAdventure(state, state.adventure.active.id, state.adventure.active.choices.length, id, now, state.adventure.active.revision);
      const steps = getLandmarkSteps('landmark:valley:entrance');
      let ready = startAdventure(fuel({ ...pet, inventory: { ...pet.inventory, harvest_sickle: 1, prospector_pick: 1, survey_lens: 1 },
        adventure: { ...pet.adventure, completed: { tutorial: 1 } } }), 'valley', 'official.furo', 'Furo', {}, false, now);
      for (const step of steps.slice(0, 2)) ready = act(ready, step.choices[0].id);
      const snapshot = JSON.stringify(ready), commands = getAdventureStageChoices(ready, steps[2].choices);
      for (const choice of commands) getAdventureChoicePreview(ready, choice, now);
      assert.equal(JSON.stringify(ready), snapshot, 'method and cost previews must not settle or consume');
      const restored = reload(ready);
      assert.deepEqual(getAdventureStageChoices(restored, steps[2].choices), commands, 'reload cannot redraw the reward entry');
      const trip = restored.adventure.active;
      for (const id of ['gather:random', 'gather:sickle', 'gather:pick']) {
        const command = commands.find(choice => choice.id === id);
        assert.ok(command?.sourceChoiceId);
        const result = act(restored, id), reference = act(ready, command.sourceChoiceId);
        assert.equal(result.adventure.active.choices.at(-1), command.sourceChoiceId, 'save the authored action ID for old record validation');
        assert.deepEqual(result.adventure.active.checkState.last, reference.adventure.active.checkState.last, 'method resolution keeps original rewards and checks');
        const saved = reload(result);
        assert.equal(saved.adventure.active.choices.length, 3, 'normalization must not truncate the gathered stage');
        assert.deepEqual(saved.adventure.active.bag, result.adventure.active.bag);
        assert.deepEqual(saved.adventure.active.loot, result.adventure.active.loot);
        assert.deepEqual(saved.community.forageResearch, result.community.forageResearch);
        assert.deepEqual(saved.community.treasureResearch, result.community.treasureResearch);
        assert.deepEqual(saved.community.toolWear, result.community.toolWear);
        assert.equal(saved.inventory.survey_lens, 1, 'gathering does not use a lens');
        assert.equal(advanceAdventure(saved, trip.id, 2, id, now, trip.revision), saved, 'replayed command after restore must not settle twice');
      }
      const exhausted = structuredClone(restored);
      exhausted.community.expedition.loop.available = 0;
      const rejected = act(exhausted, 'gather:pick');
      assert.deepEqual(rejected.adventure.active, exhausted.adventure.active);
      assert.deepEqual(rejected.community.toolWear, exhausted.community.toolWear);
      const missingTool = structuredClone(restored); delete missingTool.inventory.harvest_sickle;
      assert.deepEqual(act(missingTool, 'gather:sickle').adventure.active, missingTool.adventure.active, 'commit must recheck warehouse stock');
      const left = act(exhausted, 'gather:leave');
      assert.equal(left.adventure.active.choices.length, 3);
      assert.equal(left.adventure.active.choices.at(-1), 'safe:gather');
      assert.equal(left.community.expedition.loop.used, exhausted.community.expedition.loop.used);
      assert.deepEqual(left.community.toolWear, exhausted.community.toolWear);
      assert.equal(left.hunger, exhausted.hunger - steps[2].choices[0].hunger);
      assert.equal(reload(left).adventure.active.choices.length, 3);
    });

    await check('仓库绳索与旧携带绳索的耐久、返还和读档防重', async () => {
      const { startAdventure, advanceAdventure, returnFromAdventure, claimAdventureResult } = await import('../src/core/adventure.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      const act = (state, id) => advanceAdventure(state, state.adventure.active.id, state.adventure.active.choices.length, id, now, state.adventure.active.revision);
      let ready = startAdventure(fuel({ ...pet, inventory: { ...pet.inventory, trail_rope: 2 }, adventure: { ...pet.adventure, completed: { tutorial: 1 } } }), 'valley', 'official.furo', 'Furo', {}, true, now);
      assert.equal(ready.inventory.trail_rope, 2, 'new trips never reserve a warehouse rope');
      assert.equal(ready.adventure.active.tool, false);
      for (const step of getLandmarkSteps('landmark:valley:entrance').slice(0, 3)) ready = act(fuel(ready), step.choices[0].id);
      const breaking = structuredClone(ready); breaking.community.toolWear.trail_rope = 15;
      const used = act(reload(breaking), 'rope:obstacle');
      assert.equal(used.inventory.trail_rope, 1);
      assert.equal(used.adventure.active.tool, false);
      assert.equal(used.community.toolWear.trail_rope ?? 0, 0);
      const returned = returnFromAdventure(reload(used), used.adventure.active.id, now);
      assert.equal(returned.adventure.pending.items.trail_rope ?? 0, 0, 'warehouse ropes must not be issued again on return');
      for (const wear of [4, 15]) {
        const legacy = structuredClone(ready);
        legacy.inventory.trail_rope = 1; legacy.adventure.active.tool = true; legacy.community.toolWear.trail_rope = wear;
        const oldUsed = act(reload(legacy), 'rope:obstacle');
        assert.equal(oldUsed.inventory.trail_rope, 1, 'consume legacy packed rope before a warehouse spare');
        assert.equal(oldUsed.adventure.active.tool, wear < 15);
        assert.equal(oldUsed.community.toolWear.trail_rope ?? 0, wear < 15 ? wear + 1 : 0);
        const receipt = returnFromAdventure(reload(oldUsed), oldUsed.adventure.active.id, now), id = receipt.adventure.pending.id;
        assert.equal(receipt.adventure.pending.items.trail_rope ?? 0, wear < 15 ? 1 : 0);
        const collected = claimAdventureResult(reload(receipt), id);
        assert.equal(collected.inventory.trail_rope, wear < 15 ? 2 : 1);
        assert.equal(claimAdventureResult(reload(collected), id).inventory.trail_rope, collected.inventory.trail_rope);
      }
    });

    await check('中点营具休整状态恢复与错过节点保护', async () => {
      const { startAdventure, advanceAdventure } = await import('../src/core/adventure.ts');
      const { getAdventureSteps } = await import('../src/core/adventureData.ts');
      const { getExplorationCampQuote, restExplorationWithKit, rescueExploration } = await import('../src/core/explorationSupport.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      const full = normalizePet({ ...pet, hearts: 1000, inventory: { ...pet.inventory, camp_kit: 1 }, adventure: { ...pet.adventure, completed: { tutorial: 1 }, landmarks: mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node))) } }, now);
      for (const region of ['tutorial', ...mapRegions]) {
        const source = region === 'tutorial' ? { ...full, adventure: { ...full.adventure, completed: {} } } : full;
        const purpose = region === 'tutorial' ? undefined : landmarkId(region, 'entrance');
        let state = startAdventure(fuel(source), region, 'official.furo', 'Furo', {}, false, now, purpose);
        assert.ok(state.adventure.active, state.recentEvent);
        const steps = getAdventureSteps(state.adventure.active.rulesVersion, region, purpose), middle = steps.length / 2;
        for (const step of steps.slice(0, middle)) {
          const t = state.adventure.active;
          assert.ok(getExplorationCampQuote(state, 'adventure').reason);
          assert.deepEqual(restExplorationWithKit(state, 'adventure', t.id, t.revision, now).community.toolWear, state.community.toolWear);
          state = advanceAdventure(fuel(state), t.id, t.choices.length, step.choices[0].id, now, t.revision);
        }
        const restored = reload(state), t = restored.adventure.active, quote = getExplorationCampQuote(restored, 'adventure');
        assert.equal(quote.checkpoint, middle); assert.equal(quote.reason, '');
        const rested = reload(restExplorationWithKit(restored, 'adventure', t.id, t.revision, now));
        assert.equal(rested.adventure.active.rested, true);
        assert.equal(rested.community.toolWear.camp_kit, 1);
        const again = restExplorationWithKit(rested, 'adventure', t.id, rested.adventure.active.revision, now);
        assert.equal(again.energy, rested.energy); assert.equal(again.community.toolWear.camp_kit, 1);
        const skipped = advanceAdventure(fuel(restored), t.id, t.choices.length, steps[middle].choices[0].id, now, t.revision);
        const missed = reload(skipped), live = missed.adventure.active;
        assert.equal(getExplorationCampQuote(missed, 'adventure').atCheckpoint, false);
        assert.deepEqual(restExplorationWithKit(missed, 'adventure', live.id, live.revision, now).community.toolWear, missed.community.toolWear);
        const rescued = rescueExploration(missed, 'adventure', live.id, live.revision, now);
        assert.equal(rescued.hearts, missed.hearts - 100, 'neighbor rescue is independent of the missed camp');
        assert.equal(rescued.adventure.active.rested, false);
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

    await check('1.9 起 JSON v2 与既有迁移补偿保持兼容', async () => {
      const { persistentPetKeys } = await import('../src/core/persistedPet.ts');
      const { encoding: _encoding, ...envelope } = JSON.parse(text);
      const expanded = { ...envelope, minimumReaderVersion: '1.9.0', pet: Object.fromEntries(persistentPetKeys.map(key => [key, pet[key]])) };
      for (const original of [JSON.stringify(expanded), text]) {
        reset();
        const preview = parseSaveFileText(original, now);
        assert.equal(storage.length, 0, 'preview must not write');
        assert.equal(preview.formatVersion, 2);
        assert.equal(preview.requiresMigration, false);
        for (const key of ['inventory', 'coins', 'garden', 'kitchen', 'saveMetadata']) assert.deepEqual(preview.pet[key], pet[key], key);
        const reopened = parseSaveFileText(createSaveFileText(preview.pet, preview.activeMod, now), now).pet;
        assert.deepEqual(reopened.inventory, preview.pet.inventory);
        assert.deepEqual(reopened.saveMetadata, preview.pet.saveMetadata);
      }
      // A save already upgraded to JSON v2 can still carry an unpaid entitlement.
      const migrated = { ...pet, saveMetadata: { ...pet.saveMetadata, origin: 'legacy', compensation: 'pending' } };
      const original = createSaveFileText(migrated, null, now);
      const converted = reset(original).pet;
      assert.equal(converted.saveMetadata.compensation, 'claimed');
      assert.ok(converted.inventory.emergency_biscuit > pet.inventory.emergency_biscuit);
      assert.deepEqual(disk.loadPet(now, quiet).pet.inventory, converted.inventory, 'reload cannot repeat compensation');
      const repeated = disk.replacePetFromImport(parseSaveFileText(original, now).pet, '', null, original, now);
      assert.equal(repeated.inventory.emergency_biscuit, pet.inventory.emergency_biscuit);
      assert.equal(repeated.saveMetadata.id, converted.saveMetadata.id);
      reset(text);
      assert.equal(disk.loadPet(now, quiet).pet.saveMetadata.compensation, 'ineligible');
    });

    await check('1.9 之前格式明确拒绝且不覆盖原始存档', () => {
      const fixture = json(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url));
      const originals = [JSON.stringify(pet), JSON.stringify({ schemaVersion: 1, app: 'PocPet', exportedAt: new Date(now).toISOString(), pet }),
        fixture.text, readFileSync(new URL('./fixtures/pocpet-mint-1.0.1-export.pocpet', import.meta.url), 'utf8'),
        JSON.stringify({ ...JSON.parse(text), minimumReaderVersion: '1.8.99' })];
      for (const original of originals) {
        assert.throws(() => parseSaveFileText(original, now), ObsoleteSaveVersionError);
        const rejected = reset(original);
        assert.equal(rejected.status, 'corrupt');
        assert.equal(rejected.stage, 'obsolete');
        assert.equal(storage.getItem(primary), original);
        assert.equal(disk.getPreservedCorruptPetRaw(), original);
        assert.throws(() => disk.savePet(pet), ObsoleteSaveVersionError);
        assert.throws(() => disk.replacePetFromImport(pet, original, null, original, now), ObsoleteSaveVersionError);
        assert.equal(storage.getItem(primary), original, 'rejected saves must retain their original bytes');
        assert.equal(disk.replacePetFromImport(pet, original, null, text, now).coins, pet.coins, 'explicitly importing a supported save must still work');
        assert.equal(disk.getImportBackup(), original);
      }
    });

    await check('旧货架改价保留库存和金币、重复恢复不重复迁移', async () => {
      const { getMarketQuote } = await import('../src/core/communityMarket.ts');
      const envelope = JSON.parse(text), community = envelope.pet.community;
      community.schemaVersion = 12;
      community.facilities.stall = { found: true, work: 4, built: true };
      Object.assign(community.market, { level: 1, open: false, nextListingId: 2,
        listings: [{ id: 1, slotIndex: 0, itemId: 'apple', quantity: 10, basePrice: 4, unitPrice: 4, bonus: 20, collector: false }] });
      delete community.market.pricingVersion;
      const migrated = parseSaveFileText(JSON.stringify(envelope), now).pet;
      assert.equal(migrated.coins, pet.coins);
      assert.deepEqual(migrated.inventory, pet.inventory);
      assert.equal(migrated.community.market.listings[0].quantity, 10);
      assert.equal(migrated.community.market.listings[0].unitPrice, getMarketQuote(migrated, 'apple').price);
      assert.deepEqual(parseSaveFileText(createSaveFileText(migrated, null, now), now).pet.community.market, migrated.community.market);
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
      const obsolete = json(new URL('./fixtures/pocpet-1.8.0-backup.json', import.meta.url));
      storage.setItem(`${primary}.pre-upgrade.1.8.0`, obsolete.text);
      let recent = [text, obsolete.text]; let fail = false; let error = '';
      const unsubscribe = native.subscribeNativeSave(value => { error = value; });
      window.__TAURI_INTERNALS__ = { invoke: async (command, payload) => {
        if (command === 'read_recent_saves') return { files: recent, warnings: [] };
        if (command === 'read_backup_files') return { files: [JSON.stringify(obsolete)], warnings: [] };
        if (command === 'read_backup_latest') return null;
        assert.equal(command, 'write_recent_save');
        if (fail) throw new Error('Injected native failure');
        recent = [payload.text, ...recent].slice(0, 2);
      } };
      try {
        const recovered = await recovery.collectRecoveryCandidates();
        assert.ok(recovered.candidates.some(candidate => candidate.text === text));
        assert.ok(recovered.candidates.every(candidate => candidate.text !== obsolete.text));
        assert.equal(recovered.unsupported, false, 'obsolete backups must not be treated as newer saves');
        assert.equal(recovered.unavailable, false, 'obsolete backups must not block supported recovery points');
        assert.equal(storage.getItem(`${primary}.pre-upgrade.1.8.0`), obsolete.text);
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
