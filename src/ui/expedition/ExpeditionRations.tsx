import { getInventoryItem } from '../../core/items';
import { quoteExpeditionRations, type RationSelection } from '../../core/explorationRations';
import { explorationTravel } from '../../core/explorationTravelData';
import { earnExplorationPay } from '../../core/explorationBudget';
import type { RegionId } from '../../core/expeditionTypes';
import type { Inventory, ItemId, PetState } from '../../core/petTypes';

export const ExpeditionRations = ({ pet, region, hours, selection, finds }: { pet: PetState; region: RegionId; hours: number; selection: RationSelection; finds?: Inventory }) => {
  const q = quoteExpeditionRations(pet, region, hours, selection), profile = explorationTravel[region];
  let projected = pet, coins = 0, hearts = 0;
  const now = Date.now();
  for (let i = 0; i < hours; i++) { const pay = earnExplorationPay(projected, 'hour', now + (i + 1) * 3600000, region); projected = pay.pet; coins += pay.coins; hearts += pay.hearts; }
  return <div className="exp-rations">
    <p className="outpost-note">全程至少 {q.minimum} 份、{q.nutrition} 基础饱食，最多 {q.maximum} 份。当前 {q.count} 份、{q.hunger} 基础饱食。</p>
    <details className="exp-bag"><summary>预计收获与旅途说明 · 珍宝概率 {q.chance.toFixed(1)}%</summary>
      <p>预计酬谢 {coins} 金币 · {hearts} 心心。自动补给 {q.purchased} 份，共 {q.coins} 金币。</p>
      {finds && <p>{Object.entries(finds).map(([id, n]) => `${getInventoryItem(id as ItemId)?.name ?? id} ×${n * hours}`).join(' · ')}</p>}
      <p>行路饱食 −{profile.idleHunger * hours / 2} · 体力 −{profile.idleEnergy * hours / 2} · 采集机会 {hours} 次。</p>
      <p>料理用于旅途补给，不额外恢复途中状态。每满一小时取得材料与酬谢，每两小时寻找当地珍宝；配餐基础概率 {q.baseChance.toFixed(1)}%（5%～20%）＋星辉穹顶 {q.decorationBonus} 个百分点＝{q.chance.toFixed(1)}%。出发后锁定。</p>
      <p>采集时还可能发现金币堆、琥珀或古老金条，可兑换金币或升级装饰。新酬谢的 75% 为固定金币，25% 的期望价值转为这些实物；随机收获独立于地区珍宝，受积存酬谢额度限制。</p>
      <p>提前返回时，先按吃撑规则吃掉剩余料理，吃饱后分给路过的邻居。料理和补给费不返还，未使用的采集机会退回。仓库放不下的收获保留待领。</p>
    </details>
  </div>;
};
