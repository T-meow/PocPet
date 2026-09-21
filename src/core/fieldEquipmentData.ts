import type { PetState, ShopItem } from './petTypes';

export const toolDefinitions = {
  fishing_rod: { name: '普通钓竿', uses: 20 },
  reinforced_rod: { name: '柔韧钓竿', uses: 45 },
  trail_rope: { name: '探路绳', uses: 16 },
  field_watering_can: { name: '细嘴浇水壶', uses: 16 },
  harvest_sickle: { name: '精收镰刀', uses: 20 },
  fishing_float: { name: '醒目浮漂', uses: 20 },
  landing_net: { name: '轻便抄网', uses: 20 },
  prospector_pick: { name: '勘探手镐', uses: 12 },
  survey_lens: { name: '调查放大镜', uses: 15 },
  camp_kit: { name: '便携营具', uses: 12 },
} as const;
export type DurableToolId = keyof typeof toolDefinitions;
export const durableToolIds = Object.keys(toolDefinitions) as DurableToolId[];
export type FieldEquipmentId = Exclude<DurableToolId, 'fishing_rod' | 'reinforced_rod' | 'trail_rope'> | 'nutrient_compost';
export const fieldEquipmentItems: readonly ShopItem[] = [
  { id: 'field_watering_can', name: '细嘴浇水壶', kind: 'garden', price: 96, effect: {}, usable: false, tags: ['field_tool'], summary: '耐久 16 次。在菜地照料中浇水，每轮限一次，缩短作物基础生长时间的 20%；成熟后不扣耐久。' },
  { id: 'harvest_sickle', name: '精收镰刀', kind: 'garden', price: 120, effect: {}, usable: false, tags: ['field_tool'], summary: '耐久 20 次。菜地成熟后选择精细收割，本轮收获 +1 份；成功入库才扣耐久。' },
  { id: 'nutrient_compost', name: '营养堆肥', kind: 'garden', price: 8, effect: {}, usable: false, tags: ['field_supply'], summary: '一次性用品。生长期间在菜地照料中施肥，每轮限一次，收获 +1 份；可与精收镰刀叠加。' },
  { id: 'fishing_float', name: '醒目浮漂', kind: 'item', price: 60, effect: {}, usable: false, tags: ['fishing_tool'], summary: '耐久 20 竿。在小屋勾选后，提竿窗口由 20 秒延长至 30 秒；抛竿扣一次，取消不返还。' },
  { id: 'landing_net', name: '轻便抄网', kind: 'item', price: 100, effect: {}, usable: false, tags: ['fishing_tool'], summary: '耐久 20 竿。在小屋勾选后，每次收线进度由 +28 提高至 +36，张力不变；抛竿扣一次。' },
  { id: 'prospector_pick', name: '勘探手镐', kind: 'item', price: 120, effect: {}, usable: false, tags: ['expedition_tool'], summary: '耐久 12 次。手镐勘探推进 2 点珍宝调查；溪谷消耗 2 次采集机会、另得野菇 ×2。各路线的饱食与体力消耗会在操作前显示。' },
  { id: 'survey_lens', name: '调查放大镜', kind: 'item', price: 90, effect: {}, usable: false, tags: ['expedition_tool'], summary: '耐久 15 次。调查松茸或高山茶叶时可选择使用，调查进度 +2，行动的饱食与体力消耗增加 20%，并消耗一次采集机会。' },
  { id: 'camp_kit', name: '便携营具', kind: 'item', price: 72, effect: {}, usable: false, tags: ['expedition_tool'], summary: '耐久 12 次。完成一次有消耗的行动后可随时扎营：恢复体力上限 25%、心情上限 20%，另恢复至多 3 健康；体力和健康限本地区尚未恢复的实际损耗，与基地共用每趟每地区一次休整。' },
];
export const getEquipmentPurchaseReason = (pet: PetState, id: string): string => {
  if (['field_watering_can', 'harvest_sickle', 'nutrient_compost'].includes(id) && !pet.community.gardenBuilt) return '先开放社区菜地';
  if (['fishing_float', 'landing_net'].includes(id) && !pet.community.facilities.fishing_hut.built) return '先开放钓鱼小屋';
  if (['prospector_pick', 'survey_lens', 'camp_kit'].includes(id) && !(pet.adventure.completed.tutorial ?? 0)) return '先完成踩点探索';
  return '';
};
