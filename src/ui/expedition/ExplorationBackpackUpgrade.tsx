import { useState } from 'react';
import { getBackpackUpgradeQuote, upgradeExplorationBackpack } from '../../core/explorationBackpack';
import { regionalTreasures, type RegionalTreasureId } from '../../core/regionalTreasures';
import { getInventoryItem } from '../../core/items';
import type { ItemId, PetState } from '../../core/petTypes';
import { HelpButton } from '../help/HelpButton';
import { backpackHelp } from '../help/explorationHelp';
import { DialogShell } from '../DialogShell';
import { X } from 'lucide-react';

export const ExplorationBackpackUpgrade = ({ pet, update, compact = false }: { pet: PetState; update: (action: (pet: PetState) => PetState) => void; compact?: boolean }) => {
  const [gem, setGem] = useState<RegionalTreasureId>('forest_emerald');
  const [open, setOpen] = useState(false);
  const q = getBackpackUpgradeQuote(pet, pet.adventure.backpackLevel === 2 ? gem : undefined);
  const controls = q.coins !== undefined && <><p>升级至 {q.nextCapacity} 份：{q.coins} 金币。当前持有 {pet.coins} 金币。</p>
      {q.level === 2 && <label>选择升级珍宝<select aria-label="背包升级珍宝" value={gem} onChange={e => setGem(e.target.value as RegionalTreasureId)}><option value="forest_emerald">雾松祖母绿（需完成林地故事）</option><option value="tidal_pearl">月潮珍珠（需完成海岸故事）</option></select></label>}
      <ul>{Object.entries(q.items).map(([id, quantity]) => <li key={id}>{getInventoryItem(id as ItemId)?.name ?? id} ×{quantity}（持有 {pet.inventory[id] ?? 0}）</li>)}</ul>
      <p>材料备齐后一次交付，永久扩容。</p>
      {q.reason && <small>{q.reason}</small>}</>;
  const sheet = open && <DialogShell role="alertdialog" className="exploration-confirm-sheet" labelId="backpack-upgrade-title" onClose={() => setOpen(false)}><header><h3 id="backpack-upgrade-title">旅行背包升级</h3><button className="icon-button" aria-label="关闭背包升级" onClick={() => setOpen(false)}><X /></button></header><div className="exploration-sheet-body">{controls}</div><footer><button data-dialog-autofocus onClick={() => setOpen(false)}>暂不升级</button><button className="primary-button" disabled={Boolean(q.reason) || q.coins === undefined} onClick={() => { update(p => upgradeExplorationBackpack(p, q.level, q.gem)); setOpen(false); }}>升级至 {q.nextCapacity} 份</button></footer></DialogShell>;
  if (compact) return q.coins === undefined ? <small className="adventure-pack-level">已满级</small> : <><button className="adventure-pack-upgrade-toggle" onClick={() => setOpen(true)}>升级背包</button>{sheet}</>;
  return <section className="exp-bag exploration-backpack-upgrade"><div className="help-heading"><strong>旅行背包 · {q.capacity} 份{q.coins !== undefined ? ` → ${q.nextCapacity} 份` : ' · 已满级'}</strong><HelpButton {...backpackHelp} /></div>{q.coins !== undefined && <button onClick={() => setOpen(true)}>查看升级材料与效果</button>}{sheet}</section>;
};
