import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { festivalIds, getFestivalWindow, getMidautumnWindow, isFestivalOpen, isMidautumnOpen, type SeasonalFestivalId } from '../src/core/festivalCalendar';
import { advanceSeasonalStory, getActiveSeasonalRun, hasSeasonalReward, startSeasonalStory, type SeasonalAction } from '../src/core/seasonalStories';
import { getSeasonalSteps, type SeasonalRun } from '../src/core/seasonalScripts';
import { advanceMidautumnStory, getActiveMidautumnRun, getMidautumnHistory, getMidautumnMemories, getMidautumnRun, hasMidautumnReward, midautumnDish, midautumnRecipe, normalizeFestivalStories, startMidautumnStory, type MidautumnAction, type MooncakeFlavour, type MoonlightSetting, type MoonlightWish } from '../src/core/festivalStories';
import { craftRecipe } from '../src/core/kitchen';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText, UnsupportedSaveVersionError } from '../src/core/saveCodec';
import type { PetState } from '../src/core/petTypes';

for (const [year, date] of [[2023, '2023-09-29'], [2024, '2024-09-17'], [2025, '2025-10-06'], [2026, '2026-09-25'], [2027, '2027-09-15'], [2028, '2028-10-03']] as const) assert.equal(getMidautumnWindow(year)?.date, date);
const window = getMidautumnWindow(2026)!;
const now = new Date(2026, 8, 25, 12).getTime();
const outsideFestivalWindow = new Date(2026, 8, 16, 12).getTime();
assert.equal(window.startDate, '2026-09-22');
assert.equal(window.endDate, '2026-09-28');
assert.equal(new Date(window.startsAt).getHours(), 0);
assert.equal(isMidautumnOpen(window.startsAt - 1), false);
assert.equal(isMidautumnOpen(window.startsAt), true);
assert.equal(isMidautumnOpen(new Date(2026, 8, 22, 0, 1).getTime()), true, 'opens at midnight, before daily reset');
assert.equal(isMidautumnOpen(window.endsAt - 1), true);
assert.equal(isMidautumnOpen(window.endsAt), false);
assert.equal(getMidautumnWindow(NaN), undefined);
assert.equal(getMidautumnWindow(10000), undefined);

const base = createDefaultPet(now);
const start = startMidautumnStory(base, 'official.furo', '小芙', now);
assert.equal(getMidautumnRun(base, 2026), undefined, 'does not mutate the source');
assert.equal(startMidautumnStory(base, 'official.furo', '小芙', window.startsAt - 1), base);
assert.equal(startMidautumnStory({ ...base, isSleeping: true }, 'official.furo', '小芙', now).festivalStories.runs['midautumn:2026'], undefined);
assert.equal(startMidautumnStory(start, 'different.actor', '新名字', now), start);
assert.equal(advanceMidautumnStory(start, 2026, { type: 'finish' }, now), start, 'cannot skip to the reward');
const legacy = { ...base } as Partial<PetState>;
delete legacy.festivalStories;
assert.deepEqual(normalizePet(legacy, now).festivalStories, { schemaVersion: 3, runs: {} });
for (const malformed of [null, [], { schemaVersion: 2, runs: [] }, { schemaVersion: 2, runs: { bad: {} } }, { schemaVersion: 2, runs: { 'midautumn:2026': { ...getMidautumnRun(start, 2026), stage: 'prepare', flavour: 'unknown' } } }]) assert.deepEqual(normalizeFestivalStories(malformed), { schemaVersion: 3, runs: {} });
const newer = JSON.parse(createSaveFileText(base, null, now));
newer.pet.festivalStories.schemaVersion = 4;
assert.throws(() => parseSaveFileText(JSON.stringify(newer), now), UnsupportedSaveVersionError);

const stageExamples: PetState[] = [start];
let finished = base;
for (const flavour of ['nuts', 'bean'] as MooncakeFlavour[]) for (const setting of ['tea', 'window'] as MoonlightSetting[]) for (const wish of ['everyday', 'journey', 'health'] as MoonlightWish[]) {
  let pet = advanceMidautumnStory(start, 2026, { type: 'flavour', value: flavour }, now);
  assert.equal(advanceMidautumnStory(pet, 2026, { type: 'serve' }, now), pet, 'a mooncake is required');
  assert.equal(advanceMidautumnStory(pet, 2026, { type: 'flavour', value: flavour }, now), pet, 'repeat selection is ignored');
  const beforeCraft = { ...pet, inventory: { flour: 2, egg: 2, mixed_nuts: 2, red_bean_paste: 2 } };
  assert.equal(craftRecipe(beforeCraft, midautumnRecipe(flavour), false, 1, 'locked-oven', now), beforeCraft, 'festival does not bypass the permanent kitchen');
  pet = craftRecipe({ ...beforeCraft, kitchen: { ...pet.kitchen, equipment: ['mix', 'pan', 'oven'] } }, midautumnRecipe(flavour), false, 1, `moon-${flavour}`, now);
  assert.equal(pet.inventory[midautumnDish(flavour)], 1);
  const steps: MidautumnAction[] = [{ type: 'serve' }, { type: 'setting', value: setting }, { type: 'wish', value: wish }, { type: 'finish' }];
  if (flavour === 'nuts' && setting === 'tea' && wish === 'everyday') stageExamples.push(pet);
  for (const action of steps) {
    const before = pet;
    pet = advanceMidautumnStory(pet, 2026, action, window.endsAt + 365 * 86400000);
    assert.notEqual(pet, before, 'started stories can continue long after their window');
    assert.equal(advanceMidautumnStory(pet, 2026, action, now), pet, 'repeated actions are idempotent');
    const run = getMidautumnRun(pet, 2026)!;
    const saved = createSaveFileText(pet, null, now);
    assert.deepEqual(getMidautumnRun(parseSaveFileText(saved, now).pet, 2026), run, 'choices and progress survive export/import');
    assert.equal(Object.hasOwn(run, 'history'), false, 'live state never accumulates a transcript');
    assert.ok(!saved.includes('"paragraphs"') && !saved.includes('"history"'), 'exported saves contain no story text');
    const loaded = loadStoredPetJson(saved, now);
    assert.equal(loaded.status, 'ok');
    if (loaded.status === 'ok') assert.deepEqual(getMidautumnRun(loaded.pet, 2026), run);
    assert.deepEqual(normalizeFestivalStories(normalizeFestivalStories(pet.festivalStories)), normalizeFestivalStories(pet.festivalStories));
    if (flavour === 'nuts' && setting === 'tea' && wish === 'everyday') stageExamples.push(pet);
  }
  const run = getMidautumnRun(pet, 2026)!;
  assert.equal(pet.inventory[midautumnDish(flavour)] ?? 0, 0, 'only one mooncake was consumed');
  assert.equal(pet.inventory[flavour === 'nuts' ? 'red_bean_paste' : 'mixed_nuts'], 2, 'the other filling was not used');
  const history = getMidautumnHistory(run);
  assert.equal(history.length, 5);
  assert.equal(history.filter((moment) => moment.choice).length, 4);
  assert.equal(history[0].choice?.zh, flavour === 'nuts' ? '五仁月饼' : '豆沙月饼');
  assert.ok(history[1].paragraphs[0].zh.includes(flavour === 'nuts' ? '五仁' : '豆沙'));
  assert.ok(history[3].paragraphs[0].zh.includes(setting === 'tea' ? '水汽' : '椅子'));
  assert.ok(history[4].paragraphs[1].zh.includes({ everyday: '明天的一顿饭', journey: '想去的地方', health: '累的时候就休息' }[wish]));
  assert.equal(run.actorName, '小芙');
  assert.equal(run.actorId, 'official.furo');
  assert.equal(run.setting, setting);
  assert.equal(run.wish, wish);
  assert.equal(pet.goldenAppleGacha.tickets, base.goldenAppleGacha.tickets + 10);
  assert.equal(getMidautumnMemories(pet).length, 1);
  assert.equal(getActiveMidautumnRun(pet), undefined);
  assert.equal(startMidautumnStory({ ...pet, name: '换了伙伴' }, 'another.actor', '换了伙伴', now).festivalStories.runs[run.id], run);
  const reloaded = parseSaveFileText(createSaveFileText(pet, null, now), now).pet;
  assert.equal(advanceMidautumnStory(reloaded, 2026, { type: 'claim' }, now), reloaded);
  assert.equal(advanceMidautumnStory(reloaded, 2026, { type: 'finish' }, now), reloaded);
  finished = pet;
}
const ending = stageExamples.find((pet) => getMidautumnRun(pet, 2026)?.stage === 'ending')!;
let full = advanceMidautumnStory({ ...ending, goldenAppleGacha: { ...ending.goldenAppleGacha, tickets: 9995 } }, 2026, { type: 'finish' }, now);
assert.equal(getMidautumnMemories(full).length, 1, 'a full ticket pouch does not block the memory');
assert.equal(full.goldenAppleGacha.tickets, 9995);
assert.equal(hasMidautumnReward(full, getMidautumnRun(full, 2026)!), false);
assert.equal(advanceMidautumnStory(full, 2026, { type: 'claim' }, now), full);
full = parseSaveFileText(createSaveFileText(full, null, now), now).pet;
full = advanceMidautumnStory({ ...full, goldenAppleGacha: { ...full.goldenAppleGacha, tickets: 9989 } }, 2026, { type: 'claim' }, now);
assert.equal(full.goldenAppleGacha.tickets, 9999);
assert.equal(advanceMidautumnStory(full, 2026, { type: 'claim' }, now), full);
const lostReceipt = structuredClone(full);
lostReceipt.festivalStories.runs['midautumn:2026'].rewardClaimedAt = 0;
lostReceipt.goldenAppleGacha.tickets = 0;
assert.equal(advanceMidautumnStory(lostReceipt, 2026, { type: 'claim' }, now), lostReceipt, 'the independent yearly receipt protects against duplicate rewards');
const nextYear = startMidautumnStory(finished, 'next.actor', '新伙伴', getMidautumnWindow(2027)!.startsAt);
assert.equal(getMidautumnRun(nextYear, 2027)?.actorName, '新伙伴');
assert.deepEqual(getMidautumnRun(nextYear, 2026), getMidautumnRun(finished, 2026));
assert.deepEqual(getMidautumnRun(parseSaveFileText(createSaveFileText(nextYear, null, now), now - 86400000).pet, 2026), getMidautumnRun(finished, 2026), 'clock rebasing never rewrites historical memories');
let nextYearFinished = { ...nextYear, inventory: { ...nextYear.inventory, dish_mooncake_mixed_nuts: 1 } };
for (const action of [{ type: 'flavour', value: 'nuts' }, { type: 'serve' }, { type: 'setting', value: 'window' }, { type: 'wish', value: 'journey' }, { type: 'finish' }] as MidautumnAction[]) {
  nextYearFinished = advanceMidautumnStory(nextYearFinished, 2027, action, getMidautumnWindow(2027)!.startsAt) as typeof nextYearFinished;
}
assert.equal(nextYearFinished.goldenAppleGacha.tickets, finished.goldenAppleGacha.tickets + 10);
assert.equal(getMidautumnMemories(nextYearFinished).length, 2, 'each year keeps its own complete memory');
// Old saves already have all branch IDs; their historical body text is unnecessary.
for (const version of [1, 2]) for (const pet of stageExamples) {
  const oldSave = JSON.parse(createSaveFileText(pet, null, now));
  oldSave.pet.festivalStories.schemaVersion = version;
  const oldRun = oldSave.pet.festivalStories.runs['midautumn:2026'];
  if (version === 1) {
    oldRun.history = getMidautumnHistory(getMidautumnRun(pet, 2026)!);
    oldRun.history[0].paragraphs[0] = { zh: '旧版正文快照，不应保留', en: 'Legacy text snapshot, do not retain' };
  }
  const legacyText = JSON.stringify(oldSave);
  const migrated = parseSaveFileText(legacyText, now).pet;
  assert.equal(migrated.festivalStories.schemaVersion, 3);
  assert.deepEqual(getMidautumnRun(migrated, 2026), getMidautumnRun(pet, 2026));
  assert.equal(migrated.goldenAppleGacha.tickets, pet.goldenAppleGacha.tickets);
  assert.deepEqual(migrated.inventory, pet.inventory);
  assert.deepEqual(migrated.claimedRewardIds, oldSave.pet.claimedRewardIds);
  assert.deepEqual(getMidautumnHistory(getMidautumnRun(migrated, 2026)!), getMidautumnHistory(getMidautumnRun(pet, 2026)!));
  const loaded = loadStoredPetJson(legacyText, now);
  assert.equal(loaded.status, 'ok');
  if (loaded.status === 'ok') assert.deepEqual(loaded.pet.festivalStories, migrated.festivalStories);
  const resaved = createSaveFileText(migrated, null, now);
  assert.ok(!resaved.includes('"history"') && !resaved.includes('旧版正文快照'), 'resaving removes legacy text permanently');
  assert.deepEqual(parseSaveFileText(resaved, now).pet.festivalStories, migrated.festivalStories);
  if (oldRun.stage === 'complete') assert.equal(advanceMidautumnStory(migrated, 2026, { type: 'claim' }, now), migrated);
}
console.log('Festival rules: lunar dates, 12 branches, choices-only saves, legacy snapshot migration, real kitchen spending and annual rewards passed.');

for (const [festival, year, date] of [
  ['spring-festival', 2025, '2025-01-29'], ['spring-festival', 2026, '2026-02-17'], ['spring-festival', 2027, '2027-02-06'],
  ['dragon-boat', 2025, '2025-05-31'], ['dragon-boat', 2026, '2026-06-19'], ['dragon-boat', 2027, '2027-06-09'],
  ['labour-day', 2026, '2026-05-01'], ['national-day', 2026, '2026-10-01'],
] as const) {
  const period = getFestivalWindow(festival, year)!;
  assert.equal(period.date, date);
  assert.equal(isFestivalOpen(festival, period.startsAt - 1), false);
  assert.equal(isFestivalOpen(festival, period.startsAt), true);
  assert.equal(isFestivalOpen(festival, period.endsAt - 1), true);
  assert.equal(isFestivalOpen(festival, period.endsAt), false);
  assert.equal(new Date(period.startsAt).getHours(), 0);
}
assert.equal(getFestivalWindow('spring-festival', 2025)?.endDate, '2025-02-01');
assert.equal(getFestivalWindow('labour-day', 2026)?.endDate, '2026-05-05');
assert.equal(getFestivalWindow('national-day', 2026)?.endDate, '2026-10-07');
const branchOptions: Record<SeasonalFestivalId, Record<string, string[]>> = {
  'national-day': { route: ['street', 'river'], detour: ['view', 'exhibit'], postcard: ['scenery', 'moments'] },
  'labour-day': { project: ['window', 'stool'], drawing: ['keep', 'redraw'], rest: ['stop', 'check'] },
  'dragon-boat': { flavour: ['pork', 'bean'], wrap: ['small', 'leaf'], boats: ['straight', 'stone'] },
  'spring-festival': { decoration: ['door', 'window'], flavour: ['pork', 'vegetable'], blessing: ['meal', 'sleep', 'road'] },
};
const combinations = (options: Record<string, string[]>) => Object.entries(options).reduce<Record<string, string>[]>((all, [key, values]) => all.flatMap(previous => values.map(value => ({ ...previous, [key]: value }))), [{}]);
const seasonalExamples: { festival: SeasonalFestivalId; pet: PetState; now: number }[] = [];
const seasonalCompleted: PetState[] = [];
let branchCount = 0;
for (const festival of Object.keys(branchOptions) as SeasonalFestivalId[]) {
  const period = getFestivalWindow(festival, 2026)!;
  const when = period.startsAt + 12 * 3600000;
  const initial = createDefaultPet(when);
  const id = `${festival}:2026`;
  assert.equal(startSeasonalStory(initial, festival, 'actor', '小芙', period.startsAt - 1), initial);
  assert.equal(startSeasonalStory({ ...initial, isSleeping: true }, festival, 'actor', '小芙', when).festivalStories.runs[id], undefined);
  for (const [branchIndex, choices] of combinations(branchOptions[festival]).entries()) {
    let pet = startSeasonalStory(initial, festival, 'official.furo', '小芙', when);
    assert.equal(startSeasonalStory(pet, festival, 'other', '换伙伴', when), pet);
    let run = pet.festivalStories.runs[id] as SeasonalRun;
    const remainingAtEnd = period.endsAt + 30 * 86400000;
    while (run.stage !== 'complete') {
      if (branchIndex === 0) seasonalExamples.push({ festival, pet, now: when });
      const step = getSeasonalSteps(run).find(step => step.id === run.stage)!;
      const action: SeasonalAction = { type: 'advance', stage: step.id, ...(step.options ? { choice: choices[step.id] } : {}) };
      assert.equal(advanceSeasonalStory(pet, id, { type: 'advance', stage: 'complete' }, when), pet, 'cannot skip stages');
      assert.equal(advanceSeasonalStory(pet, id, { type: 'advance', stage: step.id, choice: 'invalid' }, when), pet);
      assert.equal(advanceSeasonalStory(pet, id, { type: 'claim' }, when), pet, 'cannot claim before completion');
      if (step.recipe) {
        assert.equal(advanceSeasonalStory(pet, id, action, when), pet, 'requires a real serving');
        const ingredients = { ...pet.inventory, flour: 2, pork: 2, cabbage: 2, shiitake: 2, carrot: 2, glutinous_rice: 2, braised_pork: 2, red_bean_paste: 2 };
        pet = craftRecipe({ ...pet, inventory: ingredients, kitchen: { ...pet.kitchen, equipment: ['mix', 'pan'] } }, step.recipe, false, 1, `${id}:${branchIndex}`, when);
        assert.equal(pet.inventory[`dish_${step.recipe}`], 1);
      }
      const before = pet;
      pet = advanceSeasonalStory(pet, id, action, remainingAtEnd);
      assert.notEqual(pet, before, 'can continue after the festival');
      assert.equal(advanceSeasonalStory(pet, id, action, when), pet, 'stale callbacks never skip or spend twice');
      if (step.recipe) assert.equal(pet.inventory[`dish_${step.recipe}`] ?? 0, 0);
      run = pet.festivalStories.runs[id] as SeasonalRun;
      const text = createSaveFileText(pet, null, remainingAtEnd);
      assert.ok(!text.includes('paragraphs') && !text.includes('history') && !text.includes('窗外'));
      assert.deepEqual(parseSaveFileText(text, remainingAtEnd).pet.festivalStories, pet.festivalStories);
      assert.deepEqual(normalizeFestivalStories(pet.festivalStories), pet.festivalStories);
    }
    assert.deepEqual(run.choices, choices);
    assert.equal(pet.goldenAppleGacha.tickets, initial.goldenAppleGacha.tickets + 10);
    assert.equal(hasSeasonalReward(pet, run), true);
    assert.equal(advanceSeasonalStory(pet, id, { type: 'claim' }, when), pet);
    assert.equal(getActiveSeasonalRun(pet, festival), undefined);
    assert.equal(run.actorName, '小芙');
    const transcript = getSeasonalSteps(run).flatMap(step => step.paragraphs).join('\n');
    assert.ok(!transcript.includes('undefined'));
    if (festival === 'national-day') assert.ok(transcript.includes(choices.route === 'street' ? '风车' : '回声') && transcript.includes(choices.detour === 'view' ? '坐着等' : '更弯的路线'));
    if (festival === 'labour-day') assert.ok(transcript.includes(choices.project === 'window' ? '盖子' : '螺丝') && transcript.includes(choices.drawing === 'keep' ? '打哈欠' : '它努力过'));
    if (festival === 'dragon-boat') assert.ok(transcript.includes(choices.flavour === 'pork' ? '肉香' : '细软的豆沙') && transcript.includes(choices.boats === 'straight' ? '第一名' : '路线长一点'));
    if (festival === 'spring-festival') assert.ok(transcript.includes({ meal: '饭凉之前', sleep: '安心睡', road: '绕了路' }[choices.blessing]!));
    const polluted = structuredClone(pet.festivalStories) as any;
    polluted.runs[id].history = [{ paragraphs: ['should not persist'] }];
    polluted.runs[id].choices.future = 'free text';
    assert.deepEqual(normalizeFestivalStories(polluted), pet.festivalStories, 'drops text and unrecognised choices');
    polluted.runs[id].choices[Object.keys(choices)[0]] = 'invalid';
    assert.equal(normalizeFestivalStories(polluted).runs[id], undefined, 'invalid choice paths are rejected');
    if (branchIndex === 0) {
      seasonalExamples.push({ festival, pet, now: when });
      seasonalCompleted.push(pet);
      const next = startSeasonalStory(pet, festival, 'new.actor', '新伙伴', getFestivalWindow(festival, 2027)!.startsAt);
      assert.equal(next.festivalStories.runs[`${festival}:2027`]?.actorName, '新伙伴');
      assert.deepEqual(next.festivalStories.runs[id], run);
    }
    branchCount++;
  }
}
assert.equal(branchCount, 36);
const allFestivals = { ...finished, festivalStories: { schemaVersion: 3 as const, runs: Object.assign({}, finished.festivalStories.runs, ...seasonalCompleted.map(pet => pet.festivalStories.runs)) } };
assert.equal(Object.keys(parseSaveFileText(createSaveFileText(allFestivals, null, now), now).pet.festivalStories.runs).length, 5);
const overlapAt = new Date(2025, 9, 6, 12).getTime();
const overlapMid = startMidautumnStory(createDefaultPet(overlapAt), 'actor', '小芙', overlapAt);
const overlapBoth = startSeasonalStory(overlapMid, 'national-day', 'actor', '小芙', overlapAt);
assert.equal(Object.keys(overlapBoth.festivalStories.runs).length, 2, 'overlapping festivals never block each other');
assert.equal(getActiveMidautumnRun(overlapBoth)?.festival, 'midautumn');
const pendingExample = seasonalExamples.find(example => example.festival === 'national-day' && example.pet.festivalStories.runs['national-day:2026'].stage === 'ending')!;
let pending = advanceSeasonalStory({ ...pendingExample.pet, goldenAppleGacha: { ...pendingExample.pet.goldenAppleGacha, tickets: 9995 } }, 'national-day:2026', { type: 'advance', stage: 'ending' }, now);
assert.equal(pending.festivalStories.runs['national-day:2026'].stage, 'complete');
assert.equal(pending.goldenAppleGacha.tickets, 9995);
assert.equal(advanceSeasonalStory(pending, 'national-day:2026', { type: 'claim' }, now), pending);
pending = parseSaveFileText(createSaveFileText(pending, null, now), now).pet;
const unclaimed = pending;
pending = advanceSeasonalStory({ ...pending, goldenAppleGacha: { ...pending.goldenAppleGacha, tickets: 9989 } }, 'national-day:2026', { type: 'claim' }, now);
assert.equal(pending.goldenAppleGacha.tickets, 9999);
const receiptOnly = structuredClone(pending);
receiptOnly.festivalStories.runs['national-day:2026'].rewardClaimedAt = 0;
assert.equal(advanceSeasonalStory(receiptOnly, 'national-day:2026', { type: 'claim' }, now), receiptOnly);
console.log('Four seasonal stories: 36 branches, lunar/fixed windows, real recipe spending, overlap, compact saves and reward recovery passed.');

const { createServer } = await import('vite');
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const [{ FestivalStoryPage, FestivalMemories, FestivalEntry }, { MemoryAlbum }, locale] = await Promise.all([
    server.ssrLoadModule('/src/ui/FestivalStories.tsx'), server.ssrLoadModule('/src/ui/MemoryAlbum.tsx'), server.ssrLoadModule('/src/i18n/index.ts'),
  ]);
  const { SeasonalStoryPage } = await server.ssrLoadModule('/src/ui/SeasonalStoryPage.tsx');
  const noop = () => {};
  const props = { onBack: noop, onAlbum: noop, onStart: noop, onAction: noop, onKitchen: noop, now };
  for (const language of ['zh-CN', 'en-US']) {
    locale.setLanguage(language);
    for (const example of seasonalExamples) {
      const run = example.pet.festivalStories.runs[`${example.festival}:2026`] as SeasonalRun;
      const html = renderToStaticMarkup(createElement(SeasonalStoryPage, { ...props, ...example, run }));
      assert.ok(html.includes('小芙') && !html.includes('undefined'));
      assert.ok(html.includes('aria-label="返回小窝"'));
      assert.equal(html.includes('class="festival-cg"'), run.stage === 'ending' || run.stage === 'complete');
      if (run.stage === 'prepare') assert.ok(html.includes('去厨房准备'));
      if (run.stage === 'complete') {
        const before = JSON.stringify(example.pet);
        const replay = renderToStaticMarkup(createElement(SeasonalStoryPage, { ...props, ...example, run, replay: true }));
        assert.ok(replay.includes('festival-recorded-choice') && replay.includes('festival-replay-controls') && !replay.includes('festival-story-actions'));
        assert.equal(JSON.stringify(example.pet), before);
      }
    }
    for (const festival of festivalIds) {
      const activityWindow = getFestivalWindow(festival, 2026)!;
      for (const [at, visible] of [[activityWindow.startsAt - 1, false], [activityWindow.startsAt, true], [activityWindow.endsAt - 1, true], [activityWindow.endsAt, false]] as const) {
        const entry = renderToStaticMarkup(createElement(FestivalEntry, { pet: base, onOpen: noop, now: at }));
        assert.equal(entry.includes(`data-festival="${festival}"`), visible, `${festival} entry follows the activity window`);
        assert.ok(!entry.includes('festival-cg'), 'home entries do not reveal locked CG');
      }
    }
    const opened: string[] = [];
    const directEntries = FestivalEntry({ pet: overlapBoth, onOpen: (festival: string) => opened.push(festival), now: overlapAt });
    const overlap = renderToStaticMarkup(directEntries);
    assert.equal((overlap.match(/class="festival-entry"/g) ?? []).length, 2);
    assert.ok(overlap.includes('data-festival="midautumn"') && overlap.includes('data-festival="national-day"'));
    assert.ok(!overlap.includes('一起过节'));
    for (const button of directEntries.props.children) button.props.onClick();
    assert.deepEqual(opened, ['midautumn', 'national-day'], 'each overlapping entry opens its own story');
    const fullAlbum = renderToStaticMarkup(createElement(FestivalMemories, { pet: allFestivals, onReplay: noop, onContinue: noop }));
    assert.equal((fullAlbum.match(/class="festival-cg"/g) ?? []).length, 5);
    assert.ok(!fullAlbum.includes('festival-pending'), 'completed, rewarded stories only need replay');
    for (const pet of stageExamples) {
      const run = getMidautumnRun(pet, 2026)!;
      const html = renderToStaticMarkup(createElement(FestivalStoryPage, { ...props, pet, run }));
      assert.ok(html.includes('小芙') && !html.includes('undefined'));
      assert.equal(html.includes('class="festival-cg"'), run.stage === 'ending' || run.stage === 'complete');
      if (run.stage === 'prepare') assert.ok(html.includes(language === 'zh-CN' ? '去厨房做月饼' : 'Make a mooncake'));
    }
    const snapshot = JSON.stringify(finished);
    const replay = renderToStaticMarkup(createElement(FestivalStoryPage, { ...props, pet: finished, run: getMidautumnRun(finished, 2026), replay: true }));
    assert.ok(replay.includes('festival-recorded-choice') && replay.includes('festival-replay-controls'));
    assert.ok(!replay.includes('festival-story-actions') && !replay.includes('festival-flavours'));
    assert.equal(JSON.stringify(finished), snapshot, 'replay never changes progress or rewards');
    const album = renderToStaticMarkup(createElement(MemoryAlbum, { pet: finished, actorId: 'different.actor', portrait: '/portrait.png', onBack: noop, onOpenArt: noop, onSave: noop, onError: noop, onReplayFestival: noop }));
    assert.ok(album.includes('festival-cg') && album.includes('2026 · 小芙'), 'the album keeps the original partner across switches');
    for (const pet of [base, start, unclaimed, allFestivals]) {
      assert.equal(renderToStaticMarkup(createElement(FestivalEntry, { pet, onOpen: noop, now: outsideFestivalWindow })), '', 'home has no festival entry outside the activity windows');
    }
    const continuingAlbum = renderToStaticMarkup(createElement(MemoryAlbum, { pet: overlapBoth, actorId: 'different.actor', portrait: '/portrait.png', onBack: noop, onOpenArt: noop, onSave: noop, onError: noop, onReplayFestival: noop, onContinueFestival: noop }));
    assert.ok(continuingAlbum.includes('地图外的一小段') && continuingAlbum.includes('2025 · 小芙') && continuingAlbum.includes('继续还没讲完的故事'));
    assert.ok(!continuingAlbum.includes('class="festival-cg"'), 'unfinished stories can be continued without unlocking their CG');
    const rewardAlbum = renderToStaticMarkup(createElement(FestivalMemories, { pet: unclaimed, onReplay: noop, onContinue: noop }));
    assert.ok(rewardAlbum.includes('奖励待领取') && rewardAlbum.includes('class="festival-cg"'), 'the album keeps both reward recovery and replay');
    const continued = renderToStaticMarkup(createElement(SeasonalStoryPage, { ...props, pet: overlapBoth, festival: 'national-day', run: overlapBoth.festivalStories.runs['national-day:2025'], backToAlbum: true }));
    assert.ok(continued.includes('aria-label="返回纪念册"') && continued.includes('festival-story-actions'), 'continuing from the album stays playable and returns to the album');
    const continuedMidautumn = renderToStaticMarkup(createElement(FestivalStoryPage, { ...props, pet: start, run: getMidautumnRun(start, 2026), backToAlbum: true }));
    assert.ok(continuedMidautumn.includes(language === 'zh-CN' ? 'aria-label="返回纪念册"' : 'aria-label="Back to album"'));
    assert.ok(continuedMidautumn.includes('festival-flavours') && !continuedMidautumn.includes('festival-replay-controls'));
    assert.equal(renderToStaticMarkup(createElement(FestivalMemories, { pet: base, onReplay: noop })).includes('festival-cg'), false, 'CG stays locked until completion');
  }
} finally { await server.close(); }
const cg = await readFile('src/assets/story/midautumn-moonlight.webp');
const art = JSON.parse(await readFile('docs/art/midautumn-cg-adoption-20260916.json', 'utf8'));
assert.equal(createHash('sha256').update(cg).digest('hex'), art.sha256);
const adopted = JSON.parse(await readFile('docs/art/festival-cg-adoption-20260916.json', 'utf8'));
assert.equal(adopted.results.length, festivalIds.length - 1);
for (const asset of adopted.results) {
  const bytes = await readFile(asset.target);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.equal(asset.width, 1920); assert.equal(asset.height, 1080);
}
console.log('Festival UI: activity-only direct entries, overlap routing, album continuation/reward recovery, both languages, story stages, read-only replay and asset integrity passed.');
