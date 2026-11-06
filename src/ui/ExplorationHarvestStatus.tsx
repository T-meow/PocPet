import { useState } from 'react';
import { X } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import { explorationCapacity, explorationRefillMs, getExplorationBudget, getExplorationCapacity, getExplorationRefillMs } from '../core/explorationBudget';
import { DialogShell } from './DialogShell';

export const ExplorationHarvestStatus = ({ pet, interactive = true }: { pet: PetState; interactive?: boolean }) => {
  const [open, setOpen] = useState(false);
  const budget = getExplorationBudget(pet, pet.lastUpdatedAt), capacity = budget ? getExplorationCapacity(budget) : explorationCapacity;
  const available = budget?.available ?? 0;
  const minutes = budget ? Math.max(1, Math.ceil((budget.refillAt + getExplorationRefillMs(budget) - pet.lastUpdatedAt) / 60000)) : 60;
  const text = `可用 ${available}/${capacity} · ${pet.timePause ? '恢复已暂停' : available >= capacity ? '已存满' : `${minutes} 分钟后恢复`}`;
  return <><button className="exploration-harvest-status" disabled={!interactive} onClick={() => setOpen(true)} aria-label={`采集次数：${text}`}><strong>{text}</strong></button>
    {open && <DialogShell className="exploration-info-sheet" labelId="exploration-budget-title" onClose={() => setOpen(false)} closeOnBackdrop><header><h3 id="exploration-budget-title">采集次数</h3><button className="icon-button" aria-label="关闭采集说明" onClick={() => setOpen(false)}><X /></button></header><div className="exploration-sheet-body"><p>{text}。</p><p>每小时恢复 1 次，最多储存 {explorationCapacity} 次，相当于 {explorationCapacity * explorationRefillMs / 86400000} 天。跨日不清零；冻结时间时暂停恢复。</p><p>手动采集按本次实际倍率消耗次数。大厅伙伴委托不消耗探险次数。</p><p>观察和故事无需采集次数。物品与常规货币只随实际采集发放，首次奖励另外计算。</p></div></DialogShell>}
  </>;
};
