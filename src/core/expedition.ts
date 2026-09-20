import { incrementAchievementItemUse, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getEffectiveDailyDateKey } from './gameClock';
import { addInventoryItem, getInventoryItem, removeInventoryItem } from './items';
import { applyItemHungerEffect, getItemStatEffect, getItemUsePlan, overfedMessage } from './itemEffects';
import { canSpendCompanionTime } from './kitchen';
import { advancePet } from './petLifecycle';
import { clampPetEnergy, clampPetHealth, clampPetHunger, clampPetStat, getPetStatCap, updatePetSatiety } from './petStats';
import { inventoryItemLimit } from './saveMetadata';
import { expeditionBagCount, expeditionCapacity, expeditionHarvestLimit, expeditionProducts, getRegionUnlocked, regionIds, regions } from './expeditionData';
import { finishExpedition, putExpeditionFinds, settleExpeditionTime, withExpedition } from './expeditionReturn';
import type { ExpeditionTrip, RegionId } from './expeditionTypes';
import type { Inventory, ItemId, PetState } from './petTypes';

const fail = (pet: PetState, recentEvent: string): PetState => ({ ...pet, recentEvent });
const validBag = (bag: Inventory) => Object.values(bag).every(n => Number.isInteger(n) && n > 0) && expeditionBagCount(bag) <= expeditionCapacity;
const append = (t: ExpeditionTrip, line: string) => [...t.journal, line].slice(-12);
export const getExpeditionHarvestLeft = (pet: PetState, id: RegionId, now = Date.now()) => {
  const r = pet.community.expedition.regions[id];
  return expeditionHarvestLimit - (r.harvestDay === getEffectiveDailyDateKey(pet, now) ? r.harvestUsed : 0);
};
const reserveHarvest = (pet: PetState, id: RegionId, count: number, now: number) => {
  const r = pet.community.expedition.regions[id], day = getEffectiveDailyDateKey(pet, now);
  return withExpedition(pet, { regions: { ...pet.community.expedition.regions, [id]: { ...r, harvestDay: day, harvestUsed: (r.harvestDay === day ? r.harvestUsed : 0) + count } } });
};
export const isExpeditionSupply = (id: string) => {
  const item = getInventoryItem(id as ItemId);
  return Boolean(item && !['golden_apple', 'birthday_cake'].includes(id) && item.usable !== false && ['hunger', 'energy', 'health', 'mood'].some(key => (item.effect[key as keyof typeof item.effect] ?? 0) > 0));
};
export const getExpeditionStartReason = (pet: PetState, route: RegionId[], mode: 'manual' | 'idle' = 'manual', parts = 1, now = Date.now()): string => {
  const s = pet.community.expedition;
  if (mode !== 'manual' && mode !== 'idle') return '请选择亲自探索或挂机远行';
  if (s.active) return '先完成或结束当前远行';
  if (s.pending || pet.adventure.pending) return '先收好上一次旅途的物资';
  if (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning) return '伙伴正在休息或忙碌，空闲后再启程';
  if (!route.length || route.length > 3 || new Set(route).size !== route.length || route.some(id => !regionIds.includes(id))) return '请选择一至三个不同地区';
  const locked = route.find(id => !getRegionUnlocked(pet, id));
  if (locked) return `${regions[locked].name}：${regions[locked].unlockHint}`;
  if (pet.health < getPetStatCap(pet) * .4) return '健康至少达到 40% 才能出发';
  if (mode === 'idle') {
    if (route.length !== 1 || ![1, 3].includes(parts)) return '挂机远行只选择一处地区、1 或 3 小时';
    if (!s.regions[route[0]].surveyed || !s.regions[route[0]].base) return '亲自完成地区故事并建好休息基地后开放';
    if (getExpeditionHarvestLeft(pet, route[0], now) < parts) return '今天该地区的采集额度不足';
    if ((pet.inventory.trail_mix ?? 0) < (parts === 1 ? 1 : 2)) return `需要便携坚果包 ×${parts === 1 ? 1 : 2}`;
    if (pet.energy < (parts === 1 ? 8 : 16) || pet.hunger < (parts === 1 ? 8 : 14)) return '饱食或体力不足，请先补充';
  } else {
    if (route.length > 1 && route.slice(0, -1).some(id => !s.regions[id].base)) return '先建好途中基地，才能串联长线远征';
    if (pet.hunger < 12 || pet.energy < 10) return '至少需要饱食 12、体力 10';
  }
  return '';
};
export const startExpedition = (pet: PetState, route: RegionId[], bag: Inventory, tool: boolean, actorId: string, actorName: string, mode: 'manual' | 'idle' = 'manual', parts = 1, now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  const reason = getExpeditionStartReason(pet, route, mode, parts, now);
  if (reason) return fail(pet, reason);
  if (!validBag(bag) || Object.entries(bag).some(([id, count]) => !isExpeditionSupply(id) || (pet.inventory[id] ?? 0) < count)) return fail(pet, '行囊最多 12 份，只能装入已有的适用补给');
  if (tool && !(pet.inventory.trail_rope ?? 0)) return fail(pet, '仓库没有探路绳');
  if (mode === 'idle' && (tool || expeditionBagCount(bag))) return pet;
  let inventory = Object.entries(bag).reduce((stock, [id, n]) => removeInventoryItem(stock, id, n), pet.inventory);
  if (tool) inventory = removeInventoryItem(inventory, 'trail_rope');
  const s = pet.community.expedition, startAt = Math.max(now, pet.lastUpdatedAt);
  const trip: ExpeditionTrip = { rulesVersion: 1, id: `expedition:${s.nextId}`, revision: 0, mode, actorId, actorName, route: [...route], leg: 0, step: 0, bag: { ...bag }, ground: {}, tool, rested: [], paused: false,
    startedAt: startAt, endsAt: startAt + (mode === 'idle' ? parts * 3600000 : 0), settledParts: 0, parts: mode === 'idle' ? parts : 1, coins: 0, hearts: 0, journal: [`和${actorName}一起出发，目的地是${route.map(id => regions[id].name).join(' → ')}。`] };
  if (mode === 'idle') {
    inventory = removeInventoryItem(inventory, 'trail_mix', parts === 1 ? 1 : 2);
    pet = reserveHarvest(pet, route[0], parts, now);
  }
  return updatePetSatiety({ ...withExpedition(pet, { nextId: s.nextId + 1, active: trip }), inventory,
    hunger: pet.hunger - (mode === 'idle' ? parts === 1 ? 8 : 14 : 0), energy: pet.energy - (mode === 'idle' ? parts === 1 ? 8 : 16 : 0),
    lastInteractionAt: now, recentEvent: mode === 'idle' ? '按已勘测路线出发了。口粮、体力与今日额度已投入，每满一小时带回一份产物；提前召回不返还投入。' : '行囊准备好了，沿途的成本与收获会在选择前显示。' });
};

export interface ExpeditionChoice { id: string; title: string; description: string; hunger: number; energy: number; health: number; mood: number; finds: Inventory }
export const getExpeditionChoices = (pet: PetState, now = Date.now()): ExpeditionChoice[] => {
  const t = pet.community.expedition.active;
  if (!t || t.mode !== 'manual' || t.paused || t.step >= 3) return [];
  const id = t.route[t.leg], r = regions[id], available = getExpeditionHarvestLeft(pet, id, now) > 0;
  if (t.step === 0) return [
    { id: 'gather', title: `采集${expeditionProducts[r.product].name}`, description: available ? '沿着路标，带两份产物回家。' : '今日采集已用完，仍可走访并完成故事。', hunger: 4, energy: 4, health: 0, mood: 2, finds: available ? { [r.product]: 2 } : {} },
    { id: 'observe', title: id === 'forest' ? '寻找林莓种子与松香' : id === 'coast' ? '收集潮汐海玻璃' : '慢慢观察沿途', description: available ? id === 'forest' ? '种子稳定取得，不依赖随机委托。' : '少带一点物资，多留一点心情。' : '今天只记录风景，不再取走产物。', hunger: 3, energy: 3, health: 0, mood: 6, finds: available ? { [r.alternative]: 1, ...(id === 'forest' ? { forest_berry_seed: 1 } : {}) } : {} },
  ];
  if (t.step === 1) return [
    { id: 'safe', title: t.tool || pet.community.expedition.regions[id].base >= 2 ? '沿熟悉的捷径通过' : '沿安全小径绕行', description: t.tool ? '探路绳可重复使用，返程归还。' : pet.community.expedition.regions[id].base >= 2 ? '修好的步道让以后每次经过都更轻松。' : '没有工具也能通过，健康不会受损。', hunger: 4, energy: t.tool || pet.community.expedition.regions[id].base >= 2 ? 3 : 7, health: 0, mood: 0, finds: {} },
    { id: 'cross', title: '从近处小心穿过', description: '少花体力，但会擦伤。不会额外获得稀有奖励。', hunger: 3, energy: 2, health: -8, mood: -3, finds: {} },
  ];
  return [{ id: 'story', title: pet.community.expedition.regions[id].surveyed ? '重访熟悉的地标' : r.story, description: pet.community.expedition.regions[id].surveyed ? '记下这次同行，前往休息基地。' : '永久记录地区故事，开放基地建设、当地配方；体力上限 +2。', hunger: 4, energy: 3, health: 0, mood: 6, finds: {} }];
};
export const chooseExpeditionStep = (pet: PetState, id: string, revision: number, choiceId: string, now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  const t = pet.community.expedition.active, choice = getExpeditionChoices(pet, now).find(c => c.id === choiceId);
  if (!t || t.id !== id || t.revision !== revision || !choice) return pet;
  if (pet.hunger < choice.hunger || pet.energy < choice.energy) return fail(pet, '饱食或体力不足。可以用行囊补给，或保留发现安全返回。');
  const region = t.route[t.leg];
  let next = pet;
  if (t.step === 0 && Object.keys(choice.finds).length) next = reserveHarvest(next, region, 1, now);
  const state = next.community.expedition, first = t.step === 2 && !state.regions[region].surveyed;
  next = withExpedition(next, { regions: first ? { ...state.regions, [region]: { ...state.regions[region], surveyed: true, storyAt: now, actorId: t.actorId, actorName: t.actorName } } : state.regions,
    active: { ...t, revision: revision + 1, step: t.step + 1, coins: t.coins + (first ? 20 : 0), hearts: t.hearts + (first ? 4 : 0), journal: append(t, `${regions[region].name} · ${choice.title}`) } });
  next = putExpeditionFinds(next, choice.finds);
  return settleExpeditionTime(updatePetSatiety({ ...next, hunger: clampPetHunger(next, pet.hunger - choice.hunger), energy: clampPetEnergy(next, pet.energy - choice.energy), health: clampPetHealth(next, pet.health + choice.health), mood: clampPetStat(next, pet.mood + choice.mood), lastInteractionAt: now,
    recentEvent: first ? regions[region].storyText : `${choice.title}。${expeditionBagCount(next.community.expedition.active!.ground) ? '行囊已满，多出的物资留在返程整理中。' : '这一步已记下。'}` }), now);
};
export const useExpeditionSupply = (pet: PetState, id: string, revision: number, itemId: string, now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  const t = pet.community.expedition.active, item = getInventoryItem(itemId as ItemId);
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.paused || !item || !isExpeditionSupply(itemId) || !(t.bag[itemId] ?? 0)) return pet;
  if (getItemUsePlan(pet, item, 1).blocked) return fail(pet, overfedMessage);
  const effect = getItemStatEffect(pet, item), recovery = { hunger: applyItemHungerEffect(pet, item, effect.hunger ?? 0), energy: clampPetEnergy(pet, pet.energy + (effect.energy ?? 0)), mood: clampPetStat(pet, pet.mood + (effect.mood ?? 0)), health: clampPetHealth(pet, pet.health + (effect.health ?? 0)), cleanliness: clampPetStat(pet, pet.cleanliness + (effect.cleanliness ?? 0)) };
  if (!Object.entries(recovery).some(([key, value]) => value > pet[key as keyof typeof recovery])) return fail(pet, '当前不需要这份补给。');
  return updatePetSatiety(incrementAchievementItemUse({ ...withExpedition(pet, { active: { ...t, revision: revision + 1, bag: removeInventoryItem(t.bag, itemId) } }), ...recovery, recentEvent: `使用${item.name} ×1，其余补给留在行囊。` }, itemId as ItemId));
};
export const getBaseUpgrade = (level: number) => level === 0 ? { coins: 120, wood: 3, stone: 2, name: '修好休息基地', benefit: '每趟在这里休整一次：体力 +12、健康 +6、心情 +8；可扎营暂停' } : { coins: 180, wood: 2, stone: 3, name: '修通往返步道', benefit: '以后经过此地可走捷径，安全通过的体力成本降为 3' };
export const upgradeExpeditionBase = (pet: PetState, region: RegionId, expectedLevel: number, now = Date.now()): PetState => {
  pet = advancePet(pet, now);
  if (!regionIds.includes(region)) return pet;
  const s = pet.community.expedition, r = s.regions[region], t = s.active;
  const atCamp = t?.mode === 'manual' && t.step === 3 && t.route[t.leg] === region;
  if (r.base !== expectedLevel || r.base >= 2 || !r.surveyed || (!atCamp && !canSpendCompanionTime(pet))) return pet;
  const q = getBaseUpgrade(r.base);
  if (pet.coins < q.coins || (pet.inventory.community_wood ?? 0) < q.wood || (pet.inventory.community_stone ?? 0) < q.stone) return fail(pet, '建材或金币不足，可以先回社区准备；地区发现永久保留。');
  return { ...withExpedition(pet, { regions: { ...s.regions, [region]: { ...r, base: r.base + 1 } } }), coins: pet.coins - q.coins,
    inventory: removeInventoryItem(removeInventoryItem(pet.inventory, 'community_wood', q.wood), 'community_stone', q.stone), recentEvent: `${regions[region].base}：${q.benefit}。` };
};
export const restExpedition = (pet: PetState, id: string, revision: number, now = Date.now()): PetState => {
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.paused || t.step !== 3) return pet;
  const region = t.route[t.leg];
  if (!pet.community.expedition.regions[region].base || t.rested.includes(region)) return pet;
  return { ...withExpedition(pet, { active: { ...t, rested: [...t.rested, region], revision: revision + 1 } }), energy: clampPetEnergy(pet, pet.energy + 12), health: clampPetHealth(pet, pet.health + 6), mood: clampPetStat(pet, pet.mood + 8), recentEvent: '在熟悉的屋檐下休整了一会儿。这趟在此地的休整机会已用过。' };
};
export const pauseExpedition = (pet: PetState, id: string, revision: number, now = Date.now()): PetState => {
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.step !== 3 || t.paused || !pet.community.expedition.regions[t.route[t.leg]].base) return pet;
  return { ...withExpedition(pet, { active: { ...t, paused: true, revision: revision + 1 } }), recentEvent: '行程已在基地存下。可以回社区照顾伙伴，下次继续；行囊与本趟休整次数保留。' };
};
export const continueExpedition = (pet: PetState, id: string, revision: number, now = Date.now()): PetState => {
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id || t.revision !== revision || t.mode !== 'manual' || t.step !== 3 || t.leg >= t.route.length - 1) return pet;
  if (t.paused && (!canSpendCompanionTime(pet) || pet.pomodoro.isRunning || pet.health < getPetStatCap(pet) * .4)) return fail(pet, '继续前请结束其他活动，并把健康恢复到 40%。');
  return { ...withExpedition(pet, { active: { ...t, paused: false, step: 0, leg: t.leg + 1, revision: revision + 1 } }), lastInteractionAt: now, recentEvent: `向${regions[t.route[t.leg + 1]].name}继续出发。` };
};
export const returnExpedition = (pet: PetState, id: string, now = Date.now()): PetState => {
  pet = advancePet(pet, now); const t = pet.community.expedition.active;
  if (!t || t.id !== id) return pet;
  return finishExpedition(pet, t.mode === 'manual' && t.step === 3 && t.leg === t.route.length - 1 ? 'complete' : 'return', now);
};
export const selectExpeditionReturn = (pet: PetState, id: string, selection: Inventory): PetState => {
  const p = pet.community.expedition.pending;
  if (!p || p.id !== id || p.selected || !validBag(selection)) return pet;
  if (Object.entries(selection).some(([item, count]) => count > (p.items[item] ?? 0) + (p.overflow[item] ?? 0))) return pet;
  return withExpedition(pet, { pending: { ...p, items: { ...selection }, overflow: {}, selected: true } });
};
export const claimExpedition = (pet: PetState, id: string): PetState => {
  const p = pet.community.expedition.pending;
  if (!p || p.id !== id || !p.selected) return pet;
  const items = { ...p.items, ...(p.tool ? { trail_rope: (p.items.trail_rope ?? 0) + 1 } : {}) };
  if (Object.entries(items).some(([item, n]) => (pet.inventory[item] ?? 0) + n > inventoryItemLimit)) return fail(pet, '仓库暂时放不下全部物资，回执完整保留。可先去厨房、摆摊或回收整理。');
  return recordEarnedHearts(recordEarnedCoins({ ...withExpedition(pet, { pending: undefined, lastReceipt: { id: p.id, reason: p.reason, at: p.at, route: p.route, journal: p.journal } }),
    inventory: Object.entries(items).reduce((stock, [item, n]) => addInventoryItem(stock, item, n), pet.inventory), coins: pet.coins + p.coins, hearts: pet.hearts + p.hearts, recentEvent: '远行物资已放入共用仓库，料理、小摊和社区项目都可以使用。' }, p.coins), p.hearts);
};
