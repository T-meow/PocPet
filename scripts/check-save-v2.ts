import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultPet, normalizePet, buyItem, getItemPurchaseQuote, useInventoryItem, drawGoldenAppleGacha, drawGoldenAppleHeartGacha, startPartnerSchedule, advancePartnerSchedule, claimPartnerScheduleResult, type PetState } from '../src/core/pet';
import { createSaveFileText, decodeSaveSnapshot, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import { loadPet, savePet, replacePetFromImport, takeStorageFeedback, formatBackupStoragePrefix, migrationLedgerStorageKey, getStoredRecoveryCopies } from '../src/core/storage';
import { migrationCompensationRewardId } from '../src/core/saveMetadata';
import { claimCommunityWorkGift, communityWorkGiftRewardId, communityWorkGiftTickets, isCommunityWorkGiftAvailable } from '../src/core/communityWorkGift';
import { getPetPreferences } from '../src/core/petPreferences';
import { actMiniGame, startMiniGame, resumeMiniGame, acknowledgeMiniGameResult } from '../src/core/miniGames';
import { harvestTree } from '../src/core/garden';
import { craftRecipe } from '../src/core/kitchen';
import { createItemRegistry, getShopDefinitions, getShopItem } from '../src/core/items';
import { filterBrowseItems } from '../src/ui/itemBrowse';
import { selectNeighborGift } from '../src/core/neighborGifts';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { startPomodoro } from '../src/core/petActions';
import { advancePet } from '../src/core/petLifecycle';
import './check-save-compaction';

// This suite has no browser, disk writes, or real player/cloud storage.
class MemoryStorage {
  readonly values = new Map<string, string>();
  writes = 0;
  failKey?: string;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failKey === key) { this.failKey = undefined; throw new Error('Injected write failure'); }
    this.writes++; this.values.set(key, value);
  }
  removeItem(key: string) { this.writes++; this.values.delete(key); }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
const now = new Date(2026, 8, 12, 12).getTime();
Date.now = () => now;
const quiet = { neighbors: [], giftCandidates: [], random: () => 0 };
const primaryKey = 'pocpet.pet.v1';
const fresh = createDefaultPet(now);
const rich = normalizePet({ ...fresh, level: 25, coins: 100000, hearts: 5000, hunger: 200, mood: 200, energy: 100, health: 200, cleanliness: 200, inventory: { emergency_biscuit: 3, strawberry_milk: 4, golden_apple: 100, toy_ball: 2, 'mod.snack': 17 }, hasOpenedHelp: true, suppressGoldenAppleUseConfirm: true, kitchen: { ...fresh.kitchen, plating: 'stars' }, miniGames: { ...fresh.miniGames, style: 'night' }, garden: { ...fresh.garden, activeSlotIndex: 4 } }, now);
const readLocal = (text: string, at = now) => {
  const result = loadStoredPetJson(text, at, quiet);
  assert.equal(result.status, 'ok', result.status === 'corrupt' ? result.detail : undefined);
  if (result.status !== 'ok') throw new Error('Invalid test snapshot');
  return result.pet;
};
const loadCurrent = () => {
  const result = loadPet(now, quiet);
  assert.ok(result.status === 'ok' && !result.persistenceError);
  if (result.status !== 'ok') throw new Error('Local load failed');
  return result.pet;
};
const resetStorage = () => { storage.values.clear(); loadPet(now, quiet); takeStorageFeedback(); };

// Satiety survives exports and reloads, while old saves need no new field.
const fedPet = useInventoryItem({ ...fresh, hunger: 70, inventory: { bento: 5 } }, 'bento', now);
const fedText = createSaveFileText(fedPet, null, now);
assert.equal(readLocal(fedText).isOverfed, true);
const fedReload = readLocal(fedText, now + 1000);
assert.equal(fedReload.isOverfed, true);
assert.equal(useInventoryItem(fedReload, 'bento', now + 1000).inventory.bento, 4);
assert.equal(readLocal(fedText, now + 60 * 60 * 1000).isOverfed, advancePet(fedPet, now + 60 * 60 * 1000, quiet).isOverfed, 'loading preserves the same satiety decay as the running game');
const { isOverfed: _satiety, ...beforeFeedingProtection } = fresh;
assert.equal(normalizePet(beforeFeedingProtection, now).isOverfed, false);
assert.equal(normalizePet({ ...beforeFeedingProtection, hunger: 100 }, now).isOverfed, true);
assert.equal(normalizePet({ ...fresh, hunger: 98, isOverfed: 'true' }, now).isOverfed, false);

// Pure parsing/export and the exact durable boundary.
const goldDrawn = drawGoldenAppleGacha(rich, 'coins', 10, now).pet;
const drawn = drawGoldenAppleHeartGacha(goldDrawn, 10, now).pet;
assert.equal(drawn.goldenAppleGacha.recentResults.length, 10);
assert.equal(drawn.goldenAppleGacha.recentHeartResults.length, 10);
const sourceBefore = JSON.stringify(drawn);
const writesBefore = storage.writes;
const file = createSaveFileText(drawn, { id: 'mod.test', name: '测试 Mod', version: '1.0.0' }, now);
const envelope = JSON.parse(file);
assert.equal(envelope.schemaVersion, 2);
assert.equal(envelope.minimumReaderVersion, '1.9.0');
assert.ok(file.startsWith('{') && !file.includes('\n'), 'exports are compact UTF-8 JSON');
assert.equal(envelope.activeMod.id, 'mod.test');
for (const key of ['recentEvent', 'recentActivity', 'recentActivityUntil', 'hasOpenedHelp', 'hasSeenCommonDreamsUnlock', 'suppressGoldenAppleUseConfirm']) assert.ok(!(key in envelope.pet), key);
assert.ok(!('recentResults' in envelope.pet.goldenAppleGacha));
assert.ok(!('recentHeartResults' in envelope.pet.goldenAppleGacha));
assert.ok(!('plating' in envelope.pet.kitchen));
assert.ok(!('style' in envelope.pet.miniGames));
assert.ok(!('activeSlotIndex' in envelope.pet.garden));
assert.deepEqual(envelope.pet.garden.slots, Array.from({ length: 5 }, () => ({ unlocked: false })));
const restored = readLocal(file);
assert.equal(restored.inventory['mod.snack'], 17);
assert.deepEqual(restored.goldenAppleGacha.recentResults, []);
assert.deepEqual(restored.goldenAppleGacha.recentHeartResults, []);
for (const count of [1, 10] as const) {
  const before = drawGoldenAppleGacha(drawn, 'coins', count, now);
  const after = drawGoldenAppleGacha(restored, 'coins', count, now);
  assert.deepEqual(after.results, before.results, 'conversion preserves random sequence and pity');
  assert.equal(after.pet.coins, before.pet.coins);
  assert.deepEqual(after.pet.inventory, before.pet.inventory);
  assert.deepEqual(drawGoldenAppleHeartGacha(restored, count, now).results, drawGoldenAppleHeartGacha(drawn, count, now).results);
}
assert.equal(JSON.stringify(drawn), sourceBefore, 'projection must not mutate runtime history');
parseSaveFileText(file, now);
assert.equal(storage.writes, writesBefore, 'preview and conversion cannot write storage or award compensation');

// Existing progress gets a claimable gift; new saves never become eligible just by aging.
assert.equal(communityWorkGiftTickets, 10);
for (const newPet of [fresh, normalizePet(fresh, now + 30 * 86400000), readLocal(createSaveFileText(fresh, null, now))]) {
  assert.equal(newPet.saveMetadata.communityWorkGift, 'ineligible');
  assert.equal(isCommunityWorkGiftAvailable(newPet), false);
  assert.equal(claimCommunityWorkGift(newPet).pet, newPet);
}
const oldCurrentFile = JSON.parse(createSaveFileText(rich, null, now));
delete oldCurrentFile.pet.saveMetadata.communityWorkGift;
const oldGiftPet = readLocal(JSON.stringify(oldCurrentFile));
assert.equal(oldGiftPet.saveMetadata.origin, 'new', 'an older V2 save qualifies even if it was originally created as new');
assert.equal(oldGiftPet.saveMetadata.communityWorkGift, 'pending');
assert.equal(oldGiftPet.goldenAppleGacha.tickets, rich.goldenAppleGacha.tickets, 'loading only exposes the gift; tickets arrive on claim');
assert.equal(readLocal(createSaveFileText(oldGiftPet, null, now)).saveMetadata.communityWorkGift, 'pending');
const oldGiftBefore = JSON.stringify(oldGiftPet);
const gift = claimCommunityWorkGift(oldGiftPet);
assert.ok(gift.claimed);
assert.equal(gift.pet.goldenAppleGacha.tickets, oldGiftPet.goldenAppleGacha.tickets + 10);
assert.equal(gift.pet.saveMetadata.communityWorkGift, 'claimed');
assert.equal(gift.pet.claimedRewardIds.filter((id) => id === communityWorkGiftRewardId).length, 1);
assert.equal(JSON.stringify(oldGiftPet), oldGiftBefore, 'claim does not mutate its input');
assert.deepEqual(claimCommunityWorkGift(oldGiftPet), gift, 'replaying the same updater produces the same one-gift result');
assert.equal(claimCommunityWorkGift(gift.pet).pet, gift.pet, 'a second click grants nothing');
assert.deepEqual(gift.pet.goldenAppleGacha.dailyGrantedSources, oldGiftPet.goldenAppleGacha.dailyGrantedSources);
assert.equal(gift.pet.goldenAppleGacha.dailyTicketsGranted, oldGiftPet.goldenAppleGacha.dailyTicketsGranted);
assert.deepEqual(gift.pet.achievements, oldGiftPet.achievements);
const quotaUsed = { ...oldGiftPet, goldenAppleGacha: { ...oldGiftPet.goldenAppleGacha, dailyTicketsGranted: 3 } };
assert.ok(claimCommunityWorkGift(quotaUsed).claimed, 'the gift is independent of the daily random ticket quota');
for (const tickets of [9990, 9999]) {
  const full = { ...oldGiftPet, goldenAppleGacha: { ...oldGiftPet.goldenAppleGacha, tickets } };
  const blocked = claimCommunityWorkGift(full);
  assert.equal(blocked.claimed, false);
  assert.equal(blocked.pet.goldenAppleGacha.tickets, tickets);
  assert.ok(isCommunityWorkGiftAvailable(readLocal(createSaveFileText(blocked.pet, null, now))));
}
assert.equal(claimCommunityWorkGift({ ...oldGiftPet, goldenAppleGacha: { ...oldGiftPet.goldenAppleGacha, tickets: 9989 } }).pet.goldenAppleGacha.tickets, 9999);
const restoredGift = readLocal(createSaveFileText(gift.pet, null, now));
assert.equal(restoredGift.goldenAppleGacha.tickets, gift.pet.goldenAppleGacha.tickets);
assert.equal(claimCommunityWorkGift(restoredGift).pet, restoredGift);
const markerOnly = normalizePet({ ...oldGiftPet, claimedRewardIds: gift.pet.claimedRewardIds, saveMetadata: { ...oldGiftPet.saveMetadata, communityWorkGift: undefined } }, now);
assert.equal(markerOnly.saveMetadata.communityWorkGift, 'claimed', 'the existing receipt also blocks an older metadata snapshot');
assert.equal(claimCommunityWorkGift(markerOnly).pet, markerOnly);
assert.equal(storage.writes, writesBefore, 'gift previews and pure claims never touch player storage');

// Pending work keeps its real reward/snapshot; acknowledged displays keep receipts.
let game = startMiniGame(rich, 'matching', 'gentle', 'official.mint', 'receipt-game', now);
const deck = [...game.miniGames.active!.deck];
for (const value of new Set(deck)) for (const index of deck.flatMap((card, index) => card === value ? [index] : [])) game = actMiniGame(game, 'receipt-game', { type: 'flip', index }, now);
assert.equal(game.miniGames.lastResult?.pending, true);
const pendingGame = readLocal(createSaveFileText(game, null, now));
assert.deepEqual(pendingGame.miniGames.lastResult, game.miniGames.lastResult);
const acknowledged = acknowledgeMiniGameResult(pendingGame, 'receipt-game');
const acknowledgedFile = createSaveFileText(acknowledged, null, now);
assert.ok(!('lastResult' in JSON.parse(acknowledgedFile).pet.miniGames));
const gameReload = readLocal(acknowledgedFile);
assert.equal(gameReload.miniGames.lastSettledSessionId, 'receipt-game');
assert.equal(startMiniGame(gameReload, 'matching', 'gentle', 'official.mint', 'receipt-game', now), gameReload);
assert.equal(acknowledgeMiniGameResult(gameReload, 'receipt-game').hearts, game.hearts);
const catchGame = startMiniGame(rich, 'catch', 'gentle', 'official.mint', 'catch-paid', now);
const catchReload = readLocal(createSaveFileText(catchGame, null, now));
assert.equal(catchReload.miniGames.active?.paused, true);
assert.equal(resumeMiniGame(catchReload, 'official.mint', now).inventory.toy_ball, rich.inventory.toy_ball - 1);

// Imported IDs cannot keep paragraphs of text in otherwise compact saves.
const oversizedId = 'x'.repeat(200000);
for (const source of [startMiniGame(rich, 'matching', 'gentle', 'official.mint', 'active-game', now), game]) {
  const oversized = JSON.parse(createSaveFileText(source, null, now));
  oversized.pet.kitchen.recentOperationIds = [oversizedId, oversizedId, 'existing-receipt'];
  oversized.pet.miniGames.lastSettledSessionId = oversizedId;
  oversized.pet.pomodoro.lastSettledPhaseId = oversizedId;
  for (const field of ['active', 'lastResult']) {
    if (oversized.pet.miniGames[field]) Object.assign(oversized.pet.miniGames[field], { id: oversizedId, actorId: oversizedId });
  }
  const imported = parseSaveFileText(JSON.stringify(oversized), now).pet;
  const compact = createSaveFileText(imported, null, now);
  assert.ok(Buffer.byteLength(compact) < 20000, 'oversized IDs are removed from the durable save');
  assert.equal(imported.inventory.emergency_biscuit, source.inventory.emergency_biscuit);
  assert.equal(imported.hearts, source.hearts, 'normalization does not change earned rewards');
  assert.deepEqual(imported.kitchen.recentOperationIds, [oversizedId.slice(0, 128), 'existing-receipt']);
  assert.equal(imported.pomodoro.lastSettledPhaseId.length, 128);
  assert.equal(imported.miniGames.lastSettledSessionId.length, 128);
  const activity = imported.miniGames.active ?? imported.miniGames.lastResult!;
  assert.equal(activity.id.length, 128);
  assert.equal(activity.actorId.length, 128);
  assert.equal(activity.id, imported.miniGames.lastSettledSessionId, 'session and receipt IDs stay consistent');
  const reopened = readLocal(compact);
  assert.equal(createSaveFileText(reopened, null, now), compact, 'bounded IDs survive another save unchanged');
  if (reopened.miniGames.lastResult) {
    const dismissed = acknowledgeMiniGameResult(reopened, activity.id);
    assert.equal(dismissed.miniGames.lastResult?.pending, false);
    assert.equal(startMiniGame(dismissed, 'matching', 'gentle', activity.actorId, activity.id, now), dismissed, 'the settlement receipt still blocks replay');
  }
}

const growing = { ...rich, garden: { ...rich.garden, slots: [{ ...rich.garden.slots[0], unlocked: true, treeId: 'fruit_tree' as const, state: 'ready' as const, plantedAt: now - 8 * 3600000, naturalReadyAt: now, nextReadyAt: now, maxHarvests: 8, pendingDrops: [{ itemId: 'apple' as const, amount: 3 }] }, ...rich.garden.slots.slice(1)] } };
const gardenFile = createSaveFileText(growing, null, now);
assert.deepEqual(JSON.parse(gardenFile).pet.garden.slots[0].pendingDrops, growing.garden.slots[0].pendingDrops);
const harvested = harvestTree(readLocal(gardenFile), 0, now);
assert.equal(harvested.inventory.apple, 3);
assert.equal(harvestTree(readLocal(createSaveFileText(harvested, null, now)), 0, now).inventory.apple, 3);
const schedule = startPartnerSchedule(rich, rich.partnerSchedule.offers[0].id, now);
assert.ok(schedule.partnerSchedule.active);
const loadedSchedule = readLocal(createSaveFileText(schedule, null, now));
assert.deepEqual(loadedSchedule.partnerSchedule.active, schedule.partnerSchedule.active);
const finished = advancePartnerSchedule(loadedSchedule, schedule.partnerSchedule.active!.endsAt);
const finishAt = schedule.partnerSchedule.active!.endsAt;
const pendingSchedule = parseSaveFileText(createSaveFileText(finished, null, finishAt), finishAt).pet;
const claimedSchedule = claimPartnerScheduleResult(pendingSchedule, 'coins', finishAt);
assert.equal(claimedSchedule.coins, pendingSchedule.coins + pendingSchedule.partnerSchedule.pendingResult!.coinReward);
assert.equal(claimPartnerScheduleResult(readLocal(createSaveFileText(claimedSchedule, null, finishAt), finishAt), 'coins', finishAt).coins, claimedSchedule.coins);
const focusAt = now + 60000;
const focus = advancePet(startPomodoro(rich, now), focusAt, quiet);
const focusReload = readLocal(createSaveFileText(focus, null, focusAt), focusAt);
assert.deepEqual(focusReload.pomodoro, focus.pomodoro);
assert.equal(focusReload.coins, focus.coins, 'focus checkpoints do not repeat a reward on reload');

// Legacy raw/envelope/Mint previews have stable identity and no reward side effects.
const { saveMetadata: _metadata, ...legacyPet } = rich;
const rawLegacy = JSON.stringify(legacyPet);
const legacyEnvelope = JSON.stringify({ schemaVersion: 1, app: 'PocPet', exportedAt: new Date(now).toISOString(), pet: legacyPet });
const mintFile = readFileSync(new URL('./fixtures/pocpet-mint-1.0.1-export.pocpet', import.meta.url), 'utf8');
const legacyPreview = parseSaveFileText(rawLegacy, now);
assert.equal(parseSaveFileText(legacyEnvelope, now).pet.saveMetadata.id, legacyPreview.pet.saveMetadata.id);
assert.equal(parseSaveFileText(JSON.stringify({ ...legacyPet, name: '改名' }), now).pet.saveMetadata.id, legacyPreview.pet.saveMetadata.id);
const { createdAt: _createdAt, goldenAppleGacha: _gacha, ...earliestLegacy } = legacyPet;
const earlyIdentity = parseSaveFileText(JSON.stringify(earliestLegacy), now).pet.saveMetadata.id;
assert.equal(parseSaveFileText(JSON.stringify({ ...earliestLegacy, name: '早期旧档改名', ageSeconds: earliestLegacy.ageSeconds + 60, lastUpdatedAt: earliestLegacy.lastUpdatedAt + 60000 }), now).pet.saveMetadata.id, earlyIdentity, 'pre-createdAt saves derive identity from their original elapsed-time baseline');
assert.equal(legacyPreview.pet.saveMetadata.compensation, 'pending');
assert.equal(legacyPreview.pet.inventory.emergency_biscuit, 3);
assert.equal(storage.writes, writesBefore);

for (const text of [rawLegacy, legacyEnvelope, mintFile]) {
  resetStorage();
  const preview = parseSaveFileText(text, now);
  const before = structuredClone(preview.pet);
  const converted = replacePetFromImport(preview.pet, '', preview.activeMod, text, now);
  assert.ok(isCommunityWorkGiftAvailable(converted), 'pre-V2 and Mint saves retain the separate, unclaimed community gift');
  assert.equal(converted.inventory.emergency_biscuit, (before.inventory.emergency_biscuit ?? 0) + 120);
  assert.equal(converted.inventory.strawberry_milk, (before.inventory.strawberry_milk ?? 0) + 10);
  assert.equal(converted.dailyBiscuitClaims, before.dailyBiscuitClaims);
  assert.equal(converted.achievements.counters.purchaseCount, before.achievements.counters.purchaseCount);
  assert.ok(converted.claimedRewardIds.includes(migrationCompensationRewardId));
  assert.equal(storage.getItem(formatBackupStoragePrefix + converted.saveMetadata.id), text, 'conversion backup preserves original bytes');
  assert.equal(takeStorageFeedback().length, 1, 'notify only after commit');
  assert.equal(loadCurrent().inventory.emergency_biscuit, converted.inventory.emergency_biscuit, 'reload cannot repeat compensation');
  const repeated = replacePetFromImport(parseSaveFileText(text, now).pet, '', preview.activeMod, text, now);
  assert.equal(repeated.inventory.emergency_biscuit, before.inventory.emergency_biscuit);
  assert.equal(repeated.saveMetadata.compensation, 'claimed');
  assert.equal(takeStorageFeedback().length, 0);
}
resetStorage();
savePet(fresh);
assert.equal(loadCurrent().saveMetadata.compensation, 'ineligible');
assert.equal(loadCurrent().inventory.emergency_biscuit, fresh.inventory.emergency_biscuit);
assert.equal(storage.getItem(migrationLedgerStorageKey), null);
assert.equal(takeStorageFeedback().length, 0);

resetStorage();
savePet(oldGiftPet);
assert.ok(isCommunityWorkGiftAvailable(loadCurrent()));
savePet(gift.pet);
const savedGift = loadCurrent();
assert.equal(savedGift.goldenAppleGacha.tickets, gift.pet.goldenAppleGacha.tickets);
assert.equal(claimCommunityWorkGift(savedGift).pet, savedGift, 'saving and reopening cannot grant twice');

resetStorage();
storage.setItem(primaryKey, rawLegacy);
const migrated = loadCurrent();
assert.equal(migrated.inventory.emergency_biscuit, 123);
assert.deepEqual(getPetPreferences(loadCurrent()), getPetPreferences(rich), 'legacy choices migrate to local preferences');
assert.equal(JSON.parse(storage.getItem(primaryKey)!).schemaVersion, 2);
assert.ok(getStoredRecoveryCopies().some((copy) => copy.raw === rawLegacy && copy.key.startsWith(formatBackupStoragePrefix)));
const preferenceKey = `pocpet.pet-preferences.v1.${migrated.saveMetadata.id}`;
assert.ok(storage.getItem(preferenceKey));
const onOtherDevice = parseSaveFileText(storage.getItem(primaryKey)!, now).pet;
assert.equal(onOtherDevice.kitchen.plating, 'plain', 'local preferences are not carried by files');
assert.equal(onOtherDevice.saveMetadata.compensation, 'claimed');
const renamedLegacy = JSON.stringify({ ...legacyPet, name: '另一次旧档备份' });
replacePetFromImport(parseSaveFileText(renamedLegacy, now).pet, '', null, renamedLegacy, now);
assert.equal(storage.getItem(formatBackupStoragePrefix + migrated.saveMetadata.id), rawLegacy);
assert.ok(getStoredRecoveryCopies().some((copy) => copy.key.startsWith(formatBackupStoragePrefix) && copy.raw === renamedLegacy), 'distinct old snapshots keep separate original copies without overwriting recovery points');

// Full inventories preserve balances, including repeated imports of old pending copies.
resetStorage();
const fullLegacy = JSON.stringify({ ...legacyPet, inventory: { ...legacyPet.inventory, emergency_biscuit: 9990, strawberry_milk: 9999 } });
let full = replacePetFromImport(parseSaveFileText(fullLegacy, now).pet, '', null, fullLegacy, now);
assert.equal(full.inventory.emergency_biscuit, 9999);
assert.deepEqual(full.saveMetadata.pendingItems, { emergency_biscuit: 111, strawberry_milk: 10 });
const pendingFile = createSaveFileText(full, null, now);
full = savePet({ ...full, inventory: { ...full.inventory, emergency_biscuit: 9800, strawberry_milk: 9900 } });
assert.equal(full.inventory.emergency_biscuit, 9911);
assert.equal(full.inventory.strawberry_milk, 9910);
assert.deepEqual(full.saveMetadata.pendingItems, {});
const outdatedPending = replacePetFromImport(parseSaveFileText(pendingFile, now).pet, '', null, pendingFile, now);
const afterReimport = savePet({ ...outdatedPending, inventory: { ...outdatedPending.inventory, emergency_biscuit: 9000, strawberry_milk: 9000 } });
assert.equal(afterReimport.inventory.emergency_biscuit, 9000, 'a copied pending balance cannot award twice on the same device');
assert.equal(afterReimport.inventory.strawberry_milk, 9000);
resetStorage();
const firstFull = replacePetFromImport(parseSaveFileText(fullLegacy, now).pet, '', null, fullLegacy, now);
const reimportFull = replacePetFromImport(parseSaveFileText(fullLegacy, now).pet, '', null, fullLegacy, now);
assert.equal(reimportFull.inventory.emergency_biscuit, 9999);
assert.equal(reimportFull.saveMetadata.pendingItems.emergency_biscuit, firstFull.saveMetadata.pendingItems.emergency_biscuit! - 9, 'repeated old imports spend only the remaining entitlement');

// Failed backup, primary and ledger writes leave exact originals and retryable entitlement.
for (const failureKey of [formatBackupStoragePrefix + legacyPreview.pet.saveMetadata.id, primaryKey, migrationLedgerStorageKey]) {
  resetStorage(); storage.setItem(primaryKey, rawLegacy); storage.failKey = failureKey;
  const failed = loadPet(now, quiet);
  assert.ok(failed.status === 'ok' && failed.persistenceError);
  assert.equal(storage.getItem(primaryKey), rawLegacy);
  assert.equal(storage.getItem(migrationLedgerStorageKey), null);
  assert.equal(takeStorageFeedback().length, 0);
  assert.equal(loadCurrent().inventory.emergency_biscuit, 123, 'reload retries once storage is writable');
}
resetStorage(); savePet(fresh);
const beforeFailedImport = storage.getItem(primaryKey);
storage.failKey = migrationLedgerStorageKey;
assert.throws(() => replacePetFromImport(legacyPreview.pet, 'previous', null, rawLegacy, now), /Injected/);
assert.equal(storage.getItem(primaryKey), beforeFailedImport);
assert.equal(storage.getItem(migrationLedgerStorageKey), null);
assert.equal(takeStorageFeedback().length, 0);
assert.equal(replacePetFromImport(legacyPreview.pet, 'previous', null, rawLegacy, now).inventory.emergency_biscuit, 123);

// A damaged optional ledger must not block progress or invent compensation history.
const legacyId = legacyPreview.pet.saveMetadata.id;
for (const brokenLedger of ['{', '', 'null', '[]', JSON.stringify({ [legacyId]: { delivered: {} } })]) {
  resetStorage(); savePet(fresh);
  storage.setItem(migrationLedgerStorageKey, brokenLedger);
  const ordinary = savePet({ ...loadCurrent(), coins: fresh.coins + 1 });
  assert.equal(loadCurrent().coins, ordinary.coins, 'new saves remain writable with an unrelated damaged ledger');
  assert.equal(storage.getItem(migrationLedgerStorageKey), brokenLedger);
  assert.equal(takeStorageFeedback().length, 0);

  const deferred = replacePetFromImport(legacyPreview.pet, 'previous', null, rawLegacy, now);
  assert.equal(deferred.inventory.emergency_biscuit, legacyPreview.pet.inventory.emergency_biscuit);
  assert.equal(deferred.saveMetadata.compensation, 'pending');
  assert.equal(storage.getItem(migrationLedgerStorageKey), brokenLedger, 'do not reset unknown delivery history');
  const notices = takeStorageFeedback();
  assert.equal(notices.length, 1);
  assert.match(notices[0], /补偿暂缓/);
  savePet({ ...deferred, coins: deferred.coins + 1 });
  savePet(deferred);
  assert.equal(takeStorageFeedback().length, 0, 'do not repeat the warning on every autosave');
  assert.equal(loadCurrent().inventory.emergency_biscuit, deferred.inventory.emergency_biscuit);
  takeStorageFeedback();

  // Once readable, honor the already delivered portion rather than issuing a full gift.
  storage.setItem(migrationLedgerStorageKey, JSON.stringify({ [legacyId]: { delivered: { emergency_biscuit: 5, strawberry_milk: 1 } }, unrelated: { damaged: true } }));
  const resumed = savePet(deferred);
  assert.equal(resumed.inventory.emergency_biscuit, deferred.inventory.emergency_biscuit + 115);
  assert.equal(resumed.inventory.strawberry_milk, deferred.inventory.strawberry_milk + 9);
  assert.equal(savePet(resumed).inventory.emergency_biscuit, resumed.inventory.emergency_biscuit);
  assert.deepEqual(JSON.parse(storage.getItem(migrationLedgerStorageKey)!).unrelated, { damaged: true });
}
resetStorage(); savePet(fresh);
storage.setItem(migrationLedgerStorageKey, '{');
const deferredBalance = savePet(firstFull);
assert.deepEqual(deferredBalance.saveMetadata.pendingItems, firstFull.saveMetadata.pendingItems, 'claimed saves retain pending capacity overflow while history is unreadable');
assert.deepEqual(savePet({ ...deferredBalance, inventory: { ...deferredBalance.inventory, emergency_biscuit: 9000 } }).saveMetadata.pendingItems, firstFull.saveMetadata.pendingItems);
assert.equal(storage.getItem(migrationLedgerStorageKey), '{');
resetStorage(); savePet(fresh);
storage.setItem(migrationLedgerStorageKey, '{');
const fullyPaid = { ...deferredBalance, saveMetadata: { ...deferredBalance.saveMetadata, pendingItems: {} } };
assert.equal(savePet(fullyPaid), fullyPaid);
assert.equal(takeStorageFeedback().length, 0, 'fully delivered gifts do not show a misleading pending-gift warning');
assert.equal(storage.getItem(migrationLedgerStorageKey), '{');

// Unknown module versions must never be silently dropped and saved over.
const current = JSON.parse(createSaveFileText(rich, null, now));
const currentTrip = { id: 'version-check-trip', region: 'valley', actorId: 'official.mint', actorName: 'Mint', startedAt: now, rulesVersion: 4, revision: 2, choices: [], bag: { trail_mix: 1 }, loot: {}, tool: true, shopStock: {}, purchases: 0, transportedCount: 0, treasure: 'ancient_gold_bar' };
const currentAdventure = { ...current.pet.adventure, active: currentTrip };
const supportedAdventure = parseSaveFileText(JSON.stringify({ ...current, pet: { ...current.pet, adventure: currentAdventure } }), now).pet;
assert.deepEqual(supportedAdventure.adventure.active, normalizePet({ ...rich, adventure: currentAdventure }, now).adventure.active, 'supported trips keep their rules, supplies and treasure');
const futurePets = Object.entries(current.pet).flatMap(([key, value]) => {
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || typeof value.schemaVersion !== 'number') return [];
  return [{ ...current.pet, [key]: { ...value, schemaVersion: value.schemaVersion + 1 } }];
});
futurePets.push({ ...current.pet, adventure: { ...currentAdventure, active: { ...currentTrip, rulesVersion: 99 } } });
const futureFiles = [
  { ...current, schemaVersion: 3 },
  { ...current, minimumReaderVersion: '2.0.0' },
  { ...current, pet: { ...current.pet, unknownFutureModule: { schemaVersion: 1 } } },
  { ...current, modules: { adventure: { schemaVersion: 1 } } },
  ...futurePets.flatMap((pet) => [
    { ...current, pet },
    { schemaVersion: 1, app: 'PocPet', exportedAt: current.exportedAt, pet: { ...rich, ...pet } },
    { ...rich, ...pet },
  ]),
].map((value) => JSON.stringify(value));
for (const text of futureFiles) {
  assert.throws(() => parseSaveFileText(text, now), UnsupportedSaveVersionError);
  resetStorage(); storage.setItem(primaryKey, text);
  const result = loadPet(now);
  assert.ok(result.status === 'corrupt' && result.stage === 'version' && result.backup === null);
  assert.throws(() => savePet(fresh), UnsupportedSaveVersionError);
  assert.equal(storage.getItem(primaryKey), text);
}

// Box transactions deliver units, charge boxes and check capacity before discounts.
const shop = getShopDefinitions(createItemRegistry());
for (const category of ['food', 'ingredients'] as const) assert.ok(filterBrowseItems(shop, category).some((item) => item.id === 'soda_biscuit_box'));
const boxPrice = getShopItem('soda_biscuit_box')!.price;
const paid = buyItem(rich, 'soda_biscuit_box', now, { quantity: 3 });
const quote = getItemPurchaseQuote(rich, 'soda_biscuit_box', 3, now);
assert.equal(paid.coins, rich.coins - quote.totalPrice);
assert.equal(paid.inventory.emergency_biscuit, 123);
assert.equal(paid.inventory.soda_biscuit_box, undefined);
assert.equal(paid.dailyBiscuitClaims, rich.dailyBiscuitClaims);
assert.equal(paid.achievements.counters.paidPurchaseCount, rich.achievements.counters.paidPurchaseCount + 3);
const discountPet = { ...rich, dailyDiscountDate: getDailyResetDateKey(now), dailyDiscountItemIds: ['soda_biscuit_box', 'bento', 'rice'], dailyDiscountUsedItemIds: [], dailyDiscountUsed: false } as PetState;
const discount = getItemPurchaseQuote(discountPet, 'soda_biscuit_box', 3, now);
assert.ok(discount.discountApplied && discount.firstItemPrice < boxPrice);
assert.equal(discount.totalPrice, discount.firstItemPrice + boxPrice * 2);
const discounted = buyItem(discountPet, 'soda_biscuit_box', now, { quantity: 3 });
assert.equal(discounted.coins, rich.coins - discount.totalPrice);
assert.equal(getItemPurchaseQuote(discounted, 'soda_biscuit_box', 1, now).totalPrice, boxPrice);
for (const [count, quantity] of [[9960, 1], [9920, 2]] as const) {
  const nearFull = { ...discountPet, inventory: { ...rich.inventory, emergency_biscuit: count } };
  assert.equal(getItemPurchaseQuote(nearFull, 'soda_biscuit_box', quantity, now).reason, 'inventory_full');
  const rejected = buyItem(nearFull, 'soda_biscuit_box', now, { quantity });
  assert.equal(rejected.coins, nearFull.coins);
  assert.equal(rejected.inventory.emergency_biscuit, count);
  assert.deepEqual(rejected.dailyDiscountUsedItemIds, []);
  assert.equal(rejected.achievements.counters.purchaseCount, nearFull.achievements.counters.purchaseCount);
}
const exact = buyItem({ ...rich, inventory: { ...rich.inventory, emergency_biscuit: 9959 } }, 'soda_biscuit_box', now);
assert.equal(exact.inventory.emergency_biscuit, 9999);
const poor = { ...discountPet, coins: discount.firstItemPrice - 1 };
assert.equal(buyItem(poor, 'soda_biscuit_box', now).coins, poor.coins);
assert.deepEqual(buyItem(poor, 'soda_biscuit_box', now).dailyDiscountUsedItemIds, []);
assert.equal(getItemPurchaseQuote({ ...rich, level: 1 }, 'soda_biscuit_box', 3, now).quantity, 3, 'initial-level box purchases support batches');
const fed = useInventoryItem({ ...paid, hunger: 0 }, 'emergency_biscuit', now);
assert.equal(fed.inventory.emergency_biscuit, paid.inventory.emergency_biscuit - 1);
const cooked = craftRecipe(paid, 'biscuit_cup', false, 1, 'box-cook', now);
assert.equal(cooked.inventory.emergency_biscuit, paid.inventory.emergency_biscuit - 1);
assert.equal(cooked.inventory.dish_biscuit_cup, 1);
const cookedFile = createSaveFileText(cooked, null, now);
assert.ok(!('lastCraft' in JSON.parse(cookedFile).pet.kitchen));
assert.equal(craftRecipe(readLocal(cookedFile), 'biscuit_cup', false, 1, 'box-cook', now).inventory.dish_biscuit_cup, 1);
assert.equal(selectNeighborGift([{ itemId: 'soda_biscuit_box', displayName: 'Box', price: 500 }], () => 0.5).itemId, 'emergency_biscuit');

console.log(`Save v2: UTF-8 ${Buffer.byteLength(file)} bytes; bounded IDs, durable RNG/receipts/rewards, legacy/Mint migration, local preferences, compensation/overflow/replay/rollback, damaged ledgers, future module/trip versions and box transactions passed.`);
