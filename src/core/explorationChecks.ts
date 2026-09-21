import type { Inventory, PartnerScheduleCategory, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import type { DurableToolId } from './fieldEquipmentData';
import { getPetStatCap, getPetStatRatio } from './petStats';
import { hashString } from './utils';

export const explorationDifficulty: Record<RegionId, readonly [number, number, number]> = {
  valley: [1, 2, 3], hills: [3, 4, 5], forest: [4, 5, 6], coast: [6, 7, 8], station: [8, 9, 10],
};
export const explorationSkillNames: Record<PartnerScheduleCategory, string> = { study: '学习', garden: '园艺', exercise: '运动', cooking: '烹饪' };
export const explorationOutcomeNames = { excellent: '出色完成', success: '顺利完成', partial: '勉强完成', setback: '受挫后继续', steady: '稳妥完成' } as const;
export type ExplorationOutcome = keyof typeof explorationOutcomeNames;
export interface ExplorationCheckDefinition {
  mode: 'check' | 'safe' | 'story' | 'delivery';
  skill?: PartnerScheduleCategory;
  difficulty?: number;
  risky?: boolean;
  tool?: DurableToolId;
  prepare?: 'focus' | 'meal';
}
export interface ExplorationCheckState {
  seed: number;
  focus: number;
  meal?: { steps: number; reduction: number };
  last?: ExplorationCheckResult;
}
export interface ExplorationCheckAction {
  id: string; title: string; hunger: number; energy: number;
  mood?: number; finds?: Inventory; primaryItem?: string;
  check: ExplorationCheckDefinition;
  mealItem?: string;
  research?: { id: string; points: number; progress: number; required: number; yield: number };
}
export interface ExplorationCheckContext {
  region: RegionId; node: string; state: ExplorationCheckState;
  toolAvailable?: boolean; blockedReason?: string;
}
export interface ExplorationCheckOutcome {
  outcome: ExplorationOutcome; probability: number;
  hunger: number; energy: number; healthLoss: number; moodChange: number;
  finds: Inventory; researchPoints: number;
}
export interface ExplorationCheckPreview {
  skill?: PartnerScheduleCategory; skillLevel: number; difficulty: number;
  chance: number; chanceCap: number; factors: { label: string; value: number }[];
  mood: ReturnType<typeof getExplorationMoodEffects>;
  costFactors: { base: number; route: number; meal: number };
  energy: [number, number]; healthLoss: [number, number];
  finds: Record<string, [number, number]>; researchPoints: [number, number];
  outcomes: ExplorationCheckOutcome[]; reason: string;
}
export interface ExplorationCheckResult extends Omit<ExplorationCheckOutcome, 'probability'> {
  node: string; choiceId: string; title: string;
  skill?: PartnerScheduleCategory; skillLevel: number; difficulty: number; chance: number; xp: number;
  mealItem?: string;
  tool?: DurableToolId;
  toolBroken?: boolean;
  researchId?: string;
  coins?: number;
  hearts?: number;
  recovery?: { hunger: number; energy: number; health: number; mood: number; cleanliness: number };
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const skills = ['study', 'garden', 'exercise', 'cooking'] as const;
export const getExplorationMoodEffects = (ratio: number) => {
  const points = [[0, 1.2, 1.25, -5], [.3, 1.1, 1.1, -3], [.5, 1, 1, 0], [.8, .9, .85, 5]];
  const mood = clamp(ratio, 0, .8);
  const i = Math.max(1, points.findIndex(p => p[0] >= mood));
  const a = points[i - 1], b = points[i], t = (mood - a[0]) / (b[0] - a[0]);
  return { energy: a[1] + (b[1] - a[1]) * t, injury: a[2] + (b[2] - a[2]) * t, chance: a[3] + (b[3] - a[3]) * t };
};
export const getExplorationChanceCap = (gap: number) => gap <= 0 ? 95 : gap === 1 ? 75 : gap === 2 ? 60 : gap === 3 ? 40 : gap === 4 ? 25 : 10;
export const createExplorationCheckState = (key: string): ExplorationCheckState => ({ seed: hashString(key), focus: 0 });
// Avalanche the string hash: neighboring trip IDs and choices must not produce neighboring rolls.
export const getExplorationRoll = (seed: number, node: string, choiceId: string) => {
  let x = hashString(`${seed}:${node}:${choiceId}`);
  x = Math.imul(x ^ x >>> 16, 0x7feb352d);
  x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  return ((x ^ x >>> 16) >>> 0) / 4294967296;
};
const outcomeEnergy: Record<ExplorationOutcome, number> = { excellent: .85, success: 1, partial: 1.15, setback: 1.3, steady: 1 };
const outcomeMood: Record<ExplorationOutcome, number> = { excellent: 1, success: 0, partial: -1, setback: -2, steady: 0 };
const adjustFinds = (base: Inventory, outcome: ExplorationOutcome, primary?: string): Inventory => {
  const finds: Inventory = {};
  for (const [id, count] of Object.entries(base)) {
    if (count <= 0) continue;
    const n = outcome === 'partial' ? Math.max(1, Math.floor(count * .75)) : outcome === 'setback' ? Math.floor(count * .5) : count;
    if (n > 0) finds[id] = n;
  }
  const main = primary ?? Object.keys(base).find(id => base[id] > 0);
  if (outcome === 'excellent' && main && base[main] > 0) finds[main] = (finds[main] ?? 0) + 1;
  return finds;
};
export const getExplorationCheckPreview = (pet: PetState, action: ExplorationCheckAction, context: ExplorationCheckContext): ExplorationCheckPreview => {
  const d = action.check, random = d.mode === 'check', skillLevel = d.skill ? pet.partnerSchedule.skills[d.skill].level : 0;
  const difficulty = d.difficulty ?? 0, mood = getExplorationMoodEffects(getPetStatRatio(pet, 'mood'));
  const familiarity = context.region === 'valley' ? Math.min(5, Math.floor(pet.adventure.valleyCompleted.length * 5 / 7)) : pet.community.expedition.regions[context.region].surveyed ? 5 : 0;
  const factors = random ? [
    { label: '技能等级差', value: 5 * (skillLevel - difficulty) },
    { label: '对应工具', value: d.tool && context.toolAvailable ? 10 : 0 },
    { label: '观察准备', value: context.state.focus > 0 ? 5 : 0 },
    { label: '地区熟悉', value: familiarity },
    { label: '当前心情', value: mood.chance },
  ] : [];
  const chanceCap = random ? getExplorationChanceCap(difficulty - skillLevel) : 100;
  const chance = random ? Math.min(chanceCap, clamp(70 + factors.reduce((n, f) => n + f.value, 0), 5, 95)) : 100;
  const probabilities: [ExplorationOutcome, number][] = random ? [['excellent', chance * .15], ['success', chance * .85], ['partial', (100 - chance) * .8], ['setback', (100 - chance) * .2]] : [['steady', 100]];
  const route = d.mode === 'safe' ? 1.25 : d.risky ? .8 : 1;
  const meal = context.state.meal && context.state.meal.steps > 0 ? 1 - context.state.meal.reduction : 1;
  const outcomes = probabilities.map(([outcome, probability]): ExplorationCheckOutcome => {
    const energy = action.energy > 0 ? Math.max(1, Math.round(action.energy * route * mood.energy * outcomeEnergy[outcome] * meal)) : 0;
    const injury = d.risky && random ? outcome === 'partial' ? 2 : outcome === 'setback' ? 6 : 0 : 0;
    const healthLoss = round1(injury * mood.injury * (d.tool === 'trail_rope' && context.toolAvailable ? .5 : 1));
    const finds = adjustFinds(action.finds ?? {}, outcome, action.primaryItem);
    const r = action.research;
    const researchPoints = r ? outcome === 'excellent' ? r.points + 1 : outcome === 'partial' ? Math.max(0, r.points - 1) : outcome === 'setback' ? 0 : r.points : 0;
    if (r && researchPoints) {
      const completed = Math.floor(((r.progress % r.required) + researchPoints) / r.required);
      if (completed) finds[r.id] = (finds[r.id] ?? 0) + completed * r.yield;
    }
    return { outcome, probability, hunger: action.hunger, energy, healthLoss, moodChange: (action.mood ?? 0) + outcomeMood[outcome], finds, researchPoints };
  });
  const range = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];
  const energy = range(outcomes.map(o => o.energy)), healthLoss = range(outcomes.map(o => o.healthLoss));
  const finds = Object.fromEntries([...new Set(outcomes.flatMap(o => Object.keys(o.finds)))].map(id => [id, range(outcomes.map(o => o.finds[id] ?? 0))]));
  const reason = context.blockedReason || (pet.timePause ? '时间已冻结，恢复后再行动。' : pet.health < getPetStatCap(pet) * .2 ? '健康过低，正在安全返程。' : d.tool && !context.toolAvailable ? '缺少对应工具或耐久。' : pet.hunger < action.hunger ? '饱食不足，请先补充。' : pet.energy < energy[1] ? `至少需要 ${energy[1]} 体力，以承担本次行动的最坏消耗。` : '');
  return { skill: d.skill, skillLevel, difficulty, chance, chanceCap, factors, mood, costFactors: { base: action.energy, route, meal }, energy, healthLoss, finds, researchPoints: range(outcomes.map(o => o.researchPoints)), outcomes, reason };
};
export const resolveExplorationCheck = (pet: PetState, action: ExplorationCheckAction, context: ExplorationCheckContext, roll = getExplorationRoll(context.state.seed, context.node, action.id)): ExplorationCheckResult | undefined => {
  const preview = getExplorationCheckPreview(pet, action, context);
  if (preview.reason) return undefined;
  let threshold = 0;
  const picked = preview.outcomes.find(o => { threshold += o.probability / 100; return roll < threshold; }) ?? preview.outcomes[preview.outcomes.length - 1];
  const { probability: _probability, ...outcome } = picked;
  return { ...outcome, node: context.node, choiceId: action.id, title: action.title,
    ...(action.check.skill ? { skill: action.check.skill } : {}), skillLevel: preview.skillLevel, difficulty: preview.difficulty, chance: preview.chance,
    xp: action.check.mode === 'check' && preview.skillLevel < 10 ? 1 : 0,
    ...(action.mealItem ? { mealItem: action.mealItem } : {}), ...(action.check.tool ? { tool: action.check.tool } : {}), ...(action.research ? { researchId: action.research.id } : {}) };
};
export const advanceExplorationCheckState = (state: ExplorationCheckState, action: ExplorationCheckAction, result: ExplorationCheckResult): ExplorationCheckState => {
  let focus = Math.max(0, state.focus - Number(action.check.mode === 'check'));
  let meal = state.meal && { ...state.meal, steps: state.meal.steps - Number(action.hunger > 0 || action.energy > 0) };
  if (meal && meal.steps <= 0) meal = undefined;
  if (action.check.prepare === 'focus' && (result.outcome === 'excellent' || result.outcome === 'success')) focus = result.outcome === 'excellent' ? 2 : 1;
  if (action.check.prepare === 'meal') meal = result.outcome === 'excellent' ? { steps: 2, reduction: .15 } : result.outcome === 'success' ? { steps: 2, reduction: .1 } : result.outcome === 'partial' ? { steps: 1, reduction: .05 } : meal;
  return { seed: state.seed, focus, ...(meal ? { meal } : {}), last: result };
};

const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const amount = (v: unknown, max = 10000, min = 0) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : 0;
const label = (v: unknown) => typeof v === 'string' ? v.slice(0, 160) : '';
export const normalizeExplorationCheckResult = (raw: unknown): ExplorationCheckResult | undefined => {
  const v = object(raw);
  if (!Object.prototype.hasOwnProperty.call(explorationOutcomeNames, String(v.outcome)) || !label(v.choiceId) || !label(v.node)) return undefined;
  const skill = skills.find(s => s === v.skill), finds = Object.fromEntries(Object.entries(object(v.finds)).slice(0, 32).flatMap(([id, n]) => /^[a-zA-Z0-9_.:-]{1,128}$/.test(id) && amount(n) >= 1 ? [[id, Math.floor(amount(n))]] : []));
  const r = object(v.recovery);
  return { outcome: v.outcome as ExplorationOutcome, choiceId: label(v.choiceId), node: label(v.node), title: label(v.title),
    ...(skill ? { skill } : {}), skillLevel: Math.floor(amount(v.skillLevel, 10)), difficulty: Math.floor(amount(v.difficulty, 10)), chance: amount(v.chance, 100), xp: Math.floor(amount(v.xp, 1)),
    hunger: amount(v.hunger), energy: amount(v.energy), healthLoss: amount(v.healthLoss), moodChange: amount(v.moodChange, 10000, -10000), finds, researchPoints: Math.floor(amount(v.researchPoints, 10)),
    ...(label(v.mealItem) ? { mealItem: label(v.mealItem) } : {}),
    ...(label(v.researchId) ? { researchId: label(v.researchId) } : {}),
    ...(amount(v.coins) ? { coins: amount(v.coins) } : {}), ...(amount(v.hearts) ? { hearts: amount(v.hearts) } : {}),
    ...(['trail_rope', 'survey_lens', 'prospector_pick', 'harvest_sickle'].includes(String(v.tool)) ? { tool: v.tool as DurableToolId, toolBroken: v.toolBroken === true } : {}),
    ...(v.recovery ? { recovery: { hunger: amount(r.hunger), energy: amount(r.energy), health: amount(r.health), mood: amount(r.mood), cleanliness: amount(r.cleanliness) } } : {}) };
};
export const normalizeExplorationCheckState = (raw: unknown, fallbackKey: string): ExplorationCheckState => {
  const v = object(raw), m = object(v.meal), last = normalizeExplorationCheckResult(v.last);
  const seed = typeof v.seed === 'number' && Number.isInteger(v.seed) && v.seed >= 0 && v.seed <= 0xffffffff ? v.seed : hashString(fallbackKey);
  const meal = amount(m.steps, 2) >= 1 && [.05, .1, .15].includes(Number(m.reduction)) ? { steps: Math.floor(amount(m.steps, 2)), reduction: Number(m.reduction) } : undefined;
  return { seed, focus: Math.floor(amount(v.focus, 2)), ...(meal ? { meal } : {}), ...(last ? { last } : {}) };
};
