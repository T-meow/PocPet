import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { PetState } from '../core/petTypes';
import type { CampaignRun } from '../core/explorationCampaignState';
import { CampaignArtwork, CampaignEnding, campaignRunTitle } from './ExplorationTasks';
import { CommunityDetailDialog } from './community/CommunityDetailDialog';

export const GatheringCampaignMemories = ({ pet }: { pet: PetState }) => {
  const [selected, setSelected] = useState<CampaignRun>();
  const quarterly = Object.values(pet.adventure.campaign.memories).filter((run): run is CampaignRun => Boolean(run));
  const reunion = [...pet.adventure.reunion.history, pet.adventure.reunion].filter(run => run.tasks[45]);
  const memories = [...quarterly, ...reunion].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  if (!memories.length) return null;
  return <section className="v2-card community-memories"><h3><BookOpen size={19} />旅途中的聚餐回忆</h3><div className="community-memory-list">{memories.map(run => <button key={run.runId} className="community-memory-link" onClick={() => setSelected(run)}><CampaignArtwork run={run} /><strong>{campaignRunTitle(run)}</strong><small>{run.kind === 'spring-reunion' ? run.year + ' 年春节团圆' : run.quarter + ' · 季度聚餐'}</small></button>)}</div>
    {selected && <CommunityDetailDialog title={campaignRunTitle(selected)} eyebrow="旅途聚餐 · 重温" onClose={() => setSelected(undefined)}><CampaignEnding run={selected} /></CommunityDetailDialog>}
  </section>;
};
