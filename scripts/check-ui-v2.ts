import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import postcss from 'postcss';
import { createDefaultPet, normalizePet, useInventoryItem, getAchievementViews } from '../src/core/pet';
import { appearancePalette, appearanceStorageKey, appearanceThemes, colorContrast, defaultAppearance, normalizeAppearance, persistAppearance, readAppearance } from '../src/ui/appearance';
import { updatePetSession, type PetSessionState } from '../src/ui/app/petSessionFeedback';
import { createAlbumData, createCurrentReview, createReviewAlbumData, isAlbumArtworkUnlocked } from '../src/ui/albumData';
import { albumPosterSvg } from '../src/platform/albumPoster';
import { acknowledgementsGiftCoins, acknowledgementsGiftRewardId, claimAcknowledgementsGift } from '../src/core/acknowledgementsGift';
import { helpPageGiftRewardId, helpStarterGiftRewardId } from '../src/core/petState';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText } from '../src/core/saveCodec';
import { editionNoticeKey, readEditionNotice, recordEditionNoticeShown, shouldShowEditionNotice } from '../src/core/editionNotice';

// In-memory preferences only; never load or write an actual player's save.
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const preferences = new Map<string, string>([['pocpet.pet.v1', 'untouched-player-save']]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => preferences.get(key) ?? null,
  setItem: (key: string, value: string) => preferences.set(key, value),
} });
try {
  assert.deepEqual(readAppearance(), defaultAppearance);
  for (const theme of appearanceThemes) {
    assert.ok(persistAppearance({ theme: theme.id, color: theme.color }));
    assert.equal(readAppearance().theme, theme.id);
  }
  const custom = { theme: 'custom' as const, color: '#00ffcc' };
  persistAppearance(custom);
  createDefaultPet(); // Switching/creating a companion never changes this key.
  assert.deepEqual(readAppearance(), custom);
  for (const color of ['#ffffff', '#000000', '#ffff00', '#ff00ff', '#00ff00', ...appearanceThemes.map((theme) => theme.color)]) {
    const palette = appearancePalette({ theme: 'custom', color });
    assert.ok(colorContrast(palette['--brand-text'], palette['--app-bg']) >= 4.5);
    assert.ok(colorContrast(palette['--brand-color'], palette['--brand-on']) >= 4.5);
  }
  preferences.set(appearanceStorageKey, '{malformed');
  assert.deepEqual(readAppearance(), defaultAppearance);
  assert.deepEqual(normalizeAppearance({ theme: 'custom', color: 'url(bad)' }), defaultAppearance);
  assert.equal(preferences.get('pocpet.pet.v1'), 'untouched-player-save');
  preferences.set('pocpet.edition-notice.1.9.0.outpost-entrance-scouting', JSON.stringify({ count: 3, lastLaunch: 'old-preview' }));
  preferences.set('pocpet.edition-notice.1.9.0.release-1.9.0', JSON.stringify({ count: 3, lastLaunch: 'before-tutorial' }));
  assert.equal(readEditionNotice().count, 0, 'reading earlier drafts three times does not hide the revised tutorial notice');
  for (let launch = 1; launch <= 3; launch++) {
    const launchId = `formal-${launch}`;
    assert.equal(shouldShowEditionNotice(readEditionNotice(), launchId), true);
    recordEditionNoticeShown(launchId);
    recordEditionNoticeShown(launchId);
    assert.equal(readEditionNotice().count, launch, 'a repeat render in one launch does not spend another reminder');
    assert.equal(shouldShowEditionNotice(readEditionNotice(), launchId), false);
  }
  assert.equal(shouldShowEditionNotice(readEditionNotice(), 'formal-fourth'), false);
  assert.equal(JSON.parse(preferences.get(editionNoticeKey)!).count, 3);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
  assert.deepEqual(readAppearance(), defaultAppearance);
  assert.equal(persistAppearance(custom), false);
} finally {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

const now = Date.now();
const initial = { ...createDefaultPet(now), hunger: 0, inventory: { apple: 3 } };
const session: PetSessionState = { pet: initial, feedback: [] };
const feed = (pet: typeof initial) => useInventoryItem(pet, 'apple', now);
const first = updatePetSession(session, feed, 'action', 1);
assert.deepEqual(updatePetSession(session, feed, 'action', 1), first, 'React replay of one updater produces the same one-operation state');
const second = updatePetSession(first, feed, 'action', 2);
assert.equal(second.pet.inventory.apple, 1);
assert.deepEqual(second.feedback.map((entry) => entry.id), [1, 2], 'consecutive feeds each provide feedback');
assert.equal(initial.inventory.apple, 3, 'updaters do not mutate their input');
const sameMessage = updatePetSession(second, { ...second.pet }, 'action', 3);
assert.equal(sameMessage.feedback[2].text, sameMessage.feedback[1].text, 'same text is still a distinct action notification');
const tick = updatePetSession(sameMessage, { ...sameMessage.pet, lastUpdatedAt: now + 1000 }, 'event', 4);
assert.equal(tick.feedback, sameMessage.feedback, 'a normal clock tick never re-announces an old event');
const navigation = updatePetSession(tick, { ...tick.pet, hasOpenedHelp: true }, 'quiet', 5);
assert.equal(navigation.feedback, tick.feedback);
const completed = updatePetSession(navigation, { ...navigation.pet, recentEvent: 'Activity complete' }, 'event', 6);
assert.equal(completed.feedback.at(-1)?.text, 'Activity complete');

const recorded = normalizePet({ ...createDefaultPet(now), ageSeconds: 10 * 86400, garden: { ...initial.garden, lifetimeHarvestCount: 7 } }, now);
recorded.yearlyStats.itemUseCount = 2;
recorded.yearlyStats.pomodoroFocusCount = 3;
recorded.achievements.counters.totalItemUseCount = 11;
const beforeAlbum = JSON.stringify(recorded);
const allData = createAlbumData(recorded);
assert.equal(allData.metrics[1].value, '11');
assert.equal(allData.metrics[2].value, '7');
const yearData = createReviewAlbumData(recorded.name, createCurrentReview(recorded), true);
assert.equal(yearData.metrics[3].value, '2');
assert.equal(yearData.metrics[4].value, '3');
assert.equal(createCurrentReview(recorded).companionDays, 1, 'current-year days do not include days that have not happened');
const oldReview = { year: 2025, companionDays: 130, activeDays: 88, careActions: 42, itemUseCount: 19, pomodoroFocusCount: 4 };
assert.equal(createReviewAlbumData(recorded.name, oldReview).metrics[2].value, '42');
assert.equal(JSON.stringify(recorded), beforeAlbum, 'album reads never backfill or change a save');
const visibleArtPet = { ...recorded, achievements: { ...recorded.achievements, unlockedAtById: { ...recorded.achievements.unlockedAtById, hidden_good_ending_year_1: now } } };
const artwork = getAchievementViews(visibleArtPet).find((entry) => entry.reward.cgId)!;
const lockedArt = { ...artwork, unlocked: false };
assert.ok(lockedArt);
assert.equal(isAlbumArtworkUnlocked(recorded, lockedArt), false);
assert.equal(isAlbumArtworkUnlocked(recorded, { ...lockedArt, unlocked: true }), false);
const artPet = { ...recorded, achievements: { ...recorded.achievements, unlockedCgIds: [lockedArt.reward.cgId!] } };
assert.equal(isAlbumArtworkUnlocked(artPet, { ...lockedArt, unlocked: true }), true);
const escapedPoster = albumPosterSvg({ ...allData, name: '<script> & "name"', title: '很长的伙伴名片'.repeat(12) }, 'data:image/png;base64,test');
assert.ok(escapedPoster.includes('&lt;script&gt; &amp; &quot;name&quot;'));
assert.ok(escapedPoster.includes('lengthAdjust="spacingAndGlyphs"'));
assert.equal((escapedPoster.match(/width="386"/g) ?? []).length, 6);
console.log('UI v2 data: independent themes, storage failures, contrast, repeat feedback, quiet ticks, album scopes and artwork gates passed.');

assert.equal(acknowledgementsGiftCoins, 1000);
for (const oldClaims of [[], [helpStarterGiftRewardId], [helpPageGiftRewardId], [helpStarterGiftRewardId, helpPageGiftRewardId]]) {
  const fresh = createDefaultPet(now);
  const before = normalizePet({ ...fresh, claimedRewardIds: [...fresh.claimedRewardIds, ...oldClaims] }, now);
  const original = JSON.stringify(before);
  const claimed = claimAcknowledgementsGift(before);
  assert.equal(claimed.coins, before.coins + 1000, 'both new players and recipients of either retired gift receive the new full gift');
  assert.equal(claimed.achievements.counters.coinEarnedTotal, before.achievements.counters.coinEarnedTotal + 1000);
  assert.deepEqual(claimed.claimedRewardIds, [...before.claimedRewardIds, acknowledgementsGiftRewardId]);
  assert.equal(JSON.stringify(before), original, 'claiming never mutates the prior save');
  assert.deepEqual(claimAcknowledgementsGift(before), claimed, 'React replay computes the same one-gift result');
  assert.equal(claimAcknowledgementsGift(claimed), claimed, 'repeated clicks do not grant coins or statistics again');
  for (const saved of [before, claimed]) {
    const text = createSaveFileText(saved, null, now);
    const local = loadStoredPetJson(text, now, { neighbors: [], giftCandidates: [], random: () => 0 });
    assert.equal(local.status, 'ok');
    if (local.status !== 'ok') throw new Error('Gift test save did not load');
    for (const restored of [local.pet, parseSaveFileText(text, now).pet]) {
      assert.equal(restored.coins, saved.coins);
      if (saved === claimed) assert.equal(claimAcknowledgementsGift(restored), restored, 'the receipt survives local reloads and file imports');
      else assert.equal(claimAcknowledgementsGift(restored).coins, restored.coins + 1000, 'an unclaimed gift remains available after restoring');
    }
  }
}
const oldHelpFlag = normalizePet({ ...createDefaultPet(now), hasClaimedHelpGift: true }, now);
assert.ok(oldHelpFlag.claimedRewardIds.includes(helpStarterGiftRewardId));
assert.equal(claimAcknowledgementsGift(oldHelpFlag).coins, oldHelpFlag.coins + 1000, 'the oldest help flag does not block the new gift');
console.log('Acknowledgements gift: new/legacy eligibility, 1000 coins, statistics, replay, duplicate claims and save round trips passed.');

const noop = () => {};
for (const mode of ['development', 'toy']) {
  const server = await createServer({ mode, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const paths = ['core/pet', 'i18n/index', 'assets', 'ui/HomePageV2', 'ui/CompanionStatus', 'ui/GardenPage', 'ui/PartnerSchedulePage', 'ui/BoostCardModal', 'ui/GoldenAppleGachaModal', 'ui/SettingsModal', 'ui/MemoryAlbum', 'ui/RolePicker', 'ui/CommonDreamsPage', 'ui/NoticeCenter', 'ui/YearReviewModal', 'ui/App', 'ui/EditionNoticeDialog', 'ui/ItemStorageModal', 'ui/ItemRecoveryPreview'];
    const modules = await Promise.all(paths.map((path) => server.ssrLoadModule(`/src/${path}.${path.startsWith('ui/') ? 'tsx' : 'ts'}`)));
    const [core, locale, assets, home, status, garden, schedule, cards, gacha, settings, album, roles, dreams, notices, annual, app, editionNotice, storage, recovery] = modules;
    const textFiles = await server.ssrLoadModule('/src/platform/saveTextFile.ts');
    const gachaPresentation = await server.ssrLoadModule('/src/ui/gachaRewards.ts');
    const gachaPoster = await server.ssrLoadModule('/src/platform/sharePoster.ts');
    const [giftBubble, giftCore, rewardController] = await Promise.all([
      server.ssrLoadModule('/src/ui/FloatingRewardBubble.tsx'),
      server.ssrLoadModule('/src/core/communityWorkGift.ts'),
      server.ssrLoadModule('/src/ui/app/useRewardController.ts'),
    ]);
    const edition = await server.ssrLoadModule('/src/platform/edition.ts');
    assert.equal(edition.features.saveFileDownload, mode !== 'toy');
    assert.equal(edition.requiresAuthorFollowVerification(), mode === 'toy', 'Bilibili still requires verification even before its SDK loads');
    if (mode === 'toy') {
      assert.equal(textFiles.canShareTextFile('test.pocpet', 'test'), false);
      await assert.rejects(textFiles.saveTextFile('test.pocpet', 'test'), /B 站|Bilibili/);
      await assert.rejects(textFiles.shareTextFile('test.pocpet', 'test'), /B 站|Bilibili/);
    }
    const { useToyIntegration } = await server.ssrLoadModule('/src/ui/app/useToyIntegration.ts');
    const priorRewardWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const rewardPetRef = { current: core.createDefaultPet(now) };
    const pending = new Map<string, string>();
    const rewards: number[] = [];
    let opened = 0;
    let failOpen = false;
    const openAuthor = () => { if (failOpen) throw new Error('open failed'); opened++; };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      localStorage: { getItem: (key: string) => pending.get(key) ?? null, setItem: (key: string, value: string) => pending.set(key, value), removeItem: (key: string) => pending.delete(key) },
      open: openAuthor,
      ...(mode === 'toy' ? { toy: { navigate: async () => openAuthor() } } : {}),
    } });
    try {
      let integration: any;
      const RewardHarness = () => {
        integration = useToyIntegration({ pet: rewardPetRef.current, petRef: rewardPetRef, activeMod: null,
          setPet: (update: any) => {
            const before = rewardPetRef.current;
            const first = typeof update === 'function' ? update(before) : update;
            const replay = typeof update === 'function' ? update(before) : update;
            assert.deepEqual(first, replay, 'React updater replay preserves the same reward state');
            rewardPetRef.current = replay;
          },
          commitPet: (pet: any) => pet, onMessage: noop, onAuthorReward: (tickets: number) => rewards.push(tickets),
        });
        return null;
      };
      renderToStaticMarkup(createElement(RewardHarness));
      failOpen = true;
      await integration.openAuthorSpace();
      assert.deepEqual(rewards, [], 'a failed author navigation grants nothing');
      failOpen = false;
      await Promise.all([integration.openAuthorSpace(), integration.openAuthorSpace()]);
      assert.equal(opened, 2);
      assert.deepEqual(rewards, mode === 'toy' ? [] : [10], 'standard grants ten tickets once; Bilibili waits for verification');
      assert.equal(rewardPetRef.current.claimedRewardIds.includes(core.authorFollowGiftRewardId), mode !== 'toy');
    } finally {
      if (priorRewardWindow) Object.defineProperty(globalThis, 'window', priorRewardWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
    const rich = core.normalizePet({ ...core.createDefaultPet(now), level: 20, coins: 100000, hearts: 1000, energy: 190, hunger: 190, mood: 190, cleanliness: 190, health: 190 }, now);
    const render = (component: any, props: any) => {
      // Browser file-picker capability probing needs window, but no DOM or storage.
      const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
      if (component === settings.SettingsModal) Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
      let html: string;
      try { html = renderToStaticMarkup(createElement(component, props)); }
      finally {
        if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
        else Reflect.deleteProperty(globalThis, 'window');
      }
      assert.ok(!/src="undefined"|NaN|\[object Object\]/.test(html), 'rendered page contains valid values and assets');
      return html;
    };
    const homeProps = { pet: rich, actorId: 'official.furo', neighbors: [], adventure: { status: 'locked' }, hasAchievementNotice: false, petStatusImages: assets.petStatusImages, petActivityImages: assets.petActivityImages, getStatusLabel: () => 'content', canUpgrade: true, nextUpgradeCost: 8 };
    const settingsProps = {
      pet: rich, portrait: assets.petStatusImages.content, appearance: defaultAppearance, isAudioEnabled: true,
      backupController: { state: { snapshots: [], fileStatus: 'unconfigured' }, preferences: { enabled: true, intervalDays: 1 }, busy: false },
      updateController: { supported: false, preferences: { enabled: true } }, activeMod: null, installedMods: [], modMessage: '', draftName: rich.name, draftBirthday: rich.birthday, metDate: rich.metDate,
      saveText: '', importSaveText: '', hasImportBackup: false, hasOpenedHelp: false, hasClaimedAuthorFollowGift: false, hasClaimedAcknowledgementsGift: false,
      cloudAvailability: 'available', cloudUsedFallback: false, cloudBusy: null, cloudReminderEnabled: true, cloudReminderDue: false, hasLatestYearReview: false, shareBusy: null,
      cloudManifest: { schemaVersion: 1, generation: 'a', encoding: 'zip-deflate-base64', encodedLength: 4096, chunkCount: 4, checksum: '00000000', uploadedAt: new Date(now).toISOString(), petName: rich.name, petLevel: rich.level },
      authorSummary: {}, authorVideo: {}, isAuthorLoading: false,
      ...Object.fromEntries(['onClose', 'onAppearanceChange', 'onAudioToggle', 'onDraftNameChange', 'onDraftBirthdayChange', 'onLanguageChange', 'onImportSaveTextChange', 'onCloudReminderEnabledChange', 'onClaimAcknowledgementsGift'].map((key) => [key, noop])),
    };
    for (const language of ['zh-CN', 'en-US']) {
      locale.setLanguage(language);
      let giftPet = core.normalizePet({ ...rich, saveMetadata: { ...rich.saveMetadata, communityWorkGift: undefined } }, now);
      const pendingGift = rewardController.getAvailableFloatingReward(giftPet);
      assert.equal(pendingGift.id, giftCore.communityWorkGiftRewardId, 'the community-work ticket gift remains available');
      assert.equal(rewardController.getAvailableFloatingReward(rich), undefined, 'new saves no longer show the retired starter coin bubble');
      const giftHtml = render(giftBubble.FloatingRewardBubble, { reward: pendingGift, onClaim: noop });
      assert.ok(giftHtml.includes(locale.t('ui.rewards.communityWorkGiftTickets', { count: 10 })));
      assert.ok(giftHtml.includes(`aria-label="${locale.t('ui.rewards.communityWorkGiftClaim', { count: 10 })}"`));
      assert.ok(giftHtml.includes('floating-reward-button--labeled') && !giftHtml.includes('ui.rewards.'));
      const beforeTickets = giftPet.goldenAppleGacha.tickets;
      let giftController: any;
      const loadedMod = { current: true };
      const GiftHarness = () => {
        giftController = rewardController.useRewardController({ pet: giftPet,
          setPet: (update: any) => {
            const before = giftPet;
            const first = update(before);
            const replay = update(before);
            assert.deepEqual(first, replay, 'replaying the UI reward updater preserves a single gift');
            giftPet = replay;
          },
          commitPet: (pet: any) => pet, hasLoadedModRef: loadedMod, playAfterUnlock: noop,
        });
        return null;
      };
      renderToStaticMarkup(createElement(GiftHarness));
      assert.equal(giftPet.goldenAppleGacha.tickets, beforeTickets, 'rendering the bubble does not claim the gift');
      giftController.claimFloatingReward(pendingGift);
      giftController.claimFloatingReward(pendingGift);
      assert.equal(giftPet.goldenAppleGacha.tickets, beforeTickets + 10, 'rapid duplicate clicks grant exactly ten tickets');
      assert.equal(rewardController.getAvailableFloatingReward(giftPet), undefined, 'no starter coin bubble follows the ticket gift');
      const beforeCoins = giftPet.coins;
      for (const id of [helpStarterGiftRewardId, helpPageGiftRewardId]) giftController.claimFloatingReward({ id, coins: 800, eventKey: 'pet.reward.helpStarterGift' });
      assert.equal(giftPet.coins, beforeCoins, 'stale callbacks cannot claim retired coin gifts');
      loadedMod.current = false;
      giftController.claimAcknowledgementsGift();
      assert.equal(giftPet.coins, beforeCoins, 'wait until the player state is loaded');
      loadedMod.current = true;
      giftController.claimAcknowledgementsGift();
      giftController.claimAcknowledgementsGift();
      assert.equal(giftPet.coins, beforeCoins + 1000, 'duplicate UI clicks claim the acknowledgements gift once');
      assert.ok(giftPet.recentEvent.includes('1000') && !giftPet.recentEvent.includes('pet.reward.'));
      renderToStaticMarkup(createElement(GiftHarness));
      assert.equal(giftController.hasClaimedAcknowledgementsGift, true);
      const announcementHtml = render(editionNotice.EditionNoticeDialog, { onAcknowledge: noop, onBackup: noop, onOpenAcknowledgements: noop });
      for (const key of ['intro', 'adventureTutorial', 'adventureAdvice', 'adventureRewards', 'festivalAdvice', 'kitchenAdvice', 'communityAdvice', 'communityBalance', 'gardenAdvice', 'gachaAdvice', 'giftTitle', 'giftAdvice', 'giftEligibility', 'openAcknowledgements', 'uiAdvice', 'backup', 'backupAdvice', 'formatTimeline', 'compensationAdvice', 'closing', mode === 'toy' ? 'downloadFallback' : 'localBackupAdvice']) {
        const text = locale.t(`ui.editionNotice.${key}`, { coins: 1000 });
        const escaped = renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
        assert.ok(announcementHtml.includes(escaped), `announcement ${mode}/${language}: ${text}`);
      }
      assert.ok(!announcementHtml.includes('ui.editionNotice.') && !announcementHtml.includes('{coins}'), 'formal notice translations and reward values resolve in both editions');
      const ringHtml = render(status.CompanionStatus, { pet: rich });
      assert.equal((ringHtml.match(/class="ring-value"/g) ?? []).length, 5);
      assert.ok(ringHtml.includes(`190 / ${core.getPetEnergyCap(rich)}`));
      assert.ok(ringHtml.includes(`190 / ${core.getPetStatCap(rich)}`));
      const allDone = { ...rich, dailyWish: { ...rich.dailyWish, claimedAt: now }, returnWelcome: undefined };
      assert.ok(!render(home.HomePageV2, { ...homeProps, pet: allDone }).includes('class="home-today"'));
      const subscribed = core.buyBoostCard(allDone, 'friend_pass', now);
      assert.ok(render(home.HomePageV2, { ...homeProps, pet: subscribed }).includes('class="home-today"'));
      const claimed = core.claimBoostCardDailyReward(subscribed, undefined, now).pet;
      assert.ok(!render(home.HomePageV2, { ...homeProps, pet: claimed }).includes('class="home-today"'));
      const hasClaimDot = (pet: any, buttonMarker: string, extra = {}) => {
        const html = render(home.HomePageV2, { ...homeProps, pet, gardenReminder: core.getGardenReminder(pet, now), ...extra });
        const button = html.match(/<button\b[\s\S]*?<\/button>/g)?.find(entry => entry.includes(buttonMarker));
        assert.ok(button, `missing home button: ${buttonMarker}`);
        return button.includes('claim-notice-dot');
      };
      assert.equal(hasClaimDot(subscribed, 'data-tone="rose"'), true);
      assert.equal(hasClaimDot(claimed, 'data-tone="rose"'), false, 'friend card dot clears after claiming');
      assert.equal(hasClaimDot(allDone, 'data-tone="lilac"'), true);
      assert.equal(hasClaimDot(core.claimGoldenAppleGachaStarterGift(allDone).pet, 'data-tone="lilac"'), false, 'welcome gift dot clears after claiming');
      const gardenGiftClaimed = { ...allDone, claimedRewardIds: [...allDone.claimedRewardIds, core.gardenCompensationRewardId] };
      assert.equal(hasClaimDot(allDone, 'home-quick garden'), true, 'garden compensation is claimable too');
      assert.equal(hasClaimDot(gardenGiftClaimed, 'home-quick garden', { gardenReminder: 'withered' }), false, 'withered plants alone do not imply a reward');
      const rewardView = core.getAchievementViews(allDone).find((view: any) => view.reward.coins && !view.claimed);
      assert.ok(rewardView);
      const achievementReady = { ...allDone, achievements: { ...allDone.achievements, unlockedAtById: { [rewardView.id]: now } } };
      assert.equal(hasClaimDot(achievementReady, 'data-tone="gold"'), true);
      assert.equal(hasClaimDot(core.claimAllAchievementRewards(achievementReady, now).pet, 'data-tone="gold"'), false, 'achievement reward dot clears after claiming');
      const dreamSupplement = { ...allDone, classicEndgame: { ...allDone.classicEndgame, projects: { ...allDone.classicEndgame.projects, study: { ...allDone.classicEndgame.projects.study, completedStages: 3 } } } };
      assert.equal(hasClaimDot(dreamSupplement, 'data-tone="sky"'), true);
      assert.equal(hasClaimDot(core.claimDreamProjectSupplySupplement(dreamSupplement, 'study', now), 'data-tone="sky"'), false, 'dream supply dot clears after claiming');
      const entryProps = { adventure: { status: 'available', onOpen: noop } };
      assert.equal(hasClaimDot(allDone, 'class="home-adventure"', entryProps), true, 'the outpost starter supply is available');
      assert.equal(hasClaimDot({ ...allDone, adventure: { ...allDone.adventure, starterClaimed: true, starterMealsClaimed: true } }, 'class="home-adventure"', entryProps), false);
      const adventureHome = render(home.HomePageV2, { ...homeProps, ...entryProps });
      assert.ok(adventureHome.includes('home-adventure-background') && adventureHome.includes('outpost-hall.webp'));
      const cardHtml = render(cards.BoostCardModal, { pet: subscribed, onClose: noop, onBuyCard: noop, onClaimDailyReward: noop });
      assert.ok(cardHtml.includes('dialog-shell--fullscreen') && cardHtml.includes('friend-card-expiry'));
      const gachaHtml = render(gacha.GoldenAppleGachaModal, { pet: rich, itemIconMap: assets.itemIcons, onClose: noop, onDraw: noop, onHeartDraw: noop, onClaimStarterGift: noop, onSaveResults: noop, onClearSaveFeedback: noop, onPlaySfx: noop, isSavingResults: false, saveFeedback: '' });
      assert.ok(gachaHtml.includes('dialog-shell--fullscreen'));
      assert.ok(gachaHtml.includes('gacha-prize-preview') && gachaHtml.includes('10%'));
      assert.ok(gachaHtml.includes('35%') && gachaHtml.includes('40%'), 'supply and coin group odds reflect the adjusted pool');
      const fruitCrate = core.goldenAppleGachaRewards.find((reward: any) => reward.id === 'fruit_crate_v1');
      const fruitResult = { ...fruitCrate, rewardId: fruitCrate.id, id: 'test-fruit', guaranteed: false, pityGuaranteed: false, drawnAt: now };
      const fruitLabel = gachaPresentation.getGachaRewardLabel(fruitResult);
      assert.ok(gachaHtml.includes(fruitLabel) && !/ui\.gacha\./.test(gachaHtml), 'box preview names and copy are translated');
      for (const label of gachaPresentation.getGachaRewardContentLabels(fruitResult)) assert.ok(gachaHtml.includes(label), 'all three fixed contents appear before drawing');
      const fruitArt = render(gacha.GachaRewardArtwork, { reward: fruitResult, itemIconMap: assets.itemIcons });
      assert.equal((fruitArt.match(/<img /g) ?? []).length, 3, 'the crate displays all three existing item icons');
      for (const kind of ['probabilities', 'history']) {
        const details = render(gacha.GachaDetailDialog, { kind, machine: 'apple', results: [fruitResult], gachaState: rich.goldenAppleGacha, itemIconMap: assets.itemIcons, onClose: noop });
        assert.ok(details.includes(fruitLabel));
        for (const label of gachaPresentation.getGachaRewardContentLabels(fruitResult)) assert.ok(details.includes(label), 'probability and history views retain the box contents');
      }
      const summary = render(gacha.GachaResultsSummary, { results: [fruitResult, { ...fruitResult, id: 'test-fruit-2' }], itemIconMap: assets.itemIcons });
      assert.equal((summary.match(/<strong>×12<\/strong>/g) ?? []).length, 3, 'two fruit crates summarize as twelve of each fruit');

      const goldenPet = { ...structuredClone(rich), level: 99, hunger: 1, mood: 1, cleanliness: 1, health: 1, energy: 1, inventory: { golden_apple: 1 } };
      for (const project of Object.values(goldenPet.classicEndgame.projects) as { completedStages: number }[]) project.completedStages = 5;
      const goldenItems = core.getInventoryDefinitions(core.createBuiltinItemRegistry(), goldenPet.inventory);
      const goldenBag = render(storage.ItemStorageModal, { mode: 'bag', pet: goldenPet, items: goldenItems, itemIconMap: assets.itemIcons,
        browse: { category: 'all', query: '', selectedId: 'golden_apple', quantity: 1 }, onBrowseChange: noop, onClose: noop, onSwitch: noop, renderActions: () => null });
      const goldenPreview = render(recovery.ItemRecoveryPreview, { pet: goldenPet, item: goldenItems[0] });
      for (const key of ['hunger', 'mood', 'cleanliness', 'energy', 'health']) {
        const label = `${locale.t(`ui.stats.${key}`)} +${key === 'energy' ? 370 : 295}`;
        assert.ok(goldenBag.includes(label), `golden apple inventory badge: ${label}`);
        assert.ok(goldenPreview.includes(label), `golden apple recovery preview: ${label}`);
      }

      // Exercise the real poster drawing path without a browser or a player save.
      const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
      const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
      const drawnTexts: string[] = [];
      const drawnImages: number[][] = [];
      const context = new Proxy<Record<string, any>>({}, { get: (target, key: string) => {
        if (key === 'fillText') return (text: string, x: number, y: number) => { assert.ok(x >= 0 && y < 1440); drawnTexts.push(text); };
        if (key === 'drawImage') return (_image: unknown, ...bounds: number[]) => { drawnImages.push(bounds); };
        if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop: noop });
        return target[key] ?? noop;
      } });
      Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,test' }) } });
      Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
        naturalWidth = 128; naturalHeight = 128; onload?: () => void;
        set src(_url: string) { queueMicrotask(() => this.onload?.()); }
      } });
      try {
        for (const count of [1, 10]) {
          drawnTexts.length = 0;
          drawnImages.length = 0;
          await gachaPoster.createGachaPoster({ machine: 'apple', results: Array.from({ length: count }, (_, index) => ({ ...fruitResult, id: `fruit-${index}` })), itemIconMap: assets.itemIcons, petImageUrl: '', createdAt: now });
          assert.equal(drawnTexts.filter((text) => text === fruitLabel).length, count);
          for (const label of gachaPresentation.getGachaRewardContentLabels(fruitResult)) assert.equal(drawnTexts.filter((text) => text === label).length, count, 'single and ten-draw posters include every content amount');
          assert.equal(drawnImages.length, count * 3);
          for (const [x, y, width, height] of drawnImages) assert.ok(x >= 0 && y >= 0 && x + width <= 1080 && y + height < 1300, 'all prize icons stay above the poster footer');
        }
      } finally {
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
        if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage); else Reflect.deleteProperty(globalThis, 'Image');
      }
      for (const machine of ['apple', 'heart']) {
        const machineHtml = render(gacha.GachaMachineArt, { machine, phase: 'charging', itemIconMap: assets.itemIcons });
        assert.equal((machineHtml.match(/class="v2-gacha-prize"/g) ?? []).length, 5);
        assert.ok(machineHtml.includes('data-phase="charging"'));
      }
      const gardenHtml = render(garden.GardenPage, { pet: rich, itemIconMap: assets.itemIcons });
      assert.equal((gardenHtml.match(/<article class="garden-plot /g) ?? []).length, 5);
      assert.ok(!gardenHtml.includes('garden-selected-detail'));
      const gardenDay = core.getEffectiveDailyDateKey(rich, now);
      const mixedGarden = { ...rich, coins: 0, inventory: { ...rich.inventory, normal_fertilizer: 5, heart_fertilizer: 5, harvest_nutrient: 5 }, garden: { ...rich.garden, activeSlotIndex: 4, slots: rich.garden.slots.map((slot: any, index: number) => ({
        ...slot, unlocked: index < 4,
        state: ['empty', 'growing', 'ready', 'withered', 'empty'][index],
        treeId: [undefined, 'fruit_tree', 'money_tree', 'fruit_tree', undefined][index],
        plantedAt: now - 3600000, naturalReadyAt: now + 86400000, nextReadyAt: now + 86400000,
        harvestsUsed: index === 3 ? 8 : 1, maxHarvests: 8,
        lastWateredDateKey: index === 1 ? gardenDay : '',
        lastFertilizedDateKey: index === 1 ? gardenDay : '',
        fertilizerType: index === 1 ? 'normal' : undefined,
        lastBoostedDateKey: index === 1 ? gardenDay : '',
        pendingDrops: index === 2 ? [{ kind: 'coins', amount: 123 }] : [],
      })) } };
      const mixedGardenHtml = render(garden.GardenPage, { pet: mixedGarden, itemIconMap: assets.itemIcons, compensationCoins: 100, onClaimCompensation: noop });
      const harvestPet = { ...mixedGarden, claimedRewardIds: [...mixedGarden.claimedRewardIds, core.gardenCompensationRewardId] };
      assert.equal(hasClaimDot(harvestPet, 'home-quick garden'), true);
      assert.equal(hasClaimDot(core.harvestTree(harvestPet, 2, now), 'home-quick garden'), false, 'garden dot clears after the last ripe plot is harvested');
      const plots = mixedGardenHtml.match(/<article class="garden-plot [\s\S]*?<\/article>/g)!;
      assert.equal(plots.length, 5);
      for (const [index, state] of ['empty', 'growing', 'ready', 'withered', 'locked'].entries()) assert.ok(plots[index].includes(`garden-plot--${state}`));
      assert.ok(plots[0].includes(locale.t('ui.garden.chooseSapling')));
      assert.ok(plots[1].includes(locale.t('ui.garden.actions.water')) && plots[1].includes('1/8'));
      assert.equal((plots[1].match(/class="garden-choice" disabled=""/g) ?? []).length, 1, 'the plot disables watering already done today');
      assert.ok(plots[1].includes('garden-manage-button') && !plots[1].includes(locale.t('ui.garden.actions.normalFertilizer')), 'fertilizer actions now live in the existing management dialog');
      assert.ok(!plots[1].includes(locale.t('ui.garden.actions.nutrient')), 'ordinary trees only offer watering and the two fertilizers');
      assert.ok(plots[2].includes('garden-tree-fruits') && plots[2].includes('+123') && plots[2].includes(locale.t('ui.garden.actions.harvest')));
      assert.ok(plots[3].includes(locale.t('ui.garden.actions.clear', { coins: core.getGardenClearCost(mixedGarden.garden.tools, 'fruit_tree') })));
      assert.ok(plots[4].includes('disabled=""') && plots[4].includes(locale.t('ui.garden.unlockSlot', { coins: core.gardenSlotUnlockCosts[4] })));
      assert.ok(mixedGardenHtml.includes(locale.t('ui.garden.compensationGiftLabel', { coins: 100 })), 'compensation remains available on the board');
      const servicePet = { ...core.createDefaultPet(now), hearts: 20, energy: 100, hunger: 100, mood: 100, health: 100 };
      const serviceProps = { itemIconMap: assets.itemIcons, neighbors: [], onBack: noop, onStart: noop, onCancel: noop, onClaim: noop, onRefresh: noop, onQuickWork: noop };
      const idleService = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: servicePet });
      const communityTitle = language === 'zh-CN' ? '社区工作' : 'Community work';
      assert.ok(idleService.includes(`<h2>${communityTitle}</h2>`));
      assert.ok(idleService.includes('schedule-category-tabs') && idleService.includes('community-quick-work'));
      assert.equal((idleService.match(/class="community-offer"/g) ?? []).length, 4, 'four requests are shown from level 1');
      assert.equal((idleService.match(/data-state="available"/g) ?? []).length, 4);
      assert.ok(!/ui\.partnerSchedule\.|pet\.partnerSchedule\./.test(idleService), 'service copy is translated');
      const newHome = render(home.HomePageV2, { ...homeProps, pet: servicePet });
      const serviceEntry = newHome.match(/<button[^>]*home-quick schedule[\s\S]*?<\/button>/)?.[0];
      assert.ok(serviceEntry && !serviceEntry.includes('disabled=""'), 'the community entry has no level gate');
      assert.ok(serviceEntry.includes(communityTitle), 'home and the work page share the current name');
      assert.ok(!newHome.includes('home-quick work'), 'quick work shares the community entrance');
      const started = core.startPartnerSchedule(servicePet, servicePet.partnerSchedule.offers[1].id, now);
      assert.ok(started.partnerSchedule.active);
      const activeHtml = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: started });
      assert.ok(activeHtml.includes('partner-schedule-active') && activeHtml.includes('community-active-facts'));
      assert.ok(/community-refresh" disabled=""/.test(activeHtml), 'active requests block a paid refresh');
      const completed = core.advancePartnerSchedule(started, started.partnerSchedule.active.endsAt + 1);
      assert.equal(hasClaimDot(completed, 'home-quick schedule'), true);
      assert.equal(hasClaimDot(core.claimPartnerScheduleResult(completed, 'coins', now), 'home-quick schedule'), false, 'work dot clears after settlement');
      const fullHtml = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: completed });
      assert.ok(fullHtml.includes('partner-schedule-result') && fullHtml.includes('data-state="pending"'));
      const settlement = fullHtml.match(/<div class="community-claim-options">([\s\S]*?)<\/section>/)?.[1] ?? '';
      assert.equal((settlement.match(/<button/g) ?? []).length, 2, 'full standard service offers both reward choices');
      const returned = core.cancelPartnerSchedule(started, now + 30 * 60000);
      const partialHtml = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: returned });
      assert.ok(partialHtml.includes('community-settlement--early') && partialHtml.includes('data-state="ended"'));
      const partialOptions = partialHtml.match(/<div class="community-claim-options">([\s\S]*?)<\/section>/)?.[1] ?? '';
      assert.equal((partialOptions.match(/<button/g) ?? []).length, 1, 'early return only offers partial coin pay');
      const exhaustedPet = { ...servicePet, partnerSchedule: { ...servicePet.partnerSchedule, completedOfferIds: servicePet.partnerSchedule.offers.map((offer: any) => offer.id) } };
      const exhaustedHtml = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: exhaustedPet });
      assert.ok(exhaustedHtml.includes('community-board-empty'));
      assert.equal((exhaustedHtml.match(/data-state="completed"/g) ?? []).length, 4);
      const poorHtml = render(schedule.PartnerSchedulePage, { ...serviceProps, pet: { ...servicePet, hearts: 0 } });
      assert.ok(/community-refresh" disabled=""/.test(poorHtml) && poorHtml.includes('community-refresh-hint'));
      for (const page of ['main', 'appearance', 'mod', 'save', 'share', 'updates', 'help', 'acknowledgements']) {
        const html = render(settings.SettingsModal, { ...settingsProps, initialPage: page, language });
        assert.ok(html.includes('class="settings-page"') && !html.includes('role="dialog"'));
        assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
        if (page === 'main') assert.equal(html.includes('readonly=""'), mode === 'toy');
        if (page === 'mod') assert.equal(html.includes('type="file"'), mode !== 'toy');
        if (page === 'save') {
          assert.equal(html.includes(`>${locale.t('ui.settings.save.download')}</button>`), mode !== 'toy');
          assert.equal(html.includes(locale.t('ui.settings.save.fileDownloadDisabled')), mode === 'toy');
          assert.ok(html.includes(locale.t('ui.settings.save.exportText')), 'text export remains available');
          assert.equal(html.includes('class="settings-cloud-panel"'), mode === 'toy');
          assert.ok(html.includes(locale.t('ui.settings.save.formatV2')));
          assert.ok(html.includes(locale.t('ui.settings.save.newProgress')));
          assert.equal(html.includes('4.0 / 60 KiB'), mode === 'toy');
        }
        if (page === 'help') {
          assert.ok(html.includes(locale.t(mode === 'toy' ? 'ui.settings.author.rewardAvailable' : 'ui.settings.author.visitRewardAvailable', { count: core.authorFollowGiftTickets })));
          assert.ok(!html.includes('help-gift-button'), 'the old help-page coin bubble is removed');
          assert.ok(html.includes('acknowledgements-entry') && html.includes('1000'), 'the help page points players to the new gift');
        }
        if (page === 'acknowledgements') {
          const claimButton = html.match(/<button\b[^>]*>[\s\S]*?1000[\s\S]*?<\/button>/)?.[0];
          assert.ok(claimButton && !claimButton.includes('disabled=""'), 'the supporter list offers the 1000-coin gift');
          const claimedHtml = render(settings.SettingsModal, { ...settingsProps, initialPage: page, language, hasClaimedAcknowledgementsGift: true });
          assert.ok(/<button[^>]*disabled=""[^>]*>[\s\S]*?(已领取|Claimed)/.test(claimedHtml), 'the collected gift stays visible and disabled');
          for (const name of ['ManoT95', '银点', '我是苔丝的奶香魔法棒', '影ch-']) assert.ok(claimedHtml.includes(name));
        }
      }
      const memoryPet = { ...rich, latestYearReview: oldReview, companionMemories: { schemaVersion: 1, entries: [
        { id: 'one', actorId: 'official.furo', kind: 'first_taste', subject: 'dish_egg_rice', at: now, mentionedAt: 0 },
        { id: 'two', actorId: 'sample.mod', kind: 'catch_record', subject: 'catch', at: now, mentionedAt: 0 },
      ] } };
      for (const actorId of ['official.furo', 'sample.mod']) {
        const albumHtml = render(album.MemoryAlbum, { pet: memoryPet, actorId, portrait: assets.petStatusImages.content, onBack: noop, onOpenArt: noop, onSave: noop, onError: noop });
        assert.equal((albumHtml.match(/class="memory-note /g) ?? []).length, 1, 'album only shows the current companion memories');
        assert.ok(albumHtml.includes('2025') && !albumHtml.includes(assets.goodEndingImage));
      }
      const roleHtml = render(roles.RolePicker, { installedMods: [{ manifest: { id: 'sample.mod', name: 'Sample Mod', defaultPetName: 'Buddy', version: '1.0.0' }, contentImageUrl: '/test/mod-portrait.png' }], modMessage: '', isAudioEnabled: false });
      assert.ok(roleHtml.includes('Sample Mod') && roleHtml.includes('Mint') && roleHtml.includes('Doro'));
      assert.equal(roleHtml.includes('role-card--import'), mode !== 'toy');
      assert.ok(render(dreams.CommonDreamsPage, { pet: rich }).includes('dream-stage-trail'));
      assert.ok(render(annual.YearReviewModal, { review: oldReview, isSaving: false, saveFeedback: '' }).includes('data-tone="rose"'));
      let history: any[] = [];
      for (let id = 1; id <= 25; id++) history = notices.appendNotice(history, { id, text: '同一条操作反馈 · Same action', kind: 'info', at: now });
      assert.equal(history.length, 20);
      assert.equal(history[0].id, 25);
      assert.equal(history[19].id, 6);
      const noticeHtml = render(notices.NoticeCenter, { controller: { history, current: { ...history[0], text: 'Long message '.repeat(100) }, historyOpen: true, setHistoryOpen: noop, dismiss: noop }, recentEvent: '' });
      assert.ok(noticeHtml.includes('aria-live="polite"') && noticeHtml.includes('notice-expand'));
      assert.equal((noticeHtml.match(/<article>/g) ?? []).length, 20);
    }
    render(app.App, {});
    console.log(`UI v2 React: ${mode}, both languages, five plots, live schedules, full-screen cards/gacha, all settings sections, roles, albums and notices passed.`);
  } finally { await server.close(); }
}

const css = postcss.parse(readFileSync('src/styles/gacha.css', 'utf8') + '\n' + readFileSync('src/styles/ui-v2.css', 'utf8') + '\n' + readFileSync('src/styles/community-service.css', 'utf8'));
const property = (selector: string, name: string, width: number, height: number) => {
  let result: string | undefined;
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    let parent: any = rule.parent;
    while (parent) {
      if (parent.type === 'atrule' && parent.name === 'media') {
        if (parent.params.includes('prefers-reduced-motion')) return;
        const matches = [...parent.params.matchAll(/(max|min)-(width|height):\s*(\d+)px/g)];
        if (matches.some(([, bound, axis, limit]) => bound === 'max' ? (axis === 'width' ? width : height) > Number(limit) : (axis === 'width' ? width : height) < Number(limit))) return;
      }
      parent = parent.parent;
    }
    rule.walkDecls(name, (decl) => { result = decl.value; });
  });
  return result;
};
for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  assert.equal(property('.home-v2 .home-event', 'height', width, height), '48px');
  assert.equal(property('.home-v2 .home-event p', 'white-space', width, height), 'nowrap');
  assert.equal(property('.garden-plot-grid', 'grid-template-columns', width, height), `repeat(${width <= 820 ? 2 : 3},minmax(0,1fr))`);
  assert.equal(property('.storage-modal .storage-item-tile', 'background', width, height), '#fff');
  assert.equal(property('.storage-modal .storage-item-tile:hover', 'background', width, height), '#f7f9fc');
  assert.equal(property('.ui-v2-app .dialog-shell--fullscreen', 'max-height', width, height), '100dvh');
  assert.equal(property('.v2-notification', 'position', width, height), 'fixed');
  assert.ok(Number(property('.v2-notification', 'z-index', width, height)) > Number(property('.notice-history-backdrop', 'z-index', width, height)));
  assert.equal(property('.garden-plot-actions>button', 'min-height', width, height), '44px');
  assert.equal(property('.community-service-page button', 'min-height', width, height), '44px');
  assert.equal(property('.community-layout', 'grid-template-columns', width, height), width >= 1024 ? 'minmax(0, 1fr) 290px' : 'minmax(0, 1fr)');
  assert.equal(property('.community-offers', 'grid-template-columns', width, height), width >= 600 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)');
  assert.equal(property('.gacha-supply-layout', 'grid-template-columns', width, height), width > 820 ? 'minmax(0, 1.05fr) minmax(0, 1fr)' : 'minmax(0, 1fr)');
  assert.equal(property('.gacha-supply-modal .gacha-results', 'grid-template-columns', width, height), `repeat(${width <= 600 ? 2 : width <= 1000 ? 3 : 5}, minmax(0, 1fr))`);
  if (width <= 767) assert.equal(property('.ui-v2-app .storage-body', 'overflow', width, height), 'hidden');
}
css.walkDecls((decl) => assert.ok(!/var\(--notice-/.test(decl.value), 'notifications must not reserve page or dialog height'));
console.log('UI v2 CSS contracts: five requested viewports, fixed message height, neutral tiles, plot columns and scrollable mobile actions passed (no browser visual automation).');
