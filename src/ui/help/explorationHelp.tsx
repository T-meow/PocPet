import type { HelpContent } from './HelpButton';
import type { PetState } from '../../core/petTypes';
import type { ExpeditionTrip } from '../../core/expeditionTypes';
import type { RationQuote } from '../../core/explorationRations';
import { explorationOutcomeNames, explorationSkillNames, getExplorationMoodEffects, type ExplorationCheckDefinition, type ExplorationCheckPreview } from '../../core/explorationChecks';
import { getPetStatRatio } from '../../core/petStats';
import { explorationCapacity, explorationRefillMs, getExplorationBudget, getExplorationTier } from '../../core/explorationBudget';
import { regionalTreasureIds, regionalTreasures } from '../../core/regionalTreasures';
import { wildIngredientIds, wildIngredients } from '../../core/foodCatalog';
import { toolDurabilityLabel } from '../../core/toolDurability';
import { valleyGatherNames } from '../../core/valleyExplorationData';
import type { ExpeditionChoice } from '../../core/expedition';
import { isValleyExpedition } from '../../core/valleyExpedition';
import type { AdventureChoice } from '../../core/adventureData';

const number = (n: number) => Math.round(n * 100) / 100;
export const expeditionChoiceSummary = (choice: ExpeditionChoice) => choice.research ? '寻找线索，记录沿途的新发现。'
  : choice.id === 'story' ? '记下同行的见闻，走向休息基地。'
  : Object.keys(choice.finds).length ? '收集沿途的物资，带回家中。'
  : choice.health < 0 ? '试着穿过近路，早点到达下一处。'
  : '沿着熟悉的地标，继续前行。';
export const getExpeditionActionHelp = (choice: ExpeditionChoice): HelpContent => ({
  title: choice.title, overview: <p>{choice.description}</p>,
});
export const getAdventureActionHelp = (choice: AdventureChoice): HelpContent => ({
  title: choice.label,
  overview: <><p>{choice.tool ? '借助探路绳通过，使用耐久 1 次；用尽后损坏，未用尽的绳索返程归还。' : choice.detail}</p>{choice.item && <p>交出的物品从行囊扣除，不计作喂食。</p>}<p>本次按卡片列出的数值结算，可以打开背包补给或随时返程。</p></>,
});
export const explorationHelp: HelpContent = {
  title: '探索与行动',
  overview: <><p>选择行动前可查看预计消耗与收获。沿路标稳妥前进也能完成故事，危险路线可能受伤。</p><p>技能、心情和随身工具会影响表现。观察路标可以为后续行动做准备，途中料理可以恢复状态并帮助节省体力。</p><p>途中可以使用行囊补给或免费返回；健康过低时会安全返程。</p></>,
  details: <><p>整备中的预计消耗以普通路线为参考，实际值受路线、心情和表现影响。每一步按行动前状态计算，选项中的体力与收获显示可能范围。</p><p>高级调查增加消耗 20%；绳索或二级基地使通路体力减少 20%。带绳索才可选择对应操作，其他工具直接使用已有库存；各项修正可从行动说明查看。</p></>,
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
  overview: <><p>选择仓库物品装入背包，出发时才扣除库存。整备时也可以直接使用家中物品。</p><p>背包按物品份数计容量，两种探索共用升级后的容量，工具独立携带。探路绳在对应行动中才消耗耐久。</p><p>多出的发现可留到返程整理。确认带回组合后，未选物资将被放弃。</p></>,
};
export const campHelp: HelpContent = {
  title: '营具与休整',
  overview: <><p>完成一次有消耗的行动后，可以使用营具休整。每趟每地区只能休整一次，与基地休整共用次数。</p><p>营具使用一次消耗 1 点耐久；体力和健康只补回本地区尚未恢复的损耗。</p></>,
  details: <p>最多恢复体力上限的 25%、心情上限的 20%，以及 3 点健康；本次实际恢复量以操作处预览为准。</p>,
};
export const rescueHelp: HelpContent = {
  title: '邻居救援',
  overview: <p>花费 100 心心请求应急补给。补给直接恢复状态，不占背包，当前节点和发现保留；需要时可再次呼叫。</p>,
};
export const commonTreasureRules = <p>新取得的酬谢中，75% 为固定金币，25% 的期望价值转为金币堆、琥珀和金条，在采集时独立判定。实物收获受积存额度限制，与地区珍宝分别计算。</p>;
export const getBudgetHelp = (pet: PetState): HelpContent => {
  const loop = getExplorationBudget(pet), tier = getExplorationTier(pet), reserved = pet.community.expedition.active?.reservedHarvests ?? 0;
  const minutes = loop ? Math.max(0, Math.ceil((loop.refillAt + explorationRefillMs - Date.now()) / 60000)) : 180;
  return {
    title: '采集机会与酬谢',
    overview: <><p>手动与挂机共用采集机会，每 {explorationRefillMs / 3600000} 小时恢复 1 次，最多保存 {explorationCapacity} 次。{reserved > 0 && reserved + ' 次已为挂机预留。'}{(loop?.available ?? 0) + reserved >= explorationCapacity ? '机会已满。' : '约 ' + Math.floor(minutes / 60) + ' 小时 ' + minutes % 60 + ' 分后恢复下一次。'}</p><p>每日 5 点新增 4 份酬谢，最多积存 3 天。完整巡路和挂机探索可以领取。</p><p>成长阶段 {tier}/3：{tier === 1 ? '完成七段故事并修好基地，溪谷每日固定金币升至 900。' : tier === 2 ? '基地升至 2 级、累计采集 ' + (loop?.used ?? 0) + '/80 次并制作溪光水景后，每日固定金币升至 1800。' : '溪谷经营成熟。'}</p></>,
    details: <><p>手动完整巡路领取一份酬谢，挂机每 2 小时领取一份的 80%。每日 22 基础心心也共用。</p>{commonTreasureRules}</>,
  };
};
export const rationRules = <><p>食物用于覆盖挂机期间的消耗。自动补给在出发时购买，费用会在出发前列出。</p><p>提前返回时会先吃剩余食物，吃饱后分给邻居。食物和补给费不退，未使用的采集机会退回，仓库放不下的收获保留待领。</p></>;
export const treasureFindingHelp: HelpContent = {
  title: '寻找珍宝',
  overview: <><p>当地探索可以调查珍宝，调查进度跨天保留。工具可以帮助调查，行动前会列出实际消耗。</p><p>挂机每两小时寻找一次当地珍宝。金币堆、琥珀与金条在各地采集中也有机会发现。</p></>,
  details: <p>挂机配餐的基础珍宝概率为 5%～20%，另加星辉穹顶效果。出发时确定本趟概率，可在配餐说明中查看具体数值。</p>,
};
export const getRationsHelp = (q: RationQuote): HelpContent => ({
  title: '挂机配餐',
  overview: <>{rationRules}<p>本趟至少需要 {q.minimum} 份食物、{q.nutrition} 基础饱食，最多 {q.maximum} 份；当前 {q.count} 份、{q.hunger} 基础饱食。</p><p>每满一小时取得材料与酬谢，每两小时寻找一次当地珍宝。</p></>,
  details: <><p>配餐基础概率 {number(q.baseChance)}% ＋ 星辉穹顶 {q.decorationBonus} 个百分点 ＝ {number(q.chance)}%。出发后确定。</p><p>配餐评分 {q.score}，按食物的正向基础属性合计；基础概率为 5 ＋ 15 ×（评分 ÷（54 × 最低份数）− 1），限制在 5%～20%。料理不会额外恢复途中状态。</p><p>采集时的金币堆、琥珀与金条独立计算，受积存酬谢额度限制。</p></>,
});
export const getJourneyHelp = (trip: ExpeditionTrip): HelpContent => ({
  title: '挂机行程',
  overview: <><p>每满一小时结算一次采集，饱食和体力按实际时长消耗，全部材料运回。</p>{trip.rationPlan ? rationRules : <p>{trip.rulesVersion >= 2 ? '本趟提前返回会退回未使用的采集机会，以及尚未开始时段的配餐和补给费。' : '本趟按已完成的行程结算，带回已取得的物资。'}</p>}</>,
  details: trip.rationPlan ? <p>本趟珍宝概率 {number(trip.rationPlan.chance)}%{trip.rationPlan.version === 2 && '（配餐 ' + number(trip.rationPlan.baseChance ?? 0) + '% ＋ 装饰 ' + (trip.rationPlan.decorationBonus ?? 0) + ' 个百分点）'}。</p> : trip.rationSegments ? <>{trip.rationSegments.map((s, i) => <p key={i}>第 {i + 1} 段 · 珍宝概率 {number(s.chance)}% · 配餐 {s.count} 份 · 补给费 {s.price} 金币 · {s.settled ? '已结束' : s.started ? '正在使用' : '尚未开始，可退款'}</p>)}</> : undefined,
});
export const getGatheringHelp = (pet: PetState, trip: ExpeditionTrip): HelpContent => {
  const region = trip.route[trip.leg], valley = isValleyExpedition(trip);
  return {
    title: '当地采集与调查',
    overview: <><p>{valley ? '本趟目标：' + valleyGatherNames[trip.target ?? 'valley_mushroom'] + '。完整巡路最多使用 2 次机会；短途普通采集 1 次，手镐勘探可用 2 次。' : '各地区共用采集机会，调查进度跨天保留。'}</p>{!valley && wildIngredientIds.filter(id => wildIngredients[id].region === region).map(id => { const d = wildIngredients[id]; return <p key={id}>{d.name} · {d.investigations > 1 ? '调查 ' + (pet.community.forageResearch[id] ?? 0) % d.investigations + '/' + d.investigations : '每次获得 ' + d.yield + ' 份'}</p>; })}{regionalTreasureIds.filter(id => regionalTreasures[id].region === region).map(id => { const d = regionalTreasures[id]; return <p key={id}>{d.name} · 调查 {(pet.community.treasureResearch[id] ?? 0) % d.investigations}/{d.investigations} · {d.use}</p>; })}</>,
    details: <><p>{valley ? trip.rulesVersion >= 4 ? '海蓝宝勘探推荐学习 3 级。徒手消耗 1 次机会，标准进度 1 点；手镐消耗 2 次机会，标准进度 2 点，耐久 −1。表现影响进度与野菇数量，累计 6 点获得海蓝宝 ×1。' : '海蓝宝徒手勘探使用 1 次机会推进 1 点，手镐使用 2 次机会推进 2 点、耐久 −1。每点另得野菇 ×1，累计 6 点获得海蓝宝 ×1。' : '珍宝与食材共用采集机会；使用放大镜或调查珍宝时，行动消耗增加 20%。'}</p><p>手镐：{toolDurabilityLabel(pet, 'prospector_pick')} · 放大镜：{toolDurabilityLabel(pet, 'survey_lens')}。选择对应操作才扣耐久。</p></>,
  };
};
