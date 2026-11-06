import { expeditionProducts, projectIds, regionIds } from './expeditionData';
import type { ExpeditionState, RegionId } from './expeditionTypes';
import { explorationTravel } from './explorationTravelData';
import { adventureTreasureIds } from './adventureItems';
import type { ExpeditionItemId } from './expeditionTypes';
import { communityGiftPool } from './communityProjectData';
import { getProjectThemes, isProjectTheme } from './communityThemes';
import { commonLootPityLimit, explorationCapacity } from './explorationBudget';

const obj = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
const n = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
const stamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
const label = (v: unknown) => typeof v === 'string' ? v.slice(0, 128) : '';
export const defaultExpeditionState = (): ExpeditionState => ({ schemaVersion: 8, nextId: 1,
  regions: Object.fromEntries(regionIds.map(id => [id, { surveyed: false, base: 0, harvestDay: '', harvestUsed: 0 }])) as ExpeditionState['regions'],
  projects: Object.fromEntries(projectIds.map(id => [id, { completed: 0, stage: 0, lastDay: '' }])) as ExpeditionState['projects'], collection: {},
});
export const normalizeExpeditionState = (raw: unknown, _capacity = 24): ExpeditionState => {
  const v = { ...obj(raw) }, state = defaultExpeditionState();
  const regionValues = { ...obj(v.regions) }; regionValues.hills ??= regionValues.windmill; regionValues.station ??= regionValues.observatory; v.regions = regionValues;
  state.nextId = Math.max(1, n(v.nextId));
  const loop = obj(v.loop);
  if (stamp(loop.refillAt) && day(loop.day)) {
    const voucherIds = new Set<string>(), heartIds = new Set<string>();
    state.loop = { refillAt: loop.refillAt, available: n(loop.available, loop.version === 2 ? explorationCapacity : 24), used: n(loop.used), day: day(loop.day), ...(loop.lootSettledThrough !== undefined ? { lootSettledThrough: n(loop.lootSettledThrough, n(loop.used)) } : {}),
      ...(loop.version === 2 ? { version: 2, paySettledThrough: n(loop.paySettledThrough, n(loop.used)), ...(loop.commonLootMisses !== undefined ? { commonLootMisses: n(loop.commonLootMisses, commonLootPityLimit - 1) } : {}), ...(loop.compensation ? { compensation: { coins: n(obj(loop.compensation).coins), hearts: n(obj(loop.compensation).hearts) } } : {}) } : {}),
      vouchers: (Array.isArray(loop.vouchers) ? loop.vouchers : []).slice(0, 12).flatMap((entry: unknown) => {
        const q = obj(entry), key = `${q.day}:${q.slot}`;
        if (!day(q.day) || ![0, 1, 2, 3].includes(q.slot) || ![150, 300, 600].includes(q.face) || voucherIds.has(key)) return [];
        const paid = [0, 40, 80, 100].includes(q.paid) ? q.paid : 100;
        const region: RegionId | undefined = regionIds.includes(q.region) ? q.region : paid ? 'valley' : undefined;
        const lootRegion: RegionId | undefined = regionIds.includes(q.lootRegion) ? q.lootRegion : undefined;
        voucherIds.add(key); return [{ day: q.day, slot: q.slot, face: q.face, paid, ...(region ? { region, quote: q.quote > 0 ? n(q.quote, 1320) : Math.floor(q.face * explorationTravel[region].payPercent / 100) } : {}),
          ...(q.rewardsVersion === 1 ? { rewardsVersion: 1 as const, lootUsed: n(q.lootUsed, 100), ...(lootRegion ? { lootRegion, lootQuote: q.lootQuote > 0 ? n(q.lootQuote, 1320) : Math.floor(q.face * explorationTravel[lootRegion].payPercent / 100) } : {}) } : {}) }];
      }),
      heartDays: (Array.isArray(loop.heartDays) ? loop.heartDays : []).slice(0, 3).flatMap((entry: unknown) => {
        const q = obj(entry); if (!day(q.day) || heartIds.has(q.day)) return [];
        heartIds.add(q.day); return [{ day: q.day, hours: n(q.hours, 4), claimed: q.claimed === true }];
      }), observations: Array.isArray(loop.observations) ? [...new Set<string>(loop.observations.filter((x: unknown) => typeof x === 'string' && /^[0-5]:[ab]$/.test(x)))] : [],
      milestones: [6, 12].filter(x => Array.isArray(loop.milestones) && loop.milestones.includes(x)), firstTreasure: loop.firstTreasure === true };
  }
  for (const id of regionIds) {
    const r = obj(obj(v.regions)[id]);
    state.regions[id] = { surveyed: r.surveyed === true, base: r.surveyed === true ? n(r.base, 2) : 0, harvestDay: day(r.harvestDay), harvestUsed: n(r.harvestUsed, 3),
      ...(r.surveyed === true && stamp(r.storyAt) ? { storyAt: r.storyAt, actorId: label(r.actorId), actorName: label(r.actorName) } : {}) };
  }
  for (const id of projectIds) {
    const p = obj(obj(v.projects)[id]), theme = isProjectTheme(id, p.theme) ? p.theme : undefined;
    state.projects[id] = { completed: n(p.completed), stage: theme ? n(p.stage, 2) : 0, theme, lastDay: day(p.lastDay),
      ...(n(p.completed) > 0 && stamp(p.firstAt) ? { firstAt: p.firstAt, actorId: label(p.actorId), actorName: label(p.actorName) } : {}) };
    state.projects[id].lastTheme = isProjectTheme(id, p.lastTheme) ? p.lastTheme : n(p.completed) ? 'garden' : undefined;
    state.projects[id].memories = Object.fromEntries(getProjectThemes(id).flatMap(definition => {
      const memory = obj(obj(p.memories)[definition.id]);
      return n(memory.completed) && stamp(memory.firstAt) ? [[definition.id, { completed: n(memory.completed), firstAt: memory.firstAt, actorId: label(memory.actorId), actorName: label(memory.actorName) }]] : [];
    }));
    if (n(p.completed) && !Object.keys(state.projects[id].memories!).length && stamp(p.firstAt)) state.projects[id].memories = { garden: { completed: n(p.completed), firstAt: p.firstAt, actorId: label(p.actorId), actorName: label(p.actorName) } };
    const invitation = typeof p.invitationId === 'string' && (new RegExp(`^activity:[1-9][0-9]*:${id}$`).test(p.invitationId) || new RegExp(`^legacy:${id}:[0-9]+$`).test(p.invitationId)) ? p.invitationId.slice(0, 128) : undefined;
    if (invitation) state.projects[id].invitationId = invitation;
    const reward = obj(p.reward), gift = communityGiftPool.find(entry => entry.kind === reward.gift)?.kind;
    const rewardItems = Object.entries(obj(reward.items));
    const validRewardItems = rewardItems.length > 0 && rewardItems.length <= 4 && rewardItems.every(([item, count]) =>
      ['golden_apple', 'gift_tree_sapling', 'heart_fertilizer', 'harvest_nutrient'].includes(item) && Number.isSafeInteger(count) && count > 0 && count <= 9999);
    if (!theme && n(p.completed) > 0 && invitation && reward.version === 1 && reward.id === invitation && gift && stamp(reward.at)
      && Number.isSafeInteger(reward.hearts) && reward.hearts > 0 && validRewardItems) {
      const first = n(p.completed) === 1 && reward.first === true;
      // A completed event owns its quoted reward even if future activity tuning changes.
      state.projects[id].reward = { version: 1, id: invitation, first, gift, hearts: reward.hearts, items: Object.fromEntries(rewardItems), at: reward.at, actorName: label(reward.actorName), theme: isProjectTheme(id, reward.theme) ? reward.theme : state.projects[id].lastTheme };
    }
  }
  for (const id of [...Object.keys(expeditionProducts), ...adventureTreasureIds] as ExpeditionItemId[]) {
    const count = n(obj(v.collection)[id]); if (count) state.collection[id] = count;
  }
  return state;
};
