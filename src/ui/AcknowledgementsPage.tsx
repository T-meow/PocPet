import { ArrowLeft, Heart } from 'lucide-react';
import { petActivityImages } from '../assets';
import { activityText as L } from '../core/kitchenRecipes';

// 按用户提供的顺序展示，昵称保持原样。
const sponsorNames = ['ManoT95', '银点', '我是苔丝的奶香魔法棒', '影ch-'] as const;

export const AcknowledgementsPage = ({ onBack }: { onBack: () => void }) => (
  <section className="acknowledgements-page" aria-labelledby="acknowledgements-title">
    <button type="button" className="text-button acknowledgements-back" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden="true" />{L('返回帮助与关于', 'Back to help & about')}
    </button>
    <header className="acknowledgements-hero">
      <div>
        <span className="acknowledgements-heart" aria-hidden="true"><Heart size={22} /></span>
        <h2 id="acknowledgements-title">{L('致谢名单', 'Acknowledgements')}</h2>
        <p>{L('感谢以下伙伴对 PocPet 开发的赞助与支持。', 'Thank you to everyone below for sponsoring and supporting the development of PocPet.')}</p>
      </div>
      <img src={petActivityImages.happy} alt="" aria-hidden="true" draggable={false} />
    </header>
    <ul className="acknowledgements-list" aria-label={L('赞助开发的伙伴', 'Development supporters')}>
      {sponsorNames.map((name) => (
        <li key={name}>
          <Heart size={16} aria-hidden="true" />
          <span>{name}</span>
        </li>
      ))}
    </ul>
    <p className="acknowledgements-note">{L('每一份支持，都是小窝继续成长的力量。', 'Every bit of support helps our little home keep growing.')}</p>
  </section>
);
