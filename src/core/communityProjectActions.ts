import { recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { updatePetSatiety } from './petStats';
import { projectIds } from './expeditionData';
import { withExpedition } from './expeditionReturn';
import { advanceCommunityActivities, getCommunityActivityBoard, getProjectThemeReason } from './communityActivities';
import { communityProjects, getCommunityGiftItems, projectThemes, type ProjectTheme, type CommunityGiftKind } from './communityProjectData';
import { inventoryItemLimit } from './saveMetadata';
import { hashString } from './utils';
import type { ProjectId, CommunityProject } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';

const changeProject = (pet: PetState, id: ProjectId, project: CommunityProject): PetState =>
  withExpedition(pet, { projects: { ...pet.community.expedition.projects, [id]: project } });
export const getProjectRunId = (pet: PetState, id: ProjectId) => {
  const p = pet.community.expedition.projects[id];
  return p.invitationId ?? `legacy:${id}:${p.completed}`;
};
export const getProjectReason = (pet: PetState, id: ProjectId, theme: ProjectTheme, now = Date.now()) => {
  if (pet.timePause) return '时间已冻结，恢复后再接取活动';
  const p = pet.community.expedition.projects[id], board = getCommunityActivityBoard(pet, now);
  if (p.reward) return '先领完上一次活动的邻居回礼';
  if (p.theme) return '先完成已经接下的筹备';
  if (board.project !== id) return '等待这项活动的下一轮邀请';
  if (board.accepted) return '本周邀请已经接取，下次轮到时再来';
  return getProjectThemeReason(pet, id, theme);
};
export const startCommunityProject = (pet: PetState, id: ProjectId, theme: ProjectTheme, invitationId: string, now = Date.now()): PetState => {
  if (pet.timePause || !projectIds.includes(id) || !projectThemes.includes(theme)) return pet;
  pet = advanceCommunityActivities(advancePet(pet, now), now);
  const board = pet.community.activityBoard;
  if (board.invitationId !== invitationId || getProjectReason(pet, id, theme, now)) return pet;
  const next = changeProject(pet, id, { ...pet.community.expedition.projects[id], theme, stage: 0, invitationId });
  return { ...next, community: { ...next.community, activityBoard: { ...board, accepted: true } },
    recentEvent: '已接下社区活动邀请。主题已经记好，跨周也能继续，每一步交付都会保留。' };
};
export const getProjectDelivery = (pet: PetState, id: ProjectId): Inventory => {
  const p = pet.community.expedition.projects[id], data = communityProjects[id], index = p.theme === 'journey' ? 1 : 0;
  return p.stage === 0 ? data.supplies[index] : p.stage === 1 ? data.meals[index] : {};
};
export const getProjectContributionReason = (pet: PetState, id: ProjectId) => {
  const p = pet.community.expedition.projects[id];
  if (pet.timePause) return '时间已冻结，恢复后继续筹备';
  if (!p.theme || p.reward) return '先接下活动邀请';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '等伙伴休息或忙完后，再一起准备';
  if (Object.entries(getProjectDelivery(pet, id)).some(([item, n]) => (pet.inventory[item] ?? 0) < n)) return '本阶段物资还未备齐，已交付阶段会一直保留';
  if (p.stage === 2 && (pet.hunger < 4 || pet.energy < 4)) return '举办需要饱食 4、体力 4，请先补充';
  if (p.completed >= Number.MAX_SAFE_INTEGER) return '活动记录已达上限';
  return '';
};
export const contributeCommunityProject = (pet: PetState, id: ProjectId, invitationId: string, stage: number, now = Date.now()): PetState => {
  if (pet.timePause || !projectIds.includes(id) || ![0, 1].includes(stage)) return pet;
  pet = advancePet(pet, now);
  const p = pet.community.expedition.projects[id];
  if (getProjectRunId(pet, id) !== invitationId || p.stage !== stage) return pet;
  const reason = getProjectContributionReason(pet, id);
  if (reason) return { ...pet, recentEvent: reason };
  const inventory = Object.entries(getProjectDelivery(pet, id)).reduce((stock, [item, n]) => removeInventoryItem(stock, item, n), pet.inventory);
  return { ...changeProject(pet, id, { ...p, stage: stage + 1 }), inventory, recentEvent: stage === 0 ? '物资已交付，接下来准备料理。' : '料理已备好，随时可以邀请邻居来参加。' };
};
export const finishCommunityProject = (pet: PetState, id: ProjectId, invitationId: string, actorId: string, actorName: string, now = Date.now()): PetState => {
  if (pet.timePause || !projectIds.includes(id)) return pet;
  pet = advancePet(pet, now);
  const p = pet.community.expedition.projects[id];
  if (getProjectRunId(pet, id) !== invitationId || p.stage !== 2) return pet;
  const reason = getProjectContributionReason(pet, id);
  if (reason) return { ...pet, recentEvent: reason };
  const data = communityProjects[id], first = p.completed === 0;
  const roll = hashString(`${pet.saveMetadata.id}:${id}:${invitationId}:neighbor-gift-v1`) % 100;
  const gift: CommunityGiftKind = roll < 50 ? 'apples' : roll < 85 ? 'garden' : 'surprise';
  const name = actorName.trim().slice(0, 32) || pet.name;
  return updatePetSatiety({ ...changeProject(pet, id, { ...p, stage: 0, theme: undefined, invitationId,
    completed: p.completed + 1, lastDay: getEffectiveDailyDateKey(pet, now),
    ...(first ? { firstAt: now, actorId: actorId.slice(0, 128), actorName: name } : {}),
    reward: { version: 1, id: invitationId, hearts: data.hearts * (first ? 2 : 1), gift, items: getCommunityGiftItems(id, gift), first, at: now, actorName: name },
  }), hunger: pet.hunger - 4, energy: pet.energy - 4,
    recentEvent: `「${data.name}」圆满完成。${first ? '永久回忆已收藏，体力上限 +3。' : ''}邻居们的回礼已经备好。` });
};
export const getProjectRewardReason = (pet: PetState, id: ProjectId) => {
  const reward = pet.community.expedition.projects[id].reward;
  if (pet.timePause) return '时间已冻结，恢复后领取';
  if (!reward) return '回礼已领取';
  if (pet.hearts > Number.MAX_SAFE_INTEGER - reward.hearts) return '小心心已达容量上限，整份回礼继续保留';
  if (Object.entries(reward.items).some(([item, n]) => (pet.inventory[item] ?? 0) + n > inventoryItemLimit)) return '回礼物品的仓库已满，整理后可领取，整份回礼继续保留';
  return '';
};
export const claimCommunityProjectReward = (pet: PetState, id: ProjectId, rewardId: string): PetState => {
  if (pet.timePause || !projectIds.includes(id)) return pet;
  const p = pet.community.expedition.projects[id], reward = p.reward;
  if (!reward || reward.id !== rewardId) return pet;
  const reason = getProjectRewardReason(pet, id);
  if (reason) return { ...pet, recentEvent: reason };
  const inventory = Object.entries(reward.items).reduce((stock, [item, n]) => addInventoryItem(stock, item, n), pet.inventory);
  return recordEarnedHearts({ ...changeProject(pet, id, { ...p, reward: undefined }), inventory, hearts: pet.hearts + reward.hearts,
    recentEvent: `邻居回礼已收好：${reward.hearts} 小心心与礼盒物品已全部入账。` }, reward.hearts);
};
