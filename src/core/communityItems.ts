import type { ShopItem } from './petTypes';
import { fish, fishIds } from './communityData';
import { expeditionProducts } from './expeditionData';
import type { ExpeditionItemId } from './expeditionTypes';

export const communityShopItems: readonly ShopItem[] = [
  { id: 'field_dressing', name: '便携护理包', kind: 'care', price: 28, effect: { health: 36 }, summary: '恢复健康 36，不降低心情；占 1 份行囊，吃撑时也能使用。' },
  { id: 'comfort_charm', name: '安心香囊', kind: 'care', price: 18, effect: { mood: 28 }, summary: '恢复心情 28，不增加饱食；占 1 份行囊，吃撑时也能使用。' },
  { id: 'carrot_seed', name: '胡萝卜种子', kind: 'garden', price: 12, effect: {}, usable: false, summary: '在社区菜地种植，4 小时收获 3 根胡萝卜。' },
  { id: 'community_wood', name: '修复木料', kind: 'item', price: 12, effect: {}, usable: false, summary: '用于社区设施建设与小摊扩建；可设自用保留量。' },
  { id: 'community_stone', name: '修复石料', kind: 'item', price: 10, effect: {}, usable: false, summary: '用于社区设施建设与小摊扩建；可设自用保留量。' },
  { id: 'animal_feed', name: '谷物饲料', kind: 'garden', price: 5, effect: {}, usable: false, summary: '鸡舍／牛棚每轮消耗 1 份，各可存 3 份饲料。不会自动购买。' },
  { id: 'fishing_bait', name: '普通鱼饵', kind: 'item', price: 4, effect: {}, usable: false, summary: '每次抛竿消耗 1 份，取消或脱钩不返还。各水域每三竿至少一竿遇到基础料理鱼。' },
  { id: 'river_bait', name: '溪流鱼饵', kind: 'item', price: 8, effect: {}, usable: false, summary: '上游步道建成后可买。提高珍稀鱼出现机会；不会自动完成收线。' },
  { id: 'fishing_rod', name: '普通钓竿', kind: 'item', price: 80, effect: {}, usable: false, summary: '可重复使用，不消耗耐久。钓鱼小屋建成赠送 1 根。' },
  { id: 'reinforced_rod', name: '柔韧钓竿', kind: 'item', price: 180, effect: {}, usable: false, summary: '钓鱼小屋建成后可买。收线张力每次 +24（普通 +32），不增加售鱼价格。' },
];
export const communityFindItems: readonly ShopItem[] = [
  ...Object.entries(expeditionProducts).map(([id, product]): ShopItem => ({ id: id as ExpeditionItemId, name: product.name, kind: id.endsWith('_seed') ? 'garden' : ['pine_resin', 'sea_glass', 'observatory_part'].includes(id) ? 'item' : 'food', price: 0, usable: false, effect: {}, tags: ['valley_mushroom', 'hill_honey', 'forest_berry', 'coast_kelp'].includes(id) ? ['kitchen_material'] : ['region_product'], summary: `地区探索获得，商店不出售。${product.use}。` })),
  { id: 'creek_herb_seed', name: '溪谷香草种子', kind: 'garden', price: 0, effect: {}, usable: false, summary: '商店不出售。溪谷定向搜寻获得，收获的香草也能留种。' },
  { id: 'creek_herb', name: '溪谷香草', kind: 'food', price: 0, effect: {}, usable: false, tags: ['kitchen_material'], summary: '菜地收获；用于香草暖粥，或用 2 份留种 1 份。' },
  { id: 'farm_milk', name: '牧场鲜奶', kind: 'food', price: 0, effect: { hunger: 12, mood: 6 }, tags: ['kitchen_material'], summary: '牛棚生产，商店不出售。用于鲜奶蛋羹、社区订单，也可以饮用。' },
  ...fishIds.map((id): ShopItem => ({ id, name: fish[id].name, kind: 'food', price: 0, effect: {}, usable: false, tags: fish[id].rare ? ['fish_collection'] : ['kitchen_material'], summary: `${fish[id].water === 'pond' ? '池塘' : '上游'}手动钓获。${fish[id].rare ? '珍稀收藏，售出后仍保留图鉴；摆摊需要收藏买家。' : id === 'river_perch' ? '可回收或摆摊，钓获可推进上游调查。' : '用于对应鱼类料理、回收或摆摊，钓获可推进水域调查。'}工会回收基价 ${fish[id].base} 金币。` })),
];
