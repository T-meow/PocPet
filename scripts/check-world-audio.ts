import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createDefaultPet } from '../src/core/petState';
import { actCommunityFishing, advanceCommunityFishing, claimCommunityFish, startCommunityFishing } from '../src/core/communityFishing';
import { harvestCommunityCrop, plantCommunityCrop } from '../src/core/community';
import { chooseExpeditionStep, startExpedition } from '../src/core/expedition';
import { createFishingBiteCue, getPageBgmMode, getWorldActionSfx } from '../src/ui/app/worldAudio';

const now = new Date(2026, 8, 19, 12).getTime();
const night = new Date(2026, 8, 19, 22).getTime();
for (const page of ['community', 'adventure', 'expedition', 'home'] as const) {
  for (const time of [now, night]) {
    assert.equal(getPageBgmMode(page, true, false, 'fishing', time), 'shop');
    assert.equal(getPageBgmMode(page, false, true, 'fishing', time), 'sleep');
    assert.equal(getPageBgmMode(page, true, true, 'fishing', time), 'shop');
  }
}
for (const time of [now, night]) {
  assert.equal(getPageBgmMode('community', false, false, 'fishing', time), 'fishing');
  assert.equal(getPageBgmMode('expedition', false, false, 'fishing', time), 'adventure');
  assert.equal(getPageBgmMode('adventure', false, false, 'village', time), 'adventure');
}
for (const tab of ['farm', 'field'] as const) {
  assert.equal(getPageBgmMode('community', false, false, tab, now), 'garden');
  assert.equal(getPageBgmMode('community', false, false, tab, night), 'night');
}
for (const tab of ['village', 'board', 'market'] as const) {
  assert.equal(getPageBgmMode('community', false, false, tab, now), 'garden');
}
assert.equal(getPageBgmMode('garden', false, false, 'village', now), 'garden');
assert.equal(getPageBgmMode('partnerSchedule', false, false, 'village', now), 'community');
assert.equal(getPageBgmMode('home', false, false, 'fishing', now), 'room', 'a saved fishing tab cannot keep its BGM at home');
for (const page of ['home', 'community', 'garden', 'partnerSchedule'] as const) {
  assert.equal(getPageBgmMode(page, false, false, 'village', night), 'night');
}
for (const [hour, minute, expected] of [[21, 59, 'room'], [22, 0, 'night'], [0, 0, 'night'], [6, 59, 'night'], [7, 0, 'room']] as const) {
  assert.equal(getPageBgmMode('home', false, false, 'village', new Date(2026, 8, 19, hour, minute).getTime()), expected);
}

const ready = createDefaultPet(now);
ready.energy = ready.health = ready.hunger = ready.mood = 100;
ready.community.facilities.fishing_hut.built = true;
ready.inventory.fishing_bait = 5;
ready.inventory.reinforced_rod = 1;
const cast = startCommunityFishing(ready, 'pond', 'fishing_bait', true, now);
assert.ok(cast.community.fishing.active);
assert.equal(getWorldActionSfx(ready, cast, 'community'), 'fishing_cast');
assert.equal(getWorldActionSfx(cast, cast, 'community'), undefined, 'rerendering a committed cast must not replay it');
const waiting = cast.community.fishing.active;
const tooEarly = actCommunityFishing(cast, waiting.id, waiting.revision, 'hook', now);
assert.equal(getWorldActionSfx(cast, tooEarly, 'community'), undefined, 'failed actions must not play a success cue');
const bite = createFishingBiteCue();
assert.equal(bite(waiting, waiting.biteAt - 1), false);
assert.equal(bite(waiting, waiting.biteAt), true);
assert.equal(bite(waiting, waiting.biteAt + 100), false, 'one bite cue per cast');
assert.equal(createFishingBiteCue()(waiting, waiting.expiresAt), false, 'expired bites remain silent');
let fishing = actCommunityFishing(cast, waiting.id, waiting.revision, 'hook', waiting.biteAt);
assert.equal(getWorldActionSfx(cast, fishing, 'community'), 'fishing_reel');
assert.equal(createFishingBiteCue()(fishing.community.fishing.active, waiting.biteAt), false);
let at = waiting.biteAt;
for (const action of ['reel', 'reel', 'slack', 'reel', 'reel'] as const) {
  at += 700;
  const active = fishing.community.fishing.active!;
  const next = actCommunityFishing(fishing, active.id, active.revision, action, at);
  assert.equal(getWorldActionSfx(fishing, next, 'community'), next.community.fishing.pending ? 'game_catch' : action === 'slack' ? 'tap' : 'fishing_reel');
  fishing = next;
}
assert.ok(fishing.community.fishing.pending);
assert.equal(getWorldActionSfx(fishing, claimCommunityFish(fishing, fishing.community.fishing.pending.id), 'community'), 'purchase');
assert.equal(getWorldActionSfx(cast, advanceCommunityFishing(cast, waiting.expiresAt), 'community'), 'game_miss');
assert.equal(getWorldActionSfx(ready, cast, 'home'), undefined, 'world cues stay in their visible activity');
assert.equal(getWorldActionSfx(ready, { ...cast, createdAt: ready.createdAt + 1 }, 'community'), undefined, 'switching pets does not sound like starting an activity');

ready.community.gardenBuilt = true;
ready.inventory.carrot_seed = 1;
const planted = plantCommunityCrop(ready, 'carrot', now);
assert.equal(getWorldActionSfx(ready, planted, 'community'), 'world_harvest');
assert.equal(getWorldActionSfx(planted, harvestCommunityCrop(planted, planted.community.crop!.plantedAt, now), 'community'), undefined);
assert.equal(getWorldActionSfx(planted, harvestCommunityCrop(planted, planted.community.crop!.plantedAt, planted.community.crop!.readyAt), 'community'), 'world_harvest');

ready.adventure.completed.tutorial = 1;
const departed = startExpedition(ready, ['valley'], {}, false, 'official.furo', ready.name, 'manual', 1, now);
assert.ok(departed.community.expedition.active);
assert.equal(getWorldActionSfx(ready, departed, 'expedition'), 'world_step');
let journey = departed;
for (const choice of ['gather', 'safe', 'story']) {
  const trip = journey.community.expedition.active!;
  const next = chooseExpeditionStep(journey, trip.id, trip.revision, choice, now);
  assert.equal(getWorldActionSfx(journey, next, 'expedition'), choice === 'story' ? 'pet_heart' : 'world_step');
  assert.equal(getWorldActionSfx(next, chooseExpeditionStep(next, trip.id, trip.revision, choice, now), 'expedition'), undefined, 'stale action revisions do not replay feedback');
  journey = next;
}

const manifest = JSON.parse(readFileSync('docs/玩法音频素材清单.json', 'utf8'));
for (const asset of manifest.assets) {
  if (asset.status !== 'active') continue;
  const bytes = readFileSync(asset.target);
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  assert.ok(Number(asset.format.duration) > 0);
}

// Exercise the actual audio engine without speakers, browser automation or player storage.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const keys = ['window', 'document', 'Audio'] as const;
const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
const sounds: FakeAudio[] = [];
class FakeAudio {
  paused = true; loop = false; preload = ''; volume = 1; currentTime = 0; plays = 0;
  onended: (() => void) | null = null;
  constructor(public src: string) { sounds.push(this); }
  play() { this.paused = false; this.plays += 1; return Promise.resolve(); }
  pause() { this.paused = true; }
  end() { this.paused = true; this.onended?.(); }
}
try {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => {} }, setInterval: () => 1, clearInterval: () => {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible' } });
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  const audio = await server.ssrLoadModule('/src/core/audio.ts') as typeof import('../src/core/audio');
  audio.syncBgm('fishing');
  assert.equal(sounds.length, 0, 'music waits for a user gesture');
  await audio.unlockAudio();
  const fishingBgm = sounds.at(-1)!;
  assert.ok(fishingBgm.src.includes('bgm_fishing_f3.mp3') && !fishingBgm.loop);
  fishingBgm.currentTime = 12;
  const count = sounds.length;
  audio.syncBgm('fishing');
  assert.equal(sounds.length, count, 'unchanged mode does not reload BGM');
  assert.equal(fishingBgm.currentTime, 12);
  fishingBgm.end();
  const secondFishingBgm = sounds.at(-1)!;
  assert.ok(secondFishingBgm.src.includes('bgm_fishing_f4.mp3'), 'F3 is followed by F4');
  const staleEnded = secondFishingBgm.onended!;
  audio.syncBgm('shop');
  assert.ok(secondFishingBgm.paused);
  assert.equal(secondFishingBgm.onended, null, 'leaving a track detaches its end handler');
  const shopCount = sounds.length;
  staleEnded();
  assert.equal(sounds.length, shopCount, 'a queued old end event cannot replace shop music');
  audio.syncBgm('fishing');
  const restoredFishingBgm = sounds.at(-1)!;
  assert.ok(restoredFishingBgm.src.includes('bgm_fishing_f4.mp3'), 'closing the shop retains the fishing track index');
  restoredFishingBgm.end();
  assert.ok(sounds.at(-1)!.src.includes('bgm_fishing_f3.mp3'), 'the playlist wraps after F4');
  audio.setAudioTemporarilyMuted(true);
  assert.ok(sounds.at(-1)!.paused);
  const hiddenCount = sounds.length;
  audio.playSfx('fishing_bite');
  audio.syncBgm('adventure');
  sounds.at(-1)!.end();
  assert.equal(sounds.length, hiddenCount, 'background audio remains silent');
  audio.setAudioTemporarilyMuted(false);
  assert.ok(sounds.at(-1)!.src.includes('bgm_adventure_a2.mp3'));
  for (const [mode, firstId, secondId] of [['garden', 'f1', 'f2'], ['adventure', 'a2', 'a5'], ['night', 'a3', 'a4']] as const) {
    audio.syncBgm(mode);
    assert.ok(sounds.at(-1)!.src.includes('bgm_' + mode + '_' + firstId + '.mp3'));
    sounds.at(-1)!.end();
    assert.ok(sounds.at(-1)!.src.includes('bgm_' + mode + '_' + secondId + '.mp3'));
    sounds.at(-1)!.end();
    assert.ok(sounds.at(-1)!.src.includes('bgm_' + mode + '_' + firstId + '.mp3'));
  }
  const nightBgm = sounds.at(-1)!;
  nightBgm.currentTime = 20;
  audio.setAudioTemporarilyMuted(true);
  audio.setAudioTemporarilyMuted(false);
  assert.equal(sounds.at(-1), nightBgm, 'showing the same scene resumes its current audio');
  assert.equal(nightBgm.currentTime, 20);
  audio.setAudioEnabled(false);
  const mutedCount = sounds.length;
  nightBgm.end();
  assert.equal(sounds.length, mutedCount, 'an end event cannot start music while disabled');
  audio.setAudioEnabled(true);
  assert.ok(sounds.at(-1)!.src.includes('bgm_night_a4.mp3'), 'enabling resumes the next track after a queued end');
  audio.setAudioEnabled(false);
  const disabledCount = sounds.length;
  audio.syncBgm('community');
  audio.playSfx('world_harvest');
  assert.equal(sounds.length, disabledCount, 'the saved audio switch gates BGM and SFX');
  audio.setAudioEnabled(true);
  assert.ok(sounds.at(-1)!.src.includes('bgm_garden_f1.mp3'));
  sounds.at(-1)!.end();
  assert.ok(sounds.at(-1)!.src.includes('bgm_garden_f2.mp3'), 'community uses the current farm playlist');
  audio.syncBgm('room');
  assert.equal(sounds.at(-1)!.loop, true, 'single-track scenes retain native looping');
  audio.playSfx('fishing_bite');
  assert.ok(sounds.at(-1)!.src.includes('fishing_bite.mp3'));
  audio.setAudioEnabled(false);
} finally {
  keys.forEach((key, index) => { if (originals[index]) Object.defineProperty(globalThis, key, originals[index]!); else Reflect.deleteProperty(globalThis, key); });
  await server.close();
}
console.log('World audio: day/night routing, all eight approved tracks, playlist rotation, stale events, fishing/harvest/expedition outcomes, bite deduplication, asset hashes, unlock and mute passed.');
