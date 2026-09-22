import type { ShopItem } from './petTypes';
import { fish, fishIds, waters } from './communityData';
import { expeditionProducts } from './expeditionData';
import type { ExpeditionItemId } from './expeditionTypes';
import { communityCrops, productionIngredients, wildIngredients, rarityNames, type ProductionItemId } from './foodCatalog';
import { fieldEquipmentItems } from './fieldEquipmentData';
import { regionalTreasures, regionalTreasureIds } from './regionalTreasures';

export const communityShopItems: readonly ShopItem[] = [
  ...fieldEquipmentItems,
  { id: 'farm_milk', name: '牧场鲜奶', kind: 'food', price: 18, effect: { hunger: 12, mood: 6 }, tags: ['kitchen_material', 'common', 'basic'], summary: '新鲜的牛奶，可以直接喝，也能用于料理和加工。' },
  ...Object.values(communityCrops).filter(c => c.seedPrice > 0 && c.seed !== 'carrot_seed').map((c): ShopItem => ({ id: c.seed, name: `${c.name}种子`, kind: 'garden', price: c.seedPrice, effect: {}, usable: false, summary: `社区菜地种植，${c.hours} 小时收获 ${c.yield} 份${c.name}。` })),
  { id: 'field_dressing', name: '便携护理包', kind: 'care', price: 28, effect: { health: 36 }, summary: '途中护理小伤，吃撑时也能使用。' },
  { id: 'comfort_charm', name: '安心香囊', kind: 'care', price: 18, effect: { mood: 28 }, summary: '随身带着的清香，让心情安稳下来。' },
  { id: 'carrot_seed', name: '胡萝卜种子', kind: 'garden', price: 12, effect: {}, usable: false, summary: '在社区菜地种植，4 小时收获 3 根胡萝卜。' },
  { id: 'community_wood', name: '修复木料', kind: 'item', price: 12, effect: {}, usable: false, summary: '商店购买或溪谷采集。用于农场设施建设、菜地扩容与设施升级。' },
  { id: 'community_stone', name: '修复石料', kind: 'item', price: 10, effect: {}, usable: false, summary: '商店购买或溪谷采集。用于农场设施建设、菜地扩容与设施升级。' },
  { id: 'animal_feed', name: '谷物饲料', kind: 'garden', price: 5, effect: {}, usable: false, summary: '添进鸡舍或牛棚的食槽，每轮一份。' },
  { id: 'fishing_bait', name: '普通鱼饵', kind: 'item', price: 4, effect: {}, usable: false, summary: '日常钓鱼的好帮手，每竿一份。' },
  { id: 'river_bait', name: '溪流鱼饵', kind: 'item', price: 8, effect: {}, usable: false, summary: '更容易吸引珍稀鱼，适合寻觅新鱼获。' },
  { id: 'fishing_rod', name: '普通钓竿', kind: 'item', price: 80, effect: {}, usable: false, summary: '轻巧顺手，上钩后收线 4 次。' },
  { id: 'reinforced_rod', name: '柔韧钓竿', kind: 'item', price: 180, effect: {}, usable: false, summary: '结实省力，上钩后收线 3 次。' },
];
export const communityFindItems: readonly ShopItem[] = [
  ...regionalTreasureIds.map((id): ShopItem => { const d = regionalTreasures[id]; return { id, name: d.name, kind: 'item', price: 0, effect: {}, usable: false, tags: ['region_treasure', d.rarity, 'collector'], summary: `${rarityNames[d.rarity]}珍宝，${d.use}。` }; }),
  ...Object.entries({ ...productionIngredients, ...wildIngredients }).map(([id, product]): ShopItem => ({ id: id as ProductionItemId, name: product.name, kind: 'food', price: 0, usable: false, effect: {}, tags: ['kitchen_material', product.rarity, product.demand], summary: `${rarityNames[product.rarity]}食材，${product.use}。` })),
  ...Object.entries(expeditionProducts).filter(([id]) => !(id in wildIngredients) && !(id in regionalTreasures)).map(([id, product]): ShopItem => ({ id: id as ExpeditionItemId, name: product.name, kind: id.endsWith('_seed') ? 'garden' : ['pine_resin', 'sea_glass', 'observatory_part'].includes(id) ? 'item' : 'food', price: 0, usable: false, effect: {}, tags: ['valley_mushroom', 'hill_honey', 'forest_berry', 'coast_kelp'].includes(id) ? ['kitchen_material', 'fine', 'specialty'] : ['region_product'], summary: `地区探索获得，商店不出售。${product.use}。` })),
  { id: 'creek_herb_seed', name: '溪谷香草种子', kind: 'garden', price: 0, effect: {}, usable: false, summary: '从溪谷带回的种子，可在菜地培育香草。' },
  { id: 'creek_herb', name: '溪谷香草', kind: 'food', price: 0, effect: {}, usable: false, tags: ['kitchen_material'], summary: '菜地收获；用于香草暖粥、邻里委托与经营。' },
  ...fishIds.map((id): ShopItem => ({ id, name: fish[id].name, kind: 'food', price: 0, effect: {}, usable: false, tags: [fish[id].rare ? 'fish_collection' : 'kitchen_material', fish[id].rarity], summary: `${waters[fish[id].water].name}的${rarityNames[fish[id].rarity]}鱼，${fish[id].rare ? '可观赏收藏或摆摊出售' : '可用于对应鱼类料理'}。` })),
];
