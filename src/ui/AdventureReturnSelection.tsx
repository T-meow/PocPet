import { useState } from 'react';
import { adventureBagCapacity } from '../core/adventureData';
import { getAdventureBagCount } from '../core/adventureState';
import { chooseAdventureReturnItems } from '../core/adventureReturn';
import type { AdventureResult } from '../core/adventureTypes';
import type { Inventory, ItemRegistry, PetState } from '../core/petTypes';

export const AdventureReturnSelection = ({ result, registry, update }: { result: AdventureResult; registry: ItemRegistry; update: (action: (pet: PetState) => PetState) => void }) => {
  const pool = result.salvage ?? {};
  const [chosen, setChosen] = useState<Inventory>(() => {
    let remaining = adventureBagCapacity;
    return Object.fromEntries(Object.entries(pool).map(([id, n]) => { const take = Math.min(remaining, n); remaining -= take; return [id, take]; }));
  });
  const count = getAdventureBagCount(chosen), left = getAdventureBagCount(pool) - count;
  return <section className="adventure-return-selection"><h4>安全返程 · 整理携带物资</h4><p>原行囊与地面发现合计最多带回 {adventureBagCapacity} 份。工具独立归还；确认后只可领取所选物资。</p>
    {Object.entries(pool).map(([id, n]) => <div className="community-stock-row" key={id}><span>{registry.get(id)?.name ?? id} ×{n}</span><div><button aria-label={`少带一份${registry.get(id)?.name ?? id}`} disabled={!chosen[id]} onClick={() => setChosen(c => ({ ...c, [id]: (c[id] ?? 0) - 1 }))}>−</button><b>{chosen[id] ?? 0}</b><button aria-label={`多带一份${registry.get(id)?.name ?? id}`} disabled={count >= adventureBagCapacity || (chosen[id] ?? 0) >= n} onClick={() => setChosen(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }))}>＋</button></div></div>)}
    <p>携带 {count}/{adventureBagCapacity} · 未选择 {left} 份{result.salvageTool ? ' · 探路绳另行归还' : ''}</p><button className="primary-button" onClick={() => update(p => chooseAdventureReturnItems(p, result.id, chosen))}>确认带回 {count} 份{left > 0 ? `，放弃其余 ${left} 份` : ''}</button></section>;
};
