import { communityCrops, wildIngredients } from '../core/foodCatalog';
import { fish, waters } from '../core/communityData';
import { regions } from '../core/expeditionData';
import { getDish } from '../core/kitchenRecipes';

export const getItemSourceLabel = (id: string): string => {
  const wild = Object.prototype.hasOwnProperty.call(wildIngredients, id) ? wildIngredients[id as keyof typeof wildIngredients] : undefined;
  if (wild) return regions[wild.region].name + (wild.investigations > 1 ? '调查' : '采集');
  const catchable = Object.prototype.hasOwnProperty.call(fish, id) ? fish[id as keyof typeof fish] : undefined;
  if (catchable) return waters[catchable.water].name + '钓鱼';
  if (Object.values(communityCrops).some(crop => crop.product === id)) return '菜地种植';
  if (['cream', 'cheese', 'forest_berry_jam', 'cooking_oil', 'flour'].includes(id)) return '厨房加工台';
  if (getDish(id)) return '厨房制作';
  if (id === 'egg') return '商店 / 鸡舍';
  if (id === 'farm_milk') return '商店 / 牛棚';
  if (id === 'ad_milk' || id === 'strawberry_milk') return '商店 / 加工台 / 牧场心意';
  return '商店';
};
