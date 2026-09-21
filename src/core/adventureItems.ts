import type { ShopItem } from './petTypes';
import { activityText as L } from './kitchenRecipes';
import type { AdventureTreasureId } from './adventureTypes';
import { hashString } from './utils';

export const coinHoardValue = 360;
export const adventureTreasureValues: Record<AdventureTreasureId, number> = { coin_hoard: coinHoardValue, valley_amber: 600, ancient_gold_bar: 1000 };
export const adventureTreasureIds = ['coin_hoard', 'valley_amber', 'ancient_gold_bar'] as const;
export const getAdventureTripTreasure = (tripId: string) => adventureTreasureIds[hashString(tripId + ':treasure') % adventureTreasureIds.length];
export const isAdventureTreasure = (id: string): id is AdventureTreasureId => Object.prototype.hasOwnProperty.call(adventureTreasureValues, id);
export const getAdventureTreasureValue = (id: string) => isAdventureTreasure(id) ? adventureTreasureValues[id] : 0;
export const adventureLootItems: readonly ShopItem[] = [
  { id: 'map_handbook', get name() { return L('地图手册', 'Map handbook'); }, kind: 'item', price: 0, effect: {}, usable: false, tags: ['adventure_keepsake'],
    get summary() { return L('踩点探索中找到的地图手册。通关后大地图永久开放，手册可留作第一次冒险的纪念。', 'A handbook found on your first scouting trip. Completing the tutorial permanently opens the world map; keep this as a memento.'); } },
  { id: 'coin_hoard', get name() { return L('金币堆', 'Coin hoard'); }, kind: 'item', price: 0, effect: {}, usable: true, tags: ['adventure_treasure'],
    get summary() { return L(`各地区探索时有概率发现的通用收获。占 1 份行囊容量，可兑换 ${adventureTreasureValues.coin_hoard} 金币，或用于农场装饰升级。`, `A scouting treasure. Takes one bag slot and can be exchanged for ${adventureTreasureValues.coin_hoard} coins.`); } },
  { id: 'valley_amber', get name() { return L('琥珀', 'Valley amber'); }, kind: 'item', price: 0, effect: {}, usable: true, tags: ['adventure_treasure'],
    get summary() { return L(`各地区探索时有概率发现的温润琥珀。占 1 份行囊容量，可兑换 ${adventureTreasureValues.valley_amber} 金币、摆摊，或在农场「旅途与日常」制作琥珀叶影灯、升级装饰。`, `A smooth amber stone washed out by the creek, with a tiny leaf inside. Takes one bag slot and can be exchanged for ${adventureTreasureValues.valley_amber} coins.`); } },
  { id: 'ancient_gold_bar', get name() { return L('古老金条', 'Ancient gold bar'); }, kind: 'item', price: 0, effect: {}, usable: true, tags: ['adventure_treasure'],
    get summary() { return L(`各地区探索时有概率发现的古老金条。占 1 份行囊容量，可兑换 ${adventureTreasureValues.ancient_gold_bar} 金币、摆摊，或在农场「旅途与日常」制作鎏金社区铭牌、升级装饰。`, `A small gold bar marked by age. Takes one bag slot and can be exchanged for ${adventureTreasureValues.ancient_gold_bar} coins.`); } },
];

export const adventureItems: readonly ShopItem[] = [
  { id: 'trail_mix', get name() { return L('便携坚果包', 'Trail mix'); }, kind: 'food', price: 28,
    effect: { hunger: 36, energy: 18 }, tags: ['adventure_supply'],
    get summary() { return L('轻便口粮，基础恢复饱食度 36、体力 18，占 1 份行囊；适合途中同时补充饱食与体力。', 'A compact ration. Restores 36 hunger and 18 energy before bonuses; takes one bag slot.'); } },
  { id: 'berry_bait', get name() { return L('野果诱饵包', 'Berry lure'); }, kind: 'item', price: 8,
    effect: {}, usable: false, tags: ['adventure_supply'],
    get summary() { return L('探索遭遇中用来引开挡路的小动物，使用后消耗一份。', 'Use one during an encounter to lure a small animal off the path.'); } },
  { id: 'trail_rope', get name() { return L('探路绳', 'Trail rope'); }, kind: 'item', price: 80,
    effect: {}, usable: false, tags: ['adventure_tool'],
    get summary() { return L('放入工具位，过桥时节省体力与饱食度；可重复使用，返程归还。', 'Equip in the tool slot to cross with less hunger and energy. Reusable; returned after the trip.') + ' 耐久 16 次，选择绳索通路时扣 1 次；只携带不扣耐久。未用尽的绳索返程归还，用尽后损坏。'; } },
];
