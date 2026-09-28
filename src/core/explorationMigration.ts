import type { Inventory, PetState } from './petTypes';
import { getAdventureSteps } from './adventureData';
import { finishAdventure } from './adventureReturn';
import { advanceExplorationBudget } from './explorationBudget';
import { completeLandmarkStory } from './landmarkAdventure';
import { isLandmarkId } from './landmarkProgress';
import { getLandmarkSteps } from './landmarkData';
import { completeValleyQuest, isValleyQuest, valleyQuests } from './valleyQuests';
import { settleExpeditionTime } from './expeditionReturn';
import { getEffectiveDailyDateKey } from './gameClock';

// Removing active and creating its receipt is the migration watermark. Loading the
// receipt again never reruns story rewards, reserved harvests, or treasure rolls.
export const completeLegacyExploration = (pet: PetState, now: number): PetState => {
  if (pet.timePause) return pet;
  const old = pet.adventure.active;
  if (old && old.rulesVersion < 11 && !pet.adventure.pending) {
    pet = advanceExplorationBudget(pet, now);
    const steps = getAdventureSteps(old.rulesVersion, old.region, old.purpose);
    const remaining = old.choices.length < steps.length, items: Inventory = { ...old.bag };
    const add = (finds: Inventory) => { for (const [id, count] of Object.entries(finds)) items[id] = (items[id] ?? 0) + count; };
    add(old.loot);
    let first = old.firstCompletion ?? false;
    if (remaining && isLandmarkId(old.purpose)) {
      const result = completeLandmarkStory(pet, old, now); pet = result.pet; first = result.first; add(result.items);
    } else if (remaining && isValleyQuest(old.purpose)) {
      pet = completeValleyQuest(pet, old.purpose); add(valleyQuests[old.purpose].items);
    } else if (remaining && old.region === 'tutorial') add({ map_handbook: 1, coin_hoard: 1 });
    const loop = pet.community.expedition.loop;
    if (old.region === 'valley' && (!old.purpose || old.purpose === 'landmark:valley:entrance') && loop && !loop.firstTreasure) {
      add({ coin_hoard: 1 }); pet = { ...pet, community: { ...pet.community, expedition: { ...pet.community.expedition, loop: { ...loop, firstTreasure: true } } } };
    }
    pet = finishAdventure({ ...pet, adventure: { ...pet.adventure, active: { ...old, bag: items, loot: {}, firstCompletion: first,
      choices: [...old.choices, ...steps.slice(old.choices.length).map(step => step.choices[0].id)],
      ...(isLandmarkId(old.purpose) ? { stageIds: getLandmarkSteps(old.purpose).map(step => step.id) } : {}),
      completedDay: getEffectiveDailyDateKey(pet, now) } } }, now);
    pet = { ...pet, recentEvent: '玩法更新：原手动探险已按成功完成结算，物资和完成奖励保留在返程结算中。' };
  }
  const idle = pet.community.expedition.active;
  if (idle && idle.rulesVersion < 6 && !pet.community.expedition.pending) {
    pet = settleExpeditionTime(pet, now, true);
    pet = { ...pet, recentEvent: '玩法更新：原挂机行程已按完整时长成功结算，已预留次数用于采集，全部收获等待领取。' };
  }
  return pet;
};
