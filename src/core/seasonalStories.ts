import type { PetState } from './petTypes';
import { isFestivalId, isFestivalOpen, type SeasonalFestivalId } from './festivalCalendar';
import { canSpendCompanionTime } from './kitchen';
import { removeInventoryItem } from './items';
import { getSeasonalSteps, type SeasonalRun } from './seasonalScripts';

export type SeasonalAction = { type: 'advance'; stage: string; choice?: string } | { type: 'claim' };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const timestamp = (value: unknown): value is number => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime());
export const seasonalRewardId = (run: SeasonalRun) => `festival:${run.festival}:${run.year}:v1`;
export const hasSeasonalReward = (pet: PetState, run: SeasonalRun) => run.rewardClaimedAt > 0 || pet.claimedRewardIds.includes(seasonalRewardId(run));
export const getActiveSeasonalRun = (pet: PetState, festival: SeasonalFestivalId) => Object.values(pet.festivalStories.runs).filter((run): run is SeasonalRun => run.festival === festival).filter(run => run.stage !== 'complete' || !hasSeasonalReward(pet, run)).sort((a, b) => a.year - b.year)[0];

export const normalizeSeasonalRun = (id: string, raw: unknown): SeasonalRun | undefined => {
  const source = object(raw);
  if (!isFestivalId(source.festival) || source.festival === 'midautumn' || source.scriptVersion !== 1) return;
  if (typeof source.year !== 'number' || !Number.isInteger(source.year) || source.year < 1900 || source.year > 2199 || id !== `${source.festival}:${source.year}` || source.id !== id) return;
  if (typeof source.actorId !== 'string' || !source.actorId.trim() || typeof source.actorName !== 'string' || !source.actorName.trim() || !timestamp(source.startedAt) || typeof source.stage !== 'string') return;
  const run: SeasonalRun = {
    id, festival: source.festival, scriptVersion: 1, year: source.year, actorId: source.actorId.slice(0, 128), actorName: source.actorName.slice(0, 64), startedAt: source.startedAt,
    completedAt: 0, rewardClaimedAt: 0, stage: source.stage, choices: {},
  };
  const steps = getSeasonalSteps(run);
  const index = run.stage === 'complete' ? steps.length : steps.findIndex(step => step.id === run.stage);
  if (index < 0) return;
  const choices = object(source.choices);
  for (const step of steps.slice(0, index)) {
    if (!step.options) continue;
    const choice = choices[step.id];
    if (typeof choice !== 'string' || !step.options.some(option => option.id === choice)) return;
    run.choices[step.id] = choice;
  }
  if (run.stage === 'complete') {
    if (!timestamp(source.completedAt)) return;
    run.completedAt = source.completedAt;
    run.rewardClaimedAt = timestamp(source.rewardClaimedAt) ? source.rewardClaimedAt : 0;
  }
  return run;
};

const saveRun = (pet: PetState, run: SeasonalRun): PetState => ({ ...pet, festivalStories: { schemaVersion: 3, runs: { ...pet.festivalStories.runs, [run.id]: run } } });
export const startSeasonalStory = (pet: PetState, festival: SeasonalFestivalId, actorId: string, actorName: string, now = Date.now()): PetState => {
  const year = new Date(now).getFullYear(), id = `${festival}:${year}`;
  if (!timestamp(now) || !isFestivalOpen(festival, now) || pet.festivalStories.runs[id] || getActiveSeasonalRun(pet, festival) || !canSpendCompanionTime(pet) || !actorId.trim() || !actorName.trim()) return pet;
  const run: SeasonalRun = { id, festival, scriptVersion: 1, year, actorId: actorId.slice(0, 128), actorName: actorName.trim().slice(0, 64), startedAt: now, completedAt: 0, rewardClaimedAt: 0, stage: '', choices: {} };
  run.stage = getSeasonalSteps(run)[0].id;
  return saveRun(pet, run);
};
const claimReward = (pet: PetState, run: SeasonalRun, now: number) => {
  if (run.stage !== 'complete' || hasSeasonalReward(pet, run) || pet.goldenAppleGacha.tickets > 9989) return pet;
  return saveRun({ ...pet, goldenAppleGacha: { ...pet.goldenAppleGacha, tickets: pet.goldenAppleGacha.tickets + 10 }, claimedRewardIds: [...pet.claimedRewardIds, seasonalRewardId(run)] }, { ...run, rewardClaimedAt: now });
};
export const advanceSeasonalStory = (pet: PetState, id: string, action: SeasonalAction, now = Date.now()): PetState => {
  const run = pet.festivalStories.runs[id];
  if (!run || run.festival === 'midautumn' || !timestamp(now)) return pet;
  if (action.type === 'claim') return claimReward(pet, run, now);
  // The captured stage rejects repeated or stale callbacks before consuming inventory.
  if (run.stage === 'complete' || action.stage !== run.stage || !canSpendCompanionTime(pet)) return pet;
  const steps = getSeasonalSteps(run), index = steps.findIndex(step => step.id === run.stage), step = steps[index];
  if (!step || (step.options ? !step.options.some(option => option.id === action.choice) : action.choice !== undefined)) return pet;
  const dish = step.recipe ? `dish_${step.recipe}` as const : undefined;
  if (dish && (pet.inventory[dish] ?? 0) < 1) return pet;
  const complete = index === steps.length - 1;
  const next: SeasonalRun = { ...run, stage: complete ? 'complete' : steps[index + 1].id, choices: { ...run.choices, ...(action.choice ? { [step.id]: action.choice } : {}) }, completedAt: complete ? now : 0 };
  const updated = saveRun(dish ? { ...pet, inventory: removeInventoryItem(pet.inventory, dish, 1) } : pet, next);
  return complete ? claimReward(updated, next, now) : updated;
};
