import { fishingIntervalMs, getFishingClicks } from '../../core/fishingRules';
import type { HelpContent } from './HelpButton';
import type { quoteFishingRations } from '../../core/fishingRations';

export const fishingHelp: HelpContent = {
  title: '钓鱼',
  overview: <><h3>手动钓鱼</h3><p>抛竿后等鱼上钩，再轻点收线。普通钓竿需 {getFishingClicks(false)} 次，柔韧竿需 {getFishingClicks(true)} 次；抄网可减少一次，浮漂能缩短等待。</p><p>每竿使用一份鱼饵。手动抛竿扣钓竿及所选附件耐久，挂机钓获时扣钓竿耐久；附件每次使用扣 1 点耐久。</p><p>没有限时和脱钩，关闭窗口保留进度。主动收竿不退已用鱼饵和耐久。</p><h3>挂机钓鱼</h3><p>可安排 2、4、8 小时，每 {fishingIntervalMs / 60000} 分钟收获一条鱼。需要食物、鱼饵和足够的钓竿耐久，离线也会结算。</p><p>提前返回会先吃剩余食物，吃不完分给邻居；食物和补给费不退，未用鱼饵保留待领。</p><h3>鱼饵与金冠</h3><p>普通鱼饵适合收集料理鱼，溪流鱼饵更容易遇到珍稀鱼。超过鱼类手账中的长度门槛，可永久点亮金冠；烹饪或出售不会清除记录。</p><p>钓鱼小屋建成赠送一根普通钓竿，并开放柔韧竿购买；上游步道建成后可购买溪流鱼饵。</p></>,
  details: <><p>手动和挂机共用鱼池与金冠规则。总竿数第 1、4、7……竿使用普通鱼饵时，固定遇到当前水域的基础料理鱼。</p><p>其余钓获按当前水域鱼类权重抽取；溪流鱼饵将珍稀、史诗和传说鱼的权重乘以 2.5，再按总权重分配概率。</p><p>金冠独立判定，概率 10%。浮漂先将基础等待缩短 2 秒，再叠加装饰效果；抄网减少一次收线，最低两次。附件仅用于手动钓鱼。</p></>,
};
export const getFishingHelp = (food?: ReturnType<typeof quoteFishingRations>): HelpContent => food ? {
  ...fishingHelp,
  overview: <>{fishingHelp.overview}<h3>本次挂机配餐</h3><p>至少 {food.minimum} 份食物、{food.nutrition} 点基础饱食，最多 {food.maximum} 份。当前 {food.count} 份、{food.hunger} 点基础饱食。</p></>,
} : fishingHelp;
