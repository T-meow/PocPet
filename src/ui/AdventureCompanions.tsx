import { useState } from 'react';
import { Compass, Flag, MessageCircle } from 'lucide-react';
import { hashString } from '../core/utils';
import { adventureHallScene } from './adventureScenes';
import type { CompanionPortrait as AdventureCompanion } from './companionRoster';
export type { CompanionPortrait as AdventureCompanion } from './companionRoster';
export { getCompanionRoster as getAdventureCompanions, resolveCompanionPortrait as resolveAdventureCompanion } from './companionRoster';

export const AdventureHall = ({ actor, roster, day, traveling }: {
  actor: AdventureCompanion; roster: readonly AdventureCompanion[]; day: string; traveling: boolean;
}) => {
  const [greeting, setGreeting] = useState<AdventureCompanion>();
  const neighbors = roster.filter(value => value.id !== actor.id);
  const offset = neighbors.length ? hashString(`${day}:${actor.id}`) % neighbors.length : 0;
  const visitors = traveling ? [] : [...neighbors.slice(offset), ...neighbors.slice(0, offset)].slice(0, 3);
  const speaker = visitors.find(visitor => visitor.id === greeting?.id);
  return <section className="exploration-hall" aria-label="前哨伙伴">
    <div className="exploration-home-art exploration-hall-scene">
      <img className="exploration-hall-backdrop" src={adventureHallScene} alt="有地图桌与补给架的木质大厅" />
      <div className="exploration-hall-place"><Flag size={20} /><strong>前哨站 · 出发大厅</strong></div>
      <div className="exploration-hall-visitors"><MessageCircle size={17} />{traveling ? '期待下一次相遇' : `今日歇脚 · ${visitors.length} 位邻居`}</div>
      <div className="exploration-hall-cast">
        <div className="exploration-hall-actor exploration-hall-actor--you"><img src={actor.portrait} alt="" /><span><Compass size={16} />{actor.name}<small>同行伙伴</small></span></div>
        {visitors.map((visitor, index) => <button className={`exploration-hall-actor exploration-hall-neighbor exploration-hall-neighbor--${index}`} key={visitor.id} aria-label={`聊聊 · ${visitor.name}`} aria-pressed={speaker?.id === visitor.id} onClick={() => setGreeting(visitor)}><img src={visitor.portrait} alt="" /><span><MessageCircle size={16} />{visitor.name}</span></button>)}
      </div>
    </div>
    <div className="exploration-hall-dialogue" role="status"><img src={speaker?.portrait ?? actor.portrait} alt="" /><div><strong>{speaker?.name ?? actor.name}</strong><small>{speaker ? '出发前聊两句' : '今天也有新的风景'}</small><p>{speaker ? '这趟记得带几份料理！路上遇见我，可以买补给，也可以请我从仓库送来物资。' : traveling ? `${actor.name}的旅途进度已保存，准备好就继续出发。` : visitors.length ? '伙伴们正在前哨歇脚，点一下就能聊聊。带好行囊，再一起出发吧。' : '收好行囊，和伙伴开始下一段故事。'}</p></div>{speaker && <span className="exploration-tag">正在聊天</span>}</div>
  </section>;
};
