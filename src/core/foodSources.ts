import { landmarkNames, mapRegionForExpedition } from './landmarkProgress';
import { communityCrops, wildIngredients } from './foodCatalog';
import { regions } from './expeditionData';
import { fish, waters } from './communityData';
export const getFoodSource = (id: string) => {
  const wild = Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  if (wild) return `${regions[wild.region].name}／${landmarkNames[mapRegionForExpedition[wild.region]].gather}手动${wild.investigations === 3 ? '调查：累计 3 次得 1 份，每次另得地区主产物 1 份' : `采集：每次 ${id === 'bamboo_shoot' ? 5 : wild.yield} 份`}；全地区共用采集机会，每 3 小时恢复 1 次、最多 24 次`;
  const f = Object.prototype.hasOwnProperty.call(fish, id) ? fish[id as keyof typeof fish] : undefined;
  if (f) return `钓鱼小屋 → ${waters[f.water].name}`;
  const crop = Object.values(communityCrops).find(c => c.product === id);
  if (crop) return `菜地种植：${crop.hours} 小时收获 ${crop.yield} 份${crop.seedPrice ? `，种子原价 ${crop.seedPrice} 金币` : ''}`;
  if (['cream', 'cheese', 'forest_berry_jam', 'cooking_oil'].includes(id)) return '厨房加工台批量制作';
  if (id === 'farm_milk') return '初始商店 18 金币，或牛棚生产';
  if (id === 'ad_milk' || id === 'strawberry_milk') return '商店、牛棚开放后的加工台，或每日牧场心意任选';
  return '';
};
