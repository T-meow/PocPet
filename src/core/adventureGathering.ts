import type { AdventureChoice } from './adventureData';
import type { PetState } from './petTypes';
import { getExplorationRoll } from './explorationChecks';
import { getToolUsesLeft } from './toolDurability';
import { hashString } from './utils';

export interface AdventureStageChoice extends AdventureChoice {
  sourceChoiceId?: string;
  randomGather?: boolean;
}

// Keep the authored choices as reward tables and saved history IDs. Only the
// presentation and incoming command use the compact gathering methods.
export const getAdventureStageChoices = (pet: PetState, choices: readonly AdventureChoice[]): AdventureStageChoice[] => {
  const trip = pet.adventure.active;
  if (trip?.rulesVersion !== 10 || !choices.some(choice => choice.harvest)) return [...choices];
  const result: AdventureStageChoice[] = [];
  const add = (method: string, label: string, detail: string, pool: AdventureChoice[]) => {
    if (!pool.length) return;
    const roll = getExplorationRoll(trip.checkState?.seed ?? hashString(trip.id), `${trip.purpose}:${trip.choices.length}`, `gather:${method}`);
    const source = pool[Math.floor(roll * pool.length)];
    result.push({ ...source, id: `gather:${method}`, sourceChoiceId: source.id, label, detail, randomGather: true });
  };
  add('random', '采集', '随机取得当地物产，也可能推进食材调查。', choices.filter(choice => Boolean(choice.harvest) && !choice.check?.tool && choice.research?.kind !== 'treasure'));
  const leave = choices.find(choice => choice.id.startsWith('safe:') && !choice.harvest);
  if (leave) result.push({ ...leave, id: 'gather:leave', sourceChoiceId: leave.id, label: '离开采集点', detail: '跳过本次采集，继续旅程；不消耗采集机会。' });
  if (getToolUsesLeft(pet, 'harvest_sickle') > 0) add('sickle', '用镰刀采集', '随机采收当地适用物产，镰刀耐久 −1。', choices.filter(choice => choice.check?.tool === 'harvest_sickle'));
  if (getToolUsesLeft(pet, 'prospector_pick') > 0) add('pick', '用手镐采集', '勘探当地珍宝，保留累计调查进度；手镐耐久 −1。', choices.filter(choice => choice.check?.tool === 'prospector_pick'));
  return result;
};
