import type { HelpContent } from './HelpButton';
import type { PetState } from '../../core/petTypes';
import type { MilkChoice } from '../../core/companionActivityTypes';
import { getDishId, type RecipeDefinition } from '../../core/kitchenRecipes';
import { getMarketQuote } from '../../core/communityMarket';
import { getCommunitySale, getCuisineSaleNote, getRecipePricingCost } from '../../core/communityEconomy';
import { getKitchenHeartReward } from '../../core/kitchen';
import { animalNameMaxLength, ranchCompostCycleCount } from '../../core/communityData';
import { farmNeighborCost, farmNeighborDays } from '../../core/farmNeighborState';

const farmNeighborHelp = <p>农场可花 {farmNeighborCost} 心心请邻居帮忙 {farmNeighborDays} 个游戏日，购买当天计第 1 天，每天凌晨 5 点换日。服务期间，伙伴忙碌也能点击种植、照料和收获；每次成功操作随机一位伙伴代劳，批量操作算一次。材料和耐久照常消耗，照料动物不扣伙伴体力。建设升级、清树、回收树苗、厨房加工和钓鱼仍需伙伴空闲；离线和冻结照常计日，冻结时不能操作。</p>;

export const kitchenHelp: HelpContent = {
  title: '厨房',
  overview: <><p>在食谱本选择料理，备齐材料与厨具后设置份数。成品进入共用库存，可以喂给伙伴、交付委托或摆摊。加工台用于磨粉、调奶和制作饲料。</p><p>伙伴空闲时才能制作；厨具的解锁条件与价格显示在厨具页。香草暖粥需要在溪谷溪边采集地完成全部阶段取得香草线索，再到菜地培育原料。</p><p>料理详情列出实际材料、成品效果与心心。不同配料分开存放，奶类替换不改变成品效果；每次制作获得一次经验，批量制作计一次。</p></>,
};

export const getRecipeHelp = (pet: PetState, recipe: RecipeDefinition, banana: boolean, milk: MilkChoice): HelpContent => {
  const dishId = getDishId(recipe, banana), quote = getMarketQuote(pet, dishId);
  const cost = getRecipePricingCost(recipe, banana, milk);
  const saleNote = getCuisineSaleNote(dishId), reward = getKitchenHeartReward(pet, recipe.id, banana, recipe.variantKey);
  return {
    title: '制作料理',
    overview: <><p>备齐食材和厨具，选择份数后一起制作。成品收入背包，可以喂给伙伴、交单或摆摊。</p><p>可替换的奶类成品效果相同，每批只消耗所选奶类，材料数量以清单为准。</p>{recipe.variantKey && <p>这道菜可选择配料。不同配料的成品分开存放，效果、心心和售价以当前选择为准；换配料不重复获得首做经验。</p>}{saleNote && <p>{saleNote}</p>}<p>每次完成制作获得 1 点料理经验，首做额外 5 点；批量制作计一次。</p></>,
    details: <><p>当前配料每份计价成本 {Math.round(cost)} 金币{quote && ' · 基础售价 ' + quote.base + ' · 当前摆摊 ' + quote.price + ' 金币'}。</p><p>材料按商店原价和基础售价的较高者计价，前置料理保留制作收益。{recipe.fixedProcessingProfit === undefined ? '本步按材料计价加 25% 后向上取整。' : `本步固定增加 ${recipe.fixedProcessingProfit} 金币，前序收益不再按比例加价。`}种养等待、钓鱼和采集难度已计入原料售价。两种奶共用成品价格，统一按较高成本定价。</p><p>每份本步基础心心 {reward.baseHearts} · 料理 Lv.{reward.skillLevel} {reward.skillHearts < 0 ? '整链取整调整 ' : '加成 +'}{reward.skillHearts}。整条制作链的心心预算提高 25% 并向上取整，再叠加料理技能加成；升级料理只发与前序料理的差额。{reward.skillHearts < 0 && '前序工序已领取的取整收益会在本步对齐，总奖励不会重复发放。'}</p></>,
  };
};
export const processingHelp: HelpContent = {
  title: '食材加工',
  overview: <><p>选择批次后即时加工，成品收入共用库存。只消耗列出的原料和费用，加工不发料理心心。</p><p>小麦可磨成面粉，收获的奶可以调制成其他奶类、奶油和奶酪。鸡舍建好后，1 份小麦或 1 份甜玉米可免费加工成 4 份谷物饲料；在牧场照料窗口点击「补充饲料」，也能选择购买或按批加工。</p></>,
  get details() { return <p>一轮小麦收获 4 份，可免费磨出面粉 8 份；种子成本 24 金币，平均每份面粉 3 金币。面粉基础售价 {getCommunitySale('flour')!.base} 金币，每批加工在材料计价和费用基础上加 25%，摆摊加成另计。上架后等待客人购买。</p>; },
};
export const getCookingResultHelp = (result: { quantity: number; hearts: number; baseHearts?: number; skillHearts?: number; skillLevel?: number }): HelpContent => ({
  title: '本次料理收获',
  overview: <p>已收好 {result.quantity} 份料理与 {result.hearts} 颗心心，可以留着慢慢分享。</p>,
  details: result.baseHearts !== undefined && result.skillHearts !== undefined ? <p>基础心心 {result.baseHearts} · 料理 Lv.{result.skillLevel} {result.skillHearts < 0 ? '整链取整调整 ' : '+'}{result.skillHearts}{result.hearts > result.baseHearts + result.skillHearts && ' · 其他加成 +' + (result.hearts - result.baseHearts - result.skillHearts)}</p> : undefined,
});
export const fieldHelp: HelpContent = {
  title: '菜地照料',
  overview: <>{farmNeighborHelp}<p>菜地最多扩建至六块，全部显示在同一场景中。点击地块即可播种或照料，点击下一块待扩建地可查看扩建任务。场景下方可以一键收获、选种批量播种，或按各块地上次种植的作物补种；种子不足的地块保留为空地。</p><p>所有收获入口都会自动使用有耐久的精收镰刀，增产 1 份并消耗耐久 1 次。一键收获按地块顺序进行，镰刀用尽后继续普通收获。</p><p>每轮浇水、施肥各一次；成熟后作物一直等待收获。每轮额外获得 3–10 颗小心心，基础周期越长，奖励越多；加速和增产不改变本轮心心。</p><p>香草种子来自溪谷每日首次搜寻和水渠故事首次奖励，各 2 份；林莓种子在林地定向寻找。这两种种子商店不出售。小麦可磨成面粉，也可与甜玉米一样加工成谷物饲料。</p></>,
  details: <><p>浇水缩短基础生长时间的 20%，消耗水壶耐久 1 次；堆肥使本轮增产 1 份，可与镰刀叠加。成熟后不能浇水或施肥。</p><p>增产后的收获必须能全部放入仓库，否则作物留在菜地、不扣镰刀耐久。一键收获继续处理其他地块。</p>{processingHelp.details}</>,
};
export const orchardHelp: HelpContent = {
  title: '果园照料',
  overview: <>{farmNeighborHelp}<p>种下树苗后等待成长，浇水和施肥可以提前收获；操作按钮显示本次实际节省的时间。每轮成功收获额外获得 10 颗小心心，与果实或金币一同领取。</p><p>普通树每轮选择一种肥料。高级树可以多份施肥，每块地有每日限制；营养液每轮只能使用一次。</p></>,
  details: <><p>普通树的普通肥减时 30%，升级后 35%／40%，有机会多收 1 件普通产物；爱心肥减时 40%，升级后 45%／50%，保底多 1 件普通产物并提高稀有权重。</p><p>高级树每份普通肥减时 1%、爱心肥减时 2%；每天合计最多减少基础周期的 10%，且不超过 6 小时。</p><p>营养液使摇钱树本轮基础金币增加 25%；金苹果树多收获 1 个苹果，其中 50% 为金苹果。</p><p>每次成功浇水、施肥或收获可增加园艺经验，满级后停止获得经验。</p></>,
};
export const animalHelp: HelpContent = {
  title: '动物照料',
  overview: <>{farmNeighborHelp}<p>食槽有饲料时持续生产，离线也会结算；缺料或存满时暂停，动物不会离开。可以一次添满食槽，库存不足时添入现有的全部饲料。</p><p>在场景或照料窗口可以给鸡群、奶牛起名，最多 {animalNameMaxLength} 个字符；改名不消耗资源，留空保存恢复默认称呼。</p><p>每轮可以照料一次。牛棚开放后，当天在鸡舍或牛棚完成照料和收获各一次，可以领取一瓶奶，每日一次。</p></>,
  details: <><p>每轮产出 2 份，消耗饲料 1 份；收获时鸡舍每轮另给 6 心心，牛棚每轮 8 心心，积存多轮一起领取也会累加。自行照料消耗体力 2 点，邻居代劳期间不扣体力，让本轮提前基础周期的 10% 完成；园艺满级后生产周期缩短 8%。装饰加成从下一生产周期开始生效，加速不减少每轮心心。</p><p>1 份小麦或甜玉米可免费加工成 4 份谷物饲料。鸡舍和牛棚合计每完成 {ranchCompostCycleCount} 轮生产，产出 1 份营养堆肥，离线也会累计。收获蛋奶时自动领取；仓库放不下的部分保留在牧场，可在照料窗口补领。</p></>,
};
