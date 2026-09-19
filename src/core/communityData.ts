import type { AnimalId, CommissionTemplate, FacilityId, FishId, WaterId } from './communityTypes';
import type { PetState } from './petTypes';

export const facilityIds: FacilityId[] = ['coop', 'barn', 'fishing_hut', 'upstream', 'stall'];
export const facilities: Record<FacilityId, { name: string; clue: string; jobs: [string, string]; coins: number; wood: number; stone: number; requires?: FacilityId | 'garden'; benefit: string }> = {
  coop: { name: '鸡舍', clue: '旧农舍的饲喂装置', jobs: ['清理鸡舍', '安装饲喂槽'], coins: 240, wood: 5, stone: 2, requires: 'garden', benefit: '每份饲料 6 小时产鸡蛋 ×2，最多存 6 份' },
  barn: { name: '牛棚', clue: '牧道旁的饮水设备', jobs: ['铺好干草垫', '修好饮水槽'], coins: 420, wood: 7, stone: 4, requires: 'coop', benefit: '每份饲料 8 小时产鲜奶 ×2，解锁鲜奶蛋羹' },
  fishing_hut: { name: '钓鱼小屋', clue: '河岸栈桥的修复图纸', jobs: ['清理栈桥', '修补小屋屋顶'], coins: 180, wood: 4, stone: 2, benefit: '开放池塘、鱼类手账与鱼汤配方，附赠普通钓竿 ×1' },
  upstream: { name: '上游步道', clue: '溪流岔口的水域勘测记录', jobs: ['清开沿岸灌木', '铺设上游石阶'], coins: 300, wood: 3, stone: 5, requires: 'fishing_hut', benefit: '开放溪流上游、鳟鱼与烤鱼配方' },
  stall: { name: '溪畔小摊', clue: '旧集市的摊位图纸', jobs: ['整修木柜', '搭好遮雨棚'], coins: 220, wood: 5, stone: 2, benefit: '开放摆摊，6 格货架、每 30 分钟一位客人' },
};
export const facilityAvailable = (pet: PetState, id: FacilityId) => {
  const required = facilities[id].requires;
  if (id === 'stall') return pet.community.gardenBuilt || pet.community.facilities.fishing_hut.built;
  return !required || (required === 'garden' ? pet.community.gardenBuilt : pet.community.facilities[required].built);
};
export const animals: Record<AnimalId, { item: 'egg' | 'farm_milk'; name: string; hours: number }> = {
  coop: { item: 'egg', name: '鸡蛋', hours: 6 }, barn: { item: 'farm_milk', name: '牧场鲜奶', hours: 8 },
};
export const fishIds: FishId[] = ['pond_crucian', 'pond_carp', 'golden_koi', 'stream_trout', 'river_perch', 'silver_grayling'];
export const fish: Record<FishId, { name: string; water: WaterId; base: number; rare: boolean; length: number }> = {
  pond_crucian: { name: '池塘鲫鱼', water: 'pond', base: 12, rare: false, length: 18 },
  pond_carp: { name: '青背鲤鱼', water: 'pond', base: 16, rare: false, length: 28 },
  golden_koi: { name: '金纹锦鲤', water: 'pond', base: 65, rare: true, length: 36 },
  stream_trout: { name: '溪流鳟鱼', water: 'upstream', base: 22, rare: false, length: 25 },
  river_perch: { name: '岩岸鲈鱼', water: 'upstream', base: 26, rare: false, length: 32 },
  silver_grayling: { name: '银鳍茴鱼', water: 'upstream', base: 90, rare: true, length: 40 },
};
export const commissionTemplates: CommissionTemplate[] = ['search', 'forage', 'vegetables', 'eggs', 'milk', 'fish_pond', 'fish_upstream', 'soup', 'fresh_porridge', 'delivery'];
export const getCommunityPurchaseReason = (pet: PetState, id: string) => id === 'river_bait' && !pet.community.facilities.upstream.built ? '先修好上游步道'
  : id === 'reinforced_rod' && !pet.community.facilities.fishing_hut.built ? '先开放钓鱼小屋' : '';
