import type { Inventory } from './petTypes';
export const valleyGatherTargets = ['valley_mushroom', 'bamboo_shoot', 'lotus_seed', 'creek_herb', 'materials', 'aquamarine'] as const;
export type ValleyGatherTarget = typeof valleyGatherTargets[number];
export type ValleyTravelStyle = 'patrol' | 'short' | 'walk';
export const valleyGatherNames: Record<ValleyGatherTarget, string> = { valley_mushroom: '溪谷野菇', bamboo_shoot: '嫩笋', lotus_seed: '莲子', creek_herb: '野香草', materials: '木料与石料', aquamarine: '溪光海蓝宝' };
export const valleyGatherFinds = (target: ValleyGatherTarget, idle = false): Inventory => {
  if (target === 'materials') return { community_wood: idle ? 3 : 4, community_stone: idle ? 2 : 3 };
  if (target === 'aquamarine') return {};
  return { [target]: ({ valley_mushroom: idle ? 2 : 3, bamboo_shoot: idle ? 3 : 5, lotus_seed: idle ? 1 : 2, creek_herb: idle ? 3 : 4 })[target] };
};
export const valleyPatrolNodes = [
  ['渠口路标', '看看水位刻痕', '辨认岸边的脚印'], ['溪岸采集', '走进向阳的菇丛', '绕到背阴的竹林'],
  ['坡上旧农舍', '读读门边的信', '看看留下的农具'], ['浅滩采集', '沿清浅的水边寻找', '沿石阶寻找岩缝'],
  ['温室手账', '翻到守园人的一页', '添上伙伴的见闻'], ['归途灯火', '从木桥返回', '沿河岸返回'],
] as const;
export const valleyPatrolHunger = [4, 6, 4, 6, 6, 4];
export const valleyPatrolEnergy = [3, 6, 3, 6, 3, 3];
