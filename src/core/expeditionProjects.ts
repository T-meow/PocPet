import { recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { removeInventoryItem } from './items';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { updatePetSatiety } from './petStats';
import { projectIds } from './expeditionData';
import { withExpedition } from './expeditionReturn';
import type { ProjectId } from './expeditionTypes';
import type { Inventory, PetState } from './petTypes';

export const communityProjects: Record<ProjectId, { name: string; description: string; memory: string; firstCoins: number; repeatCoins: number; themes: [string, string]; supplies: [Inventory, Inventory]; meals: [Inventory, Inventory] }> = {
  riverside: { name: '河岸长桌聚餐', description: '用熟悉的家常味道，或旅途中发现的新滋味，招待修好社区的邻居。', memory: '晚风里的第一张长桌', firstCoins: 180, repeatCoins: 30, themes: ['田园家常', '远方风味'], supplies: [{ carrot: 3, egg: 2 }, { valley_mushroom: 2, hill_honey: 1 }], meals: [{ dish_herb_porridge: 2 }, { dish_mushroom_rice: 2 }] },
  exhibition: { name: '溪畔主题展览', description: '用已经记下的鱼类或地区见闻布展，收藏记录不会因为交出实物而消失。', memory: '大家停在同一页手账前', firstCoins: 220, repeatCoins: 35, themes: ['水边生活', '森林与海风'], supplies: [{ pond_crucian: 2, pond_carp: 2 }, { pine_resin: 2, sea_glass: 2 }], meals: [{ dish_carp_rice: 1 }, { dish_kelp_rice: 1 }] },
  observatory: { name: '星空之夜准备', description: '修好照明、准备便当，让社区的伙伴也能坐到观测穹顶下。', memory: '穹顶下，我们都有一颗星', firstCoins: 320, repeatCoins: 45, themes: ['暖粥守夜', '海风便当'], supplies: [{ observatory_part: 3, pine_resin: 1, sea_glass: 1 }, { observatory_part: 3, pine_resin: 1, sea_glass: 1 }], meals: [{ dish_herb_porridge: 2 }, { dish_kelp_rice: 2 }] },
};
export const getProjectReason = (pet: PetState, id: ProjectId, theme: 'garden' | 'journey', now = Date.now()) => {
  const state = pet.community.expedition, p = state.projects[id];
  if (p.theme) return '项目已经接受，按当前主题继续准备即可';
  if (p.completed && p.lastDay >= getEffectiveDailyDateKey(pet, now)) return '今天已经举办过，明天可选择新主题';
  if (id === 'riverside' && !(theme === 'garden' ? pet.community.firstOrderDelivered : state.regions.hills.surveyed)) return theme === 'garden' ? '先完成第一碗社区暖粥' : '先完成溪谷与山丘地区故事';
  if (id === 'exhibition') {
    if (theme === 'garden' && Object.keys(pet.community.fishing.journal).length < 2) return '鱼类手账记下任意两种鱼即可，不要求珍稀鱼';
    if (theme === 'journey' && (!state.regions.forest.surveyed || !state.regions.coast.surveyed)) return '先记录林地与海岸地区故事';
  }
  if (id === 'observatory' && (!state.regions.station.surveyed || state.regions.station.base < 1)) return '先完成观测站故事并修好值班室';
  return '';
};
export const startCommunityProject = (pet: PetState, id: ProjectId, theme: 'garden' | 'journey', now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  if (!projectIds.includes(id) || !['garden', 'journey'].includes(theme) || getProjectReason(pet, id, theme, now)) return pet;
  const s = pet.community.expedition;
  return { ...withExpedition(pet, { projects: { ...s.projects, [id]: { ...s.projects[id], theme, stage: 0 } } }), recentEvent: '社区项目已记下。准备没有期限，每一步交付都会永久保留。' };
};
export const getProjectDelivery = (pet: PetState, id: ProjectId): Inventory => {
  const p = pet.community.expedition.projects[id], data = communityProjects[id], index = p.theme === 'journey' ? 1 : 0;
  return p.stage === 0 ? data.supplies[index] : p.stage === 1 ? data.meals[index] : {};
};
export const contributeCommunityProject = (pet: PetState, id: ProjectId, completed: number, stage: number, actorId: string, actorName: string, now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  if (!projectIds.includes(id) || !canSpendCompanionTime(pet)) return pet;
  const s = pet.community.expedition, p = s.projects[id], data = communityProjects[id];
  if (!p.theme || p.completed !== completed || p.stage !== stage) return pet;
  const items = getProjectDelivery(pet, id);
  if (Object.entries(items).some(([item, n]) => (pet.inventory[item] ?? 0) < n)) return { ...pet, recentEvent: '还差一点物资，已投入的部分会一直保留。' };
  if (stage < 2) return { ...withExpedition(pet, { projects: { ...s.projects, [id]: { ...p, stage: stage + 1 } } }),
    inventory: Object.entries(items).reduce((stock, [item, n]) => removeInventoryItem(stock, item, n), pet.inventory), recentEvent: '这一阶段物资已交付。准备好下一步后随时回来。' };
  if (pet.hunger < 4 || pet.energy < 4) return { ...pet, recentEvent: '一起布置场地需要饱食 4、体力 4，请先休息。' };
  const coins = p.completed ? data.repeatCoins : data.firstCoins, hearts = p.completed ? 2 : 8;
  return recordEarnedHearts(recordEarnedCoins(updatePetSatiety({ ...withExpedition(pet, { projects: { ...s.projects, [id]: { ...p, stage: 0, theme: undefined, completed: completed + 1, lastDay: getEffectiveDailyDateKey(pet, now),
    ...(p.completed ? {} : { firstAt: now, actorId, actorName }) } } }), coins: pet.coins + coins, hearts: pet.hearts + hearts, hunger: pet.hunger - 4, energy: pet.energy - 4,
    recentEvent: `「${data.name}」圆满完成。${p.completed ? '又多了一次一起生活的回忆。' : '留下永久回忆，体力上限 +3。'}收到 ${coins} 金币、${hearts} 小心心。` }), coins), hearts);
};
