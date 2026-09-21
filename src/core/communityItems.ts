import type { ShopItem } from './petTypes';
import { fish, fishIds, waters } from './communityData';
import { expeditionProducts } from './expeditionData';
import { getFoodSource } from './foodSources';
import type { ExpeditionItemId } from './expeditionTypes';
import { communityCrops, productionIngredients, wildIngredients, rarityNames, type ProductionItemId } from './foodCatalog';
import { fieldEquipmentItems } from './fieldEquipmentData';
import { regionalTreasures, regionalTreasureIds } from './regionalTreasures';

export const communityShopItems: readonly ShopItem[] = [
  ...fieldEquipmentItems,
  { id: 'farm_milk', name: '牧场鲜奶', kind: 'food', price: 18, effect: { hunger: 12, mood: 6 }, tags: ['kitchen_material', 'common', 'basic'], summary: '初始可购买，也可由牛棚生产。用于料理，或在加工台制成草莓牛奶、高钙奶、奶油和奶酪。' },
  ...Object.values(communityCrops).filter(c => c.seedPrice > 0 && c.seed !== 'carrot_seed').map((c): ShopItem => ({ id: c.seed, name: `${c.name}种子`, kind: 'garden', price: c.seedPrice, effect: {}, usable: false, summary: `社区菜地种植，${c.hours} 小时收获 ${c.yield} 份${c.name}。${c.product === 'wheat' ? '免费加工可得面粉 8 份，种子成本每份面粉 3 金币。' : ''}` })),
  { id: 'field_dressing', name: '便携护理包', kind: 'care', price: 28, effect: { health: 36 }, summary: '恢复健康 36，不降低心情；占 1 份行囊，吃撑时也能使用。' },
  { id: 'comfort_charm', name: '安心香囊', kind: 'care', price: 18, effect: { mood: 28 }, summary: '恢复心情 28，不增加饱食；占 1 份行囊，吃撑时也能使用。' },
  { id: 'carrot_seed', name: '胡萝卜种子', kind: 'garden', price: 12, effect: {}, usable: false, summary: '在社区菜地种植，4 小时收获 3 根胡萝卜。' },
  { id: 'community_wood', name: '修复木料', kind: 'item', price: 12, effect: {}, usable: false, summary: '商店购买或溪谷采集。用于农场设施建设、菜地扩容与设施升级。' },
  { id: 'community_stone', name: '修复石料', kind: 'item', price: 10, effect: {}, usable: false, summary: '商店购买或溪谷采集。用于农场设施建设、菜地扩容与设施升级。' },
  { id: 'animal_feed', name: '谷物饲料', kind: 'garden', price: 5, effect: {}, usable: false, summary: '鸡舍／牛棚每轮消耗 1 份；饲料容量随扩建为 3／5／8 份，产物容量为 6／10／16 份。不会自动购买。' },
  { id: 'fishing_bait', name: '普通鱼饵', kind: 'item', price: 4, effect: {}, usable: false, summary: '每竿消耗 1 份，手动收竿不返还。总竿数第 1、4、7…竿使用普通鱼饵时，遇到当前水域的基础料理鱼。挂机未使用的鱼饵会退回。' },
  { id: 'river_bait', name: '溪流鱼饵', kind: 'item', price: 8, effect: {}, usable: false, summary: '上游步道建成后可买。提高珍稀鱼出现机会；不会自动完成收线。' },
  { id: 'fishing_rod', name: '普通钓竿', kind: 'item', price: 80, effect: {}, usable: false, summary: '耐久 20 竿。上钩后点击收线 4 次即可收获；手动抛竿或挂机钓获时扣 1 次耐久。钓鱼小屋建成赠送 1 根。' },
  { id: 'reinforced_rod', name: '柔韧钓竿', kind: 'item', price: 180, effect: {}, usable: false, summary: '耐久 45 竿。手动上钩后点击收线 3 次即可收获；挂机每条鱼扣 1 次耐久。钓鱼小屋建成后可买。' },
];
export const communityFindItems: readonly ShopItem[] = [
  ...regionalTreasureIds.map((id): ShopItem => { const d = regionalTreasures[id]; return { id, name: d.name, kind: 'item', price: 0, effect: {}, usable: false, tags: ['region_treasure', d.rarity, 'collector'], summary: `${rarityNames[d.rarity]}珍宝。地区定向勘探累计 ${d.investigations} 点调查获得 1 件；${d.use}。回收 ${d.base} 金币，最高摆摊 ${Math.floor(d.base * 140 / 100)} 金币。` }; }),
  ...Object.entries({ ...productionIngredients, ...wildIngredients }).map(([id, product]): ShopItem => ({ id: id as ProductionItemId, name: product.name, kind: 'food', price: 0, usable: false, effect: {}, tags: ['kitchen_material', product.rarity, product.demand], summary: `${rarityNames[product.rarity]}食材。${getFoodSource(id)}。${product.use}。回收单价 ${product.base} 金币。` })),
  ...Object.entries(expeditionProducts).filter(([id]) => !(id in wildIngredients) && !(id in regionalTreasures)).map(([id, product]): ShopItem => ({ id: id as ExpeditionItemId, name: product.name, kind: id.endsWith('_seed') ? 'garden' : ['pine_resin', 'sea_glass', 'observatory_part'].includes(id) ? 'item' : 'food', price: 0, usable: false, effect: {}, tags: ['valley_mushroom', 'hill_honey', 'forest_berry', 'coast_kelp'].includes(id) ? ['kitchen_material', 'fine', 'specialty'] : ['region_product'], summary: `地区探索获得，商店不出售。${product.use}。` })),
  { id: 'creek_herb_seed', name: '溪谷香草种子', kind: 'garden', price: 0, effect: {}, usable: false, summary: '商店不出售。溪谷每日首次搜寻获得 2 份，水渠故事首次奖励 2 份；播种消耗 1 份。' },
  { id: 'creek_herb', name: '溪谷香草', kind: 'food', price: 0, effect: {}, usable: false, tags: ['kitchen_material'], summary: '菜地收获；用于香草暖粥、邻里委托与经营。' },
  ...fishIds.map((id): ShopItem => ({ id, name: fish[id].name, kind: 'food', price: 0, effect: {}, usable: false, tags: [fish[id].rare ? 'fish_collection' : 'kitchen_material', fish[id].rarity], summary: `${rarityNames[fish[id].rarity]} · ${waters[fish[id].water].name}手动钓获。${fish[id].rare ? '观赏收藏，售出后仍保留图鉴；收藏客人选购。' : '用于对应鱼类料理、回收或摆摊。'}社区回收单价 ${fish[id].base} 金币。` })),
];
