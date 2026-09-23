import { getEffectiveDailyDateKey } from './gameClock';
import { getWeekStartDateKey } from './dailyReset';
import { projectIds } from './expeditionData';
import { communityProjects, projectThemes, type ProjectTheme } from './communityProjectData';
import { getRecipeUnlockReason } from './kitchenRecipes';
import { completedChapter, completedLandmark } from './landmarkProgress';
import type { RecipeId } from './companionActivityTypes';
import type { CommunityActivityBoard } from './communityTypes';
import type { ProjectId } from './expeditionTypes';
import type { PetState } from './petTypes';

export const getProjectThemeReason = (pet: PetState, id: ProjectId, theme: ProjectTheme): string => {
  if (!((pet.adventure.completed.tutorial ?? 0) > 0)) return '先完成并结算新手踩点';
  if (id === 'riverside') {
    if (!pet.community.firstOrderDelivered) return '先给修渠邻居送出第一碗社区暖粥';
    if (theme === 'journey' && !completedLandmark(pet.adventure, 'valley', 'story')) return '先完成溪谷旧温室地标';
  }
  if (id === 'exhibition') {
    if (theme === 'garden' && !pet.community.facilities.fishing_hut.built) return '先建好钓鱼小屋';
    if (theme === 'garden' && Object.keys(pet.community.fishing.journal).length < 2) return '鱼类手账记下任意两种鱼，不要求珍稀鱼';
    if (theme === 'journey' && (!completedChapter(pet.adventure, 'forest') || !completedChapter(pet.adventure, 'coast'))) return '先完成林地与海岸各八个地标';
  }
  if (id === 'observatory' && (!completedChapter(pet.adventure, 'observatory') || pet.community.expedition.regions.station.base < 1)) return '先完成观测站八个地标，并建好一级休息基地';
  const menu = communityProjects[id].meals[theme === 'journey' ? 1 : 0];
  for (const item of Object.keys(menu)) {
    const reason = getRecipeUnlockReason(pet, item.slice(5) as RecipeId);
    if (reason) return reason;
  }
  return '';
};

// Reading an invitation and advancing the saved board use exactly the same selector.
export const getCommunityActivityBoard = (pet: PetState, now = Date.now()): CommunityActivityBoard => {
  const current = pet.community.activityBoard;
  if (pet.timePause) return current;
  const week = getWeekStartDateKey(getEffectiveDailyDateKey(pet, now));
  if (current.week >= week && current.project) return current;
  const eligible = projectIds.filter(id => projectThemes.some(theme => !getProjectThemeReason(pet, id, theme)));
  const previous = current.project ?? current.previousProject;
  const start = previous ? projectIds.indexOf(previous) + 1 : 0;
  const project = Array.from({ length: projectIds.length }, (_, i) => projectIds[(start + i) % projectIds.length]).find(id => eligible.includes(id));
  if (!project && current.week === week) return current;
  if (current.sequence >= Number.MAX_SAFE_INTEGER) return current;
  const sequence = current.sequence + Number(Boolean(project));
  return { week, sequence, accepted: false, ...(previous ? { previousProject: previous } : {}),
    ...(project ? { project, invitationId: `activity:${sequence}:${project}` } : {}) };
};
export const advanceCommunityActivities = (pet: PetState, now = Date.now()): PetState => {
  const board = getCommunityActivityBoard(pet, now);
  return board === pet.community.activityBoard ? pet : { ...pet, community: { ...pet.community, activityBoard: board } };
};
export const getCommunityActivityReminder = (pet: PetState, now = Date.now()) => {
  const projects = pet.community.expedition.projects;
  if (projectIds.some(id => projects[id].reward)) return { text: '邻居回礼待领取', ready: true };
  if (projectIds.some(id => projects[id].theme && projects[id].stage === 2)) return { text: '活动已备齐，随时举办', ready: true };
  if (projectIds.some(id => projects[id].theme)) return { text: '社区活动筹备中', ready: false };
  const board = getCommunityActivityBoard(pet, now);
  return board.project && !board.accepted ? { text: '本周活动邀请', ready: true } : undefined;
};
