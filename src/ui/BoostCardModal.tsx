import { Check, Heart, Sparkles, X } from 'lucide-react';
import { boostCardDefinitions, boostCardIds, canClaimBoostCardDailyReward, getActiveBoostCard, getBoostCardEffects, type BoostCardId, type PetState } from '../core/pet';
import { t } from '../i18n';
import { DialogShell } from './DialogShell';
import { activityText as L } from '../core/kitchenRecipes';

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
    <DialogShell fullscreen className="boost-card-modal" labelId="boost-card-title" onClose={onClose}>
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
            const benefits = [
              L(`每日邻居礼物与 ${definition.dailyCoins} 金币`, `A daily neighbor gift and ${definition.dailyCoins} coins`),
              ...(definition.workBonusCoins ? [L(`打工每次 +${definition.workBonusCoins} 金币，每日最多 ${definition.workBonusDailyLimit}`, `Work +${definition.workBonusCoins} coins, up to ${definition.workBonusDailyLimit} daily`)] : []),
              L(`额外小心心概率 ${definition.extraHeartChancePercent}%`, `${definition.extraHeartChancePercent}% chance of extra hearts`),
              ...(definition.partnerScheduleCoinBonusPercent ? [L(`日程金币 +${definition.partnerScheduleCoinBonusPercent}%`, `Activity coins +${definition.partnerScheduleCoinBonusPercent}%`)] : []),
              ...(definition.gardenGrowTimeMultiplier < 1 ? [L(`植物成长时间减少 ${Math.round((1 - definition.gardenGrowTimeMultiplier) * 100)}%`, `${Math.round((1 - definition.gardenGrowTimeMultiplier) * 100)}% shorter garden growth`)] : []),
              ...(definition.gardenExtraDropChancePercent ? [L(`花园额外产物概率 ${definition.gardenExtraDropChancePercent}%，每日最多 ${definition.gardenExtraDropDailyLimit} 次`, `${definition.gardenExtraDropChancePercent}% extra garden drops, up to ${definition.gardenExtraDropDailyLimit} daily`)] : []),
            ];
            return (
              <article className={activeCardId === cardId ? 'boost-card boost-card--active' : 'boost-card'} key={cardId}>
                <div className="boost-card__icon"><Sparkles size={24} aria-hidden="true" /></div>
                <div className="boost-card__copy">
                  <h3>{t(`ui.boostCards.cards.${cardId}.name`)}</h3>
                  <p>{L('把日常的小惊喜，留给每一天。', 'Little everyday surprises, day after day.')}</p>
                  <small>{t('ui.boostCards.remaining', { days: remainingDays(expiresAt) })}</small>
                  {expiresAt > Date.now() && <small className="friend-card-expiry">{L('有效期至', 'Valid until')} {new Date(expiresAt).toLocaleDateString()}</small>}
                </div>
                <ul className="friend-card-benefits">{benefits.map((benefit) => <li key={benefit}><Check size={15} /><span>{benefit}</span></li>)}</ul>
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
