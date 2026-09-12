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

const noop = () => {};
for (const mode of ['development', 'toy']) {
  const server = await createServer({ mode, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  try {
    const paths = ['core/pet', 'i18n/index', 'assets', 'ui/HomePageV2', 'ui/CompanionStatus', 'ui/GardenPage', 'ui/PartnerSchedulePage', 'ui/BoostCardModal', 'ui/GoldenAppleGachaModal', 'ui/SettingsModal', 'ui/MemoryAlbum', 'ui/RolePicker', 'ui/CommonDreamsPage', 'ui/NoticeCenter', 'ui/YearReviewModal', 'ui/App', 'ui/EditionNoticeDialog'];
    const modules = await Promise.all(paths.map((path) => server.ssrLoadModule(`/src/${path}.${path.startsWith('ui/') ? 'tsx' : 'ts'}`)));
    const [core, locale, assets, home, status, garden, schedule, cards, gacha, settings, album, roles, dreams, notices, annual, app, editionNotice] = modules;
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
      saveText: '', importSaveText: '', hasImportBackup: false, hasOpenedHelp: false, hasClaimedAuthorFollowGift: false, hasClaimedHelpPageGift: false,
      cloudAvailability: 'available', cloudUsedFallback: false, cloudBusy: null, cloudReminderEnabled: true, cloudReminderDue: false, hasLatestYearReview: false, shareBusy: null,
      cloudManifest: { schemaVersion: 1, generation: 'a', encoding: 'zip-deflate-base64', encodedLength: 4096, chunkCount: 4, checksum: '00000000', uploadedAt: new Date(now).toISOString(), petName: rich.name, petLevel: rich.level },
      authorSummary: {}, authorVideo: {}, isAuthorLoading: false,
      ...Object.fromEntries(['onClose', 'onAppearanceChange', 'onAudioToggle', 'onDraftNameChange', 'onDraftBirthdayChange', 'onLanguageChange', 'onImportSaveTextChange', 'onCloudReminderEnabledChange'].map((key) => [key, noop])),
    };
    for (const language of ['zh-CN', 'en-US']) {
      locale.setLanguage(language);
      const announcementHtml = render(editionNotice.EditionNoticeDialog, { onAcknowledge: noop, onBackup: noop });
      for (const text of [locale.t('ui.editionNotice.backup'), locale.t('ui.editionNotice.backupAdvice'), locale.t('ui.editionNotice.formatTimeline'), locale.t('ui.editionNotice.kitchenAdvice'), locale.t('ui.editionNotice.playAdvice'), locale.t('ui.editionNotice.compensationAdvice'), locale.t('ui.editionNotice.boxAdvice')]) {
        const escaped = renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
        assert.ok(announcementHtml.includes(escaped), `announcement ${mode}/${language}: ${text}`);
      }
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
      const cardHtml = render(cards.BoostCardModal, { pet: subscribed, onClose: noop, onBuyCard: noop, onClaimDailyReward: noop });
      assert.ok(cardHtml.includes('dialog-shell--fullscreen') && cardHtml.includes('friend-card-expiry'));
      const gachaHtml = render(gacha.GoldenAppleGachaModal, { pet: rich, itemIconMap: assets.itemIcons, onClose: noop, onDraw: noop, onHeartDraw: noop, onClaimStarterGift: noop, onSaveResults: noop, onClearSaveFeedback: noop, onPlaySfx: noop, isSavingResults: false, saveFeedback: '' });
      assert.ok(gachaHtml.includes('dialog-shell--fullscreen'));
      for (const machine of ['apple', 'heart']) {
        const machineHtml = render(gacha.GachaMachineArt, { machine, phase: 'charging', itemIconMap: assets.itemIcons });
        assert.equal((machineHtml.match(/class="v2-gacha-prize"/g) ?? []).length, 5);
        assert.ok(machineHtml.includes('data-phase="charging"'));
      }
      const gardenHtml = render(garden.GardenPage, { pet: rich, itemIconMap: assets.itemIcons });
      assert.equal((gardenHtml.match(/<article class="garden-plot /g) ?? []).length, 5);
      assert.ok(!gardenHtml.includes('garden-selected-detail'));
      const gardenDay = core.getEffectiveDailyDateKey(rich, now);
      const mixedGarden = { ...rich, coins: 0, garden: { ...rich.garden, activeSlotIndex: 4, slots: rich.garden.slots.map((slot: any, index: number) => ({
        ...slot, unlocked: index < 4,
        state: ['empty', 'growing', 'ready', 'withered', 'empty'][index],
        treeId: [undefined, 'fruit_tree', 'money_tree', 'fruit_tree', undefined][index],
        plantedAt: now - 3600000, naturalReadyAt: now + 86400000, nextReadyAt: now + 86400000,
        harvestsUsed: index === 3 ? 8 : 1, maxHarvests: 8,
        lastWateredDateKey: index === 1 ? gardenDay : '',
        lastFertilizedDateKey: index === 1 ? gardenDay : '',
        lastBoostedDateKey: index === 1 ? gardenDay : '',
        pendingDrops: index === 2 ? [{ kind: 'coins', amount: 123 }] : [],
      })) } };
      const mixedGardenHtml = render(garden.GardenPage, { pet: mixedGarden, itemIconMap: assets.itemIcons, compensationCoins: 100, onClaimCompensation: noop });
      const plots = mixedGardenHtml.match(/<article class="garden-plot [\s\S]*?<\/article>/g)!;
      assert.equal(plots.length, 5);
      for (const [index, state] of ['empty', 'growing', 'ready', 'withered', 'locked'].entries()) assert.ok(plots[index].includes(`garden-plot--${state}`));
      assert.ok(plots[0].includes(locale.t('ui.garden.chooseSapling')));
      assert.ok(plots[1].includes(locale.t('ui.garden.actions.water')) && plots[1].includes('1/8'));
      assert.equal((plots[1].match(/class="garden-choice" disabled=""/g) ?? []).length, 4, 'daily care limits stay attached to each plot');
      assert.ok(plots[2].includes('garden-plot-drops') && plots[2].includes('+123') && plots[2].includes(locale.t('ui.garden.actions.harvest')));
      assert.ok(plots[3].includes(locale.t('ui.garden.actions.clear', { coins: core.getGardenClearCost(mixedGarden.garden.tools) })));
      assert.ok(plots[4].includes('disabled=""') && plots[4].includes(locale.t('ui.garden.unlockSlot', { coins: core.gardenSlotUnlockCosts[4] })));
      assert.ok(mixedGardenHtml.includes(locale.t('ui.garden.compensationGiftLabel', { coins: 100 })), 'compensation remains available on the board');
      assert.ok(render(schedule.PartnerSchedulePage, { pet: rich, itemIconMap: assets.itemIcons, neighbors: [] }).includes('schedule-category-tabs'));
      const started = core.startPartnerSchedule(rich, rich.partnerSchedule.offers[0].id, now);
      assert.ok(started.partnerSchedule.active);
      assert.ok(render(schedule.PartnerSchedulePage, { pet: started, itemIconMap: assets.itemIcons, neighbors: [] }).includes('partner-schedule-active'));
      const completed = core.advancePartnerSchedule(started, started.partnerSchedule.active.endsAt + 1);
      assert.ok(render(schedule.PartnerSchedulePage, { pet: completed, itemIconMap: assets.itemIcons, neighbors: [] }).includes('partner-schedule-result'));
      for (const page of ['main', 'appearance', 'mod', 'save', 'share', 'updates', 'help']) {
        const html = render(settings.SettingsModal, { ...settingsProps, initialPage: page, language });
        assert.ok(html.includes('class="settings-page"') && !html.includes('role="dialog"'));
        assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
        if (page === 'main') assert.equal(html.includes('readonly=""'), mode === 'toy');
        if (page === 'mod') assert.equal(html.includes('type="file"'), mode !== 'toy');
        if (page === 'save') {
          assert.equal(html.includes('class="settings-cloud-panel"'), mode === 'toy');
          assert.ok(html.includes(locale.t('ui.settings.save.formatV2')));
          assert.ok(html.includes(locale.t('ui.settings.save.newProgress')));
          assert.equal(html.includes('4.0 / 60 KiB'), mode === 'toy');
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

const css = postcss.parse(readFileSync('src/styles/ui-v2.css', 'utf8'));
const property = (selector: string, name: string, width: number, height: number) => {
  let result: string | undefined;
  css.walkRules((rule) => {
    if (rule.selector !== selector) return;
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
  assert.equal(property('.garden-plot-actions button', 'min-height', width, height), '44px');
  if (width <= 767) assert.equal(property('.ui-v2-app .storage-body', 'overflow-y', width, height), 'auto');
}
css.walkDecls((decl) => assert.ok(!/var\(--notice-/.test(decl.value), 'notifications must not reserve page or dialog height'));
console.log('UI v2 CSS contracts: five requested viewports, fixed message height, neutral tiles, plot columns and scrollable mobile actions passed (no browser visual automation).');
