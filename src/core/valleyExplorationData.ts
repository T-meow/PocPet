import type { Inventory } from './petTypes';
export const valleyGatherTargets = ['valley_mushroom', 'bamboo_shoot', 'lotus_seed', 'creek_herb', 'materials', 'aquamarine'] as const;
export type ValleyGatherTarget = typeof valleyGatherTargets[number];
export const valleyGatherNames: Record<ValleyGatherTarget, string> = { valley_mushroom: '溪谷野菇', bamboo_shoot: '嫩笋', lotus_seed: '莲子', creek_herb: '野香草', materials: '木料与石料', aquamarine: '溪光海蓝宝' };
export const valleyGatherFinds = (target: ValleyGatherTarget, idle = false): Inventory => {
  if (target === 'materials') return { community_wood: idle ? 3 : 4, community_stone: idle ? 2 : 3 };
  if (target === 'aquamarine') return {};
  return { [target]: ({ valley_mushroom: idle ? 2 : 3, bamboo_shoot: idle ? 3 : 5, lotus_seed: idle ? 1 : 2, creek_herb: idle ? 3 : 4 })[target] };
};
export const valleyObservationNames = [
  ['入口方位', '辨认回程方向', '从高处对照溪流'], ['水位与脚印', '记录路牌刻痕', '追寻岸边脚印'],
  ['岸边物产', '查看向阳菇丛', '调查背阴岩缝'], ['浅滩通路', '沿稳固河岸绕行', '检查近处落脚点'],
  ['整理手册', '逐项核对发现', '和伙伴交换观察'], ['入口归途', '画出两条支路', '复述入口的经历'],
] as const;
