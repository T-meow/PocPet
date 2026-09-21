import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCommunityTestPet } from './fixtures/community-pet';
import { createDefaultPet } from '../src/core/petState';
import { explorationDifficulty, getExplorationChanceCap, getExplorationCheckPreview, getExplorationMoodEffects, getExplorationRoll, resolveExplorationCheck, advanceExplorationCheckState, normalizeExplorationCheckState, type ExplorationCheckAction, type ExplorationCheckContext } from '../src/core/explorationChecks';
import { applyExplorationCheck, previewExplorationAction } from '../src/core/explorationCheckActions';
import { getAdventureSteps } from '../src/core/adventureData';
import { advanceAdventure, startAdventure, returnFromAdventure, claimAdventureResult, getAdventureChoicePreview, getAdventureChoiceReason } from '../src/core/adventure';
import { chooseExpeditionStep, getExpeditionChoices, getExpeditionChoicePreview, startExpedition, returnExpedition, claimExpedition, restExpedition, continueExpedition, pauseExpedition, useExpeditionSupply } from '../src/core/expedition';
import { getExplorationBudget } from '../src/core/explorationBudget';
import { getPetEnergyCap, getPetStatCap } from '../src/core/petStats';
import { valleyQuestIds, valleyQuests } from '../src/core/valleyQuests';
import { getToolUsesLeft } from '../src/core/toolDurability';
import { toolDefinitions } from '../src/core/fieldEquipmentData';
import { getPartnerScheduleSkillXpNeeded } from '../src/core/partnerSchedule';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { prepareTimePause, resumePetTime } from '../src/core/timePause';
import { reconcilePetClock } from '../src/core/gameClock';
import { ExplorationChoiceDetails, ExplorationCheckSummary } from '../src/ui/ExplorationCheck';
import type { PetState, Inventory } from '../src/core/petTypes';

const T = new Date(2026, 8, 21, 10).getTime();
const refill = (p: PetState): PetState => ({ ...p, hunger: getPetStatCap(p), energy: getPetEnergyCap(p), health: getPetStatCap(p), mood: getPetStatCap(p) * .5, isOverfed: false });
const ready = () => refill(createCommunityTestPet('projects', T));
const reload = (p: PetState, now = T) => parseSaveFileText(createSaveFileText(p, null, now), now).pet;
const action: ExplorationCheckAction = { id: 'test', title: '测试采集', hunger: 15, energy: 10, finds: { valley_mushroom: 4, bamboo_shoot: 1 }, check: { mode: 'check', skill: 'garden', difficulty: 1 } };
const context: ExplorationCheckContext = { region: 'valley', node: '0', state: { seed: 123, focus: 0 } };
const p = ready(); p.adventure.valleyCompleted = [];
const approx = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const preview = getExplorationCheckPreview(p, action, context);
assert.equal(preview.chance, 70);
assert.deepEqual(preview.outcomes.map(o => o.energy), [9, 10, 12, 13]);
assert.deepEqual(preview.outcomes.map(o => o.finds.valley_mushroom), [5, 4, 3, 2]);
assert.deepEqual(preview.outcomes.map(o => o.finds.bamboo_shoot ?? 0), [1, 1, 1, 0]);
assert.deepEqual(preview.outcomes.map(o => o.healthLoss), [0, 0, 0, 0]);
assert.deepEqual(preview.outcomes.map(o => o.moodChange), [1, 0, -1, -2]);
for (const [roll, outcome] of [[0, 'excellent'], [.105 - 1e-9, 'excellent'], [.105, 'success'], [.7 - 1e-9, 'success'], [.7, 'partial'], [.94 - 1e-9, 'partial'], [.94, 'setback'], [.999999, 'setback']] as const) assert.equal(resolveExplorationCheck(p, action, context, roll)!.outcome, outcome);
approx(preview.outcomes.reduce((s, o) => s + o.probability, 0), 100);
assert.deepEqual(explorationDifficulty, { valley: [1, 2, 3], hills: [3, 4, 5], forest: [4, 5, 6], coast: [6, 7, 8], station: [8, 9, 10] });
for (const [gap, cap] of [[0, 95], [1, 75], [2, 60], [3, 40], [4, 25], [5, 10], [9, 10]]) assert.equal(getExplorationChanceCap(gap), cap);
for (const [region, difficulties] of Object.entries(explorationDifficulty)) for (const difficulty of difficulties) {
  const pet = ready(); pet.adventure.valleyCompleted = [...valleyQuestIds]; pet.mood = getPetStatCap(pet);
  const pr = getExplorationCheckPreview(pet, { ...action, check: { ...action.check, difficulty, tool: 'harvest_sickle' } }, { ...context, region: region as ExplorationCheckContext['region'], state: { seed: 1, focus: 2 }, toolAvailable: true });
  assert(pr.chance <= getExplorationChanceCap(difficulty - 1));
}
const veteran = ready(); veteran.partnerSchedule.skills.garden.level = 8; veteran.mood = getPetStatCap(veteran);
assert.equal(getExplorationCheckPreview(veteran, { ...action, check: { ...action.check, difficulty: 10, tool: 'harvest_sickle' } }, { ...context, region: 'station', state: { seed: 1, focus: 2 }, toolAvailable: true }).chance, 60);
assert.equal(getExplorationCheckPreview({ ...p, level: 30 }, action, context).chance, getExplorationCheckPreview({ ...p, level: 30, mood: getPetStatCap(30) * .5 }, action, context).chance + getExplorationMoodEffects(p.mood / getPetStatCap(30)).chance, 'overall level supplies no hidden skill bonus');
for (const [ratio, energy, injury, chance] of [[0, 1.2, 1.25, -5], [.3, 1.1, 1.1, -3], [.5, 1, 1, 0], [.65, .95, .925, 2.5], [.8, .9, .85, 5], [1, .9, .85, 5]]) {
  const m = getExplorationMoodEffects(ratio); approx(m.energy, energy); approx(m.injury, injury); approx(m.chance, chance);
}
const risk = { ...action, check: { ...action.check, risky: true } };
const low = { ...p, mood: 0 };
assert.deepEqual(getExplorationCheckPreview(low, risk, context).outcomes.map(o => o.healthLoss), [0, 0, 2.5, 7.5]);
assert.deepEqual(getExplorationCheckPreview(low, { ...risk, check: { ...risk.check, tool: 'trail_rope' } }, { ...context, toolAvailable: true }).outcomes.map(o => o.healthLoss), [0, 0, 1.3, 3.8]);
assert.equal(getExplorationCheckPreview(p, { ...action, energy: .1 }, context).energy[0], 1);
assert.match(getExplorationCheckPreview({ ...p, energy: 12 }, action, context).reason, /13/);
assert.equal(resolveExplorationCheck({ ...p, energy: 12 }, action, context, 0), undefined, 'lucky outcome cannot bypass worst-cost gate');
assert.equal(getExplorationCheckPreview(p, { ...action, finds: { valley_mushroom: 0 } }, context).finds.valley_mushroom, undefined);
const research = { ...action, research: { id: 'creek_aquamarine', points: 2, progress: 4, required: 6, yield: 1 } };
assert.deepEqual(getExplorationCheckPreview(p, research, context).outcomes.map(o => [o.researchPoints, o.finds.creek_aquamarine ?? 0]), [[3, 1], [2, 1], [1, 0], [0, 0]]);
const focusAction = { ...action, check: { ...action.check, prepare: 'focus' as const } };
const focused = advanceExplorationCheckState(context.state, focusAction, resolveExplorationCheck(p, focusAction, context, 0)!);
assert.equal(focused.focus, 2);
const safe = { ...action, finds: {}, check: { mode: 'safe' as const } };
assert.equal(advanceExplorationCheckState(focused, safe, resolveExplorationCheck(p, safe, { ...context, state: focused })!).focus, 2);
assert.equal(getExplorationCheckPreview(p, action, { ...context, state: focused }).chance, 75);
const prepared = { ...p, mood: getPetStatCap(p), adventure: { ...p.adventure, valleyCompleted: [...valleyQuestIds] } };
assert.equal(getExplorationCheckPreview(prepared, { ...action, check: { ...action.check, tool: 'harvest_sickle' } }, { ...context, state: focused, toolAvailable: true }).chance, 95);
for (const [roll, steps, reduction] of [[0, 2, .15], [.2, 2, .1], [.8, 1, .05], [.9999, 0, 0]]) {
  const meal = { ...action, check: { ...action.check, prepare: 'meal' as const } };
  const state = advanceExplorationCheckState(context.state, meal, resolveExplorationCheck(p, meal, context, roll)!);
  assert.equal(state.meal?.steps ?? 0, steps); assert.equal(state.meal?.reduction ?? 0, reduction);
}
assert.equal(advanceExplorationCheckState({ seed: 1, focus: 0, meal: { steps: 2, reduction: .15 } }, { ...safe, energy: 0, hunger: 0 }, resolveExplorationCheck(p, safe, context)!).meal!.steps, 2);
assert.deepEqual(getExplorationCheckPreview(p, action, { ...context, state: { ...context.state, meal: { steps: 2, reduction: .15 } } }).energy, [7, 11]);
assert.deepEqual(normalizeExplorationCheckState({ seed: -1, focus: 999, meal: { steps: 999, reduction: .99 } }, 'id'), { seed: normalizeExplorationCheckState({}, 'id').seed, focus: 2 });

const seedFor = (node: string, choice: string, outcome: 'setback' | 'excellent' = 'setback') => { for (let seed = 1; seed < 100000; seed++) if (outcome === 'setback' ? getExplorationRoll(seed, node, choice) > .999 : getExplorationRoll(seed, node, choice) < .001) return seed; throw Error('sample seed missing'); };
const startPatrol = (pet = ready(), bag: Inventory = {}, target: 'valley_mushroom' | 'aquamarine' | 'materials' = 'valley_mushroom', short = false) => startExpedition(pet, ['valley'], bag, false, 'test', '伙伴', 'manual', 1, T, { style: short ? 'short' : 'patrol', target });
const expStep = (pet: PetState, choice: string) => { const t = pet.community.expedition.active!; return chooseExpeditionStep(pet, t.id, t.revision, choice, T); };
const advStep = (pet: PetState, choice: string) => { const t = pet.adventure.active!; return advanceAdventure(pet, t.id, t.choices.length, choice, T); };
// Every new story can finish through stable routes; forced setbacks still preserve quest items and gates.
for (const stable of [true, false]) {
  let pet = refill(createCommunityTestPet('community', T));
  pet.adventure.completed.valley = 1;
  for (const quest of valleyQuestIds) {
    pet = startAdventure(refill(pet), 'valley', 'test', '伙伴', {}, false, T, quest);
    assert.equal(pet.adventure.active?.rulesVersion, 9, `${quest}: ${pet.recentEvent}`);
    for (let i = 0; i < 3; i++) {
      pet = refill(pet);
      if (quest === 'valley_camp' && i === 1 && !stable) { pet.hunger = 50; pet.adventure.active!.bag.dish_carrot_rice = 1; }
      const trip = pet.adventure.active!, choices = getAdventureSteps(9, 'valley', quest, 0, trip.bag)[i].choices;
      const choice = choices.find(c => c.check?.mode === (i === 2 ? 'story' : stable ? 'safe' : 'check'))!;
      assert(choice, `${quest} ${i} has stable/check option`);
      trip.checkState!.seed = seedFor(String(i), choice.id);
      const old = structuredClone(pet), next = advStep(pet, choice.id);
      assert.equal(next.adventure.active?.choices.length, i + 1, `${quest}/${choice.id}: ${next.recentEvent}`);
      assert.equal(next.adventure.active!.checkState!.last!.outcome, i === 2 || stable ? 'steady' : 'setback');
      assert.deepEqual(advanceAdventure(next, trip.id, i, choice.id, T), next, 'stale story click has no second settlement');
      if (stable) assert.deepEqual(next.partnerSchedule.skills, old.partnerSchedule.skills);
      pet = reload(next);
      assert.equal(pet.adventure.active?.choices.length, i + 1, 'saved choices survive consumed meal and new safe IDs');
    }
    for (const [id, n] of Object.entries(valleyQuests[quest].items)) assert((pet.adventure.active!.bag[id] ?? pet.adventure.active!.loot[id] ?? 0) >= n, `${quest} keeps ${id}`);
    assert(pet.adventure.valleyCompleted.includes(quest));
    pet = returnFromAdventure(pet, pet.adventure.active!.id, T);
    assert(pet.adventure.pending?.lastCheck);
    pet = claimAdventureResult(pet, pet.adventure.pending!.id);
  }
  assert.equal(pet.adventure.valleyCompleted.length, 7);
}
// Entrance and all three old-bridge short routes, including fixed delivery choices.
for (const purpose of [undefined, 'seeds', 'commission'] as const) {
  let pet = startAdventure(ready(), 'valley', 'test', '伙伴', {}, false, T, purpose);
  assert(pet.adventure.active, `${purpose}: ${pet.recentEvent}`);
  const count = getAdventureSteps(9, 'valley', purpose).length;
  for (let i = 0; i < count; i++) { pet = refill(pet); const choices = getAdventureSteps(9, 'valley', purpose)[i].choices; pet = advStep(pet, choices.find(c => c.check?.mode === 'safe')!.id); }
  assert.equal(pet.adventure.active?.choices.length, count);
}
let entrance = startAdventure({ ...ready(), inventory: { ...ready().inventory, apple: 1 } }, 'valley', 'test', '伙伴', { apple: 1 }, false, T);
entrance = advStep(entrance, 'safe:0'); entrance = advStep(entrance, 'safe:1');
const apple = getAdventureSteps(9)[2].choices.find(c => c.item === 'apple')!;
assert.equal(getAdventureChoicePreview(entrance, apple)!.chance, 100);
assert(getAdventureChoicePreview({ ...entrance, adventure: { ...entrance.adventure, active: { ...entrance.adventure.active!, bag: {} } } }, apple)!.reason, 'the shared preview reports missing delivery items');
entrance = advStep(entrance, apple.id); assert.equal(entrance.adventure.active!.bag.apple, undefined);
let gloomy = startAdventure({ ...ready(), mood: 20 }, 'valley', 'test', '伙伴', {}, false, T);
gloomy = advStep(gloomy, 'safe:0');
assert.equal(getAdventureChoiceReason(gloomy, getAdventureSteps(9)[1].choices.find(c => c.id === 'slope')!), '', 'low mood changes costs/chance without locking the branch');
assert.equal(advanceAdventure(gloomy, gloomy.adventure.active!.id, 1, 'slope', T, 0), gloomy, 'an earlier revision cannot commit a choice after state changes');

let patrol = startPatrol(); assert.equal(patrol.community.expedition.active!.rulesVersion, 4);
const startSkills = structuredClone(patrol.partnerSchedule.skills);
for (let i = 0; i < 6; i++) patrol = expStep(patrol, 'safe');
assert.equal(patrol.community.expedition.active!.step, 6);
assert.equal(patrol.community.expedition.active!.checkState!.last!.finds.coin_hoard, 1, 'first treasure remains fixed and appears in the actual result');
assert.deepEqual(patrol.partnerSchedule.skills, startSkills);
const debt = patrol.community.expedition.active!.energySpent!;
const beforeRest = patrol.energy; patrol = restExpedition(patrol, patrol.community.expedition.active!.id, patrol.community.expedition.active!.revision, T);
assert.equal(patrol.energy - beforeRest, Math.min(6, debt));
const staleRest = patrol; patrol = restExpedition(patrol, patrol.community.expedition.active!.id, patrol.community.expedition.active!.revision, T); assert.deepEqual(patrol, staleRest);
patrol = returnExpedition(patrol, patrol.community.expedition.active!.id, T);
const receiptId = patrol.community.expedition.pending!.id;
patrol = claimExpedition(reload(patrol), receiptId); assert(patrol.community.expedition.lastReceipt!.lastCheck);
assert.deepEqual(claimExpedition(patrol, receiptId), patrol);

for (const target of ['valley_mushroom', 'materials', 'aquamarine'] as const) for (const outcome of ['excellent', 'setback'] as const) {
  let pet = startPatrol(ready(), {}, target, true); const trip = pet.community.expedition.active!;
  trip.checkState!.seed = seedFor('0:0', 'gather:1', outcome);
  const c = getExpeditionChoices(pet, T).find(c => c.id === 'gather:1')!, pr = getExpeditionChoicePreview(pet, c)!;
  assert.equal(c.check!.difficulty, target === 'aquamarine' ? 3 : target === 'materials' ? 2 : 1);
  const before = structuredClone(pet), quota = getExplorationBudget(pet, T)!.available;
  pet = expStep(pet, c.id);
  const r = pet.community.expedition.active!.checkState!.last!;
  assert.equal(r.outcome, outcome); assert.equal(pet.community.expedition.active!.step, 1);
  assert.equal(getExplorationBudget(pet, T)!.available, quota - 1);
  assert.deepEqual(r.finds, pr.outcomes.find(o => o.outcome === outcome)!.finds);
  assert.deepEqual(chooseExpeditionStep(pet, trip.id, trip.revision, c.id, T), pet);
  assert.equal(pet.partnerSchedule.skills[c.check!.skill!].xp, before.partnerSchedule.skills[c.check!.skill!].xp + 1);
  assert.equal(pet.community.expedition.active!.energySpent, before.energy - pet.energy);
  const restored = reload(before); assert.equal(getExplorationRoll(restored.community.expedition.active!.checkState!.seed, '0:0', c.id), getExplorationRoll(trip.checkState!.seed, '0:0', c.id));
  assert.deepEqual(expStep(restored, c.id).community.expedition.active!.checkState!.last, r);
  pet = expStep(pet, 'safe'); assert.equal(pet.community.expedition.active!.step, 2);
}
// Broken tools still pay quota once; overflowing finds are held for return, not silently lost.
let toolPet = ready(); toolPet.inventory.prospector_pick = 1; toolPet.community.toolWear.prospector_pick = toolDefinitions.prospector_pick.uses - 1;
toolPet.inventory.dish_carrot_rice = 24;
toolPet = startPatrol(toolPet, { dish_carrot_rice: 24 }, 'aquamarine', true);
toolPet.community.treasureResearch.creek_aquamarine = 4;
toolPet.community.expedition.active!.checkState!.seed = seedFor('0:0', 'gather:2', 'excellent');
toolPet = expStep(toolPet, 'gather:2');
assert.equal(getToolUsesLeft(toolPet, 'prospector_pick'), 0); assert.equal(toolPet.community.treasureResearch.creek_aquamarine, 7);
assert.equal(toolPet.community.expedition.active!.ground.creek_aquamarine, 1);
// Meal consumes exactly once, restores according to item rules, refreshes preparation and follows paid steps.
let mealPet = ready(); mealPet.hunger = 50; mealPet.energy = 60;
const mealAction = { ...action, finds: {}, mealItem: 'dish_carrot_rice', check: { mode: 'check' as const, skill: 'cooking' as const, difficulty: 2, prepare: 'meal' as const } };
const mealTrip = { id: 'meal', tool: false, bag: { dish_carrot_rice: 1 }, checkState: { seed: seedFor('meal', action.id, 'excellent'), focus: 0 } };
const cooked = applyExplorationCheck(mealPet, mealTrip, mealAction, 'meal')!;
assert(cooked.result.recovery!.hunger > 0); assert.equal(cooked.state.meal!.steps, 2); assert.equal(cooked.state.meal!.reduction, .15);
assert.equal(previewExplorationAction({ ...mealPet, hunger: getPetStatCap(mealPet), isOverfed: true }, mealTrip, mealAction, 'meal').reason.length > 0, true);
let supply = startPatrol(ready(), { comfort_charm: 1 }); supply.mood = 10;
const supplyTrip = supply.community.expedition.active!, supplyChoice = getExpeditionChoices(supply, T)[0], beforeChance = getExpeditionChoicePreview(supply, supplyChoice)!.chance;
const supplied = useExpeditionSupply(supply, supplyTrip.id, supplyTrip.revision, 'comfort_charm', T);
assert.equal(supplied.community.expedition.active!.checkState!.seed, supplyTrip.checkState!.seed);
assert(getExpeditionChoicePreview(supplied, supplyChoice)!.chance > beforeChance);
let exhausted = startPatrol(); exhausted.energy = 1;
const blocked = expStep(exhausted, 'look:a'); assert.equal(blocked.community.expedition.active!.step, 0); assert.deepEqual(blocked.partnerSchedule.skills, exhausted.partnerSchedule.skills);
let injured = startPatrol(); injured = expStep(injured, 'safe'); injured = expStep(injured, 'safe'); injured.health = getPetStatCap(injured) * .2 + .1;
injured.community.expedition.active!.checkState!.seed = seedFor('0:2', 'look:b');
injured = expStep(injured, 'look:b'); assert.equal(injured.community.expedition.pending!.reason, 'health'); assert.equal(injured.community.expedition.pending!.lastCheck!.outcome, 'setback');
assert.equal(injured.community.expedition.active, undefined);
let rope = ready(); rope.community.toolWear.trail_rope = toolDefinitions.trail_rope.uses - 1;
rope = startExpedition(rope, ['valley'], {}, true, 'test', '伙伴', 'manual', 1, T);
for (let i = 0; i < 3; i++) rope = expStep(rope, 'safe');
const ropeQuota = getExplorationBudget(rope, T)!.available;
rope.health = getPetStatCap(rope) * .2 + .1;
rope.community.expedition.active!.checkState!.seed = seedFor('0:3', 'cross:rope');
rope = expStep(rope, 'cross:rope');
assert.equal(rope.community.expedition.pending!.lastCheck!.healthLoss, 3);
assert.equal(rope.community.expedition.pending!.lastCheck!.toolBroken, true);
assert.equal(rope.community.expedition.pending!.tool, false);
assert.equal(getExplorationBudget(rope, T)!.available, ropeQuota, 'crossing does not substitute for professional gathering');
// Skill leveling and max level never grant master completion credit.
let leveling = startPatrol(); leveling.partnerSchedule.skills.study.xp = getPartnerScheduleSkillXpNeeded(1) - 1;
leveling = expStep(leveling, 'look:a'); assert.equal(leveling.partnerSchedule.skills.study.level, 2);
let master = startPatrol(); master.partnerSchedule.skills.study = { level: 10, xp: 0, masterCompletions: 7 };
master = expStep(master, 'look:a'); assert.deepEqual(master.partnerSchedule.skills.study, { level: 10, xp: 0, masterCompletions: 7 });
// Pausing, clock correction, export/import and revision-only changes preserve the die.
const fixed = startPatrol(), fixedTrip = fixed.community.expedition.active!, die = getExplorationRoll(fixedTrip.checkState!.seed, '0:0', 'look:a');
const buffSave = structuredClone(fixed); buffSave.community.expedition.active!.checkState = { ...fixedTrip.checkState!, focus: 2, meal: { steps: 2, reduction: .15 }, last: resolveExplorationCheck(p, action, context, .99) };
assert.deepEqual(reload(buffSave).community.expedition.active!.checkState, buffSave.community.expedition.active!.checkState, 'compact saves retain structured buffs and result');
for (const saved of [reload(fixed), resumePetTime(prepareTimePause(fixed, T), T + 3600000), reconcilePetClock(fixed, T - 60000).pet]) assert.equal(getExplorationRoll(saved.community.expedition.active!.checkState!.seed, '0:0', 'look:a'), die);
let multi = startExpedition(ready(), ['valley', 'hills'], {}, false, 'test', '伙伴', 'manual', 1, T);
for (let i = 0; i < 6; i++) multi = expStep(multi, 'safe');
multi.community.expedition.active!.checkState!.meal = { steps: 2, reduction: .15 }; multi.community.expedition.active!.checkState!.focus = 2;
multi = pauseExpedition(multi, multi.community.expedition.active!.id, multi.community.expedition.active!.revision, T);
multi = reload(multi); assert(multi.community.expedition.active!.paused);
multi = continueExpedition(multi, multi.community.expedition.active!.id, multi.community.expedition.active!.revision, T);
assert.equal(multi.community.expedition.active!.checkState!.meal, undefined); assert.equal(multi.community.expedition.active!.checkState!.focus, 0);
assert(multi.community.expedition.active!.checkState!.last, 'leaving the valley clears buffs while preserving the last check receipt');
assert(getExpeditionChoices(multi, T).every(c => !c.check), 'other regions retain current rules');
const walk = startExpedition(ready(), ['valley'], {}, false, 'test', '伙伴', 'manual', 1, T, { style: 'walk' });
assert.equal(walk.community.expedition.active!.rulesVersion, 3); assert(getExpeditionChoices(walk, T).every(c => !c.check));
const tutorial = startAdventure(refill(createDefaultPet(T)), 'tutorial', 'test', '伙伴', {}, false, T);
assert.equal(tutorial.adventure.active!.rulesVersion, 8); assert.equal(tutorial.adventure.active!.checkState, undefined);
const ui = renderToStaticMarkup(createElement(ExplorationChoiceDetails, { pet: p, preview, definition: action.check, hunger: action.hunger }));
assert.match(ui, /推荐 1 级/); assert.match(ui, /70%/); assert.match(ui, /健康无损/);
assert.match(renderToStaticMarkup(createElement(ExplorationCheckSummary, { result: resolveExplorationCheck(p, action, context, .99) })), /受挫后继续/);

// Identical fixed dice samples make the effect of growth and mood observable without flaky assertions.
const samples: { skill: number; mood: number; chance: number; energy: number; harvest: number }[] = [];
for (const level of [1, 2, 3]) for (const mood of [.2, .5, .9]) {
  const pet = ready(); pet.adventure.valleyCompleted = []; pet.mood = getPetStatCap(pet) * mood; pet.partnerSchedule.skills.garden.level = level;
  const a = { ...action, check: { ...action.check, difficulty: 2 } }, outcomes = Array.from({ length: 1000 }, (_, i) => resolveExplorationCheck(pet, a, context, (i + .5) / 1000)!);
  samples.push({ skill: level, mood: mood * 100, chance: getExplorationCheckPreview(pet, a, context).chance, energy: outcomes.reduce((n, o) => n + o.energy, 0) / 1000, harvest: outcomes.reduce((n, o) => n + o.finds.valley_mushroom, 0) / 1000 });
}
for (const mood of [20, 50, 90]) { const rows = samples.filter(s => s.mood === mood); assert(rows[0].energy > rows[2].energy); assert(rows[0].harvest < rows[2].harvest); }
for (const skill of [1, 2, 3]) { const rows = samples.filter(s => s.skill === skill); assert(rows[0].energy > rows[2].energy); assert(rows[0].harvest < rows[2].harvest); }
console.table(samples);
console.log('Exploration checks passed: strict difficulty, outcomes, mood, rewards, seven stories, stable paths, deterministic saves, tools, meals, XP, retreat and legacy boundaries.');
