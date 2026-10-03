import { useState } from 'react';
import { X } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import { getExplorationBudget, getExplorationCapacity, getExplorationRefillMs } from '../core/explorationBudget';
import { DialogShell } from './DialogShell';

export const ExplorationHarvestStatus = ({ pet, interactive = true }: { pet: PetState; interactive?: boolean }) => {
  const [open, setOpen] = useState(false);
  const budget = getExplorationBudget(pet, pet.lastUpdatedAt), capacity = budget ? getExplorationCapacity(budget) : 72;
  const available = budget?.available ?? 0, reserved = pet.community.expedition.active?.reservedHarvests ?? 0;
  const minutes = budget ? Math.max(1, Math.ceil((budget.refillAt + getExplorationRefillMs(budget) - pet.lastUpdatedAt) / 60000)) : 60;
  const text = `可用 ${available}/${capacity} · ${pet.timePause ? '恢复已暂停' : available + reserved >= capacity ? '已存满' : `${minutes} 分钟后恢复`}`;
  return <><button className="exploration-harvest-status" disabled={!interactive} onClick={() => setOpen(true)} aria-label={`采集次数：${text}${reserved ? `，已预留 ${reserved} 次` : ''}`}><strong>{text}</strong>{reserved > 0 && <small>挂机预留 {reserved} 次</small>}</button>
    {open && <DialogShell className="exploration-info-sheet" labelId="exploration-budget-title" onClose={() => setOpen(false)} closeOnBackdrop><header><h3 id="exploration-budget-title">采集次数</h3><button className="icon-button" aria-label="关闭采集说明" onClick={() => setOpen(false)}><X /></button></header><div className="exploration-sheet-body"><p>{text}。{reserved > 0 && `另有 ${reserved} 次用于当前挂机行程。`}</p><p>每小时恢复 1 次，最多存 72 次。预留次数也计入上限；冻结时间时暂停恢复。</p><p>手动采集通常消耗 1 次；挂机基础每 30 分钟消耗 1 次，运动技能与星辉穹顶可加速；出发时预留，提前召回退还未使用次数。</p><p>观察和故事无需采集次数。物品与常规货币只随实际采集发放，首次奖励另外计算。</p>{budget?.version !== 2 && <p>领取旧行程结算后，切换到新的次数与奖励规则。</p>}</div></DialogShell>}
  </>;
};
