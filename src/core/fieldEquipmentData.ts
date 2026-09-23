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
  { id: 'field_watering_can', name: '细嘴浇水壶', kind: 'garden', price: 96, effect: {}, usable: false, tags: ['field_tool'], summary: '给菜地浇水，让作物更早成熟。' },
  { id: 'harvest_sickle', name: '精收镰刀', kind: 'garden', price: 120, effect: {}, usable: false, tags: ['field_tool'], summary: '细心收割，每轮多收获一份作物。' },
  { id: 'nutrient_compost', name: '营养堆肥', kind: 'garden', price: 8, effect: {}, usable: false, tags: ['field_supply'], summary: '为菜地添些养分，本轮产量 +1。' },
  { id: 'fishing_float', name: '醒目浮漂', kind: 'item', price: 60, effect: {}, usable: false, tags: ['fishing_tool'], summary: '手动钓鱼时，让鱼儿早一点上钩。' },
  { id: 'landing_net', name: '轻便抄网', kind: 'item', price: 100, effect: {}, usable: false, tags: ['fishing_tool'], summary: '手动收线少点一次，轻松收下鱼获。' },
  { id: 'prospector_pick', name: '勘探手镐', kind: 'item', price: 120, effect: {}, usable: false, tags: ['expedition_tool'], summary: '敲开岩缝，帮助寻找当地珍宝。' },
  { id: 'survey_lens', name: '调查放大镜', kind: 'item', price: 90, effect: {}, usable: false, tags: ['expedition_tool'], summary: '看清沿途细节，帮助调查与发现。' },
  { id: 'camp_kit', name: '便携营具', kind: 'item', price: 72, effect: {}, usable: false, tags: ['expedition_tool'], summary: '路线中点可使用仓库营具休整一次，恢复体力、心情和健康；继续前进便错过休整点。' },
];
export const getEquipmentPurchaseReason = (pet: PetState, id: string): string => {
  if (['field_watering_can', 'harvest_sickle', 'nutrient_compost'].includes(id) && !pet.community.gardenBuilt) return '先开放社区菜地';
  if (['fishing_float', 'landing_net'].includes(id) && !pet.community.facilities.fishing_hut.built) return '先开放钓鱼小屋';
  if (['prospector_pick', 'survey_lens', 'camp_kit'].includes(id) && !(pet.adventure.completed.tutorial ?? 0)) return '先完成踩点探索';
  return '';
};
