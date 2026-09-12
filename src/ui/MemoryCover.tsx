import { ChevronRight, Flower2, Heart } from 'lucide-react';
import { activityText as L } from '../core/kitchenRecipes';

export const MemoryCover = ({ days, image, unlocked, onOpen }: { days: number; image: string; unlocked: boolean; onOpen: () => void }) => <button className="memory-cover" onClick={onOpen}>
  <span className="memory-copy"><span className="eyebrow">OUR MEMORY BOOK</span><strong>{L('把小日子，', 'Keep our little')}<br />{L('收进回忆里。', 'days together.')}</strong><span className="memory-days"><Heart size={13} />{L(`一起走过 ${days} 天`, `${days} days together`)}</span><span className="memory-link">{L('翻开纪念册', 'Open our memories')}<ChevronRight size={15} /></span></span>
  <span className="memory-art" aria-hidden="true"><span className="memory-paper paper-blue" /><span className="memory-paper paper-pink" /><span className={`memory-photo${unlocked ? '' : ' sticker-cover'}`}><img src={image} alt="" /><span>{L('今天也有你', 'WITH YOU')}</span></span><span className="memory-sticker"><Flower2 /></span><span className="memory-tape" /></span><span className="memory-sprinkle sprinkle-one" aria-hidden="true">✦</span><span className="memory-sprinkle sprinkle-two" aria-hidden="true">✦</span>
</button>;
