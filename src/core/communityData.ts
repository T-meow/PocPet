import type { AnimalId, CommissionTemplate, FacilityId, FishId, WaterId } from './communityTypes';
import type { PetState } from './petTypes';
import { communityCrops, getCropUnlockReason, type FoodRarity, type CropId } from './foodCatalog';
import type { ValleyQuestId } from './valleyQuests';

export const facilityIds: FacilityId[] = ['coop', 'barn', 'fishing_hut', 'upstream', 'stall'];
export const facilities: Record<FacilityId, { name: string; clue: string; jobs: [string, string]; coins: number; wood: number; stone: number; requires?: FacilityId | 'garden'; benefit: string }> = {
  coop: { name: '鸡舍', clue: '旧农舍的饲喂装置', jobs: ['清理鸡舍', '安装饲喂槽'], coins: 240, wood: 5, stone: 2, requires: 'garden', benefit: '每份饲料 6 小时产鸡蛋 ×2，最多存 6 份' },
  barn: { name: '牛棚', clue: '牧道旁的饮水设备', jobs: ['铺好干草垫', '修好饮水槽'], coins: 420, wood: 7, stone: 4, requires: 'coop', benefit: '每份饲料 8 小时产鲜奶 ×2，解锁鲜奶蛋羹' },
  fishing_hut: { name: '钓鱼小屋', clue: '河岸栈桥的修复图纸', jobs: ['清理栈桥', '修补小屋屋顶'], coins: 180, wood: 4, stone: 2, benefit: '开放池塘、鱼类手账与鱼汤配方，附赠普通钓竿 ×1' },
  upstream: { name: '上游步道', clue: '溪流岔口的水域勘测记录', jobs: ['清开沿岸灌木', '铺设上游石阶'], coins: 300, wood: 3, stone: 5, requires: 'fishing_hut', benefit: '开放溪流上游、鳟鱼与烤鱼配方' },
  stall: { name: '溪畔小摊', clue: '旧集市的摊位图纸', jobs: ['整修木柜', '搭好遮雨棚'], coins: 220, wood: 5, stone: 2, benefit: '开放摆摊，6 格货架、每格最多 20 份；客人每隔 5–20 分钟随机到访' },
};
export const facilityAvailable = (pet: PetState, id: FacilityId) => {
  if (pet.community.facilities[id].built) return true;
  if (!pet.adventure.valleyCompleted.includes(facilityStories[id].id)) return false;
  const required = facilities[id].requires;
  if (id === 'stall') return pet.community.gardenBuilt || pet.community.facilities.fishing_hut.built;
  return !required || (required === 'garden' ? pet.community.gardenBuilt : pet.community.facilities[required].built);
};
export const animals: Record<AnimalId, { item: 'egg' | 'farm_milk'; name: string; hours: number }> = {
  coop: { item: 'egg', name: '鸡蛋', hours: 6 }, barn: { item: 'farm_milk', name: '牧场鲜奶', hours: 8 },
};
// `rare` retains the old collection flag; edible rare fish use rarity without becoming collectibles.
export const fish: Record<FishId, { name: string; water: WaterId; base: number; rare: boolean; rarity: FoodRarity; length: number; weight: number }> = {
  pond_crucian: { name: '池塘鲫鱼', water: 'pond', base: 12, rare: false, rarity: 'common', length: 18, weight: 44 },
  pond_carp: { name: '青背鲤鱼', water: 'pond', base: 16, rare: false, rarity: 'common', length: 28, weight: 32 },
  wheat_fish: { name: '麦穗鱼', water: 'pond', base: 10, rare: false, rarity: 'common', length: 8, weight: 19 },
  golden_koi: { name: '金纹锦鲤', water: 'pond', base: 65, rare: true, rarity: 'rare', length: 36, weight: 5 },
  stream_trout: { name: '溪流鳟鱼', water: 'upstream', base: 22, rare: false, rarity: 'fine', length: 25, weight: 38 },
  river_perch: { name: '岩岸鲈鱼', water: 'upstream', base: 26, rare: false, rarity: 'fine', length: 32, weight: 32 },
  stream_grouper: { name: '溪石斑', water: 'upstream', base: 24, rare: false, rarity: 'fine', length: 20, weight: 18 },
  redtail_barbel: { name: '赤尾溪鲃', water: 'upstream', base: 38, rare: false, rarity: 'rare', length: 28, weight: 8 },
  silver_grayling: { name: '银鳍茴鱼', water: 'upstream', base: 90, rare: true, rarity: 'epic', length: 40, weight: 4 },
  striped_catfish: { name: '斑纹鲶鱼', water: 'forest_pool', base: 20, rare: false, rarity: 'common', length: 34, weight: 45 },
  moss_bream: { name: '苔背鳊鱼', water: 'forest_pool', base: 28, rare: false, rarity: 'fine', length: 30, weight: 35 },
  glass_eel: { name: '玻璃鳗', water: 'forest_pool', base: 46, rare: false, rarity: 'rare', length: 38, weight: 16 },
  moon_carp: { name: '月影鲤', water: 'forest_pool', base: 110, rare: true, rarity: 'epic', length: 42, weight: 4 },
  silver_sardine: { name: '银鳞沙丁鱼', water: 'coast_pier', base: 18, rare: false, rarity: 'common', length: 16, weight: 45 },
  blue_mackerel: { name: '青花鲭鱼', water: 'coast_pier', base: 28, rare: false, rarity: 'fine', length: 28, weight: 30 },
  bluefin_bream: { name: '蓝鳍鲷', water: 'coast_pier', base: 48, rare: false, rarity: 'rare', length: 35, weight: 19 },
  sunset_butterflyfish: { name: '霞光蝶鱼', water: 'coast_pier', base: 120, rare: true, rarity: 'epic', length: 20, weight: 5 },
  star_ray: { name: '星潮鳐', water: 'coast_pier', base: 200, rare: true, rarity: 'legendary', length: 70, weight: 1 },
};
export const facilityStories: Record<FacilityId, { id: ValleyQuestId; name: string }> = {
  coop: { id: 'valley_ridge', name: '坡道上的旧农舍' }, barn: { id: 'valley_ridge', name: '坡道上的旧农舍' },
  fishing_hut: { id: 'valley_crossing', name: '旧桥那边的来信' }, upstream: { id: 'valley_lookout', name: '风声里的上游' },
  stall: { id: 'valley_story', name: '温室里未完的约定' },
};
export const getFacilityBuildReason = (pet: PetState, id: FacilityId) => {
  if (pet.community.facilities[id].built) return '';
  const story = facilityStories[id];
  if (!pet.adventure.valleyCompleted.includes(story.id)) return `先完成溪谷故事「${story.name}」。`;
  if (!facilityAvailable(pet, id)) return id === 'stall' ? '先开放菜地或钓鱼小屋。' : id === 'barn' ? '先开放鸡舍。' : id === 'upstream' ? '先开放钓鱼小屋。' : '先完成新手踩点并结算，免费开放菜地。';
  return '';
};
export const fishIds = Object.keys(fish) as FishId[];
export const waters = {
  pond: { name: '小屋池塘', discovery: '修好钓鱼小屋', region: 'valley', coins: 0, wood: 0, stone: 0 },
  upstream: { name: '溪流上游', discovery: '完成溪谷「风声里的上游」，开放钓鱼小屋后交付建材', region: 'hills', coins: 300, wood: 3, stone: 5 },
  forest_pool: { name: '雾松深潭', discovery: '亲自完成林地故事，发现古树后的深潭', region: 'forest', coins: 360, wood: 6, stone: 4 },
  coast_pier: { name: '海岸栈桥', discovery: '亲自完成海岸故事，发现通海旧栈桥', region: 'coast', coins: 420, wood: 8, stone: 5 },
} as const;
export const waterIds = Object.keys(waters) as WaterId[];
export const isWaterOpen = (pet: PetState, water: WaterId) => pet.community.facilities.fishing_hut.built &&
  (water === 'pond' || (water === 'upstream' ? pet.community.facilities.upstream.built : pet.community.waterAccess[water]?.built));
export const commissionTemplates: CommissionTemplate[] = ['search', 'forage', 'vegetables', 'eggs', 'milk', 'fish_pond', 'fish_upstream', 'soup', 'fresh_porridge', 'delivery', 'forest_delicacy', 'tea_order', 'valley_basket', 'valley_rice'];
import { getEquipmentPurchaseReason } from './fieldEquipmentData';
export const getCommunityPurchaseReason = (pet: PetState, id: string) => {
  const equipmentReason = getEquipmentPurchaseReason(pet, id);
  if (equipmentReason) return equipmentReason;
  const crop = (Object.keys(communityCrops) as CropId[]).find(key => communityCrops[key].seed === id);
  if (crop) return getCropUnlockReason(pet, crop);
  return id === 'river_bait' && !pet.community.facilities.upstream.built ? '先修好上游步道'
    : id === 'reinforced_rod' && !pet.community.facilities.fishing_hut.built ? '先开放钓鱼小屋' : '';
};
