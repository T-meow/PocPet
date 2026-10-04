import { communityDecorations, regionalTreasures, type CommunityDecorationId, type RegionalTreasureId } from '../../core/regionalTreasures';
import { decorationEffects, getDecorationIdleTimeReduction, getDecorationMarketTrafficBonus, getDecorationValue } from '../../core/decorationEffects';
import { getMarketBuyoutBonusForLevels } from '../../core/communityMarketRules';
import { regions } from '../../core/expeditionData';
import { commonTreasureRules, treasureFindingHelp } from './explorationHelp';
import type { HelpContent } from './HelpButton';
import { formatInteger } from '../numberFormat';

export const getDecorationEffectText = (id: CommunityDecorationId, level: number) => {
  const traffic = getDecorationMarketTrafficBonus(id, level);
  return `${decorationEffects[id].label} ${formatInteger(getDecorationValue(id, level))}${decorationEffects[id].unit}${traffic ? ` · 客流 +${traffic}%` : ''}${id === 'star_dome' ? ` · 挂机判定缩时 ${formatInteger(getDecorationIdleTimeReduction(level))}%` : ''}`;
};

const timing: Record<CommunityDecorationId, string> = {
  amber_lantern: '接取订单时确定金币加成，已接订单保留原报酬。每级另增加小摊客流 3%，最高 +30%。',
  golden_sign: '新栏位上架时确定售价，未满栏位补货沿用原价；招牌加价在摆摊报价上额外计算，采购转售与自产同名商品使用相同报价。每级另增加客流 5%，最高 +50%；同时将慷慨游客的基础包场概率提高 5%，最高 +50%，可与烹饪技能的包场加成相加。',
  creek_fountain: '播种时确定生长加成，已经种下的作物保留原成熟时间。每级另增加小摊客流 2%，最高 +20%。',
  sun_weather_vane: '牧场加成从下一生产周期开始生效。',
  emerald_pendant: '普通采集有机会额外得到一份主产物。',
  pearl_lamp: '抛竿时确定等待时间，本次抛竿保留当时的加成。',
  star_dome: '提高挂机珍宝概率，同时缩短采集与珍宝判定间隔：Lv.1／5／10 缩时 5%／10%／20%，与运动技能相乘。出发时确定概率和间隔，已出发行程保留当时的加成。',
};
export const decorationsHelp: HelpContent = {
  title: '装饰工坊',
  overview: <><p>从农场首屏的「装饰工坊」进入，查看全部装饰、制作与升级材料。制作后自动陈列，所有装饰同时提供永久加成，每件最高十级。材料可以从各地探索中收集。</p><p>铭牌、叶影灯和水景还能吸引更多客人，客流加成相加，最高 +100%。加成从下一轮到访等待生效，当前等待时间保留。</p></>,
};
export const getDecorationHelp = (id: CommunityDecorationId, level: number): HelpContent => {
  const material = level ? decorationEffects[id].treasure : communityDecorations[id].material;
  const treasure = material && Object.prototype.hasOwnProperty.call(regionalTreasures, material) ? regionalTreasures[material as RegionalTreasureId] : undefined;
  return {
    title: communityDecorations[id].name,
    overview: <>{decorationsHelp.overview}<p>{timing[id]}</p>{id === 'golden_sign' && <p>当前铭牌提供包场机会加成 +{getMarketBuyoutBonusForLevels(1, level).decoration}%。</p>}{id === 'star_dome' && <p>当前穹顶缩短挂机判定间隔 {Math.round(getDecorationIdleTimeReduction(level))}%。</p>}{level > 0 && level < 10 && <p>升级的通用探索材料可以混用，默认先使用兑换价值较低的物品；提交后扣除清单中的材料。</p>}{level < 10 && <p>{treasure ? `${treasure.name}来自${regions[treasure.region].name}，调查累计 ${treasure.investigations} 点获得 1 件，也可在当地挂机寻找。` : '金币堆、琥珀和金条可在各地采集时发现；木料、石料可从溪谷采集或商店补充。'}</p>}</>,
    details: level < 10 ? <>{level > 0 || !treasure ? commonTreasureRules : null}{treasure && treasureFindingHelp.details}</> : undefined,
  };
};
