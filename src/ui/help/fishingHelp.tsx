import { fishingIntervalMs, getFishingClicks } from '../../core/fishingRules';
import { fishingCatchHearts } from '../../core/activityHearts';
import type { HelpContent } from './HelpButton';
import type { quoteFishingRations } from '../../core/fishingRations';
import { formatInteger } from '../numberFormat';

export const fishingHelp: HelpContent = {
  title: '钓鱼',
  overview: <><h3>水域与配置</h3><p>钓鱼小屋建成后开放池塘；通关溪谷风声观景台后开放上游，通关林地、海岸各自全部 8 个地标后开放对应水域，无需再交建材。已有通关记录会自动补开水域。</p><p>水域、钓竿、鱼饵、浮漂、抄网、钓鱼方式、挂机时长和配餐都会随存档记住；库存不足时会提示补充。</p><h3>手动钓鱼</h3><p>抛竿后等鱼上钩，再轻点收线。普通钓竿需 {getFishingClicks(false)} 次，柔韧竿需 {getFishingClicks(true)} 次；抄网可减少一次，浮漂能缩短等待。</p><p>每竿使用一份鱼饵。手动抛竿扣钓竿及所选附件耐久，挂机钓获时扣钓竿耐久；附件每次使用扣 1 点耐久。</p><p>没有限时和脱钩，关闭窗口保留进度。主动收竿不退已用鱼饵和耐久。</p><h3>挂机钓鱼</h3><p>可安排 2、4、8 小时，每 {fishingIntervalMs / 60000} 分钟收获一条鱼。需要食物、鱼饵和足够的钓竿耐久，离线也会结算。</p><p>提前返回会先吃剩余食物，吃不完分给邻居；食物和补给费不退，未用鱼饵保留待领。</p><h3>鱼饵与金冠</h3><p>普通鱼饵适合收集料理鱼，溪流鱼饵更容易遇到珍稀鱼。超过鱼类手账中的长度门槛，可永久点亮金冠；烹饪或出售不会清除记录。</p><p>钓鱼小屋建成赠送一根普通钓竿，并开放柔韧竿购买；溪流上游开放后可购买溪流鱼饵。</p></>,
  details: <><p>手动和挂机每条鱼都额外给 {fishingCatchHearts} 颗小心心，随鱼获领取。满仓时剩余鱼获和对应心心保留，退回的鱼饵不发心心。</p><p>手动和挂机共用鱼池与金冠规则。总竿数第 1、4、7……竿使用普通鱼饵时，固定遇到当前水域的基础料理鱼。</p><p>其余钓获按当前水域鱼类权重抽取；溪流鱼饵将珍稀、史诗和传说鱼的权重提高到原来的 250%，再按总权重分配概率。</p><p>金冠独立判定，概率 10%。浮漂先将基础等待缩短 2 秒，再叠加装饰效果；抄网减少一次收线，最低两次。附件仅用于手动钓鱼。</p></>,
};
export const getFishingHelp = (food?: ReturnType<typeof quoteFishingRations>): HelpContent => food ? {
  ...fishingHelp,
  overview: <>{fishingHelp.overview}<h3>本次挂机配餐</h3><p>至少 {food.minimum} 份食物、{food.nutrition} 点基础饱食，最多 {food.maximum} 份。当前 {food.count} 份、{formatInteger(food.hunger)} 点基础饱食。</p></>,
} : fishingHelp;
