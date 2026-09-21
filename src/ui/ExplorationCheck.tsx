import { explorationOutcomeNames, explorationSkillNames, getExplorationMoodEffects, type ExplorationCheckDefinition, type ExplorationCheckPreview, type ExplorationCheckResult, type ExplorationCheckState } from '../core/explorationChecks';
import { getInventoryItem } from '../core/items';
import { getPetStatCap, getPetStatRatio } from '../core/petStats';
import { toolDurabilityLabel } from '../core/toolDurability';
import type { ItemId, PetState } from '../core/petTypes';

const number = (n: number) => String(Math.round(n * 10) / 10);
const range = ([a, b]: [number, number]) => a === b ? number(a) : `${number(a)}～${number(b)}`;
const name = (id: string) => getInventoryItem(id as ItemId)?.name ?? id;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${number(n)}`;
const multiplier = (n: number) => String(Math.round(n * 100) / 100);

export const ExplorationChoiceDetails = ({ pet, preview: p, definition: d, hunger, research = false, reason }: {
  pet: PetState; preview: ExplorationCheckPreview; definition: ExplorationCheckDefinition; hunger: number; research?: boolean; reason?: string;
}) => <span className="exploration-check-details">
  <span className="exploration-check-tags"><b>{d.mode === 'check' && p.skill ? `${explorationSkillNames[p.skill]} ${p.skillLevel} 级 · 推荐 ${p.difficulty} 级` : d.mode === 'delivery' ? '交付物品 · 确定完成' : d.mode === 'story' ? '剧情结算 · 确定完成' : '稳定通行 · 确定完成'}</b>{d.mode === 'check' && <b>{d.risky ? '危险捷径' : '普通判定'} · 顺利以上 {number(p.chance)}%</b>}</span>
  <span>饱食 −{hunger} · 体力 −{range(p.energy)} · {p.healthLoss[1] ? `健康 −${range(p.healthLoss)}` : '健康无损'}</span>
  {Object.keys(p.finds).length > 0 && <span>行动收获：{Object.entries(p.finds).map(([id, n]) => `${name(id)} ×${range(n)}`).join(' · ')}</span>}
  {research && <span>调查进度 +{range(p.researchPoints)}</span>}
  {d.tool && <span>{name(d.tool)} · {toolDurabilityLabel(pet, d.tool, d.tool === 'trail_rope')} · 本次耐久 −1{d.tool === 'trail_rope' ? ' · 伤害减半' : ''}</span>}
  {d.mode === 'check' && <small>{p.outcomes.map(o => `${explorationOutcomeNames[o.outcome].replace('完成', '').replace('后继续', '')} ${number(o.probability)}%`).join(' · ')}<br />基础 70%{p.factors.filter(f => f.value).map(f => ` · ${f.label} ${signed(f.value)}`).join('')}{p.chanceCap < 95 ? ` · 越级上限 ${p.chanceCap}%` : ''}</small>}
  <small>基础体力 {p.costFactors.base} · 路线 ×{multiplier(p.costFactors.route)} · 心情 ×{multiplier(p.mood.energy)}{p.costFactors.meal < 1 ? ` · 餐食 ×${multiplier(p.costFactors.meal)}` : ''}{d.risky ? ` · 心情伤害 ×${multiplier(p.mood.injury)}` : ''}{d.prepare === 'focus' ? ' · 顺利准备 1 次，出色准备 2 次' : ''}{d.prepare === 'meal' ? ' · 消耗料理并恢复；出色／顺利减耗 2 步，勉强减耗 1 步' : ''}</small>
  {pet.health - p.healthLoss[1] < getPetStatCap(pet) * .2 && <strong className="exploration-check-warning">本次伤害可能使健康不足，行动后将安全返程。</strong>}
  {(reason || p.reason) && <strong className="exploration-check-warning">{reason || p.reason}</strong>}
</span>;

export const ExplorationCheckSummary = ({ result: r }: { result?: ExplorationCheckResult }) => !r ? null : <div className="exploration-check-result" data-outcome={r.outcome} role="status">
  <strong>{r.title} · {explorationOutcomeNames[r.outcome]}</strong>
  <span>饱食 −{number(r.hunger)} · 体力 −{number(r.energy)} · {r.healthLoss ? `健康 −${number(r.healthLoss)}` : '健康无损'}{r.moodChange ? ` · 心情 ${signed(r.moodChange)}` : ''}</span>
  {Object.keys(r.finds).length > 0 && <span>取得 {Object.entries(r.finds).map(([id, n]) => `${name(id)} ×${n}`).join(' · ')}</span>}
  {r.researchId && <span>{name(r.researchId)}调查进度 +{r.researchPoints}</span>}
  {Boolean(r.coins || r.hearts) && <span>巡路酬谢：金币 +{r.coins ?? 0} · 心心 +{r.hearts ?? 0}</span>}
  {r.tool && <span>{name(r.tool)}耐久 −1{r.toolBroken ? ' · 已用尽' : ''}</span>}
  {r.skill && <span>{explorationSkillNames[r.skill]}经验 +{r.xp}{r.skillLevel === 10 ? '（已满级）' : ''}</span>}
  {r.mealItem && <span>食用 {name(r.mealItem)} ×1{r.recovery && Object.entries(r.recovery).filter(([, n]) => n > 0).map(([id, n]) => ` · ${{ hunger: '饱食', energy: '体力', health: '健康', mood: '心情', cleanliness: '清洁' }[id]} +${number(n)}`).join('')}</span>}
  {r.outcome === 'setback' && <small>已承担额外代价并推进节点，剧情线索照常保留。</small>}
</div>;

export const ExplorationCheckBuffs = ({ state }: { state?: ExplorationCheckState }) => !state || !state.focus && !state.meal ? null : <div className="exploration-check-buffs" aria-label="旅途准备">
  {state.focus > 0 && <span>观察准备 · 后 {state.focus} 次判定 +5 个百分点</span>}
  {state.meal && <span>旅途餐食 · 后 {state.meal.steps} 步体力 −{Math.round(state.meal.reduction * 100)}%</span>}
</div>;

export const ExplorationCheckPreparation = ({ pet }: { pet: PetState }) => <div className="exploration-check-preparation">
  <span>{Object.entries(explorationSkillNames).map(([id, label]) => `${label} ${pet.partnerSchedule.skills[id as keyof typeof explorationSkillNames].level} 级`).join(' · ')}</span>
  <small>当前心情 {Math.round(getPetStatRatio(pet, 'mood') * 100)}% · 体力倍率 ×{multiplier(getExplorationMoodEffects(getPetStatRatio(pet, 'mood')).energy)}。每步按行动前状态计算；危险行动才可能受伤。稳定路线可以完成故事。</small>
</div>;
