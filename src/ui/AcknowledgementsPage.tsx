import { ArrowLeft, Check, Gift, Heart } from 'lucide-react';
import { petActivityImages } from '../assets';
import { acknowledgementsGiftCoins } from '../core/acknowledgementsGift';
import { activityText as L } from '../core/kitchenRecipes';

// 按用户提供的顺序展示，昵称保持原样。
const sponsorNames = ['ManoT95', '银点', '我是苔丝的奶香魔法棒', '影ch-'] as const;

export const AcknowledgementsPage = ({ onBack, hasClaimedGift, onClaimGift }: {
  onBack: () => void;
  hasClaimedGift: boolean;
  onClaimGift: () => void;
}) => (
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
    <section className="acknowledgements-gift" aria-labelledby="acknowledgements-gift-title">
      <h3 id="acknowledgements-gift-title">{L('送给每一位伙伴的礼物', 'A gift for every companion')}</h3>
      <p>{L('新老玩家均可领取一次。以前领过玩法说明或启程金币的伙伴，也可以领取这份新礼物。', 'Every player can claim this once per save, including anyone who collected the old help or starter coin gifts.')}</p>
      <button type="button" className="primary-button" disabled={hasClaimedGift} onClick={onClaimGift}>
        {hasClaimedGift ? <Check size={18} aria-hidden="true" /> : <Gift size={18} aria-hidden="true" />}
        <span>{hasClaimedGift ? L('已领取', 'Claimed') : L(`领取 ${acknowledgementsGiftCoins} 金币`, `Claim ${acknowledgementsGiftCoins} coins`)}</span>
      </button>
    </section>
    <p className="acknowledgements-note">{L('每一份支持，都是小窝继续成长的力量。', 'Every bit of support helps our little home keep growing.')}</p>
  </section>
);
