import { communityDecorationIds, type CommunityDecorationId, type RegionalTreasureId } from './regionalTreasures';
import type { PetState } from './petTypes';

export const decorationEffects = {
  amber_lantern: { label: '订单金币', unit: '%', values: [5, 10, 20], treasure: 'creek_aquamarine', place: '告示板旁' },
  golden_sign: { label: '新上架售价', unit: '%', values: [5, 10, 15], treasure: 'hill_sunstone', place: '小摊招牌' },
  creek_fountain: { label: '作物生长时间缩短', unit: '%', values: [5, 10, 20], treasure: 'creek_aquamarine', place: '菜地水渠旁' },
  sun_weather_vane: { label: '牧场生产周期缩短', unit: '%', values: [5, 10, 20], treasure: 'hill_sunstone', place: '牧场屋顶' },
  emerald_pendant: { label: '普通采集额外一份概率', unit: '%', values: [10, 20, 35], treasure: 'forest_emerald', place: '旅途小路的树上' },
  pearl_lamp: { label: '咬钩等待时间缩短', unit: '%', values: [10, 20, 30], treasure: 'tidal_pearl', place: '钓鱼码头' },
  star_dome: { label: '挂机珍宝概率增加', unit: '个百分点', values: [1, 3, 6], treasure: 'star_sapphire', place: '旅途角' },
} as const satisfies Record<CommunityDecorationId, { label: string; unit: string; values: readonly number[]; treasure: RegionalTreasureId; place: string }>;

export const getDecorationLevel = (pet: Pick<PetState, 'community'>, id: CommunityDecorationId) => {
  if (!pet.community.decorations.includes(id)) return 0;
  const level = pet.community.decorationLevels?.[id];
  return typeof level === 'number' && Number.isFinite(level) ? Math.max(1, Math.min(10, Math.floor(level))) : 1;
};
export const getDecorationValue = (id: CommunityDecorationId, level: number) => {
  if (level <= 0) return 0;
  const [first, middle, last] = decorationEffects[id].values;
  return Math.round((level <= 5 ? first + (middle - first) * (level - 1) / 4 : middle + (last - middle) * (Math.min(10, level) - 5) / 5) * 10) / 10;
};
export const getDecorationEffects = (pet: Pick<PetState, 'community'>) => Object.fromEntries(communityDecorationIds.map(id => [id, getDecorationValue(id, getDecorationLevel(pet, id))])) as Record<CommunityDecorationId, number>;
export const decoratedOrderCoins = (pet: PetState, coins: number) => Math.floor(coins * (1 + getDecorationEffects(pet).amber_lantern / 100));
