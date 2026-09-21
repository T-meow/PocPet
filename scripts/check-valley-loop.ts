import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCommunityTestPet } from './fixtures/community-pet';
import { advancePet } from '../src/core/petLifecycle';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { advanceExplorationBudget, earnExplorationPay, getExplorationBudget, getExplorationTier, recordValleyObservation, spendExplorationHarvest } from '../src/core/explorationBudget';
import { chooseExpeditionStep, claimExpedition, getExpeditionChoices, getExpeditionStartReason, restExpedition, returnExpedition, selectExpeditionReturn, startExpedition, useExpeditionSupply } from '../src/core/expedition';
import { getRegionUnlocked } from '../src/core/expeditionData';
import { completeValleyQuest, valleyQuestIds } from '../src/core/valleyQuests';
import { getRecipeUnlockReason } from '../src/core/kitchenRecipes';
import { advanceAdventure, claimAdventureResult, getAdventureStartReason, returnFromAdventure, startAdventure } from '../src/core/adventure';
import { pickupAdventureLoot } from '../src/core/adventure';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { acceptSpecialtyOrder, cancelSpecialtyOrder, claimSpecialtyOrder, getSpecialtyCandidates, specialtyGoods } from '../src/core/communitySpecialtyOrders';
import { reconcilePetClock } from '../src/core/gameClock';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { CommunitySpecialtyOrders } from '../src/ui/community/CommunitySpecialtyOrders';
import { CommunityValleyProgress } from '../src/ui/community/CommunityValleyProgress';
import type { PetState } from '../src/core/petTypes';

const T = new Date(2026, 8, 20, 9).getTime(), H = 3600000;
const refill = (p: PetState) => ({ ...p, hunger: getPetStatCap(p), energy: getPetEnergyCap(p), mood: getPetStatCap(p), health: getPetStatCap(p), cleanliness: getPetStatCap(p), isSleeping: false });
const read = (p: PetState, at = p.lastUpdatedAt) => parseSaveFileText(createSaveFileText(p, null, at), at).pet;
const ready = (mature = true) => {
  let p = createCommunityTestPet('projects', T);
  p.dailyEncounterDateKey = '2026-09-20';
  p.inventory = { ...p.inventory, trail_mix: 20, prospector_pick: 1, camp_kit: 1, energy_drink: 2 };
  p.adventure.valleyCompleted = [...valleyQuestIds];
  p.adventure.completed.valley = 1;
  p.community.expedition.regions.valley.base = mature ? 2 : 1;
  if (mature) p.community.decorations = ['creek_fountain'];
  p = advanceExplorationBudget(p, T);
  if (mature) {
    p.community.expedition.loop = { ...p.community.expedition.loop!, used: 80, day: '', vouchers: [], heartDays: [] };
    p = advanceExplorationBudget(p, T);
  }
  return refill(p);
};
const step = (p: PetState, id?: string, at = T) => { const t = p.community.expedition.active!; return chooseExpeditionStep(p, t.id, t.revision, id ?? getExpeditionChoices(p, at)[0].id, at); };
const patrol = (p: PetState) => { p = startExpedition(refill(p), ['valley'], {}, false, 'test', '伙伴', 'manual', 1, T); for (let i = 0; i < 6; i++) p = step(p); return p; };
const claim = (p: PetState) => claimExpedition(p, p.community.expedition.pending!.id);

// Actual offline travel, save/reload and repeated callbacks all produce the same receipt.
for (const hours of [2, 4, 8]) {
  const p = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', hours, T);
  assert(p.community.expedition.active);
  assert.equal(p.inventory.trail_mix, 20); assert.equal(p.coins, ready().coins - hours / 2 * 84);
  assert.equal(getExplorationBudget(p, T)!.available, 8 - hours);
  assert.equal(p.hunger, ready().hunger, 'rations do not heal on departure');
  const all = advancePet(p, T + hours * H);
  let chunks = p;
  for (let half = 1; half <= hours * 2; half++) chunks = read(advancePet(chunks, T + half * H / 2), T + half * H / 2);
  assert.deepEqual(chunks.community.expedition.pending, all.community.expedition.pending);
  assert.equal(chunks.energy, all.energy, `frame size and reload do not change ${hours}h route costs; started ${p.energy}, ended at ${all.lastUpdatedAt}, active ${Boolean(all.community.expedition.active)}`);
  assert.equal(all.community.expedition.pending!.coins, hours * 240);
  assert.equal(all.community.expedition.pending!.items.valley_mushroom, hours * 2);
  assert.equal(all.community.expedition.pending!.hearts, hours >= 4 ? 22 : 0);
  assert(Math.abs(all.hunger - (p.hunger - hours * 9)) < .001);
  assert(Math.abs(all.energy - (p.energy - hours * 7)) < .001);
  assert.equal(all.community.expedition.loop!.used, 80 + hours);
  const collected = claim(read(all, T + hours * H));
  assert.equal(collected.coins, all.coins + hours * 240);
  assert.equal(claimExpedition(collected, all.community.expedition.pending!.id), collected);
  assert.equal(advancePet(collected, T + (hours + 1) * H).community.expedition.pending, undefined);
}

// Unused reservations and unopened rations survive recall; fractions never earn goods.
for (const elapsed of [0, .5, 1, 2, 2.5, 7.9]) {
  const p = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', 8, T);
  const back = returnExpedition(p, p.community.expedition.active!.id, T + elapsed * H);
  const result = back.community.expedition.pending!;
  assert.equal(result.items.valley_mushroom ?? 0, Math.floor(elapsed) * 2);
  assert.equal(result.refundCoins, (4 - Math.max(1, Math.ceil(elapsed / 2))) * 84);
  assert.equal(back.community.expedition.loop!.available, 8 - Math.floor(elapsed) + Math.floor(elapsed / 3));
  assert.equal(back.energy, p.energy - Math.ceil(elapsed * 7), 'recall pays cumulative elapsed energy, rounded once');
  assert.equal(read(back, T + elapsed * H).community.expedition.pending!.coins, Math.floor(elapsed) * 240);
}

// Eight-hour materials cannot be cropped to a manual twelve-item bag, including full warehouses.
let p = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', 8, T, { target: 'materials' });
p = read(advancePet(p, T + 8 * H), T + 8 * H);
assert.equal(p.community.expedition.pending!.items.community_wood, 24);
assert.equal(p.community.expedition.pending!.items.community_stone, 16);
p.inventory.community_wood = 9999;
const coins = p.coins;
p = claim(p); assert(p.community.expedition.pending); assert.equal(p.coins, coins + 1920);
p = read(p, T + 8 * H); p.inventory.community_wood = 9975;
p = claim(p); assert(!p.community.expedition.pending); assert.equal(p.inventory.community_wood, 9999); assert.equal(p.coins, coins + 1920);

// Daily gold and hearts are shared across entrance, patrol and every hourly settlement.
let ledger = ready(), paid = 0, hearts = 0;
for (const kind of ['hour', 'manual', 'hour', 'hour', 'manual', 'manual', 'hour', 'hour', 'manual', 'manual'] as const) {
  const earned = earnExplorationPay(ledger, kind, T); ledger = read(earned.pet); paid += earned.coins; hearts += earned.hearts;
}
assert.equal(paid, 2400); assert.equal(hearts, 22);
assert.equal(earnExplorationPay(ledger, 'manual', T).coins, 0);
const banked = getExplorationBudget(ledger, T + 10 * 24 * H)!;
assert.equal(banked.vouchers.length, 12); assert.equal(banked.available, 24);
const weak = ready(false), frozenFace = weak.community.expedition.loop!.vouchers[0].face;
weak.community.expedition.regions.valley.base = 2; weak.community.expedition.loop!.used = 80; weak.community.decorations = ['creek_fountain'];
assert.equal(getExplorationTier(weak), 3); assert.equal(earnExplorationPay(weak, 'manual', T).coins, frozenFace, 'already issued quotes do not appreciate');

// New chapter has no three-node shortcut, and old completed chapters migrate without resetting.
let novice = createCommunityTestPet('community', T);
novice = patrol(novice);
assert(!getRegionUnlocked(novice, 'hills'));
assert.equal(novice.community.expedition.active!.coins, 150);
assert.equal(novice.community.expedition.loop!.available, 6);
novice = returnExpedition(novice, novice.community.expedition.active!.id, T);
if (!novice.community.expedition.pending!.selected) novice = selectExpeditionReturn(novice, novice.community.expedition.pending!.id, { coin_hoard: 1, valley_amber: 1, valley_mushroom: 6 });
novice = claim(novice);
assert.equal(getAdventureStartReason(refill(novice), 'valley', T), '');
for (const id of valleyQuestIds) novice = completeValleyQuest(novice, id);
assert(getRegionUnlocked(novice, 'hills')); assert.equal(getRecipeUnlockReason(novice, 'mushroom_rice'), '');
novice.community.expedition.regions.valley.surveyed = false;
assert(normalizePet(novice, T).community.expedition.regions.valley.surveyed);

// Full route costs and camp recovery cannot launder pre-existing damage or supplied energy.
p = patrol(ready()); const t = p.community.expedition.active!;
assert.equal(ready().energy - p.energy, 50);
assert.equal(ready().hunger - p.hunger, 90);
const rested = restExpedition(p, t.id, t.revision, T);
assert.equal(rested.energy - p.energy, 6);
assert.equal(rested.health, p.health); assert.equal(rested.mood, p.mood);
assert.equal(restExpedition(rested, t.id, rested.community.expedition.active!.revision, T).energy, rested.energy);
let walk = startExpedition({ ...ready(), energy: 1, hunger: 1 }, ['valley'], {}, false, 'test', '伙伴', 'manual', 1, T, { style: 'walk' });
for (let i = 0; i < 6; i++) walk = step(walk);
walk = restExpedition(walk, walk.community.expedition.active!.id, walk.community.expedition.active!.revision, T);
assert.equal(walk.energy, 1); assert.equal(walk.hunger, 1); assert.equal(walk.community.expedition.active!.coins, 0);
let supplied = startExpedition(ready(), ['valley'], { energy_drink: 1 }, false, 'test', '伙伴', 'manual', 1, T);
for (let i = 0; i < 6; i++) supplied = step(supplied);
let st = supplied.community.expedition.active!;
supplied = useExpeditionSupply(supplied, st.id, st.revision, 'energy_drink', T); st = supplied.community.expedition.active!;
const beforeRest = supplied.energy;
supplied = restExpedition(supplied, st.id, st.revision, T); assert.equal(supplied.energy - beforeRest, Math.min(6, st.energySpent!));

// Pick consumes two real opportunities for two research points; save resumes the same node.
p = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'manual', 1, T, { style: 'short', target: 'aquamarine' });
p = step(p, 'gather:2'); assert.equal(p.community.treasureResearch.creek_aquamarine, 2); assert.equal(p.community.expedition.loop!.available, 6);
p = read(p); p = step(p); assert.equal(p.community.expedition.active!.step, 2); assert.equal(p.community.expedition.active!.coins, 0);

// The entrance uses the same material pool and cannot mint a treasure on every departure.
let entry = spendExplorationHarvest(ready(), 8, T);
entry = startAdventure(entry, 'valley', 'official.furo', 'Furo', {}, false, T);
for (const choice of ['entrance', 'bank', 'detour', 'ford', 'clearing', 'overlook']) entry = advanceAdventure(entry, entry.adventure.active!.id, entry.adventure.active!.choices.length, choice, T);
assert.equal(entry.adventure.active!.bag.coin_hoard, undefined); assert.equal(entry.adventure.active!.bag.valley_mushroom, undefined);
entry = returnFromAdventure(entry, entry.adventure.active!.id, T);
assert.equal(entry.adventure.pending!.coins, 600);
entry = claimAdventureResult(entry, entry.adventure.pending!.id);
assert.equal(earnExplorationPay(entry, 'hour', T).coins, 240);

// Finite observation rewards cannot replay through reload or repeated routes.
let observed = ready(), amber = 0, bars = 0;
for (let round = 0; round < 2; round++) for (let node = 0; node < 6; node++) for (const branch of ['a', 'b']) {
  const result = recordValleyObservation(observed, `${node}:${branch}`, T); observed = read(result.pet); amber += result.finds.valley_amber ?? 0; bars += result.finds.ancient_gold_bar ?? 0;
}
assert.equal(amber, 1); assert.equal(bars, 1);

// Fixed high-price whitelist, daily limit, cancellation, persistent quote, real stock and stale claim.
for (let day = 0; day < 12; day++) {
  const offers = getSpecialtyCandidates(ready(), T + day * 24 * H);
  assert.equal(new Set(offers.map(q => q.item)).size, 2);
  for (const q of offers) assert.equal(q.unitPrice, specialtyGoods[q.item].base * q.multiplier);
}
assert.equal([0, 1, 2].flatMap(day => getSpecialtyCandidates(ready(), T + day * 24 * H)).filter(q => q.multiplier === 5).length, 1);
p = ready(); const offer = getSpecialtyCandidates(p, T)[0];
p = acceptSpecialtyOrder(p, offer.id, T); const savedOrder = p.community.specialtyOrders.active!;
assert.equal(acceptSpecialtyOrder(p, getSpecialtyCandidates(p, T)[1].id, T), p);
assert.equal(acceptSpecialtyOrder(cancelSpecialtyOrder(p, offer.id), offer.id, T).community.specialtyOrders.active, undefined);
p = read(p, T + 4 * 24 * H); assert.deepEqual(p.community.specialtyOrders.active, savedOrder);
p.inventory[offer.item] = offer.quantity - 1; assert.equal(claimSpecialtyOrder(p, offer.id), p);
p.inventory[offer.item]++; const before = p.coins; p = claimSpecialtyOrder(p, offer.id);
assert.equal(p.inventory[offer.item] ?? 0, 0); assert.equal(p.coins, before + offer.unitPrice * offer.quantity); assert.equal(p.community.specialtyOrders.completed, 1);
assert.equal(claimSpecialtyOrder(p, offer.id), p);

// Health retreat wins an hour boundary; after return natural hunger is no longer covered.
p = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', 8, T);
p = { ...p, health: 21, mood: 0, cleanliness: 0 };
const low = advancePet(p, T + 24 * H);
assert.equal(low.community.expedition.pending!.reason, 'health'); assert.equal(low.community.expedition.pending!.coins, 0);
assert.equal(low.community.expedition.pending!.refundCoins, 252);
const boundary = advancePet({ ...p, health: 24 - 1e-6 }, T + H);
assert.equal(boundary.community.expedition.pending!.reason, 'health');
assert.equal(boundary.community.expedition.pending!.coins, 0, 'retreat wins a harvest timestamp tie');
const short = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', 2, T);
const finished = advancePet(short, T + 2 * H), later = advancePet(finished, T + 3 * H);
assert(Math.abs(finished.hunger - later.hunger - 7) < .001);

// Rollbacks shift refill timers and a live schedule together without replenishing spent rewards.
const afterHour = advancePet(startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'idle', 8, T), T + H);
const rolled = reconcilePetClock(afterHour, T + H / 2).pet;
assert.equal(rolled.community.expedition.active!.settledParts, 1);
assert.equal(rolled.community.expedition.active!.endsAt - rolled.community.expedition.active!.startedAt, 8 * H);
assert.equal(rolled.community.expedition.loop!.refillAt, afterHour.community.expedition.loop!.refillAt - H / 2);
assert.equal(rolled.community.expedition.loop!.vouchers[0].paid, 40);
const frozen = prepareTimePause(afterHour, T + 1.5 * H), resumeAt = T + 30 * 24 * H;
const frozenReload = read(frozen, resumeAt);
assert.deepEqual(advancePet(frozenReload, resumeAt).community.expedition, frozenReload.community.expedition);
assert.equal(returnExpedition(frozenReload, frozenReload.community.expedition.active!.id, resumeAt), frozenReload, 'stale recall cannot spend frozen rations');
const resumed = resumePetTime(frozenReload, resumeAt), offset = resumeAt - (T + 1.5 * H);
assert.equal(resumed.community.expedition.active!.endsAt, frozen.community.expedition.active!.endsAt + offset);
assert.equal(resumed.community.expedition.loop!.refillAt, frozen.community.expedition.loop!.refillAt + offset);
assert.equal(resumed.community.expedition.loop!.available, frozen.community.expedition.loop!.available);
assert.equal(advancePet(resumed, resumeAt + .5 * H).community.expedition.active!.settledParts, 2);

// Render the new board and progress without opening a browser or taking screenshots.
const props = { pet: ready(), update: () => {}, onExplore: () => {}, onKitchen: () => {}, onShop: () => {}, onExpedition: () => {} };
assert.match(renderToStaticMarkup(createElement(CommunitySpecialtyOrders, props)), /今日特产收购/);
assert.match(renderToStaticMarkup(createElement(CommunityValleyProgress, { ...props, onAdventure: () => {}, onOpen: () => {} })), /第一区/);
postcss.parse(readFileSync(new URL('../src/styles/valley-loop.css', import.meta.url), 'utf8'));
console.log('Valley loop: 2/4/8h settlement, recall/refund, full cargo, shared budgets, chapter migration, bounded rest, treasure, orders, rollback and UI rendering passed.');
