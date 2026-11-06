import type { AdventureCommission } from './adventureTypes';
import type { BuiltinItemId, Inventory, PetState } from './petTypes';
import type { RegionId } from './expeditionTypes';
import { advanceAdventureCommissions, commissionLimit } from './adventureCommissionState';
import { getRegionUnlocked, regionIds, regions } from './expeditionData';
import { getExplorationResources } from './explorationResources';
import { communityCrops } from './foodCatalog';
import { getCommunitySale } from './communityEconomy';
import { goldenAppleValue } from './goldenAppleGacha';
import { getDecorationEffects, getDecorationLevel, getDecorationCommissionTimeReduction } from './decorationEffects';
import { getExplorationRoll } from './explorationChecks';
import { regionalTreasureIds, regionalTreasures } from './regionalTreasures';
import { addInventoryItem, removeInventoryItem } from './items';
import { inventoryItemLimit } from './saveMetadata';
import { advancePet } from './petLifecycle';
import { hashString } from './utils';

export { commissionLimit, advanceAdventureCommissions } from './adventureCommissionState';
export const commissionBaseDurationMs = 2 * 3600000;
export const commissionMinimumValue = goldenAppleValue * 2;
export const getCommissionQuote = (pet: PetState, region: RegionId) => {
  const campReduction = Math.min(2, pet.community.expedition.regions[region].base) * 10;
  const decorationReduction = getDecorationCommissionTimeReduction(getDecorationLevel(pet, 'star_dome'));
  return { durationMs: Math.round(commissionBaseDurationMs * (1 - campReduction / 100) * (1 - decorationReduction / 100)),
    campReduction, decorationReduction, bonusChance: .5 + getDecorationEffects(pet).star_dome, minimumValue: commissionMinimumValue };
};

export const getCommissionMaterialPool = (region: RegionId) => getExplorationResources(region)
  .filter(resource => !resource.research && !Object.values(communityCrops).some(crop => crop.seed === resource.id))
  .map(resource => ({ id: resource.id as BuiltinItemId, value: Math.round((getCommunitySale(resource.id)?.base ?? 0) * 100) }))
  .filter(resource => resource.value > 0);

export const getCommissionStartReason = (pet: PetState, actorId: string, region: RegionId, _now = Date.now()): string => {
  if (pet.timePause) return '时间已冻结，恢复时间后再委托伙伴。';
  if (!actorId || actorId.length > 128) return '请选择大厅里的伙伴。';
  if (!regionIds.includes(region) || !getRegionUnlocked(pet, region)) return '先解锁这个地区，再请伙伴前往。';
  if (pet.adventure.commissions.some(task => task.actorId === actorId)) return '这位伙伴已有委托，收好物资后再安排吧。';
  if (pet.adventure.commissions.length >= commissionLimit) return '最多同时保留 3 单委托，请先领取已完成的物资。';
  if ((pet.inventory.golden_apple ?? 0) < 1) return '委托需要 1 个金苹果。';
  if (getCommissionMaterialPool(region).length < 2) return '这个地区暂时没有足够的可采集素材。';
  return '';
};

export const startAdventureCommission = (pet: PetState, actorId: string, actorName: string, region: RegionId, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advancePet(pet, now);
  const reason = getCommissionStartReason(pet, actorId, region, now);
  if (reason) return { ...pet, recentEvent: reason };
  const quote = getCommissionQuote(pet, region), pool = getCommissionMaterialPool(region);
  const startedAt = Math.max(now, pet.lastUpdatedAt), sequence = pet.adventure.nextCommissionId;
  const seed = hashString(`${pet.saveMetadata.id}:commission:${sequence}:${startedAt}`), items: Inventory = {};
  let rollIndex = 0, total = 0;
  const add = (resource: typeof pool[number]) => { items[resource.id] = (items[resource.id] ?? 0) + 1; total += resource.value; };
  const pick = (choices: typeof pool) => choices[Math.floor(getExplorationRoll(seed, String(rollIndex++), 'commission-materials') * choices.length)];
  const first = pick(pool);
  add(first); add(pick(pool.filter(resource => resource.id !== first.id)));
  while (total < quote.minimumValue * 100) add(pick(pool));
  const bonusItem = getExplorationRoll(seed, '0', 'commission-bonus') < quote.bonusChance / 100
    ? regionalTreasureIds.find(item => regionalTreasures[item].region === region) : undefined;
  const { minimumValue: _minimumValue, ...snapshot } = quote;
  const task: AdventureCommission = { ...snapshot, id: `commission:${sequence}`, actorId, actorName: actorName.slice(0, 32) || '旅途伙伴', region,
    startedAt, endsAt: startedAt + quote.durationMs, status: 'active', items, bonusItem, bonusRemaining: Boolean(bonusItem), baseValue: total / 100 };
  return { ...pet, inventory: removeInventoryItem(pet.inventory, 'golden_apple', 1),
    adventure: { ...pet.adventure, nextCommissionId: sequence + 1, commissions: [...pet.adventure.commissions, task] },
    lastInteractionAt: now, recentEvent: `${task.actorName}收下了金苹果，出发去${regions[region].name}搜集素材。` };
};

export const claimAdventureCommission = (pet: PetState, id: string, now = Date.now()): PetState => {
  if (pet.timePause) return pet;
  pet = advanceAdventureCommissions(pet, now);
  const task = pet.adventure.commissions.find(task => task.id === id);
  if (!task || task.status !== 'ready') return pet;
  let inventory = pet.inventory;
  const remaining: Inventory = {};
  for (const [item, count] of Object.entries(task.items)) {
    const take = Math.min(count, Math.max(0, inventoryItemLimit - (inventory[item] ?? 0)));
    if (take) inventory = addInventoryItem(inventory, item, take);
    if (take < count) remaining[item] = count - take;
  }
  let bonusRemaining = task.bonusRemaining;
  if (task.bonusItem && bonusRemaining && (inventory[task.bonusItem] ?? 0) < inventoryItemLimit) {
    inventory = addInventoryItem(inventory, task.bonusItem, 1); bonusRemaining = false;
  }
  const keep = Object.keys(remaining).length > 0 || bonusRemaining;
  return { ...pet, inventory, adventure: { ...pet.adventure,
    commissions: keep ? pet.adventure.commissions.map(value => value.id === id ? { ...task, items: remaining, bonusRemaining } : value) : pet.adventure.commissions.filter(value => value.id !== id),
    commissionsCompleted: pet.adventure.commissionsCompleted + Number(!keep) },
    lastInteractionAt: now, recentEvent: keep ? '已经收好能放下的素材，剩余物资会继续保留，腾出仓库后再来领取。' : `收好了${task.actorName}带回的素材${task.bonusItem ? '和额外珍宝' : ''}。` };
};
