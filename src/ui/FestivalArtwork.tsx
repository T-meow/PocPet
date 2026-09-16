import type { FestivalId } from '../core/festivalCalendar';
import { festivalNames } from '../core/festivalCalendar';
import { midautumnTitle, storyText } from '../core/festivalStories';
import { seasonalScripts } from '../core/seasonalScripts';
import midautumn from '../assets/story/midautumn-moonlight.webp';
import nationalDay from '../assets/story/national-day.webp';
import labourDay from '../assets/story/labour-day.webp';
import dragonBoat from '../assets/story/dragon-boat.webp';
import springFestival from '../assets/story/spring-festival.webp';

const artwork: Record<FestivalId, string> = { midautumn, 'national-day': nationalDay, 'labour-day': labourDay, 'dragon-boat': dragonBoat, 'spring-festival': springFestival };
export const festivalTitle = (festival: FestivalId) => festival === 'midautumn' ? storyText(midautumnTitle) : seasonalScripts[festival].title;
export const FestivalArtwork = ({ festival }: { festival: FestivalId }) => <img className="festival-cg" src={artwork[festival]} width={1920} height={1080} alt={`${festivalNames[festival]} · ${festivalTitle(festival)}`} loading="lazy" />;
