import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { projectIds } from '../../core/expeditionData';
import { communityProjects, type ProjectTheme } from '../../core/communityProjectData';
import { getProjectTheme, getProjectThemes } from '../../core/communityThemes';
import { gatheringArtwork } from '../../communityProjectAssets';
import type { ProjectId } from '../../core/expeditionTypes';
import type { PetState } from '../../core/petTypes';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import '../../styles/community-activities.css';

export const CommunityMemoryArtwork = ({ id, theme }: { id: ProjectId; theme?: ProjectTheme }) => {
  const definition = getProjectTheme(id, theme);
  return <img className="community-memory-cg" width={1920} height={1080} src={gatheringArtwork[definition.artwork]} alt={definition.memory} loading="lazy" />;
};
export const CommunityMemory = ({ pet, id, theme }: { pet: PetState; id: ProjectId; theme?: ProjectTheme }) => {
  const p = pet.community.expedition.projects[id], chosen = theme ?? p.lastTheme ?? 'garden';
  const data = getProjectTheme(id, chosen), memory = p.memories?.[chosen];
  if (!p.completed || !memory && chosen !== 'garden') return null;
  const firstAt = memory?.firstAt ?? p.firstAt, actorName = memory?.actorName ?? p.actorName;
  return <div className="community-memory"><CommunityMemoryArtwork id={id} theme={chosen} /><h3>{data.memory}</h3><p>{data.ending}</p><p>{data.name} · 已举办 {memory?.completed ?? p.completed} 次</p>{actorName && <p>第一次和 {actorName} 一起</p>}{firstAt !== undefined && <small>{new Date(firstAt).toLocaleDateString('zh-CN')} · 每周社区活动</small>}</div>;
};
export const CommunityMemories = ({ pet }: { pet: PetState }) => {
  const [selected, setSelected] = useState<{ id: ProjectId; theme: ProjectTheme } | null>(null);
  const memories = projectIds.flatMap(id => {
    const p = pet.community.expedition.projects[id];
    return getProjectThemes(id).filter(theme => p.memories?.[theme.id]?.completed || theme.id === 'garden' && p.completed && !Object.keys(p.memories ?? {}).length).map(theme => ({ id, theme }));
  });
  return <section className="v2-card community-memories"><h3><BookOpen size={19} />社区回忆</h3>
    {memories.length ? <div className="community-memory-list">{memories.map(({ id, theme }) => <button className="community-memory-link" key={id + ':' + theme.id} onClick={() => setSelected({ id, theme: theme.id })}><CommunityMemoryArtwork id={id} theme={theme.id} /><strong>{theme.memory}</strong><small>{communityProjects[id].name} · {theme.name}</small></button>)}</div> : <p>在布告牌接下社区活动邀请，举办后把共同的风景留在这里。</p>}
    {selected && <CommunityDetailDialog title={getProjectTheme(selected.id, selected.theme).memory} eyebrow="社区回忆 · 重温" onClose={() => setSelected(null)}><CommunityMemory pet={pet} {...selected} /></CommunityDetailDialog>}
  </section>;
};
