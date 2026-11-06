import { Users } from 'lucide-react';
import { museumImages } from '../../museumAssets';
import { trophyImages } from '../../trophyAssets';
import { resolvePetStatusImages, unknownItemIcon } from '../../assets';
import { getMuseumAppearance, museumTitle } from '../../core/pet';
import { museumExhibits, museumHalls } from '../../core/museumData';
import type { PetState } from '../../core/petTypes';
import type { InstalledPetModSummary } from '../../core/mod';
import { formatInteger } from '../numberFormat';

export interface MuseumProps { pet: PetState; actorId: string; actorName: string; portrait: string; mods: readonly InstalledPetModSummary[]; icons: Record<string, string>; update: (fn: (p: PetState) => PetState) => void }
export const museumExhibitImage = (id: string, icons: Record<string, string>) => museumImages[id] ?? icons[id] ?? unknownItemIcon;
export const MuseumScene = ({ scene = 'museum-hall', portrait, guestPortrait, framed, exhibits = [], icons, caption }: { scene?: string; portrait?: string; guestPortrait?: string; framed?: 'none' | 'common' | 'prestige'; exhibits?: string[]; icons: Record<string, string>; caption?: string }) => <figure className="museum-scene">
  <div className="museum-scene-canvas" data-frame={framed ?? 'none'}>
    <div className="museum-scene-content">
      <img className="museum-scene-background" src={museumImages[scene]} alt={caption ?? '温暖的纪念馆'} draggable={false} />
      {portrait && <img className="museum-scene-actor" src={portrait} alt="同行伙伴" draggable={false} />}
      {guestPortrait && <img className="museum-scene-guest" src={guestPortrait} alt="来访邻居" draggable={false} />}
      <div className="museum-scene-exhibits">{exhibits.map(id => <img key={id} src={museumExhibitImage(id, icons)} alt={museumExhibits.find(e => e.id === id)?.name ?? '收藏展品'} />)}</div>
    </div>
    {framed && framed !== 'none' && <img className="museum-scene-frame" src={museumImages[`memory-frame-${framed}`]} alt="" draggable={false} />}
  </div>
  {caption && <figcaption>{caption}</figcaption>}
</figure>;

// Asset view boxes exclude the transparent padding, so every anchor refers to visible artwork.
const TrophyLayer = ({ src, x, y, width, height, crop, size = 128 }: { src: string; x: number; y: number; width: number; height: number; crop: string; size?: number }) =>
  <svg x={x} y={y} width={width} height={height} viewBox={crop} preserveAspectRatio="xMidYMid meet" overflow="hidden" aria-hidden="true">
    <image href={src} xlinkHref={src} width={size} height={size} />
  </svg>;

export const MuseumTrophyArt = ({ pet }: { pet: PetState }) => {
  const a = getMuseumAppearance(pet);
  const hasBase = a.base !== 'none';
  const plateTitle = a.plate >= 100 ? '百阶同行' : a.plate >= 50 ? '珍藏守望' : a.plate >= 30 ? '同行纪念' : '共同纪念';
  return <span className={`museum-trophy museum-trophy--plate-${a.plate}`}>
    <svg className="museum-trophy-art" viewBox="0 0 250 300" width="250" height="300" role="img" aria-label={`钻石友谊奖杯${a.plate ? ` · ${plateTitle} Lv.${pet.classicEndgame.legacyLevel}` : ''}`} focusable="false">
      <g transform={hasBase ? undefined : 'translate(0 30)'}>
        {hasBase && <TrophyLayer src={museumImages[`trophy-base-${a.base}`]} x={47} y={205} width={156} height={92} crop={a.base === 'prestige' ? '16 34 96 60' : '16 33 96 61'} />}
        <g transform={hasBase ? 'translate(0 24)' : undefined}>
          <TrophyLayer src={trophyImages.diamond} x={35} y={40} width={180} height={184} crop="24 22 208 212" size={256} />
          {a.filigree && <TrophyLayer src={museumImages['trophy-filigree']} x={90} y={142} width={70} height={43} crop="16 34 96 60" />}
          {a.ribbon && <TrophyLayer src={museumImages['trophy-ribbon']} x={86} y={174} width={78} height={58} crop="16 27 96 73" />}
          {a.crown && <TrophyLayer src={museumImages['trophy-crown']} x={98} y={13} width={54} height={32} crop="16 35 96 58" />}
        </g>
        {a.plate > 0 && <g transform={`translate(${hasBase ? '71 246' : '92 188'}) scale(${hasBase ? 1 : 66 / 108})`}>
          <TrophyLayer src={museumImages['trophy-nameplate']} x={0} y={0} width={108} height={44} crop="16 43 96 41" />
          <g className="museum-trophy-plate-label"><text x="54" y="19">{plateTitle}</text><text className="museum-trophy-level" x="54" y="32">Lv.{pet.classicEndgame.legacyLevel}</text></g>
        </g>}
      </g>
    </svg>
  </span>;
};
export const MuseumTrophy = ({ pet }: { pet: PetState }) => <div className="museum-trophy-summary"><MuseumTrophyArt pet={pet} /><strong>{museumTitle(pet)}</strong><p>纪念 Lv.{pet.classicEndgame.legacyLevel} · 策展 {formatInteger(pet.museum.stars)} 星 · 举办 {formatInteger(pet.museum.hosted)} 场</p></div>;
export const MuseumGuest = ({ id, name, mods }: { id?: string; name: string; mods: readonly InstalledPetModSummary[] }) => {
  const image = id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(mod => mod.manifest.id === id)?.contentImageUrl;
  return <span className="museum-guest">{image ? <img src={image} alt="" /> : <Users size={24} />}<span>{name}</span></span>;
};
export const museumRecordScene = (exhibits: string[]) => museumHalls[museumExhibits.find(e => e.id === exhibits[0])?.region ?? 'valley'].scene;
