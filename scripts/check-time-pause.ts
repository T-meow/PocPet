import assert from 'node:assert/strict';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { advancePet } from '../src/core/petLifecycle';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { plantCommunityCrop } from '../src/core/community';
import { feedCommunityAnimal } from '../src/core/communityFarm';
import { startCommunityFishing } from '../src/core/communityFishing';
import { listCommunityGoods, setCommunityMarketOpen } from '../src/core/communityMarket';
import { getMarketVisit } from '../src/core/communityMarketRules';
import { startPartnerSchedule } from '../src/core/partnerSchedule';
import { startPomodoro, applyPetAction } from '../src/core/petActions';
import { actMiniGame, startMiniGame } from '../src/core/miniGames';
import { startAdventure } from '../src/core/adventure';
import { commitTimePauseAfterBackup } from '../src/ui/app/timePauseTransaction';
import { updatePetSession } from '../src/ui/app/petSessionFeedback';
import { saveTimePauseBackup, verifyTimePauseBackup } from '../src/platform/timePauseBackup';
import { cloudSaveActiveKey, restoreCloudSave, uploadCloudSave } from '../src/core/cloudSave';
import type { PetState } from '../src/core/petTypes';
import type { ToyCloudStorage } from '../src/platform/toySdk';
import { loadPet, savePet } from '../src/core/storage';

const T = new Date(2026, 8, 19, 12).getTime(), M = 60_000, H = 60 * M, D = 24 * H;
const originalNow = Date.now, originalRandom = Math.random;
Date.now = () => T;
Math.random = () => .999;
const quiet = { neighbors: [], giftCandidates: [], random: () => .999 };
const stats = (pet: PetState) => [pet.hunger, pet.mood, pet.cleanliness, pet.energy, pet.health, pet.ageSeconds];
const stock = (pet: PetState) => [pet.coins, pet.hearts, pet.inventory];
const read = (text: string, now: number) => {
  const result = loadStoredPetJson(text, now, quiet);
  assert.equal(result.status, 'ok', result.status === 'corrupt' ? result.detail : '');
  if (result.status !== 'ok') throw new Error('Load failed');
  return result.pet;
};

try {
  let farm = plantCommunityCrop(createCommunityTestPet('commissions', T), 1, 'carrot', T);
  farm = feedCommunityAnimal(farm, 'coop', 0, 2, T);
  farm.community.market.seed = Array.from({ length: 1000 }, (_, index) => index + 1).find(seed => {
    const visit = getMarketVisit(seed, 0);
    return visit.delayMs > 10 * M && visit.customer === 'ordinary' && visit.quantity === 1;
  })!;
  farm = listCommunityGoods(farm, 'egg', 2, 1, T);
  farm = setCommunityMarketOpen(farm, true, T);
  farm.garden.slots[0] = { ...farm.garden.slots[0], unlocked: true, treeId: 'fruit_tree', state: 'growing', plantedAt: T, naturalReadyAt: T + 12 * H, nextReadyAt: T + 12 * H, maxHarvests: 8 };
  farm.boostCards.friendPassExpiresAt = T + 2 * D;
  const at = T + 10 * M, later = at + 30 * D;
  const frozen = prepareTimePause(farm, at, quiet);
  assert.equal(frozen.ageSeconds, 600, 'settle the time before freezing once');
  assert.equal(prepareTimePause(frozen, later), frozen, 'repeat freeze does not move the anchor');
  const external = createSaveFileText(frozen, null, at);
  for (const restored of [advancePet(frozen, later, quiet), normalizePet(frozen, later), read(external, later), parseSaveFileText(external, later).pet,
    read(createSaveFileText(frozen, null, later), later + 300 * D)]) {
    assert.deepEqual(stats(restored), stats(frozen), 'long offline/load/import/export retains stats and age');
    assert.deepEqual(stock(restored), stock(frozen), 'no offline coins, items or hearts');
    assert.deepEqual(restored.community, frozen.community);
    assert.equal(restored.timePause?.pausedAt, at);
    assert.equal(restored.garden.slots[0].nextReadyAt, frozen.garden.slots[0].nextReadyAt);
    assert.equal(restored.boostCards.friendPassExpiresAt, T + 2 * D);
  }
  const resumed = resumePetTime(read(external, later), later);
  assert(!resumed.timePause);
  assert.deepEqual(stats(resumed), stats(frozen));
  assert.deepEqual(stock(resumed), stock(frozen));
  assert.equal(resumed.lastUpdatedAt, later);
  assert.equal(resumed.timeGuard.lastObservedAt, later);
  assert.deepEqual(resumed.metDate, frozen.metDate, 'calendar anniversaries are not shifted');
  assert.equal(resumed.createdAt, frozen.createdAt);
  for (const [deadline, oldDeadline] of [
    [resumed.community.plots[0].crop!.readyAt, frozen.community.plots[0].crop!.readyAt],
    [resumed.community.animals.coop.nextAt!, frozen.community.animals.coop.nextAt!],
    [resumed.community.market.nextVisitAt!, frozen.community.market.nextVisitAt!],
    [resumed.garden.slots[0].nextReadyAt, frozen.garden.slots[0].nextReadyAt],
    [resumed.boostCards.friendPassExpiresAt, frozen.boostCards.friendPassExpiresAt],
  ]) assert.equal(deadline - later, oldDeadline - at, 'remaining time is preserved');
  assert.equal(advancePet(resumed, later + 5 * M, quiet).ageSeconds, 900);
  const nextVisitorAt = resumed.community.market.nextVisitAt!;
  assert.equal(advancePet(resumed, nextVisitorAt - 1, quiet).community.market.sold, 0);
  assert.equal(advancePet(resumed, nextVisitorAt, quiet).community.market.sold, 2, 'first visitor keeps the remaining random wait and buys the two available basics');
  assert.equal(resumed.community.market.seed, frozen.community.market.seed);
  assert.equal(resumed.community.market.visitors, frozen.community.market.visitors);
  assert.equal(advancePet(resumed, resumed.community.animals.coop.nextAt! - 1, quiet).community.animals.coop.stock, 0);
  assert.equal(advancePet(resumed, resumed.community.animals.coop.nextAt!, quiet).community.animals.coop.stock, 2);
  assert.equal(resumePetTime(resumed, later + D), resumed, 'duplicate resume never shifts twice');
  const again = prepareTimePause(resumed, later, quiet);
  assert.equal(resumePetTime(again, later + D).community.plots[0].crop!.readyAt, resumed.community.plots[0].crop!.readyAt + D);
  const backward = resumePetTime(frozen, T - H);
  assert.equal(backward.community.plots[0].crop!.readyAt - (T - H), frozen.community.plots[0].crop!.readyAt - at);
  assert.deepEqual(stats(backward), stats(frozen));

  const worker = createDefaultPet(T);
  const working = startPartnerSchedule(worker, worker.partnerSchedule.offers[0].id, T);
  assert(working.partnerSchedule.active);
  const workFreeze = prepareTimePause(working, T + 5 * M, quiet);
  const workResume = resumePetTime(read(createSaveFileText(workFreeze, null, T + 5 * M), later), later);
  const ends = workResume.partnerSchedule.active!.endsAt;
  assert.equal(ends - later, working.partnerSchedule.active.endsAt - (T + 5 * M));
  assert(advancePet(workResume, ends - 1, quiet).partnerSchedule.active);
  const done = advancePet(workResume, ends, quiet);
  const control = advancePet(working, working.partnerSchedule.active.endsAt, quiet);
  assert(done.partnerSchedule.pendingResult && !done.partnerSchedule.active);
  assert.deepEqual(stats(done).slice(0, 5), stats(control).slice(0, 5), 'work costs exclude frozen time');
  assert.equal(done.partnerSchedule.pendingResult.coinReward, control.partnerSchedule.pendingResult!.coinReward);

  const focus = startPomodoro(createDefaultPet(T), T);
  assert(focus.pomodoro.isRunning);
  const focusFreeze = prepareTimePause(focus, T + 5 * M, quiet);
  const focusResume = resumePetTime(parseSaveFileText(createSaveFileText(focusFreeze, null, T + 5 * M), later).pet, later);
  assert(focusResume.pomodoro.isRunning, 'import does not stop a globally frozen focus session');
  assert.equal(focusResume.pomodoro.phaseEndsAt - later, focusFreeze.pomodoro.phaseEndsAt - (T + 5 * M));
  assert.equal(focusResume.pomodoro.completedFocusCount, focusFreeze.pomodoro.completedFocusCount);
  assert.deepEqual(stock(focusResume), stock(focusFreeze));

  const asleep = applyPetAction({ ...createDefaultPet(T), energy: 20 }, 'sleep', T);
  const sleepFreeze = prepareTimePause(asleep, T + 5 * M, quiet);
  const sleepResume = resumePetTime(read(createSaveFileText(sleepFreeze, null, T + 5 * M), later), later);
  assert(sleepResume.isSleeping);
  assert.deepEqual(stats(sleepResume), stats(sleepFreeze));
  assert.equal(later - sleepResume.sleepStartedAt, 5 * M);

  for (const scenario of ['idle', 'long-trip'] as const) {
    const pet = createCommunityTestPet(scenario, T);
    const f = prepareTimePause(pet, T + (scenario === 'idle' ? H + 5 * M : 0), quiet);
    const loaded = read(createSaveFileText(f, null, T + 2 * H), later);
    assert.deepEqual(loaded.community.expedition, { ...f.community.expedition,
      active: { ...f.community.expedition.active!, journal: [] },
    }, 'frozen expedition progress survives without the unused display log');
    const r = resumePetTime(loaded, later), trip = r.community.expedition.active!;
    assert.equal(trip.paused, f.community.expedition.active!.paused, 'camp pauses stay paused');
    assert.equal(trip.endsAt - later, f.community.expedition.active!.endsAt - f.timePause!.pausedAt);
    if (scenario === 'idle') {
      assert.equal(trip.settledParts, 1);
      assert.equal(advancePet(r, trip.endsAt, quiet).community.expedition.pending?.reason, 'complete');
    }
  }
  const adventure = startAdventure(createCommunityTestPet('commissions', T), 'valley', 'test.furo', 'Furo', {}, false, T);
  const tripFreeze = prepareTimePause(adventure, T, quiet);
  const tripResume = resumePetTime(read(createSaveFileText(tripFreeze, null, T), later), later);
  assert.equal(tripResume.adventure.active?.startedAt, later);
  assert.deepEqual(tripResume.adventure.active?.choices, tripFreeze.adventure.active?.choices);

  for (const reeling of [false, true]) {
    const fish = startCommunityFishing(createCommunityTestPet('commissions', T), 'pond', 'fishing_bait', false, T);
    assert(fish.community.fishing.active);
    if (reeling) fish.community.fishing.active = { ...fish.community.fishing.active, phase: 'reeling', progress: 25, tension: 30, biteAt: T, expiresAt: T + 25_000 };
    const f = prepareTimePause(fish, T, quiet);
    const r = resumePetTime(parseSaveFileText(createSaveFileText(f, null, T), later).pet, later);
    assert(r.community.fishing.active, 'fishing is not discarded by timestamp rebasing');
    assert.equal(r.community.fishing.active.biteAt - later, f.community.fishing.active!.biteAt - T);
    assert.equal(r.community.fishing.active.expiresAt - later, f.community.fishing.active!.expiresAt - T);
    assert.equal(r.community.fishing.active.progress, f.community.fishing.active!.progress);
    assert.deepEqual(r.inventory, f.inventory, 'bait is neither refunded nor consumed twice');
  }
  let game = startMiniGame({ ...createDefaultPet(T), level: 4, inventory: { toy_ball: 1 } }, 'catch', 'normal', 'test.furo', 'freeze-catch', T);
  game = actMiniGame(game, game.miniGames.active!.id, { type: 'throw', targetX: .5 }, T);
  const gameFreeze = prepareTimePause(game, T + 100, quiet);
  const gameResume = resumePetTime(read(createSaveFileText(gameFreeze, null, T + 100), later), later);
  assert(!gameResume.miniGames.active!.paused);
  assert.equal(gameResume.miniGames.active!.throwAt - later, gameFreeze.miniGames.active!.throwAt - (T + 100));
  assert.equal(gameResume.miniGames.active!.elapsedMs, gameFreeze.miniGames.active!.elapsedMs);

  const session = { pet: frozen, feedback: [] };
  let staleRan = false;
  assert.equal(updatePetSession(session, () => { staleRan = true; return farm; }, 'event', 1), session);
  assert(!staleRan, 'stale UI/timer callbacks never execute while frozen');
  let commits = 0;
  const commit = (pet: PetState) => { commits++; return pet; };
  assert.equal(await commitTimePauseAfterBackup(frozen, async () => false, () => true, commit), false);
  await assert.rejects(commitTimePauseAfterBackup(frozen, async () => { throw new Error('backup failed'); }, () => true, commit), /backup failed/);
  await assert.rejects(commitTimePauseAfterBackup(frozen, async () => true, () => false, commit), /发生变化/);
  assert.equal(commits, 0, 'cancel/failure/concurrent change never commit a freeze');
  await assert.rejects(commitTimePauseAfterBackup(frozen, async () => true, () => true, () => undefined), /本机存档写入失败/);
  assert.equal(await commitTimePauseAfterBackup(frozen, async (snapshot) => { assert.equal(snapshot, frozen); assert.equal(commits, 0); return true; }, () => true, commit), true);
  assert.equal(commits, 1, 'backup verification always precedes local freeze');
  verifyTimePauseBackup(external, external);
  assert.throws(() => verifyTimePauseBackup(createSaveFileText(farm, null, at), external), /不一致/);

  let fileText = '';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { showSaveFilePicker: async () => ({
    createWritable: async () => ({ write: async (text: string) => { fileText = text; }, close: async () => {}, abort: async () => {} }),
    getFile: async () => ({ text: async () => fileText }),
  }) } });
  assert.equal(await saveTimePauseBackup('freeze.pocpet', external), 'verified');
  (window as any).showSaveFilePicker = async () => { throw new DOMException('cancel', 'AbortError'); };
  assert.equal(await saveTimePauseBackup('freeze.pocpet', external), 'cancelled');
  (window as any).showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {}, abort: async () => {} }), getFile: async () => ({ text: async () => 'damaged' }) });
  await assert.rejects(saveTimePauseBackup('freeze.pocpet', external), /不一致/);
  Reflect.deleteProperty(globalThis, 'window');

  // Exercise the real local persistence path using isolated memory storage.
  class LocalStorage {
    data = new Map<string, string>();
    fail = false;
    get length() { return this.data.size; }
    key(index: number) { return [...this.data.keys()][index] ?? null; }
    getItem(key: string) { return this.data.get(key) ?? null; }
    setItem(key: string, value: string) { if (this.fail && key === 'pocpet.pet.v1') throw new Error('disk full'); this.data.set(key, value); }
    removeItem(key: string) { this.data.delete(key); }
  }
  const local = new LocalStorage();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: local } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  loadPet(T);
  savePet(frozen);
  const frozenRaw = local.getItem('pocpet.pet.v1')!;
  local.fail = true;
  assert.throws(() => savePet(resumed), /disk full/);
  assert.equal(local.getItem('pocpet.pet.v1'), frozenRaw, 'failed thaw keeps the durable frozen save intact');
  assert.equal(read(frozenRaw, later).timePause?.pausedAt, at);
  local.fail = false;
  savePet(resumed);
  assert(!read(local.getItem('pocpet.pet.v1')!, later).timePause);
  const runningRaw = local.getItem('pocpet.pet.v1');
  local.fail = true;
  assert.throws(() => savePet(again), /disk full/);
  assert.equal(local.getItem('pocpet.pet.v1'), runningRaw, 'failed freeze preserves the previous valid save');
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');

  class Cloud implements ToyCloudStorage {
    data = new Map<string, string>();
    dropActivation = false;
    async getCloudStorage(keys = [...this.data.keys()]) { return Object.fromEntries(keys.filter(key => this.data.has(key)).map(key => [key, this.data.get(key)!])); }
    async setCloudStorage(values: Record<string, string>) { for (const [key, value] of Object.entries(values)) if (!this.dropActivation || key !== cloudSaveActiveKey) this.data.set(key, value); }
    async removeCloudStorage(keys: string[]) { for (const key of keys) this.data.delete(key); }
  }
  const cloud = new Cloud();
  await uploadCloudSave(cloud, frozen, null, at);
  const restoredCloud = await restoreCloudSave(cloud, later);
  assert.equal(restoredCloud.imported.pet.timePause?.pausedAt, at);
  assert.deepEqual(stats(restoredCloud.imported.pet), stats(frozen));
  const failedCloud = new Cloud(); failedCloud.dropActivation = true;
  await assert.rejects(uploadCloudSave(failedCloud, frozen, null, at), /activation failed/);

  for (const marker of [null, {}, { schemaVersion: 1, pausedAt: 'bad' }, { schemaVersion: 1, pausedAt: -1 }]) {
    const data = JSON.parse(external); data.pet.timePause = marker;
    assert.equal(loadStoredPetJson(JSON.stringify(data), later).status, 'corrupt', 'damaged freeze markers cannot silently thaw');
  }
  const future = JSON.parse(external); future.pet.timePause.schemaVersion = 2;
  assert.throws(() => parseSaveFileText(JSON.stringify(future), later), UnsupportedSaveVersionError);
  const legacy = read(createSaveFileText(createDefaultPet(T), null, T), T + M);
  assert(!legacy.timePause); assert.equal(legacy.ageSeconds, 60, 'old saves continue their normal offline settlement');
  console.log('Time freeze passed: all runtime timers, 330-day offline/load/import/cloud, remaining durations, repeated/rollback transitions, stale callbacks, verified backup ordering and failure recovery.');
} finally { Date.now = originalNow; Math.random = originalRandom; }

const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { TimePauseDialog, TimePauseMask } = await server.ssrLoadModule('/src/ui/TimePause.tsx');
  const noop = () => {};
  const pet = prepareTimePause(createDefaultPet(T), T);
  const mask = renderToStaticMarkup(createElement(TimePauseMask, { pet, portrait: 'pet.svg', onResume: noop, persistenceError: '', onRetry: noop }));
  assert(mask.includes('aria-modal="true"') && mask.includes('解冻，继续陪伴') && mask.includes('time-pause-backdrop'));
  assert(!mask.includes('取消冻结') && !mask.includes('NaN'));
  const failed = renderToStaticMarkup(createElement(TimePauseMask, { pet, portrait: 'pet.svg', onResume: noop, persistenceError: 'saveError', onRetry: noop }));
  assert(failed.includes('disabled=""') && failed.includes('重试保存'));
  const dialog = renderToStaticMarkup(createElement(TimePauseDialog, { freezeTime: async () => false, onClose: noop }));
  assert(dialog.includes('保存本地备份并冻结') && dialog.includes('先保存并验证'));
  console.log('Freeze mask and backup dialog rendering passed. Visual/touch acceptance remains manual.');
} finally { await server.close(); }
