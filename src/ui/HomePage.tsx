import type { ReactNode } from 'react';
import {
  getDailyWishView,
  getEnergyRecoveryInfo,
  getPetEnergyCap,
  getPetStatCap,
  getReturnWelcomeView,
  type PetAction,
  type NeighborIdentity,
  type PetState,
  type PetStatus,
  type RecentActivity,
} from '../core/pet';
import { t } from '../i18n';
import { ActionDock } from './ActionDock';
import { FeatureRow } from './FeatureRow';
import { PartnerScheduleDock } from './PartnerScheduleDock';
import { PetDisplay } from './PetDisplay';
import { StatusBar } from './StatusBar';

interface HomePageProps {
  pet: PetState;
  neighbors: readonly NeighborIdentity[];
  inventoryKindCount: number;
  isLowEnergy: boolean;
  isCriticallyHungry: boolean;
  canUpgrade: boolean;
  nextUpgradeCost: number;
  isPomodoroOpen: boolean;
  pomodoroRemainingMs: number;
  pomodoroStartTitle?: string;
  gardenReminder?: 'ready' | 'withered';
  pomodoroOverlay?: ReactNode;
  petStatusImages: Record<PetStatus, string>;
  petActivityImages: Partial<Record<RecentActivity, string>>;
  getStatusLabel: (status: PetStatus) => string;
  onInteract: () => void;
  onUpgrade: () => void;
  onDailyWish: () => void;
  onReturnWelcome: () => void;
  onOpenInventory: () => void;
  onOpenPomodoro: () => void;
  onOpenGarden: () => void;
  onOpenBoostCards: () => void;
  onOpenPartnerSchedule: () => void;
  onOpenGacha: () => void;
  onOpenCommonDreams: () => void;
  onAction: (action: PetAction) => void;
}

const formatSharedTime = (seconds: number) => {
  const totalDays = Math.max(1, Math.floor(seconds / 86400) + 1);
  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  if (years > 0) return t('ui.time.yearsMonthsDays', { years, months, days });
  if (months > 0) return t('ui.time.monthsDays', { months, days });
  return t('ui.time.days', { days: totalDays });
};

const formatCountdownTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
};

export const HomePage = ({
  pet,
  neighbors,
  inventoryKindCount,
  isLowEnergy,
  isCriticallyHungry,
  canUpgrade,
  nextUpgradeCost,
  isPomodoroOpen,
  pomodoroRemainingMs,
  pomodoroStartTitle,
  gardenReminder,
  pomodoroOverlay,
  petStatusImages,
  petActivityImages,
  getStatusLabel,
  onInteract,
  onUpgrade,
  onDailyWish,
  onReturnWelcome,
  onOpenInventory,
  onOpenPomodoro,
  onOpenGarden,
  onOpenBoostCards,
  onOpenPartnerSchedule,
  onOpenGacha,
  onOpenCommonDreams,
  onAction,
}: HomePageProps) => {
  const statCap = getPetStatCap(pet);
  const energyCap = getPetEnergyCap(pet);
  const isPetBusy = Boolean(pet.partnerSchedule.active);
  const energyRecoveryInfo = getEnergyRecoveryInfo(pet);
  const energyRecoveryText = energyRecoveryInfo.isFull || energyRecoveryInfo.isPaused ? '' : formatCountdownTime(energyRecoveryInfo.remainingMs);
  const stats = [
    { label: t('ui.stats.hunger'), value: pet.hunger, max: statCap, tone: 'food' as const },
    { label: t('ui.stats.mood'), value: pet.mood, max: statCap, tone: 'mood' as const },
    { label: t('ui.stats.cleanliness'), value: pet.cleanliness, max: statCap, tone: 'clean' as const },
    { label: t('ui.stats.energy'), value: pet.energy, max: energyCap, detail: energyRecoveryText, tone: 'energy' as const },
    { label: t('ui.stats.health'), value: pet.health, max: statCap, tone: 'health' as const },
  ];
  const dailyWishView = getDailyWishView(pet);
  const returnWelcomeView = getReturnWelcomeView(pet);
  const dailyWishButtonLabel = dailyWishView.canClaim || dailyWishView.claimed
    ? dailyWishView.buttonLabel
    : t(`ui.wishes.actions.${pet.dailyWish.action}`);
  const returnWelcomeButtonLabel = returnWelcomeView && pet.returnWelcome
    ? returnWelcomeView.canClaim
      ? returnWelcomeView.buttonLabel
      : t(`ui.wishes.actions.${pet.returnWelcome.action}`)
    : '';

  return (
    <>
      <div className="content-grid">
        <PetDisplay
          pet={pet}
          onInteract={onInteract}
          overlay={pomodoroOverlay}
          petStatusImages={petStatusImages}
          petActivityImages={petActivityImages}
          getStatusLabel={getStatusLabel}
          canUpgrade={canUpgrade}
          isPetBusy={isPetBusy}
          nextUpgradeCost={nextUpgradeCost}
          onUpgrade={onUpgrade}
        />

        <section className="dashboard" aria-label={t('ui.dashboard.aria')}>
          <div className="stat-grid">
            {stats.map((stat) => <StatusBar key={stat.label} {...stat} />)}
          </div>

          <div className="event-panel">
            <span>{t('ui.dashboard.event')}</span>
            <p>{pet.recentEvent}</p>
          </div>

          <div className="wish-stack">
            {returnWelcomeView && (
              <section className="wish-panel wish-panel--return" aria-label={t('ui.returnWelcome.aria')}>
                <div className="wish-panel__copy">
                  <span>{t('ui.returnWelcome.kicker')}</span>
                  <h2>{returnWelcomeView.title}</h2>
                  <small>{returnWelcomeView.progressText} · {returnWelcomeView.rewardText}</small>
                </div>
                <button
                  type="button"
                  className="primary-button wish-panel__button"
                  disabled={isPetBusy && !returnWelcomeView.canClaim}
                  title={isPetBusy && !returnWelcomeView.canClaim ? t('ui.partnerSchedule.busyHint') : undefined}
                  onClick={onReturnWelcome}
                >
                  {isPetBusy && !returnWelcomeView.canClaim ? t('ui.partnerSchedule.busyShort') : returnWelcomeButtonLabel}
                </button>
              </section>
            )}
            {!dailyWishView.claimed && (
              <section className="wish-panel" aria-label={t('ui.dailyWish.aria')}>
                <div className="wish-panel__copy">
                  <span>{t('ui.dailyWish.kicker')}</span>
                  <h2>{dailyWishView.title}</h2>
                  <small>{dailyWishView.progressText} · {dailyWishView.rewardText}</small>
                </div>
                <button
                  type="button"
                  className="primary-button wish-panel__button"
                  disabled={dailyWishView.claimed || (isPetBusy && !dailyWishView.canClaim)}
                  title={isPetBusy && !dailyWishView.canClaim ? t('ui.partnerSchedule.busyHint') : undefined}
                  onClick={onDailyWish}
                >
                  {isPetBusy && !dailyWishView.canClaim ? t('ui.partnerSchedule.busyShort') : dailyWishButtonLabel}
                </button>
              </section>
            )}
          </div>

          <FeatureRow
            pet={pet}
            inventoryKindCount={inventoryKindCount}
            isPomodoroOpen={isPomodoroOpen}
            pomodoroRemainingMs={pomodoroRemainingMs}
            pomodoroStartTitle={pomodoroStartTitle}
            gardenReminder={gardenReminder}
            onOpenInventory={onOpenInventory}
            onOpenPomodoro={onOpenPomodoro}
            onOpenGarden={onOpenGarden}
            onOpenBoostCards={onOpenBoostCards}
            onOpenPartnerSchedule={onOpenPartnerSchedule}
            onOpenGacha={onOpenGacha}
            onOpenCommonDreams={onOpenCommonDreams}
          />

          <div className="meta-row" aria-label={t('ui.dashboard.metaAria')}>
            <span className="meta-row__shared-time">{t('ui.dashboard.sharedTime', { time: formatSharedTime(pet.ageSeconds) })}</span>
            <span className="meta-row__state">{pet.isSleeping ? t('ui.dashboard.resting') : t('ui.dashboard.active')}</span>
          </div>
        </section>
      </div>

      {pet.partnerSchedule.active ? (
        <PartnerScheduleDock pet={pet} neighbors={neighbors} onOpen={onOpenPartnerSchedule} />
      ) : (
        <ActionDock
          isSleeping={pet.isSleeping}
          isLowEnergy={isLowEnergy}
          isCriticallyHungry={isCriticallyHungry}
          onAction={onAction}
        />
      )}
    </>
  );
};
