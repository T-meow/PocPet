import { Compass, Flag, MessageCircle } from 'lucide-react';
import { hashString } from '../core/utils';
import { adventureHallScene } from './adventureScenes';
import type { CompanionPortrait as AdventureCompanion } from './companionRoster';
export type { CompanionPortrait as AdventureCompanion } from './companionRoster';
export { getCompanionRoster as getAdventureCompanions, resolveCompanionPortrait as resolveAdventureCompanion } from './companionRoster';

export const getAdventureHallVisitors = (actorId: string, roster: readonly AdventureCompanion[], day: string) => {
  const neighbors = roster.filter(value => value.id !== actorId);
  const offset = neighbors.length ? hashString(`${day}:${actorId}`) % neighbors.length : 0;
  return [...neighbors.slice(offset), ...neighbors.slice(0, offset)].slice(0, 3);
};

export const AdventureHall = ({ actor, visitors, onSelect, awayIds }: {
  actor: AdventureCompanion; visitors: readonly AdventureCompanion[];
  onSelect: (id: string) => void; awayIds: readonly string[];
}) => {
  return <section className="exploration-hall" aria-label="前哨伙伴">
    <div className="exploration-home-art exploration-hall-scene">
      <img className="exploration-hall-backdrop" src={adventureHallScene} alt="有地图桌与补给架的木质大厅" />
      <div className="exploration-hall-place"><Flag size={20} /><strong>前哨站 · 出发大厅</strong></div>
      <div className="exploration-hall-visitors"><MessageCircle size={17} />今日伙伴 · {visitors.length} 位邻居</div>
      <div className="exploration-hall-cast">
        <div className="exploration-hall-actor exploration-hall-actor--you"><img src={actor.portrait} alt="" /><span><Compass size={16} />{actor.name}<small>同行伙伴</small></span></div>
        {visitors.map((visitor, index) => <button className={`exploration-hall-actor exploration-hall-neighbor exploration-hall-neighbor--${index}${awayIds.includes(visitor.id) ? ' is-away' : ''}`} key={visitor.id} aria-label={`${awayIds.includes(visitor.id) ? '查看委托' : '聊聊与委托'} · ${visitor.name}`} aria-haspopup="dialog" onClick={() => onSelect(visitor.id)}><img src={visitor.portrait} alt="" /><span><MessageCircle size={16} />{visitor.name}{awayIds.includes(visitor.id) && <small>外出搜集</small>}</span></button>)}
      </div>
    </div>
  </section>;
};
