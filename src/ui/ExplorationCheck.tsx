import { Heart, Leaf, Utensils, Wrench, Zap } from 'lucide-react';
import { explorationOutcomeNames, explorationSkillNames, type ExplorationCheckDefinition, type ExplorationCheckPreview, type ExplorationCheckResult, type ExplorationCheckState } from '../core/explorationChecks';
import { getInventoryItem } from '../core/items';
import { getPetStatCap } from '../core/petStats';
import { toolDurabilityLabel } from '../core/toolDurability';
import type { ItemId, PetState } from '../core/petTypes';
import { formatInteger as number, formatProbabilityPercent } from './numberFormat';

const range = ([a, b]: [number, number]) => number(a) === number(b) ? number(a) : `${number(a)}～${number(b)}`;
const name = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${number(n)}`;

export const ExplorationChoiceDetails = ({ pet, preview: p, definition: d, research = false, hideFinds = false, reason, harvest, item, mealItem }: {
  pet: PetState; preview: ExplorationCheckPreview; definition: ExplorationCheckDefinition; research?: boolean; hideFinds?: boolean; reason?: string; harvest?: number; item?: ItemId; mealItem?: string;
}) => <span className="exploration-check-details">
  <span className="exploration-action-costs"><span><Utensils size={15} aria-hidden="true" />饱食 <b>−{range(p.hunger)}</b></span><span><Zap size={15} aria-hidden="true" />体力 <b>−{range(p.energy)}</b></span><span className={p.healthLoss[1] > 0 ? 'exploration-action-risk' : 'exploration-action-benefit'}><Heart size={15} aria-hidden="true" />{p.healthLoss[1] > 0 ? <>健康最多损失 <b>{number(p.healthLoss[1])}</b></> : '健康无损'}</span></span>
  {Boolean(harvest || item || mealItem) && <span className="exploration-action-costs">{Boolean(harvest) && <span><Leaf size={15} aria-hidden="true" />采集 <b>−{number(harvest ?? 0)}</b></span>}{item && <span>交出 {name(item)} ×1</span>}{mealItem && <span>食用 {name(mealItem)} ×1</span>}</span>}
  {!hideFinds && Object.keys(p.finds).length > 0 && <span className="exploration-action-benefit">收获：{Object.entries(p.finds).map(([id, n]) => `${name(id)} ×${range(n)}`).join(' · ')}</span>}
  {research && <span className="exploration-action-benefit">调查进度 <b>+{range(p.researchPoints)}</b></span>}
  {p.skill && p.chance < 100 && <span className="exploration-action-skill">{explorationSkillNames[p.skill]} {p.skillLevel} 级 · 顺利以上 {formatProbabilityPercent(p.chance)}</span>}
  {d.tool && <span className="exploration-action-tool"><Wrench size={15} aria-hidden="true" />{name(d.tool)} · {toolDurabilityLabel(pet, d.tool, d.tool === 'trail_rope' && Boolean(pet.adventure.active?.tool))} · 本次耐久 −1</span>}
  {pet.health - p.healthLoss[1] < getPetStatCap(pet) * .2 && <strong className="exploration-check-warning">本次伤害可能使健康不足，行动后将安全返程。</strong>}
  {(reason || p.reason) && <strong className="exploration-check-warning">{reason || p.reason}</strong>}
</span>;

export const ExplorationCheckSummary = ({ result: r }: { result?: ExplorationCheckResult }) => !r ? null : <div className="exploration-check-result" data-outcome={r.outcome} role="status">
  <strong>{r.title} · {explorationOutcomeNames[r.outcome]}</strong>
  <span>饱食 −{number(r.hunger)} · 体力 −{number(r.energy)} · {r.healthLoss ? `健康 −${number(r.healthLoss)}` : '健康无损'}{r.moodChange ? ` · 心情 ${signed(r.moodChange)}` : ''}</span>
  {Object.keys(r.finds).length > 0 && <span className="exploration-action-benefit">取得 {Object.entries(r.finds).map(([id, n]) => `${name(id)} ×${number(n)}`).join(' · ')}</span>}
  {r.researchId && <span className="exploration-action-benefit">{name(r.researchId)}调查进度 +{number(r.researchPoints)}</span>}
  {Boolean(r.coins || r.hearts) && <span>探索酬谢：金币 +{r.coins ?? 0} · 心心 +{r.hearts ?? 0}</span>}
  {r.tool && <span>{name(r.tool)}耐久 −1{r.toolBroken ? ' · 已用尽' : ''}</span>}
  {r.skill && <span>{explorationSkillNames[r.skill]}经验 +{r.xp}{r.skillLevel === 10 ? '（已满级）' : ''}</span>}
  {r.mealItem && <span>食用 {name(r.mealItem)} ×1{r.recovery && Object.entries(r.recovery).filter(([, n]) => n > 0).map(([id, n]) => ` · ${{ hunger: '饱食', energy: '体力', health: '健康', mood: '心情', cleanliness: '清洁' }[id]} +${number(n)}`).join('')}</span>}
</div>;

export const ExplorationCheckBuffs = ({ state }: { state?: ExplorationCheckState }) => !state || !state.focus && !state.meal ? null : <div className="exploration-check-buffs" aria-label="旅途准备">
  {state.focus > 0 && <span>观察准备 · 剩余 {state.focus} 次</span>}
  {state.meal && <span>旅途餐食 · 后 {state.meal.steps} 步体力 −{Math.round(state.meal.reduction * 100)}%</span>}
</div>;
