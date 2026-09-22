import type { AdventureChoice } from './adventureData';
import type { AdventureTrip } from './adventureTypes';
import type { Inventory, PetState } from './petTypes';
import { getExplorationBagCapacity } from './explorationBackpack';
import { getEffectiveDailyDateKey } from './gameClock';
import { applyExplorationCheck } from './explorationCheckActions';
import type { ExplorationCheckAction } from './explorationChecks';
import { getExplorationBudget, recordValleyObservation, settleExplorationLoot, spendExplorationHarvest } from './explorationBudget';
import { completedChapter, completedLandmark, expeditionRegionForMap, isLandmarkId, parseLandmarkId } from './landmarkProgress';
import { getLandmarkSteps, landmarkFirstReward } from './landmarkData';
import { completeValleyQuest, isValleyQuest } from './valleyQuests';
import { discoverCommunityFinds } from './community';
import { recordLandmarkTaskEvent } from './communityCommissions';
import { wildIngredients } from './foodCatalog';
import { regionalTreasures } from './regionalTreasures';

export const landmarkCheckAction = (pet: PetState, choice: AdventureChoice, now: number): ExplorationCheckAction => {
  const available = !choice.harvest || (getExplorationBudget(pet, now)?.available ?? 0) >= choice.harvest;
  const research = available ? choice.research : undefined;
  const data = research ? research.kind === 'treasure' ? regionalTreasures[research.id as keyof typeof regionalTreasures] : wildIngredients[research.id as keyof typeof wildIngredients] : undefined;
  const location = isLandmarkId(pet.adventure.active?.purpose) ? parseLandmarkId(pet.adventure.active.purpose) : undefined;
  const base = location ? pet.community.expedition.regions[expeditionRegionForMap[location.region]].base : 0;
  const energy = base >= 2 && choice.id === 'safe:obstacle' ? Math.ceil(choice.energy * .8) : choice.energy;
  return { ...choice, energy, title: choice.label, check: choice.check!, finds: available ? choice.finds : {}, research: research && data ? { id: research.id, points: research.points, required: data.investigations, yield: 'yield' in data ? data.yield : 1, progress: (research.kind === 'treasure' ? pet.community.treasureResearch[research.id as keyof typeof regionalTreasures] : pet.community.forageResearch[research.id as keyof typeof wildIngredients]) ?? 0 } : undefined };
};
export const advanceLandmarkAdventure = (pet: PetState, trip: AdventureTrip, choice: AdventureChoice, index: number, now: number): PetState => {
  if (!isLandmarkId(trip.purpose)) return pet;
  const purpose = trip.purpose, { region, node } = parseLandmarkId(purpose), r = expeditionRegionForMap[region];
  const steps = getLandmarkSteps(purpose), step = steps[index], complete = index + 1 === steps.length;
  if (!step || trip.stageIds?.includes(step.id)) return pet;
  const harvest = choice.harvest ?? 0;
  if (harvest && (getExplorationBudget(pet, now)?.available ?? 0) < harvest) return { ...pet, recentEvent: '采集机会不足，可以继续观察并完成故事，或等待机会恢复。' };
  const checked = applyExplorationCheck(pet, trip, landmarkCheckAction(pet, choice, now), step.id, r);
  if (!checked) return pet;
  let next = checked.pet;
  const finds: Inventory = { ...checked.result.finds };
  const add = (items: Inventory) => { for (const [item, quantity] of Object.entries(items)) finds[item] = (finds[item] ?? 0) + quantity; };
  if (harvest) {
    next = spendExplorationHarvest(next, harvest, now);
    if (choice.research) {
      if (choice.research.kind === 'treasure') { const id = choice.research.id as keyof typeof regionalTreasures; next = { ...next, community: { ...next.community, treasureResearch: { ...next.community.treasureResearch, [id]: (next.community.treasureResearch[id] ?? 0) + checked.result.researchPoints } } }; }
      else { const id = choice.research.id as keyof typeof wildIngredients; next = { ...next, community: { ...next.community, forageResearch: { ...next.community.forageResearch, [id]: (next.community.forageResearch[id] ?? 0) + checked.result.researchPoints } } }; }
    }
    const extra = settleExplorationLoot(next, harvest, 'manual', r, now, choice.research?.kind !== 'treasure' && ['steady', 'success', 'excellent'].includes(checked.result.outcome) ? checked.result.finds : {}, trip.gatherBonus ?? 0);
    next = extra.pet; add(extra.finds);
  }
  if (region === 'valley' && node === 'crossing' && step.id.endsWith(':record')) {
    const discovery = discoverCommunityFinds(next, now, 'commission'); next = discovery.pet; add(discovery.items);
  }
  next = recordLandmarkTaskEvent(next, r, node, step.event === 'finish' ? 'survey' : step.id.endsWith(':record') ? 'search' : 'visit', now);
  const first = complete && !completedLandmark(next.adventure, region, node);
  if (first) {
    add(landmarkFirstReward(purpose).items);
    next = { ...next, adventure: { ...next.adventure, landmarks: [...next.adventure.landmarks, purpose] } };
    const valleyQuest = `valley_${node}`;
    if (region === 'valley' && isValleyQuest(valleyQuest)) next = completeValleyQuest(next, valleyQuest);
    if (completedChapter(next.adventure, region)) {
      const expedition = next.community.expedition;
      next = { ...next, community: { ...next.community, expedition: { ...expedition, regions: { ...expedition.regions, [r]: { ...expedition.regions[r], surveyed: true, storyAt: now, actorId: trip.actorId, actorName: trip.actorName } } },
        ...(region === 'forest' || region === 'coast' ? { waterAccess: { ...next.community.waterAccess, [region === 'forest' ? 'forest_pool' : 'coast_pier']: { ...next.community.waterAccess[region === 'forest' ? 'forest_pool' : 'coast_pier'], found: true } } } : {}) } };
    }
  }
  if (region === 'valley' && node === 'entrance') {
    const observed = recordValleyObservation(next, `${index}:${choice.observation ?? (choice.id.startsWith('tool:') ? 'b' : 'a')}`, now); next = observed.pet; add(observed.finds);
    const loop = next.community.expedition.loop;
    if (complete && loop && !loop.firstTreasure) { add({ coin_hoard: 1 }); next = { ...next, community: { ...next.community, expedition: { ...next.community.expedition, loop: { ...loop, firstTreasure: true } } } }; }
  }
  const bag = { ...trip.bag }, loot = { ...trip.loot }, collection = { ...next.community.expedition.collection };
  let space = getExplorationBagCapacity(next) - Object.values(bag).reduce((sum, amount) => sum + amount, 0);
  for (const [id, amount] of Object.entries(finds)) {
    const take = Math.max(0, Math.min(space, amount)); space -= take;
    if (take) bag[id] = (bag[id] ?? 0) + take;
    if (take < amount) loot[id] = (loot[id] ?? 0) + amount - take;
    if (id in regionalTreasures || id in wildIngredients || ['coin_hoard', 'valley_amber', 'ancient_gold_bar', 'valley_mushroom', 'hill_honey', 'forest_berry', 'forest_berry_seed', 'pine_resin', 'coast_kelp', 'sea_glass', 'observatory_part'].includes(id)) collection[id as keyof typeof collection] = (collection[id as keyof typeof collection] ?? 0) + amount;
  }
  return { ...next, lastInteractionAt: now, community: { ...next.community, expedition: { ...next.community.expedition, collection } },
    adventure: { ...next.adventure, active: { ...trip, nodeId: node, revision: trip.revision + 1, choices: [...trip.choices, choice.id], stageIds: [...trip.stageIds ?? [], step.id], bag, loot,
      tool: trip.tool && !(checked.toolBroken && choice.check?.tool === 'trail_rope'), energySpent: Math.max(0, (trip.energySpent ?? 0) + checked.energySpent), healthLost: Math.max(0, (trip.healthLost ?? 0) + checked.healthLost), paidActions: (trip.paidActions ?? 0) + 1,
      checkState: { ...checked.state, last: { ...checked.result, finds } }, ...(complete ? { firstCompletion: first, completedDay: getEffectiveDailyDateKey(next, now) } : {}) } } };
};
