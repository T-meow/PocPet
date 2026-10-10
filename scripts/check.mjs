import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { releaseArtifactNames } from './release-policy.mjs';

// npm test is the only daily check. Release modes also work before npm ci in CI.
const { values } = parseArgs({ options: {
  release: { type: 'boolean' }, artifacts: { type: 'string' },
  dist: { type: 'string' }, edition: { type: 'string', default: 'standard' },
  binary: { type: 'string' }, arch: { type: 'string' },
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
    const pet = normalizePet({ ...base, coins: 5000, inventory: { ...base.inventory, apple: 3, emergency_biscuit: 3, 'fixture.mod:snack': 7 },
      favorites: { itemIds: ['apple', 'fixture.mod:snack'], recipeIds: ['fruit_pancake'] } }, now);
    const text = createSaveFileText(pet, null, now);
    const reset = raw => {
      native.cancelPendingNativeSave();
      storage.values.clear(); storage.failRead = ''; storage.failWrite = '';
      if (raw !== undefined) storage.setItem(primary, raw);
      const result = disk.loadPet(now, quiet);
      disk.takeStorageFeedback();
      return result;
    };

    await check('独立小游戏预览的进度往返与损坏回退', async () => {
      const { createMiniGamesSave, normalizeMiniGamesSave, createPreviewHost, previewStorageKey } = await import('../src/minigames/storage.ts');
      const { possibleMoves, swapMatch3 } = await import('../src/minigames/match3/rules.ts');
      const progress = createMiniGamesSave();
      progress.activeGame = 'fruit'; progress.sound = true;
      progress.games.blocks.pieces[0].rotation = 1;
      progress.games.blocks.selected = 0;
      progress.games.water.bottles[3].push(progress.games.water.bottles[0].pop());
      progress.games.water.moves = 1;
      progress.games.fruit.bodies = [{ id: 1, tier: 2, x: 90.125, y: 280.875, vx: 0.25, vy: -0.125, angle: 0.5, angularVelocity: 0.01, landed: true }];
      progress.games.fruit.nextId = 2; progress.games.fruit.dangerMs = 125.75;
      const move = possibleMoves(progress.games.match3.grid)[0];
      progress.games.match3 = swapMatch3(progress.games.match3, move.from, move.to).state;
      progress.reportedSessions = [progress.games.blocks.id];
      const preview = new MemoryStorage(), host = createPreviewHost(preview);
      preview.setItem(primary, text);
      host.save(progress);
      assert.deepEqual(normalizeMiniGamesSave(host.load()), progress);
      assert.equal(preview.getItem(primary), text, 'preview cannot change the formal pet save');
      assert.deepEqual([...preview.values.keys()].sort(), [primary, previewStorageKey].sort());
      const damaged = structuredClone(progress);
      damaged.games.fruit.bodies[0].x = 'broken';
      damaged.games.blocks.history = [null, { grid: [] }];
      const restored = normalizeMiniGamesSave(damaged);
      assert.equal(restored.games.fruit.bodies.length, 0);
      assert.deepEqual(restored.games.water, progress.games.water);
      assert.deepEqual(restored.games.match3, progress.games.match3);
      const brokenMatch3 = normalizeMiniGamesSave({ ...progress, games: { ...progress.games, match3: { ...progress.games.match3, grid: [9, -1] } } });
      assert.equal(brokenMatch3.games.match3.grid.length, 49);
      assert.equal(brokenMatch3.games.match3.best, progress.games.match3.best);
      assert.deepEqual(brokenMatch3.games.fruit, progress.games.fruit);
      assert.equal(restored.games.blocks.pieces[0].rotation, 1);
      assert.deepEqual(restored.games.blocks.history, []);
      for (const bad of [null, 'broken JSON', [], false, { schemaVersion: 999 }, { games: { blocks: {}, water: 1, fruit: [], match3: 'broken' } }]) {
        const fallback = normalizeMiniGamesSave(bad);
        assert.equal(fallback.games.blocks.grid.length, 64);
        assert.equal(fallback.games.match3.grid.length, 49);
        assert.deepEqual(normalizeMiniGamesSave(JSON.stringify(fallback)), fallback);
      }
      preview.failRead = previewStorageKey;
      assert.throws(() => host.load(), /Injected read failure/);
      preview.failWrite = previewStorageKey;
      assert.throws(() => host.save(progress), /Injected write failure/);
      assert.deepEqual(normalizeMiniGamesSave(host.load()), progress, 'failed writes leave the last good preview intact');
    });

    await check('正式小游戏入口的进度往返、旧档兼容与结算去重', async () => {
      const games = await import('../src/core/miniGames.ts');
      const { saveMiniGameHub, finishMiniGameHub, endMiniGameHub } = await import('../src/core/miniGameHub.ts');
      const { possibleMoves, swapMatch3 } = await import('../src/minigames/match3/rules.ts');
      const { advancePet } = await import('../src/core/petLifecycle.ts');
      const actor = 'official.furo';
      const ready = normalizePet({ ...pet, level: 10 }, now);
      assert.equal(ready.miniGames.hub, undefined, 'old saves do not create random progress until a new game is opened');
      for (const id of ['blocks', 'water', 'fruit', 'match3']) assert.ok(ready.miniGames.unlocked.includes(id));
      let current = games.startMiniGame(ready, 'blocks', 'gentle', actor, 'hub-blocks', now);
      assert.equal(current.miniGames.active.game, 'blocks');
      assert.equal(current.miniGames.active.mode, 'normal');
      assert.equal(current.miniGames.active.deck, undefined, 'hosted games keep their own state types');
      const progress = structuredClone(current.miniGames.hub);
      progress.sound = true;
      progress.games.blocks.pieces[0].rotation = 1;
      progress.games.blocks.selected = 0;
      progress.reportedSessions = ['untrusted-receipt'];
      current = saveMiniGameHub(current, 'hub-blocks', actor, progress, now);
      assert.deepEqual(current.miniGames.hub.reportedSessions, []);
      assert.equal(saveMiniGameHub(current, 'stale-view', actor, progress, now), current);
      assert.equal(saveMiniGameHub(current, 'hub-blocks', 'other-actor', progress, now), current);
      current = games.startMiniGame(games.pauseMiniGame(current), 'match3', 'gentle', actor, 'hub-match3', now);
      assert.equal(current.miniGames.hub.games.blocks.pieces[0].rotation, 1);
      assert.equal(saveMiniGameHub(current, 'hub-blocks', actor, progress, now), current, 'old unmount callbacks cannot overwrite a different game');
      let board = current.miniGames.hub.games.match3;
      const premature = { game: 'match3', sessionId: board.id, outcome: 'complete', score: 999999 };
      assert.equal(finishMiniGameHub(current, 'hub-match3', actor, premature, now), current, 'callbacks alone cannot award hearts');
      while (board.movesLeft > 0) {
        const move = possibleMoves(board.grid)[0];
        board = swapMatch3(board, move.from, move.to).state;
      }
      const snapshot = structuredClone(current.miniGames.hub);
      snapshot.games.match3 = board;
      current = saveMiniGameHub(current, 'hub-match3', actor, snapshot, now);
      assert.equal(advancePet(current, now).miniGames.active.paused, false, 'normal lifecycle updates keep a running game');
      const restored = parseSaveFileText(createSaveFileText(current, null, now), now).pet;
      assert.deepEqual(restored.miniGames.hub, current.miniGames.hub);
      assert.equal(restored.miniGames.active.paused, true, 'save reloads pause every game');
      assert.equal(games.resumeMiniGame(restored, 'other-actor', now), restored);
      assert.equal(finishMiniGameHub(restored, 'hub-match3', actor, premature, now), restored, 'paused games cannot settle');
      current = games.resumeMiniGame(restored, actor, now);
      const hearts = current.hearts;
      assert.equal(finishMiniGameHub(current, 'stale-view', actor, premature, now), current);
      const sleeping = { ...current, isSleeping: true };
      assert.equal(finishMiniGameHub(sleeping, 'hub-match3', actor, premature, now), sleeping);
      current = finishMiniGameHub(current, 'hub-match3', actor, premature, now);
      assert.ok(current.hearts > hearts);
      assert.equal(current.miniGames.lastResult.score, board.score, 'scores come from saved rules state, not the callback');
      assert.equal(current.miniGames.lastResult.baseHearts, Math.floor(games.getMiniGameBaseHearts(10, 'match3') * board.score / 1000));
      assert.equal(current.miniGames.records['match3:normal'].completed, 1);
      assert.equal(current.miniGames.lastResult.pending, false, 'the module keeps its own replay screen');
      assert.equal(current.miniGames.active.id, 'hub-match3');
      assert.equal(finishMiniGameHub(current, 'hub-match3', actor, premature, now), current);
      const savedAgain = parseSaveFileText(createSaveFileText(current, null, now), now).pet;
      const resumed = games.resumeMiniGame(savedAgain, actor, now);
      assert.equal(finishMiniGameHub(resumed, 'hub-match3', actor, premature, now), resumed, 'receipts survive exported saves');
      const manyRounds = structuredClone(savedAgain);
      manyRounds.miniGames.lastSettledSessionId = 'a-later-round';
      manyRounds.miniGames.hub.reportedSessions.push(...Array.from({ length: 100 }, (_, index) => `another-game-round-${index}`));
      const afterManyRounds = games.resumeMiniGame(normalizePet(manyRounds, now), actor, now);
      assert.equal(afterManyRounds.miniGames.hub.reportedSessions.length, 64);
      assert.ok(afterManyRounds.miniGames.hub.reportedSessions.includes(board.id));
      assert.equal(finishMiniGameHub(afterManyRounds, 'hub-match3', actor, premature, now), afterManyRounds, 'completed boards stay settled after playing many rounds of other games');
      const damaged = structuredClone(current);
      damaged.miniGames.hub.games.fruit.bodies = 'broken';
      const recovered = normalizePet(damaged, now);
      assert.equal(recovered.miniGames.hub.games.fruit.bodies.length, 0);
      assert.deepEqual(recovered.miniGames.hub.games.match3, board);
      assert.deepEqual(recovered.miniGames.hub.reportedSessions, [board.id]);

      const scoring = games.startMiniGame(ready, 'blocks', 'normal', actor, 'early-blocks', now);
      const latest = structuredClone(scoring.miniGames.hub);
      latest.games.blocks.score = 1250;
      latest.games.blocks.best = 1250;
      const earlyRound = latest.games.blocks.id;
      const paused = games.pauseMiniGame(scoring);
      assert.equal(endMiniGameHub(paused, 'early-blocks', actor, latest, now), paused);
      assert.equal(endMiniGameHub(scoring, 'stale-view', actor, latest, now), scoring);
      assert.equal(endMiniGameHub(scoring, 'early-blocks', 'other-actor', latest, now), scoring);
      const busy = { ...scoring, isSleeping: true };
      assert.equal(endMiniGameHub(busy, 'early-blocks', actor, latest, now), busy);
      const ended = endMiniGameHub(scoring, 'early-blocks', actor, latest, now);
      assert.equal(ended.miniGames.lastResult.score, 1250, 'early settlement uses the latest snapshot before the debounced save');
      assert.equal(ended.miniGames.lastResult.baseHearts, 8, 'Lv.10 gives floor(7 * 1250 / 1000) base hearts');
      assert.equal(ended.miniGames.lastResult.pending, true);
      assert.equal(ended.miniGames.active, undefined);
      assert.notEqual(ended.miniGames.hub.games.blocks.id, earlyRound);
      assert.equal(ended.miniGames.hub.games.blocks.score, 0);
      assert.equal(ended.miniGames.hub.games.blocks.best, 1250);
      assert.deepEqual(ended.miniGames.hub.games.fruit, scoring.miniGames.hub.games.fruit);
      assert.ok(ended.miniGames.hub.reportedSessions.includes(earlyRound));
      assert.equal(endMiniGameHub(ended, 'early-blocks', actor, latest, now), ended, 'double clicks cannot settle twice');
      assert.equal(saveMiniGameHub(ended, 'early-blocks', actor, latest, now), ended, 'unmount cannot restore a settled board');
      const earlyRestored = parseSaveFileText(createSaveFileText(ended, null, now), now).pet;
      assert.equal(earlyRestored.miniGames.lastResult.pending, true);
      assert.deepEqual(earlyRestored.miniGames.hub, ended.miniGames.hub);
      const replay = games.startMiniGame(games.acknowledgeMiniGameResult(earlyRestored, earlyRound), 'blocks', 'normal', actor, 'next-blocks', now);
      assert.equal(replay.miniGames.hub.games.blocks.score, 0);
      assert.equal(endMiniGameHub(replay, 'next-blocks', actor, latest, now), replay, 'old round snapshots cannot claim a new round');
      const tiny = structuredClone(replay.miniGames.hub);
      tiny.games.blocks.score = 1;
      const noReward = endMiniGameHub(replay, 'next-blocks', actor, tiny, now);
      assert.equal(noReward.miniGames.lastResult.baseHearts, 0);
      assert.equal(noReward.miniGames.lastResult.hearts, 0);
      assert.equal(noReward.hearts, replay.hearts, 'rounds below one base heart do not trigger bonus hearts');
      assert.equal(noReward.mood, replay.mood);
      assert.deepEqual(noReward.partnerSchedule.skills, replay.partnerSchedule.skills);

      let legacy = games.startMiniGame(ready, 'matching', 'gentle', actor, 'legacy-cards', now);
      const deck = legacy.miniGames.active.deck;
      for (let face = 0; face < 6; face++) for (const index of deck.map((card, index) => card === face ? index : -1).filter(index => index >= 0)) {
        legacy = games.actMiniGame(legacy, 'legacy-cards', { type: 'flip', index }, now);
      }
      assert.equal(legacy.miniGames.lastResult.pending, true);
      assert.equal(legacy.miniGames.records['matching:gentle'].completed, 1);
      assert.equal(legacy.miniGames.active, undefined);
      assert.equal(legacy.miniGames.hub, undefined, 'legacy games retain their existing storage shape');
    });

    await check('收藏偏好的旧档兼容、规范化与持久化', async () => {
      const { toggleItemFavorite, toggleRecipeFavorite } = await import('../src/core/favorites.ts');
      const legacy = JSON.parse(text);
      delete legacy.pet.favorites;
      assert.deepEqual(parseSaveFileText(JSON.stringify(legacy), now).pet.favorites, { itemIds: [], recipeIds: [] });
      for (const invalid of [undefined, null, false, [], 'broken', { itemIds: {}, recipeIds: 7 }]) {
        assert.deepEqual(normalizePet({ ...pet, favorites: invalid }, now).favorites, { itemIds: [], recipeIds: [] });
      }
      const normalized = normalizePet({ ...pet, favorites: {
        itemIds: [' apple ', 'apple', 'fixture.mod:snack', 'berry_bait', '', 2, null],
        recipeIds: ['fruit_pancake', 'fruit_pancake', 'missing_recipe', '', false],
      } }, now);
      assert.deepEqual(normalized.favorites, { itemIds: ['apple', 'fixture.mod:snack', 'berry_bait'], recipeIds: ['fruit_pancake'] });
      assert.ok(normalizePet({ ...pet, favorites: { itemIds: Array.from({ length: 5000 }, (_, i) => `fixture.mod:item_${i}`) } }, now).favorites.itemIds.length < 5000);
      const toggled = toggleRecipeFavorite(toggleItemFavorite(normalized, 'dish_fruit_pancake'), 'milk_cookies');
      assert.deepEqual({ ...toggled, favorites: normalized.favorites }, normalized, 'favorites must not spend resources or advance gameplay');
      const restored = parseSaveFileText(createSaveFileText(toggled, null, now), now).pet;
      assert.deepEqual(restored.favorites, toggled.favorites);
      const empty = normalizePet({ ...restored, inventory: {} }, now);
      const loaded = loadStoredPetJson(createSaveFileText(empty, null, now), now, quiet);
      assert.equal(loaded.status, 'ok');
      assert.deepEqual(loaded.pet.favorites, toggled.favorites, 'out-of-stock, hidden and unavailable Mod items retain favorites');
      const cancelled = toggleRecipeFavorite(toggleItemFavorite(loaded.pet, 'apple'), 'fruit_pancake');
      assert.ok(!cancelled.favorites.itemIds.includes('apple'));
      assert.ok(cancelled.favorites.itemIds.includes('dish_fruit_pancake'), 'dish and recipe favorites are independent');
      assert.ok(!cancelled.favorites.recipeIds.includes('fruit_pancake'));
      reset(text);
      disk.savePet(cancelled);
      assert.deepEqual(disk.loadPet(now, quiet).pet.favorites, cancelled.favorites, 'cancelling favorites survives a local reload');
    });

    await check('JSON v2、压缩日期和进度往返', async () => {
      const before = JSON.stringify(pet);
      const envelope = JSON.parse(text);
      assert.equal(envelope.schemaVersion, 2);
      assert.ok(!('recentEvent' in envelope.pet));
      const loaded = parseSaveFileText(text, now).pet;
      for (const key of ['inventory', 'community', 'garden', 'saveMetadata', 'favorites']) assert.deepEqual(loaded[key], pet[key], key);
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
      const { createBuiltinItemRegistry, getInventoryDefinitions, getShopDefinitions, getShopItem } = await import('../src/core/items.ts');
      const retired = normalizePet({ ...pet, inventory: { ...pet.inventory, berry_bait: 7 } }, now);
      const restored = parseSaveFileText(createSaveFileText(retired, null, now), now).pet;
      assert.equal(restored.inventory.berry_bait, 7, 'hidden legacy items survive import/export');
      const registry = createBuiltinItemRegistry();
      assert.ok(registry.has('berry_bait'), 'retain the known item definition for old saves');
      assert.ok(!getInventoryDefinitions(registry, restored.inventory).some(item => item.id === 'berry_bait'), 'hidden items do not reappear as unknown inventory entries');
      assert.ok(!getShopDefinitions(registry).some(item => item.id === 'berry_bait'));
      assert.equal(getShopItem('berry_bait'), undefined);
      assert.equal(parseSaveFileText(createSaveFileText(restored, null, now), now).pet.inventory.berry_bait, 7);
    });

    await check('农牧旧档迁移、命名与堆肥待领恢复防重', async () => {
      const { advanceCommunityAnimals, collectCommunityAnimal, collectRanchCompost, getRanchCompost, renameCommunityAnimal } = await import('../src/core/communityFarm.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const restore = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const legacy = structuredClone(pet);
      legacy.community.schemaVersion = 13;
      delete legacy.community.ranchCompostCycles;
      legacy.community.gardenBuilt = true;
      legacy.community.upgrades.garden = 2;
      legacy.community.plots = [{ id: 1, crop: { id: 'carrot', plantedAt: now - 4 * 3600000, readyAt: now } }, { id: 2 }];
      for (const id of ['coop', 'barn']) legacy.community.facilities[id] = { found: true, built: true, work: 2 };
      legacy.community.animals.coop.stock = 2;
      const migrated = restore(legacy);
      assert.equal(migrated.community.schemaVersion, 16);
      assert.equal(migrated.community.ranchCompostCycles, 0, 'legacy stock does not retroactively earn compost');
      assert.equal(migrated.community.animals.coop.name, undefined);
      assert.equal(migrated.community.plots[0].lastCrop, 'carrot');
      assert.equal(migrated.community.plots[1].lastCrop, undefined);
      const named = renameCommunityAnimal(renameCommunityAnimal(migrated, 'coop', `  咕咕\n${'🐥'.repeat(20)}  `), 'barn', '花花');
      assert.equal(named.community.animals.coop.name, `咕咕${'🐥'.repeat(14)}`, 'names strip control characters and keep at most 16 Unicode characters');
      assert.equal(renameCommunityAnimal(named, 'barn', ' \n ').community.animals.barn.name, undefined);
      let state = restore({ ...named, inventory: { ...named.inventory, nutrient_compost: inventoryItemLimit }, community: { ...named.community,
        plots: [named.community.plots[0], { id: 2, lastCrop: 'wheat' }], ranchCompostCycles: 7,
        animals: { coop: { ...named.community.animals.coop, feed: 1, nextAt: now }, barn: { ...named.community.animals.barn, feed: 1, nextAt: now } },
      } });
      const frozen = { ...state, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(advanceCommunityAnimals(frozen, now + 86400000), frozen);
      assert.equal(collectRanchCompost(frozen), frozen);
      state = restore(advanceCommunityAnimals(state, now));
      assert.equal(state.community.ranchCompostCycles, 9, 'both facilities add only their newly completed cycles');
      assert.deepEqual(getRanchCompost(state), { ready: 2, progress: 1 });
      assert.equal(state.community.animals.coop.name, named.community.animals.coop.name);
      assert.equal(state.community.animals.barn.name, '花花');
      assert.equal(state.community.plots[1].lastCrop, 'wheat');
      assert.equal(advanceCommunityAnimals(state, now + 86400000), state, 'restored production cannot count the same cycles twice');
      const revision = state.community.animals.coop.revision, beforeEggs = state.inventory.egg ?? 0;
      state = restore(collectCommunityAnimal(state, 'coop', revision, now));
      assert.equal(state.inventory.egg, beforeEggs + 4, 'full compost inventory does not block eggs');
      assert.equal(state.community.ranchCompostCycles, 9);
      assert.equal(collectCommunityAnimal(state, 'coop', revision, now), state, 'restored stale harvests cannot pay twice');
      assert.equal(collectRanchCompost(state), state);
      state = restore(collectRanchCompost({ ...state, inventory: { ...state.inventory, nutrient_compost: inventoryItemLimit - 1 } }));
      assert.equal(state.inventory.nutrient_compost, inventoryItemLimit);
      assert.deepEqual(getRanchCompost(state), { ready: 1, progress: 1 }, 'overflow compost and partial progress survive a save');
      assert.equal(collectRanchCompost(state), state);
      state = restore(collectCommunityAnimal({ ...state, inventory: { ...state.inventory, nutrient_compost: inventoryItemLimit - 1 } }, 'barn', state.community.animals.barn.revision, now));
      assert.equal(state.inventory.farm_milk, (named.inventory.farm_milk ?? 0) + 2);
      assert.equal(state.inventory.nutrient_compost, inventoryItemLimit);
      assert.deepEqual(getRanchCompost(state), { ready: 0, progress: 1 }, 'a successful animal harvest also claims available compost');
      assert.equal(collectRanchCompost(state), state);
      const damaged = normalizePet({ ...state, community: { ...state.community, ranchCompostCycles: NaN,
        plots: [{ id: 1, lastCrop: 'missing_crop' }], animals: { ...state.community.animals, coop: { ...state.community.animals.coop, name: [] } },
      } }, now);
      assert.equal(damaged.community.ranchCompostCycles, 0);
      assert.equal(damaged.community.plots[0].lastCrop, undefined);
      assert.equal(damaged.community.animals.coop.name, undefined);
    });

    await check('批量播种收获与饲料加工的满仓、暂停和陈旧请求恢复', async () => {
      const { plantCommunityCrops, harvestCommunityCrops } = await import('../src/core/community.ts');
      const { processFood } = await import('../src/core/foodProcessing.ts');
      const { getCommunitySale } = await import('../src/core/communityEconomy.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const restore = (state, at = now) => parseSaveFileText(createSaveFileText(state, null, at), at).pet;
      const initial = restore({ ...pet, inventory: { ...pet.inventory, carrot_seed: 1, wheat_seed: 1, carrot: inventoryItemLimit },
        community: { ...pet.community, gardenBuilt: true, upgrades: { ...pet.community.upgrades, garden: 3 },
          plots: [{ id: 1, lastCrop: 'carrot' }, { id: 2, lastCrop: 'carrot' }, { id: 3, lastCrop: 'wheat' }],
          facilities: { ...pet.community.facilities, coop: { found: true, built: true, work: 2 } },
        },
      });
      const seeds = [{ plotId: 1, cropId: 'carrot' }, { plotId: 1, cropId: 'carrot' }, { plotId: 2, cropId: 'carrot' }, { plotId: 3, cropId: 'wheat' }];
      let state = restore(plantCommunityCrops(initial, seeds, now));
      assert.equal(state.inventory.carrot_seed ?? 0, 0);
      assert.equal(state.inventory.wheat_seed ?? 0, 0);
      assert.equal(state.community.plots[1].crop, undefined, 'insufficient seeds leave the remaining plot empty');
      assert.equal(state.community.plots[1].lastCrop, 'carrot');
      assert.equal(plantCommunityCrops(state, seeds, now), state, 'duplicate requests do not consume more seeds');
      const ripeAt = now + 8 * 3600000;
      const crops = [{ id: 1, plantedAt: now - 1 }, { id: 1, plantedAt: now }, { id: 3, plantedAt: now }, { id: 3, plantedAt: now }];
      const frozen = { ...state, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(plantCommunityCrops(frozen, seeds, now), frozen);
      assert.equal(harvestCommunityCrops(frozen, crops, ripeAt), frozen);
      state = restore(harvestCommunityCrops(state, crops, ripeAt), ripeAt);
      assert.ok(state.community.plots[0].crop, 'a full product stack leaves its entire crop waiting');
      assert.equal(state.inventory.carrot, inventoryItemLimit);
      assert.equal(state.inventory.wheat, (initial.inventory.wheat ?? 0) + 4);
      assert.equal(state.hearts - initial.hearts, 8, 'only the successfully harvested plot earns hearts');
      assert.equal(state.community.plots[2].lastCrop, 'wheat');
      state = restore(harvestCommunityCrops({ ...state, inventory: { ...state.inventory, carrot: inventoryItemLimit - 3 } }, crops, ripeAt), ripeAt);
      assert.equal(state.inventory.carrot, inventoryItemLimit);
      assert.equal(state.hearts - initial.hearts, 12);
      assert.equal(harvestCommunityCrops(state, crops, ripeAt), state, 'completed batches cannot replay after restore');
      const replanted = plantCommunityCrops({ ...state, inventory: { ...state.inventory, carrot_seed: 1 } }, [{ plotId: 1, cropId: 'carrot' }], ripeAt);
      assert.equal(harvestCommunityCrops(replanted, crops, ripeAt + 4 * 3600000), replanted, 'an old crop timestamp cannot harvest a new planting');
      const materials = restore({ ...state, inventory: { ...state.inventory, wheat: 2, sweet_corn: 1, animal_feed: 0 } }, ripeAt);
      const revision = materials.community.processing.revision;
      state = restore(processFood(materials, 'wheat_feed', 2, revision, ripeAt), ripeAt);
      assert.equal(state.inventory.wheat ?? 0, 0);
      assert.equal(state.inventory.animal_feed, 8);
      assert.equal(state.coins, materials.coins);
      assert.equal(getCommunitySale('animal_feed'), undefined, 'feed remains a supply item after adding processing recipes');
      assert.equal(processFood(state, 'corn_feed', 1, revision, ripeAt), state, 'stale cross-recipe requests cannot spend another ingredient');
      state = restore({ ...state, inventory: { ...state.inventory, animal_feed: inventoryItemLimit - 3 } }, ripeAt);
      assert.equal(processFood(state, 'corn_feed', 1, state.community.processing.revision, ripeAt), state, 'a whole batch must fit before spending ingredients');
      const paused = { ...materials, timePause: { schemaVersion: 1, pausedAt: ripeAt } };
      assert.equal(processFood(paused, 'wheat_feed', 1, revision, ripeAt), paused);
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
      assert.equal(state.community.schemaVersion, 16);
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

    await check('钓鱼水域旧档补开、配置记忆与在途存档往返', async () => {
      const { landmarkId, landmarkNodes } = await import('../src/core/landmarkProgress.ts');
      const { isWaterOpen, waterIds } = await import('../src/core/communityData.ts');
      const { completeLandmarkStory } = await import('../src/core/landmarkAdventure.ts');
      const { getFishingPreferences, rememberFishingPreferences } = await import('../src/core/fishingState.ts');
      const state = structuredClone(pet);
      state.community.facilities.fishing_hut = { found: true, work: 2, built: true };
      state.community.waterAccess.forest_pool.found = true;
      assert.deepEqual(waterIds.filter(id => isWaterOpen(normalizePet(state, now), id)), ['pond'], 'a clue alone does not count as a completed region');
      state.adventure.landmarks = landmarkNodes.filter(node => node !== 'camp').map(node => landmarkId('forest', node));
      assert.equal(isWaterOpen(normalizePet(state, now), 'forest_pool'), false);
      const completed = completeLandmarkStory(state, { purpose: 'landmark:forest:camp', rulesVersion: 11, actorId: 'official.furo', actorName: 'Furo' }, now).pet;
      assert.equal(isWaterOpen(completed, 'forest_pool'), true, 'new completions open the water immediately');
      const upstream = completeLandmarkStory(state, { purpose: 'landmark:valley:lookout', rulesVersion: 11, actorId: 'official.furo', actorName: 'Furo' }, now).pet;
      assert.equal(isWaterOpen(upstream, 'upstream'), true);

      state.adventure.landmarks = [landmarkId('valley', 'lookout'), ...['forest', 'coast'].flatMap(region => landmarkNodes.map(node => landmarkId(region, node)))];
      state.community.fishing.active = { mode: 'idle', id: 'idle-fish:restore', revision: 0, water: 'forest_pool', bait: 'river_bait', strongRod: true,
        actorId: 'official.furo', actorName: 'Furo', hutLevel: 1, startedAt: now, endsAt: now + 7200000, plannedCasts: 8, settledCasts: 0,
        reservedBait: 8, catches: [], rationPlan: { food: { apple: 2 }, coins: 0, purchased: 0 } };
      const restored = normalizePet(state, now);
      assert.deepEqual(waterIds.filter(id => isWaterOpen(restored, id)), waterIds, 'completed landmarks repair missing unlock flags');
      assert.deepEqual(restored.community.fishing.active, state.community.fishing.active, 'repair access before validating an in-progress trip');
      assert.equal(state.community.waterAccess.forest_pool.built, false, 'normalization does not mutate its input');
      assert.equal(restored.coins, state.coins);
      assert.deepEqual(restored.inventory, state.inventory, 'unlock repair does not spend or grant materials');
      assert.equal(getFishingPreferences(restored).strongRod, true, 'older saves can initialize from the current trip');
      const preferences = { water: 'coast_pier', bait: 'river_bait', strongRod: true, float: true, net: true, mode: 'idle', hours: 4, rations: { food: { apple: 2 }, autoFill: false } };
      const configured = rememberFishingPreferences(restored, preferences);
      const reload = value => parseSaveFileText(createSaveFileText(value, null, now), now).pet;
      const roundTrip = reload(configured);
      assert.deepEqual(roundTrip.community.fishing, configured.community.fishing);
      assert.deepEqual(reload(roundTrip).community.fishing, roundTrip.community.fishing, 'repeated save/load preserves the configuration and trip');
      assert.deepEqual(getFishingPreferences(reload({ ...configured, inventory: {} })), preferences, 'depleted supplies do not clear remembered choices');
      assert.deepEqual(rememberFishingPreferences(restored, preferences).inventory, restored.inventory, 'remembering a setup does not reserve supplies');

      const legacy = structuredClone(state);
      legacy.adventure.schemaVersion = 7; delete legacy.adventure.landmarks;
      for (const region of ['hills', 'forest', 'coast']) legacy.community.expedition.regions[region].surveyed = true;
      assert.deepEqual(waterIds.filter(id => isWaterOpen(normalizePet(legacy, now), id)), waterIds, 'old regional completion records also unlock waters');
      const previousBuild = structuredClone(pet);
      previousBuild.community.facilities.fishing_hut.built = true;
      previousBuild.community.waterAccess.coast_pier.built = true;
      assert.equal(isWaterOpen(normalizePet(previousBuild, now), 'coast_pier'), true, 'preserve previously built access without completion records');
      const malformed = normalizePet({ ...configured, community: { ...configured.community, fishing: { ...configured.community.fishing,
        preferences: { water: 'invalid', bait: 'invalid', strongRod: 'true', float: 1, net: null, hours: 99, mode: 'invalid', rations: { food: { apple: -2, community_wood: 3 }, autoFill: true } },
      } } }, now);
      assert.deepEqual(getFishingPreferences(malformed), { water: 'pond', bait: 'fishing_bait', strongRod: false, float: false, net: false, mode: 'manual', hours: 2, rations: { food: {}, autoFill: true } });
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
      assert.deepEqual(receipt.items, { hill_honey: 2, forest_berry: 1, sea_glass: 3 });
      assert.deepEqual(receipt.overflow, {});
      assert.equal(receipt.reason, 'complete');
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
      const { allDishes } = await import('../src/core/kitchenRecipes.ts');
      started.inventory = { ...started.inventory, ...Object.fromEntries(allDishes.map(dish => [dish.id, 2])) };
      started.kitchen.made = Object.fromEntries(allDishes.map(dish => [dish.recipe.id, 1]));
      const saved = parseSaveFileText(createSaveFileText(started, null, now), now).pet;
      assert.deepEqual(saved.adventure.active.bag, started.adventure.active.bag, 'every region product and treasure survives the bag codec');
      assert.deepEqual(saved.inventory, started.inventory, 'all dishes, including emoji placeholders, survive inventory round trips');
      assert.deepEqual(saved.kitchen.made, started.kitchen.made, 'new recipe progress survives round trips');
      assert.deepEqual(saved.adventure.landmarks, all.adventure.landmarks);
      assert.equal(saved.adventure.active.rulesVersion, 12, 'new trips retain the current rules after saving');
      const oldManual = structuredClone(started);
      oldManual.adventure.active.rulesVersion = 11;
      const oldManualTrip = parseSaveFileText(createSaveFileText(oldManual, null, now), now).pet.adventure.active;
      assert.equal(oldManualTrip.rulesVersion, 11, 'already departed trips keep their rules');
      const oldAction = getAdventureSteps(oldManualTrip.rulesVersion, oldManualTrip.region, oldManualTrip.purpose)[0].choices[0];
      assert.deepEqual([oldAction.hunger, oldAction.energy], [18, 10], 'loading an old observatory trip must not raise its supply cost');
      const newAction = getAdventureSteps(saved.adventure.active.rulesVersion, saved.adventure.active.region, saved.adventure.active.purpose)[0].choices[0];
      assert.deepEqual([newAction.hunger, newAction.energy], [50, 50]);
    });

    await check('固定料理、烤鱼与小吃套餐存档往返、上架和无效制作恢复', async () => {
      const { craftRecipe, recordDishTaste, normalizeKitchenState } = await import('../src/core/kitchen.ts');
      const { getDish, getRecipe, getDishId } = await import('../src/core/kitchenRecipes.ts');
      const { getCommunitySale } = await import('../src/core/communityEconomy.ts');
      const { listCommunityGoods, getMarketQuote } = await import('../src/core/communityMarket.ts');
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      let state = createDefaultPet(now);
      state.kitchen.equipment = ['mix', 'pan', 'blender'];
      state.community.facilities.fishing_hut.built = true;
      state.community.facilities.upstream.built = true;
      state.community.waterAccess.coast_pier.built = true;
      state.community.herbDiscovered = true;
      state.adventure.landmarks = mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node)));
      state.inventory = { carrot: 3, apple: 3, orange: 3, stream_trout: 3, creek_herb: 3, wild_onion: 3, bluefin_bream: 3, golden_koi: 1, hill_honey: 3, farm_milk: 3 };
      const variants = [['carrot_apple_orange_juice', undefined], ['herb_trout_soup', undefined], ['grilled_fish', 'bluefin_bream'], ['honey_milk', undefined]];
      const outputs = [];
      for (const [index, [recipeId, variantKey]] of variants.entries()) {
        const recipe = getRecipe(recipeId, variantKey);
        const dishId = getDishId(recipe);
        state = craftRecipe(state, recipeId, false, 2, `variant-${index}`, now, undefined, variantKey);
        assert.equal(state.inventory[dishId], 2, 'the selected ingredients must produce their own item');
        for (const input of recipe.ingredients) assert.equal(state.inventory[input], 1, 'only the selected ingredients are consumed');
        state = recordDishTaste(state, dishId, 'official.furo', now);
        outputs.push(dishId);
      }
      state.inventory = { ...state.inventory, flour: 5, egg: 3, carrot: 3, tomato: 5, potato: 5, cooking_oil: 5, wheat_fish: 3 };
      const snackSteps = [['flatbread', 2], ['carrot_omelet', 2], ['egg_wrap', 2], ['tomato_ketchup', 4], ['french_fries', 4], ['ketchup_fries', 4], ['wrap_fries_set', 2], ['crispy_wheat_fish', 2], ['fish_fries_set', 2]];
      for (const [recipeId, quantity] of snackSteps) {
        state = craftRecipe(state, recipeId, false, quantity, `snack-${recipeId}`, now);
        assert.equal(state.inventory[getDishId(getRecipe(recipeId))], quantity, 'multi-step snacks consume prepared dishes and produce the requested batch');
      }
      for (const id of ['flour', 'egg', 'carrot', 'tomato', 'potato', 'cooking_oil', 'wheat_fish']) assert.equal(state.inventory[id], 1, 'snack chains deduct only the required ingredients');
      for (const id of ['dish_flatbread', 'dish_carrot_omelet', 'dish_egg_wrap', 'dish_tomato_ketchup', 'dish_french_fries', 'dish_ketchup_fries', 'dish_crispy_wheat_fish', 'dish_carrot_apple_orange_juice']) assert.equal(state.inventory[id] ?? 0, 0, 'assembled meals must consume their prepared components');
      state.community.facilities.stall.built = true;
      state.community.market.level = 1;
      const meals = [['wrap_fries_set', 182, 218], ['fish_fries_set', 209, 250]];
      for (const [recipeId, base, price] of meals) {
        const dishId = getDishId(getRecipe(recipeId));
        assert.equal(getCommunitySale(dishId).base, base, 'fixed assembly profit must not compound the component prices');
        assert.equal(getMarketQuote(state, dishId).price, price);
        state = recordDishTaste(state, dishId, 'official.furo', now);
        state = listCommunityGoods(state, dishId, 1, state.community.market.nextListingId, now);
        assert.equal(state.inventory[dishId], 1, 'listing removes only the offered serving');
        assert.equal(state.community.market.listings.find(listing => listing.itemId === dishId)?.unitPrice, price);
        outputs.push(dishId);
      }
      state.favorites = { itemIds: outputs, recipeIds: [...variants.map(([id]) => id), ...meals.map(([id]) => id)] };
      const restored = parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      for (const key of ['inventory', 'favorites', 'companionMemories']) assert.deepEqual(restored[key], state[key], `${key} retains selected recipe variants`);
      for (const key of ['made', 'firstMadeAt', 'tasted', 'recentOperationIds']) assert.deepEqual(restored.kitchen[key], state.kitchen[key], `kitchen ${key} retains selected recipe variants`);
      assert.deepEqual(restored.community.market.listings, state.community.market.listings, 'prepared meals retain quantities and fixed shelf prices across reloads');
      assert.equal(restored.kitchen.lastCraft, undefined, 'compact saves still omit the temporary result panel');
      restored.inventory.dish_egg_wrap = 1; restored.inventory.dish_ketchup_fries = 1;
      assert.equal(craftRecipe(restored, 'wrap_fries_set', false, 1, 'snack-wrap_fries_set', now), restored, 'saved assembly operations cannot repeat even after restocking');
      assert.equal(craftRecipe(restored, 'wrap_fries_set', false, 2, 'short-snacks', now), restored, 'insufficient prepared components must not be partially consumed');
      const roundingState = structuredClone(restored);
      roundingState.partnerSchedule.skills.cooking.level = 3;
      const rounded = craftRecipe(roundingState, 'wrap_fries_set', false, 1, 'rounded-snacks', now);
      assert.equal(rounded.kitchen.lastCraft.skillHearts, -1, 'rounded component rewards are reconciled at final assembly');
      assert.equal(rounded.kitchen.lastCraft.hearts, 0, 'rounding never subtracts earned hearts');
      assert.deepEqual(normalizeKitchenState(rounded.kitchen).lastCraft, rounded.kitchen.lastCraft, 'valid rounding adjustments survive kitchen recovery');
      const grilledId = outputs[2];
      assert.equal(getDish(grilledId).recipe.variantKey, 'bluefin_bream');
      assert.ok(getCommunitySale(grilledId).base > getCommunitySale('dish_grilled_fish__wheat_fish').base);
      assert.equal(craftRecipe(restored, 'grilled_fish', false, 1, 'variant-2', now, undefined, 'bluefin_bream'), restored, 'restoring a result must not repeat its reward');
      assert.equal(craftRecipe(restored, 'grilled_fish', false, 1, 'collector', now, undefined, 'golden_koi'), restored, 'collection fish cannot be substituted');
      assert.equal(craftRecipe(restored, 'carrot_apple_orange_juice', false, 2, 'short-stock', now), restored, 'an outdated quantity must not partially consume ingredients');
      assert.equal(craftRecipe(restored, 'egg_rice', false, 1, 'wrong-recipe', now, undefined, 'bluefin_bream'), restored, 'a variant belongs only to its recipe');
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
        assert.equal(t.checkIntervalMs, 30 * 60000);
        const early = finishExpedition(settleExpeditionTime(state, now + t.checkIntervalMs - 1), 'return', now + t.checkIntervalMs - 1);
        assert.equal(early.community.expedition.treasurePity[region], 8);
        assert.equal(early.community.expedition.loop.used, 0);
        assert.equal(early.community.expedition.pending.hearts, 0);
        const missed = finishExpedition(settleExpeditionTime(state, now + t.checkIntervalMs), 'return', now + t.checkIntervalMs);
        assert.equal(missed.community.expedition.treasurePity[region], 9);
        assert.equal(missed.community.expedition.pending.items[treasure] ?? 0, 0);
        assert.deepEqual(settleExpeditionTime(missed, t.endsAt), missed);
        let restored = parseSaveFileText(createSaveFileText(missed, null, now), now).pet;
        assert.equal(restored.community.expedition.treasurePity[region], 9);
        restored = claimExpedition(restored, restored.community.expedition.pending.id);
        restored = startExpedition(restored, [region], {}, false, 'official.furo', 'Furo', 'idle', 2, now);
        assert.ok(restored.community.expedition.active, restored.recentEvent);
        restored.community.expedition.active.rationPlan.discoveries[0].roll = 99;
        const guaranteed = finishExpedition(settleExpeditionTime(restored, now + t.checkIntervalMs), 'return', now + t.checkIntervalMs);
        assert.equal(guaranteed.community.expedition.treasurePity[region], 0);
        assert.equal(guaranteed.community.expedition.pending.items[treasure], 1);
        assert.equal(guaranteed.community.expedition.pending.treasureFinds[0].guaranteed, true);
        const pending = parseSaveFileText(createSaveFileText(guaranteed, null, now), now).pet;
        const id = pending.community.expedition.pending.id, claimed = claimExpedition(pending, id);
        assert.equal(claimExpedition(claimed, id), claimed);
        assert.equal(claimed.inventory[treasure], 1);
        const old = structuredClone(restored);
        old.community.expedition.active.rulesVersion = 4;
        old.community.expedition.active.reservedHarvests = 2;
        delete old.community.expedition.active.checkIntervalMs;
        old.community.expedition.active.rationPlan.version = 2;
        old.community.expedition.active.rationPlan.discoveries.length = 1;
        assert.equal(settleExpeditionTime(old, old.community.expedition.active.endsAt).community.expedition.treasurePity[region], 9, 'old trips retain their old rules');
        const lucky = structuredClone(state); lucky.community.expedition.active.rationPlan.discoveries[0].roll = 0;
        assert.equal(settleExpeditionTime(lucky, now + t.checkIntervalMs).community.expedition.treasurePity[region], 0);
      }
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const boosted = structuredClone(full);
      boosted.partnerSchedule.skills.exercise.level = 10;
      boosted.community.decorations = ['star_dome'];
      boosted.community.decorationLevels = { star_dome: 10 };
      const { advanceExplorationBudget } = await import('../src/core/explorationBudget.ts');
      let trip = advanceExplorationBudget(boosted, now);
      trip.community.expedition.loop.available = 72;
      trip = startExpedition(trip, ['valley'], {}, false, 'official.furo', 'Furo', 'idle', 8, now);
      assert.equal(trip.community.expedition.active.checkIntervalMs, 1180800);
      assert.equal(trip.community.expedition.active.reservedHarvests, 24);
      trip.community.expedition.active.rationPlan.discoveries.forEach(d => { d.roll = 0; });
      const savedTrip = reload(trip);
      for (const key of ['rulesVersion', 'target', 'gatherSeed', 'checkIntervalMs', 'parts', 'settledParts', 'reservedHarvests', 'rationPlan']) {
        assert.deepEqual(savedTrip.community.expedition.active[key], trip.community.expedition.active[key], `${key} survives reload`);
      }
      savedTrip.partnerSchedule.skills.exercise.level = 1;
      savedTrip.community.decorations = [];
      const midway = settleExpeditionTime(savedTrip, now + 1180800 * 6);
      const resumed = reload(midway);
      assert.equal(resumed.community.expedition.active.settledParts, 6);
      assert.equal(resumed.community.expedition.active.treasureFinds.length, 6, 'finds beyond the old four-record limit survive reload');
      assert.deepEqual(settleExpeditionTime(resumed, now + 1180800 * 6), resumed, 'restored checks cannot pay twice');
      const finished = settleExpeditionTime(resumed, now + 8 * 3600000);
      assert.deepEqual(finished.community.expedition.pending.items, settleExpeditionTime(savedTrip, now + 8 * 3600000).community.expedition.pending.items, 'random drops agree after partial settlement, save and offline catch-up');
      assert.equal(finished.community.expedition.pending.treasureFinds.length, 24);
      assert.equal(finished.community.expedition.pending.hearts, 120);
      assert.deepEqual(reload(finished).community.expedition.pending, finished.community.expedition.pending);
      const previous = structuredClone(trip);
      previous.community.expedition.active.rulesVersion = 6;
      delete previous.community.expedition.active.checkIntervalMs;
      previous.community.expedition.active.reservedHarvests = 8;
      previous.community.expedition.active.rationPlan.discoveries.length = 4;
      const retained = reload(previous);
      assert.equal(settleExpeditionTime(retained, now + 30 * 60000).community.expedition.active.settledParts, 0, 'existing v6 trips retain hourly harvests');
      assert.equal(settleExpeditionTime(retained, now + 3600000).community.expedition.active.settledParts, 1);
      const legacyFixed = structuredClone(trip);
      legacyFixed.community.expedition.active.rulesVersion = 7;
      legacyFixed.community.expedition.active.target = 'valley_mushroom';
      assert.equal(settleExpeditionTime(reload(legacyFixed), now + 1180800).community.expedition.active.bag.valley_mushroom, 3, 'existing v7 trips retain their promised fixed material drops');
      const focused = startExpedition(advanceExplorationBudget(full, now), ['forest'], {}, false, 'official.furo', 'Furo', 'idle', 2, now, { target: 'pine_resin' });
      const focusedReload = reload(focused);
      assert.equal(focusedReload.community.expedition.active.target, 'pine_resin', 'weighted preference survives reload');
      assert.deepEqual(settleExpeditionTime(focusedReload, now + 7200000).community.expedition.pending.items, settleExpeditionTime(focused, now + 7200000).community.expedition.pending.items, 'a focused trip cannot reroll material drops on restore');
      const expectedFinds = settleExpeditionTime(focused, now + 7200000).community.expedition.pending.items;
      const importedLater = parseSaveFileText(createSaveFileText(focused, null, now), now + 60000).pet;
      assert.equal(importedLater.community.expedition.active.gatherSeed, focused.community.expedition.active.gatherSeed);
      assert.deepEqual(settleExpeditionTime(importedLater, importedLater.community.expedition.active.endsAt).community.expedition.pending.items, expectedFinds, 'rebasing an imported trip cannot redraw its material drops');
      const paused = clock.prepareTimePause(focused, now, quiet);
      const resumedLater = clock.resumePetTime(paused, now + 60000);
      assert.deepEqual(settleExpeditionTime(resumedLater, resumedLater.community.expedition.active.endsAt).community.expedition.pending.items, expectedFinds, 'pause and resume cannot redraw material drops');
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
      assert.equal(offline.community.expedition.pending.coins, 256);
      assert.equal(offline.community.expedition.pending.hearts, 40, 'each paid harvest earns hearts across daily boundaries');
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

    await check('采集恢复迁移、未入账补偿与旧挂机成功结算防重', async () => {
      const { advanceExplorationBudget } = await import('../src/core/explorationBudget.ts');
      const { startExpedition, claimExpedition } = await import('../src/core/expedition.ts');
      const { advancePet } = await import('../src/core/petLifecycle.ts');
      const { landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { getDailyResetDateKey } = await import('../src/core/dailyReset.ts');
      const hour = 3600000, day = getDailyResetDateKey(now);
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const initial = normalizePet({ ...pet, coins: 10000, hunger: 100, health: 100, energy: 100,
        adventure: { ...pet.adventure, completed: { tutorial: 1 }, landmarks: landmarkNodes.map(node => landmarkId('valley', node)) },
        community: { ...pet.community, expedition: { ...pet.community.expedition, regions: { ...pet.community.expedition.regions, valley: { surveyed: true, base: 1, harvestDay: '', harvestUsed: 0 } } } } }, now);
      const legacy = structuredClone(initial);
      legacy.community.expedition.loop = { refillAt: now - 4.5 * hour, available: 10, used: 5, day,
        vouchers: [{ day, slot: 0, face: 150, paid: 40, region: 'hills', quote: 187, rewardsVersion: 1, lootUsed: 50, lootRegion: 'forest', lootQuote: 225 }],
        heartDays: [{ day, hours: 2, claimed: false }], observations: [], milestones: [], idleCompleted: 0, firstTreasure: true };
      const migrated = advanceExplorationBudget(legacy, now);
      const compensation = Math.floor(187 * .6 * .75 + 225 * .5 * .25);
      assert.equal(migrated.community.expedition.loop.available, 11, 'existing charges never double');
      assert.equal(migrated.community.expedition.loop.refillAt, now - .5 * hour);
      assert.equal(migrated.coins, legacy.coins + compensation);
      assert.equal(migrated.hearts, legacy.hearts + 22);
      assert.deepEqual(advanceExplorationBudget(reload(migrated), now), reload(migrated), 'restoring cannot repeat compensation');
      assert.equal(advanceExplorationBudget(migrated, now + .5 * hour).community.expedition.loop.available, 12);
      assert.equal(advanceExplorationBudget(migrated, now + 100 * hour).community.expedition.loop.available, 72);
      const full = advanceExplorationBudget({ ...legacy, coins: Number.MAX_SAFE_INTEGER, hearts: Number.MAX_SAFE_INTEGER }, now);
      assert.deepEqual(full.community.expedition.loop.compensation, { coins: compensation, hearts: 22 });
      const paid = advanceExplorationBudget({ ...reload(full), coins: 0, hearts: 0 }, now);
      assert.equal(paid.coins, compensation); assert.equal(paid.hearts, 22);
      assert.deepEqual(advanceExplorationBudget(reload(paid), now).community.expedition.loop.compensation, { coins: 0, hearts: 0 });
      let oldTrip = startExpedition(initial, ['valley'], {}, false, 'official.furo', 'Furo', 'idle', 4, now);
      oldTrip.community.expedition.active.rulesVersion = 5;
      oldTrip.community.expedition.active.reservedHarvests = 4;
      delete oldTrip.community.expedition.active.checkIntervalMs;
      oldTrip.community.expedition.active.rationPlan.discoveries.length = 2;
      delete oldTrip.community.expedition.loop.version;
      delete oldTrip.community.expedition.loop.paySettledThrough;
      const frozen = { ...oldTrip, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.ok(advancePet(frozen, now + hour, quiet).community.expedition.active, 'frozen saves defer migration');
      const finished = advancePet(reload({ ...oldTrip, health: 1 }), now, quiet);
      assert.equal(finished.community.expedition.active, undefined);
      assert.equal(finished.community.expedition.pending.reason, 'complete', 'legacy trip succeeds regardless of health or elapsed time');
      assert.equal(finished.community.expedition.pending.items.valley_mushroom, 8);
      assert.equal(finished.community.expedition.loop.used, 4);
      const repeated = advancePet(reload(finished), now, quiet);
      assert.deepEqual(repeated.community.expedition.pending, finished.community.expedition.pending);
      assert.deepEqual(repeated.community.expedition.treasurePity, finished.community.expedition.treasurePity);
      const claimed = claimExpedition(repeated, repeated.community.expedition.pending.id);
      assert.equal(advanceExplorationBudget(claimed, now).community.expedition.loop.version, 2);
    });

    await check('工作心心离线结算、提前返回与重复领奖防重', async () => {
      const { startPartnerSchedule, cancelPartnerSchedule, getPartnerScheduleDefinition, getPartnerScheduleClaimPreview, claimPartnerScheduleResult } = await import('../src/core/partnerSchedule.ts');
      const { applyPetAction, getQuickWorkPreview } = await import('../src/core/petActions.ts');
      const initial = createDefaultPet(now);
      const offer = initial.partnerSchedule.offers.find(offer => getPartnerScheduleDefinition(offer.templateId).size === 'standard');
      const started = startPartnerSchedule(initial, offer.id, now);
      assert.ok(started.partnerSchedule.active, started.recentEvent);
      assert.equal(started.partnerSchedule.active.heartReward, 65);
      const endsAt = started.partnerSchedule.active.endsAt;
      const saved = createSaveFileText(started, null, now);
      const loaded = loadStoredPetJson(saved, endsAt, quiet);
      assert.equal(loaded.status, 'ok');
      const pending = loaded.pet;
      assert.ok(pending.partnerSchedule.pendingResult);
      assert.equal(pending.partnerSchedule.pendingResult.heartReward, 65);
      assert.equal(getPartnerScheduleClaimPreview(pending.partnerSchedule.pendingResult, 'coins', 0, pending).hearts, 65);
      assert.equal(getPartnerScheduleClaimPreview(pending.partnerSchedule.pendingResult, 'category', 0, pending).hearts, 65);
      const claimed = claimPartnerScheduleResult(pending, 'coins', endsAt);
      assert.equal(claimed.hearts - pending.hearts, 65);
      assert.equal(claimed.achievements.counters.heartEarnedTotal - pending.achievements.counters.heartEarnedTotal, 65);
      const restored = parseSaveFileText(createSaveFileText(claimed, null, endsAt), endsAt).pet;
      assert.equal(claimPartnerScheduleResult(restored, 'coins', endsAt).hearts, restored.hearts, 'claimed rewards cannot replay after reload');
      const midway = now + (endsAt - now) / 2;
      const early = cancelPartnerSchedule(started, midway);
      const earlyRestored = parseSaveFileText(createSaveFileText(early, null, midway), midway).pet;
      assert.equal(claimPartnerScheduleResult(earlyRestored, 'coins', midway).hearts - earlyRestored.hearts, 26, 'partial work preserves prorated hearts through a save');
      const frozen = { ...pending, timePause: { schemaVersion: 1, pausedAt: endsAt } };
      assert.equal(claimPartnerScheduleResult(frozen, 'coins', endsAt).hearts, frozen.hearts);
      const quick = applyPetAction(initial, 'work', now);
      assert.equal(quick.hearts - initial.hearts, getQuickWorkPreview(initial, now).hearts);
      const quickRestored = parseSaveFileText(createSaveFileText(quick, null, now), now).pet;
      assert.equal(quickRestored.hearts, quick.hearts);
      assert.equal(quickRestored.achievements.counters.heartEarnedTotal, quick.achievements.counters.heartEarnedTotal);
      const promised = structuredClone(started);
      promised.partnerSchedule.active.heartReward = 73;
      const preserved = loadStoredPetJson(createSaveFileText(promised, null, now), endsAt, quiet).pet;
      assert.equal(getPartnerScheduleClaimPreview(preserved.partnerSchedule.pendingResult, 'coins', 0, preserved).hearts, 73, 'saved reward quotes take precedence over current balance values');
      const legacy = structuredClone(started);
      delete legacy.partnerSchedule.active.heartReward;
      const legacyRestored = parseSaveFileText(createSaveFileText(legacy, null, now), now).pet;
      assert.equal(legacyRestored.partnerSchedule.active.heartReward, 65, 'existing unclaimed work gains a stable heart quote');
    });

    await check('手动随机珍宝、存档恢复与采集防重', async () => {
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
      assert.deepEqual(twice.pet.community.expedition.loop.vouchers, [], 'new rewards have no daily voucher allowance');
      const first = harvest(initial), second = harvest(reload(first.pet));
      assert.equal(first.finds.creek_aquamarine + second.finds.creek_aquamarine, 2);
      assert.deepEqual(second.pet.community.expedition.loop, twice.pet.community.expedition.loop, 'batched and separately saved harvests agree');
      const partial = structuredClone(initial);
      partial.community.expedition.loop.vouchers = [{ day: partial.community.expedition.loop.day, slot: 0, face: 150, paid: 100, rewardsVersion: 1, lootUsed: 99 }];
      const last = harvest(reload(partial), 'valley', 2);
      assert.deepEqual(last.finds, twice.finds, 'retained legacy fields cannot limit rewards after migration');
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
      const due = structuredClone(initial);
      due.community.expedition.loop.commonLootMisses = 7;
      const savedDue = reload(due);
      assert.equal(savedDue.community.expedition.loop.commonLootMisses, 7, 'common treasure pity survives a save');
      const guaranteed = harvest(savedDue, 'station');
      assert.equal(['coin_hoard', 'valley_amber', 'ancient_gold_bar'].reduce((sum, id) => sum + (guaranteed.finds[id] ?? 0), 0), 1);
      assert.equal(reload(guaranteed.pet).community.expedition.loop.commonLootMisses, 0);
      const repeated = settleExplorationLoot(reload(guaranteed.pet), 1, 'manual', 'station', now);
      assert.deepEqual(repeated.finds, {}, 'replaying settlement cannot grant the pity reward twice');
      assert.equal(repeated.pet.community.expedition.loop.commonLootMisses, 0, 'replayed settlement cannot advance pity');
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
      assert.equal(state.adventure.active.loot.creek_aquamarine, 1);
      assert.equal(state.adventure.active.loot.ancient_gold_bar, 1);
      assert.equal(state.community.treasureResearch.creek_aquamarine, 2, 'only the tool advances research');
      assert.equal(state.community.expedition.collection.creek_aquamarine, 1);
      const trip = ready.adventure.active;
      assert.deepEqual(advanceAdventure(state, trip.id, trip.choices.length, choice.id, now, trip.revision), state);
      state = reload(state);
      assert.equal(state.adventure.active.loot.creek_aquamarine, 1, 'full bag overflow survives reload');
      const loot = { ...state.adventure.active.loot }, space = Object.values(loot).reduce((sum, amount) => sum + amount, 0);
      state = discardAdventureItem(state, trip.id, state.adventure.active.revision, 'trail_mix', space);
      for (const [item, amount] of Object.entries(loot)) state = pickupAdventureLoot(state, trip.id, state.adventure.active.revision, item, amount);
      state = returnFromAdventure(state, trip.id, now);
      assert.equal(state.adventure.pending.items.creek_aquamarine, 1, 'return keeps harvested gems without another roll');
      assert.equal(state.community.expedition.loop.used, 1);
      state.inventory.creek_aquamarine = inventoryItemLimit;
      state = claimAdventureResult(reload(state), trip.id);
      assert.deepEqual(state.adventure.pending.items, { creek_aquamarine: 1 });
      state = reload(state);
      assert.deepEqual(claimAdventureResult(state, trip.id).inventory, state.inventory);
      state.inventory.creek_aquamarine -= 1;
      state = claimAdventureResult(state, trip.id);
      assert.equal(state.inventory.creek_aquamarine, inventoryItemLimit);
      assert.equal(state.adventure.pending, undefined);
      assert.equal(claimAdventureResult(state, trip.id), state);
      const old = structuredClone(initial);
      old.adventure.active.rulesVersion = 8; old.adventure.active.purpose = undefined;
      const { advancePet } = await import('../src/core/petLifecycle.ts');
      const legacy = advancePet(reload(old), now, quiet);
      assert.equal(legacy.adventure.active, undefined);
      assert.equal(legacy.adventure.pending.complete, true, 'old active trips finish successfully during update');
      assert.deepEqual(advancePet(reload(legacy), now, quiet).adventure.pending, legacy.adventure.pending, 'successful migration cannot issue the receipt twice');
    });

    await check('各地区伙伴商店、库存恢复与交易防重', async () => {
      const { startAdventure, advanceAdventure, canUseAdventureService, buyAdventureSupply, transportAdventureSupply } = await import('../src/core/adventure.ts');
      const { getAdventureShopPrice } = await import('../src/core/adventureData.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state), mood: getPetStatCap(state) });
      const act = (state, id) => advanceAdventure(state, state.adventure.active.id, state.adventure.active.choices.length, id, now, state.adventure.active.revision);
      const initial = fuel(normalizePet({ ...pet, hearts: 1000, adventure: { ...pet.adventure, completed: { tutorial: 1, valley: 1 }, landmarks: mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node))) } }, now));
      for (const region of mapRegions) {
        let started;
        for (let attempt = 0; attempt < 12; attempt++) {
          started = startAdventure({ ...initial, adventure: { ...initial.adventure, tripsStarted: attempt } }, region, 'official.furo', 'Furo', {}, false, now, undefined, undefined, ['official.furo', 'fixture.neighbor']);
          if (started.adventure.active?.neighborId) break;
        }
        assert.equal(started.adventure.active?.neighborId, 'fixture.neighbor', region + ' can meet a non-installed companion');
        assert.equal(canUseAdventureService(started), false, 'services wait until the obstacle is completed');
        const savedStart = reload(started);
        assert.equal(savedStart.adventure.active.neighborId, started.adventure.active.neighborId, 'restoring cannot redraw the encounter');
        assert.deepEqual(savedStart.adventure.active.shopStock, started.adventure.active.shopStock);
        const steps = getLandmarkSteps(landmarkId(region, 'entrance'));
        let ready = savedStart;
        for (const step of steps.slice(0, 4)) ready = act(fuel(ready), step.choices[0].id);
        ready = reload(ready);
        assert.equal(canUseAdventureService(ready), true, region + ' opens its saved shop after the obstacle');
        const trip = ready.adventure.active;
        const bought = buyAdventureSupply(ready, trip.id, trip.revision, 'trail_mix', 1);
        assert.equal(bought.coins, ready.coins - getAdventureShopPrice('trail_mix', trip.rulesVersion));
        assert.equal(bought.adventure.active.bag.trail_mix, 1);
        const restored = reload(bought);
        assert.equal(restored.adventure.active.neighborId, trip.neighborId);
        assert.equal(restored.adventure.active.shopStock.trail_mix, trip.shopStock.trail_mix - 1);
        assert.equal(restored.adventure.active.purchases, 1);
        assert.deepEqual(buyAdventureSupply(restored, trip.id, trip.revision, 'trail_mix', 1), restored, 'a saved purchase cannot charge twice');
        const soldOut = reload(buyAdventureSupply(restored, trip.id, restored.adventure.active.revision, 'trail_mix', 1));
        assert.equal(soldOut.adventure.active.shopStock.trail_mix ?? 0, 0, 'reload must not restock sold-out items');
        assert.deepEqual(buyAdventureSupply(soldOut, trip.id, soldOut.adventure.active.revision, 'trail_mix', 1), soldOut);
        const delivered = transportAdventureSupply(soldOut, trip.id, soldOut.adventure.active.revision, 'apple', 1);
        assert.equal(delivered.inventory.apple, soldOut.inventory.apple - 1);
        assert.equal(delivered.hearts, soldOut.hearts - 2);
        const savedDelivery = reload(delivered);
        assert.equal(savedDelivery.adventure.active.transportedCount, 1);
        assert.deepEqual(transportAdventureSupply(savedDelivery, trip.id, soldOut.adventure.active.revision, 'apple', 1), savedDelivery);
        ready = act(fuel(savedDelivery), steps[4].choices[0].id);
        assert.equal(canUseAdventureService(reload(ready)), true, 'shop access follows stages rather than a hard-coded step 4');
        for (const step of steps.slice(5)) ready = act(fuel(ready), step.choices[0].id);
        assert.equal(canUseAdventureService(reload(ready)), false, 'services close when the trip is complete');
        const noEncounter = reload({ ...started, adventure: { ...started.adventure, active: { ...started.adventure.active, neighborId: undefined, shopStock: {} } } });
        assert.equal(noEncounter.adventure.active.neighborId, undefined, 'existing trips without a neighbor retain that result');
        assert.deepEqual(noEncounter.adventure.active.shopStock, {});
      }
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
      const lens = commands.find(choice => choice.id === 'lens:valley_mushroom');
      assert.ok(lens, 'a lens exposes an explicit food target');
      const lensPreview = getAdventureChoicePreview(restored, lens, now), focused = act(restored, lens.id);
      assert.equal(focused.community.toolWear.survey_lens, 1);
      assert.equal(focused.community.expedition.loop.used - restored.community.expedition.loop.used, 1);
      assert.equal(focused.adventure.active.bag.valley_mushroom, lens.finds.valley_mushroom);
      assert.equal(focused.adventure.active.checkState.last.energy, lensPreview.energy[0]);
      assert.equal(focused.adventure.active.checkState.last.hunger, lensPreview.hunger[0]);
      assert.ok(focused.adventure.active.earnedCoins > 0);
      assert.equal(reload(focused).adventure.active.earnedCoins, focused.adventure.active.earnedCoins);
      assert.deepEqual(advanceAdventure(reload(focused), trip.id, 2, lens.id, now, trip.revision).community.toolWear, focused.community.toolWear);
      for (const retiredId of ['gather:materials', 'tool:materials', 'lens:materials']) {
        const legacy = structuredClone(restored);
        legacy.adventure.active.choices.push(retiredId, steps[3].choices[0].id, steps[4].choices[0].id);
        legacy.adventure.active.stageIds = steps.slice(0, 5).map(step => step.id);
        legacy.adventure.active.bag = { community_wood: 4, community_stone: 3 };
        legacy.adventure.active.earnedCoins = 20;
        legacy.community.expedition.loop.available--;
        legacy.community.expedition.loop.used++;
        const saved = reload(legacy);
        assert.deepEqual(saved.adventure.active.choices, legacy.adventure.active.choices, 'retired material actions remain completed history');
        assert.deepEqual(saved.adventure.active.bag, legacy.adventure.active.bag, 'previously gathered materials survive import');
        assert.equal(saved.adventure.active.earnedCoins, 20);
        const completed = reload(act(fuel(saved), steps[5].choices[0].id));
        assert.equal(completed.adventure.active.choices.length, 6, 'old trips continue from the saved stage');
        assert.equal(completed.community.expedition.loop.used, legacy.community.expedition.loop.used, 'restoring history cannot consume another gathering charge');
        assert.equal(completed.adventure.active.bag.community_wood, 4);
        assert.equal(completed.adventure.active.bag.community_stone, 3);
      }
    });

    await check('仓库绳索与旧携带绳索的耐久、返还和读档防重', async () => {
      const { startAdventure, advanceAdventure, returnFromAdventure, claimAdventureResult, getAdventureChoicePreview } = await import('../src/core/adventure.ts');
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
      const rope = getLandmarkSteps('landmark:valley:entrance')[3].choices.find(choice => choice.id === 'rope:obstacle');
      const preview = getAdventureChoicePreview(breaking, rope, now);
      assert.deepEqual(preview.healthLoss, [0, 0]);
      assert.equal(used.health, breaking.health);
      assert.equal(used.adventure.active.checkState.last.energy, preview.energy[0]);
      assert.equal(used.adventure.active.checkState.last.hunger, preview.hunger[0]);
      const skilled = structuredClone(breaking); skilled.partnerSchedule.skills.exercise.level = 10;
      const trained = getAdventureChoicePreview(skilled, rope, now);
      assert.equal(trained.costFactors.skillEnergy, .6);
      assert.equal(trained.costFactors.skillHunger, .8);
      assert.ok(trained.energy[0] < preview.energy[0]);
      assert.equal(act(skilled, rope.id).adventure.active.checkState.last.energy, trained.energy[0]);
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
      const { getExplorationCampQuote, getExplorationRescueQuote, restExplorationWithKit, rescueExploration } = await import('../src/core/explorationSupport.ts');
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
        const healthy = fuel(missed);
        assert.equal(getExplorationRescueQuote(healthy, 'adventure').visible, false);
        assert.equal(rescueExploration(healthy, 'adventure', live.id, live.revision, now).hearts, healthy.hearts);
        const depleted = reload({ ...missed, hunger: getPetStatCap(missed) * .3 });
        assert.equal(getExplorationRescueQuote(depleted, 'adventure').visible, true);
        const rescued = rescueExploration(depleted, 'adventure', live.id, live.revision, now);
        assert.equal(rescued.hearts, depleted.hearts - 100, 'low-state rescue is independent of the missed camp');
        assert.equal(rescued.adventure.active.rested, false);
        const savedRescue = reload(rescued);
        assert.equal(rescueExploration(savedRescue, 'adventure', live.id, live.revision, now).hearts, savedRescue.hearts, 'a rescue restored from disk cannot charge twice');
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
      const reload = value => parseSaveFileText(createSaveFileText(value, null, now), now).pet;
      let converted = startAdventure(fuel({ ...pet, adventure: { ...pet.adventure, completed: { tutorial: 1 }, landmarks: ['landmark:valley:entrance'] } }), 'valley', 'official.furo', 'Furo', {}, false, now, 'landmark:valley:gather');
      for (const step of getLandmarkSteps('landmark:valley:gather')) {
        const trip = converted.adventure.active;
        converted = reload(advanceAdventure(fuel(converted), trip.id, trip.choices.length, step.choices[0].id, now, trip.revision));
        assert.equal(advanceAdventure(converted, trip.id, trip.choices.length, step.choices[0].id, now, trip.revision), converted, 'replaying completion cannot duplicate the converted gift');
      }
      assert.equal(converted.adventure.active.earnedCoins, 34, 'two wood and one stone become a saved coin allowance');
      const convertedReceipt = reload(returnFromAdventure(converted, converted.adventure.active.id, now));
      assert.equal(convertedReceipt.adventure.pending.coins, 54, 'allowance and original first-clear coins are each paid once');
      assert.equal(convertedReceipt.adventure.pending.items.community_wood ?? 0, 0);
      assert.equal(convertedReceipt.adventure.pending.items.community_stone ?? 0, 0);
      const convertedId = convertedReceipt.adventure.pending.id;
      const collected = reload(claimAdventureResult(convertedReceipt, convertedId));
      assert.equal(collected.coins, convertedReceipt.coins + 54);
      assert.equal(claimAdventureResult(collected, convertedId), collected);
      const legacyCompleted = structuredClone(converted);
      legacyCompleted.adventure.active.earnedCoins = 0;
      legacyCompleted.adventure.active.bag.community_wood = 2;
      legacyCompleted.adventure.active.bag.community_stone = 1;
      const legacyReceipt = reload(returnFromAdventure(reload(legacyCompleted), legacyCompleted.adventure.active.id, now));
      assert.equal(legacyReceipt.adventure.pending.coins, 20, 'a previously completed gift must not receive extra compensation');
      assert.equal(legacyReceipt.adventure.pending.items.community_wood, 2);
      assert.equal(legacyReceipt.adventure.pending.items.community_stone, 1);
    });

    await check('季度聚餐旧轮迁移、跨季续程与独立领奖防重', async () => {
      const { startAdventure, advanceAdventure, returnFromAdventure, claimAdventureResult, getAdventureRewardPreview } = await import('../src/core/adventure.ts');
      const { startExplorationCampaign, advanceCampaignVisit, claimCampaignTask } = await import('../src/core/explorationCampaign.ts');
      const { campaignTasks, campaignVisitIds, campaignVisits, getCampaignReward } = await import('../src/core/explorationCampaignData.ts');
      const { campaignDestination, getCampaignSupplies, getCampaignDelivery, campaignVisitStep, campaignVisitComplete, campaignText } = await import('../src/core/explorationCampaignState.ts');
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const { getNeighborIdentities } = await import('../src/core/neighbors.ts');
      const fuel = p => ({ ...p, hunger: getPetStatCap(p), energy: getPetEnergyCap(p), health: getPetStatCap(p), mood: getPetStatCap(p) });
      const reload = p => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
      const landmarks = mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node)));
      const old = { ...pet, inventory: { ...pet.inventory, bento: 3, dish_herb_porridge: 2, community_wood: 3, hill_honey: 3, forest_berry: 3, sea_glass: 2, observatory_part: 2 }, adventure: { ...pet.adventure, schemaVersion: 8, campaign: undefined, completed: { tutorial: 1 }, landmarks } };
      const full = fuel(reload(old));
      assert.deepEqual(full.adventure.campaign.tasks, {}, 'existing map completion cannot complete new tasks');
      assert.equal(full.hearts, pet.hearts);
      assert.deepEqual(full.adventure.landmarks, landmarks);
      const candidates = getNeighborIdentities([{ manifest: { id: 'fixture.picnic', name: 'DeepSeek', defaultPetName: '小肥鱼$&' } }], 'official.furo');
      assert.equal(candidates[0].name, '小肥鱼$&');
      let state = startExplorationCampaign(full, candidates, 'official.furo', now);
      assert.equal(campaignText('{neighbor}来了', state.adventure.campaign, 'valley'), '小肥鱼$&来了');
      assert.deepEqual(state.adventure.campaign.tasks, {});
      const contact = structuredClone(state.adventure.campaign.contacts.valley);
      const boost = structuredClone(state.boostCards), hearts = state.hearts, apples = state.inventory.golden_apple ?? 0;
      const collection = structuredClone(state.community.expedition.collection);
      const loopUsed = state.community.expedition.loop?.used ?? 0;
      const supplies = (p, id) => getCampaignSupplies(p, id).reduce((bag, need) => {
        const chosen = id === 'station_dinner' ? { bento: 1, dish_herb_porridge: 1 } : getCampaignDelivery(need, p.inventory);
        for (const [item, n] of Object.entries(chosen)) bag[item] = (bag[item] ?? 0) + n;
        return bag;
      }, {});
      const depart = (p, id) => startAdventure(fuel(p), campaignVisits[id].region, 'official.furo', 'Furo', supplies(p, id), false, now, campaignDestination(id), undefined, [], id);
      const returnAndCollect = p => {
        const returned = reload(returnFromAdventure(p, p.adventure.active.id, now));
        assert.equal(returned.adventure.pending.first, false);
        assert.equal(returned.adventure.pending.hearts, 0);
        assert.equal(returned.adventure.pending.coins, 0);
        const receiptId = returned.adventure.pending.id;
        const collected = reload(claimAdventureResult(returned, receiptId));
        assert.equal(claimAdventureResult(collected, receiptId), collected);
        return collected;
      };
      // Each restored trip continues its saved choices; the final dinner resumes after delivery.
      for (const id of campaignVisitIds) {
        state = reload(depart(state, id));
        assert.equal(state.adventure.active.campaign.mode, 'visit', id);
        assert.equal(advanceAdventure(state, state.adventure.active.id, 0, 'story', now, state.adventure.active.revision), state);
        while (!campaignVisitComplete(state.adventure.campaign, id)) {
          const index = campaignVisitStep(state.adventure.campaign, id), step = campaignVisits[id].steps[index], trip = state.adventure.active;
          const chosen = id === 'forest_basket' && index === 1 ? 'detour' : step.options[0].id;
          const delivery = step.delivery ? getCampaignDelivery(step.delivery, trip.bag) : {};
          if (step.delivery) {
            const invalid = advanceCampaignVisit(state, trip.id, trip.revision, index, chosen, { ...delivery, apple: 1 }, [], now);
            assert.deepEqual(invalid.adventure, state.adventure, 'an invalid delivery does not spend progress or supplies');
          }
          const neighbors = [{ modId: 'fixture.new-neighbor', name: '阿栗' }];
          state = advanceCampaignVisit(fuel(state), trip.id, trip.revision, index, chosen, delivery, neighbors, now);
          assert.equal(campaignVisitStep(state.adventure.campaign, id), index + 1);
          const snapshot = structuredClone(state.adventure.campaign);
          state = reload(state);
          assert.deepEqual(state.adventure.campaign, snapshot);
          assert.equal(advanceCampaignVisit(state, trip.id, trip.revision, index, chosen, delivery, neighbors, now), state, 'retries after reloading cannot deliver twice');
          if (id === 'valley_bridge' && index === 1 || id === 'station_dinner' && index === 0) {
            const remaining = getCampaignSupplies(state, id);
            state = returnAndCollect(state);
            state = reload(depart(state, id));
            assert.equal(state.adventure.active.campaign.startStep, index + 1);
            assert.deepEqual(getCampaignSupplies(state, id), remaining);
            assert.deepEqual(state.adventure.campaign, snapshot);
          }
        }
        state = returnAndCollect(state);
      }
      assert.deepEqual(state.adventure.campaign.contacts.valley, contact, 'uninstalled or renamed Mods retain their original contact name');
      assert.equal(state.adventure.campaign.contacts.windmill.name, '阿栗', 'later chapters use the installed neighbors available when unlocked');
      assert.equal(state.adventure.campaign.contacts.forest.reference.kind, 'generic', 'already used neighbors are not silently reassigned');
      assert.equal(state.adventure.campaign.visits.forest_basket[1], 'detour');
      assert.deepEqual(state.adventure.campaign.tasks[28].delivery, { bento: 1, dish_herb_porridge: 1 });
      assert.equal(Object.keys(state.adventure.campaign.tasks).length, 30);
      assert.equal(state.adventure.journal.length, 8, 'full campaign history is independent of the last eight travel receipts');
      assert.deepEqual(state.adventure.landmarks, landmarks);
      assert.equal(state.community.expedition.loop?.used ?? 0, loopUsed);
      assert.deepEqual(state.community.expedition.collection, collection);
      assert.deepEqual(state.community.expedition.projects, full.community.expedition.projects, 'weekly activities keep their separate completion and rewards');
      assert.equal(state.hearts, hearts);
      const blocked = { ...state, inventory: { ...state.inventory, golden_apple: inventoryItemLimit } };
      assert.equal(claimCampaignTask(blocked, 1, now), blocked, 'a full warehouse keeps the entire reward unclaimed');
      const unclaimed = state;
      for (const task of campaignTasks) {
        state = reload(claimCampaignTask(state, task.id, now));
        assert.equal(claimCampaignTask(state, task.id, now), state, 'claimed rewards cannot be duplicated after restoring');
      }
      assert.equal(state.hearts - hearts, 10000);
      assert.equal(state.inventory.golden_apple - apples, 40);
      assert.deepEqual(state.boostCards, boost, 'fixed task rewards do not consume boost cards');
      assert.equal(Object.values(state.adventure.campaign.tasks).filter(record => record.claimedAt).length, 30);

      const nextQuarter = new Date(2026, 9, 1, 5).getTime(), previousRun = state.adventure.campaign.runId;
      assert.equal(startExplorationCampaign(state, candidates, 'official.furo', nextQuarter - 1), state, '05:00 is the quarterly boundary');
      assert.equal(startExplorationCampaign({ ...state, timePause: { pausedAt: now } }, candidates, 'official.furo', nextQuarter).adventure.campaign.runId, previousRun);
      assert.equal(startExplorationCampaign(unclaimed, candidates, 'official.furo', nextQuarter).adventure.campaign.runId, previousRun, 'unclaimed rewards keep the current run');
      const nextRound = startExplorationCampaign(state, [{ modId: 'fixture.new', name: '新邻居' }], 'official.furo', nextQuarter, previousRun);
      assert.equal(nextRound.adventure.campaign.quarter, '2026-Q4');
      assert.notEqual(nextRound.adventure.campaign.runId, previousRun);
      assert.equal(nextRound.adventure.campaign.contacts.valley.name, '新邻居');
      assert.deepEqual(nextRound.adventure.campaign.history[0].tasks, state.adventure.campaign.tasks);
      assert.deepEqual(nextRound.adventure.landmarks, landmarks);
      assert.deepEqual(nextRound.adventure.campaign.tasks, {});
      assert.equal(startExplorationCampaign(nextRound, candidates, 'official.furo', nextQuarter, previousRun), nextRound, 'old start requests cannot affect a newer run');
      const readyToClaim = { ...nextRound, adventure: { ...nextRound.adventure, campaign: { ...nextRound.adventure.campaign, tasks: { 1: { completedAt: nextQuarter } } } } };
      assert.equal(claimCampaignTask(readyToClaim, 1, nextQuarter, previousRun), readyToClaim, 'old task UI cannot claim the new run');
      assert.equal(startExplorationCampaign({ ...state, adventure: { ...state.adventure, pending: { id: 'unsettled' } } }, candidates, 'official.furo', nextQuarter).adventure.campaign.runId, previousRun);
      assert.equal(startExplorationCampaign(state, candidates, 'official.furo', new Date(2027, 6, 1, 5).getTime()).adventure.campaign.history.length, 1, 'missed quarters do not create catch-up runs');

      const legacy = structuredClone(unclaimed);
      legacy.adventure.schemaVersion = 9;
      legacy.adventure.campaign = { schemaVersion: 1, startedAt: now, contacts: legacy.adventure.campaign.contacts, visits: legacy.adventure.campaign.visits, tasks: legacy.adventure.campaign.tasks };
      legacy.adventure.campaign.tasks[1] = { ...legacy.adventure.campaign.tasks[1], claimedAt: now, reward: getCampaignReward(1, 1) };
      legacy.hearts += getCampaignReward(1, 1).hearts;
      legacy.inventory.golden_apple = apples + getCampaignReward(1, 1).apples;
      let migrated = reload(legacy);
      assert.equal(migrated.adventure.campaign.rewardVersion, 1);
      assert.equal(migrated.adventure.campaign.quarter, '2026-Q3');
      assert.deepEqual(migrated.adventure.campaign.tasks[1], legacy.adventure.campaign.tasks[1]);
      for (const task of campaignTasks) migrated = reload(claimCampaignTask(migrated, task.id, now));
      assert.equal(migrated.hearts - hearts, 30000, 'already-started legacy runs retain all old rewards');
      assert.equal(migrated.inventory.golden_apple - apples, 125);
      assert.equal(migrated.adventure.campaign.history.length, 0, 'migration never starts a new quarter');
      assert.equal(startExplorationCampaign(migrated, candidates, 'official.furo', nextQuarter).adventure.campaign.rewardVersion, 2);

      const existingTrip = startAdventure(full, 'valley', 'official.furo', 'Furo', {}, false, now, 'landmark:valley:crossing');
      const upgradedTrip = reload(startExplorationCampaign(existingTrip, candidates, 'official.furo', now));
      assert.equal(upgradedTrip.adventure.active.campaign, undefined, 'starting a campaign does not inject events into an old trip');
      assert.equal(upgradedTrip.adventure.active.id, existingTrip.adventure.active.id);
      const existingReceipt = returnFromAdventure(existingTrip, existingTrip.adventure.active.id, now);
      assert.deepEqual(reload(startExplorationCampaign(existingReceipt, candidates, 'official.furo', now)).adventure.pending, reload(existingReceipt).adventure.pending);

      let newcomer = startExplorationCampaign(fuel({ ...full, adventure: { ...full.adventure, landmarks: ['entrance', 'gather', 'ridge'].map(node => landmarkId('valley', node)) } }), candidates, 'official.furo', now);
      newcomer = reload(depart(newcomer, 'valley_bridge'));
      assert.equal(newcomer.adventure.active.campaign.mode, 'embedded');
      const initialTrip = newcomer.adventure.active;
      assert.deepEqual(advanceCampaignVisit(newcomer, initialTrip.id, initialTrip.revision, 0, 'continue', {}, candidates, now).adventure, newcomer.adventure, 'campaign events wait for the landmark story');
      for (const step of getLandmarkSteps('landmark:valley:crossing')) {
        const trip = newcomer.adventure.active;
        const choice = step.choices.find(c => !c.harvest && !c.item && !c.tool && !c.check?.tool && !c.check?.risky);
        newcomer = reload(advanceAdventure(fuel(newcomer), trip.id, trip.choices.length, choice.id, now, trip.revision));
      }
      assert.equal(newcomer.adventure.active.firstCompletion, true);
      assert.deepEqual(newcomer.adventure.campaign.tasks, {});
      const earned = getAdventureRewardPreview(newcomer), nextTrip = newcomer.adventure.active;
      newcomer = reload(advanceCampaignVisit(fuel(newcomer), nextTrip.id, nextTrip.revision, 0, 'continue', {}, candidates, now));
      assert.ok(newcomer.adventure.campaign.tasks[1]);
      assert.deepEqual(startExplorationCampaign(newcomer, candidates, 'official.furo', nextQuarter).adventure.campaign, newcomer.adventure.campaign, 'an unfinished trip and run continue across quarters');
      const legacyInFlight = structuredClone(newcomer);
      legacyInFlight.adventure.schemaVersion = 9;
      legacyInFlight.adventure.campaign.schemaVersion = 1;
      delete legacyInFlight.adventure.campaign.runId;
      delete legacyInFlight.adventure.active.campaign.runId;
      const restoredFlight = reload(legacyInFlight);
      assert.equal(restoredFlight.adventure.active.campaign.runId, restoredFlight.adventure.campaign.runId, 'legacy trips bind to their migrated run');
      assert.deepEqual(getAdventureRewardPreview(newcomer), earned, 'embedded preparation keeps the normal first-clear reward unchanged');
      const returned = reload(returnFromAdventure(newcomer, nextTrip.id, now));
      assert.equal(returned.adventure.pending.campaignVisit, undefined);
      assert.equal(returned.adventure.pending.first, true);
    });

    await check('计时提醒随取消、冻结、成熟和存档恢复保持一致', async () => {
      const { deriveNotificationPlans, isReminderCompleted, groupDueReminders } = await import('../src/core/notificationPlans.ts');
      const copy = JSON.parse(JSON.stringify(pet));
      copy.community.plots[0].crop = { id: 'carrot', plantedAt: now - 1000, readyAt: now + 60000 };
      copy.pomodoro = { ...copy.pomodoro, isRunning: true, phase: 'focus', phaseStartedAt: now, phaseEndsAt: now + 60000,
        settings: { focusMinutes: 1, shortBreakMinutes: 1, targetRounds: 2 } };
      const plans = deriveNotificationPlans(copy);
      assert.equal(plans.filter(plan => plan.source === 'pomodoro').length, 4, 'schedule every remaining phase without simulating rewards');
      const crop = plans.find(plan => plan.source === 'crop');
      assert.equal(isReminderCompleted(copy, crop, now), false);
      assert.equal(isReminderCompleted(copy, crop, now + 60000), true);
      const before = JSON.stringify(copy);
      deriveNotificationPlans(copy);
      assert.equal(JSON.stringify(copy), before, 'planning cannot mutate gameplay');
      copy.community.plots[0].crop.readyAt = now + 30000;
      assert.equal(deriveNotificationPlans(copy).find(plan => plan.source === 'crop').key, crop.key, 'watering reschedules the same growth cycle');
      copy.community.plots[0].crop = undefined;
      assert.equal(isReminderCompleted(copy, crop, now + 60000), false, 'clearing a crop cancels its old reminder');
      copy.timePause = { schemaVersion: 1, pausedAt: now };
      assert.deepEqual(deriveNotificationPlans(copy), []);
      assert.equal(isReminderCompleted(copy, crop, now + 60000), false);
      assert.equal(groupDueReminders([crop, { ...crop, key: 'another-crop' }]).length, 1);
      const { showSystemNotification, readNotificationPreferences } = await import('../src/platform/notifications.ts');
      assert.equal(readNotificationPreferences().enabled, false);
      await assert.rejects(showSystemNotification(crop, pet.saveMetadata.id, () => {}), /尚未授权/);
      const { refreshBackgroundCapabilities, getBackgroundCapabilities } = await import('../src/platform/background.ts');
      window.__TAURI_INTERNALS__ = { invoke: async () => { throw new Error('Injected background bridge failure'); } };
      try {
        await assert.rejects(showSystemNotification(crop, pet.saveMetadata.id, () => {}), /bridge failure/);
        await assert.rejects(refreshBackgroundCapabilities(), /bridge failure/);
        window.__TAURI_INTERNALS__.invoke = async () => ({ platform: 'android', nativeMusic: true, notifications: true, permission: 'denied', exactAlarms: false });
        assert.equal((await getBackgroundCapabilities()).permission, 'denied', 'a failed capability call must be retryable');
      } finally { delete window.__TAURI_INTERNALS__; await refreshBackgroundCapabilities(); }
    });

    await check('音乐陪伴存档兼容、累计进度与结算幂等', async () => {
      const { addMusicListeningTime, claimMusicHearts, applyNativeListeningReceipt } = await import('../src/core/musicCompanion.ts');
      const oldEnvelope = JSON.parse(text);
      delete oldEnvelope.pet.musicCompanion;
      assert.deepEqual(parseSaveFileText(JSON.stringify(oldEnvelope), now).pet.musicCompanion, { schemaVersion: 2, pendingListeningMs: 0 });
      oldEnvelope.pet.musicCompanion = { schemaVersion: 1, pendingListeningMs: 12345 };
      assert.deepEqual(parseSaveFileText(JSON.stringify(oldEnvelope), now).pet.musicCompanion, { schemaVersion: 2, pendingListeningMs: 12345 });
      const owner = `${pet.saveMetadata.id}:official.furo`;
      const receipt = { owner, sessionId: 'native-session-1', milliseconds: 120000 };
      const native = applyNativeListeningReceipt(pet, owner, receipt);
      const nativeReopened = parseSaveFileText(createSaveFileText(native, null, now), now).pet;
      assert.equal(nativeReopened.musicCompanion.pendingListeningMs, pet.musicCompanion.pendingListeningMs + 120000);
      assert.equal(applyNativeListeningReceipt(nativeReopened, owner, receipt), nativeReopened, 'receipt replay after a crash cannot pay twice');
      const nativeClaimed = claimMusicHearts(nativeReopened);
      assert.equal(applyNativeListeningReceipt(nativeClaimed, owner, receipt), nativeClaimed, 'claiming preserves the native checkpoint');
      assert.equal(applyNativeListeningReceipt(nativeClaimed, owner, { ...receipt, milliseconds: 119000 }), nativeClaimed, 'out-of-order snapshots do not rewind the checkpoint');
      assert.equal(applyNativeListeningReceipt(pet, 'another-owner', receipt), pet, 'a different save or actor cannot consume a receipt');
      assert.equal(applyNativeListeningReceipt(pet, owner, { ...receipt, milliseconds: Infinity }), pet);
      const progress = applyNativeListeningReceipt(nativeClaimed, owner, { ...receipt, milliseconds: 125000 });
      assert.equal(progress.musicCompanion.pendingListeningMs - nativeClaimed.musicCompanion.pendingListeningMs, 5000);
      const frozenReceipt = applyNativeListeningReceipt({ ...pet, timePause: { schemaVersion: 1, pausedAt: now } }, owner, receipt);
      const frozenReceiptReopened = parseSaveFileText(createSaveFileText(frozenReceipt, null, now), now).pet;
      assert.equal(frozenReceiptReopened.musicCompanion.pendingListeningMs, pet.musicCompanion.pendingListeningMs + receipt.milliseconds, 'eligible audio heard before freezing remains durable');
      assert.equal(applyNativeListeningReceipt(frozenReceiptReopened, owner, receipt), frozenReceiptReopened);
      assert.equal(claimMusicHearts(frozenReceiptReopened), frozenReceiptReopened, 'receipt recovery does not award hearts during a freeze');
      const almostReady = parseSaveFileText(createSaveFileText(addMusicListeningTime(pet, 120_000 - 1), null, now), now).pet;
      assert.equal(claimMusicHearts(almostReady), almostReady);
      assert.equal(claimMusicHearts(addMusicListeningTime(almostReady, 1)).hearts, pet.hearts + 2, 'two minutes across a save boundary earns two hearts');
      const listening = addMusicListeningTime(pet, 25 * 60_000 + 123);
      const reopened = parseSaveFileText(createSaveFileText(listening, null, now), now + 10 * 86400_000).pet;
      assert.equal(reopened.musicCompanion.pendingListeningMs, listening.musicCompanion.pendingListeningMs, 'offline time must not add listening time');
      const claimed = claimMusicHearts(reopened);
      assert.equal(claimed.hearts - reopened.hearts, 24);
      assert.equal(claimed.musicCompanion.pendingListeningMs, 60_000 + 123);
      assert.equal(claimMusicHearts(claimed), claimed, 'repeated settlement must not repeat a reward');
      const carried = parseSaveFileText(createSaveFileText(claimed, null, now), now).pet;
      assert.equal(claimMusicHearts(addMusicListeningTime(carried, 60_000)).hearts, claimed.hearts + 2);
      assert.equal(claimMusicHearts(addMusicListeningTime(pet, 100 * 120_000)).hearts, pet.hearts + 200, 'no daily/session reward cap');
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

    await check('专注心心进度旧档兼容、离线结算与暂停重置恢复', async () => {
      const { advancePet, advancePomodoro } = await import('../src/core/petLifecycle.ts');
      const { startPomodoro, pausePomodoro, resetPomodoro } = await import('../src/core/petActions.ts');
      const minute = 60_000;
      const legacy = JSON.parse(text);
      delete legacy.pet.pomodoro.heartRemainderMs;
      assert.equal(parseSaveFileText(JSON.stringify(legacy), now).pet.pomodoro.heartRemainderMs, 0);
      const started = startPomodoro(pet, now);
      assert.equal(started.pomodoro.isRunning, true);
      const partial = advancePet(started, now + 10 * minute, quiet);
      assert.equal(partial.hearts, pet.hearts);
      assert.equal(partial.pomodoro.heartRemainderMs, 10 * minute);
      const paused = pausePomodoro(partial, now + 10 * minute);
      const restored = loadStoredPetJson(createSaveFileText(paused, null, now + 10 * minute), now + 15 * minute, quiet).pet;
      assert.equal(restored.pomodoro.heartRemainderMs, 10 * minute, 'paused time is not focus');
      const resetFocus = resetPomodoro(restored, now + 15 * minute);
      assert.equal(resetFocus.pomodoro.heartRemainderMs, 10 * minute, 'reset retains unpaid focus');
      const restarted = startPomodoro(resetFocus, now + 15 * minute);
      const rewarded = advancePet(restarted, now + 30 * minute, quiet);
      assert.equal(rewarded.hearts, pet.hearts + 20);
      assert.equal(rewarded.pomodoro.heartRemainderMs, 0);
      const reloaded = loadStoredPetJson(createSaveFileText(rewarded, null, now + 30 * minute), now + 30 * minute, quiet).pet;
      assert.equal(reloaded.hearts, rewarded.hearts, 'reloading a checkpoint cannot replay its heart reward');
      const imported = parseSaveFileText(createSaveFileText(partial, null, now + 10 * minute), now + 86400_000).pet;
      assert.equal(imported.pomodoro.heartRemainderMs, 10 * minute, 'import keeps remainder without adding offline focus');
      assert.equal(imported.pomodoro.isRunning, false);
      let online = started;
      for (let minutes = 5; minutes <= 60; minutes += 5) online = advancePet(online, now + minutes * minute, quiet);
      const offline = loadStoredPetJson(createSaveFileText(started, null, now), now + 60 * minute, quiet).pet;
      assert.equal(online.hearts, pet.hearts + 40, 'two 25-minute focus rounds exclude both breaks');
      assert.equal(offline.hearts, online.hearts);
      assert.equal(offline.pomodoro.heartRemainderMs, online.pomodoro.heartRemainderMs);
      const frozen = { ...started, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(advancePomodoro(frozen, now + 60 * minute).hearts, frozen.hearts);
      for (const invalid of [NaN, Infinity, -1]) assert.equal(normalizePet({ ...pet, pomodoro: { ...pet.pomodoro, heartRemainderMs: invalid } }, now).pomodoro.heartRemainderMs, 0);
    });

    await check('日常心心领取跨存档防重与鱼获满仓分批恢复', async () => {
      const { communityTaskHearts, specialtyOrderHearts } = await import('../src/core/activityHearts.ts');
      const { claimDailyWishReward } = await import('../src/core/dailyWishes.ts');
      const { claimCommunityTask } = await import('../src/core/communityCommissions.ts');
      const { claimSpecialtyOrder } = await import('../src/core/communitySpecialtyOrders.ts');
      const { harvestCommunityCrop } = await import('../src/core/community.ts');
      const { collectCommunityAnimal } = await import('../src/core/communityFarm.ts');
      const { claimCommunityFish } = await import('../src/core/communityFishing.ts');
      const { craftRecipe } = await import('../src/core/kitchen.ts');
      const restore = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      let state = restore({ ...pet, inventory: { ...pet.inventory, carrot: 2, valley_mushroom: 12, orange: 2 },
        dailyWish: { ...pet.dailyWish, progress: pet.dailyWish.target, completedAt: now },
        community: { ...pet.community, gardenBuilt: true,
          tasks: [{ id: 'vegetables:2026-09-21', template: 'vegetables', acceptedAt: now, found: false }],
          specialtyOrders: { acceptedDay: '2026-09-21', completed: 0, active: { id: 'specialty:2026-09-21:valley_mushroom', day: '2026-09-21', item: 'valley_mushroom', quantity: 12, unitPrice: 30, multiplier: 3, acceptedAt: now } },
          plots: [{ id: 1, crop: { id: 'carrot', plantedAt: now - 4 * 3600000, readyAt: now } }],
          facilities: { ...pet.community.facilities, coop: { found: true, work: 4, built: true }, fishing_hut: { found: true, work: 4, built: true } },
          animals: { ...pet.community.animals, coop: { ...pet.community.animals.coop, stock: 6, revision: 3 } },
        },
      });
      state = restore(claimDailyWishReward(state, now));
      assert.equal(state.hearts, pet.hearts + 40);
      assert.equal(claimDailyWishReward(state, now).hearts, state.hearts);
      state = restore(claimCommunityTask(state, 'vegetables:2026-09-21'));
      assert.equal(state.hearts, pet.hearts + 40 + communityTaskHearts);
      assert.equal(claimCommunityTask(state, 'vegetables:2026-09-21').hearts, state.hearts);
      state = restore(claimSpecialtyOrder(state, 'specialty:2026-09-21:valley_mushroom'));
      const afterOrders = pet.hearts + 40 + communityTaskHearts + specialtyOrderHearts;
      assert.equal(state.hearts, afterOrders);
      assert.equal(claimSpecialtyOrder(state, 'specialty:2026-09-21:valley_mushroom').hearts, state.hearts);
      state = restore(harvestCommunityCrop(state, 1, now - 4 * 3600000, now));
      assert.equal(state.hearts, afterOrders + 4);
      assert.equal(harvestCommunityCrop(state, 1, now - 4 * 3600000, now).hearts, state.hearts);
      state = restore(collectCommunityAnimal(state, 'coop', 3, now));
      assert.equal(state.hearts, afterOrders + 22, 'three stored production cycles each earn hearts');
      assert.equal(collectCommunityAnimal(state, 'coop', 3, now).hearts, state.hearts);
      const cooked = craftRecipe(state, 'fruit_salad', false, 2, 'heart-cook', now);
      assert.equal(cooked.hearts, state.hearts + 4, 'cooking uses the increased budget per serving');
      state = restore(cooked);
      assert.equal(craftRecipe(state, 'fruit_salad', false, 2, 'heart-cook', now).hearts, state.hearts);
      const beforeFishing = state.hearts;
      state = restore({ ...state, inventory: { ...state.inventory, pond_crucian: 9998, pond_carp: 9999 }, community: { ...state.community,
        fishing: { ...state.community.fishing, pending: { id: 'heart-fish', mode: 'idle', water: 'pond', at: now, reason: 'return',
          catches: [{ fish: 'pond_crucian', size: 22 }, { fish: 'pond_crucian', size: 24 }, { fish: 'pond_carp', size: 30 }], items: { pond_crucian: 2, pond_carp: 1, fishing_bait: 2 } } },
      } });
      const frozen = { ...state, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(claimCommunityFish(frozen, 'heart-fish'), frozen);
      state = restore(claimCommunityFish(state, 'heart-fish'));
      assert.equal(state.hearts, beforeFishing + 3, 'only one fish fits; returned bait earns nothing');
      assert.deepEqual(state.community.fishing.pending.items, { pond_crucian: 1, pond_carp: 1 });
      assert.equal(claimCommunityFish(state, 'heart-fish').hearts, state.hearts, 'a full inventory cannot repeat heart rewards');
      state = restore(claimCommunityFish({ ...state, inventory: { ...state.inventory, pond_crucian: 9998, pond_carp: 9998 } }, 'heart-fish'));
      assert.equal(state.hearts, beforeFishing + 9);
      assert.equal(state.community.fishing.pending, undefined);
      assert.equal(claimCommunityFish(state, 'heart-fish'), state);
      assert.equal(state.achievements.counters.heartEarnedTotal - pet.achievements.counters.heartEarnedTotal, state.hearts - pet.hearts);
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

    await check('升级曲线退款旧档到账、往返幂等与新档排除', async () => {
      const { upgradeHeartCurveRefundRewardId } = petModule;
      for (const [level, refund] of [[1, 0], [10, 0], [15, 515], [19, 3165], [20, 4065], [21, 4664], [22, 4956], [50, 4956], [99, 4956]]) {
        const previous = { ...pet, level, hearts: 123,
          claimedRewardIds: pet.claimedRewardIds.filter(id => id !== upgradeHeartCurveRefundRewardId) };
        const migrated = normalizePet(previous, now);
        assert.equal(migrated.hearts, 123 + refund);
        assert.equal(migrated.level, level);
        assert.equal(migrated.achievements.counters.heartEarnedTotal, pet.achievements.counters.heartEarnedTotal, 'refunds do not count as new earnings');
        assert.equal(migrated.claimedRewardIds.filter(id => id === upgradeHeartCurveRefundRewardId).length, 1);
        assert.equal(normalizePet(migrated, now).hearts, migrated.hearts);
        const restored = parseSaveFileText(createSaveFileText(migrated, null, now), now).pet;
        assert.equal(restored.hearts, migrated.hearts);
        assert.equal(normalizePet({ ...restored, level: 99 }, now).hearts, migrated.hearts, 'subsequent levels cannot create another refund');
        const paused = normalizePet({ ...previous, timePause: { schemaVersion: 1, pausedAt: now } }, now);
        assert.equal(paused.hearts, migrated.hearts, 'balance refunds do not advance a frozen game');
      }
      const fresh = createDefaultPet(now);
      assert.ok(fresh.claimedRewardIds.includes(upgradeHeartCurveRefundRewardId));
      assert.equal(normalizePet({ ...fresh, level: 99 }, now).hearts, fresh.hearts);
    });

    await check('旧货架改价保留库存和金币、重复恢复不重复迁移', async () => {
      const { getMarketQuote } = await import('../src/core/communityMarket.ts');
      const { marketPricingVersion } = await import('../src/core/communityEconomy.ts');
      const envelope = JSON.parse(text), community = envelope.pet.community;
      community.schemaVersion = 12;
      community.facilities.stall = { found: true, work: 4, built: true };
      Object.assign(community.market, { level: 1, open: false, nextListingId: 2, revenue: 500,
        listings: [{ id: 1, slotIndex: 0, itemId: 'apple', quantity: 10, basePrice: 4, unitPrice: 4, bonus: 20, collector: false }] });
      delete community.market.pricingVersion;
      delete community.market.sessionRevenue;
      const migrated = parseSaveFileText(JSON.stringify(envelope), now).pet;
      assert.equal(migrated.coins, pet.coins);
      assert.deepEqual(migrated.inventory, pet.inventory);
      assert.equal(migrated.community.market.listings[0].quantity, 10);
      assert.equal(migrated.community.market.listings[0].unitPrice, getMarketQuote(migrated, 'apple').price);
      assert.equal(migrated.community.market.revenue, 500);
      assert.equal(migrated.community.market.sessionRevenue, 0, 'old lifetime income is not mistaken for one opening');
      assert.deepEqual(parseSaveFileText(createSaveFileText(migrated, null, now), now).pet.community.market, migrated.community.market);
      const previous = JSON.parse(createSaveFileText(migrated, null, now));
      Object.assign(previous.pet.community.market, { pricingVersion: 1, sessionRevenue: 120,
        listings: [{ id: 1, slotIndex: 0, itemId: 'matsutake', quantity: 2, basePrice: 104, unitPrice: 124, bonus: 20, collector: false },
          { id: 2, slotIndex: 1, itemId: 'cream', quantity: 3, basePrice: 45, unitPrice: 54, bonus: 20, collector: false }], nextListingId: 3 });
      const repriced = parseSaveFileText(JSON.stringify(previous), now).pet;
      assert.equal(repriced.community.market.pricingVersion, marketPricingVersion);
      assert.equal(repriced.coins, migrated.coins, 'repricing never issues historical income');
      assert.equal(repriced.community.market.revenue, 500);
      assert.equal(repriced.community.market.sessionRevenue, 120);
      assert.deepEqual(repriced.community.market.listings.map(listing => [listing.itemId, listing.quantity]), [['matsutake', 2], ['cream', 3]]);
      for (const listing of repriced.community.market.listings) assert.equal(listing.unitPrice, getMarketQuote(repriced, listing.itemId).price);
      assert.deepEqual(parseSaveFileText(createSaveFileText(repriced, null, now), now).pet.community.market, repriced.community.market);
    });

    await check('摆摊本次收入存档往返、离线结算与重复开关店保护', async () => {
      const { advanceCommunityMarket, getMarketQuote, listCommunityGoods, setCommunityMarketOpen } = await import('../src/core/communityMarket.ts');
      const reload = (state, at) => parseSaveFileText(createSaveFileText(state, null, at), at).pet;
      const initial = normalizePet({ ...pet, community: { ...pet.community,
        facilities: { ...pet.community.facilities, stall: { found: true, work: 2, built: true } },
        market: { ...pet.community.market, level: 1, seed: 1, revenue: 500, sessionRevenue: 120 },
      } }, now);
      const stocked = listCommunityGoods(initial, 'apple', 1, initial.community.market.nextListingId, now);
      const opened = setCommunityMarketOpen(stocked, true, now), price = getMarketQuote(opened, 'apple').price;
      assert.equal(opened.community.market.sessionRevenue, 0);
      assert.equal(opened.community.market.revenue, 500);
      const saleAt = opened.community.market.nextVisitAt;
      assert.ok(saleAt > now);
      const online = advanceCommunityMarket(opened, saleAt);
      const offline = advanceCommunityMarket(reload(opened, now), saleAt);
      assert.deepEqual(offline.community.market, online.community.market);
      assert.equal(offline.community.market.sessionRevenue, price);
      assert.equal(offline.community.market.revenue, 500 + price);
      assert.deepEqual(advanceCommunityMarket(reload(offline, saleAt), saleAt).community.market, offline.community.market);
      assert.equal(setCommunityMarketOpen(offline, true, saleAt).community.market.sessionRevenue, price, 'repeated opening must not clear an active session');
      const restocked = listCommunityGoods(offline, 'apple', 1, offline.community.market.nextListingId, saleAt);
      assert.equal(restocked.community.market.sessionRevenue, price, 'restocking keeps the same session');
      const closed = setCommunityMarketOpen(reload(opened, now), false, saleAt);
      assert.equal(closed.community.market.sessionRevenue, price, 'closing settles due sales before preserving session income');
      assert.equal(setCommunityMarketOpen(reload(closed, saleAt), false, saleAt).community.market.sessionRevenue, price);
      assert.deepEqual(advanceCommunityMarket(closed, saleAt + 86400000).community.market, closed.community.market);
      const reopened = setCommunityMarketOpen(reload(closed, saleAt), true, saleAt);
      assert.equal(reopened.community.market.sessionRevenue, 0);
      assert.equal(reopened.community.market.revenue, closed.community.market.revenue);
      const invalid = normalizePet({ ...initial, community: { ...initial.community, market: { ...initial.community.market, sessionRevenue: Infinity } } }, now);
      assert.equal(invalid.community.market.sessionRevenue, 0);
      const oversized = normalizePet({ ...initial, community: { ...initial.community, market: { ...initial.community.market, sessionRevenue: 900 } } }, now);
      assert.equal(oversized.community.market.sessionRevenue, 500);
      const stockedShop = decorations => {
        const state = { ...initial, inventory: { ...initial.inventory, matsutake: 20 }, community: { ...initial.community,
          decorations, decorationLevels: Object.fromEntries(decorations.map(id => [id, 10])),
        } };
        return setCommunityMarketOpen(listCommunityGoods(state, 'matsutake', 20, state.community.market.nextListingId, now), true, now);
      };
      const plain = stockedShop([]), decorated = stockedShop(['golden_sign', 'amber_lantern', 'creek_fountain']);
      assert.equal(decorated.community.market.nextVisitAt - now, (plain.community.market.nextVisitAt - now) / 2);
      const firstVisitAt = decorated.community.market.nextVisitAt;
      const expensiveSale = advanceCommunityMarket(reload(decorated, now), firstVisitAt);
      assert.ok(expensiveSale.community.market.sold > 0, 'a visitor purchases expensive stock without an amount gate');
      assert.equal(expensiveSale.community.market.sessionRevenue, expensiveSale.community.market.sold * decorated.community.market.listings[0].unitPrice);
      const endAt = now + 3600000;
      const split = advanceCommunityMarket(reload(expensiveSale, firstVisitAt), endAt);
      const lumped = advanceCommunityMarket(reload(decorated, now), endAt);
      assert.deepEqual(split.community.market, lumped.community.market, 'decorated traffic survives split offline settlement');
      assert.equal(split.coins, lumped.coins);
      const oldWait = { ...initial, community: { ...initial.community, market: { ...initial.community.market, remainingVisitMs: 15 * 60000 } } };
      assert.equal(reload(oldWait, now).community.market.remainingVisitMs, 15 * 60000, 'legacy paused waits remain unchanged on reload');
    });

    await check('包场游戏日存档、旧日志迁移与跨日恢复', async () => {
      const { advanceCommunityMarket, setCommunityMarketOpen } = await import('../src/core/communityMarket.ts');
      const { getMarketVisit } = await import('../src/core/communityMarketRules.ts');
      const { reconcilePetClock } = await import('../src/core/gameClock.ts');
      const beforeReset = new Date(2026, 9, 8, 4, 55).getTime();
      const resetAt = new Date(2026, 9, 8, 5).getTime();
      let seed = 1;
      while (!getMarketVisit(seed, 0).buyout && seed < 100000) seed++;
      assert.ok(getMarketVisit(seed, 0).buyout, 'fixture must offer a buyout');
      const ready = (state, at) => ({ ...state, community: { ...state.community,
        facilities: { ...state.community.facilities, stall: { found: true, built: true, work: 2 } },
        market: { ...state.community.market, level: 1, open: true, seed, visitors: 0, lastVisitAt: at - 1, nextVisitAt: at, remainingVisitMs: undefined,
          listings: [{ id: 1, slotIndex: 0, itemId: 'apple', quantity: 20, unitPrice: 10, basePrice: 8, bonus: 20, collector: false }], nextListingId: 2 },
      } });
      const reload = (state, at) => parseSaveFileText(createSaveFileText(state, null, at), at).pet;
      const first = advanceCommunityMarket(ready(createDefaultPet(beforeReset), beforeReset), beforeReset);
      assert.equal(first.community.market.lastBuyoutDay, '2026-10-07');
      assert.equal(first.community.market.log[0].buyout, true);
      assert.equal(first.community.market.listings.length, 0);
      const legacy = structuredClone(first);
      delete legacy.community.market.lastBuyoutDay;
      assert.equal(normalizePet(legacy, beforeReset).community.market.lastBuyoutDay, '2026-10-07');
      const saved = reload({ ...first, community: { ...first.community, market: { ...first.community.market, log: [] } } }, beforeReset);
      assert.equal(saved.community.market.lastBuyoutDay, '2026-10-07', 'short logs are not the quota ledger');
      const reopened = setCommunityMarketOpen(setCommunityMarketOpen(saved, false, beforeReset), true, beforeReset);
      assert.equal(reopened.community.market.lastBuyoutDay, '2026-10-07');
      const lateVisit = resetAt - 60000;
      const waiting = ready(reopened, lateVisit);
      const offline = advanceCommunityMarket(waiting, resetAt + 60000);
      assert.equal(offline.community.market.log[0].buyout, false, 'offline visits use their own date, not catch-up time');
      assert.equal(offline.community.market.log[0].items[0].quantity, getMarketVisit(seed, 0).quantity);
      assert.deepEqual(advanceCommunityMarket(reload(advanceCommunityMarket(waiting, lateVisit), lateVisit), resetAt + 60000).community.market, offline.community.market);
      const nextDay = advanceCommunityMarket(ready(reload(offline, resetAt + 60000), resetAt + 120000), resetAt + 120000);
      assert.equal(nextDay.community.market.log[0].buyout, true);
      assert.equal(nextDay.community.market.lastBuyoutDay, '2026-10-08');
      const future = { ...nextDay, community: { ...nextDay.community, market: { ...nextDay.community.market, lastBuyoutDay: '2026-10-11' } } };
      assert.equal(reconcilePetClock(future, resetAt + 120000).pet.community.market.lastBuyoutDay, '2026-10-08');
    });

    await check('纪念馆筹款、短回访、策展扣费与周记录存档防重', async () => {
      const { investMuseumHall, withdrawMuseumHall, completeMuseumHallStage, acceptMuseumQuest } = await import('../src/core/museum.ts');
      const { beginMuseumCuration, editMuseumCuration, hostMuseumCuration, advanceMuseumWeek, findMuseumSolution } = await import('../src/core/museumCuration.ts');
      const { getMuseumExhibits } = await import('../src/core/museumState.ts');
      const { advanceMuseumVisit } = await import('../src/core/museumJourney.ts');
      const { museumVisits, getMuseumStageCost } = await import('../src/core/museumData.ts');
      const { startAdventure, returnFromAdventure, claimAdventureResult } = await import('../src/core/adventure.ts');
      const { mapRegions, landmarkNodes, landmarkId } = await import('../src/core/landmarkProgress.ts');
      const { reconcilePetClock, shiftPetRuntimeTimestamps } = await import('../src/core/gameClock.ts');
      const { getDailyResetDateKey, getWeekStartDateKey } = await import('../src/core/dailyReset.ts');
      const reload = p => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
      let state = reload({ ...pet, coins: 500000, museum: undefined,
        classicEndgame: { ...pet.classicEndgame, legacyLevel: 12, projects: Object.fromEntries(Object.entries(pet.classicEndgame.projects).map(([id, progress]) => [id, { ...progress, completedStages: 5 }])) },
        adventure: { ...pet.adventure, completed: { tutorial: 1 }, landmarks: mapRegions.flatMap(region => landmarkNodes.map(node => landmarkId(region, node))) },
        community: { ...pet.community, herbDiscovered: true }, kitchen: { ...pet.kitchen, equipment: ['pan', 'mix', 'blender', 'oven'] },
        inventory: { ...pet.inventory, golden_apple: 100, community_wood: 10, community_stone: 10, valley_mushroom: 8, creek_herb: 8, dish_mushroom_rice: 20, dish_herb_porridge: 20, creek_aquamarine: 3 } });
      assert.equal(state.museum.appearance.crown, true, 'existing legacy levels unlock their cosmetics');
      const startCoins = state.coins;
      state = reload(investMuseumHall(state, 'valley', 0, 1000, 0));
      assert.equal(investMuseumHall(state, 'valley', 0, 1000, 0), state, 'retrying a funding request does not charge twice');
      state = reload(withdrawMuseumHall(state, 'valley', 0));
      assert.equal(state.coins, startCoins);
      state = investMuseumHall(state, 'valley', 0, 6000, 0);
      const shortWood = { ...state, inventory: { ...state.inventory, community_wood: 9 } };
      assert.equal(completeMuseumHallStage(shortWood, 'valley', 0, now), shortWood, 'missing material leaves all funding and items intact');
      state = reload(completeMuseumHallStage(state, 'valley', 0, now));
      assert.equal(state.museum.halls.valley.stage, 1);
      assert.equal(completeMuseumHallStage(state, 'valley', 0, now), state);
      state = reload(acceptMuseumQuest(state, 'valley_record', now));
      const campaign = structuredClone(state.adventure.campaign);
      for (const visitId of ['valley_bridge', 'valley_greenhouse']) {
        const depart = p => startAdventure({ ...p, hunger: 100, energy: 100, health: 100, mood: 100 }, 'valley', 'official.furo', 'Furo', {}, false, now, museumVisits[visitId].destination, undefined, [], undefined, visitId);
        state = reload(depart(state));
        assert.equal(state.adventure.active.campaign, undefined);
        for (let step = 0; step < 2; step++) {
          const trip = state.adventure.active;
          state = reload(advanceMuseumVisit(state, trip.id, trip.revision, step, {}, now));
          assert.equal(state.adventure.active.museum.step, step + 1);
          assert.equal(advanceMuseumVisit(state, trip.id, trip.revision, step, {}, now), state);
          if (step === 0) {
            const shifted = shiftPetRuntimeTimestamps(state, -60000);
            assert.equal(shifted.adventure.active.museum.acceptedAt, shifted.museum.quests.valley_record.acceptedAt, 'clock rebasing preserves the visit identity');
            state = reload(returnFromAdventure(state, trip.id, now));
            assert.equal(state.adventure.pending.coins, 0);
            state = reload(claimAdventureResult(state, trip.id));
            state = reload(depart(state));
            assert.equal(state.adventure.active.museum.startStep, 1);
          }
        }
        const id = state.adventure.active.id;
        state = reload(returnFromAdventure(state, id, now));
        assert.equal(state.adventure.pending.museumVisit, visitId);
        assert.equal(state.adventure.pending.hearts, 0);
        state = reload(claimAdventureResult(state, id));
      }
      assert.ok(state.museum.quests.valley_record.completedAt);
      assert.deepEqual(state.adventure.campaign, campaign, 'museum visits cannot advance picnic tasks');
      for (const stage of [1, 2]) {
        const cost = getMuseumStageCost('valley', stage);
        state = reload(completeMuseumHallStage(investMuseumHall(state, 'valley', stage, cost.coins, 0), 'valley', stage, now));
        assert.equal(state.museum.halls.valley.stage, stage + 1);
      }
      assert.equal(state.coins, startCoins - 30000);
      assert.equal(state.inventory.golden_apple, 95);
      assert.equal(getMuseumExhibits(state.museum).length, 4);
      state = advanceMuseumWeek(state, now);
      const invitations = structuredClone(state.museum.board);
      assert.ok(invitations.themes.length > 0);
      assert.deepEqual(advanceMuseumWeek(reload(state), now).museum.board, invitations);
      state = beginMuseumCuration(state, 'valley');
      const solution = findMuseumSolution(state, 'valley');
      state = editMuseumCuration(state, state.museum.draft.id, state.museum.draft.revision, { ...solution, dishes: ['dish_mushroom_rice', 'dish_herb_porridge'], scale: 'standard' });
      const prepared = reload(state), { id, revision } = prepared.museum.draft;
      const noApples = { ...prepared, inventory: { ...prepared.inventory, golden_apple: 29 } };
      assert.equal(hostMuseumCuration(noApples, id, revision, 'official.furo', 'Furo', [], now), noApples, 'failed validation cannot partly consume coins or meals');
      state = reload(hostMuseumCuration(prepared, id, revision, 'official.furo', 'Furo', [{ modId: 'fixture.museum', name: '旧名字' }], now));
      assert.equal(state.coins, prepared.coins - 30000);
      assert.equal(state.inventory.golden_apple, prepared.inventory.golden_apple - 30);
      assert.equal(state.inventory.dish_mushroom_rice, prepared.inventory.dish_mushroom_rice - 4);
      assert.equal(state.museum.stars, 9);
      assert.equal(state.museum.weeklyPages, 1);
      assert.equal(state.museum.records[0].guestName, '旧名字');
      assert.equal(hostMuseumCuration(state, id, revision, 'official.furo', 'Furo', [], now), state);
      assert.deepEqual(reload(state).museum, state.museum);
      state = beginMuseumCuration(state, 'valley');
      const nextWeek = new Date(2026, 8, 28, 5).getTime(), draft = structuredClone(state.museum.draft);
      state = advanceMuseumWeek(state, nextWeek);
      assert.deepEqual(state.museum.draft, draft, 'drafts survive invitation changes');
      assert.deepEqual(advanceMuseumWeek(state, now).museum.board, state.museum.board, 'clock rollback cannot redraw invitations');
      state = hostMuseumCuration(state, draft.id, draft.revision, 'official.furo', 'Furo', [], now);
      assert.equal(state.museum.hosted, 2, 'a repeat theme is fully charged and recorded');
      assert.equal(state.museum.weeklyPages, 1, 'repeat exhibitions in the same week do not duplicate its memorial page');
      assert.equal(state.coins, prepared.coins - 42000);

      const currentWeek = getWeekStartDateKey(getDailyResetDateKey(now));
      const futureWeek = getWeekStartDateKey(getDailyResetDateKey(now + 365 * 86400000));
      const future = beginMuseumCuration({ ...state, museum: { ...state.museum,
        board: { ...state.museum.board, week: futureWeek }, lastHostedWeek: futureWeek,
      } }, 'valley');
      const corrected = reconcilePetClock(future, now);
      assert.equal(corrected.dailyDateRebased, true, 'future museum weeks trigger correction even when the global clock is already current');
      let rebased = reload(corrected.pet);
      assert.deepEqual(rebased.museum, { ...future.museum,
        board: { ...future.museum.board, week: currentWeek }, lastHostedWeek: currentWeek,
      }, 'clock correction preserves invitations, drafts and previously earned pages across reloads');
      rebased = hostMuseumCuration(rebased, rebased.museum.draft.id, rebased.museum.draft.revision, 'official.furo', 'Furo', [], now);
      assert.equal(rebased.museum.hosted, state.museum.hosted + 1);
      assert.equal(rebased.museum.weeklyPages, state.museum.weeklyPages, 'clock correction does not reopen the current weekly reward');
      rebased = beginMuseumCuration(advanceMuseumWeek(rebased, nextWeek), 'valley');
      assert.equal(rebased.museum.board.week, getWeekStartDateKey(getDailyResetDateKey(nextWeek)), 'invitations resume refreshing on the next week');
      rebased = hostMuseumCuration(rebased, rebased.museum.draft.id, rebased.museum.draft.revision, 'official.furo', 'Furo', [], nextWeek);
      assert.equal(rebased.museum.weeklyPages, state.museum.weeklyPages + 1, 'next week can earn a memorial page after clock correction');
    });

    await check('金苹果专用券与新机存档往返、支付失败及独立序列', async () => {
      const gacha = await import('../src/core/goldenAppleGacha.ts');
      const ready = { ...createDefaultPet(now), level: 20, hearts: 2000, coins: 50000 };
      for (const skill of Object.values(ready.partnerSchedule.skills)) skill.level = 6;
      ready.goldenAppleGacha.tickets = 12;
      ready.goldenAppleGacha.totalDraws = 1000;
      ready.goldenAppleGacha.jackpotPityMisses = 1000;
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const legacy = { ...ready, goldenAppleGacha: { ...ready.goldenAppleGacha, schemaVersion: 4, specialTickets: 99 } };
      assert.equal(reload(legacy).goldenAppleGacha.specialTickets, 0);
      assert.equal(gacha.drawGoldenAppleOnlyGacha(createDefaultPet(now), 'coins', 1, now).error, 'locked');
      const exchanged = gacha.exchangeHeartsForSpecialGachaTickets(ready, 10, now);
      assert.equal(exchanged.error, undefined);
      assert.equal(exchanged.pet.hearts, 1000);
      assert.equal(exchanged.pet.goldenAppleGacha.specialTickets, 10);
      assert.equal(exchanged.pet.goldenAppleGacha.specialTicketHeartsSpent, 1000);
      const paid = reload(exchanged.pet);
      assert.equal(paid.goldenAppleGacha.specialTickets, 10);
      const ticketDraw = gacha.drawGoldenAppleOnlyGacha(paid, 'specialTickets', 10, now);
      const coinDraw = gacha.drawGoldenAppleOnlyGacha(paid, 'coins', 10, now);
      assert.equal(ticketDraw.error, undefined);
      assert.equal(coinDraw.error, undefined);
      assert.deepEqual(ticketDraw.results, coinDraw.results, 'payment does not change the pool or random sequence');
      assert.equal(ticketDraw.pet.coins, paid.coins);
      assert.equal(ticketDraw.pet.goldenAppleGacha.specialTickets, 0);
      assert.equal(ticketDraw.pet.goldenAppleGacha.tickets, 12);
      assert.equal(coinDraw.pet.coins, paid.coins - 10000);
      assert.equal(coinDraw.pet.goldenAppleGacha.specialTickets, 10);
      assert.equal(coinDraw.pet.goldenAppleGacha.jackpotPityMisses, 1000, 'the old machine keeps its pity');
      let singles = paid;
      const singleResults = [];
      for (let index = 0; index < 10; index++) {
        const result = gacha.drawGoldenAppleOnlyGacha(reload(singles), 'coins', 1, now);
        assert.equal(result.error, undefined);
        singles = result.pet;
        singleResults.push(...result.results);
      }
      assert.deepEqual(singleResults, coinDraw.results, 'ten draws are exactly ten singles, including across reloads');
      assert.ok(coinDraw.results.every(result => !result.guaranteed && !result.pityGuaranteed));
      const restored = reload(ticketDraw.pet);
      for (const key of ['specialTickets', 'specialTicketHeartsSpent', 'goldenGachaTotalDraws', 'goldenGachaCoinsSpent', 'goldenGachaTicketsSpent', 'goldenGachaRngCounter', 'goldenGachaJackpotCount']) {
        assert.equal(restored.goldenAppleGacha[key], ticketDraw.pet.goldenAppleGacha[key], key);
      }
      assert.deepEqual(restored.goldenAppleGacha.recentGoldenResults, []);
      assert.equal(restored.hearts, ticketDraw.pet.hearts);
      assert.deepEqual(restored.inventory, ticketDraw.pet.inventory);
      for (const [state, payment, error] of [
        [{ ...ready, coins: 999 }, 'coins', 'not_enough_coins'],
        [ready, 'specialTickets', 'not_enough_special_tickets'],
        [ready, 'tickets', 'invalid_payment'],
      ]) {
        const failed = gacha.drawGoldenAppleOnlyGacha(state, payment, 1, now);
        assert.equal(failed.error, error);
        assert.equal(failed.pet, state);
      }
      const full = { ...paid, inventory: { ...paid.inventory, golden_apple: 9999 } };
      assert.ok(coinDraw.results.some(result => result.kind === 'item'));
      assert.equal(gacha.drawGoldenAppleOnlyGacha(full, 'coins', 10, now).pet, full, 'capacity failure leaves fees and sequence untouched');
      const poor = { ...ready, hearts: 99 };
      assert.equal(gacha.exchangeHeartsForSpecialGachaTickets(poor, 1, now).pet, poor);
      const fullTickets = { ...ready, goldenAppleGacha: { ...ready.goldenAppleGacha, specialTickets: 9999 } };
      assert.equal(gacha.exchangeHeartsForSpecialGachaTickets(fullTickets, 1, now).error, 'tickets_full');
      assert.equal(gacha.getSpecialGachaTicketExchangeLimit(fullTickets), 0);
      assert.equal(gacha.goldenAppleOnlyGachaRewards.reduce((sum, reward) => sum + reward.weight, 0), 100000);
      assert.equal(gacha.goldenAppleOnlyGachaRewards.reduce((sum, reward) => sum + reward.weight * reward.amount * (reward.kind === 'item' ? 100 : 1), 0) / 100000, 90);
      reset(createSaveFileText(paid, null, now));
      const before = storage.getItem(primary);
      storage.failWrite = primary;
      assert.throws(() => disk.savePet(ticketDraw.pet), /Injected write/);
      assert.equal(storage.getItem(primary), before, 'failed persistence retains the paid balance and next draw');
    });

    await check('邻居雇佣扣费、游戏日到期与存档恢复', async () => {
      const { hireFarmNeighbor, getFarmNeighborStatus } = await import('../src/core/farmNeighbor.ts');
      const { getDailyResetDateKey } = await import('../src/core/dailyReset.ts');
      const { reconcilePetClock } = await import('../src/core/gameClock.ts');
      const hiredAt = new Date(2026, 9, 5, 12).getTime();
      const initial = { ...createDefaultPet(hiredAt), hearts: 900 };
      const neighbors = [{ modId: 'fixture.neighbor', name: '小邻居' }];
      const hired = hireFarmNeighbor(initial, neighbors, hiredAt);
      assert.equal(hired.hearts, 300);
      assert.equal(hired.community.farmNeighbor.hiredDay, '2026-10-05');
      assert.equal(hired.community.farmNeighbor.expiresDay, '2026-10-12');
      assert.equal(getFarmNeighborStatus(hired, hiredAt).remainingDays, 7);
      assert.equal(hireFarmNeighbor(hired, neighbors, hiredAt), hired, 'double clicks cannot charge twice');
      const poor = { ...initial, hearts: 599 };
      assert.equal(hireFarmNeighbor(poor, neighbors, hiredAt), poor);
      const frozen = { ...initial, timePause: { schemaVersion: 1, pausedAt: hiredAt } };
      assert.equal(hireFarmNeighbor(frozen, neighbors, hiredAt), frozen);
      const stored = createSaveFileText(hired, null, hiredAt);
      const restored = parseSaveFileText(stored, hiredAt).pet;
      assert.deepEqual(restored.community.farmNeighbor, hired.community.farmNeighbor);
      assert.equal(restored.hearts, 300);
      assert.equal(restored.timeGuard.maxDailyDateKey, '2026-10-05', 'a future expiry is not a clock watermark');
      const nextDay = new Date(2026, 9, 6, 5).getTime();
      assert.equal(getFarmNeighborStatus(restored, nextDay - 1).remainingDays, 7);
      assert.equal(getFarmNeighborStatus(restored, nextDay).remainingDays, 6);
      const later = new Date(2026, 9, 8, 12).getTime();
      const imported = parseSaveFileText(stored, later).pet;
      assert.equal(getFarmNeighborStatus(imported, later).remainingDays, 4, 'importing does not renew the week');
      const loaded = loadStoredPetJson(stored, later, quiet);
      assert.equal(loaded.status, 'ok');
      assert.equal(getFarmNeighborStatus(loaded.pet, later).remainingDays, 4);
      const endsAt = new Date(2026, 9, 12, 5).getTime();
      assert.equal(getFarmNeighborStatus(restored, endsAt - 1).remainingDays, 1);
      assert.equal(getFarmNeighborStatus(restored, endsAt).active, false);
      const pausedHelp = { ...restored, timePause: { schemaVersion: 1, pausedAt: hiredAt } };
      const pausedRestored = parseSaveFileText(createSaveFileText(pausedHelp, null, hiredAt), endsAt).pet;
      assert.equal(getFarmNeighborStatus(pausedRestored, endsAt).active, false);
      assert.equal(getFarmNeighborStatus(clock.resumePetTime(pausedRestored, endsAt), endsAt).active, false);
      const rebased = reconcilePetClock({ ...imported, timeGuard: { ...imported.timeGuard, maxDailyDateKey: getDailyResetDateKey(later), lastObservedAt: later } }, hiredAt).pet;
      assert.equal(getFarmNeighborStatus(rebased, hiredAt).remainingDays, 4, 'clock correction preserves only unused days');
      const expired = normalizePet(hired, endsAt);
      assert.equal(getFarmNeighborStatus(reconcilePetClock({ ...expired, timeGuard: { ...expired.timeGuard, lastObservedAt: endsAt } }, hiredAt).pet, hiredAt).active, false);
      const renewed = hireFarmNeighbor({ ...expired, hearts: 600 }, neighbors, endsAt);
      assert.equal(renewed.hearts, 0);
      assert.equal(renewed.community.farmNeighbor.expiresDay, '2026-10-19');
      const legacy = { ...initial, community: { ...initial.community, schemaVersion: 14 } };
      assert.equal(parseSaveFileText(createSaveFileText(legacy, null, hiredAt), hiredAt).pet.community.farmNeighbor, undefined);
      for (const bad of [{ hiredDay: '2026-02-30', expiresDay: '2026-03-09' }, { ...hired.community.farmNeighbor, expiresDay: '2027-10-12' }]) {
        assert.equal(normalizePet({ ...initial, community: { ...initial.community, farmNeighbor: bad } }, hiredAt).community.farmNeighbor, undefined);
      }
    });

    await check('邻居代劳收获回执随存档保存且不重复结算', async () => {
      const { hireFarmNeighbor } = await import('../src/core/farmNeighbor.ts');
      const { plantCommunityCrops, harvestCommunityCrops, harvestCommunityCrop } = await import('../src/core/community.ts');
      const { careCommunityAnimal, collectCommunityAnimal } = await import('../src/core/communityFarm.ts');
      const { inventoryItemLimit } = await import('../src/core/saveMetadata.ts');
      const { listCommunityGoods } = await import('../src/core/communityMarket.ts');
      const { processFood } = await import('../src/core/foodProcessing.ts');
      const neighbors = [{ modId: 'fixture.neighbor', name: '小邻居' }, { modId: 'fixture.other', name: '另一位邻居' }];
      const initial = structuredClone(pet);
      initial.hearts = 900; initial.isSleeping = true; initial.energy = 0;
      initial.community.gardenBuilt = true; initial.community.upgrades.garden = 2;
      initial.community.plots = [{ id: 1 }, { id: 2 }]; initial.inventory.carrot_seed = 2;
      initial.community.facilities.coop = { found: true, built: true, work: 2 };
      initial.community.animals.coop = { feed: 1, stock: 2, cycleMs: 21600000, nextAt: now + 21600000, cared: false, revision: 0 };
      initial.community.ranchCompostCycles = 4;
      const hired = hireFarmNeighbor(initial, neighbors, now);
      const planted = plantCommunityCrops(hired, [{ plotId: 1, cropId: 'carrot' }, { plotId: 2, cropId: 'carrot' }], now, neighbors);
      assert.equal(planted.community.farmNeighbor.sequence, 1, 'a whole batch records one helper');
      assert.equal(planted.inventory.carrot_seed ?? 0, 0);
      const cared = careCommunityAnimal(planted, 'coop', 0, now, neighbors);
      assert.equal(cared.energy, 0); assert.equal(cared.isSleeping, true);
      assert.equal(cared.community.animals.coop.cared, true);
      assert.equal(cared.community.farmNeighbor.sequence, 2);
      const collected = collectCommunityAnimal(cared, 'coop', 1, now, neighbors);
      assert.equal(collected.community.farmNeighbor.sequence, 3, 'automatic compost shares the collection receipt');
      assert.equal(collected.inventory.nutrient_compost, (cared.inventory.nutrient_compost ?? 0) + 1);
      const saved = parseSaveFileText(createSaveFileText(collected, null, now), now).pet;
      assert.deepEqual(saved.community.farmNeighbor, collected.community.farmNeighbor);
      assert.equal(collectCommunityAnimal(saved, 'coop', 1, now, neighbors).hearts, saved.hearts);
      assert.equal(collectCommunityAnimal(saved, 'coop', 1, now, neighbors).community.farmNeighbor.sequence, 3);
      const matureAt = planted.community.plots[0].crop.readyAt;
      const plots = saved.community.plots.map(plot => ({ id: plot.id, plantedAt: plot.crop.plantedAt }));
      const full = { ...saved, inventory: { ...saved.inventory, carrot: inventoryItemLimit } };
      assert.equal(harvestCommunityCrop(full, 1, plots[0].plantedAt, matureAt, false, neighbors).community.farmNeighbor.sequence, 3);
      const harvest = harvestCommunityCrops(saved, plots, matureAt, neighbors);
      assert.equal(harvest.hearts, saved.hearts + 8);
      assert.equal(harvest.community.farmNeighbor.sequence, 4);
      const helperName = neighbors.find(n => n.modId === harvest.community.farmNeighbor.neighbor.modId).name;
      assert.ok(harvest.recentEvent.startsWith(helperName + '帮忙收获。'));
      const reloaded = parseSaveFileText(createSaveFileText(harvest, null, matureAt), matureAt).pet;
      const duplicate = harvestCommunityCrops(reloaded, plots, matureAt, neighbors);
      assert.equal(duplicate.hearts, reloaded.hearts);
      assert.deepEqual(duplicate.community.farmNeighbor, reloaded.community.farmNeighbor);
      const paused = { ...saved, timePause: { schemaVersion: 1, pausedAt: now } };
      assert.equal(harvestCommunityCrops(paused, plots, matureAt, neighbors), paused);
      const stocked = { ...saved, inventory: { ...saved.inventory, wheat: 2 }, community: { ...saved.community, market: { ...saved.community.market, level: 1 } } };
      assert.equal(processFood(stocked, 'wheat_feed', 1, stocked.community.processing.revision, now), stocked, 'help does not unlock processing');
      assert.equal(listCommunityGoods(stocked, 'wheat', 1, stocked.community.market.nextListingId, now).community.market.listings.length, 0, 'the duty portrait does not unlock stocking');
    });

    await check('忙碌果园操作不消耗存档资源，成熟待领果实可恢复', async () => {
      const { advanceGarden, clearWitheredTree, harvestTree, plantTree, unlockGardenSlot } = await import('../src/core/garden.ts');
      const initial = unlockGardenSlot({ ...pet, inventory: { ...pet.inventory, fruit_tree_sapling: 1 } }, 0, now);
      const sleeping = { ...initial, isSleeping: true };
      assert.equal(plantTree(sleeping, 0, 'fruit_tree', now), sleeping);
      const focusing = { ...initial, pomodoro: { ...initial.pomodoro, isRunning: true } };
      assert.equal(plantTree(focusing, 0, 'fruit_tree', now), focusing);
      const planted = plantTree(initial, 0, 'fruit_tree', now);
      assert.equal(planted.garden.slots[0].treeId, 'fruit_tree');
      const readyAt = planted.garden.slots[0].nextReadyAt;
      const ready = advanceGarden({ ...planted, isSleeping: true }, readyAt);
      assert.equal(ready.garden.slots[0].state, 'ready', 'busy companions do not stop passive growth');
      const restored = parseSaveFileText(createSaveFileText(ready, null, readyAt), readyAt).pet;
      assert.deepEqual(restored.garden.slots[0].pendingDrops, ready.garden.slots[0].pendingDrops);
      assert.equal(harvestTree(restored, 0, readyAt), restored);
      assert.equal(clearWitheredTree(restored, 0, readyAt), restored);
      const harvested = harvestTree({ ...restored, isSleeping: false }, 0, readyAt);
      assert.equal(harvested.garden.lifetimeHarvestCount, restored.garden.lifetimeHarvestCount + 1);
      assert.equal(harvested.hearts, restored.hearts + 10);
      const claimed = parseSaveFileText(createSaveFileText(harvested, null, readyAt), readyAt).pet;
      assert.equal(harvestTree(claimed, 0, readyAt).hearts, claimed.hearts);
      const { hireFarmNeighbor } = await import('../src/core/farmNeighbor.ts');
      const neighbors = [{ modId: 'fixture.neighbor', name: '小邻居' }];
      const helped = hireFarmNeighbor({ ...restored, hearts: 900 }, neighbors, readyAt);
      assert.equal(clearWitheredTree(helped, 0, readyAt), helped, 'tree removal still needs the companion');
      assert.equal(unlockGardenSlot(helped, 1, readyAt), helped);
      const picked = harvestTree(helped, 0, readyAt, neighbors);
      assert.equal(picked.hearts, 310);
      assert.equal(picked.community.farmNeighbor.sequence, 1);
      const pickedSave = parseSaveFileText(createSaveFileText(picked, null, readyAt), readyAt).pet;
      assert.deepEqual(pickedSave.community.farmNeighbor, picked.community.farmNeighbor);
      assert.equal(harvestTree(pickedSave, 0, readyAt, neighbors).community.farmNeighbor.sequence, 1);
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
        { ...envelope, pet: { ...envelope.pet, adventure: { ...envelope.pet.adventure, pending: { rulesVersion: 999 } } } },
        { ...envelope, pet: { ...envelope.pet, community: { ...envelope.pet.community, expedition: { pending: { rulesVersion: 999 } } } } },
        { ...envelope, pet: { ...envelope.pet, community: { ...envelope.pet.community, expedition: { loop: { version: 999 } } } } },
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

    await check('行程随机种子、规则版本、分享奖励及冻结时间保存', async () => {
      const { startAdventure, advanceAdventure, returnFromAdventure } = await import('../src/core/adventure.ts');
      const { getLandmarkSteps } = await import('../src/core/landmarkData.ts');
      const { getPetStatCap, getPetEnergyCap } = await import('../src/core/petStats.ts');
      const reload = state => parseSaveFileText(createSaveFileText(state, null, now), now).pet;
      const ready = { ...pet, adventure: { ...pet.adventure, completed: { tutorial: 1 } } };
      const adventure = startAdventure(ready, 'valley', 'official.furo', 'Furo', {}, false, now);
      for (const [started, tripOf] of [[adventure, p => p.adventure.active]]) {
        const trip = tripOf(started);
        assert.ok(trip?.checkState, 'real trip must start with saved check state');
        const restored = tripOf(parseSaveFileText(createSaveFileText(started, null, now), now).pet);
        for (const key of ['id', 'rulesVersion', 'revision', 'bag', 'checkState']) assert.deepEqual(restored[key], trip[key], key);
      }
      let sharing = adventure;
      const steps = getLandmarkSteps(sharing.adventure.active.purpose, sharing.adventure.active.rulesVersion);
      const fuel = state => ({ ...state, hunger: getPetStatCap(state), energy: getPetEnergyCap(state), health: getPetStatCap(state) });
      for (const step of steps.slice(0, -1)) {
        const trip = sharing.adventure.active;
        sharing = advanceAdventure(fuel(sharing), trip.id, trip.choices.length, step.choices[0].id, now, trip.revision);
      }
      sharing = reload(fuel({ ...sharing, mood: getPetStatCap(sharing) - 10 }));
      const trip = sharing.adventure.active, skillBefore = { ...sharing.partnerSchedule.skills.study };
      assert.equal(trip.choices.length, steps.length - 1);
      const shared = advanceAdventure(sharing, trip.id, trip.choices.length, 'observe:finish', now, trip.revision);
      assert.equal(shared.partnerSchedule.skills.study.xp, skillBefore.xp + 1);
      assert.equal(shared.mood, sharing.mood + 5);
      assert.equal(shared.health, sharing.health);
      const sharedReloaded = reload(shared);
      assert.deepEqual(sharedReloaded.partnerSchedule.skills.study, shared.partnerSchedule.skills.study);
      assert.equal(sharedReloaded.adventure.active.checkState.last.xp, 1);
      assert.equal(sharedReloaded.adventure.active.checkState.last.moodChange, 5);
      assert.deepEqual(advanceAdventure(sharedReloaded, trip.id, trip.choices.length, 'observe:finish', now, trip.revision), sharedReloaded, 'retrying a saved ending cannot grant sharing rewards twice');
      const returned = reload(returnFromAdventure(sharedReloaded, trip.id, now));
      assert.equal(returned.adventure.pending.rulesVersion, 12);
      assert.equal(returned.adventure.pending.lastCheck.xp, 1);
      assert.deepEqual(returned.partnerSchedule.skills.study, shared.partnerSchedule.skills.study);
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
        const minigames = await server.ssrLoadModule('/src/minigames/index.tsx');
        assert.equal(typeof minigames.MiniGamesHub, 'function');
        assert.equal(typeof minigames.mountMiniGames, 'function');
        assert.deepEqual(minigames.miniGameRegistry.map(game => game.id), ['blocks', 'water', 'fruit', 'match3']);
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
  const expected = releaseArtifactNames(json('package.json').version).sort();
  assert.deepEqual(readdirSync(values.artifacts).sort(), expected, 'Release artifact set mismatch');
  for (const file of expected) assert.ok(statSync(join(values.artifacts, file)).size > 0, `Empty artifact: ${file}`);
  console.log(`Verified ${expected.length} release artifacts.`);
} else if (values.release) {
  await verifyRelease();
} else {
  assert.ok(!values.dist && !values.binary && !values.arch, 'Release options require --release.');
  await verifySavesAndErrors();
}
