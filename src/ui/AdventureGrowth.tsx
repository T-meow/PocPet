import { BookOpen, Dumbbell, Leaf, LockKeyhole, Utensils } from 'lucide-react';
import { expeditionLandmarkIcons } from '../adventureLandmarkAssets';
import { getRegionUnlocked, regionIds, regions } from '../core/expeditionData';
import type { RegionId } from '../core/expeditionTypes';
import type { PetState } from '../core/petTypes';
import { getExplorationTier } from '../core/explorationBudget';
import { explorationSkillNames } from '../core/explorationChecks';
import { ExpeditionCamp } from './expedition/ExpeditionCamp';
import { ExplorationBackpackUpgrade } from './expedition/ExplorationBackpackUpgrade';

export const AdventureGrowth = ({ pet, region, update, onRegion, onMap, onShop, onIdle }: {
  pet: PetState; region: RegionId; update: (fn: (pet: PetState) => PetState) => void;
  onRegion: (region: RegionId) => void; onMap: () => void; onShop: () => void; onIdle: () => void;
}) => <div className="exploration-growth-page">
  <nav className="exploration-region-tabs" aria-label="选择营地地区">{regionIds.map(id => <button key={id} aria-pressed={region === id} onClick={() => onRegion(id)}><img src={expeditionLandmarkIcons[id].story} alt="" /><span><strong>{regions[id].name}</strong><small>{pet.community.expedition.regions[id].surveyed ? '地标全部完成' : getRegionUnlocked(pet,id) ? '继续探索' : '尚未解锁'}</small></span>{!getRegionUnlocked(pet,id) && <LockKeyhole size={15} />}</button>)}</nav>
  <div className="exploration-growth-layout"><ExpeditionCamp pet={pet} update={update} region={region} onMap={onMap} onShop={onShop} onIdle={onIdle} /><aside><ExplorationBackpackUpgrade pet={pet} update={update} /><section className="exploration-growth"><div className="exploration-section-heading"><h3>伙伴的探索技能</h3><span className="exploration-tag">第 {getExplorationTier(pet)} 档</span></div><div className="exploration-skill-list">{(['study','garden','exercise','cooking'] as const).map(skill => {
    const Icon = {study:BookOpen,garden:Leaf,exercise:Dumbbell,cooking:Utensils}[skill], level=pet.partnerSchedule.skills[skill].level;
    return <div key={skill}><Icon size={24} /><span><strong>{explorationSkillNames[skill]} <b>Lv.{level}</b></strong><small>{skill === 'cooking' ? `自动补给费用 −${level*3}%` : `对应动作体力 −${level*4}% · 饱食 −${level*2}%`}</small></span></div>;
  })}</div><p>学习用于调查，园艺用于采集，运动用于越障。安全选项和工具动作同样获得减免。</p></section></aside></div>
</div>;
