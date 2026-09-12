import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  cloudReminderFirstDelayMs,
  cloudReminderIntervalMs,
  defaultCloudReminderPreferences,
  getCloudReminderDecision,
  markCloudReminderShownToday,
  shouldDisplayCloudReminder,
  snoozeCloudReminder,
} from '../src/core/cloudReminder';
import {
  authorFollowGiftCloudKey,
  cloudSaveActiveKey,
  cloudSaveChunkSize,
  cloudSaveMaxChunksPerGeneration,
  cloudSaveOwnedKeys,
  encodeCloudSave,
  getCloudSaveStatus,
  hasAuthorFollowGiftCloudMarker,
  restoreCloudSave,
  uploadCloudSave,
  writeAuthorFollowGiftCloudMarker,
} from '../src/core/cloudSave';
import {
  authorFollowGiftRewardId,
  authorFollowGiftTickets,
  authorLinkGiftRewardId,
  achievementDefinitions,
  claimAuthorFollowGift,
  createDefaultPet,
  dismissYearReview,
  dreamProjectCategories,
  dreamStageDefinitions,
  normalizePet,
  type GachaResult,
  type YearReview,
} from '../src/core/pet';
import { ensureYearlyStatsForDate } from '../src/core/yearlyStats';
import { createGachaCardData, createPetProfileCardData } from '../src/core/shareCards';
import { createSaveFilePlainText, parseSaveFileText } from '../src/core/saveCodec';
import {
  getSafeToyPageUrl,
  isToyPreviewUrl,
  openAuthorSpace,
  openToySharePanel,
  type ToyCloudStorage,
  type ToySdk,
} from '../src/platform/toySdk';
import { saveShareImage } from '../src/platform/saveImageFile';
import { sharePosterHeight, sharePosterWidth } from '../src/platform/sharePoster';

class MemoryCloudStorage implements ToyCloudStorage {
  readonly values = new Map<string, string>();
  private setCalls = 0;
  private failSetCall?: number;

  failOnSetCallFromNow(offset: number) {
    this.failSetCall = this.setCalls + offset;
  }

  setRaw(key: string, value: string) {
    this.values.set(key, value);
  }

  async getCloudStorage(keys?: string[]) {
    const selected = keys?.length ? keys : [...this.values.keys()];
    return Object.fromEntries(selected.flatMap((key) => {
      const value = this.values.get(key);
      return value === undefined ? [] : [[key, value]];
    }));
  }

  async setCloudStorage(items: Record<string, string>) {
    this.setCalls += 1;
    if (this.setCalls === this.failSetCall) throw new Error('Injected cloud write failure.');
    const nextKeys = new Set([...this.values.keys(), ...Object.keys(items)]);
    assert(nextKeys.size <= 128, 'mock enforces the Toy 128-key limit');
    Object.entries(items).forEach(([key, value]) => {
      assert(/^[A-Za-z0-9_-]+$/.test(key) && !key.startsWith('__'));
      assert(Buffer.byteLength(key, 'utf8') <= 128);
      assert(Buffer.byteLength(value, 'utf8') <= 1024);
      this.values.set(key, value);
    });
  }

  async removeCloudStorage(keys: string[]) {
    keys.forEach((key) => this.values.delete(key));
  }
}

const dayMs = 24 * 60 * 60 * 1000;
const firstUploadAt = Date.UTC(2026, 7, 1, 4, 0, 0);
const basePet = { ...createDefaultPet(firstUploadAt - 40 * dayMs), name: 'Cloud Furo', level: 12 };

assert.equal(cloudSaveOwnedKeys.length, 123);
assert.equal(new Set([...cloudSaveOwnedKeys, authorFollowGiftCloudKey]).size, 124);
for (const key of [...cloudSaveOwnedKeys, authorFollowGiftCloudKey]) {
  assert(/^[A-Za-z0-9_-]+$/.test(key));
  assert(Buffer.byteLength(key, 'utf8') <= 128);
}

const encoded = await encodeCloudSave(basePet, null, firstUploadAt);
assert(encoded.chunks.length > 0 && encoded.chunks.length <= cloudSaveMaxChunksPerGeneration);
assert(encoded.chunks.every((chunk) => chunk.length <= cloudSaveChunkSize));
assert.equal(parseSaveFileText(encoded.plainText, firstUploadAt).pet.name, basePet.name);

const cloud = new MemoryCloudStorage();
cloud.setRaw('another-feature-key', 'keep-me');
await writeAuthorFollowGiftCloudMarker(cloud);
const firstManifest = await uploadCloudSave(cloud, basePet, null, firstUploadAt);
assert.equal(firstManifest.generation, 'a');
assert.equal(cloud.values.get(cloudSaveActiveKey), 'a');
assert.equal(cloud.values.get('another-feature-key'), 'keep-me');
assert.equal(await hasAuthorFollowGiftCloudMarker(cloud), true);
assert(Buffer.byteLength(cloud.values.get('pocpet-save-a-manifest-v1') ?? '', 'utf8') <= 1024);

const firstRestored = await restoreCloudSave(cloud, firstUploadAt + 1000);
assert.equal(firstRestored.imported.pet.name, basePet.name);
assert.equal(firstRestored.generation, 'a');
assert.equal(firstRestored.recoveredFromPrevious, false);

const secondPet = { ...basePet, name: 'Newer Furo', coins: 45678 };
const secondUploadAt = firstUploadAt + dayMs;
const secondManifest = await uploadCloudSave(cloud, secondPet, null, secondUploadAt);
assert.equal(secondManifest.generation, 'b');
assert.equal(cloud.values.get(cloudSaveActiveKey), 'b');
assert.equal((await restoreCloudSave(cloud, secondUploadAt + 1000)).imported.pet.name, secondPet.name);

cloud.failOnSetCallFromNow(2);
await assert.rejects(
  uploadCloudSave(cloud, { ...secondPet, name: 'Partial write' }, null, secondUploadAt + dayMs),
  /Injected cloud write failure/,
);
assert.equal(cloud.values.get(cloudSaveActiveKey), 'b', 'partial writes must not switch the active pointer');
assert.equal((await restoreCloudSave(cloud, secondUploadAt + dayMs)).imported.pet.name, secondPet.name);

const fallbackCloud = new MemoryCloudStorage();
await uploadCloudSave(fallbackCloud, basePet, null, firstUploadAt);
await uploadCloudSave(fallbackCloud, secondPet, null, secondUploadAt);
fallbackCloud.setRaw('pocpet-save-b-00', 'damaged' + (fallbackCloud.values.get('pocpet-save-b-00') ?? ''));
const fallbackRestore = await restoreCloudSave(fallbackCloud, secondUploadAt + 1000);
assert.equal(fallbackRestore.generation, 'a');
assert.equal(fallbackRestore.imported.pet.name, basePet.name);
assert.equal(fallbackRestore.recoveredFromPrevious, true);

fallbackCloud.failOnSetCallFromNow(2);
await assert.rejects(
  uploadCloudSave(fallbackCloud, { ...secondPet, name: 'Repair write failed' }, null, secondUploadAt + dayMs),
  /Injected cloud write failure/,
);
assert.equal(fallbackCloud.values.get(cloudSaveActiveKey), 'b', 'a failed repair must not switch the active pointer');
const fallbackAfterFailedRepair = await restoreCloudSave(fallbackCloud, secondUploadAt + dayMs);
assert.equal(fallbackAfterFailedRepair.generation, 'a', 'a failed repair must preserve the only usable fallback');
assert.equal(fallbackAfterFailedRepair.imported.pet.name, basePet.name);

const repairedManifest = await uploadCloudSave(
  fallbackCloud,
  { ...secondPet, name: 'Repaired cloud save' },
  null,
  secondUploadAt + 2 * dayMs,
);
assert.equal(repairedManifest.generation, 'b', 'a damaged active generation should be repaired in place');
assert.equal((await restoreCloudSave(fallbackCloud, secondUploadAt + 2 * dayMs)).imported.pet.name, 'Repaired cloud save');

const manifestFallbackCloud = new MemoryCloudStorage();
await uploadCloudSave(manifestFallbackCloud, basePet, null, firstUploadAt);
await uploadCloudSave(manifestFallbackCloud, secondPet, null, secondUploadAt);
manifestFallbackCloud.setRaw('pocpet-save-b-manifest-v1', '{broken');
const fallbackStatus = await getCloudSaveStatus(manifestFallbackCloud);
assert.equal(fallbackStatus.activeGeneration, 'a');
assert.equal(fallbackStatus.usedFallbackManifest, true);
assert.equal((await restoreCloudSave(manifestFallbackCloud, secondUploadAt)).generation, 'a');
manifestFallbackCloud.setRaw('pocpet-save-a-manifest-v1', '{also-broken');
await assert.rejects(restoreCloudSave(manifestFallbackCloud, secondUploadAt), /valid manifest/);

const oversizedPet = { ...basePet, inventory: Object.fromEntries(Array.from({ length: 1600 }, () => [`mod.${randomBytes(48).toString('hex')}`, 1])) };
await assert.rejects(encodeCloudSave(oversizedPet, null, firstUploadAt), /容量|capacity/);

const reminderDefaults = defaultCloudReminderPreferences();
const createdAt = firstUploadAt;
assert.equal(getCloudReminderDecision({ createdAt, now: createdAt + cloudReminderFirstDelayMs - 1, preferences: reminderDefaults }).due, false);
const firstDue = getCloudReminderDecision({ createdAt, now: createdAt + cloudReminderFirstDelayMs, preferences: reminderDefaults });
assert.equal(firstDue.due, true);
assert.equal(shouldDisplayCloudReminder(true, firstDue), true);
assert.equal(shouldDisplayCloudReminder(false, firstDue), false, 'SDK/read failures must suppress reminders');

const uploadDueAt = firstUploadAt + cloudReminderIntervalMs;
assert.equal(getCloudReminderDecision({ createdAt: createdAt - 100 * dayMs, uploadedAt: firstUploadAt, now: uploadDueAt - 1, preferences: reminderDefaults }).due, false);
assert.equal(getCloudReminderDecision({ createdAt: createdAt - 100 * dayMs, uploadedAt: firstUploadAt, now: uploadDueAt, preferences: reminderDefaults }).due, true);
const snoozed = snoozeCloudReminder(reminderDefaults, uploadDueAt);
assert.equal(getCloudReminderDecision({ createdAt, uploadedAt: firstUploadAt, now: uploadDueAt + dayMs, preferences: snoozed }).due, false);
assert.equal(getCloudReminderDecision({ createdAt, now: createdAt + 30 * dayMs, preferences: { ...reminderDefaults, enabled: false } }).due, false);
const shown = markCloudReminderShownToday(reminderDefaults, createdAt + 30 * dayMs);
const shownDecision = getCloudReminderDecision({ createdAt, now: createdAt + 30 * dayMs, preferences: shown });
assert.equal(shownDecision.due, true);
assert.equal(shownDecision.suppressedToday, true);

const oldRemoteUpload = firstUploadAt - 10 * dayMs;
const freshRemoteUpload = firstUploadAt - dayMs;
assert.equal(getCloudReminderDecision({ createdAt: createdAt - 100 * dayMs, uploadedAt: oldRemoteUpload, now: firstUploadAt, preferences: reminderDefaults }).due, true);
assert.equal(getCloudReminderDecision({ createdAt: createdAt - 100 * dayMs, uploadedAt: freshRemoteUpload, now: firstUploadAt, preferences: reminderDefaults }).due, false);
assert.equal(getCloudReminderDecision({ createdAt: createdAt - 100 * dayMs, uploadedAt: firstUploadAt + dayMs, now: firstUploadAt, preferences: reminderDefaults }).due, false, 'clock rollback must not trigger an early reminder');

const review: YearReview = {
  year: 2025,
  companionDays: 200,
  activeDays: 150,
  careActions: 600,
  itemUseCount: 80,
  pomodoroFocusCount: 40,
  topCareAction: 'feed',
};
const normalizedLegacyReview = normalizePet({ ...basePet, pendingYearReview: review, latestYearReview: undefined }, firstUploadAt);
assert.deepEqual(normalizedLegacyReview.latestYearReview, review, 'old pending reviews must backfill the latest review');
const dismissed = dismissYearReview(normalizedLegacyReview);
assert.equal(dismissed.pendingYearReview, undefined);
assert.deepEqual(dismissed.latestYearReview, review);

const priorYearPet = {
  ...basePet,
  yearlyStats: { ...basePet.yearlyStats, year: 2025 },
  pendingYearReview: undefined,
  latestYearReview: undefined,
};
const rolledYear = ensureYearlyStatsForDate(priorYearPet, firstUploadAt, '2026-08-01');
assert.equal(rolledYear.pendingYearReview?.year, 2025);
assert.equal(rolledYear.latestYearReview?.year, 2025);

const legacyReviewEnvelope = createSaveFilePlainText({ ...basePet, pendingYearReview: review, latestYearReview: undefined }, null, firstUploadAt);
assert.equal(parseSaveFileText(legacyReviewEnvelope, firstUploadAt).pet.latestYearReview?.year, review.year);

const starterProfile = createPetProfileCardData(basePet, firstUploadAt);
assert.equal(starterProfile.tags.length, 3);
assert(starterProfile.tags.every((tag) => tag.length > 0));
assert.equal(starterProfile.activity.length, 12);
assert.equal(starterProfile.activity.find((item) => item.key === 'dreams')?.value, '0/20');
const collectorPet = {
  ...basePet,
  inventory: { ...basePet.inventory, golden_apple: 12 },
  garden: { ...basePet.garden, lifetimeHarvestCount: 8 },
  achievements: {
    ...basePet.achievements,
    counters: {
      ...basePet.achievements.counters,
      careActionCounts: { ...basePet.achievements.counters.careActionCounts, feed: 14 },
    },
  },
};
const collectorProfile = createPetProfileCardData(collectorPet, firstUploadAt);
assert(collectorProfile.tags.some((tag) => tag.includes('喂食')));
assert(collectorProfile.tags.some((tag) => tag.includes('花园')));
assert(collectorProfile.tags.some((tag) => tag.includes('金苹果')));

const trackedProfilePet = {
  ...collectorPet,
  garden: { ...collectorPet.garden, lifetimeHarvestCount: 8 },
  pomodoro: { ...collectorPet.pomodoro, completedFocusCount: 9 },
  goldenAppleGacha: {
    ...collectorPet.goldenAppleGacha,
    totalDraws: 10,
    heartGachaTotalDraws: 11,
  },
  achievements: {
    ...collectorPet.achievements,
    unlockedAtById: Object.fromEntries(
      achievementDefinitions.slice(0, 3).map((definition, index) => [definition.id, firstUploadAt + index]),
    ),
    counters: {
      ...collectorPet.achievements.counters,
      careActionCounts: {
        ...collectorPet.achievements.counters.careActionCounts,
        play: 4,
        feed: 14,
      },
      heartEarnedTotal: 21,
      dailyWishClaimCount: 4,
      sleepStartCount: 5,
      totalItemUseCount: 6,
      partnerScheduleClaimCount: 7,
      companionYearActiveDateKeysByYear: {
        '2025': ['2025-01-01', '2025-01-02'],
        '2026': ['2025-01-02', '2026-01-01'],
      },
    },
  },
};
const trackedProfile = createPetProfileCardData(trackedProfilePet, firstUploadAt);
assert.deepEqual(trackedProfile.activity.map((item) => item.key), [
  'activeDays',
  'careActions',
  'heartsEarned',
  'dailyWishes',
  'sleepCount',
  'itemUseCount',
  'achievements',
  'schedule',
  'garden',
  'focus',
  'gacha',
  'dreams',
]);
const trackedValues = Object.fromEntries(trackedProfile.activity.map((item) => [item.key, item.value]));
assert.deepEqual(trackedValues, {
  activeDays: '3',
  careActions: '18',
  heartsEarned: '21',
  dailyWishes: '4',
  sleepCount: '5',
  itemUseCount: '6',
  achievements: `3/${achievementDefinitions.length}`,
  schedule: '7',
  garden: '8',
  focus: '9',
  gacha: '21',
  dreams: '0/20',
});

const completedDreamProjects = Object.fromEntries(dreamProjectCategories.map((category) => [
  category,
  {
    ...trackedProfilePet.classicEndgame.projects[category],
    completedStages: dreamStageDefinitions.length,
  },
])) as typeof trackedProfilePet.classicEndgame.projects;
const completedDreamProfile = createPetProfileCardData({
  ...trackedProfilePet,
  classicEndgame: {
    ...trackedProfilePet.classicEndgame,
    projects: completedDreamProjects,
  },
}, firstUploadAt);
assert.equal(completedDreamProfile.activity.find((item) => item.key === 'dreams')?.value, '20/20');

const gachaResult: GachaResult = {
  id: 'test-result',
  rewardId: 'golden_apple_100',
  kind: 'item',
  itemId: 'golden_apple',
  amount: 100,
  rarity: 'jackpot',
  guaranteed: false,
  pityGuaranteed: true,
  drawnAt: firstUploadAt,
};
const gachaCard = createGachaCardData('apple', [gachaResult]);
assert.equal(gachaCard.count, 1);
assert.equal(gachaCard.jackpotCount, 1);
assert.equal(gachaCard.guaranteedCount, 1);
assert.throws(() => createGachaCardData('apple', []), /one to ten/);
assert.equal(sharePosterWidth, 1080);
assert.equal(sharePosterHeight, 1440);
const sharePosterSource = readFileSync(new URL('../src/platform/sharePoster.ts', import.meta.url), 'utf8');
assert.equal((sharePosterSource.match(/drawSceneBackground\(context\);/g) ?? []).length, 2, 'profile and gacha retain their scene; annual reviews use the shared album renderer');
assert.equal(sharePosterSource.includes('#17342f'), false);

let navigationRequest: Parameters<ToySdk['navigate']>[0] | undefined;
let albumRequest: Parameters<ToySdk['saveImageToAlbum']>[0] | undefined;
let shareRequest: Parameters<ToySdk['share']>[0] | undefined;
const sdkInteractionMock = {
  isSupport: async (ability: string) => ability === 'saveImageToAlbum' || ability === 'navigate',
  navigate: async (request: Parameters<ToySdk['navigate']>[0]) => {
    navigationRequest = request;
  },
  saveImageToAlbum: async (request: Parameters<ToySdk['saveImageToAlbum']>[0]) => {
    albumRequest = request;
    return { localPath: '/album/pocpet.jpg' };
  },
  share: async (request: Parameters<ToySdk['share']>[0]) => {
    shareRequest = request;
  },
} as unknown as ToySdk;
assert.equal(await openAuthorSpace(sdkInteractionMock), 'toy');
assert.deepEqual(navigationRequest, { type: 'space', id: '37393114', extra: { from: 'pocpet' } });
const testImageData = 'data:image/jpeg;base64,AA==';
assert.equal(await saveShareImage('pocpet.jpg', testImageData, sdkInteractionMock), 'album');
assert.equal(albumRequest?.base64Data, testImageData);
assert.equal(typeof albumRequest?.hintMsg, 'string');
const shareOperation = openToySharePanel(sdkInteractionMock);
assert.deepEqual(shareRequest, { path: 'index.html' }, 'share must be invoked synchronously in the click stack');
await shareOperation;
const publishedToyUrl = 'https://www.bilibili.com/toy/pocpet/index.html';
const previewToyUrl = 'https://www.bilibili.com/toy/preview/preview_ABC123/index.html';
assert.equal(getSafeToyPageUrl(publishedToyUrl), publishedToyUrl);
assert.equal(getSafeToyPageUrl(previewToyUrl), previewToyUrl);
assert.equal(getSafeToyPageUrl('https://example.com/toy/pocpet/index.html'), undefined);
assert.equal(getSafeToyPageUrl('http://127.0.0.1:5173/'), undefined);
assert.equal(isToyPreviewUrl(previewToyUrl), true);
assert.equal(isToyPreviewUrl(publishedToyUrl), false);

const oldRewardPet = { ...basePet, claimedRewardIds: [...basePet.claimedRewardIds, authorLinkGiftRewardId] };
const followReward = claimAuthorFollowGift(oldRewardPet);
assert.equal(followReward.claimed, true, 'the legacy click reward must not block the new follow reward');
assert.equal(followReward.pet.goldenAppleGacha.tickets, oldRewardPet.goldenAppleGacha.tickets + authorFollowGiftTickets);
assert(followReward.pet.claimedRewardIds.includes(authorFollowGiftRewardId));
assert.equal(claimAuthorFollowGift(followReward.pet).claimed, false);
const reconciledReward = claimAuthorFollowGift(oldRewardPet, false);
assert.equal(reconciledReward.pet.goldenAppleGacha.tickets, oldRewardPet.goldenAppleGacha.tickets);
assert(reconciledReward.pet.claimedRewardIds.includes(authorFollowGiftRewardId));

console.log('Toy cloud save, reminders, sharing data, yearly review, and follow reward checks passed.');
