import { getInventoryItem } from '../../core/items';
import { isTravelFood, quoteExpeditionRations, type RationSelection } from '../../core/explorationRations';
import { explorationTravel } from '../../core/explorationTravelData';
import { earnExplorationPay } from '../../core/explorationBudget';
import type { RegionId } from '../../core/expeditionTypes';
import type { Inventory, ItemId, PetState } from '../../core/petTypes';

export const ExpeditionRations = ({ pet, region, hours, setHours, selection, onChange }: { pet: PetState; region: RegionId; hours: number; setHours: (n: number) => void; selection: RationSelection; onChange: (s: RationSelection) => void }) => {
  const q = quoteExpeditionRations(pet, region, hours, selection), profile = explorationTravel[region];
  const foods = Object.entries(pet.inventory).filter(([id, n]) => n > 0 && isTravelFood(id));
  let projected = pet, coins = 0, hearts = 0;
  for (let i = 0; i < hours; i++) { const pay = earnExplorationPay(projected, 'hour', Date.now() + (i + 1) * 3600000, region); projected = pay.pet; coins += pay.coins; hearts += pay.hearts; }
  const changeMeal = (index: number, food: Inventory) => onChange({ ...selection, meals: Array.from({ length: hours / 2 }, (_, i) => i === index ? food : { ...selection.meals[i] }) });
  return <div className="exp-rations"><div className="valley-mode-options">{[2, 4, 8].map(n => <button key={n} aria-pressed={hours === n} onClick={() => setHours(n)}><b>{n} 小时</b><small>{n / 2} 段餐包 · 机会 {n} 次</small></button>)}</div>
    <label className="exp-rope"><input type="checkbox" checked={selection.autoFill} onChange={e => onChange({ ...selection, autoFill: e.target.checked })} />自动购买坚果包补足 · 每份 28 金币（基础饱食 36、体力 18）</label>
    <p>每两小时至少 {profile.meals} 份、{profile.nutrition} 基础饱食，最多 {profile.meals * 2} 份。料理用于途中配餐，不额外恢复出发时的状态。</p>
    {q.segments.map((segment, index) => <details key={index} className="exp-bag" open={hours === 2}><summary>第 {index + 1} 段 · {index * 2}～{index * 2 + 2} 小时 · {segment.count} 份 / 饱食 {segment.hunger} · {segment.price} 金币</summary><p>珍宝概率 {segment.chance.toFixed(1)}% · 营养评分 {segment.score} · 自动补足 {segment.purchased} 份</p>
      <div className="exp-stock-list">{foods.map(([id, n]) => <label key={id}><span>{getInventoryItem(id as ItemId)?.name}<small>库存 {n} · 基础饱食 {getInventoryItem(id as ItemId)?.effect.hunger ?? 0}</small></span><input aria-label={`第${index + 1}段${getInventoryItem(id as ItemId)?.name}`} type="number" min={0} max={Math.min(n, profile.meals * 2)} value={segment.food[id] ?? 0} onChange={e => { const count = Math.max(0, Math.min(n, profile.meals * 2, Math.floor(Number(e.target.value)) || 0)), food = { ...segment.food }; if (count) food[id] = count; else delete food[id]; changeMeal(index, food); }} /></label>)}</div>
      {!foods.length && <small>暂无可投入的库存食物，可自动购买标准补给。</small>}<button className="exp-link-button" onClick={() => onChange({ ...selection, meals: Array.from({ length: hours / 2 }, () => ({ ...segment.food })) })}>把这一段配餐复制到全部时段</button>{segment.reason && <p className="exp-warning">{segment.reason}</p>}</details>)}
    <div className="exp-quote"><b>本次补给费 {q.coins} 金币</b><span>预计酬谢 {coins} 金币 · {hearts} 心心（与其他探索共用剩余额度）</span><span>行路消耗：饱食 {profile.idleHunger * hours / 2} · 体力 {profile.idleEnergy * hours / 2}</span></div>
    {q.reason && <p className="exp-warning">{q.reason}</p>}<p>每满两小时独立寻找一次当地珍宝，标准补给概率 3%，丰富配餐最高 15%。餐包开始后消耗；召回退回未开始时段的料理和补给费。心情、清洁和健康照常变化，健康低于 20% 优先返程。挂机货物完整运回。</p>
  </div>;
};
