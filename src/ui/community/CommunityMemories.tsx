import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { projectIds } from '../../core/expeditionData';
import { communityProjects } from '../../core/communityProjectData';
import { communityProjectArtwork } from '../../communityProjectAssets';
import type { ProjectId } from '../../core/expeditionTypes';
import type { PetState } from '../../core/petTypes';
import { CommunityDetailDialog } from './CommunityDetailDialog';
import '../../styles/community-activities.css';

export const CommunityMemoryArtwork = ({ id }: { id: ProjectId }) => {
  const image = communityProjectArtwork[id];
  return image ? <img className="community-memory-cg" src={image} alt={communityProjects[id].memory} loading="lazy" /> : null;
};
export const CommunityMemory = ({ pet, id }: { pet: PetState; id: ProjectId }) => {
  const data = communityProjects[id], p = pet.community.expedition.projects[id];
  if (!p.completed) return null;
  return <div className="community-memory"><CommunityMemoryArtwork id={id} /><h3>{data.memory}</h3><p>{data.ending}</p><p>{data.name} · 已举办 {p.completed} 次</p>{p.actorName && <p>第一次和 {p.actorName} 一起</p>}{p.firstAt !== undefined && <small>{new Date(p.firstAt).toLocaleDateString('zh-CN')}</small>}</div>;
};
export const CommunityMemories = ({ pet }: { pet: PetState }) => {
  const [selected, setSelected] = useState<ProjectId | null>(null);
  const memories = projectIds.filter(id => pet.community.expedition.projects[id].completed > 0);
  return <section className="v2-card community-memories"><h3><BookOpen size={19} />社区回忆</h3>
    {memories.length ? <div className="community-memory-list">{memories.map(id => <button className="community-memory-link" key={id} onClick={() => setSelected(id)}><CommunityMemoryArtwork id={id} /><strong>{communityProjects[id].memory}</strong><small>{communityProjects[id].name} · {pet.community.expedition.projects[id].completed} 次</small></button>)}</div> : <p>在布告牌接下社区活动邀请，举办后把共同的风景留在这里。</p>}
    {selected && <CommunityDetailDialog title={communityProjects[selected].memory} eyebrow="社区回忆 · 重温" onClose={() => setSelected(null)}><CommunityMemory pet={pet} id={selected} /></CommunityDetailDialog>}
  </section>;
};
