import { recordEarnedHearts } from './achievements';
import { enforceAdventureHealth } from './adventureReturn';
import { isAdventureMapUnlocked } from './adventureState';
import { applyExplorationCheck, previewExplorationAction } from './explorationCheckActions';
import type { ExplorationCheckAction } from './explorationChecks';
import { campaignVisits, getCampaignTask, type CampaignVisitId } from './explorationCampaignData';
import { bindCampaignContacts, campaignEventVisible, campaignText, campaignVisitReady, campaignVisitStep, isCampaignDeliveryValid } from './explorationCampaignState';
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
export const startExplorationCampaign = (pet: PetState, neighbors: readonly NeighborIdentity[], actorId: string, now = Date.now()): PetState => {
  if (pet.timePause || !isAdventureMapUnlocked(pet.adventure)) return pet;
  const campaign = bindCampaignContacts({ ...pet.adventure.campaign, startedAt: pet.adventure.campaign.startedAt ?? now }, neighbors, actorId);
  return { ...pet, adventure: { ...pet.adventure, campaign }, recentEvent: '聚餐的事记下了。有空先去溪谷的小桥那边看看。' };
};

// The choice, delivery and task completion are committed together; retries cannot consume twice.
export const advanceCampaignVisit = (pet: PetState, tripId: string, revision: number, expectedStep: number, choiceId: string, delivery: Inventory, neighbors: readonly NeighborIdentity[], now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  const before = pet.adventure.active;
  if (!before?.campaign || before.id !== tripId || before.revision !== revision || campaignVisitStep(pet.adventure.campaign, before.campaign.visitId) !== expectedStep) return pet;
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

export const getCampaignClaimReason = (pet: PetState, taskId: number) => {
  const task = getCampaignTask(taskId), record = pet.adventure.campaign.tasks[taskId];
  if (pet.timePause) return '恢复时间后再领取。';
  if (!task || !record) return '这件事还没完成。';
  if (record.claimedAt) return '已经领过了。';
  if ((pet.inventory.golden_apple ?? 0) + task.apples > inventoryItemLimit) return '仓库里的金苹果已满，腾出位置后再领。';
  if (!Number.isFinite(pet.hearts + task.hearts) || pet.hearts + task.hearts > Number.MAX_SAFE_INTEGER) return '小心心暂时放不下，稍后再领。';
  return '';
};
export const claimCampaignTask = (pet: PetState, taskId: number, now = Date.now()): PetState => {
  const reason = getCampaignClaimReason(pet, taskId);
  if (reason) return pet;
  const task = getCampaignTask(taskId)!, state = pet.adventure.campaign, record = state.tasks[taskId]!;
  return recordEarnedHearts({ ...pet, hearts: pet.hearts + task.hearts, inventory: addInventoryItem(pet.inventory, 'golden_apple', task.apples),
    adventure: { ...pet.adventure, campaign: { ...state, tasks: { ...state.tasks, [taskId]: { ...record, claimedAt: now, reward: { hearts: task.hearts, apples: task.apples } } } } },
    recentEvent: `「${task.title}」的心意收到了：${task.hearts} 小心心、${task.apples} 个金苹果。`,
  }, task.hearts);
};
