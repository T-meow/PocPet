import { Heart, Sparkles, X } from 'lucide-react';
import { boostCardDefinitions, boostCardIds, canClaimBoostCardDailyReward, getActiveBoostCard, getBoostCardEffects, type BoostCardId, type PetState } from '../core/pet';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';

interface BoostCardModalProps {
  pet: PetState;
  onClose: () => void;
  onBuyCard: (cardId: BoostCardId) => void;
  onClaimDailyReward: () => void;
}

const remainingDays = (expiresAt: number) => expiresAt <= Date.now() ? 0 : Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));

export const BoostCardModal = ({ pet, onClose, onBuyCard, onClaimDailyReward }: BoostCardModalProps) => {
  const activeCardId = getActiveBoostCard(pet);
  const effects = getBoostCardEffects(pet);
  const claimed = Boolean(activeCardId && !canClaimBoostCardDailyReward(pet));
  const bestFriendActive = activeCardId === 'best_friend_pass';

  return (
    <DialogShell className="boost-card-modal" labelId="boost-card-title" onClose={onClose}>
        <header className="boost-card-modal__header">
          <div>
            <h2 id="boost-card-title">{t('ui.boostCards.title')}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('ui.boostCards.close')} title={t('ui.boostCards.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="boost-card-summary">
          <strong>{activeCardId ? t('ui.boostCards.activeCard', { card: t(`ui.boostCards.cards.${activeCardId}.name`) }) : t('ui.boostCards.noActive')}</strong>
          {effects.workBonusDailyLimit > 0 && (
            <span>{t('ui.boostCards.todayWork', { coins: pet.boostCards.dailyWorkBonusCoinsUsed, limit: effects.workBonusDailyLimit })}</span>
          )}
          {effects.gardenExtraDropDailyLimit > 0 && (
            <span>{t('ui.boostCards.todayGarden', { count: pet.boostCards.dailyGardenExtraDrops, limit: effects.gardenExtraDropDailyLimit })}</span>
          )}
          <button type="button" className="primary-button" disabled={!activeCardId || claimed} onClick={onClaimDailyReward}>
            {claimed ? t('ui.boostCards.claimed') : t('ui.boostCards.claimReward', { coins: effects.dailyCoins })}
          </button>
        </div>
        <div className="boost-card-list">
          {boostCardIds.map((cardId) => {
            const definition = boostCardDefinitions[cardId];
            const expiresAt = cardId === 'friend_pass' ? pet.boostCards.friendPassExpiresAt : pet.boostCards.bestFriendPassExpiresAt;
            const blockedByBestFriend = cardId === 'friend_pass' && bestFriendActive;
            const disabled = blockedByBestFriend || pet.hearts < definition.priceHearts;
            return (
              <article className={activeCardId === cardId ? 'boost-card boost-card--active' : 'boost-card'} key={cardId}>
                <div className="boost-card__icon"><Sparkles size={24} aria-hidden="true" /></div>
                <div className="boost-card__copy">
                  <h3>{t(`ui.boostCards.cards.${cardId}.name`)}</h3>
                  <p>{t(`ui.boostCards.cards.${cardId}.summary`)}</p>
                  <small>{t('ui.boostCards.remaining', { days: remainingDays(expiresAt) })}</small>
                </div>
                <button type="button" className="primary-button" disabled={disabled} title={blockedByBestFriend ? t('ui.boostCards.bestFriendBlocksFriend') : undefined} onClick={() => onBuyCard(cardId)}>
                  <Heart size={16} aria-hidden="true" /> {blockedByBestFriend ? t('ui.boostCards.blockedByBestFriend') : t('ui.boostCards.buy', { hearts: definition.priceHearts })}
                </button>
              </article>
            );
          })}
        </div>
    </DialogShell>
  );
};
