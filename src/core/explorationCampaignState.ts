import type { AdventureTrip } from './adventureTypes';
import type { Inventory, ItemId, NeighborIdentity, NeighborReference, PetState } from './petTypes';
import { campaignChapterIds, campaignChapters, campaignTasks, campaignVisitIds, campaignVisits, getCampaignTask, isCampaignVisitId, type CampaignChapterId, type CampaignDelivery, type CampaignVisitId } from './explorationCampaignData';
import { getLandmarkReason, isLandmarkId, landmarkId, type LandmarkId } from './landmarkProgress';
import { getAdventureStepCount } from './adventureData';
import { selectNeighborReference } from './neighbors';
import { getDailyResetDateKey, getQuarterKey } from './dailyReset';
import { museumVisits } from './museumData';

export interface CampaignContact { reference: NeighborReference; name: string }
export interface CampaignTaskRecord { completedAt: number; claimedAt?: number; reward?: { hearts: number; apples: number }; delivery?: Inventory }
export interface CampaignRun {
  runId: string; quarter: string; rewardVersion: 1 | 2; startedAt?: number;
  contacts: Partial<Record<CampaignChapterId, CampaignContact>>;
  visits: Partial<Record<CampaignVisitId, string[]>>;
  tasks: Partial<Record<number, CampaignTaskRecord>>;
}
export interface ExplorationCampaignState extends CampaignRun {
  schemaVersion: 2; lastOpenedQuarter: string; history: CampaignRun[];
  archivedCount: number; archivedHearts: number; archivedApples: number;
}
export interface CampaignTripContext { runId: string; visitId: CampaignVisitId; mode: 'visit' | 'embedded'; startStep: number }
const emptyRun = (): CampaignRun => ({ runId: '', quarter: '', rewardVersion: 2, contacts: {}, visits: {}, tasks: {} });
export const defaultExplorationCampaign = (): ExplorationCampaignState => ({ ...emptyRun(), schemaVersion: 2, lastOpenedQuarter: '', history: [], archivedCount: 0, archivedHearts: 0, archivedApples: 0 });
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const timestamp = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0;
const quarter = (value: unknown) => typeof value === 'string' && /^\d{4}-Q[1-4]$/.test(value) ? value : '';
const normalizeRun = (raw: unknown, legacy = false): CampaignRun => {
  const value = object(raw), state = emptyRun();
  const startedAt = timestamp(value.startedAt);
  if (!startedAt) return state;
  state.startedAt = startedAt;
  state.runId = typeof value.runId === 'string' && value.runId.length > 0 ? value.runId.slice(0, 128) : `picnic:legacy:${startedAt}`;
  state.quarter = quarter(value.quarter) || getQuarterKey(getDailyResetDateKey(startedAt));
  state.rewardVersion = legacy || value.rewardVersion === 1 ? 1 : 2;
  for (const chapter of campaignChapterIds) {
    const contact = object(object(value.contacts)[chapter]), reference = object(contact.reference);
    if (typeof contact.name !== 'string' || !contact.name.trim()) continue;
    state.contacts[chapter] = { name: contact.name.trim().slice(0, 32), reference: reference.kind === 'mod' && typeof reference.modId === 'string' && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(reference.modId) ? { kind: 'mod', modId: reference.modId } : { kind: 'generic' } };
  }
  for (const id of campaignVisitIds) {
    const choices = object(value.visits)[id];
    if (!Array.isArray(choices)) continue;
    const valid: string[] = [];
    for (const choice of choices.slice(0, campaignVisits[id].steps.length)) {
      if (!campaignVisits[id].steps[valid.length].options.some(option => option.id === choice)) break;
      valid.push(choice);
    }
    if (valid.length) state.visits[id] = valid;
  }
  for (const task of campaignTasks) {
    const record = object(object(value.tasks)[task.id]), completedAt = timestamp(record.completedAt);
    if (!completedAt) continue;
    const claimedAt = timestamp(record.claimedAt), reward = object(record.reward);
    const delivered = Object.fromEntries(Object.entries(object(record.delivery)).flatMap(([id, count]) => amount(count) ? [[id, amount(count)]] : []));
    const requirement = Object.values(campaignVisits).flatMap(visit => visit.steps).find(step => step.task === task.id)?.delivery;
    state.tasks[task.id] = { completedAt, ...(claimedAt ? { claimedAt, reward: { hearts: amount(reward.hearts), apples: amount(reward.apples) } } : {}),
      ...(requirement && isCampaignDeliveryValid(requirement, delivered, delivered) ? { delivery: delivered } : {}) };
  }
  return state;
};
export const normalizeExplorationCampaign = (raw: unknown): ExplorationCampaignState => {
  const value = object(raw), run = normalizeRun(value, value.schemaVersion !== 2);
  const seen = new Set([run.runId]);
  const history = (Array.isArray(value.history) ? value.history : []).slice(-80).map(entry => normalizeRun(entry)).filter(entry => {
    if (!entry.startedAt || seen.has(entry.runId) || !campaignTasks.every(task => entry.tasks[task.id]?.claimedAt)) return false;
    seen.add(entry.runId); return true;
  });
  return { ...run, schemaVersion: 2, history,
    lastOpenedQuarter: [quarter(value.lastOpenedQuarter), run.quarter, ...history.map(entry => entry.quarter)].sort().pop() ?? '',
    archivedCount: amount(value.archivedCount), archivedHearts: amount(value.archivedHearts), archivedApples: amount(value.archivedApples) };
};
export const campaignRunSnapshot = (state: ExplorationCampaignState): CampaignRun => ({ runId: state.runId, quarter: state.quarter, rewardVersion: state.rewardVersion, startedAt: state.startedAt, contacts: state.contacts, visits: state.visits, tasks: state.tasks });
export const campaignRunFinished = (state: CampaignRun) => campaignTasks.every(task => Boolean(state.tasks[task.id]?.claimedAt));
export const normalizeCampaignTripContext = (raw: unknown, purpose: unknown, legacyRunId = ''): CampaignTripContext | undefined => {
  const value = object(raw);
  if (!isCampaignVisitId(value.visitId) || !isLandmarkId(purpose) || !['visit', 'embedded'].includes(String(value.mode))) return undefined;
  const visit = campaignVisits[value.visitId];
  if (purpose !== landmarkId(visit.region, visit.node)) return undefined;
  const runId = typeof value.runId === 'string' ? value.runId.slice(0, 128) : legacyRunId;
  return runId ? { runId, visitId: value.visitId, mode: value.mode as CampaignTripContext['mode'], startStep: Math.min(visit.steps.length, amount(value.startStep)) } : undefined;
};
export const campaignChapterReady = (state: CampaignRun, chapter: CampaignChapterId) => Boolean(state.startedAt) && campaignChapters[chapter].requires.every(id => state.tasks[id]);
export const bindCampaignContacts = (state: ExplorationCampaignState, neighbors: readonly NeighborIdentity[], actorId: string): ExplorationCampaignState => {
  if (!state.startedAt) return state;
  const contacts = { ...state.contacts };
  const used = new Set(Object.values(contacts).flatMap(contact => contact?.reference.kind === 'mod' ? [contact.reference.modId] : []));
  for (const chapter of campaignChapterIds) {
    if (contacts[chapter] || !campaignChapterReady(state, chapter)) continue;
    const available = neighbors.filter(neighbor => neighbor.modId !== actorId && !used.has(neighbor.modId) && /^[a-z0-9][a-z0-9._-]{1,127}$/.test(neighbor.modId) && neighbor.name.trim());
    const reference = selectNeighborReference(`picnic:${state.startedAt}:${chapter}`, available);
    const name = reference.kind === 'mod' ? available.find(neighbor => neighbor.modId === reference.modId)!.name : ({ valley: '社区邻居', windmill: '一起备东西的伙伴', forest: '约好同行的伙伴', coast: '来帮忙的邻居', observatory: '一起布置的伙伴' })[chapter];
    contacts[chapter] = { reference, name: name.trim().slice(0, 32) };
    if (reference.kind === 'mod') used.add(reference.modId);
  }
  return { ...state, contacts };
};
export const campaignText = (text: string, state: CampaignRun, chapter: CampaignChapterId) => text.replace(/\{neighbor\}/g, () => state.contacts[chapter]?.name ?? '伙伴');
export const campaignVisitStep = (state: CampaignRun, id: CampaignVisitId) => state.visits[id]?.length ?? 0;
export const campaignVisitComplete = (state: CampaignRun, id: CampaignVisitId) => campaignVisitStep(state, id) >= campaignVisits[id].steps.length;
export const campaignVisitReady = (state: ExplorationCampaignState, id: CampaignVisitId) => campaignChapterReady(state, campaignVisits[id].region) && Boolean(state.contacts[campaignVisits[id].region]) && campaignVisits[id].requires.every(task => state.tasks[task]) && !campaignVisitComplete(state, id);
export const availableCampaignVisits = (pet: PetState) => campaignVisitIds.filter(id => campaignVisitReady(pet.adventure.campaign, id));
export const getCampaignVisitReason = (pet: PetState, id: CampaignVisitId) => {
  const state = pet.adventure.campaign, visit = campaignVisits[id];
  if (!state.startedAt) return '先看看伙伴的聚餐提议。';
  if (campaignVisitComplete(state, id)) return '这里的准备已经做好了。';
  if (!campaignChapterReady(state, visit.region)) return '先完成前面的聚餐准备。';
  const missing = visit.requires.filter(task => !state.tasks[task]);
  if (missing.length) return `先完成「${missing.map(id => getCampaignTask(id)!.title).join('」「')}」。`;
  if (!state.contacts[visit.region]) return '先回任务页确认一起筹备的伙伴。';
  return getLandmarkReason(pet.adventure, visit.region, visit.node);
};
export const campaignVisitAt = (pet: PetState, purpose?: string) => availableCampaignVisits(pet).find(id => {
  const visit = campaignVisits[id]; return purpose === landmarkId(visit.region, visit.node);
});
export const getCampaignSupplies = (pet: PetState, id: CampaignVisitId): CampaignDelivery[] => campaignVisits[id].steps.slice(campaignVisitStep(pet.adventure.campaign, id)).flatMap(step => step.delivery ? [step.delivery] : []);
export const getCampaignDelivery = (requirement: CampaignDelivery, bag: Inventory): Inventory => {
  let left = requirement.amount;
  const chosen: Inventory = {};
  for (const item of requirement.items) {
    const count = Math.min(left, bag[item] ?? 0);
    if (count > 0) chosen[item] = count;
    left -= count;
  }
  return chosen;
};
export const isCampaignDeliveryValid = (requirement: CampaignDelivery | undefined, chosen: Inventory, bag: Inventory) => {
  const entries = Object.entries(chosen).filter(([, count]) => count !== 0);
  if (!requirement) return entries.length === 0;
  return entries.every(([id, count]) => requirement.items.includes(id as ItemId) && Number.isInteger(count) && count > 0 && count <= (bag[id] ?? 0))
    && entries.reduce((total, [, count]) => total + count, 0) === requirement.amount;
};
export const campaignCargoIds = (pet: PetState, purpose?: string): string[] => {
  const id = campaignVisitAt(pet, purpose);
  return id ? [...new Set(getCampaignSupplies(pet, id).flatMap(requirement => requirement.items))] : [];
};
export const campaignEventVisible = (pet: PetState, trip = pet.adventure.active) => Boolean(trip?.campaign && trip.campaign.runId === pet.adventure.campaign.runId && (trip.campaign.mode === 'visit' || trip.choices.length >= getAdventureStepCount(trip.region, trip.purpose)));
export const adventureTripProgress = (pet: Pick<PetState, 'adventure'>, trip: AdventureTrip) => trip.museum
  ? { steps: Math.max(0, trip.museum.step - trip.museum.startStep), total: museumVisits[trip.museum.visitId].steps.length - trip.museum.startStep }
  : trip.campaign?.mode === 'visit'
  ? { steps: Math.max(0, campaignVisitStep(pet.adventure.campaign, trip.campaign.visitId) - trip.campaign.startStep), total: campaignVisits[trip.campaign.visitId].steps.length - trip.campaign.startStep }
  : { steps: trip.choices.length, total: getAdventureStepCount(trip.region, trip.purpose) };
export const campaignDestination = (id: CampaignVisitId): LandmarkId => landmarkId(campaignVisits[id].region, campaignVisits[id].node);
