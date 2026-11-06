import type { HelpContent } from './HelpButton';
import type { PetState } from '../../core/petTypes';
import { explorationSkillNames, getExplorationMoodEffects } from '../../core/explorationChecks';
import { getPetStatRatio } from '../../core/petStats';
import { explorationCapacity, explorationRefillMs, getExplorationBudget, getExplorationTier, getExplorationHarvestPay, manualTreasureChance, getExplorationRefillMs, commonLootPityLimit } from '../../core/explorationBudget';
import { formatInteger as number, formatMultiplierPercent, formatProbabilityPercent } from '../numberFormat';
import { commonTreasureDistributionText } from '../../core/adventureItems';

export const gatheringCompanionHelp: HelpContent = {
  title: '同行与加倍采集',
  overview: <><p>有采集点的手动探索可在出发时选择 1／3／6／9 倍。1 倍免费；3／6／9 倍每趟分别支付 20／50／80 小心心，随机一位伙伴同行，商店与送货全程可用。出发成功后扣费，本趟倍率固定，提前返程不退费。</p><p>每次采集最多消耗所选倍率的机会；余量不足时使用全部剩余次数，零次时可以离开采集点。体力、饱食、耐久和技能经验按一次行动计算，物产、采集金币、心心与研究进度按实际次数结算。</p></>,
  details: <><p>普通采集的目标与行动结果仍只判定一次；镰刀增产也计入倍率。研究进度先累计，再按跨过的完整调查周期发奖。随机宝物、保底与装饰额外掉落分别按实际消耗次数计算。</p><p>剧情只推进一步，首通及任务奖励不加倍；新手踩点与纯剧情回访不提供付费同行。商店报价、库存与送货额度照常，待拾取物资未整理完也能访问同行服务。</p></>,
};

export const explorationHelp: HelpContent = {
  title: '探索与行动',
  overview: <><p>行动前列出预计消耗，完成后显示实际收获。沿路标稳妥前进也能完成故事，危险路线可能受伤。</p><p>采集阶段可以「采集」或「离开采集点」；仓库有可用镰刀或手镐时，增加对应采集方式。离开只消耗普通推进所需的饱食和体力，不扣采集机会或工具耐久。</p><p>技能、心情和工具影响表现。工具直接读取仓库，不占行囊；途中可使用行囊补给或免费返回，健康过低时会安全返程。</p></>,
  details: <><p>普通采集随机选择当地物产；镰刀稳定取得基础产量、主产物额外 +1，并减免 25% 体力。放大镜可定向选择食材、材料或种子，基础研究进度 +2；手镐的基础珍宝研究进度 +2。使用工具每次消耗 1 点耐久，实际采集次数以按钮为准。</p><p>随机结果由行程与阶段固定，读档不会重新抽取。绳子保证对应越障健康无损，基础体力减免 50%、饥饿减免 20%。</p><p>对应技能每级减免体力 4%、饥饿 2%。工具、技能、营地和餐食按乘法叠加，体力减免上限 70%、饥饿减免上限 40%，心情另算，最终统一取整。</p></>,
};
export const getExplorationPreparationHelp = (pet: PetState): HelpContent => ({
  ...explorationHelp,
  details: <>{explorationHelp.details}<p>{Object.entries(explorationSkillNames).map(([id, label]) => label + ' ' + pet.partnerSchedule.skills[id as keyof typeof explorationSkillNames].level + ' 级').join(' · ')}</p><p>当前心情 {number(getPetStatRatio(pet, 'mood') * 100)}% · 心情修正后的体力消耗为 {formatMultiplierPercent(getExplorationMoodEffects(getPetStatRatio(pet, 'mood')).energy)}</p></>,
});
export const backpackHelp: HelpContent = {
  title: '旅行背包',
  overview: <><p>从仓库的食物、护理分类选择物品装入背包，出发时才扣除库存。整备时也可以直接使用家中物品。</p><p>手动背包按物品份数计容量，可在「营地与成长」永久扩容至 24／36／48／72／100 份。伙伴委托的收获不占旅行背包，全部保留待领。</p><p>工具直接读取仓库，无需装入背包；使用时消耗耐久，用尽扣除一件。多出的发现保留待处理，可部分收取、使用、兑换珍宝或确认丢弃。返程收获支持部分领取，仓库放不下的物品继续待领。</p></>,
  details: <><p>扩容依次需要：600 金币、木料 8、石料 4、溪光海蓝宝 ×1；1800 金币、木料 16、石料 10、风丘日光石 ×1；4200 金币、木料 24、石料 16、雾松祖母绿或月潮珍珠 ×1。</p><p>最终100份扩容需要完成五区故事，交付8000金币、木料32、石料24、五区珍宝各1、溪谷野菇／蜂蜜／林莓／海藻／观测零件各8，以及松香树脂8、潮汐海玻璃8。升级前需结束行程并收好回执。</p></>,
};
export const campHelp: HelpContent = {
  title: '营具与休整',
  overview: <><p>营具仅在完成路线一半阶段后可用一次：6／8／10／12 阶段分别在完成第 3／4／5／6 阶段后，教学路线在完成第 2 阶段后。继续前进便错过本趟休整点。</p><p>抵达休整点、尚未休整、有可用营具且确有状态可恢复时，才显示「营具休整」。点击查看恢复预览，确认后消耗 1 点耐久；体力和健康只补回本趟尚未恢复的损耗。</p></>,
  details: <p>最多恢复体力上限的 25%、心情上限的 20%，以及 3 点健康；本次实际恢复量以操作处预览为准。</p>,
};
export const rescueHelp: HelpContent = {
  title: '邻居救援',
  overview: <><p>饱食或体力不高于各自上限的 30% 时显示救援；若所有普通推进选项都因饱食或体力不足而无法执行，也会提前显示。单纯没有食物、心情低或健康低不会触发入口。</p><p>花费 100 心心直接恢复饱食、体力和心情，不占背包，不推进阶段。点击入口先看恢复量和费用，再确认接收补给；健康过低触发安全返程时不可救援。</p></>,
};
export const neighborHelp: HelpContent = {
  title: '前哨伙伴与途中商店',
  overview: <><p>前哨邻居每天轮换，最多 3 位；点击可打开聊天与素材委托窗口。外出的邻居保留委托状态，不会立即换来新的访客。普通 1 倍探索通常每趟约 67% 偶遇伙伴；溪谷首次教学偶遇保留，新手踩点无商店。</p><p>普通偶遇需完成越障、整理待拾取物资后使用商店，行程结束时关闭。付费 3／6／9 倍同行从出发至返程全程开放，待拾取物资不阻挡服务。</p><p>伙伴商店本趟售完不补；仓库送货每份 2 心心，受行囊空位和原送货额度限制。</p></>,
  details: <p>伙伴与库存由出发行程固定，重新打开或读档不会重抽、补货。其他地区的偶遇从新出发行程生效，已有行程保留原来的伙伴和库存。</p>,
};
export const commonTreasureRules = <p>每次实际采集分别结算固定货币、目标物品和随机宝物。通用宝物的总掉落率按加权均价计算，最低 15%、最高 75%；命中后按{commonTreasureDistributionText()}分配。连续 {commonLootPityLimit - 1} 次未掉落，第 {commonLootPityLimit} 次保底，各地图共用计数，跨日保留。它们的兑换价值与固定金币分开展示，与当地珍宝独立计算。</p>;
export const manualTreasureRules = <p>手动每次实际消耗采集机会，独立以 {manualTreasureChance}% 概率发现当地珍宝。与手镐研究、伙伴委托的额外珍宝分别计算；免费观察不产生采集奖励。</p>;
export const getBudgetHelp = (pet: PetState): HelpContent => {
  const loop = getExplorationBudget(pet), tier = getExplorationTier(pet);
  const minutes = loop ? Math.max(0, Math.ceil((loop.refillAt + getExplorationRefillMs(loop) - Date.now()) / 60000)) : 60;
  return {
    title: '采集机会与酬谢',
    overview: <><p>每 {explorationRefillMs / 3600000} 小时恢复 1 次，最多储存 {explorationCapacity} 次，相当于 {explorationCapacity * explorationRefillMs / 86400000} 天。当前可用 {loop?.available ?? 0} 次；{(loop?.available ?? 0) >= explorationCapacity ? '已存满。' : `${minutes} 分钟后恢复。`}</p><p>当前第 {tier} 档：溪谷每次采集 {getExplorationHarvestPay(pet, 'manual', 'valley').coins} 金币。每次基础给 5 心心，随角色成长增加，当前为 {getExplorationHarvestPay(pet, 'manual', 'valley').hearts} 心心；消耗机会即有酬谢。</p><p>{tier === 1 ? '完成溪谷全部地标并修好营地后提升至第二档。' : tier === 2 ? `营地升至 2 级、累计采集 ${loop?.used ?? 0}/80 次并制作溪光水景后提升至第三档。` : '已达到第三档。'}</p></>,
    details: <><p>三档基础金币为 20／40／80；地区倍率依次为 100%／125%／150%／175%／220%。首次完成奖励另算。</p>{commonTreasureRules}{manualTreasureRules}<p>次数跨日保留，离线按同一速度恢复，冻结时间暂停恢复。多倍收集按实际消耗次数结算；伙伴委托不消耗采集次数。</p></>,
  };
};
export const commissionHelp: HelpContent = {
  title: '伙伴素材委托',
  overview: <><p>每单 1 个金苹果，选择已解锁地区。基础耗时 2 小时，普通素材基础售价合计至少 1776 金币。不消耗体力、料理或采集次数，不占旅行背包。</p><p>每位伙伴一单，共最多 3 单（含待领取）。离线继续计时，冻结时暂停；满仓保留剩余收获，领完可再次委托。不支持提前取消、加速或自动续单。</p></>,
  details: <><p>每单独立以 {formatProbabilityPercent(0.5)} 的基础概率额外带回当地珍宝 1 件，无保底，不抵扣普通素材保底价值。</p><p>营地 1／2 级缩时 10%／20%；星辉穹顶 Lv.1／5／10 缩时 5%／10%／20%，额外珍宝概率增加 1／3／6 个百分点。两种缩时相乘。</p><p>接单时固定收获、概率与耗时；读档不重抽，途中升级只影响下一单。</p></>,
};
export const treasureFindingHelp: HelpContent = {
  title: '寻找珍宝',
  overview: <><p>手镐采集用于当地珍宝调查，调查进度跨天保留；行动前列出实际消耗。</p>{manualTreasureRules}<p>金币堆、琥珀与金条在各地采集中也有机会发现。委托大厅伙伴搜集素材时，有很低概率额外带回当地珍宝。</p></>,
  details: commissionHelp.details,
};
