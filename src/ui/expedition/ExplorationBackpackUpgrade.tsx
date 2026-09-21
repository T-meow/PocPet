import { useState } from 'react';
import { getBackpackUpgradeQuote, upgradeExplorationBackpack } from '../../core/explorationBackpack';
import { regionalTreasures, type RegionalTreasureId } from '../../core/regionalTreasures';
import type { PetState } from '../../core/petTypes';

export const ExplorationBackpackUpgrade = ({ pet, update }: { pet: PetState; update: (action: (pet: PetState) => PetState) => void }) => {
  const [gem, setGem] = useState<RegionalTreasureId>('forest_emerald');
  const q = getBackpackUpgradeQuote(pet, pet.adventure.backpackLevel === 2 ? gem : undefined);
  return <details className="exp-bag exploration-backpack-upgrade"><summary>永久旅行背包 · {q.capacity} 份{q.level < 3 ? ` → ${q.nextCapacity} 份` : ' · 已满级'}</summary>
    <p>两种探险共用容量，按物品份数计算，工具独立携带。</p>
    {q.coins !== undefined && <><p>升级需 {q.coins} 金币、木料 {q.wood}、石料 {q.stone}、{q.gem ? regionalTreasures[q.gem].name : ''} ×1。</p>
      {q.level === 2 && <label>选择升级珍宝<select aria-label="背包升级珍宝" value={gem} onChange={e => setGem(e.target.value as RegionalTreasureId)}><option value="forest_emerald">雾松祖母绿（需完成林地故事）</option><option value="tidal_pearl">月潮珍珠（需完成海岸故事）</option></select></label>}
      <button className="exp-secondary" disabled={Boolean(q.reason)} onClick={() => update(p => upgradeExplorationBackpack(p, q.level, q.gem))}>升级至 {q.nextCapacity} 份</button>{q.reason && <small>{q.reason}</small>}</>}
  </details>;
};
