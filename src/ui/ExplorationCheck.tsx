import { explorationOutcomeNames, explorationSkillNames, type ExplorationCheckDefinition, type ExplorationCheckPreview, type ExplorationCheckResult, type ExplorationCheckState } from '../core/explorationChecks';
import { getInventoryItem } from '../core/items';
import { getPetStatCap } from '../core/petStats';
import type { ItemId, PetState } from '../core/petTypes';

const number = (n: number) => String(Math.round(n * 10) / 10);
const range = ([a, b]: [number, number]) => a === b ? number(a) : `${number(a)}～${number(b)}`;
const name = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${number(n)}`;

export const ExplorationChoiceDetails = ({ pet, preview: p, definition: d, hunger, research = false, hideFinds = false, reason, harvest, item, mealItem }: {
  pet: PetState; preview: ExplorationCheckPreview; definition: ExplorationCheckDefinition; hunger: number; research?: boolean; hideFinds?: boolean; reason?: string; harvest?: number; item?: ItemId; mealItem?: string;
}) => <span className="exploration-check-details">
  <span>预计饱食 −{hunger} · 体力 −{range(p.energy)}{p.healthLoss[1] > 0 && ` · 健康 −${range(p.healthLoss)}`}</span>
  {Boolean(harvest || item || mealItem) && <span>{[harvest ? '采集机会 −' + harvest : '', item ? '交出 ' + name(item) + ' ×1' : '', mealItem ? '食用 ' + name(mealItem) + ' ×1' : ''].filter(Boolean).join(' · ')}</span>}
  {!hideFinds && Object.keys(p.finds).length > 0 && <span>行动收获：{Object.entries(p.finds).map(([id, n]) => `${name(id)} ×${range(n)}`).join(' · ')}</span>}
  {research && <span>调查进度 +{range(p.researchPoints)}</span>}
  {d.tool && <span>{name(d.tool)} · 耐久 −1</span>}
  {d.risky && p.healthLoss[1] > 0 && <small>可能擦伤</small>}
  {pet.health - p.healthLoss[1] < getPetStatCap(pet) * .2 && <strong className="exploration-check-warning">本次伤害可能使健康不足，行动后将安全返程。</strong>}
  {(reason || p.reason) && <strong className="exploration-check-warning">{reason || p.reason}</strong>}
</span>;

export const ExplorationCheckSummary = ({ result: r }: { result?: ExplorationCheckResult }) => !r ? null : <div className="exploration-check-result" data-outcome={r.outcome} role="status">
  <strong>{r.title} · {explorationOutcomeNames[r.outcome]}</strong>
  <span>饱食 −{number(r.hunger)} · 体力 −{number(r.energy)} · {r.healthLoss ? `健康 −${number(r.healthLoss)}` : '健康无损'}{r.moodChange ? ` · 心情 ${signed(r.moodChange)}` : ''}</span>
  {Object.keys(r.finds).length > 0 && <span>取得 {Object.entries(r.finds).map(([id, n]) => `${name(id)} ×${n}`).join(' · ')}</span>}
  {r.researchId && <span>{name(r.researchId)}调查进度 +{r.researchPoints}</span>}
  {Boolean(r.coins || r.hearts) && <span>探索酬谢：金币 +{r.coins ?? 0} · 心心 +{r.hearts ?? 0}</span>}
  {r.tool && <span>{name(r.tool)}耐久 −1{r.toolBroken ? ' · 已用尽' : ''}</span>}
  {r.skill && <span>{explorationSkillNames[r.skill]}经验 +{r.xp}{r.skillLevel === 10 ? '（已满级）' : ''}</span>}
  {r.mealItem && <span>食用 {name(r.mealItem)} ×1{r.recovery && Object.entries(r.recovery).filter(([, n]) => n > 0).map(([id, n]) => ` · ${{ hunger: '饱食', energy: '体力', health: '健康', mood: '心情', cleanliness: '清洁' }[id]} +${number(n)}`).join('')}</span>}
</div>;

export const ExplorationCheckBuffs = ({ state }: { state?: ExplorationCheckState }) => !state || !state.focus && !state.meal ? null : <div className="exploration-check-buffs" aria-label="旅途准备">
  {state.focus > 0 && <span>观察准备 · 剩余 {state.focus} 次</span>}
  {state.meal && <span>旅途餐食 · 后 {state.meal.steps} 步体力 −{Math.round(state.meal.reduction * 100)}%</span>}
</div>;
