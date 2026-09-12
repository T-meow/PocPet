import room from '../assets/room-v2.svg?raw';
import type { Season } from '../core/season';

export const RoomBackdrop = ({ season }: { season: Season }) => <>
  <div className="room-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: room }} />
  <div className={`room-season-decor room-season-decor--${season}`} aria-hidden="true"><span>{season === 'winter' ? '❄' : season === 'spring' ? '✿' : '❧'}</span><span>{season === 'winter' ? '❄' : '❧'}</span><span>{season === 'spring' ? '✿' : '❧'}</span></div><div className="room-weather-effect" aria-hidden="true" />
</>;
