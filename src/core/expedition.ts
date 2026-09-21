import { applyHeartGain, incrementAchievementItemUse, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { applyItemHungerEffect, getItemStatEffect, getItemUsePlan, overfedMessage } from './itemEffects';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { clampPetEnergy, clampPetHealth, clampPetHunger, clampPetStat, getPetStatCap, updatePetSatiety } from './petStats';
import { inventoryItemLimit } from './saveMetadata';
import { expeditionBagCount, expeditionProducts, getRegionUnlocked, regionIds, regions } from './expeditionData';
import { finishExpedition, putExpeditionFinds, settleExpeditionTime, withExpedition } from './expeditionReturn';
import type { ExpeditionTrip, RegionId } from './expeditionTypes';
import type { Inventory, ItemId, PetState } from './petTypes';
import { wildIngredientIds, wildIngredients } from './foodCatalog';
import { regionalTreasures, regionalTreasureIds, type RegionalTreasureId } from './regionalTreasures';
import { spendToolUse, toolDurabilityLabel } from './toolDurability';
import { toolDefinitions, type DurableToolId } from './fieldEquipmentData';
import { advanceExplorationBudget, earnExplorationPay, getExplorationBudget, recordValleyObservation, spendExplorationHarvest, settleExplorationLoot } from './explorationBudget';
import { getDecorationEffects } from './decorationEffects';
import { getExpeditionCampStep, getValleyExpeditionChoices, isValleyExpedition } from './valleyExpedition';
import { valleyGatherTargets, type ValleyGatherTarget, type ValleyTravelStyle } from './valleyExplorationData';
import { getExplorationBagCapacity } from './explorationBackpack';
import { explorationTravel, getExpeditionEvent, getRegionActionCost } from './explorationTravelData';
import { lockRationPlan, quoteExpeditionRations, type RationSelection } from './explorationRations';
import { restExplorationWithKit } from './explorationSupport';
import { createExplorationCheckState, getExplorationMoodEffects, type ExplorationCheckAction, type ExplorationCheckDefinition } from './explorationChecks';
import { applyExplorationCheck, previewExplorationAction } from './explorationCheckActions';
export { getExpeditionCampStep } from './valleyExpedition';

const fail = (pet: PetState, recentEvent: string): PetState => ({ ...pet, recentEvent });
const validBag = (pet: PetState, bag: Inventory) => Object.values(bag).every(n => Number.isInteger(n) && n > 0) && expeditionBagCount(bag) <= getExplorationBagCapacity(pet);
const append = (t: ExpeditionTrip, line: string) => [...t.journal, line].slice(-12);
export const getExpeditionHarvestLeft = (pet: PetState, _id: RegionId, now = Date.now()) => getExplorationBudget(pet, now)?.available ?? 0;
const reserveHarvest = (pet: PetState, id: RegionId, count: number, now: number) => {
  pet = advanceExplorationBudget(pet, now);
  const r = pet.community.expedition.regions[id], day = getEffectiveDailyDateKey(pet, now);
  return spendExplorationHarvest(withExpedition(pet, { regions: { ...pet.community.expedition.regions, [id]: { ...r, harvestDay: day, harvestUsed: (r.harvestDay === day ? r.harvestUsed : 0) + count } } }), count, now);
};
export const isExpeditionSupply = (id: string) => {
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && !['golden_apple', 'birthday_cake'].includes(id) && item.usable !== false && ['hunger', 'energy', 'health', 'mood'].some(key => (item.effect[key as keyof typeof item.effect] ?? 0) > 0));
};
export const getExpeditionStartReason = (pet: PetState, route: RegionId[], mode: 'manual' | 'idle' = 'manual', parts = 1, now = Date.now(), style: ValleyTravelStyle = 'patrol', rations?: RationSelection): string => {
  if (pet.timePause) return '时间已冻结，恢复时间后再出发';
  const s = pet.community.expedition;
  if (mode !== 'manual' && mode !== 'idle') return '请选择亲自探索或挂机远行';
  if (s.active) return '先完成或结束当前远行';
  if (s.pending || pet.adventure.pending) return '先收好上一次旅途的物资';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '伙伴正在休息或忙碌，空闲后再启程';
  if (!route.length || route.length > 3 || new Set(route).size !== route.length || route.some(id => !regionIds.includes(id))) return '请选择一至三个不同地区';
  const locked = route.find(id => !getRegionUnlocked(pet, id));
  if (locked) return `${regions[locked].name}：${regions[locked].unlockHint}`;
  if (pet.health < getPetStatCap(pet) * .4) return '健康不足，请先护理再出发';
  if (mode === 'idle') {
    if (route.length !== 1 || ![2, 4, 8].includes(parts)) return '挂机可选择 2、4、8 小时';
    if (!s.regions[route[0]].surveyed || !s.regions[route[0]].base) return '亲自完成地区故事并建好休息基地后开放';
    if (getExpeditionHarvestLeft(pet, route[0], now) < parts) return `需要采集机会 ${parts} 次；每 3 小时恢复 1 次，最多积存 24 次`;
    const quote = quoteExpeditionRations(pet, route[0], parts, rations), profile = explorationTravel[route[0]];
    if (quote.reason) return quote.reason;
    if (pet.energy < profile.idleEnergy * parts / 2 || pet.hunger < profile.idleHunger * parts / 2) return `行路需饱食 ${profile.idleHunger * parts / 2}、体力 ${profile.idleEnergy * parts / 2}，请先补充`;
  } else {
    if (route.length > 1 && route.slice(0, -1).some(id => !s.regions[id].base)) return '先建好途中基地，才能串联长线远征';
    if (route[0] === 'valley' && style !== 'walk') {
      const cost = style === 'short' ? { hunger: 21, energy: 12 } : getRegionActionCost('valley', 0);
      const energy = Math.max(1, Math.round(cost.energy * 1.25 * getExplorationMoodEffects(pet.mood / getPetStatCap(pet)).energy));
      if (pet.hunger < cost.hunger || pet.energy < energy) return `先准备至少饱食 ${cost.hunger}、体力 ${energy}，足以完成第一步的稳定路线`;
    }
    if (style !== 'walk' && (pet.hunger < 12 || pet.energy < 10)) return '至少需要饱食 12、体力 10';
  }
  return '';
};
export const startExpedition = (pet: PetState, route: RegionId[], bag: Inventory, tool: boolean, actorId: string, actorName: string, mode: 'manual' | 'idle' = 'manual', parts = 1, now = Date.now(), options: { style?: ValleyTravelStyle; target?: ValleyGatherTarget; rations?: RationSelection } = {}): PetState => {
  pet = advancePet(pet, now);
  pet = advanceExplorationBudget(pet, now);
  const reason = getExpeditionStartReason(pet, route, mode, parts, now, options.style, options.rations);
  if (reason) return fail(pet, reason);
  if (!validBag(pet, bag) || Object.entries(bag).some(([id, count]) => !isExpeditionSupply(id) || (pet.inventory[id] ?? 0) < count)) return fail(pet, `行囊最多 ${getExplorationBagCapacity(pet)} 份，只能装入已有的适用补给`);
  if (tool && !(pet.inventory.trail_rope ?? 0)) return fail(pet, '仓库没有探路绳');
  if (mode === 'idle' && (tool || expeditionBagCount(bag))) return pet;
  const style = options.style ?? 'patrol', target = options.target ?? 'valley_mushroom';
  if (!['patrol', 'short', 'walk'].includes(style) || !valleyGatherTargets.includes(target) || mode === 'idle' && target === 'aquamarine') return pet;
  if (style !== 'patrol' && (route.length !== 1 || route[0] !== 'valley')) return pet;
  let inventory = Object.entries(bag).reduce((stock, [id, n]) => removeInventoryItem(stock, id, n), pet.inventory);
  if (tool) inventory = removeInventoryItem(inventory, 'trail_rope');
  const s = pet.community.expedition, startAt = Math.max(now, pet.lastUpdatedAt);
  const rationQuote = mode === 'idle' ? quoteExpeditionRations(pet, route[0], parts, options.rations) : undefined;
  const checked = mode === 'manual' && style !== 'walk' && route.includes('valley');
  const trip: ExpeditionTrip = { rulesVersion: checked ? 4 : 3, ...(checked ? { checkState: createExplorationCheckState(`${pet.createdAt}:expedition:${s.nextId}:${startAt}`) } : {}), id: `expedition:${s.nextId}`, revision: 0, mode, actorId, actorName, route: [...route], leg: 0, step: 0, bag: { ...bag }, ground: {}, tool, rested: [], paused: false,
    style, target, rewardsVersion: 1, gatherBonus: getDecorationEffects(pet).emerald_pendant, harvestSpent: 0, energySpent: 0, healthLost: 0, paidActions: 0, reservedHarvests: mode === 'idle' ? parts : 0,
    ...(rationQuote ? { rationPlan: lockRationPlan(rationQuote, parts, `${pet.createdAt}:${s.nextId}:${startAt}`) } : {}),
    startedAt: startAt, endsAt: startAt + (mode === 'idle' ? parts * 3600000 : 0), settledParts: 0, parts: mode === 'idle' ? parts : 1, coins: 0, hearts: 0, journal: [`和${actorName}一起出发，目的地是${route.map(id => regions[id].name).join(' → ')}。`] };
  if (mode === 'idle') {
    for (const [item, count] of Object.entries(rationQuote!.used)) inventory = removeInventoryItem(inventory, item, count);
    pet = spendExplorationHarvest(pet, parts, now, true);
  }
  return updatePetSatiety({ ...withExpedition(pet, { nextId: s.nextId + 1, active: trip }), inventory,
    coins: pet.coins - (rationQuote?.coins ?? 0),
    lastInteractionAt: now, recentEvent: mode === 'idle' ? '全程料理与采集机会已备好。每满一小时取得材料与酬谢，每两小时寻找当地珍宝；提前返回时先吃剩余料理，吃饱后分给路过的邻居。' : '行囊准备好了，沿途的成本与收获会在选择前显示。' });
};

export interface ExpeditionChoice { id: string; title: string; description: string; hunger: number; energy: number; health: number; mood: number; finds: Inventory; harvest?: number; equipment?: DurableToolId; research?: { kind: 'food' | 'treasure'; id: string; points: number }; check?: ExplorationCheckDefinition; mealItem?: string; observation?: 'a' | 'b' }
export const getExpeditionCheckAction = (pet: PetState, choice: ExpeditionChoice): ExplorationCheckAction => {
  const r = choice.research;
  const data = r ? r.kind === 'treasure' ? regionalTreasures[r.id as RegionalTreasureId] : wildIngredients[r.id as keyof typeof wildIngredients] : undefined;
  return { ...choice, check: choice.check!, research: r && data ? { id: r.id, points: r.points, progress: (r.kind === 'treasure' ? pet.community.treasureResearch[r.id as RegionalTreasureId] : pet.community.forageResearch[r.id as keyof typeof wildIngredients]) ?? 0, required: data.investigations, yield: 'yield' in data ? data.yield : 1 } : undefined };
};
export const getExpeditionChoicePreview = (pet: PetState, choice: ExpeditionChoice) => {
  const t = pet.community.expedition.active;
  return t && choice.check ? previewExplorationAction(pet, t, getExpeditionCheckAction(pet, choice), `${t.leg}:${t.step}`, t.route[t.leg]) : undefined;
};
const getExpeditionChoicesRaw = (pet: PetState, now: number): ExpeditionChoice[] => {
  const t = pet.community.expedition.active;
  if (!t || t.mode !== 'manual' || t.paused || t.step >= getExpeditionCampStep(t)) return [];
  if (isValleyExpedition(t)) return getValleyExpeditionChoices(pet, now);
  const id = t.route[t.leg], r = regions[id], available = getExpeditionHarvestLeft(pet, id, now) > 0;
  const event = getExpeditionEvent(t);
  if (event === 'travel') return [{ id: 'travel', title: '沿路标继续前进', description: '走向下一个地标，途中可以随时整理行囊、补餐或呼叫救援。', hunger: 0, energy: 0, health: 0, mood: 0, finds: {} }];
  if (event === 'gather') return [
    { id: 'gather', title: `采集${expeditionProducts[r.product].name}`, description: available ? '沿着路标，带两份产物回家。' : '今日采集已用完，仍可走访并完成故事。', hunger: 4, energy: 4, health: 0, mood: 2, finds: available ? { [r.product]: 2 } : {} },
    { id: 'observe', title: id === 'forest' ? '寻找林莓种子与松香' : id === 'coast' ? '收集潮汐海玻璃' : '慢慢观察沿途', description: available ? id === 'forest' ? '种子稳定取得，不依赖随机委托。' : '少带一点物资，多留一点心情。' : '今天只记录风景，不再取走产物。', hunger: 3, energy: 3, health: 0, mood: 6, finds: available ? { [r.alternative]: 1, ...(id === 'forest' ? { forest_berry_seed: 2 } : {}) } : {} },
    ...wildIngredientIds.filter(item => available && wildIngredients[item].region === id).flatMap((item): ExpeditionChoice[] => {
      const d = wildIngredients[item], progress = (pet.community.forageResearch[item] ?? 0) % d.investigations;
      const ordinary: ExpeditionChoice = { id: `forage:${item}`, title: `${d.investigations > 1 ? '调查' : '采集'}${d.name}`, hunger: 4, energy: 4, health: 0, mood: 2, research: { kind: 'food', id: item, points: 1 },
        description: d.investigations > 1 ? `调查 ${progress}/${d.investigations}；本次后 ${progress + 1 === d.investigations ? `得到${d.name} ×1，进度进入下一轮` : `进度 ${progress + 1}/${d.investigations}`}，另得${expeditionProducts[r.product].name} ×1。消耗本地区今日采集额度 1 次。` : `稳定获得 ${d.name} ×${d.yield}；消耗本地区今日采集额度 1 次。`,
        finds: d.investigations > 1 ? { [r.product]: 1, ...(progress + 1 === d.investigations ? { [item]: d.yield } : {}) } : { [item]: d.yield } };
      if (d.investigations === 1 || !(pet.inventory.survey_lens ?? 0)) return [ordinary];
      return [ordinary, { ...ordinary, id: `lens:${item}`, title: `放大镜调查${d.name}`, equipment: 'survey_lens', research: { kind: 'food', id: item, points: 2 },
        description: `调查进度 ${progress}/${d.investigations} → ${(progress + 2) % d.investigations}/${d.investigations}，${progress + 2 >= d.investigations ? '本次得到 1 份，余下进度保留；' : ''}另得地区主产物 ×1。放大镜耐久 −1（${toolDurabilityLabel(pet, 'survey_lens')}），消耗采集额度 1 次。`,
        finds: { [r.product]: 1, ...(progress + 2 >= d.investigations ? { [item]: d.yield } : {}) } }];
    }),
    ...regionalTreasureIds.filter(item => available && regionalTreasures[item].region === id).flatMap((item): ExpeditionChoice[] => {
      const d = regionalTreasures[item], progress = (pet.community.treasureResearch[item] ?? 0) % d.investigations;
      return [false, true].filter(pick => !pick || (pet.inventory.prospector_pick ?? 0) > 0).map(pick => {
        const points = pick ? 2 : 1, completes = progress + points >= d.investigations;
        return { id: `${pick ? 'pick' : 'prospect'}:${item}`, title: `${pick ? '手镐勘探' : '徒手勘探'}${d.name}`, hunger: 6, energy: pick ? 6 : 8, health: 0, mood: 2,
          equipment: pick ? 'prospector_pick' : undefined, research: { kind: 'treasure', id: item, points },
          description: `调查 ${progress}/${d.investigations} → ${(progress + points) % d.investigations}/${d.investigations}；${completes ? `本次得到${d.name} ×1。` : '进度永久保留。'}回收 ${d.base} 金币，也可制作永久装饰。另得地区主产物 ×1，占采集额度 1 次。${pick ? `手镐耐久 −1（${toolDurabilityLabel(pet, 'prospector_pick')}）。` : ''}`,
          finds: { [r.product]: 1, ...(completes ? { [item]: 1 } : {}) } };
      });
    }),
  ];
  if (event === 'crossing') return [
    { id: 'safe', title: t.tool || pet.community.expedition.regions[id].base >= 2 ? '沿熟悉的捷径通过' : '沿安全小径绕行', description: pet.community.expedition.regions[id].base >= 2 ? '修好的步道让以后每次经过都更轻松，不消耗工具。' : t.tool ? `探路绳耐久 −1（${toolDurabilityLabel(pet, 'trail_rope', true)}）；未用尽的绳索返程归还。` : '没有工具也能通过，健康不会受损。', hunger: 4, energy: t.tool || pet.community.expedition.regions[id].base >= 2 ? 3 : 7, health: 0, mood: 0, finds: {}, equipment: t.tool && pet.community.expedition.regions[id].base < 2 ? 'trail_rope' : undefined },
    { id: 'cross', title: '从近处小心穿过', description: '少花体力，但会擦伤。不会额外获得稀有奖励。', hunger: 3, energy: 2, health: -8, mood: -3, finds: {} },
  ];
  return [{ id: 'story', title: pet.community.expedition.regions[id].surveyed ? '重访熟悉的地标' : r.story, description: pet.community.expedition.regions[id].surveyed ? '记下这次同行，前往休息基地。' : '永久记录地区故事，开放基地建设、当地配方；体力上限 +2。', hunger: 4, energy: 3, health: 0, mood: 6, finds: {} }];
};
export const getExpeditionChoices = (pet: PetState, now = Date.now()): ExpeditionChoice[] => {
  if (pet.timePause) return [];
  const t = pet.community.expedition.active;
  return getExpeditionChoicesRaw(pet, now).map(choice => {
    if (choice.check) return choice;
    if (!t || t.rulesVersion === 1) return choice;
    const region = t.route[t.leg], firstStory = region !== 'valley' && getExpeditionEvent(t) === 'story' && !pet.community.expedition.regions[region].surveyed;
    let result = { ...choice, mood: firstStory ? choice.mood : Math.min(0, choice.mood) };
    if (t.rulesVersion >= 3) {
      if (!isValleyExpedition(t)) result = { ...result, ...getRegionActionCost(region, t.step) };
      const advanced = Boolean(choice.research && (choice.research.kind === 'treasure' || choice.research.points > 1));
      if (advanced) result = { ...result, hunger: Math.ceil(result.hunger * 1.2), energy: Math.ceil(result.energy * 1.2) };
      if (choice.id === 'safe' && (t.tool || pet.community.expedition.regions[region].base >= 2)) result.energy = Math.ceil(result.energy * .8);
      if (choice.id === 'cross') { result.hunger = Math.ceil(result.hunger * .75); result.energy = Math.ceil(result.energy * .75); }
    }
    return result;
  });
};
export const chooseExpeditionStep = (pet: PetState, id: string, revision: number, choiceId: string, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  if (pet.community.expedition.active?.id !== id || pet.community.expedition.active.revision !== revision) return pet;
  pet = advancePet(pet, now);
  const t = pet.community.expedition.active, choice = getExpeditionChoices(pet, now).find(c => c.id === choiceId);
  if (!t || t.id !== id || t.revision !== revision || !choice) return pet;
  const preview = getExpeditionChoicePreview(pet, choice);
  if (preview?.reason) return fail(pet, preview.reason);
  if (!preview && (pet.hunger < choice.hunger || pet.energy < choice.energy)) return fail(pet, '饱食或体力不足。可以用行囊补给，或保留发现安全返回。');
  const region = t.route[t.leg];
  const checked = choice.check ? applyExplorationCheck(pet, t, getExpeditionCheckAction(pet, choice), `${t.leg}:${t.step}`, region) : undefined;
  if (choice.check && !checked) return pet;
  const received: Inventory = {};
  const putFinds = (p: PetState, finds: Inventory) => {
    for (const [id, n] of Object.entries(finds)) received[id] = (received[id] ?? 0) + n;
    return putExpeditionFinds(p, finds);
  };
  let next = checked?.pet ?? pet;
  const use = !checked && choice.equipment ? spendToolUse(next, choice.equipment, choice.equipment === 'trail_rope') : undefined;
  if (choice.equipment && !checked && !use) return pet;
  next = use?.pet ?? next;
  const usedBefore = next.community.expedition.loop?.used ?? 0;
  if (choice.harvest) next = spendExplorationHarvest(next, choice.harvest, now);
  else if (!isValleyExpedition(t) && getExpeditionEvent(t) === 'gather' && Object.keys(choice.finds).length) next = reserveHarvest(next, region, 1, now);
  if (choice.research) {
    const { kind, id: target } = choice.research;
    const points = checked?.result.researchPoints ?? choice.research.points;
    if (kind === 'food') {
      const item = target as typeof wildIngredientIds[number];
      next = { ...next, community: { ...next.community, forageResearch: { ...next.community.forageResearch, [item]: (next.community.forageResearch[item] ?? 0) + points } } };
    } else {
      const item = target as RegionalTreasureId;
      next = { ...next, community: { ...next.community, treasureResearch: { ...next.community.treasureResearch, [item]: (next.community.treasureResearch[item] ?? 0) + points } } };
    }
  }
  if (getExpeditionEvent(t) === 'story' && !isValleyExpedition(t)) {
    if (region === 'forest' || region === 'coast') {
      const water = region === 'forest' ? 'forest_pool' : 'coast_pier';
      next = { ...next, community: { ...next.community, waterAccess: { ...next.community.waterAccess, [water]: { ...next.community.waterAccess[water], found: true } } } };
    }
  }
  const state = next.community.expedition, first = getExpeditionEvent(t) === 'story' && (region !== 'valley' || t.rulesVersion === 1) && !state.regions[region].surveyed;
  next = withExpedition(next, { regions: first ? { ...state.regions, [region]: { ...state.regions[region], surveyed: true, storyAt: now, actorId: t.actorId, actorName: t.actorName } } : state.regions,
    active: { ...t, paidActions: (t.paidActions ?? 0) + Number(choice.hunger > 0 || choice.energy > 0), harvestSpent: (t.harvestSpent ?? 0) + (choice.harvest ?? 0), energySpent: Math.max(0, (t.energySpent ?? 0) + (checked?.energySpent ?? choice.energy)), healthLost: Math.max(0, (t.healthLost ?? 0) + (checked?.healthLost ?? -Math.min(0, choice.health))), tool: t.tool && !(choice.equipment === 'trail_rope' && (checked?.toolBroken || use?.broken)), revision: revision + 1, step: t.step + 1, coins: t.coins + (first ? 20 : 0), hearts: t.hearts + (first ? 4 : 0), journal: append(t, checked ? checked.pet.recentEvent : `${regions[region].name} · ${choice.title}`), ...(checked ? { checkState: checked.state, bag: choice.mealItem ? removeInventoryItem(t.bag, choice.mealItem) : t.bag } : {}) } });
  next = putFinds(next, checked?.result.finds ?? choice.finds);
  if (t.rewardsVersion === 1) {
    const count = (next.community.expedition.loop?.used ?? 0) - usedBefore;
    const successful = choice.research?.kind !== 'treasure' && (!checked || ['steady', 'success', 'excellent'].includes(checked.result.outcome));
    const extra = settleExplorationLoot(next, count, 'manual', region, now, successful ? checked?.result.finds ?? choice.finds : {}, t.gatherBonus ?? 0);
    next = putFinds(extra.pet, extra.finds);
  }
  if (isValleyExpedition(t) && t.style !== 'short') {
    if (t.style !== 'walk') {
      const observed = recordValleyObservation(next, `${t.step}:${choice.observation ?? (choice.id.endsWith(':b') || choice.id === 'gather:2' ? 'b' : 'a')}`, now);
      next = putFinds(observed.pet, observed.finds);
    }
    if (t.step + 1 === 6 && t.style !== 'walk') {
      const earned = earnExplorationPay(next, 'manual', now, 'valley', t.rewardsVersion === 1); next = earned.pet;
      const current = next.community.expedition.active!;
      next = withExpedition(next, { active: { ...current, coins: current.coins + earned.coins, hearts: current.hearts + earned.hearts } });
      const loop = next.community.expedition.loop;
      if (loop && !loop.firstTreasure) {
        next = withExpedition(next, { loop: { ...loop, firstTreasure: true } });
        next = putFinds(next, { coin_hoard: 1 });
      }
      next = { ...next, adventure: { ...next.adventure, completed: { ...next.adventure.completed, valley: Math.max(1, next.adventure.completed.valley ?? 0) } } };
    }
  }
  if (t.rulesVersion >= 3 && region !== 'valley' && t.step + 1 === getExpeditionCampStep(t)) {
    const earned = earnExplorationPay(next, 'manual', now, region, t.rewardsVersion === 1); next = earned.pet;
    const current = next.community.expedition.active!;
    next = withExpedition(next, { active: { ...current, coins: current.coins + earned.coins, hearts: current.hearts + earned.hearts } });
  }
  if (checked) {
    const active = next.community.expedition.active!, coins = active.coins - t.coins, hearts = active.hearts - t.hearts;
    next = withExpedition(next, { active: { ...active, checkState: { ...checked.state, last: { ...checked.result, finds: received, ...(coins ? { coins } : {}), ...(hearts ? { hearts } : {}) } } } });
  }
  return settleExpeditionTime(updatePetSatiety({ ...next, ...(checked ? {} : { hunger: clampPetHunger(next, pet.hunger - choice.hunger), energy: clampPetEnergy(next, pet.energy - choice.energy), health: clampPetHealth(next, pet.health + choice.health), mood: clampPetStat(next, pet.mood + (t.rulesVersion >= 2 && !first ? Math.min(0, choice.mood) : choice.mood)) }), lastInteractionAt: now,
    recentEvent: checked?.pet.recentEvent ?? (first ? regions[region].storyText : `${choice.title}。${expeditionBagCount(next.community.expedition.active!.ground) ? '行囊已满，多出的物资留在返程整理中。' : '这一步已记下。'}`) + (use?.broken ? ` ${toolDefinitions[choice.equipment!].name}耐久已用尽。` : '') + (getExpeditionEvent(t) === 'story' && (region === 'forest' || region === 'coast') ? ' 已记下新水域，回钓鱼小屋提交材料修栈道后可永久直通。' : '') }), now);
};
export const useExpeditionSupply = (pet: PetState, id: string, revision: number, itemId: string, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  const t = pet.community.expedition.active, item = getInventoryItem(itemId as ItemId);
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.paused || !item || !isExpeditionSupply(itemId) || !(t.bag[itemId] ?? 0)) return pet;
  if (getItemUsePlan(pet, item, 1).blocked) return fail(pet, overfedMessage);
  const effect = getItemStatEffect(pet, item), recovery = { hunger: applyItemHungerEffect(pet, item, effect.hunger ?? 0), energy: clampPetEnergy(pet, pet.energy + (effect.energy ?? 0)), mood: clampPetStat(pet, pet.mood + (effect.mood ?? 0)), health: clampPetHealth(pet, pet.health + (effect.health ?? 0)), cleanliness: clampPetStat(pet, pet.cleanliness + (effect.cleanliness ?? 0)) };
  if (!Object.entries(recovery).some(([key, value]) => value > pet[key as keyof typeof recovery])) return fail(pet, '当前不需要这份补给。');
  return updatePetSatiety(incrementAchievementItemUse({ ...withExpedition(pet, { active: { ...t, energySpent: Math.max(0, (t.energySpent ?? 0) - (recovery.energy - pet.energy)), healthLost: Math.max(0, (t.healthLost ?? 0) - (recovery.health - pet.health)), revision: revision + 1, bag: removeInventoryItem(t.bag, itemId) } }), ...recovery, recentEvent: `使用${item.name} ×1，其余补给留在行囊。` }, itemId as ItemId));
};
export const getBaseUpgrade = (level: number, region: RegionId = 'valley') => level === 0 ? { coins: 120, wood: 3, stone: 2, name: '修好休息基地', benefit: '开放挂机；每趟最多恢复本趟损失的体力 6、健康 3，可扎营暂停' } : { coins: 180, wood: 2, stone: 3, name: '修通往返步道', benefit: region === 'valley' ? '完善基地；累计采集 80 次并制作溪光水景后，溪谷巡路每日固定金币升至 1800，另有通用探索实物' : '以后经过此地可走捷径，安全通路的体力消耗降低 20%' };
export const upgradeExpeditionBase = (pet: PetState, region: RegionId, expectedLevel: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  if (!regionIds.includes(region)) return pet;
  const s = pet.community.expedition, r = s.regions[region], t = s.active;
  const atCamp = t?.mode === 'manual' && t.step === getExpeditionCampStep(t) && t.route[t.leg] === region;
  if (r.base !== expectedLevel || r.base >= 2 || !r.surveyed || (!atCamp && !canSpendCompanionTime(pet))) return pet;
  const q = getBaseUpgrade(r.base, region);
  if (pet.coins < q.coins || (pet.inventory.community_wood ?? 0) < q.wood || (pet.inventory.community_stone ?? 0) < q.stone) return fail(pet, '建材或金币不足，可以先回社区准备；地区发现永久保留。');
  return { ...withExpedition(pet, { regions: { ...s.regions, [region]: { ...r, base: r.base + 1 } } }), coins: pet.coins - q.coins,
    inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', q.wood), 'community_stone', q.stone), recentEvent: `${regions[region].base}：${q.benefit}。` };
};
export const restExpedition = (pet: PetState, id: string, revision: number, now = Date.now(), useKit = false): PetState => {
  if (useKit) return restExplorationWithKit(pet, 'expedition', id, revision, now);
  if (pet.timePause) return pet;
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.paused || t.step !== getExpeditionCampStep(t)) return pet;
  const region = t.route[t.leg];
  if (!pet.community.expedition.regions[region].base || t.rested.includes(region)) return pet;
  const energy = clampPetEnergy(pet, pet.energy + Math.min(6, t.energySpent ?? 0)), health = clampPetHealth(pet, pet.health + Math.min(3, t.healthLost ?? 0)), mood = pet.mood;
  return { ...withExpedition(pet, { active: { ...t, energySpent: Math.max(0, (t.energySpent ?? 0) - (energy - pet.energy)), healthLost: Math.max(0, (t.healthLost ?? 0) - (health - pet.health)), rested: [...t.rested, region], revision: revision + 1 } }), energy, health, mood, recentEvent: '在营地休整了一会儿。这趟在此地的休整机会已用过。' };
};
export const pauseExpedition = (pet: PetState, id: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.step !== getExpeditionCampStep(t) || t.paused || !pet.community.expedition.regions[t.route[t.leg]].base) return pet;
  return { ...withExpedition(pet, { active: { ...t, paused: true, revision: revision + 1 } }), recentEvent: '行程已在基地存下。可以回社区照顾伙伴，下次继续；行囊与本趟休整次数保留。' };
};
export const continueExpedition = (pet: PetState, id: string, revision: number, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.step !== getExpeditionCampStep(t) || t.leg >= t.route.length - 1) return pet;
  if (t.paused && (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning || pet.health < getPetStatCap(pet) * .4)) return fail(pet, '继续前请结束其他活动，并照顾好伙伴的健康。');
  return { ...withExpedition(pet, { active: { ...t, ...(t.checkState ? { checkState: { seed: t.checkState.seed, focus: 0, ...(t.checkState.last ? { last: t.checkState.last } : {}) } } : {}), harvestSpent: 0, energySpent: 0, healthLost: 0, paidActions: 0, paused: false, step: 0, leg: t.leg + 1, revision: revision + 1 } }), lastInteractionAt: now, recentEvent: `向${regions[t.route[t.leg + 1]].name}继续出发。` };
};
export const returnExpedition = (pet: PetState, id: string, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id) return pet;
  return finishExpedition(pet, t.mode === 'manual' && t.step === getExpeditionCampStep(t) && t.leg === t.route.length - 1 ? 'complete' : 'return', now);
};
export const selectExpeditionReturn = (pet: PetState, id: string, selection: Inventory): PetState => {
  if (pet.timePause) return pet;
  const p = pet.community.expedition.pending;
  if (!p || p.id !== id || p.selected || !validBag(pet, selection)) return pet;
  if (Object.entries(selection).some(([item, count]) => count > (p.items[item] ?? 0) + (p.overflow[item] ?? 0))) return pet;
  return withExpedition(pet, { pending: { ...p, items: { ...selection }, overflow: {}, selected: true } });
};
export const claimExpedition = (pet: PetState, id: string): PetState => {
  if (pet.timePause) return pet;
  const p = pet.community.expedition.pending;
  if (!p || p.id !== id || !p.selected) return pet;
  const items = { ...p.items, ...(p.tool ? { trail_rope: (p.items.trail_rope ?? 0) + 1 } : {}) };
  if ((p.rulesVersion ?? 1) >= 2 && p.mode === 'idle') {
    let inventory = pet.inventory;
    const remaining: Inventory = {};
    for (const [item, count] of Object.entries(items)) {
      const take = Math.min(count, Math.max(0, inventoryItemLimit - (inventory[item] ?? 0)));
      if (take) inventory = addInventoryItem(inventory, item, take);
      if (take < count) remaining[item] = count - take;
    }
    const gain = applyHeartGain(pet, p.hearts), keep = Object.keys(remaining).length > 0;
    return recordEarnedHearts(recordEarnedCoins({ ...withExpedition(pet, { pending: keep ? { ...p, items: remaining, tool: false, coins: 0, hearts: 0, refundCoins: 0 } : undefined,
      ...(keep ? {} : { lastReceipt: { id: p.id, reason: p.reason, at: p.at, route: p.route, journal: p.journal, ...(p.rationReturn ? { rationReturn: p.rationReturn } : {}), ...(p.lastCheck ? { lastCheck: p.lastCheck } : {}) } }) }), inventory, coins: pet.coins + p.coins + (p.refundCoins ?? 0), hearts: gain.hearts, boostCards: gain.boostCards,
      recentEvent: keep ? '可放入的物资与酬谢已领取，其余物资继续保留；整理仓库后再领。' : '挂机物资与酬谢已全部入库。' }, p.coins), gain.amount);
  }
  if (Object.entries(items).some(([item, n]) => (pet.inventory[item] ?? 0) + n > inventoryItemLimit)) return fail(pet, '仓库暂时放不下全部物资，回执完整保留。可先去厨房、摆摊或回收整理。');
  const gain = applyHeartGain(pet, p.hearts);
  return recordEarnedHearts(recordEarnedCoins({ ...withExpedition(pet, { pending: undefined, lastReceipt: { id: p.id, reason: p.reason, at: p.at, route: p.route, journal: p.journal, ...(p.lastCheck ? { lastCheck: p.lastCheck } : {}) } }),
    inventory: Object.entries(items).reduce((stock, [item, n]) => addInventoryItem(stock, item, n), pet.inventory), coins: pet.coins + p.coins, hearts: gain.hearts, boostCards: gain.boostCards, recentEvent: '远行物资已放入共用仓库，可以用于料理、农场订单、营地建设和装饰制作。' }, p.coins), gain.amount);
};
