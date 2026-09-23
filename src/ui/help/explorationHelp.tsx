import type { HelpContent } from './HelpButton';
import type { PetState } from '../../core/petTypes';
import type { ExpeditionTrip } from '../../core/expeditionTypes';
import type { RationQuote } from '../../core/explorationRations';
import { explorationOutcomeNames, explorationSkillNames, getExplorationMoodEffects, type ExplorationCheckDefinition, type ExplorationCheckPreview } from '../../core/explorationChecks';
import { getPetStatRatio } from '../../core/petStats';
import { explorationCapacity, explorationRefillMs, getExplorationBudget, getExplorationTier, manualTreasureChance } from '../../core/explorationBudget';
import type { AdventureChoice } from '../../core/adventureData';

const number = (n: number) => Math.round(n * 100) / 100;
export const getAdventureActionHelp = (choice: AdventureChoice): HelpContent => ({
  title: choice.label,
  overview: <><p>{choice.tool ? '直接使用仓库中的探路绳，消耗 1 点耐久；用尽时才扣除一件。旧行程已携带的绳索优先使用，未用尽返程归还。' : choice.detail}</p>{choice.item && <p>交出的物品从行囊扣除，不计作喂食。</p>}<p>本次按卡片列出的数值结算，可以打开背包补给或随时返程。</p></>,
});
export const explorationHelp: HelpContent = {
  title: '探索与行动',
  overview: <><p>行动前列出预计消耗，完成后显示实际收获。沿路标稳妥前进也能完成故事，危险路线可能受伤。</p><p>采集阶段可以「采集」或「离开采集点」；仓库有可用镰刀或手镐时，增加对应采集方式。离开只消耗普通推进所需的饱食和体力，不扣采集机会或工具耐久。</p><p>技能、心情和工具影响表现。工具直接读取仓库，不占行囊；途中可使用行囊补给或免费返回，健康过低时会安全返程。</p></>,
  details: <><p>普通采集从当地原有物产及食材调查条目中等概率抽取一项；镰刀从当地原有适用条目中等概率抽取；手镐用于当地珍宝调查。产量、技能判定、调查进度和消耗沿用对应条目，放大镜不会自动使用。</p><p>采集结果由本趟行程、当前阶段和采集方式固定；查看说明或读档不会重新抽取。采集机会不足时可以离开采集点。</p><p>整备预计消耗以普通路线为参考，实际值受路线、心情和表现影响。高级调查增加消耗 20%；绳索或二级基地使通路体力减少 20%。</p></>,
};
export const getExplorationPreparationHelp = (pet: PetState): HelpContent => ({
  ...explorationHelp,
  details: <>{explorationHelp.details}<p>{Object.entries(explorationSkillNames).map(([id, label]) => label + ' ' + pet.partnerSchedule.skills[id as keyof typeof explorationSkillNames].level + ' 级').join(' · ')}</p><p>当前心情 {Math.round(getPetStatRatio(pet, 'mood') * 100)}% · 体力倍率 ×{number(getExplorationMoodEffects(getPetStatRatio(pet, 'mood')).energy)}</p></>,
});
export const getExplorationChoiceHelp = (title: string, p: ExplorationCheckPreview, d: ExplorationCheckDefinition): HelpContent => ({
  title,
  overview: <>{explorationHelp.overview}{d.prepare === 'focus' && <p>观察顺利时准备 1 次，出色时准备 2 次；准备会提高后续行动的把握。</p>}{d.prepare === 'meal' && <p>食用一份料理恢复状态；出色或顺利时，接下来 2 步减少体力消耗，勉强时持续 1 步。</p>}{d.tool && <p>本次使用工具耐久 1 次。{d.tool === 'trail_rope' && '探路绳还能将擦伤减半。'}</p>}{p.reason && <p>{p.reason}</p>}</>,
  details: <>{d.mode === 'check' && <><p>{p.skill && explorationSkillNames[p.skill]} {p.skillLevel} 级 · 推荐 {p.difficulty} 级 · 顺利以上 {number(p.chance)}%</p><p>{p.outcomes.map(o => explorationOutcomeNames[o.outcome] + ' ' + number(o.probability) + '%').join(' · ')}</p><p>基础 70%{p.factors.filter(f => f.value).map(f => ' · ' + f.label + ' ' + (f.value >= 0 ? '+' : '') + number(f.value) + ' 个百分点').join('')}{p.chanceCap < 95 && ' · 越级上限 ' + p.chanceCap + '%'}</p><p>{p.outcomes.map(o => explorationOutcomeNames[o.outcome] + '：体力 −' + o.energy + (o.healthLoss ? '、健康 −' + o.healthLoss : '')).join('；')}。</p></>}<p>基础体力 {p.costFactors.base} · 路线 ×{number(p.costFactors.route)} · 心情 ×{number(p.mood.energy)}{p.costFactors.meal < 1 && ' · 餐食 ×' + number(p.costFactors.meal)}{d.risky && ' · 心情伤害 ×' + number(p.mood.injury)}</p>{d.prepare === 'focus' && <p>观察准备使后续行动的顺利以上概率增加 5 个百分点，仍受推荐等级上限约束。</p>}{d.prepare === 'meal' && <p>料理出色时，接下来 2 步体力消耗减少 15%；顺利时减少 10%，持续 2 步；勉强时减少 5%，持续 1 步。</p>}{d.mode !== 'check' && <p>此行动可确定完成。</p>}</>,
});
export const backpackHelp: HelpContent = {
  title: '旅行背包',
  overview: <><p>选择仓库物品装入背包，出发时才扣除库存。整备时也可以直接使用家中物品。</p><p>背包按物品份数计容量，手动与挂机共用 24／36／48／72 份的永久扩容。可在背包标题旁升级，满级只显示状态。</p><p>探路绳和营具直接读取仓库，无需装入背包；使用时消耗耐久，用尽扣除一件。多出的发现可留到返程整理，确认带回组合后未选物资会被放弃。</p></>,
  details: <p>扩容依次需要：600 金币、木料 8、石料 4、溪光海蓝宝 ×1；1800 金币、木料 16、石料 10、风丘日光石 ×1；4200 金币、木料 24、石料 16、雾松祖母绿或月潮珍珠 ×1。需先完成对应地区故事，并结束行程、收好回执。</p>,
};
export const campHelp: HelpContent = {
  title: '营具与休整',
  overview: <><p>营具仅在完成路线一半阶段后可用一次：6／8／10／12 阶段分别在完成第 3／4／5／6 阶段后，教学路线在完成第 2 阶段后。继续前进便错过本趟休整点。</p><p>点击「营具休整」先查看恢复预览，再确认使用仓库营具。一次消耗 1 点耐久；体力和健康只补回本趟尚未恢复的损耗。邻居救援独立使用，不受休整点限制。</p></>,
  details: <p>最多恢复体力上限的 25%、心情上限的 20%，以及 3 点健康；本次实际恢复量以操作处预览为准。</p>,
};
export const rescueHelp: HelpContent = {
  title: '邻居救援',
  overview: <p>花费 100 心心请求应急补给。补给直接恢复状态，不占背包，当前节点和发现保留；需要时可再次呼叫。</p>,
};
export const commonTreasureRules = <p>新取得的酬谢中，75% 为固定金币，25% 的期望价值转为金币堆、琥珀和金条，在采集时独立判定。实物收获受积存额度限制，与地区珍宝分别计算。</p>;
export const manualTreasureRules = <p>手动每次实际消耗采集机会，在仍有实物酬谢额度时独立以 {manualTreasureChance}% 概率发现当地珍宝。与手镐调查、挂机保底及金币堆等奖励分别计算；机会或额度不足时不抽取。</p>;
export const getBudgetHelp = (pet: PetState): HelpContent => {
  const loop = getExplorationBudget(pet), tier = getExplorationTier(pet), reserved = pet.community.expedition.active?.reservedHarvests ?? 0;
  const minutes = loop ? Math.max(0, Math.ceil((loop.refillAt + explorationRefillMs - Date.now()) / 60000)) : 180;
  return {
    title: '采集机会与酬谢',
    overview: <><p>手动与挂机共用采集机会，每 {explorationRefillMs / 3600000} 小时恢复 1 次，最多保存 {explorationCapacity} 次。{reserved > 0 && reserved + ' 次已为挂机预留。'}{(loop?.available ?? 0) + reserved >= explorationCapacity ? '机会已满。' : '约 ' + Math.floor(minutes / 60) + ' 小时 ' + minutes % 60 + ' 分后恢复下一次。'}</p><p>每日 5 点新增 4 份酬谢，最多积存 3 天。完整地标探索和挂机探索可以领取。</p><p>成长阶段 {tier}/3：{tier === 1 ? '完成溪谷全部地标并修好基地，溪谷每日固定金币升至 900。' : tier === 2 ? '基地升至 2 级、累计采集 ' + (loop?.used ?? 0) + '/80 次并制作溪光水景后，每日固定金币升至 1800。' : '溪谷经营成熟。'}</p></>,
    details: <><p>手动完整地标探索领取一份酬谢，挂机每 2 小时领取一份的 80%。每日 22 基础心心也共用。</p>{commonTreasureRules}{manualTreasureRules}<p>金币堆、琥珀与金条各占实物掉落的三分之一；总掉落概率为本次消耗的实物期望价值 ÷ 三种宝物的平均价值。古树绿宝挂饰的普通物产加成独立判定，沿用出发时的装饰效果。</p></>,
  };
};
export const rationRules = <><p>食物用于覆盖挂机期间的消耗。自动补给在出发时购买，费用会在出发前列出。</p><p>提前返回时会先吃剩余食物，吃饱后分给邻居。食物和补给费不退，未使用的采集机会退回，仓库放不下的收获保留待领。</p></>;
export const rationCalculationRules = <p>配餐评分按食物的正向基础属性合计；基础珍宝概率为 5 ＋ 15 ×（评分 ÷（54 × 最低份数）− 1），限制在 5%～20%，另加星辉穹顶效果。配餐页面列出当前概率，出发后固定。料理不会额外恢复途中状态。</p>;
export const treasureFindingHelp: HelpContent = {
  title: '寻找珍宝',
  overview: <><p>手镐采集用于当地珍宝调查，调查进度跨天保留；行动前列出实际消耗。</p>{manualTreasureRules}<p>挂机每两小时寻找一次当地珍宝，同地区连续 9 次未得后，第 10 次必得；随机获得清零，跨日保留。金币堆、琥珀与金条在各地采集中也有机会发现。</p></>,
  details: <p>挂机配餐的基础珍宝概率为 5%～20%，另加星辉穹顶效果。出发时确定本趟概率，可在配餐说明中查看具体数值。</p>,
};
export const getRationsHelp = (q: RationQuote): HelpContent => ({
  title: '挂机配餐',
  overview: <>{rationRules}<p>本趟至少需要 {q.minimum} 份食物、{q.nutrition} 基础饱食，最多 {q.maximum} 份；当前 {q.count} 份、{q.hunger} 基础饱食。</p><p>每满一小时取得材料与酬谢，每两小时寻找一次当地珍宝。</p></>,
  details: <><p>配餐评分 {q.score} · 基础概率 {number(q.baseChance)}% ＋ 星辉穹顶 {q.decorationBonus} 个百分点 ＝ {number(q.chance)}%。</p>{rationCalculationRules}<p>采集时的金币堆、琥珀与金条独立计算，受积存酬谢额度限制。</p></>,
});
export const getJourneyHelp = (trip: ExpeditionTrip): HelpContent => ({
  title: '挂机行程',
  overview: <><p>每满一小时结算一次采集，饱食和体力按实际时长消耗，全部材料运回。</p>{trip.rationPlan ? rationRules : <p>{trip.rulesVersion >= 2 ? '本趟提前返回会退回未使用的采集机会，以及尚未开始时段的配餐和补给费。' : '本趟按已完成的行程结算，带回已取得的物资。'}</p>}</>,
  details: trip.rationPlan ? <p>本趟珍宝概率 {number(trip.rationPlan.chance)}%{trip.rationPlan.version >= 2 && '（配餐 ' + number(trip.rationPlan.baseChance ?? 0) + '% ＋ 装饰 ' + (trip.rationPlan.decorationBonus ?? 0) + ' 个百分点）'}。</p> : trip.rationSegments ? <>{trip.rationSegments.map((s, i) => <p key={i}>第 {i + 1} 段 · 珍宝概率 {number(s.chance)}% · 配餐 {s.count} 份 · 补给费 {s.price} 金币 · {s.settled ? '已结束' : s.started ? '正在使用' : '尚未开始，可退款'}</p>)}</> : undefined,
});
