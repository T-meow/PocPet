import { communityDecorations, regionalTreasures, type CommunityDecorationId, type RegionalTreasureId } from '../../core/regionalTreasures';
import { decorationEffects } from '../../core/decorationEffects';
import { regions } from '../../core/expeditionData';
import { commonTreasureRules, treasureFindingHelp } from './explorationHelp';
import type { HelpContent } from './HelpButton';

const timing: Record<CommunityDecorationId, string> = {
  amber_lantern: '接取订单时确定金币加成，已接订单保留原报酬。',
  golden_sign: '新栏位上架时确定售价，未满栏位补货沿用原价；实际售价受商品买卖价差限制。',
  creek_fountain: '播种时确定生长加成，已经种下的作物保留原成熟时间。',
  sun_weather_vane: '牧场加成从下一生产周期开始生效。',
  emerald_pendant: '普通采集有机会额外得到一份主产物。',
  pearl_lamp: '抛竿时确定等待时间，本次抛竿保留当时的加成。',
  star_dome: '挂机出发时确定珍宝概率，已出发行程保留当时的加成。',
};
export const decorationsHelp: HelpContent = {
  title: '农场装饰',
  overview: <p>制作后永久生效，所有装饰同时提供加成，每件最高十级。材料可以从各地探索中收集。</p>,
};
export const getDecorationHelp = (id: CommunityDecorationId, level: number): HelpContent => {
  const material = level ? decorationEffects[id].treasure : communityDecorations[id].material;
  const treasure = material && Object.prototype.hasOwnProperty.call(regionalTreasures, material) ? regionalTreasures[material as RegionalTreasureId] : undefined;
  return {
    title: communityDecorations[id].name,
    overview: <>{decorationsHelp.overview}<p>{timing[id]}</p>{level > 0 && level < 10 && <p>升级的通用探索材料可以混用，默认先使用兑换价值较低的物品；提交后扣除清单中的材料。</p>}{level < 10 && <p>{treasure ? `${treasure.name}来自${regions[treasure.region].name}，调查累计 ${treasure.investigations} 点获得 1 件，也可在当地挂机寻找。` : '金币堆、琥珀和金条可在各地采集时发现；木料、石料可从溪谷采集或商店补充。'}</p>}</>,
    details: level < 10 ? <>{level > 0 || !treasure ? commonTreasureRules : null}{treasure && treasureFindingHelp.details}</> : undefined,
  };
};
