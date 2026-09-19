import { useState } from 'react';
import { Check, ChefHat, Flag } from 'lucide-react';
import { communityProjects, contributeCommunityProject, getProjectDelivery, getProjectReason, startCommunityProject } from '../../core/expeditionProjects';
import { projectIds } from '../../core/expeditionData';
import { getInventoryItem } from '../../core/items';
import { canSpendCompanionTime } from '../../core/kitchen';
import type { ItemId } from '../../core/petTypes';
import type { ProjectId } from '../../core/expeditionTypes';
import type { RecipeId } from '../../core/companionActivityTypes';
import type { ExpeditionProps } from './types';

export const ExpeditionProjects = ({ pet, update, actorId, actorName, onKitchen, onCommunity }: ExpeditionProps) => {
  const [themes, setThemes] = useState<Record<ProjectId, 'garden' | 'journey'>>({ riverside: 'garden', exhibition: 'journey', observatory: 'journey' });
  return <div className="exp-projects"><div className="exp-section-intro"><small>把远方的收获，变成共同的生活</small><h2>下一次，邀大家一起。</h2><p>挑喜欢的主题慢慢准备。接受后不过期，每一步投入都保留；首次完成留下回忆与成长。</p></div>{projectIds.map(id => {
    const data = communityProjects[id], p = pet.community.expedition.projects[id], theme = p.theme ?? themes[id], index = theme === 'garden' ? 0 : 1;
    const reason = getProjectReason(pet, id, theme), need = getProjectDelivery(pet, id), ready = Object.entries(need).every(([item, n]) => (pet.inventory[item] ?? 0) >= n);
    const recipeItem = Object.keys(data.meals[index])[0], recipe = recipeItem.slice(5) as RecipeId;
    return <article className="exp-card exp-project" key={id}><div className="exp-card-heading"><span className="exp-number">{id === 'riverside' ? '01' : id === 'exhibition' ? '02' : '03'}</span><div><small>{p.completed ? `已举办 ${p.completed} 次 · 可换主题再聚` : '首次项目 · 体力上限 +3'}</small><h3>{data.name}</h3></div><Flag size={20} /></div><p>{data.description}</p>
      <div className="exp-theme" aria-label={`${data.name}主题`}>{(['garden', 'journey'] as const).map((t, i) => <button key={t} disabled={Boolean(p.theme)} aria-pressed={theme === t} onClick={() => setThemes({ ...themes, [id]: t })}>{data.themes[i]}</button>)}</div>
      <ol className="exp-project-steps">{[data.supplies[index], data.meals[index], {}].map((items, step) => <li key={step} data-done={Boolean(p.theme && p.stage > step)}><span>{p.theme && p.stage > step ? <Check size={14} /> : step + 1}</span><div><b>{['准备物资', '准备菜单', '一起布置与举办'][step]}</b><small>{step === 2 ? '饱食 −4 · 体力 −4' : Object.entries(items).map(([item, n]) => `${getInventoryItem(item as ItemId)?.name ?? item} ${pet.inventory[item] ?? 0}/${n}`).join(' · ')}</small></div></li>)}</ol>
      <div className="exp-reward">{p.completed ? `${data.repeatCoins} 金币 · 2 心心 · 保留首次回忆` : `${data.firstCoins} 金币 · 8 心心 · 永久回忆与成长`}</div>
      {p.theme ? <><button className="exp-primary" disabled={!canSpendCompanionTime(pet) || !ready || p.stage === 2 && (pet.hunger < 4 || pet.energy < 4)} onClick={() => update(current => contributeCommunityProject(current, id, p.completed, p.stage, actorId, actorName))}>{p.stage < 2 ? `交付第 ${p.stage + 1} 阶段物资` : '邀请大家，开始举办'}</button><small className="exp-muted">交付会消耗显示的实物，已投入部分不再重复扣除。</small></> : <><button className="exp-primary" disabled={Boolean(reason)} onClick={() => update(current => startCommunityProject(current, id, theme))}>选择这个主题，开始准备</button>{reason && <small className="exp-muted">{reason}</small>}</>}
      <div className="exp-links"><button onClick={() => onKitchen(recipe)}><ChefHat size={15} />准备菜单</button><button onClick={onCommunity}>回社区取材</button></div>
    </article>;
  })}</div>;
};
