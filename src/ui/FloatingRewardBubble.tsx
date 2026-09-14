import { giftBoxIcon } from '../assets';
import { t } from '../i18n';
import type { FloatingRewardConfig } from './app/useRewardController';

export const FloatingRewardBubble = ({ reward, onClaim }: {
  reward: FloatingRewardConfig;
  onClaim: (reward: FloatingRewardConfig) => void;
}) => {
  const label = reward.gachaTickets
    ? t('ui.rewards.communityWorkGiftClaim', { count: reward.gachaTickets })
    : t('ui.rewards.claim');
  return <button
    type="button"
    className={`floating-reward-button${reward.gachaTickets ? ' floating-reward-button--labeled' : ''}`}
    aria-label={label}
    title={label}
    onClick={() => onClaim(reward)}
  >
    <img src={giftBoxIcon} alt="" aria-hidden="true" />
    {reward.gachaTickets ? <span className="floating-reward-button__copy">
      <strong>{t('ui.rewards.communityWorkGiftBubble')}</strong>
      <small>{t('ui.rewards.communityWorkGiftTickets', { count: reward.gachaTickets })}</small>
    </span> : null}
  </button>;
};
