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
export const MuseumScene = ({ scene = 'museum-hall', portrait, guestPortrait, framed, exhibits = [], icons, caption }: { scene?: string; portrait?: string; guestPortrait?: string; framed?: 'none' | 'common' | 'prestige'; exhibits?: string[]; icons: Record<string, string>; caption?: string }) => <figure className="museum-scene"><div className="museum-scene-canvas"><img className="museum-scene-background" src={museumImages[scene]} alt={caption ?? '温暖的纪念馆'} draggable={false} />{portrait && <img className="museum-scene-actor" src={portrait} alt="同行伙伴" draggable={false} />}{guestPortrait && <img className="museum-scene-guest" src={guestPortrait} alt="来访邻居" draggable={false} />}<div className="museum-scene-exhibits">{exhibits.map(id => <img key={id} src={museumExhibitImage(id, icons)} alt={museumExhibits.find(e => e.id === id)?.name ?? '收藏展品'} />)}</div>{framed && framed !== 'none' && <img className="museum-scene-frame" src={museumImages[`memory-frame-${framed}`]} alt="" />}</div>{caption && <figcaption>{caption}</figcaption>}</figure>;
export const MuseumTrophyArt = ({ pet }: { pet: PetState }) => {
  const a = getMuseumAppearance(pet);
  return <span className={`museum-trophy museum-trophy--plate-${a.plate}`}>
    {a.base !== 'none' && <img className="museum-trophy-base" src={museumImages[`trophy-base-${a.base}`]} alt="奖杯底座" />}
    <img className="museum-trophy-diamond" src={trophyImages.diamond} alt="钻石友谊奖杯" />
    {a.filigree && <img className="museum-trophy-filigree" src={museumImages['trophy-filigree']} alt="纪念花纹" />}
    {a.ribbon && <img className="museum-trophy-ribbon" src={museumImages['trophy-ribbon']} alt="纪念缎带" />}
    {a.crown && <img className="museum-trophy-crown" src={museumImages['trophy-crown']} alt="冠饰" />}
    {a.plate > 0 && <span className="museum-trophy-plate"><img src={museumImages['trophy-nameplate']} alt="" /><span>{a.plate >= 100 ? '百阶同行' : a.plate >= 50 ? '珍藏守望' : a.plate >= 30 ? '同行纪念' : '共同纪念'}<b>Lv.{pet.classicEndgame.legacyLevel}</b></span></span>}
  </span>;
};
export const MuseumTrophy = ({ pet }: { pet: PetState }) => <div className="museum-trophy-summary"><MuseumTrophyArt pet={pet} /><strong>{museumTitle(pet)}</strong><p>纪念 Lv.{pet.classicEndgame.legacyLevel} · 策展 {formatInteger(pet.museum.stars)} 星 · 举办 {formatInteger(pet.museum.hosted)} 场</p></div>;
export const MuseumGuest = ({ id, name, mods }: { id?: string; name: string; mods: readonly InstalledPetModSummary[] }) => {
  const image = id === 'official.furo' ? resolvePetStatusImages(null).content : mods.find(mod => mod.manifest.id === id)?.contentImageUrl;
  return <span className="museum-guest">{image ? <img src={image} alt="" /> : <Users size={24} />}<span>{name}</span></span>;
};
export const museumRecordScene = (exhibits: string[]) => museumHalls[museumExhibits.find(e => e.id === exhibits[0])?.region ?? 'valley'].scene;
