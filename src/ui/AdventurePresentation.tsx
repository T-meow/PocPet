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
import { formatCompactNumber, formatInteger } from './numberFormat';

export const AdventureLandscape = ({ region, node = 'story', portrait, label, children }: {
  region: AdventureRegionId; node?: AdventureNodeId; portrait?: string; label?: string; children?: ReactNode;
}) => <div className="exploration-landscape" data-region={region}>
  <AdventureMapLandscape region={region} />
  <img className="exploration-landscape-landmark" src={adventureLandmarkIcons[region][node]} alt="" />
  {portrait && <img className="exploration-landscape-companion" src={portrait} alt="" />}
  {label && <span className="exploration-scene-label">{label}</span>}
  {children}
</div>;

export const AdventureCompanionStatus = ({ pet, actor, compact = false, inlineStats = false, children }: {
  pet: PetState; actor: AdventureCompanion; compact?: boolean; inlineStats?: boolean; children?: ReactNode;
}) => <section className={`exploration-companion-card${compact ? ' exploration-companion-card--compact' : ''}`} aria-label="同行伙伴状态">
  <div className="exploration-companion-identity"><img src={actor.portrait} alt="" /><div><small>同行伙伴</small><h3>{actor.name}</h3><p>{pet.adventure.active || pet.community.expedition.active ? '和你一起，慢慢探索。' : '带好行囊，一起出发。'}</p></div></div>
  {inlineStats ? <div className="exploration-companion-stat-line">{[
    { kind: 'hunger', label: '饱食', value: pet.hunger, max: getPetStatCap(pet), Icon: Utensils },
    { kind: 'energy', label: '体力', value: pet.energy, max: getPetEnergyCap(pet), Icon: Zap },
    { kind: 'health', label: '健康', value: pet.health, max: getPetStatCap(pet), Icon: Heart },
  ].map(({ kind, label, value, max, Icon }) => <span key={kind} className={`exploration-stat-summary exploration-stat-summary--${kind}`} aria-label={`${label} ${formatInteger(value)} / ${formatInteger(max)}`} title={`${label} ${formatInteger(value)} / ${formatInteger(max)}`}><Icon size={15} aria-hidden="true" /><strong>{formatCompactNumber(value)}<small>/{formatCompactNumber(max)}</small></strong></span>)}</div> : <div className="exploration-companion-meters">
    <AdventureStatMeter kind="hunger" label="饱食" value={pet.hunger} max={getPetStatCap(pet)} icon={<Utensils size={17} />} />
    <AdventureStatMeter kind="energy" label="体力" value={pet.energy} max={getPetEnergyCap(pet)} icon={<Zap size={17} />} />
    <AdventureStatMeter kind="health" label="健康" value={pet.health} max={getPetStatCap(pet)} icon={<Heart size={17} />} />
  </div>}
  {children}
</section>;
