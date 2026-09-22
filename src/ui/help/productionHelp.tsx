import type { HelpContent } from './HelpButton';
import type { PetState } from '../../core/petTypes';
import type { MilkChoice } from '../../core/companionActivityTypes';
import { getDishId, getIngredientReferenceCost, getRecipeMaterialCost, type RecipeDefinition } from '../../core/kitchenRecipes';
import { getMarketQuote } from '../../core/communityMarket';
import { getCuisineSaleNote } from '../../core/communityEconomy';
import { getKitchenHeartReward } from '../../core/kitchen';

export const getRecipeHelp = (pet: PetState, recipe: RecipeDefinition, banana: boolean, milk: MilkChoice): HelpContent => {
  const dishId = getDishId(recipe, banana), quote = getMarketQuote(pet, dishId);
  const cost = getRecipeMaterialCost(recipe, banana, getIngredientReferenceCost, milk);
  const saleNote = getCuisineSaleNote(dishId), reward = getKitchenHeartReward(pet, recipe.id, banana);
  return {
    title: '制作料理',
    overview: <><p>备齐食材和厨具，选择份数后一起制作。成品收入背包，可以喂给伙伴、交单或摆摊。</p><p>可替换的奶类成品效果相同，每批只消耗所选奶类，材料数量以清单为准。</p>{saleNote && <p>{saleNote}</p>}<p>每次完成制作获得 1 点料理经验，首做额外 5 点；批量制作计一次。</p></>,
    details: <><p>每份材料参考成本 {Number(cost.toFixed(1))} 金币{quote && ' · 回收 ' + quote.base + ' · 当前摆摊 ' + quote.price + ' 金币'}。</p><p>成本按商店原价、作物种子成本和野生食材回收价值计算；加工材料包含原料，奶类按当前选择估算。</p><p>每份本步基础心心 {reward.baseHearts} · 料理 Lv.{reward.skillLevel} 加成 +{reward.skillHearts}。制作心心仅受料理技能加成，并扣除前序料理已发出的奖励。</p></>,
  };
};
export const processingHelp: HelpContent = {
  title: '食材加工',
  overview: <><p>选择批次后即时加工，成品收入共用库存。只消耗列出的原料和费用，加工不发料理心心。</p><p>小麦可磨成面粉，收获的奶可以调制成其他奶类、奶油和奶酪。</p></>,
  details: <p>一轮小麦收获 4 份，可免费磨出面粉 8 份；种子成本 24 金币，平均每份面粉 3 金币。面粉商店原价 10、七折 7 金币；这一轮回收共 32 金币，扣除种子成本余 8 金币。</p>,
};
export const getCookingResultHelp = (result: { quantity: number; hearts: number; baseHearts?: number; skillHearts?: number; skillLevel?: number }): HelpContent => ({
  title: '本次料理收获',
  overview: <p>已收好 {result.quantity} 份料理与 {result.hearts} 颗心心，可以留着慢慢分享。</p>,
  details: result.baseHearts !== undefined && result.skillHearts !== undefined ? <p>基础心心 {result.baseHearts} · 料理 Lv.{result.skillLevel} +{result.skillHearts}{result.hearts > result.baseHearts + result.skillHearts && ' · 其他加成 +' + (result.hearts - result.baseHearts - result.skillHearts)}</p> : undefined,
});
export const fieldHelp: HelpContent = {
  title: '菜地照料',
  overview: <><p>每块菜地独立播种和照料。每轮浇水、施肥各一次；成熟后作物会一直等待收获。</p><p>香草种子来自溪谷每日首次搜寻和水渠故事首次奖励，各 2 份。林莓种子在林地定向寻找，每次 2 份，消耗采集机会；这两种种子商店不出售。</p><p>香草和大米可以煮暖粥，小麦可在厨房加工台磨成面粉。</p></>,
  details: <><p>浇水缩短作物基础生长时间的 20%，消耗水壶耐久 1 次。堆肥使本轮收获增加 1 份，精细收割再增加 1 份，可叠加。</p><p>成熟后不扣浇水耐久；仓库放不下时不扣收割耐久。</p>{processingHelp.details}</>,
};
export const orchardHelp: HelpContent = {
  title: '果园照料',
  overview: <><p>种下树苗后等待成长，浇水和施肥可以提前收获；操作按钮显示本次实际节省的时间。</p><p>普通树每轮选择一种肥料。高级树可以多份施肥，每块地有每日限制；营养液每轮只能使用一次。</p></>,
  details: <><p>普通树的普通肥减时 30%，升级后 35%／40%，有机会多收 1 件普通产物；爱心肥减时 40%，升级后 45%／50%，保底多 1 件普通产物并提高稀有权重。</p><p>高级树每份普通肥减时 1%、爱心肥减时 2%；每天合计最多减少基础周期的 10%，且不超过 6 小时。</p><p>营养液使摇钱树本轮基础金币增加 25%；金苹果树多收获 1 个苹果，其中 50% 为金苹果。</p><p>每次成功浇水、施肥或收获可增加园艺经验，满级后停止获得经验。</p></>,
};
export const animalHelp: HelpContent = {
  title: '动物照料',
  overview: <><p>食槽有饲料时持续生产，离线也会结算；缺料或存满时暂停，动物不会离开。</p><p>每轮可以照料一次。牛棚开放后，当天在鸡舍或牛棚完成照料和收获各一次，可以领取一瓶奶，每日一次。</p></>,
  details: <p>每轮产出 2 份，消耗饲料 1 份。照料消耗体力 2 点，让本轮提前基础周期的 10% 完成；园艺满级后生产周期缩短 8%。装饰加成从下一生产周期开始生效。</p>,
};
