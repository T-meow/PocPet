import { recordEarnedHearts } from './achievements';
import { enforceAdventureHealth } from './adventureReturn';
import { isAdventureMapUnlocked } from './adventureState';
import { applyExplorationCheck, previewExplorationAction } from './explorationCheckActions';
import type { ExplorationCheckAction } from './explorationChecks';
import { campaignVisits, getCampaignTask, getCampaignReward, type CampaignVisitId } from './explorationCampaignData';
import { bindCampaignContacts, campaignEventVisible, campaignText, campaignVisitReady, campaignVisitStep, isCampaignDeliveryValid, campaignRunFinished, campaignRunSnapshot, defaultExplorationCampaign } from './explorationCampaignState';
import { getQuarterKey } from './dailyReset';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, removeInventoryItem } from './items';
import { expeditionRegionForMap } from './landmarkProgress';
import { advancePet } from './petLifecycle';
import type { Inventory, NeighborIdentity, PetState } from './petTypes';
import { inventoryItemLimit } from './saveMetadata';

export const campaignCheckAction = (id: CampaignVisitId, step: number, choice = 'continue'): ExplorationCheckAction => ({
  id: choice, title: campaignVisits[id].steps[step]?.title ?? '聚餐准备', hunger: 4, energy: 2,
  check: { mode: 'story', skill: 'study' },
});
export const getCampaignStepPreview = (pet: PetState, id: CampaignVisitId) => {
  const step = campaignVisitStep(pet.adventure.campaign, id);
  return previewExplorationAction(pet, pet.adventure.active ?? { id: 'picnic', bag: {}, tool: false, rulesVersion: 11 }, campaignCheckAction(id, step), `picnic:${id}:${step}`, expeditionRegionForMap[campaignVisits[id].region]);
};
export const getCampaignStartReason = (pet: PetState, now = Date.now()) => {
  if (pet.timePause) return '恢复时间后再准备聚餐。';
  if (!isAdventureMapUnlocked(pet.adventure)) return '先完成新手踩点。';
  const state = pet.adventure.campaign;
  if (state.startedAt && !campaignRunFinished(state)) return '先办完当前一期，并收下全部心意。';
  if (state.lastOpenedQuarter >= getQuarterKey(getEffectiveDailyDateKey(pet, now))) return '本季度已经准备过聚餐，下季度再约。';
  if (pet.adventure.active || pet.adventure.pending || pet.community.expedition.active || pet.community.expedition.pending) return '先结束当前行程并收好返程行囊。';
  return '';
};
export const startExplorationCampaign = (pet: PetState, neighbors: readonly NeighborIdentity[], actorId: string, now = Date.now(), expectedRunId = pet.adventure.campaign.runId): PetState => {
  const previous = pet.adventure.campaign;
  if (previous.runId !== expectedRunId || pet.timePause || !isAdventureMapUnlocked(pet.adventure)) return pet;
  // Rebinding contacts does not restart an unfinished run.
  if (previous.startedAt && !campaignRunFinished(previous)) {
    const campaign = bindCampaignContacts(previous, neighbors, actorId);
    return { ...pet, adventure: { ...pet.adventure, campaign } };
  }
  // Existing trips may coexist with the first invitation; later runs require a settled trip.
  const reason = getCampaignStartReason(pet, now);
  if (reason && (previous.startedAt || !reason.startsWith('先结束'))) return pet;
  const quarter = getQuarterKey(getEffectiveDailyDateKey(pet, now));
  const history = previous.startedAt ? [...previous.history, campaignRunSnapshot(previous)] : previous.history;
  const removed = history.slice(0, Math.max(0, history.length - 80));
  const sumReward = (key: 'hearts' | 'apples') => removed.reduce((total, run) => total + Object.values(run.tasks).reduce((sum, record) => sum + (record?.reward?.[key] ?? 0), 0), 0);
  const campaign = bindCampaignContacts({ ...defaultExplorationCampaign(), startedAt: now, quarter, lastOpenedQuarter: quarter,
    runId: `picnic:${pet.createdAt}:${quarter}:${now}`, history: history.slice(-80),
    archivedCount: previous.archivedCount + removed.length, archivedHearts: previous.archivedHearts + sumReward('hearts'), archivedApples: previous.archivedApples + sumReward('apples') }, neighbors, actorId);
  return { ...pet, adventure: { ...pet.adventure, campaign }, recentEvent: '聚餐的事记下了。有空先去溪谷的小桥那边看看。' };
};

// The choice, delivery and task completion are committed together; retries cannot consume twice.
export const advanceCampaignVisit = (pet: PetState, tripId: string, revision: number, expectedStep: number, choiceId: string, delivery: Inventory, neighbors: readonly NeighborIdentity[], now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  const before = pet.adventure.active;
  if (!before?.campaign || before.campaign.runId !== pet.adventure.campaign.runId || before.id !== tripId || before.revision !== revision || campaignVisitStep(pet.adventure.campaign, before.campaign.visitId) !== expectedStep) return pet;
  pet = advancePet(pet, now);
  const trip = pet.adventure.active;
  if (!trip?.campaign || trip.id !== tripId || !campaignEventVisible(pet, trip) || pet.isSleeping || pet.partnerSchedule.active) return pet;
  const id = trip.campaign.visitId, visit = campaignVisits[id], state = pet.adventure.campaign;
  if (!campaignVisitReady(state, id)) return pet;
  const step = visit.steps[expectedStep], option = step?.options.find(value => value.id === choiceId);
  if (!option) return pet;
  if (!isCampaignDeliveryValid(step.delivery, delivery, trip.bag)) return { ...pet, recentEvent: '先在行囊中选好这次要交的东西。' };
  const action = campaignCheckAction(id, expectedStep, choiceId);
  const preview = getCampaignStepPreview(pet, id);
  if (preview.reason) return { ...pet, recentEvent: preview.reason };
  const checked = applyExplorationCheck(pet, trip, action, `picnic:${id}:${expectedStep}`, expeditionRegionForMap[visit.region]);
  if (!checked) return pet;
  let campaign = { ...state, visits: { ...state.visits, [id]: [...(state.visits[id] ?? []), option.id] },
    tasks: step.task && !state.tasks[step.task] ? { ...state.tasks, [step.task]: { completedAt: now, ...(step.delivery ? { delivery: { ...delivery } } : {}) } } : state.tasks };
  campaign = bindCampaignContacts(campaign, neighbors, trip.actorId);
  const bag = Object.entries(delivery).reduce((stock, [item, count]) => count ? removeInventoryItem(stock, item, count) : stock, trip.bag);
  return enforceAdventureHealth({ ...checked.pet, lastInteractionAt: now,
    adventure: { ...checked.pet.adventure, campaign, active: { ...trip, bag, revision: revision + 1, checkState: checked.state,
      energySpent: (trip.energySpent ?? 0) + checked.energySpent, healthLost: (trip.healthLost ?? 0) + checked.healthLost, paidActions: (trip.paidActions ?? 0) + 1 } },
    recentEvent: campaignText(option.result, campaign, visit.region),
  }, now);
};

export const getCampaignClaimReason = (pet: PetState, taskId: number, runId = pet.adventure.campaign.runId) => {
  const task = getCampaignTask(taskId), record = pet.adventure.campaign.tasks[taskId];
  const reward = getCampaignReward(taskId, pet.adventure.campaign.rewardVersion);
  if (runId !== pet.adventure.campaign.runId) return '聚餐轮次已变化，请重新打开任务。';
  if (pet.timePause) return '恢复时间后再领取。';
  if (!task || !record) return '这件事还没完成。';
  if (record.claimedAt) return '已经领过了。';
  if ((pet.inventory.golden_apple ?? 0) + reward.apples > inventoryItemLimit) return '仓库里的金苹果已满，腾出位置后再领。';
  if (!Number.isFinite(pet.hearts + reward.hearts) || pet.hearts + reward.hearts > Number.MAX_SAFE_INTEGER) return '小心心暂时放不下，稍后再领。';
  return '';
};
export const claimCampaignTask = (pet: PetState, taskId: number, now = Date.now(), runId = pet.adventure.campaign.runId): PetState => {
  const reason = getCampaignClaimReason(pet, taskId, runId);
  if (reason) return pet;
  const definition = getCampaignTask(taskId)!, state = pet.adventure.campaign, record = state.tasks[taskId]!;
  const task = { ...definition, ...getCampaignReward(taskId, state.rewardVersion) };
  return recordEarnedHearts({ ...pet, hearts: pet.hearts + task.hearts, inventory: addInventoryItem(pet.inventory, 'golden_apple', task.apples),
    adventure: { ...pet.adventure, campaign: { ...state, tasks: { ...state.tasks, [taskId]: { ...record, claimedAt: now, reward: { hearts: task.hearts, apples: task.apples } } } } },
    recentEvent: `「${task.title}」的心意收到了：${task.hearts} 小心心、${task.apples} 个金苹果。`,
  }, task.hearts);
};
