import { isClassicEndgameComplete } from './classicEndgame';
import { completedChapter, mapRegionForExpedition } from './landmarkProgress';
import { removeInventoryItem } from './items';
import { getMuseumStageCost, museumHalls, museumQuestIds, museumQuests, type MuseumQuestId, type MuseumRegion } from './museumData';
import { getMuseumAppearance } from './museumState';
import type { MuseumAppearance } from './museumTypes';
import type { PetState } from './petTypes';
import { advancePet } from './petLifecycle';

export const getMuseumHallReason = (pet: PetState, region: MuseumRegion) => !isClassicEndgameComplete(pet) ? '完成四条共同梦想，获得钻石奖杯后开放。' : !completedChapter(pet.adventure, mapRegionForExpedition[region]) ? '先完成该地区的全部 8 个地标。' : '';
export const investMuseumHall = (pet: PetState, region: MuseumRegion, expectedStage: number, amount: number, expectedInvested: number): PetState => {
  const hall = pet.museum.halls[region];
  if (!hall || hall.stage !== expectedStage || hall.invested !== expectedInvested || hall.stage >= 3 || pet.timePause || getMuseumHallReason(pet, region) || !Number.isSafeInteger(amount) || amount <= 0 || amount > pet.coins || hall.invested + amount > getMuseumStageCost(region, hall.stage).coins) return pet;
  return { ...pet, coins: pet.coins - amount, museum: { ...pet.museum, halls: { ...pet.museum.halls, [region]: { ...hall, invested: hall.invested + amount } } }, recentEvent: `${museumHalls[region].name}已筹入 ${amount} 金币，阶段完成前可以撤回。` };
};
export const withdrawMuseumHall = (pet: PetState, region: MuseumRegion, expectedStage: number): PetState => {
  const hall = pet.museum.halls[region];
  if (!hall || pet.timePause || hall.stage !== expectedStage || !hall.invested || pet.coins + hall.invested > Number.MAX_SAFE_INTEGER) return pet;
  return { ...pet, coins: pet.coins + hall.invested, museum: { ...pet.museum, halls: { ...pet.museum.halls, [region]: { ...hall, invested: 0 } } }, recentEvent: '当前阶段的筹款已退回钱包，委托记录继续保留。' };
};
export const getMuseumCompleteReason = (pet: PetState, region: MuseumRegion) => {
  const hall = pet.museum.halls[region], cost = getMuseumStageCost(region, hall.stage);
  return pet.timePause ? '恢复时间后再建设。' : getMuseumHallReason(pet, region) || (hall.stage >= 3 ? '展厅已正式开放。' : hall.invested < cost.coins ? '先筹齐本阶段金币。'
    : (pet.inventory.golden_apple ?? 0) < cost.apples ? '金苹果不足。' : Object.entries(cost.items).some(([id, n]) => (pet.inventory[id] ?? 0) < n) ? '本阶段材料尚未备齐。'
      : hall.stage === 2 && !museumQuestIds.some(id => museumQuests[id].region === region && pet.museum.quests[id]?.completedAt) ? '先完成当地任意一项纪念馆委托。' : '');
};
export const completeMuseumHallStage = (pet: PetState, region: MuseumRegion, expectedStage: number, now = Date.now()): PetState => {
  const hall = pet.museum.halls[region];
  if (!hall || hall.stage !== expectedStage || getMuseumCompleteReason(pet, region)) return pet;
  const cost = getMuseumStageCost(region, hall.stage);
  let inventory = cost.apples ? removeInventoryItem(pet.inventory, 'golden_apple', cost.apples) : pet.inventory;
  for (const [id, amount] of Object.entries(cost.items)) inventory = removeInventoryItem(inventory, id, amount);
  return { ...pet, inventory, museum: { ...pet.museum,
    coinsSpent: Math.min(Number.MAX_SAFE_INTEGER, pet.museum.coinsSpent + cost.coins), applesSpent: Math.min(Number.MAX_SAFE_INTEGER, pet.museum.applesSpent + cost.apples),
    halls: { ...pet.museum.halls, [region]: { stage: hall.stage + 1, invested: 0, ...(hall.stage === 2 ? { openedAt: now } : {}) } } },
    recentEvent: `${museumHalls[region].name}${hall.stage === 2 ? '正式开馆，开馆纪念已收藏。' : '完成新阶段，新展品已放进展柜。'}` };
};
export const acceptMuseumQuest = (pet: PetState, id: MuseumQuestId, now = Date.now()): PetState => {
  const def = museumQuests[id];
  if (!def || pet.timePause || !isClassicEndgameComplete(pet) || pet.museum.quests[id] || pet.museum.halls[def.region].stage < 1) return pet;
  pet = advancePet(pet, now);
  return { ...pet, museum: { ...pet.museum, quests: { ...pet.museum.quests, [id]: { acceptedAt: now, progress: {} } } }, recentEvent: `接下了「${def.title}」。从现在起记录行动，有空慢慢完成。` };
};
export const changeMuseumAppearance = (pet: PetState, appearance: MuseumAppearance): PetState => {
  if (pet.timePause || !isClassicEndgameComplete(pet)) return pet;
  const museum = { ...pet.museum, appearance };
  return { ...pet, museum: { ...museum, appearance: getMuseumAppearance({ ...pet, museum }) } };
};
