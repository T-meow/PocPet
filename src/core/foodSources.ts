import { landmarkNames, mapRegionForExpedition } from './landmarkProgress';
import { communityCrops, getExplorationFoodYield, wildIngredients } from './foodCatalog';
import { regionIds, regions } from './expeditionData';
import { fish, waters } from './communityData';
import { getExplorationResources } from './explorationResources';
export const getFoodSource = (id: string) => {
  const wild = Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  const crop = Object.values(communityCrops).find(c => c.product === id);
  const sourceRegions = wild ? [wild.region] : getExplorationFoodYield(id) !== undefined
    ? regionIds.filter(key => regions[key].product === id || regions[key].alternative === id || key === 'valley' && id === 'creek_herb') : [];
  const sources = sourceRegions.flatMap(region => {
    const resource = getExplorationResources(region).find(entry => entry.id === id);
    return resource ? [`${regions[region].name}／${landmarkNames[mapRegionForExpedition[region]].gather}手动${resource.research ? `研究：累计 ${wild!.investigations} 点得 1 份，放大镜每次 +2 点` : `采集：抽中后基础 ${resource.manual[id] ?? 0} 份，放大镜可定向查找`}；${resource.idle ? `挂机随机抽中后 ${resource.idle[id] ?? 0} 份，定向仅提高比例` : '仅手动获取'}`] : [];
  });
  if (sources.length) return `${sources.join('；')}。采集每小时恢复 1 次，上限 72 次${crop ? `；也可种植，${crop.hours} 小时收获 ${crop.yield} 份` : ''}`;
  const f = Object.prototype.hasOwnProperty.call(fish, id) ? fish[id as keyof typeof fish] : undefined;
  if (f) return `钓鱼小屋 → ${waters[f.water].name}`;
  if (crop) return `菜地种植：${crop.hours} 小时收获 ${crop.yield} 份${crop.seedPrice ? `，种子原价 ${crop.seedPrice} 金币` : ''}`;
  if (['cream', 'cheese', 'forest_berry_jam', 'cooking_oil'].includes(id)) return '厨房加工台批量制作';
  if (id === 'farm_milk') return '初始商店 18 金币，或牛棚生产';
  if (id === 'ad_milk' || id === 'strawberry_milk') return '商店、牛棚开放后的加工台，或每日牧场心意任选';
  return '';
};
