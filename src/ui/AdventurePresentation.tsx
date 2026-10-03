import type { ReactNode } from 'react';
import { Heart, Utensils, Zap } from 'lucide-react';
import { adventureLandmarkIcons } from '../adventureLandmarkAssets';
import type { AdventureRegionId } from '../core/adventureTypes';
import type { AdventureNodeId } from '../core/adventureMap';
import type { PetState } from '../core/petTypes';
import { getPetEnergyCap, getPetStatCap } from '../core/petStats';
import { AdventureMapLandscape } from './AdventureMapLandscape';
import { AdventureStatMeter } from './AdventureStatMeter';
import type { AdventureCompanion } from './AdventureCompanions';

export const AdventureLandscape = ({ region, node = 'story', portrait, label, children }: {
  region: AdventureRegionId; node?: AdventureNodeId; portrait?: string; label?: string; children?: ReactNode;
}) => <div className="exploration-landscape" data-region={region}>
  <AdventureMapLandscape region={region} />
  <img className="exploration-landscape-landmark" src={adventureLandmarkIcons[region][node]} alt="" />
  {portrait && <img className="exploration-landscape-companion" src={portrait} alt="" />}
  {label && <span className="exploration-scene-label">{label}</span>}
  {children}
</div>;

export const AdventureCompanionStatus = ({ pet, actor, compact = false, children }: {
  pet: PetState; actor: AdventureCompanion; compact?: boolean; children?: ReactNode;
}) => <section className={`exploration-companion-card${compact ? ' exploration-companion-card--compact' : ''}`} aria-label="同行伙伴状态">
  <div className="exploration-companion-identity"><img src={actor.portrait} alt="" /><div><small>同行伙伴</small><h3>{actor.name}</h3><p>{pet.adventure.active || pet.community.expedition.active ? '和你一起，慢慢探索。' : '带好行囊，一起出发。'}</p></div></div>
  <div className="exploration-companion-meters">
    <AdventureStatMeter kind="hunger" label="饱食" value={pet.hunger} max={getPetStatCap(pet)} icon={<Utensils size={17} />} />
    <AdventureStatMeter kind="energy" label="体力" value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={17} />} />
    <AdventureStatMeter kind="health" label="健康" value={pet.health} max={getPetStatCap(pet)} icon={<Heart size={17} />} />
  </div>
  {children}
</section>;
